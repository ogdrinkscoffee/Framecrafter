import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { editElementWithGemini } from './serverAi.ts';
import {
  getTurnstileConfig,
  turnstileFailureMessage,
  turnstileFailureStatus,
  verifyTurnstileToken,
} from './serverTurnstile.ts';
import {
  applySecurityHeaders,
  enforceSameOriginForMutations,
  resolveTrustedOrigins,
} from './serverSecurity.ts';
import { bundleProjectFiles } from './serverBundler.ts';
import {
  exchangeGitHubOAuthCode,
  fetchGitHubAuthenticatedUser,
  listAuthenticatedGitHubRepos,
  listGitHubRepoBranches,
  listPublicGitHubReposByUsername,
  pullFromGitHubRepo,
  pushToGitHubRepo,
} from './serverGithub.ts';
import {
  isValidGitHubClientId,
  isValidGitHubClientSecret,
  OAuthStateStore,
  PendingPkceExchangeStore,
  renderOAuthCallbackHtml,
  resolveAppOrigin,
  sanitizeClientNonce,
  sanitizeHttpUrl,
  sanitizePkceChallenge,
  verifyPkceS256,
} from './serverOAuth.ts';
import type { GitHubUserProfile } from './src/utils/githubSync.ts';
import {
  createSlidingWindowRateLimiter,
  isValidGitHubUsername,
  validateAiEditElementPayload,
  validateBundleProjectPayload,
  validateGithubOAuthExchangePayload,
  validateGithubPullPayload,
  validateGithubPushPayload,
} from './src/utils/serverValidation.ts';

interface GitHubSessionRecord {
  accessToken: string;
  user: GitHubUserProfile;
  expiresAt: number;
}

const MAX_GITHUB_SEARCH_QUERY_LEN = 100;

/** Trims, strips control characters and caps repository search terms. */
function sanitizeSearchQuery(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return cleaned ? cleaned.slice(0, MAX_GITHUB_SEARCH_QUERY_LEN) : undefined;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const GITHUB_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.use(applySecurityHeaders(!isProd));
  app.use(express.json({ limit: '50mb' }));
  // No CORS wildcard exists; state-changing browser requests must be same-origin
  // (or come from the configured app/OAuth origins).
  app.use(
    '/api',
    enforceSameOriginForMutations(
      resolveTrustedOrigins(process.env.APP_URL, process.env.GITHUB_OAUTH_CALLBACK_URL)
    )
  );

  const oauthStateStore = new OAuthStateStore(OAUTH_STATE_TTL_MS);
  const pkceExchangeStore = new PendingPkceExchangeStore(5 * 60 * 1000);
  const githubSessions = new Map<string, GitHubSessionRecord>();

  const pruneExpiredAuthStores = () => {
    const now = Date.now();
    oauthStateStore.prune(now);
    pkceExchangeStore.prune(now);
    for (const [k, v] of githubSessions.entries()) {
      if (v.expiresAt <= now) githubSessions.delete(k);
    }
  };

  const resolveGitHubCallbackUrl = (origin: string): string => {
    const externalCallback = sanitizeHttpUrl(process.env.GITHUB_OAUTH_CALLBACK_URL);
    if (externalCallback) return externalCallback;
    return `${origin}/auth/github/callback`;
  };

  const extractOriginSafe = (urlStr: string, fallbackOrigin: string): string => {
    try {
      return new URL(urlStr).origin;
    } catch {
      return fallbackOrigin;
    }
  };

  const getBearerSessionToken = (req: express.Request): string | null => {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      return token || null;
    }
    return null;
  };

  const resolveGitHubSession = (req: express.Request): GitHubSessionRecord | null => {
    pruneExpiredAuthStores();
    const sessionToken = getBearerSessionToken(req);
    if (!sessionToken) return null;
    const record = githubSessions.get(sessionToken);
    if (!record || record.expiresAt <= Date.now()) {
      if (record) githubSessions.delete(sessionToken);
      return null;
    }
    return record;
  };

  const resolveGitHubAuth = (
    req: express.Request,
    explicitPat?: string
  ): { token?: string; sessionExpired: boolean } => {
    const bearerToken = getBearerSessionToken(req);
    if (bearerToken) {
      const session = resolveGitHubSession(req);
      if (session?.accessToken) {
        return { token: session.accessToken, sessionExpired: false };
      }
    }
    const patHeader = req.headers['x-github-token'];
    if (typeof patHeader === 'string' && patHeader.trim()) {
      return { token: patHeader.trim(), sessionExpired: false };
    }
    if (explicitPat && explicitPat.trim()) {
      return { token: explicitPat.trim(), sessionExpired: false };
    }
    return { token: undefined, sessionExpired: Boolean(bearerToken) };
  };

  const resolveEffectiveGitHubToken = (req: express.Request, explicitPat?: string): string | undefined =>
    resolveGitHubAuth(req, explicitPat).token;

  // Structured request logging: logs method, path, status, IP, and duration.
  // Sensitive query/body params are never logged.
  const startRequestLog = (req: express.Request) => {
    const startTime = Date.now();
    return (res: express.Response) => {
      const durationMs = Date.now() - startTime;
      const status = res.statusCode;
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const safePath = req.path.length > 200 ? req.path.slice(0, 200) + '…' : req.path;
      console.log(JSON.stringify({
        ts: new Date().toISOString(),
        method: req.method,
        path: safePath,
        status,
        ip,
        durationMs,
        userAgent: (req.headers['user-agent'] || '').slice(0, 120),
      }));
    };
  };

  app.use((req, res, next) => {
    res.on('finish', startRequestLog(req));
    next();
  });

  const bundleRateLimiter = createSlidingWindowRateLimiter({
    maxRequests: 60,
    windowMs: 60_000,
  });
  const githubRateLimiter = createSlidingWindowRateLimiter({
    maxRequests: 45,
    windowMs: 60_000,
  });
  const aiRateLimiter = createSlidingWindowRateLimiter({
    maxRequests: 20,
    windowMs: 60_000,
  });

  const enforceRateLimit = (
    limiter: ReturnType<typeof createSlidingWindowRateLimiter>,
    req: express.Request,
    res: express.Response
  ): boolean => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const check = limiter.check(clientIp);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSec));
      res.status(429).json({
        ok: false,
        error: `Too many requests. Please wait ${check.retryAfterSec}s before retrying.`,
      });
      return false;
    }
    return true;
  };

  app.get('/esbuild.wasm', (_req, res) => {
    const wasmPath = path.resolve(process.cwd(), 'node_modules/esbuild-wasm/esbuild.wasm');
    if (fs.existsSync(wasmPath)) {
      res.setHeader('Content-Type', 'application/wasm');
      res.sendFile(wasmPath);
      return;
    }
    res.status(404).send('esbuild.wasm not found');
  });

  // Public bot-protection config: the Turnstile site key is public by design,
  // the secret key is only ever read here on the server.
  app.get('/api/security/status', (_req, res) => {
    const turnstile = getTurnstileConfig();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      turnstile: {
        enabled: turnstile.enabled,
        siteKey: turnstile.enabled ? turnstile.siteKey : '',
      },
    });
  });

  app.post('/api/bundle-project', async (req, res) => {
    if (!enforceRateLimit(bundleRateLimiter, req, res)) return;
    try {
      const validated = validateBundleProjectPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }
      const bundle = await bundleProjectFiles(validated.data.files, validated.data.entryPath);
      res.json(bundle);
    } catch (err) {
      console.error('Bundle project route error:', err);
      res.status(500).json({ error: 'Unable to bundle project files right now.' });
    }
  });

  app.post('/api/ai/edit-element', async (req, res) => {
    if (!enforceRateLimit(aiRateLimiter, req, res)) return;
    try {
      const validated = validateAiEditElementPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ ok: false, error: validated.error });
        return;
      }

      // Public, unauthenticated AI trigger: verify the Turnstile challenge before
      // spending any model budget. Tokens are single-use and verified server-side.
      const remoteIp = req.ip || req.socket.remoteAddress || undefined;
      const botCheck = await verifyTurnstileToken(validated.data.captchaToken, remoteIp);
      if (!botCheck.ok) {
        res.status(turnstileFailureStatus(botCheck.reason)).json({
          ok: false,
          error: turnstileFailureMessage(botCheck.reason),
        });
        return;
      }

      const result = await editElementWithGemini(validated.data);
      if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }

      res.json({
        ok: true,
        updatedCode: result.updatedCode,
        explanation: result.explanation,
      });
    } catch (err) {
      console.error('AI edit-element route error:', err);
      res.status(500).json({
        ok: false,
        error: 'Unable to process AI element edit right now.',
      });
    }
  });

  app.get('/api/auth/github/status', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    const secretValidIfSet = !clientSecret || isValidGitHubClientSecret(clientSecret);
    const configured = isValidGitHubClientId(clientId) && secretValidIfSet;
    const origin = resolveAppOrigin(req.query.origin);
    const callbackUrl = resolveGitHubCallbackUrl(origin);
    const callbackOrigin = extractOriginSafe(callbackUrl, origin);
    const session = resolveGitHubSession(req);

    res.json({
      configured,
      pkceSupported: true,
      callbackUrl,
      callbackOrigin,
      connected: Boolean(session),
      ...(session ? { user: session.user } : {}),
    });
  });

  app.get('/api/auth/github/url', (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    pruneExpiredAuthStores();

    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    const origin = resolveAppOrigin(req.query.origin);
    const callbackUrl = resolveGitHubCallbackUrl(origin);
    const callbackOrigin = extractOriginSafe(callbackUrl, origin);
    const clientNonce = sanitizeClientNonce(req.query.nonce);

    const rawChallenge = req.query.code_challenge;
    const rawMethod =
      typeof req.query.code_challenge_method === 'string'
        ? req.query.code_challenge_method.trim().toUpperCase()
        : '';
    const codeChallenge = sanitizePkceChallenge(rawChallenge);

    if (rawChallenge !== undefined && (!codeChallenge || (rawMethod && rawMethod !== 'S256'))) {
      res.status(400).json({
        ok: false,
        configured: isValidGitHubClientId(clientId),
        callbackUrl,
        callbackOrigin,
        error: 'Invalid PKCE code_challenge or unsupported code_challenge_method (S256 required).',
      });
      return;
    }

    if (!clientId) {
      res.status(400).json({
        ok: false,
        configured: false,
        callbackUrl,
        callbackOrigin,
        error:
          'GITHUB_CLIENT_ID is not configured on the server yet. Set it in Secrets (GITHUB_CLIENT_SECRET is optional with PKCE) or connect with a Personal Access Token below.',
      });
      return;
    }

    if (!isValidGitHubClientId(clientId) || (clientSecret && !isValidGitHubClientSecret(clientSecret))) {
      res.status(400).json({
        ok: false,
        configured: false,
        callbackUrl,
        callbackOrigin,
        error:
          'Your GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET appears to be a test/placeholder value (GitHub returns 404 Not Found for invalid Client IDs). Create an OAuth/GitHub App at https://github.com/settings/developers, paste the real Client ID in Secrets, or connect with a Personal Access Token below.',
      });
      return;
    }

    if (!codeChallenge && !clientSecret) {
      res.status(400).json({
        ok: false,
        configured: false,
        callbackUrl,
        callbackOrigin,
        error: 'PKCE code_challenge is required when GITHUB_CLIENT_SECRET is omitted.',
      });
      return;
    }

    const issued = oauthStateStore.issue({
      redirectUri: callbackUrl,
      clientOrigin: origin,
      clientNonce,
      ...(codeChallenge ? { codeChallenge, codeChallengeMethod: 'S256' as const } : {}),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: 'repo read:user',
      state: issued.state,
    });
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }

    res.json({
      ok: true,
      configured: true,
      pkceRequired: Boolean(codeChallenge),
      callbackUrl,
      callbackOrigin,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  const handleGitHubOAuthCallback = async (req: express.Request, res: express.Response) => {
    pruneExpiredAuthStores();

    const cspNonce = crypto.randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${cspNonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    const sendCallbackPage = (
      statusCode: number,
      payload: Record<string, unknown>,
      messageText: string,
      targetOrigin: string | null
    ) => {
      res
        .status(statusCode)
        .type('html')
        .send(
          renderOAuthCallbackHtml({
            payload,
            messageText,
            targetOrigin,
            cspNonce,
          })
        );
    };

    // Always verify & consume CSRF state first before trusting any error or code query param
    const stateCheck = oauthStateStore.consumeAndVerify(req.query.state);
    if (!stateCheck.ok) {
      sendCallbackPage(
        400,
        { type: 'GITHUB_OAUTH_ERROR', error: stateCheck.error },
        stateCheck.error,
        null
      );
      return;
    }

    const stateEntry = stateCheck.entry;
    const responseNonce = stateEntry.clientNonce;

    const oauthError = typeof req.query.error === 'string' ? req.query.error.slice(0, 120) : '';
    const oauthErrorDesc =
      typeof req.query.error_description === 'string'
        ? req.query.error_description.slice(0, 240)
        : '';
    if (oauthError) {
      const msg = oauthErrorDesc || `GitHub authorization canceled (${oauthError}).`;
      sendCallbackPage(
        400,
        {
          type: 'GITHUB_OAUTH_ERROR',
          error: msg,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        msg,
        stateEntry.clientOrigin
      );
      return;
    }

    const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!code || code.length > 256) {
      const msg = 'Missing or invalid authorization code from GitHub.';
      sendCallbackPage(
        400,
        {
          type: 'GITHUB_OAUTH_ERROR',
          error: msg,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        msg,
        stateEntry.clientOrigin
      );
      return;
    }

    if (stateEntry.codeChallenge) {
      const pendingPkce = pkceExchangeStore.issue({
        code,
        redirectUri: stateEntry.redirectUri,
        codeChallenge: stateEntry.codeChallenge,
        clientNonce: responseNonce,
      });
      sendCallbackPage(
        200,
        {
          type: 'GITHUB_OAUTH_CODE',
          code,
          exchangeToken: pendingPkce.exchangeToken,
          redirectUri: stateEntry.redirectUri,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        'GitHub authorization received. Completing connection...',
        stateEntry.clientOrigin
      );
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    if (!clientId || !clientSecret) {
      const msg = 'GitHub OAuth credentials are not configured on the server.';
      sendCallbackPage(
        500,
        {
          type: 'GITHUB_OAUTH_ERROR',
          error: msg,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        msg,
        stateEntry.clientOrigin
      );
      return;
    }

    try {
      const tokenRes = await exchangeGitHubOAuthCode({
        code,
        redirectUri: stateEntry.redirectUri,
        clientId,
        clientSecret,
      });

      if (!tokenRes.ok) {
        sendCallbackPage(
          400,
          {
            type: 'GITHUB_OAUTH_ERROR',
            error: tokenRes.error,
            ...(responseNonce ? { nonce: responseNonce } : {}),
          },
          tokenRes.error,
          stateEntry.clientOrigin
        );
        return;
      }

      const userRes = await fetchGitHubAuthenticatedUser(tokenRes.accessToken);
      if (!userRes.ok) {
        sendCallbackPage(
          400,
          {
            type: 'GITHUB_OAUTH_ERROR',
            error: userRes.error,
            ...(responseNonce ? { nonce: responseNonce } : {}),
          },
          userRes.error,
          stateEntry.clientOrigin
        );
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      githubSessions.set(sessionToken, {
        accessToken: tokenRes.accessToken,
        user: userRes.user,
        expiresAt: Date.now() + GITHUB_SESSION_TTL_MS,
      });

      sendCallbackPage(
        200,
        {
          type: 'GITHUB_OAUTH_SUCCESS',
          sessionToken,
          user: userRes.user,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        `Connected as @${userRes.user.login}. You can close this window.`,
        stateEntry.clientOrigin
      );
    } catch (err) {
      console.error('GitHub OAuth callback error:', err);
      const msg = 'Unexpected error completing GitHub authorization.';
      sendCallbackPage(
        500,
        {
          type: 'GITHUB_OAUTH_ERROR',
          error: msg,
          ...(responseNonce ? { nonce: responseNonce } : {}),
        },
        msg,
        stateEntry.clientOrigin
      );
    }
  };

  app.get(['/auth/github/callback', '/auth/github/callback/'], handleGitHubOAuthCallback);

  app.post('/api/auth/github/exchange', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    pruneExpiredAuthStores();

    const validated = validateGithubOAuthExchangePayload(req.body);
    if (!validated.ok) {
      res.status(400).json({ ok: false, error: validated.error });
      return;
    }

    const clientId = process.env.GITHUB_CLIENT_ID?.trim() || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || '';
    if (!isValidGitHubClientId(clientId) || (clientSecret && !isValidGitHubClientSecret(clientSecret))) {
      res.status(400).json({
        ok: false,
        error: 'GitHub OAuth application credentials are missing or invalid on the server.',
      });
      return;
    }

    const { code, codeVerifier, exchangeToken, state, redirectUri } = validated.data;
    let storedCodeChallenge: string | undefined;
    let effectiveRedirectUri = redirectUri;

    if (exchangeToken) {
      const check = pkceExchangeStore.consumeAndVerify(exchangeToken);
      if (!check.ok) {
        res.status(400).json({ ok: false, error: check.error });
        return;
      }
      if (check.entry.code !== code) {
        res.status(400).json({ ok: false, error: 'Authorization code mismatch.' });
        return;
      }
      storedCodeChallenge = check.entry.codeChallenge;
      effectiveRedirectUri = check.entry.redirectUri;
    } else if (state) {
      const check = oauthStateStore.consumeAndVerify(state);
      if (!check.ok) {
        res.status(400).json({ ok: false, error: check.error });
        return;
      }
      if (!check.entry.codeChallenge) {
        res.status(400).json({
          ok: false,
          error: 'OAuth session was not initiated with PKCE.',
        });
        return;
      }
      storedCodeChallenge = check.entry.codeChallenge;
      effectiveRedirectUri = check.entry.redirectUri;
    }

    if (!storedCodeChallenge || !verifyPkceS256(codeVerifier, storedCodeChallenge)) {
      res.status(400).json({
        ok: false,
        error: 'PKCE verification failed. Please retry connecting to GitHub.',
      });
      return;
    }

    if (!effectiveRedirectUri) {
      res.status(400).json({ ok: false, error: 'Missing OAuth redirect URI.' });
      return;
    }

    try {
      const tokenRes = await exchangeGitHubOAuthCode({
        code,
        redirectUri: effectiveRedirectUri,
        clientId,
        ...(clientSecret ? { clientSecret } : {}),
        codeVerifier,
      });

      if (!tokenRes.ok) {
        res.status(400).json({ ok: false, error: tokenRes.error });
        return;
      }

      const userRes = await fetchGitHubAuthenticatedUser(tokenRes.accessToken);
      if (!userRes.ok) {
        res.status(400).json({ ok: false, error: userRes.error });
        return;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      githubSessions.set(sessionToken, {
        accessToken: tokenRes.accessToken,
        user: userRes.user,
        expiresAt: Date.now() + GITHUB_SESSION_TTL_MS,
      });

      res.json({
        ok: true,
        sessionToken,
        user: userRes.user,
      });
    } catch (err) {
      console.error('GitHub PKCE exchange error:', err);
      res.status(500).json({
        ok: false,
        error: 'Unexpected error exchanging GitHub authorization code.',
      });
    }
  });

  app.post('/api/auth/github/logout', (req, res) => {
    const sessionToken = getBearerSessionToken(req);
    if (sessionToken) {
      githubSessions.delete(sessionToken);
    }
    res.json({ ok: true });
  });

  app.get('/api/github/repos', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const { token, sessionExpired } = resolveGitHubAuth(req);
      if (!token) {
        res.status(401).json({
          ok: false,
          requiresAuth: true,
          sessionExpired,
          error: sessionExpired
            ? 'Your GitHub session expired (for example after a server restart). Reconnect GitHub or enter a Personal Access Token.'
            : 'Connect your GitHub account to browse your repositories.',
        });
        return;
      }
      const query = sanitizeSearchQuery(req.query.q);
      const result = await listAuthenticatedGitHubRepos(token, query);
      res.status(result.ok ? 200 : result.requiresAuth ? 401 : 400).json(result);
    } catch (err) {
      console.error('GitHub repos route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to fetch GitHub repositories right now.' });
    }
  });

  app.get('/api/github/users/:username/repos', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    if (!isValidGitHubUsername(req.params.username)) {
      res.status(400).json({ ok: false, error: 'Invalid GitHub username.' });
      return;
    }
    try {
      const token = resolveEffectiveGitHubToken(req);
      const query = sanitizeSearchQuery(req.query.q);
      const result = await listPublicGitHubReposByUsername(req.params.username, query, token);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('GitHub public user repos route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to fetch public GitHub repositories right now.' });
    }
  });

  app.get('/api/github/repos/:owner/:repo/branches', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const token = resolveEffectiveGitHubToken(req);
      const result = await listGitHubRepoBranches(req.params.owner, req.params.repo, token);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('GitHub branches route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to fetch repository branches.' });
    }
  });

  app.post('/api/github/pull', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const validated = validateGithubPullPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ ok: false, error: validated.error });
        return;
      }
      const effectiveToken = resolveEffectiveGitHubToken(req, validated.data.token);
      const result = await pullFromGitHubRepo({
        ...validated.data,
        token: effectiveToken,
      });
      res.status(result.ok ? 200 : result.requiresAuth ? 401 : 400).json(result);
    } catch (err) {
      console.error('GitHub pull route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to pull from GitHub right now.' });
    }
  });

  app.post('/api/github/push', async (req, res) => {
    if (!enforceRateLimit(githubRateLimiter, req, res)) return;
    try {
      const validated = validateGithubPushPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ ok: false, error: validated.error });
        return;
      }
      const { token: effectiveToken, sessionExpired } = resolveGitHubAuth(
        req,
        validated.data.token
      );
      // Every write requires an authenticated caller; the server never writes
      // with its own GITHUB_TOKEN fallback on behalf of anonymous requests.
      if (!effectiveToken) {
        res.status(401).json({
          ok: false,
          requiresAuth: true,
          sessionExpired,
          error: sessionExpired
            ? 'Your GitHub session expired (for example after a server restart). Reconnect GitHub or paste a Personal Access Token to push commits.'
            : 'Connect your GitHub account or paste a Personal Access Token with repo write access to push commits.',
        });
        return;
      }
      const result = await pushToGitHubRepo({
        ...validated.data,
        token: effectiveToken,
      });
      res.status(result.ok ? 200 : result.requiresAuth ? 401 : 400).json(result);
    } catch (err) {
      console.error('GitHub push route error:', err);
      res.status(500).json({ ok: false, error: 'Unable to push commit to GitHub right now.' });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Framecraft server listening on http://0.0.0.0:${port}`);
  });
}

startServer();

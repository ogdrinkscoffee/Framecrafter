import crypto from 'node:crypto';

export interface PendingOAuthState {
  state: string;
  redirectUri: string;
  clientOrigin: string;
  clientNonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
  createdAt: number;
  expiresAt: number;
}

export interface PendingPkceExchange {
  exchangeToken: string;
  code: string;
  redirectUri: string;
  codeChallenge: string;
  clientNonce?: string;
  createdAt: number;
  expiresAt: number;
}

const MAX_PENDING_OAUTH_STATES = 500;
const OAUTH_STATE_HEX_RE = /^[a-f0-9]{64}$/i;
const CLIENT_NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;
const PKCE_CHALLENGE_RE = /^[A-Za-z0-9_-]{43,128}$/;
const PKCE_VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const GITHUB_CLIENT_ID_RE = /^[A-Za-z0-9._-]{16,80}$/;
const REPEATED_CHAR_RE = /^([A-Za-z0-9._-])\1+$/;
const PLACEHOLDER_CREDENTIAL_RE =
  /^(?:12345678|01234567|test[_-]?|demo[_-]?|fake[_-]?|dummy[_-]?|sample[_-]?|example[_-]?|changeme|placeholder|your[_-]|replace[_-])/i;

export function isValidGitHubClientId(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!GITHUB_CLIENT_ID_RE.test(trimmed)) return false;
  if (REPEATED_CHAR_RE.test(trimmed)) return false;
  if (PLACEHOLDER_CREDENTIAL_RE.test(trimmed)) return false;
  return true;
}

export function isValidGitHubClientSecret(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 16 || /\s/.test(trimmed)) return false;
  if (REPEATED_CHAR_RE.test(trimmed)) return false;
  if (PLACEHOLDER_CREDENTIAL_RE.test(trimmed)) return false;
  return true;
}

export function sanitizeClientNonce(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return CLIENT_NONCE_RE.test(trimmed) ? trimmed : undefined;
}

export function sanitizePkceChallenge(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return PKCE_CHALLENGE_RE.test(trimmed) ? trimmed : undefined;
}

export function verifyPkceS256(codeVerifier: unknown, expectedChallenge: string): boolean {
  if (typeof codeVerifier !== 'string' || !expectedChallenge) return false;
  const trimmed = codeVerifier.trim();
  if (!PKCE_VERIFIER_RE.test(trimmed)) return false;
  const computed = crypto.createHash('sha256').update(trimmed).digest('base64url');
  const computedBuf = Buffer.from(computed, 'utf8');
  const expectedBuf = Buffer.from(expectedChallenge, 'utf8');
  if (computedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(computedBuf, expectedBuf);
}

export function sanitizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeJsonForScript(jsonText: string): string {
  return jsonText
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\//g, '\\/')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function normalizeOriginCandidate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    const envAppUrl = process.env.APP_URL?.trim();
    if (envAppUrl) {
      try {
        if (parsed.origin === new URL(envAppUrl).origin) return parsed.origin;
      } catch {
        // Ignore malformed APP_URL
      }
    }
    if (parsed.protocol === 'https:' && host.endsWith('.run.app')) {
      return parsed.origin;
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return parsed.origin;
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveAppOrigin(requestedOrigin?: unknown): string {
  const validatedClient = normalizeOriginCandidate(requestedOrigin);
  if (validatedClient) return validatedClient;
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl) {
    try {
      return new URL(envAppUrl).origin;
    } catch {
      // Fallback below
    }
  }
  return 'http://localhost:3000';
}

export class OAuthStateStore {
  private readonly states = new Map<string, PendingOAuthState>();
  private readonly ttlMs: number;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.states.entries()) {
      if (entry.expiresAt <= now) {
        this.states.delete(key);
      }
    }
    while (this.states.size > MAX_PENDING_OAUTH_STATES) {
      const oldestKey = this.states.keys().next().value;
      if (!oldestKey) break;
      this.states.delete(oldestKey);
    }
  }

  issue(params: {
    redirectUri: string;
    clientOrigin: string;
    clientNonce?: string;
    codeChallenge?: string;
    codeChallengeMethod?: 'S256';
    now?: number;
  }): PendingOAuthState {
    const now = params.now ?? Date.now();
    this.prune(now);

    const state = crypto.randomBytes(32).toString('hex');
    const entry: PendingOAuthState = {
      state,
      redirectUri: params.redirectUri,
      clientOrigin: params.clientOrigin,
      ...(params.clientNonce ? { clientNonce: params.clientNonce } : {}),
      ...(params.codeChallenge
        ? {
            codeChallenge: params.codeChallenge,
            codeChallengeMethod: params.codeChallengeMethod || 'S256',
          }
        : {}),
      createdAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.states.set(state, entry);
    this.prune(now);
    return entry;
  }

  consumeAndVerify(
    rawState: unknown,
    now = Date.now()
  ): { ok: true; entry: PendingOAuthState } | { ok: false; error: string } {
    this.prune(now);

    if (typeof rawState !== 'string') {
      return { ok: false, error: 'Missing GitHub OAuth state parameter.' };
    }
    const normalized = rawState.trim().toLowerCase();
    if (!OAUTH_STATE_HEX_RE.test(normalized)) {
      return { ok: false, error: 'Malformed GitHub OAuth state parameter.' };
    }

    const candidateBuf = Buffer.from(normalized, 'hex');
    let matchedKey: string | null = null;
    for (const key of this.states.keys()) {
      const storedBuf = Buffer.from(key, 'hex');
      if (storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf)) {
        matchedKey = key;
      }
    }

    if (!matchedKey) {
      return { ok: false, error: 'Invalid or already-used GitHub OAuth state.' };
    }

    const entry = this.states.get(matchedKey)!;
    this.states.delete(matchedKey);

    if (entry.expiresAt <= now) {
      return { ok: false, error: 'Expired GitHub OAuth state. Please try connecting again.' };
    }

    return { ok: true, entry };
  }

  size(): number {
    return this.states.size;
  }
}

export class PendingPkceExchangeStore {
  private readonly items = new Map<string, PendingPkceExchange>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  prune(now = Date.now()): void {
    for (const [key, entry] of this.items.entries()) {
      if (entry.expiresAt <= now) {
        this.items.delete(key);
      }
    }
    while (this.items.size > MAX_PENDING_OAUTH_STATES) {
      const oldestKey = this.items.keys().next().value;
      if (!oldestKey) break;
      this.items.delete(oldestKey);
    }
  }

  issue(params: {
    code: string;
    redirectUri: string;
    codeChallenge: string;
    clientNonce?: string;
    now?: number;
  }): PendingPkceExchange {
    const now = params.now ?? Date.now();
    this.prune(now);
    const exchangeToken = crypto.randomBytes(32).toString('hex');
    const entry: PendingPkceExchange = {
      exchangeToken,
      code: params.code,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      ...(params.clientNonce ? { clientNonce: params.clientNonce } : {}),
      createdAt: now,
      expiresAt: now + this.ttlMs,
    };
    this.items.set(exchangeToken, entry);
    this.prune(now);
    return entry;
  }

  consumeAndVerify(
    rawToken: unknown,
    now = Date.now()
  ): { ok: true; entry: PendingPkceExchange } | { ok: false; error: string } {
    this.prune(now);
    if (typeof rawToken !== 'string') {
      return { ok: false, error: 'Missing GitHub PKCE exchange token.' };
    }
    const normalized = rawToken.trim().toLowerCase();
    if (!OAUTH_STATE_HEX_RE.test(normalized)) {
      return { ok: false, error: 'Malformed GitHub PKCE exchange token.' };
    }
    const candidateBuf = Buffer.from(normalized, 'hex');
    let matchedKey: string | null = null;
    for (const key of this.items.keys()) {
      const storedBuf = Buffer.from(key, 'hex');
      if (storedBuf.length === candidateBuf.length && crypto.timingSafeEqual(storedBuf, candidateBuf)) {
        matchedKey = key;
      }
    }
    if (!matchedKey) {
      return { ok: false, error: 'Invalid or already-used GitHub PKCE exchange token.' };
    }
    const entry = this.items.get(matchedKey)!;
    this.items.delete(matchedKey);
    if (entry.expiresAt <= now) {
      return { ok: false, error: 'Expired GitHub PKCE exchange session. Please connect again.' };
    }
    return { ok: true, entry };
  }

  size(): number {
    return this.items.size;
  }
}

export function renderOAuthCallbackHtml(options: {
  payload: Record<string, unknown>;
  messageText: string;
  targetOrigin: string | null;
  cspNonce: string;
}): string {
  const safeJson = escapeJsonForScript(JSON.stringify(options.payload));
  const safeTargetOrigin = escapeJsonForScript(
    JSON.stringify(options.targetOrigin ? normalizeOriginCandidate(options.targetOrigin) : null)
  );
  const safeNonce = escapeHtmlText(options.cspNonce);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>GitHub Authorization</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #e4e4e7; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { max-width: 420px; background: #18181b; border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 20px 24px; text-align: center; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      p { font-size: 13px; color: #a1a1aa; margin: 0 0 16px; line-height: 1.5; }
      button { background: #4f46e5; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>GitHub Connection</h1>
      <p>${escapeHtmlText(options.messageText)}</p>
      <button id="oauth-close-btn" type="button">Close Window</button>
    </div>
    <script nonce="${safeNonce}">
      (function() {
        var payload = ${safeJson};
        var explicitOrigin = ${safeTargetOrigin};
        var postTarget = explicitOrigin || window.location.origin;
        var closeBtn = document.getElementById('oauth-close-btn');
        if (closeBtn) {
          closeBtn.addEventListener('click', function() { window.close(); });
        }
        if (window.opener && typeof window.opener.postMessage === 'function') {
          try {
            window.opener.postMessage(payload, postTarget);
          } catch (e) {}
          if (payload && (payload.type === 'GITHUB_OAUTH_SUCCESS' || payload.type === 'GITHUB_OAUTH_CODE')) {
            window.close();
          }
        } else if (payload && payload.type === 'GITHUB_OAUTH_SUCCESS') {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`;
}

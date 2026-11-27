import type { NextFunction, Request, Response } from 'express';

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/**
 * Content-Security-Policy for the studio shell.
 *
 * Notes on the deliberate concessions:
 * - `'unsafe-inline'` is required because the live preview is an iframe `srcdoc`
 *   document with an inline editor bridge, and because Vite injects inline
 *   bootstrap code. srcdoc frames inherit the parent document's CSP.
 * - `'wasm-unsafe-eval'` / `'unsafe-eval'` are required by esbuild-wasm, which
 *   compiles user projects in the browser.
 * - `https:` in connect-src/img-src/font-src is required because imported
 *   projects may reference arbitrary CDNs, fonts and images (esm.sh import maps).
 * Everything else stays locked down: no objects, no plugins, no framing by others.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const connectSources = ["'self'", 'blob:', 'data:', 'https:', 'wss:', TURNSTILE_ORIGIN];
  if (isDev) connectSources.push('ws:');

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'", TURNSTILE_ORIGIN],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': connectSources,
    'frame-src': ["'self'", 'data:', 'blob:', TURNSTILE_ORIGIN],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  };

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ');
}

function parseOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function isSecureRequest(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

/**
 * Applies baseline security headers to every response. HSTS is only sent over
 * HTTPS in production so local http:// development is not pinned.
 */
export function applySecurityHeaders(isDev: boolean) {
  const csp = buildContentSecurityPolicy(isDev);
  const isApiPath = (pathname: string) =>
    pathname.startsWith('/api/') || pathname.startsWith('/auth/');

  return (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // OAuth sign-in relies on the popup keeping `window.opener` for the postMessage handshake.
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    // Prevents this site from being embedded as an iframe inside another document.
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    if (!isDev && isSecureRequest(req)) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (isApiPath(req.path)) {
      res.setHeader('Cache-Control', 'no-store');
    }

    next();
  };
}

/**
 * Rejects browser-originated state-changing requests from other origins.
 * There is intentionally no CORS wildcard anywhere: browsers must not be able
 * to drive mutations on this server from another site. Non-browser clients
 * (curl, Electron main process, tests) send no Origin header and are allowed —
 * they still need a bearer token or PAT for write endpoints.
 */
export function enforceSameOriginForMutations(allowedOrigins: Array<string | null>) {
  const allowlist = new Set(allowedOrigins.filter((origin): origin is string => Boolean(origin)));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const originHeader = req.headers.origin;
    if (originHeader === undefined) {
      next();
      return;
    }

    const requestOrigin = parseOrigin(originHeader);
    const hostOrigin = (() => {
      const host = req.headers.host;
      if (!host) return null;
      const proto = isSecureRequest(req) ? 'https' : 'http';
      return parseOrigin(`${proto}://${host}`);
    })();

    const trusted =
      (requestOrigin && hostOrigin && requestOrigin === hostOrigin) ||
      (requestOrigin !== null && allowlist.has(requestOrigin));

    if (!trusted) {
      res.status(403).json({ ok: false, error: 'Cross-origin request rejected.' });
      return;
    }

    next();
  };
}

/** Extracts the trusted origins used for the OAuth callback / app URL allowlist. */
export function resolveTrustedOrigins(...rawValues: Array<string | undefined>): string[] {
  const origins = rawValues.map((value) => parseOrigin(value));
  return origins.filter((origin): origin is string => Boolean(origin));
}

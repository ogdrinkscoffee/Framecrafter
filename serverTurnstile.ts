const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 8000;
const MAX_CAPTCHA_TOKEN_LEN = 2048;

export interface TurnstileConfig {
  siteKey: string;
  secretKey: string;
  enabled: boolean;
}

/**
 * Turnstile is enabled only when both halves are configured. The site key is
 * public (served by /api/security/status); the secret key never leaves the server.
 */
export function getTurnstileConfig(): TurnstileConfig {
  const siteKey = (process.env.TURNSTILE_SITE_KEY ?? '').trim();
  const secretKey = (process.env.TURNSTILE_SECRET_KEY ?? '').trim();
  return { siteKey, secretKey, enabled: Boolean(siteKey && secretKey) };
}

export type TurnstileFailureReason =
  | 'missing_token'
  | 'invalid_token'
  | 'verification_unavailable';

export type TurnstileVerifyResult =
  | { ok: true; skipped: boolean }
  | { ok: false; reason: TurnstileFailureReason };

interface SiteVerifyResponse {
  success?: boolean;
  'error-codes'?: string[];
}

/**
 * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
 * Fails closed when the challenge service cannot be reached so a broken
 * upstream can never be used to bypass bot protection.
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  const config = getTurnstileConfig();
  if (!config.enabled) {
    return { ok: true, skipped: true };
  }

  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken || cleanToken.length > MAX_CAPTCHA_TOKEN_LEN) {
    return { ok: false, reason: 'missing_token' };
  }

  const body = new URLSearchParams();
  body.set('secret', config.secretKey);
  body.set('response', cleanToken);
  if (remoteIp) body.set('remoteip', remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: 'verification_unavailable' };
    }

    const payload = (await response.json()) as SiteVerifyResponse;
    if (payload.success === true) {
      return { ok: true, skipped: false };
    }
    return { ok: false, reason: 'invalid_token' };
  } catch {
    return { ok: false, reason: 'verification_unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Maps a verification failure to the HTTP status the API should return. */
export function turnstileFailureStatus(reason: TurnstileFailureReason): 403 | 503 {
  return reason === 'verification_unavailable' ? 503 : 403;
}

/** Client-safe message for a failed verification (no internal detail). */
export function turnstileFailureMessage(reason: TurnstileFailureReason): string {
  if (reason === 'verification_unavailable') {
    return 'Human verification is temporarily unavailable. Please try again in a moment.';
  }
  return 'Human verification failed. Complete the challenge and retry.';
}

import type { BundleInputFile } from '../../serverBundler';
import type { ProjectFile } from '../types/editor';

const MAX_FILES_PER_REQUEST = 600;
const MAX_PATH_LEN = 512;
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REPO_URL_LEN = 512;
const MAX_BRANCH_LEN = 128;
const MAX_COMMIT_MSG_LEN = 500;
const MAX_TOKEN_LEN = 512;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafePathString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_PATH_LEN &&
    !value.includes('\0')
  );
}

function validateBranchString(value: unknown): ValidationResult<string | undefined> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, data: undefined };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: 'Branch must be a string.' };
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_BRANCH_LEN) {
    return { ok: false, error: 'Branch name exceeds maximum length.' };
  }
  if (trimmed.includes('..') || /[\0\r\n\t ~^:?*\[\\]/.test(trimmed)) {
    return { ok: false, error: 'Branch name contains invalid characters.' };
  }
  return { ok: true, data: trimmed || undefined };
}

export function validateBundleProjectPayload(
  raw: unknown
): ValidationResult<{ files: BundleInputFile[]; entryPath: string }> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }
  if (!isSafePathString(raw.entryPath)) {
    return { ok: false, error: 'Invalid bundle request: entryPath is required.' };
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    return { ok: false, error: 'Invalid bundle request: files array is required.' };
  }
  if (raw.files.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `Too many files in bundle request (max ${MAX_FILES_PER_REQUEST}).` };
  }

  const normalizedFiles: BundleInputFile[] = [];
  for (const item of raw.files) {
    if (!isPlainObject(item) || !isSafePathString(item.path) || typeof item.content !== 'string') {
      return { ok: false, error: 'Each bundled file must include valid string path and content.' };
    }
    if (item.content.length > MAX_SINGLE_FILE_BYTES) {
      return { ok: false, error: `File "${item.path}" exceeds maximum allowed size.` };
    }
    normalizedFiles.push({
      path: item.path,
      content: item.content,
      type: typeof item.type === 'string' ? (item.type as BundleInputFile['type']) : undefined,
    });
  }

  return {
    ok: true,
    data: {
      files: normalizedFiles,
      entryPath: raw.entryPath.trim(),
    },
  };
}

export function validateGithubPullPayload(
  raw: unknown
): ValidationResult<{ repoUrl: string; branch?: string; token?: string }> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }
  if (
    typeof raw.repoUrl !== 'string' ||
    !raw.repoUrl.trim() ||
    raw.repoUrl.length > MAX_REPO_URL_LEN
  ) {
    return { ok: false, error: 'A valid repository URL is required.' };
  }
  const branchCheck = validateBranchString(raw.branch);
  if (!branchCheck.ok) {
    return branchCheck;
  }
  if (raw.token !== undefined && (typeof raw.token !== 'string' || raw.token.length > MAX_TOKEN_LEN)) {
    return { ok: false, error: 'Invalid GitHub token format.' };
  }

  return {
    ok: true,
    data: {
      repoUrl: raw.repoUrl.trim(),
      branch: branchCheck.data,
      token: typeof raw.token === 'string' && raw.token.trim() ? raw.token.trim() : undefined,
    },
  };
}

const ALLOWED_FILE_TYPES = new Set(['html', 'css', 'js', 'json', 'other']);

export function validateGithubPushPayload(raw: unknown): ValidationResult<{
  repoUrl: string;
  branch?: string;
  commitMessage?: string;
  token?: string;
  files: ProjectFile[];
}> {
  const baseCheck = validateGithubPullPayload(raw);
  if (!baseCheck.ok) {
    return baseCheck;
  }

  const record = raw as Record<string, unknown>;
  if (
    record.commitMessage !== undefined &&
    (typeof record.commitMessage !== 'string' || record.commitMessage.length > MAX_COMMIT_MSG_LEN)
  ) {
    return { ok: false, error: 'Commit message must be under 500 characters.' };
  }
  if (!Array.isArray(record.files) || record.files.length === 0) {
    return { ok: false, error: 'Project files array is required.' };
  }
  if (record.files.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `Too many files in push request (max ${MAX_FILES_PER_REQUEST}).` };
  }

  const validatedFiles: ProjectFile[] = [];
  for (const item of record.files) {
    if (
      !isPlainObject(item) ||
      !isSafePathString(item.path) ||
      typeof item.content !== 'string'
    ) {
      return { ok: false, error: 'Every pushed file must have a valid path and content.' };
    }
    if (item.content.length > MAX_SINGLE_FILE_BYTES) {
      return { ok: false, error: `File "${item.path}" exceeds maximum allowed push size.` };
    }
    const safeName =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, MAX_PATH_LEN)
        : item.path.split('/').pop() || item.path;
    const safeType =
      typeof item.type === 'string' && ALLOWED_FILE_TYPES.has(item.type)
        ? (item.type as ProjectFile['type'])
        : 'other';

    validatedFiles.push({
      path: item.path,
      name: safeName,
      content: item.content,
      type: safeType,
    });
  }

  return {
    ok: true,
    data: {
      ...baseCheck.data,
      commitMessage:
        typeof record.commitMessage === 'string' ? record.commitMessage.trim() : undefined,
      files: validatedFiles,
    },
  };
}

export function createSlidingWindowRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
}) {
  const hitsByKey = new Map<string, number[]>();

  return {
    check(key: string, now = Date.now()): { allowed: boolean; retryAfterSec: number } {
      const cutoff = now - options.windowMs;
      const existing = hitsByKey.get(key) ?? [];
      const active = existing.filter((ts) => ts > cutoff);

      if (active.length >= options.maxRequests) {
        const oldestActive = active[0] ?? now;
        const retryAfterMs = Math.max(1000, options.windowMs - (now - oldestActive));
        hitsByKey.set(key, active);
        return {
          allowed: false,
          retryAfterSec: Math.ceil(retryAfterMs / 1000),
        };
      }

      active.push(now);
      hitsByKey.set(key, active);

      if (hitsByKey.size > 500) {
        for (const [k, timestamps] of hitsByKey.entries()) {
          if (timestamps.every((ts) => ts <= cutoff)) {
            hitsByKey.delete(k);
          }
        }
      }

      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

export function validateGithubOAuthExchangePayload(raw: unknown): ValidationResult<{
  code: string;
  codeVerifier: string;
  exchangeToken?: string;
  state?: string;
  redirectUri?: string;
}> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }
  const code = typeof raw.code === 'string' ? raw.code.trim() : '';
  if (!code || code.length > 256) {
    return { ok: false, error: 'Missing or invalid GitHub authorization code.' };
  }
  const codeVerifier = typeof raw.codeVerifier === 'string' ? raw.codeVerifier.trim() : '';
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) {
    return { ok: false, error: 'Invalid PKCE code_verifier format.' };
  }
  const exchangeToken =
    typeof raw.exchangeToken === 'string' && raw.exchangeToken.trim()
      ? raw.exchangeToken.trim()
      : undefined;
  const state =
    typeof raw.state === 'string' && raw.state.trim() ? raw.state.trim() : undefined;

  if (!exchangeToken && !state) {
    return {
      ok: false,
      error: 'Missing OAuth verification token (exchangeToken or state) for PKCE exchange.',
    };
  }

  let redirectUri: string | undefined;
  if (raw.redirectUri !== undefined && raw.redirectUri !== null && raw.redirectUri !== '') {
    if (typeof raw.redirectUri !== 'string' || raw.redirectUri.length > MAX_REPO_URL_LEN) {
      return { ok: false, error: 'Invalid redirectUri parameter.' };
    }
    try {
      const parsed = new URL(raw.redirectUri.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { ok: false, error: 'Invalid redirectUri protocol.' };
      }
      redirectUri = parsed.toString();
    } catch {
      return { ok: false, error: 'Malformed redirectUri URL.' };
    }
  }

  return {
    ok: true,
    data: {
      code,
      codeVerifier,
      exchangeToken,
      state,
      redirectUri,
    },
  };
}

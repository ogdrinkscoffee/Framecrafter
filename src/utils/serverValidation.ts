import type { BundleInputFile } from '../../serverBundler';
import type { ProjectFile } from '../types/editor';
// Explicit extension: `npm start` runs `node server.ts` with Node's native ESM
// resolver, which does not infer `.ts` the way tsx/Vite do.
import { parseGitHubRepoUrl } from './githubSync.ts';

const MAX_FILES_PER_REQUEST = 600;
const MAX_PATH_LEN = 512;
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024;
const MAX_REPO_URL_LEN = 512;
const MAX_BRANCH_LEN = 128;
const MAX_COMMIT_MSG_LEN = 500;
const MAX_TOKEN_LEN = 512;
const MAX_TOTAL_PAYLOAD_BYTES = 40 * 1024 * 1024;
const MAX_OAUTH_VALUE_LEN = 256;

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const CONTROL_CHAR_RE = /[\u0000-\u001f\u007f]/;

function isSafePathString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= MAX_PATH_LEN &&
    !CONTROL_CHAR_RE.test(value)
  );
}

function isAbsoluteRepoPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/');
  return (
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    /^[A-Za-z]:\//.test(normalized)
  );
}

function hasTraversalSegments(value: string): boolean {
  return value
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => segment === '..' || segment === '.');
}

/** Repository-relative path that cannot escape the repo or collide with git metadata. */
function isSafeRepoRelativePath(value: unknown): value is string {
  if (!isSafePathString(value)) return false;
  const normalized = value.replace(/\\/g, '/');
  if (isAbsoluteRepoPath(normalized) || hasTraversalSegments(normalized)) return false;
  const firstSegment = normalized.split('/')[0].toLowerCase();
  return firstSegment !== '.git';
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
  if (!isSafePathString(raw.entryPath) || CONTROL_CHAR_RE.test(raw.entryPath)) {
    return { ok: false, error: 'Invalid bundle request: entryPath is required.' };
  }
  if (!Array.isArray(raw.files) || raw.files.length === 0) {
    return { ok: false, error: 'Invalid bundle request: files array is required.' };
  }
  if (raw.files.length > MAX_FILES_PER_REQUEST) {
    return { ok: false, error: `Too many files in bundle request (max ${MAX_FILES_PER_REQUEST}).` };
  }

  const normalizedFiles: BundleInputFile[] = [];
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  for (const item of raw.files) {
    if (!isPlainObject(item) || !isSafePathString(item.path) || typeof item.content !== 'string') {
      return { ok: false, error: 'Each bundled file must include valid string path and content.' };
    }
    const path = item.path.trim();
    if (seenPaths.has(path)) {
      return { ok: false, error: `Duplicate file path in bundle request: "${path}".` };
    }
    seenPaths.add(path);
    if (item.content.length > MAX_SINGLE_FILE_BYTES) {
      return { ok: false, error: `File "${path}" exceeds maximum allowed size.` };
    }
    totalBytes += item.content.length;
    if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
      return { ok: false, error: 'Bundle request exceeds the maximum total payload size.' };
    }
    normalizedFiles.push({
      path,
      content: item.content,
      type: typeof item.type === 'string' ? (item.type as BundleInputFile['type']) : undefined,
    });
  }

  const entryPath = raw.entryPath.trim();
  const normalizeForMatch = (value: string) =>
    value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  const entryForMatch = normalizeForMatch(entryPath);
  if (!normalizedFiles.some((file) => normalizeForMatch(file.path) === entryForMatch)) {
    return { ok: false, error: 'Invalid bundle request: entryPath must reference one of the provided files.' };
  }

  return {
    ok: true,
    data: {
      files: normalizedFiles,
      entryPath,
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
  const repoUrl = raw.repoUrl.trim();
  if (!parseGitHubRepoUrl(repoUrl).ok) {
    return { ok: false, error: 'A valid GitHub repository URL or owner/repo is required.' };
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
      repoUrl,
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
  const seenPaths = new Set<string>();
  let totalBytes = 0;
  for (const item of record.files) {
    if (
      !isPlainObject(item) ||
      !isSafeRepoRelativePath(item.path) ||
      typeof item.content !== 'string'
    ) {
      return {
        ok: false,
        error:
          'Every pushed file must have a repository-relative path (no absolute paths, ".." segments, or .git entries) and string content.',
      };
    }
    const path = item.path.trim();
    if (seenPaths.has(path)) {
      return { ok: false, error: `Duplicate file path in push request: "${path}".` };
    }
    seenPaths.add(path);
    if (item.content.length > MAX_SINGLE_FILE_BYTES) {
      return { ok: false, error: `File "${path}" exceeds maximum allowed push size.` };
    }
    totalBytes += item.content.length;
    if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
      return { ok: false, error: 'Push request exceeds the maximum total payload size.' };
    }
    const safeName =
      typeof item.name === 'string' && item.name.trim()
        ? item.name.trim().slice(0, MAX_PATH_LEN)
        : path.split('/').pop() || path;
    const safeType =
      typeof item.type === 'string' && ALLOWED_FILE_TYPES.has(item.type)
        ? (item.type as ProjectFile['type'])
        : 'other';

    validatedFiles.push({
      path,
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
  const readOpaqueValue = (value: unknown): string | undefined | null => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length > MAX_OAUTH_VALUE_LEN || CONTROL_CHAR_RE.test(trimmed)) return null;
    return trimmed;
  };
  const exchangeToken = readOpaqueValue(raw.exchangeToken);
  if (exchangeToken === null) {
    return { ok: false, error: 'Invalid OAuth verification token.' };
  }
  const state = readOpaqueValue(raw.state);
  if (state === null) {
    return { ok: false, error: 'Invalid OAuth state value.' };
  }

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

const GITHUB_USERNAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/** GitHub usernames: alphanumeric with single hyphens, max 39 chars. */
export function isValidGitHubUsername(value: unknown): value is string {
  return typeof value === 'string' && GITHUB_USERNAME_RE.test(value.trim());
}

export type AiEditFileType = 'html' | 'tsx' | 'jsx' | 'css';

export interface AiEditElementPayload {
  prompt: string;
  targetCode: string;
  fileType: AiEditFileType;
  designTokens?: Record<string, string>;
  surroundingContext?: string;
  /** Cloudflare Turnstile token; required only when the server has Turnstile enabled. */
  captchaToken?: string;
}

const MAX_AI_MINUTES_PER_HOUR = 15;

const MAX_CAPTCHA_TOKEN_LEN = 2048;

/** Honeypot fields must stay empty; a filled value is treated as a bot submission. */
export function hasFilledHoneypot(raw: unknown): boolean {
  if (!isPlainObject(raw)) return false;
  const value = raw.honeypot ?? raw.website_url;
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

const ALLOWED_AI_FILE_TYPES = new Set<AiEditFileType>(['html', 'tsx', 'jsx', 'css']);
const MAX_AI_PROMPT_LEN = 1000;
const MAX_AI_TARGET_CODE_LEN = 15000;
const MAX_AI_CONTEXT_LEN = 4000;
const MAX_AI_DESIGN_TOKENS = 60;

export function validateAiEditElementPayload(
  raw: unknown
): ValidationResult<AiEditElementPayload> {
  if (!isPlainObject(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  if (hasFilledHoneypot(raw)) {
    // Generic message: never tell a bot which check failed.
    return { ok: false, error: 'Request rejected.' };
  }

  let captchaToken: string | undefined;
  if (raw.captchaToken !== undefined && raw.captchaToken !== null) {
    if (typeof raw.captchaToken !== 'string' || raw.captchaToken.length > MAX_CAPTCHA_TOKEN_LEN) {
      return { ok: false, error: 'Request rejected.' };
    }
    const trimmedToken = raw.captchaToken.trim();
    if (trimmedToken) captchaToken = trimmedToken;
  }

  if (typeof raw.prompt !== 'string') {
    return { ok: false, error: 'Prompt must be a string.' };
  }
  const prompt = raw.prompt.trim();
  if (!prompt) {
    return { ok: false, error: 'Prompt is required.' };
  }
  if (prompt.length > MAX_AI_PROMPT_LEN) {
    return {
      ok: false,
      error: `Prompt exceeds maximum length of ${MAX_AI_PROMPT_LEN} characters.`,
    };
  }

  if (typeof raw.targetCode !== 'string') {
    return { ok: false, error: 'targetCode must be a string.' };
  }
  const targetCode = raw.targetCode.trim();
  if (!targetCode) {
    return { ok: false, error: 'targetCode is required.' };
  }
  if (raw.targetCode.length > MAX_AI_TARGET_CODE_LEN) {
    return {
      ok: false,
      error: `targetCode exceeds maximum length of ${MAX_AI_TARGET_CODE_LEN} characters.`,
    };
  }

  if (
    typeof raw.fileType !== 'string' ||
    !ALLOWED_AI_FILE_TYPES.has(raw.fileType as AiEditFileType)
  ) {
    return {
      ok: false,
      error: 'fileType must be one of html, tsx, jsx, or css.',
    };
  }
  const fileType = raw.fileType as AiEditFileType;

  let designTokens: Record<string, string> | undefined;
  if (raw.designTokens !== undefined && raw.designTokens !== null) {
    if (!isPlainObject(raw.designTokens)) {
      return { ok: false, error: 'designTokens must be an object of CSS token values.' };
    }
    const entries = Object.entries(raw.designTokens);
    if (entries.length > MAX_AI_DESIGN_TOKENS) {
      return {
        ok: false,
        error: `Too many designTokens provided (max ${MAX_AI_DESIGN_TOKENS}).`,
      };
    }
    const cleanTokens: Record<string, string> = {};
    for (const [k, v] of entries) {
      if (typeof v !== 'string') {
        return { ok: false, error: 'Every designTokens entry must map to a string value.' };
      }
      const cleanKey = k.trim().replace(/[\r\n]/g, '').slice(0, 80);
      const cleanVal = v.trim().replace(/[\r\n]/g, ' ').slice(0, 200);
      if (cleanKey && cleanVal) {
        cleanTokens[cleanKey] = cleanVal;
      }
    }
    if (Object.keys(cleanTokens).length > 0) {
      designTokens = cleanTokens;
    }
  }

  let surroundingContext: string | undefined;
  if (raw.surroundingContext !== undefined && raw.surroundingContext !== null) {
    if (typeof raw.surroundingContext !== 'string') {
      return { ok: false, error: 'surroundingContext must be a string.' };
    }
    const trimmedContext = raw.surroundingContext.trim();
    if (trimmedContext) {
      surroundingContext =
        trimmedContext.length > MAX_AI_CONTEXT_LEN
          ? trimmedContext.slice(0, MAX_AI_CONTEXT_LEN)
          : trimmedContext;
    }
  }

  return {
    ok: true,
    data: {
      prompt,
      targetCode,
      fileType,
      ...(designTokens ? { designTokens } : {}),
      ...(surroundingContext ? { surroundingContext } : {}),
      ...(captchaToken ? { captchaToken } : {}),
    },
  };
}

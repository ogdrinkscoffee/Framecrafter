import type { ProjectFile } from '../types/editor';

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
  repoFullName: string;
  normalizedUrl: string;
}

export interface GitHubConnectionConfig {
  repoUrl: string;
  repoFullName: string;
  branch: string;
  autoSync: boolean;
  lastSyncedAt: number | null;
  lastCommitSha?: string;
  lastCommitUrl?: string;
}

export interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  htmlUrl: string;
}

export interface GitHubRepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  htmlUrl: string;
  updatedAt: string;
  language: string | null;
  canPush: boolean;
}

export interface GitHubAuthStatusResponse {
  configured: boolean;
  callbackUrl: string;
  connected: boolean;
  user?: GitHubUserProfile;
}

export interface GitHubReposResponse {
  ok: boolean;
  user?: GitHubUserProfile;
  repos?: GitHubRepoSummary[];
  requiresAuth?: boolean;
  sessionExpired?: boolean;
  error?: string;
}

export interface GitHubBranchesResponse {
  ok: boolean;
  branches?: string[];
  error?: string;
}

export interface GitHubPullResponse {
  ok: boolean;
  repoFullName?: string;
  branch?: string;
  latestCommitSha?: string;
  files?: Array<{ path: string; name: string; content: string }>;
  truncated?: boolean;
  requiresAuth?: boolean;
  sessionExpired?: boolean;
  error?: string;
}

export interface GitHubPushResponse {
  ok: boolean;
  repoFullName?: string;
  branch?: string;
  commitSha?: string;
  commitUrl?: string;
  filesPushed?: number;
  requiresAuth?: boolean;
  sessionExpired?: boolean;
  error?: string;
}

export const VALID_GITHUB_SLUG_RE = /^[A-Za-z0-9_.-]+$/;

const BINARY_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  eot: 'application/vnd.ms-fontobject',
  otf: 'font/otf',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  zip: 'application/zip',
  apk: 'application/vnd.android.package-archive',
  aab: 'application/octet-stream',
  jar: 'application/java-archive',
  keystore: 'application/octet-stream',
  jks: 'application/octet-stream',
};

export function inferBinaryMimeFromPath(filePath: string): string | null {
  const clean = filePath.split('?')[0].split('#')[0].toLowerCase();
  const ext = clean.includes('.') ? clean.split('.').pop() ?? '' : '';
  return BINARY_MIME_BY_EXT[ext] ?? null;
}

export function isBinaryGitHubPath(filePath: string): boolean {
  return inferBinaryMimeFromPath(filePath) !== null;
}

export function shouldIgnoreGitHubTreePath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!norm) return true;
  const parts = norm.split('/');
  const base = parts[parts.length - 1].toLowerCase();
  if (base === '.ds_store' || base === 'thumbs.db') return true;
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i].toLowerCase();
    if (seg === '.git' || seg === 'node_modules' || seg === '.next' || seg === 'dist') {
      return true;
    }
  }
  return false;
}

export function parseGitHubRepoUrl(
  rawInput: string
): { ok: true; data: ParsedGitHubRepo } | { ok: false; error: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a GitHub repository URL or owner/repo.' };
  }

  // Support SSH URLs: git@github.com:owner/repo(.git)
  const sshMatch = /^git@github\.com:([^/]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i.exec(trimmed);
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    if (!VALID_GITHUB_SLUG_RE.test(owner) || !VALID_GITHUB_SLUG_RE.test(repo) || owner === '..' || repo === '..') {
      return { ok: false, error: 'Invalid GitHub owner or repository name.' };
    }
    return {
      ok: true,
      data: {
        owner,
        repo,
        repoFullName: `${owner}/${repo}`,
        normalizedUrl: `https://github.com/${owner}/${repo}`,
      },
    };
  }

  // Support shorthand owner/repo
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(trimmed) && !trimmed.includes('://')) {
    const [owner, rawRepo] = trimmed.split('/');
    const repo = rawRepo.replace(/\.git$/i, '');
    if (!VALID_GITHUB_SLUG_RE.test(owner) || !VALID_GITHUB_SLUG_RE.test(repo) || owner === '..' || repo === '..') {
      return { ok: false, error: 'Invalid GitHub owner or repository name.' };
    }
    return {
      ok: true,
      data: {
        owner,
        repo,
        repoFullName: `${owner}/${repo}`,
        normalizedUrl: `https://github.com/${owner}/${repo}`,
      },
    };
  }

  // Reject bare javascript:, data:, file:, etc. or non-GitHub hosts
  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    if (candidate.toLowerCase().startsWith('github.com/')) {
      candidate = `https://${candidate}`;
    } else {
      return {
        ok: false,
        error: 'Enter a valid GitHub URL such as https://github.com/owner/repo.',
      };
    }
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: 'Could not parse GitHub repository URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'Only https://github.com repositories are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    return { ok: false, error: 'URL must point to github.com.' };
  }

  const segments = parsed.pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return {
      ok: false,
      error: 'GitHub URL must include both owner and repository name.',
    };
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');

  if (
    !VALID_GITHUB_SLUG_RE.test(owner) ||
    !VALID_GITHUB_SLUG_RE.test(repo) ||
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..'
  ) {
    return { ok: false, error: 'Invalid GitHub owner or repository name.' };
  }

  let branch: string | undefined;
  if (segments[2] === 'tree' && segments.length >= 4) {
    branch = segments.slice(3).join('/');
  }

  return {
    ok: true,
    data: {
      owner,
      repo,
      ...(branch ? { branch } : {}),
      repoFullName: `${owner}/${repo}`,
      normalizedUrl: `https://github.com/${owner}/${repo}`,
    },
  };
}

export function encodeProjectFileForGitHubBlob(file: ProjectFile): {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
} {
  const cleanPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
  const dataUrlMatch = /^data:[^;]+;base64,(.+)$/s.exec(file.content);
  if (dataUrlMatch && isBinaryGitHubPath(cleanPath)) {
    return {
      path: cleanPath,
      content: dataUrlMatch[1].replace(/\s+/g, ''),
      encoding: 'base64',
    };
  }
  return {
    path: cleanPath,
    content: file.content,
    encoding: 'utf-8',
  };
}

export function decodeGitHubBlobToProjectContent(filePath: string, base64Payload: string): string {
  const cleanBase64 = base64Payload.replace(/\s+/g, '');
  const binaryMime = inferBinaryMimeFromPath(filePath);
  if (binaryMime) {
    return `data:${binaryMime};base64,${cleanBase64}`;
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(cleanBase64, 'base64').toString('utf8');
  }
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function computeFilesFingerprint(files: ProjectFile[]): string {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  let hash = 2166136261;
  for (const file of sorted) {
    const chunk = `${file.path}:${file.content.length}:${file.content.slice(0, 128)}:${file.content.slice(-128)}`;
    for (let i = 0; i < chunk.length; i++) {
      hash ^= chunk.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${sorted.length}:${(hash >>> 0).toString(16)}`;
}

/**
 * Merges upstream GitHub files into the current workspace:
 * - Updates or inserts every file coming from upstream
 * - Preserves extra local-only files created in the workspace that do not exist upstream
 */
export function mergeUpstreamFilesWithWorkspace(
  localFiles: ProjectFile[],
  upstreamFiles: ProjectFile[]
): {
  merged: ProjectFile[];
  updatedCount: number;
  preservedLocalCount: number;
} {
  const upstreamByPath = new Map<string, ProjectFile>();
  for (const file of upstreamFiles) {
    upstreamByPath.set(file.path, file);
  }

  const preservedLocals: ProjectFile[] = [];
  for (const local of localFiles) {
    if (!upstreamByPath.has(local.path)) {
      preservedLocals.push(local);
    }
  }

  const merged = [...upstreamFiles, ...preservedLocals].sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  return {
    merged,
    updatedCount: upstreamFiles.length,
    preservedLocalCount: preservedLocals.length,
  };
}


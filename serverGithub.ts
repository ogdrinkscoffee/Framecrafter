import JSZip from 'jszip';
import {
  encodeProjectFileForGitHubBlob,
  type GitHubPullResponse,
  type GitHubPushResponse,
  inferBinaryMimeFromPath,
  parseGitHubRepoUrl,
  shouldIgnoreGitHubTreePath,
} from './src/utils/githubSync.ts';
import { normalizeRelativePath } from './src/utils/projectBundler.ts';
import type { ProjectFile } from './src/types/editor.ts';

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_PULL_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PULL_FILES = 350;

function buildGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Framecraft-Studio',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const cleanToken = token?.trim();
  if (cleanToken) {
    headers.Authorization = `Bearer ${cleanToken}`;
  }
  return headers;
}

async function fetchGitHubJson<T>(
  apiPath: string,
  token?: string,
  init?: RequestInit
): Promise<{ status: number; data: T | null; message?: string }> {
  const res = await fetch(`${GITHUB_API_BASE}${apiPath}`, {
    ...init,
    headers: {
      ...buildGitHubHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: (T & { message?: string }) | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as T & { message?: string };
    } catch {
      parsed = null;
    }
  }
  return {
    status: res.status,
    data: parsed,
    message: parsed?.message,
  };
}

export async function pullFromGitHubRepo(params: {
  repoUrl: string;
  branch?: string;
  token?: string;
}): Promise<GitHubPullResponse> {
  const parsed = parseGitHubRepoUrl(params.repoUrl);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const { owner, repo, branch: urlBranch, repoFullName } = parsed.data;
  const authToken = params.token?.trim() || process.env.GITHUB_TOKEN?.trim() || undefined;

  const repoMetaRes = await fetchGitHubJson<{
    default_branch?: string;
    full_name?: string;
    private?: boolean;
  }>(`/repos/${owner}/${repo}`, authToken);

  if (repoMetaRes.status === 401 || repoMetaRes.status === 403 || repoMetaRes.status === 404) {
    return {
      ok: false,
      requiresAuth: !authToken,
      error: authToken
        ? `Could not access ${repoFullName} (${repoMetaRes.message || `HTTP ${repoMetaRes.status}`}). Check repository URL and token access.`
        : `Repository ${repoFullName} could not be accessed without credentials. If it is private, add a GitHub access token below.`,
    };
  }

  if (repoMetaRes.status >= 400 || !repoMetaRes.data) {
    return {
      ok: false,
      error: repoMetaRes.message || `GitHub returned HTTP ${repoMetaRes.status}.`,
    };
  }

  const targetBranch =
    params.branch?.trim() || urlBranch || repoMetaRes.data.default_branch || 'main';

  const commitRefRes = await fetchGitHubJson<{
    object?: { sha?: string };
  }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(targetBranch)}`, authToken);

  const latestCommitSha = commitRefRes.data?.object?.sha;

  // Fetch archive via zipball (single request, minimal rate-limit usage, full binary + text support)
  const zipUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/zipball/${encodeURIComponent(targetBranch)}`;
  const zipRes = await fetch(zipUrl, {
    headers: buildGitHubHeaders(authToken),
    redirect: 'follow',
  });

  if (zipRes.status === 401 || zipRes.status === 403 || zipRes.status === 404) {
    return {
      ok: false,
      requiresAuth: !authToken,
      error:
        zipRes.status === 404
          ? `Branch "${targetBranch}" or archive not found in ${repoFullName}.`
          : `Access denied fetching ${repoFullName} archive (HTTP ${zipRes.status}).`,
    };
  }

  if (!zipRes.ok) {
    return {
      ok: false,
      error: `Failed downloading repository archive (HTTP ${zipRes.status}).`,
    };
  }

  const arrayBuffer = await zipRes.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const extracted: Array<{ path: string; name: string; content: string }> = [];
  let truncated = false;

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  for (const entry of entries) {
    // GitHub zipballs wrap everything in "<owner>-<repo>-<sha>/"
    const slashIdx = entry.name.indexOf('/');
    const stripped = slashIdx !== -1 ? entry.name.slice(slashIdx + 1) : entry.name;
    const cleanPath = normalizeRelativePath(stripped);
    if (!cleanPath || shouldIgnoreGitHubTreePath(cleanPath)) continue;

    if (extracted.length >= MAX_PULL_FILES) {
      truncated = true;
      break;
    }

    const bytes = await entry.async('uint8array');
    if (bytes.byteLength > MAX_PULL_FILE_BYTES) {
      continue;
    }

    const binaryMime = inferBinaryMimeFromPath(cleanPath);
    const content = binaryMime
      ? `data:${binaryMime};base64,${Buffer.from(bytes).toString('base64')}`
      : Buffer.from(bytes).toString('utf8');

    extracted.push({
      path: cleanPath,
      name: cleanPath.split('/').pop() || cleanPath,
      content,
    });
  }

  return {
    ok: true,
    repoFullName: repoMetaRes.data.full_name || repoFullName,
    branch: targetBranch,
    latestCommitSha,
    files: extracted,
    truncated,
  };
}

export async function pushToGitHubRepo(params: {
  repoUrl: string;
  branch?: string;
  commitMessage?: string;
  token?: string;
  files: ProjectFile[];
}): Promise<GitHubPushResponse> {
  const parsed = parseGitHubRepoUrl(params.repoUrl);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const authToken = params.token?.trim() || process.env.GITHUB_TOKEN?.trim() || '';
  if (!authToken) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        'GitHub requires a Personal Access Token (repo / Contents write access) to commit and push changes.',
    };
  }

  const { owner, repo, branch: urlBranch, repoFullName } = parsed.data;
  const repoMetaRes = await fetchGitHubJson<{
    default_branch?: string;
    full_name?: string;
  }>(`/repos/${owner}/${repo}`, authToken);

  if (repoMetaRes.status === 401 || repoMetaRes.status === 403 || repoMetaRes.status === 404) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        repoMetaRes.message ||
        `Unable to access ${repoFullName} with this token (HTTP ${repoMetaRes.status}).`,
    };
  }

  if (repoMetaRes.status >= 400 || !repoMetaRes.data) {
    return {
      ok: false,
      error: repoMetaRes.message || `GitHub returned HTTP ${repoMetaRes.status}.`,
    };
  }

  const targetBranch =
    params.branch?.trim() || urlBranch || repoMetaRes.data.default_branch || 'main';
  const commitMessage =
    params.commitMessage?.trim() || `Update ${repoFullName} from Framecraft`;

  const sanitizedFiles = params.files
    .map((file) => {
      const cleanPath = normalizeRelativePath(file.path);
      return cleanPath && !shouldIgnoreGitHubTreePath(cleanPath)
        ? { ...file, path: cleanPath }
        : null;
    })
    .filter((f): f is ProjectFile => f !== null);

  if (sanitizedFiles.length === 0) {
    return { ok: false, error: 'No project files to commit.' };
  }

  const refRes = await fetchGitHubJson<{
    object?: { sha?: string };
  }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(targetBranch)}`, authToken);

  if (refRes.status === 401 || refRes.status === 403) {
    return {
      ok: false,
      requiresAuth: true,
      error: refRes.message || 'Token lacks write permission on this repository.',
    };
  }

  if (refRes.status === 404 || !refRes.data?.object?.sha) {
    // Handle empty repository or new branch fallback via Contents/ref error clarity
    return {
      ok: false,
      error: `Branch "${targetBranch}" was not found on ${repoFullName}. Create an initial commit/branch on GitHub first.`,
    };
  }

  const parentCommitSha = refRes.data.object.sha;
  const commitRes = await fetchGitHubJson<{
    tree?: { sha?: string };
  }>(`/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, authToken);

  if (commitRes.status >= 400 || !commitRes.data?.tree?.sha) {
    return {
      ok: false,
      error: commitRes.message || 'Unable to inspect target branch commit tree.',
    };
  }

  const treeEntries: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha?: string;
    content?: string;
  }> = [];

  for (const file of sanitizedFiles) {
    const encoded = encodeProjectFileForGitHubBlob(file);
    if (encoded.encoding === 'base64') {
      const blobRes = await fetchGitHubJson<{ sha?: string }>(
        `/repos/${owner}/${repo}/git/blobs`,
        authToken,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: encoded.content,
            encoding: 'base64',
          }),
        }
      );
      if (blobRes.status >= 400 || !blobRes.data?.sha) {
        return {
          ok: false,
          error: blobRes.message || `Failed uploading binary blob ${encoded.path}`,
        };
      }
      treeEntries.push({
        path: encoded.path,
        mode: '100644',
        type: 'blob',
        sha: blobRes.data.sha,
      });
    } else {
      treeEntries.push({
        path: encoded.path,
        mode: '100644',
        type: 'blob',
        content: encoded.content,
      });
    }
  }

  const treeRes = await fetchGitHubJson<{ sha?: string }>(
    `/repos/${owner}/${repo}/git/trees`,
    authToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_tree: commitRes.data.tree.sha,
        tree: treeEntries,
      }),
    }
  );

  if (treeRes.status >= 400 || !treeRes.data?.sha) {
    return {
      ok: false,
      error: treeRes.message || 'Failed creating GitHub tree object.',
    };
  }

  const newCommitRes = await fetchGitHubJson<{ sha?: string; html_url?: string }>(
    `/repos/${owner}/${repo}/git/commits`,
    authToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        tree: treeRes.data.sha,
        parents: [parentCommitSha],
      }),
    }
  );

  if (newCommitRes.status >= 400 || !newCommitRes.data?.sha) {
    return {
      ok: false,
      error: newCommitRes.message || 'Failed creating GitHub commit.',
    };
  }

  const updateRefRes = await fetchGitHubJson<{ ref?: string }>(
    `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
    authToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sha: newCommitRes.data.sha,
        force: false,
      }),
    }
  );

  if (updateRefRes.status >= 400) {
    return {
      ok: false,
      error:
        updateRefRes.message ||
        `Failed updating branch "${targetBranch}" (it may be protected or behind remote).`,
    };
  }

  return {
    ok: true,
    repoFullName: repoMetaRes.data.full_name || repoFullName,
    branch: targetBranch,
    commitSha: newCommitRes.data.sha,
    commitUrl:
      newCommitRes.data.html_url ||
      `https://github.com/${repoMetaRes.data.full_name || repoFullName}/commit/${newCommitRes.data.sha}`,
    filesPushed: treeEntries.length,
  };
}

import JSZip from 'jszip';
import {
  encodeProjectFileForGitHubBlob,
  type GitHubBranchesResponse,
  type GitHubPullResponse,
  type GitHubPushResponse,
  type GitHubRepoSummary,
  type GitHubReposResponse,
  type GitHubUserProfile,
  inferBinaryMimeFromPath,
  parseGitHubRepoUrl,
  shouldIgnoreGitHubTreePath,
  VALID_GITHUB_SLUG_RE,
} from './src/utils/githubSync.ts';
import { sanitizeHttpUrl } from './serverOAuth.ts';
import { normalizeRelativePath } from './src/utils/projectBundler.ts';
import type { ProjectFile } from './src/types/editor.ts';

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_PULL_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PULL_FILES = 350;

export function sanitizeGitHubToken(raw?: string | null): string {
  if (typeof raw !== 'string') return '';
  let clean = raw.trim();
  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'"))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  clean = clean.replace(/^(?:Bearer|token)\s+/i, '').trim();
  return clean;
}

function buildGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Framecraft-Studio',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const cleanToken = sanitizeGitHubToken(token);
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

export async function exchangeGitHubOAuthCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const bodyPayload: Record<string, string> = {
    client_id: params.clientId,
    code: params.code,
    redirect_uri: params.redirectUri,
  };
  if (params.clientSecret?.trim()) {
    bodyPayload.client_secret = params.clientSecret.trim();
  }
  if (params.codeVerifier?.trim()) {
    bodyPayload.code_verifier = params.codeVerifier.trim();
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Framecraft-Studio',
    },
    body: JSON.stringify(bodyPayload),
  });

  const payload = (await res.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!res.ok || !payload?.access_token) {
    return {
      ok: false,
      error:
        payload?.error_description ||
        payload?.error ||
        `GitHub OAuth token exchange failed (HTTP ${res.status}).`,
    };
  }

  return { ok: true, accessToken: payload.access_token };
}

export async function fetchGitHubAuthenticatedUser(
  accessToken: string
): Promise<{ ok: true; user: GitHubUserProfile } | { ok: false; error: string }> {
  const userRes = await fetchGitHubJson<{
    login?: string;
    name?: string | null;
    avatar_url?: string | null;
    html_url?: string;
  }>('/user', accessToken);

  if (userRes.status >= 400 || !userRes.data?.login) {
    return {
      ok: false,
      error: userRes.message || `Failed fetching GitHub profile (HTTP ${userRes.status}).`,
    };
  }

  return {
    ok: true,
    user: {
      login: userRes.data.login,
      name: userRes.data.name ?? null,
      avatarUrl: sanitizeHttpUrl(userRes.data.avatar_url),
      htmlUrl: sanitizeHttpUrl(userRes.data.html_url) || `https://github.com/${encodeURIComponent(userRes.data.login)}`,
    },
  };
}

export async function listAuthenticatedGitHubRepos(
  accessToken: string,
  query?: string
): Promise<GitHubReposResponse> {
  const cleanToken = sanitizeGitHubToken(accessToken);
  if (!cleanToken) {
    return { ok: false, requiresAuth: true, error: 'Connect your GitHub account first.' };
  }

  const [userProfileRes, reposRes] = await Promise.all([
    fetchGitHubAuthenticatedUser(cleanToken),
    fetchGitHubJson<
      Array<{
        id: number;
        name: string;
        full_name: string;
        owner?: { login?: string };
        private: boolean;
        default_branch?: string;
        description?: string | null;
        html_url: string;
        updated_at: string;
        language?: string | null;
        permissions?: { push?: boolean };
      }>
    >(
      '/user/repos?sort=updated&direction=desc&per_page=100&affiliation=owner,collaborator,organization_member',
      cleanToken
    ),
  ]);

  if (reposRes.status === 401) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        'GitHub rejected this token (Bad credentials). Check or regenerate your Personal Access Token with repo & read:user scopes.',
    };
  }

  if (reposRes.status === 403) {
    return {
      ok: false,
      requiresAuth: true,
      error: reposRes.message || 'GitHub authorization expired or lacks repository access.',
    };
  }

  if (reposRes.status >= 400 || !Array.isArray(reposRes.data)) {
    return {
      ok: false,
      error: reposRes.message || `Failed listing GitHub repositories (HTTP ${reposRes.status}).`,
    };
  }

  const q = query?.trim().toLowerCase() ?? '';
  const mapped: GitHubRepoSummary[] = reposRes.data
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || repo.full_name.split('/')[0] || '',
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || 'main',
      description: repo.description ?? null,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
      language: repo.language ?? null,
      canPush: repo.permissions?.push ?? true,
    }))
    .filter((repo) => {
      if (!q) return true;
      return (
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description || '').toLowerCase().includes(q) ||
        (repo.language || '').toLowerCase().includes(q)
      );
    });

  return {
    ok: true,
    ...(userProfileRes.ok ? { user: userProfileRes.user } : {}),
    repos: mapped,
  };
}

const GITHUB_USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

export async function listPublicGitHubReposByUsername(
  username: string,
  query?: string,
  token?: string
): Promise<GitHubReposResponse> {
  const cleanUsername = username.trim().replace(/^@+/, '');
  if (!GITHUB_USERNAME_RE.test(cleanUsername)) {
    return {
      ok: false,
      error: 'Enter a valid GitHub username (letters, numbers, or single hyphens).',
    };
  }

  const userToken = token?.trim() || undefined;
  let authToken = userToken || process.env.GITHUB_TOKEN?.trim() || undefined;

  let [profileRes, reposRes] = await Promise.all([
    fetchGitHubJson<{
      login?: string;
      name?: string | null;
      avatar_url?: string | null;
      html_url?: string;
    }>(`/users/${encodeURIComponent(cleanUsername)}`, authToken),
    fetchGitHubJson<
      Array<{
        id: number;
        name: string;
        full_name: string;
        owner?: { login?: string };
        private: boolean;
        default_branch?: string;
        description?: string | null;
        html_url: string;
        updated_at: string;
        language?: string | null;
      }>
    >(
      `/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&direction=desc&per_page=100`,
      authToken
    ),
  ]);

  if ((profileRes.status === 401 || reposRes.status === 401) && !userToken && authToken) {
    authToken = undefined;
    [profileRes, reposRes] = await Promise.all([
      fetchGitHubJson<{
        login?: string;
        name?: string | null;
        avatar_url?: string | null;
        html_url?: string;
      }>(`/users/${encodeURIComponent(cleanUsername)}`, undefined),
      fetchGitHubJson<
        Array<{
          id: number;
          name: string;
          full_name: string;
          owner?: { login?: string };
          private: boolean;
          default_branch?: string;
          description?: string | null;
          html_url: string;
          updated_at: string;
          language?: string | null;
        }>
      >(
        `/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&direction=desc&per_page=100`,
        undefined
      ),
    ]);
  }

  if (reposRes.status === 404 || profileRes.status === 404) {
    return { ok: false, error: `GitHub user "@${cleanUsername}" was not found.` };
  }

  if (reposRes.status >= 400 || !Array.isArray(reposRes.data)) {
    return {
      ok: false,
      error:
        reposRes.message ||
        `Unable to list public repositories for @${cleanUsername} (HTTP ${reposRes.status}).`,
    };
  }

  const q = query?.trim().toLowerCase() ?? '';
  const mapped: GitHubRepoSummary[] = reposRes.data
    .map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || cleanUsername,
      private: Boolean(repo.private),
      defaultBranch: repo.default_branch || 'main',
      description: repo.description ?? null,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
      language: repo.language ?? null,
      canPush: false,
    }))
    .filter((repo) => {
      if (!q) return true;
      return (
        repo.fullName.toLowerCase().includes(q) ||
        (repo.description || '').toLowerCase().includes(q) ||
        (repo.language || '').toLowerCase().includes(q)
      );
    });

  const userProfile: GitHubUserProfile = profileRes.data?.login
    ? {
        login: profileRes.data.login,
        name: profileRes.data.name ?? null,
        avatarUrl: sanitizeHttpUrl(profileRes.data.avatar_url),
        htmlUrl:
          sanitizeHttpUrl(profileRes.data.html_url) ||
          `https://github.com/${encodeURIComponent(profileRes.data.login)}`,
      }
    : {
        login: cleanUsername,
        name: null,
        avatarUrl: null,
        htmlUrl: `https://github.com/${encodeURIComponent(cleanUsername)}`,
      };

  return {
    ok: true,
    user: userProfile,
    repos: mapped,
  };
}

export async function listGitHubRepoBranches(
  owner: string,
  repo: string,
  token?: string
): Promise<GitHubBranchesResponse> {
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

  const userToken = token?.trim() || undefined;
  let authToken = userToken || process.env.GITHUB_TOKEN?.trim() || undefined;
  let branchesRes = await fetchGitHubJson<Array<{ name?: string }>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    authToken
  );

  if (branchesRes.status === 401 && !userToken && authToken) {
    authToken = undefined;
    branchesRes = await fetchGitHubJson<Array<{ name?: string }>>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
      undefined
    );
  }

  if (branchesRes.status >= 400 || !Array.isArray(branchesRes.data)) {
    return {
      ok: false,
      error: branchesRes.message || `Failed fetching branches (HTTP ${branchesRes.status}).`,
    };
  }

  const branches = branchesRes.data
    .map((b) => (typeof b.name === 'string' ? b.name : ''))
    .filter(Boolean);

  return { ok: true, branches };
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
  const userToken = params.token?.trim() || undefined;
  let authToken = userToken || process.env.GITHUB_TOKEN?.trim() || undefined;

  let repoMetaRes = await fetchGitHubJson<{
    default_branch?: string;
    full_name?: string;
    private?: boolean;
  }>(`/repos/${owner}/${repo}`, authToken);

  if (repoMetaRes.status === 401 && !userToken && authToken) {
    authToken = undefined;
    repoMetaRes = await fetchGitHubJson<{
      default_branch?: string;
      full_name?: string;
      private?: boolean;
    }>(`/repos/${owner}/${repo}`, undefined);
  }

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

  // Writes never use the server's own GITHUB_TOKEN: that would let anonymous
  // callers push to every repository the machine token can access. Pushes must
  // be authenticated with the caller's OAuth session or personal token.
  const userToken = sanitizeGitHubToken(params.token);
  const authToken = userToken;
  if (!authToken) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        'Connect your GitHub account or paste a Personal Access Token (with repo / Contents write access) to commit and push changes.',
    };
  }

  const { owner, repo, branch: urlBranch, repoFullName } = parsed.data;
  const repoMetaRes = await fetchGitHubJson<{
    default_branch?: string;
    full_name?: string;
    permissions?: { push?: boolean };
  }>(`/repos/${owner}/${repo}`, authToken);

  if (repoMetaRes.status === 401) {
    return {
      ok: false,
      requiresAuth: true,
      error: userToken
        ? 'GitHub rejected your token ("Bad credentials"). Reconnect GitHub or paste a valid Personal Access Token with repo write access.'
        : 'You are browsing public repositories in read-only mode. Connect your GitHub account or paste a Personal Access Token (with repo / Contents write access) to push commits.',
    };
  }

  if (repoMetaRes.status === 403 || repoMetaRes.status === 404) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        repoMetaRes.status === 404
          ? `Could not access ${repoFullName} with this token (HTTP 404). Make sure the repository exists and your token has repo access.`
          : repoMetaRes.message ||
            `Permission denied accessing ${repoFullName} (HTTP ${repoMetaRes.status}). Make sure your token has repo / Contents write access.`,
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

  if (refRes.status === 401) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        'GitHub rejected your credentials ("Bad credentials"). Reconnect GitHub or paste a valid Personal Access Token with repo write access.',
    };
  }

  if (refRes.status === 403) {
    return {
      ok: false,
      requiresAuth: true,
      error:
        refRes.message ||
        'Token lacks write permission on this repository (requires repo or Contents: Read & write).',
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

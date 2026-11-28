import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  DownloadCloud,
  ExternalLink,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  Link2,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';
import {
  type GitHubConnectionConfig,
  type GitHubRepoSummary,
  type GitHubUserProfile,
  parseGitHubRepoUrl,
} from '../utils/githubSync';
import { useModalFocus } from '../utils/useModalFocus';

export interface GitHubOAuthProps {
  githubUser: GitHubUserProfile | null;
  githubAccountReadOnly?: boolean;
  githubRepos: GitHubRepoSummary[];
  githubReposLoading: boolean;
  githubReposError: string | null;
  githubConnecting?: boolean;
  githubOAuthConfigured: boolean | null;
  githubCallbackUrl: string;
  onConnectGitHub: () => Promise<void>;
  onDisconnectGitHub: () => Promise<void>;
  onRefreshGitHubRepos: (overridePatToken?: string) => Promise<void>;
  onBrowseGitHubUsername?: (username: string) => Promise<void>;
  onFetchRepoBranches: (owner: string, repo: string) => Promise<string[]>;
  onSwitchBranch?: (branch: string) => void;
}

interface BranchSwitcherProps {
  id?: string;
  repoTarget: string;
  branch: string;
  defaultBranchHint?: string;
  onChangeBranch: (branch: string) => void;
  onFetchRepoBranches: (owner: string, repo: string) => Promise<string[]>;
  open: boolean;
  compact?: boolean;
}

const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
  id = 'github-branch-switcher',
  repoTarget,
  branch,
  defaultBranchHint,
  onChangeBranch,
  onFetchRepoBranches,
  open,
  compact = false,
}) => {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const lastFetchedSlugRef = useRef<string>('');

  const parsedTarget = useMemo(() => {
    const trimmed = repoTarget.trim();
    if (!trimmed) return null;
    const res = parseGitHubRepoUrl(trimmed);
    return res.ok ? res.data : null;
  }, [repoTarget]);

  const repoSlug = parsedTarget ? `${parsedTarget.owner}/${parsedTarget.repo}` : '';

  const loadBranches = async (force = false) => {
    if (!parsedTarget) return;
    if (!force && lastFetchedSlugRef.current === repoSlug && branches.length > 0) return;
    lastFetchedSlugRef.current = repoSlug;
    setLoading(true);
    try {
      const fetched = await onFetchRepoBranches(parsedTarget.owner, parsedTarget.repo);
      if (fetched.length > 0) {
        setBranches(fetched);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !parsedTarget) {
      if (!parsedTarget) {
        setBranches([]);
        lastFetchedSlugRef.current = '';
      }
      return;
    }
    if (lastFetchedSlugRef.current === repoSlug) return;
    const timer = window.setTimeout(() => {
      void loadBranches(true);
    }, 220);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, repoSlug]);

  const branchOptions = useMemo(() => {
    const set = new Set<string>();
    const current = branch.trim();
    if (current) set.add(current);
    if (defaultBranchHint?.trim()) set.add(defaultBranchHint.trim());
    for (const b of branches) {
      if (b.trim()) set.add(b.trim());
    }
    if (set.size === 0) set.add('main');
    return Array.from(set);
  }, [branches, branch, defaultBranchHint]);

  return (
    <div>
      <div className="flex items-center justify-between gap-1 mb-1">
        <label
          htmlFor={id}
          className="text-[11px] font-medium text-[var(--studio-muted)] flex items-center gap-1"
        >
          <GitBranch className="w-3 h-3 text-emerald-500" strokeWidth={1.6} />
          <span>Branch</span>
          {loading && <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-400" />}
        </label>
        <div className="flex items-center gap-1.5">
          {parsedTarget && (
            <button
              type="button"
              onClick={() => void loadBranches(true)}
              disabled={loading}
              title="Refresh branches from GitHub"
              aria-label="Refresh repository branches"
              className="p-0.5 rounded text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] cursor-pointer"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCustomMode((prev) => !prev)}
            className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            {customMode ? 'List' : 'Custom'}
          </button>
        </div>
      </div>

      {customMode ? (
        <input
          id={id}
          type="text"
          value={branch}
          onChange={(e) => onChangeBranch(e.target.value)}
          placeholder="main"
          aria-label="Custom GitHub branch name"
          className={`w-full rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 ${
            compact ? 'h-7' : 'h-8'
          }`}
        />
      ) : (
        <select
          id={id}
          value={branch.trim() || branchOptions[0]}
          onChange={(e) => onChangeBranch(e.target.value)}
          aria-label="Switch GitHub branch"
          className={`w-full rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 cursor-pointer ${
            compact ? 'h-7' : 'h-8'
          }`}
        >
          {branchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export interface GitHubSyncPopoverProps extends GitHubOAuthProps {
  open: boolean;
  onClose: () => void;
  connection: GitHubConnectionConfig;
  token: string;
  onChangeToken: (token: string) => void;
  busyAction: 'pull' | 'push' | null;
  statusError: string | null;
  statusMessage: string | null;
  requiresAuthPrompt: boolean;
  onPullFromGitHub: (repoUrl: string, branch: string, token: string) => Promise<void>;
  onPushToGitHub: (
    repoUrl: string,
    branch: string,
    commitMessage: string,
    token: string
  ) => Promise<void>;
  onToggleAutoSync: (enabled: boolean, repoUrl: string, branch: string) => void;
}

export const GitHubSyncPopover: React.FC<GitHubSyncPopoverProps> = ({
  open,
  onClose,
  connection,
  token,
  onChangeToken,
  busyAction,
  statusError,
  statusMessage,
  requiresAuthPrompt,
  onPullFromGitHub,
  onPushToGitHub,
  onToggleAutoSync,
  githubUser,
  githubAccountReadOnly = false,
  githubRepos,
  githubReposLoading,
  githubReposError,
  githubConnecting = false,
  githubOAuthConfigured,
  githubCallbackUrl,
  onConnectGitHub,
  onDisconnectGitHub,
  onRefreshGitHubRepos,
  onBrowseGitHubUsername,
  onFetchRepoBranches,
  onSwitchBranch,
}) => {
  const [sourceMode, setSourceMode] = useState<'repos' | 'url'>(() =>
    connection.repoUrl && !githubUser ? 'url' : 'repos'
  );
  const [repoSearch, setRepoSearch] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [selectedRepoFullName, setSelectedRepoFullName] = useState(connection.repoFullName || '');

  const [repoUrlDraft, setRepoUrlDraft] = useState(connection.repoUrl);
  const [branchDraft, setBranchDraft] = useState(connection.branch);
  const [commitMessageDraft, setCommitMessageDraft] = useState('Update project from Framecraft');
  const [showAuthSection, setShowAuthSection] = useState(false);
  const [showConnectedAuthPanel, setShowConnectedAuthPanel] = useState(false);
  const [showPatFallback, setShowPatFallback] = useState(false);
  const [showOAuthSetup, setShowOAuthSetup] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setRepoUrlDraft(connection.repoUrl);
      setBranchDraft(connection.branch || 'main');
      setSelectedRepoFullName(connection.repoFullName || '');
      if (connection.repoUrl && !githubUser && githubRepos.length === 0) {
        setSourceMode('url');
      } else if (githubUser) {
        setSourceMode('repos');
      }
    }
  }, [open, connection.repoUrl, connection.branch, connection.repoFullName, githubUser, githubRepos.length]);

  useEffect(() => {
    if (requiresAuthPrompt) {
      setShowAuthSection(true);
      setShowConnectedAuthPanel(true);
    }
  }, [requiresAuthPrompt]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!popoverRef.current || !target) return;
      if (!popoverRef.current.closest('[data-github-sync-root]')?.contains(target)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    window.addEventListener('mousedown', handleOutside);
    return () => {
      window.removeEventListener('keydown', handleKey, true);
      window.removeEventListener('mousedown', handleOutside);
    };
  }, [open, onClose]);

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return githubRepos;
    return githubRepos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.language || '').toLowerCase().includes(q)
    );
  }, [githubRepos, repoSearch]);

  if (!open) return null;

  const isBusy = busyAction !== null;
  const isAccountConnected = Boolean(githubUser || githubRepos.length > 0);
  const activeRepoObj = githubRepos.find((r) => r.fullName === selectedRepoFullName) ?? null;

  const handleSelectRepo = (repo: GitHubRepoSummary) => {
    setSelectedRepoFullName(repo.fullName);
    setRepoUrlDraft(repo.htmlUrl);
    const nextBranch =
      connection.repoFullName.toLowerCase() === repo.fullName.toLowerCase() && connection.branch
        ? connection.branch
        : repo.defaultBranch || 'main';
    setBranchDraft(nextBranch);
  };

  const handleBranchSelectionChange = (nextBranch: string) => {
    setBranchDraft(nextBranch);
    if (!onSwitchBranch) return;
    const activeSlug = connection.repoFullName.toLowerCase();
    const draftParsed = parseGitHubRepoUrl(repoUrlDraft);
    const draftSlug = draftParsed.ok ? draftParsed.data.repoFullName.toLowerCase() : '';
    if (activeSlug && (!draftSlug || draftSlug === activeSlug)) {
      onSwitchBranch(nextBranch);
    }
  };

  const handleCopyCallback = async () => {
    if (!githubCallbackUrl) return;
    try {
      await navigator.clipboard.writeText(githubCallbackUrl);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Sync to GitHub"
      data-testid="github-sync-popover"
      className="absolute right-0 top-full mt-2 w-[410px] max-w-[calc(100vw-24px)] z-50 rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-2xl studio-card-highlight overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--studio-border)] bg-[var(--studio-elevated)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[13.5px] font-semibold text-[var(--studio-text-strong)] leading-tight">
              GitHub Sync
            </h2>
            <p className="text-[11px] text-[var(--studio-muted)] truncate">
              {connection.repoFullName
                ? `Active: ${connection.repoFullName} (${connection.branch || 'main'})`
                : githubUser
                  ? `Connected as @${githubUser.login}`
                  : 'Connect your GitHub account or paste a repository URL'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close GitHub sync dialog"
          className="p-1 rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Mode Switcher: Direct GitHub Account vs URL (2nd option) */}
      <div className="px-4 pt-3">
        <div
          role="tablist"
          aria-label="GitHub connection mode"
          className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--studio-elevated)] border border-[var(--studio-border)]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === 'repos'}
            onClick={() => setSourceMode('repos')}
            className={`h-7 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              sourceMode === 'repos'
                ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.6} />
            My GitHub Repos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sourceMode === 'url'}
            onClick={() => setSourceMode('url')}
            className={`h-7 rounded-lg text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              sourceMode === 'url'
                ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
            }`}
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-500" strokeWidth={1.6} />
            By Repo URL
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 pt-3 space-y-3 max-h-[72vh] overflow-y-auto builder-scroll">
        {sourceMode === 'repos' ? (
          <>
            {!isAccountConnected ? (
              <div className="space-y-3">
                {githubOAuthConfigured === true ? (
                  <>
                    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] p-3.5 space-y-2.5">
                      <div className="text-[12.5px] font-semibold text-[var(--studio-text-strong)]">
                        Connect directly to GitHub
                      </div>
                      <p className="text-[11.5px] text-[var(--studio-muted)] leading-relaxed">
                        Authorize Framecraft to browse your public &amp; private repositories,
                        switch branches, and pull or push commits without copying URLs.
                      </p>
                      <button
                        type="button"
                        onClick={() => void onConnectGitHub()}
                        disabled={githubReposLoading || githubConnecting}
                        className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
                      >
                        {githubReposLoading || githubConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <GitBranch className="w-4 h-4" strokeWidth={1.75} />
                        )}
                        {githubConnecting ? 'Authorizing with GitHub...' : 'Connect GitHub Account'}
                      </button>
                    </div>

                    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowPatFallback((prev) => !prev)}
                        className="w-full px-3 py-2 flex items-center justify-between text-left text-[11.5px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
                          Or browse by username / GitHub Token
                        </span>
                        {showPatFallback ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                        )}
                      </button>
                      {showPatFallback && (
                        <div className="px-3 pb-3 pt-2 space-y-2 border-t border-[var(--studio-border-subtle)]">
                          {onBrowseGitHubUsername && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={usernameDraft}
                                onChange={(e) => setUsernameDraft(e.target.value)}
                                placeholder="GitHub @username (public repos)"
                                aria-label="GitHub username"
                                className="flex-1 min-w-0 h-7 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                              />
                              <button
                                type="button"
                                disabled={!usernameDraft.trim() || githubReposLoading}
                                onClick={() => void onBrowseGitHubUsername(usernameDraft)}
                                className="h-7 px-2.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border-strong)] text-[11px] font-semibold text-[var(--studio-text-strong)] disabled:opacity-45 cursor-pointer"
                              >
                                Browse
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="password"
                              value={token}
                              onChange={(e) => onChangeToken(e.target.value)}
                              placeholder="ghp_... or github_pat_..."
                              aria-label="GitHub Personal Access Token"
                              autoComplete="off"
                              className="flex-1 min-w-0 h-7 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              disabled={!token.trim() || githubReposLoading}
                              onClick={() => void onRefreshGitHubRepos(token)}
                              className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold disabled:opacity-45 cursor-pointer"
                            >
                              Connect
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {/* Direct Token Connect — zero OAuth App setup needed */}
                    <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold text-[var(--studio-text-strong)]">
                          Connect your GitHub Account
                        </div>
                        <a
                          href="https://github.com/settings/tokens/new?description=Framecraft+Studio&scopes=repo,read:user"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-500 dark:text-indigo-400 hover:underline shrink-0"
                        >
                          <span>Get token</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
                        Generate a token on GitHub (pre-filled for repos), paste it below, and
                        browse all public &amp; private repositories or push commits directly.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void onRefreshGitHubRepos(token);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="password"
                          value={token}
                          onChange={(e) => onChangeToken(e.target.value)}
                          placeholder="Paste ghp_... or github_pat_..."
                          aria-label="GitHub Personal Access Token"
                          autoComplete="off"
                          className="flex-1 min-w-0 h-8 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!token.trim() || githubReposLoading}
                          className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-[11.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          {githubReposLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'Connect'
                          )}
                        </button>
                      </form>
                    </div>

                    {/* Zero-auth public repo browser by username */}
                    {onBrowseGitHubUsername && (
                      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] p-3 space-y-2">
                        <div className="text-[11.5px] font-semibold text-[var(--studio-text-strong)]">
                          Or browse public repositories by username
                        </div>
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void onBrowseGitHubUsername(usernameDraft);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <input
                            type="text"
                            value={usernameDraft}
                            onChange={(e) => setUsernameDraft(e.target.value)}
                            placeholder="GitHub @username"
                            aria-label="GitHub username"
                            className="flex-1 min-w-0 h-7 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={!usernameDraft.trim() || githubReposLoading}
                            className="h-7 px-2.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border-strong)] text-[11px] font-semibold text-[var(--studio-text-strong)] disabled:opacity-45 cursor-pointer"
                          >
                            Browse
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Optional server OAuth App guide collapsed by default */}
                    {githubCallbackUrl && (
                      <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setShowOAuthSetup((prev) => !prev)}
                          className="w-full px-3 py-2 flex items-center justify-between text-left text-[11px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
                        >
                          <span>Optional: Configure 1-click OAuth App</span>
                          {showOAuthSetup ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {showOAuthSetup && (
                          <div className="px-3 pb-3 pt-1.5 space-y-1.5 border-t border-[var(--studio-border-subtle)] text-[11px] text-[var(--studio-muted)]">
                            <p className="leading-relaxed">
                              Set <code className="font-mono-tabular">GITHUB_CLIENT_ID</code> in
                              Secrets (<code className="font-mono-tabular">GITHUB_CLIENT_SECRET</code>{' '}
                              is optional with PKCE) using this callback URL:
                            </p>
                            <div className="flex items-center gap-1.5">
                              <code className="flex-1 truncate px-2 py-1 rounded bg-[var(--studio-surface)] border border-[var(--studio-border)] font-mono-tabular text-[10.5px]">
                                {githubCallbackUrl}
                              </code>
                              <button
                                type="button"
                                onClick={() => void handleCopyCallback()}
                                className="h-6 px-2 rounded bg-[var(--studio-surface)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)] text-[10.5px] font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer"
                              >
                                {copiedCallback ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                {copiedCallback ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {githubReposError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11.5px] text-red-700 dark:text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
                    <span className="leading-snug">{githubReposError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Connected Account Header */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--studio-elevated)] border border-[var(--studio-border)]">
                  <div className="flex items-center gap-2 min-w-0">
                    {githubUser?.avatarUrl ? (
                      <img
                        src={githubUser.avatarUrl}
                        alt={githubUser.login}
                        className="w-5 h-5 rounded-full border border-[var(--studio-border-strong)] shrink-0"
                      />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[12px] font-semibold text-[var(--studio-text-strong)] truncate">
                        {githubUser ? `@${githubUser.login}` : 'GitHub Connected'}
                      </span>
                      {githubAccountReadOnly && (
                        <span className="text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[var(--studio-muted)] shrink-0">
                          public
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void onRefreshGitHubRepos()}
                      disabled={githubReposLoading}
                      title="Refresh repositories"
                      aria-label="Refresh repositories"
                      className="p-1.5 rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${githubReposLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDisconnectGitHub()}
                      title="Disconnect GitHub"
                      aria-label="Disconnect GitHub"
                      className="p-1.5 rounded-md text-[var(--studio-muted)] hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Search Repositories */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    placeholder="Search your repositories..."
                    aria-label="Search GitHub repositories"
                    className="w-full h-8 pl-8 pr-2.5 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Repository List */}
                <div className="max-h-44 overflow-y-auto builder-scroll rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] divide-y divide-[var(--studio-border-subtle)]">
                  {githubReposLoading && githubRepos.length === 0 ? (
                    <div className="p-4 text-center text-[11.5px] text-[var(--studio-muted)] flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Loading repositories...
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <div className="p-4 text-center text-[11.5px] text-[var(--studio-muted)]">
                      {githubRepos.length === 0
                        ? 'No repositories found for this account.'
                        : `No repositories matching "${repoSearch}".`}
                    </div>
                  ) : (
                    filteredRepos.map((repo) => {
                      const isSelected = selectedRepoFullName === repo.fullName;
                      return (
                        <button
                          key={repo.id}
                          type="button"
                          onClick={() => void handleSelectRepo(repo)}
                          className={`w-full px-3 py-2 text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-500/15'
                              : 'hover:bg-[var(--studio-hover)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {repo.private ? (
                                <Lock
                                  className="w-3 h-3 text-amber-500 shrink-0"
                                  strokeWidth={1.7}
                                />
                              ) : (
                                <Globe
                                  className="w-3 h-3 text-[var(--studio-muted)] shrink-0"
                                  strokeWidth={1.5}
                                />
                              )}
                              <span className="text-[12px] font-mono-tabular font-medium text-[var(--studio-text-strong)] truncate">
                                {repo.fullName}
                              </span>
                            </div>
                            {repo.description && (
                              <div className="text-[10.5px] text-[var(--studio-muted)] truncate mt-0.5">
                                {repo.description}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono-tabular text-[var(--studio-muted-soft)]">
                            {repo.language && <span>{repo.language}</span>}
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Branch + Commit Message for Selected or Active Repo */}
                {(activeRepoObj || repoUrlDraft || connection.repoFullName) && (
                  <div className="grid grid-cols-2 gap-2">
                    <BranchSwitcher
                      id="github-repo-branch-select"
                      repoTarget={repoUrlDraft || activeRepoObj?.fullName || connection.repoFullName}
                      branch={branchDraft}
                      defaultBranchHint={activeRepoObj?.defaultBranch || connection.branch}
                      onChangeBranch={handleBranchSelectionChange}
                      onFetchRepoBranches={onFetchRepoBranches}
                      open={open}
                    />
                    <div>
                      <label
                        htmlFor="github-repo-commit-msg"
                        className="block text-[11px] font-medium text-[var(--studio-muted)] mb-1"
                      >
                        Commit Message
                      </label>
                      <input
                        id="github-repo-commit-msg"
                        type="text"
                        value={commitMessageDraft}
                        onChange={(e) => setCommitMessageDraft(e.target.value)}
                        placeholder="Update from Framecraft"
                        className="w-full h-8 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Write-Access / Token Prompt when browsing public repos read-only or after auth error */}
                {(githubAccountReadOnly || requiresAuthPrompt) && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowConnectedAuthPanel((prev) => !prev)}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-[11px] font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={1.6} />
                        <span className="truncate">
                          {githubAccountReadOnly
                            ? 'Read-only public view — authorize to push commits'
                            : 'Reconnect GitHub or update Personal Access Token'}
                        </span>
                      </span>
                      {showConnectedAuthPanel || requiresAuthPrompt ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    {(showConnectedAuthPanel || requiresAuthPrompt) && (
                      <div className="px-3 pb-3 pt-2 space-y-2 border-t border-amber-500/20">
                        {githubOAuthConfigured === true && (
                          <button
                            type="button"
                            disabled={githubConnecting || githubReposLoading}
                            onClick={() => void onConnectGitHub()}
                            className="w-full h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            {githubConnecting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <GitBranch className="w-3.5 h-3.5" />
                            )}
                            {githubConnecting ? 'Authorizing with GitHub...' : 'Connect GitHub Account'}
                          </button>
                        )}
                        <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--studio-muted)]">
                          <span>Personal Access Token (repo write scope)</span>
                          <a
                            href="https://github.com/settings/tokens/new?description=Framecraft+Studio&scopes=repo,read:user"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-indigo-500 dark:text-indigo-400 hover:underline shrink-0"
                          >
                            <span>Get token</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="password"
                            value={token}
                            onChange={(e) => onChangeToken(e.target.value)}
                            placeholder="ghp_... or github_pat_..."
                            aria-label="GitHub Personal Access Token for pushing"
                            autoComplete="off"
                            className="flex-1 min-w-0 h-7 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            disabled={!token.trim() || githubReposLoading}
                            onClick={() => void onRefreshGitHubRepos(token)}
                            className="h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                          >
                            {githubReposLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              'Verify'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isBusy || !repoUrlDraft.trim()}
                    onClick={() => void onPullFromGitHub(repoUrlDraft, branchDraft, token)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[var(--studio-text-strong)] border border-[var(--studio-border)] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {busyAction === 'pull' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" strokeWidth={1.75} />
                    ) : (
                      <DownloadCloud className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" strokeWidth={1.75} />
                    )}
                    Load / Pull
                  </button>

                  <button
                    type="button"
                    disabled={isBusy || !repoUrlDraft.trim()}
                    onClick={() =>
                      void onPushToGitHub(repoUrlDraft, branchDraft, commitMessageDraft, token)
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border border-indigo-400/30 shadow-sm disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {busyAction === 'push' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    Commit &amp; Push
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Option 2: Load / Sync By Repository URL */
          <>
            <div className="space-y-1.5">
              <label
                htmlFor="github-repo-url-input"
                className="block text-[12px] font-medium text-[var(--studio-text-strong)]"
              >
                GitHub Repository URL
              </label>
              <input
                id="github-repo-url-input"
                type="text"
                value={repoUrlDraft}
                onChange={(e) => setRepoUrlDraft(e.target.value)}
                placeholder="https://github.com/owner/repo or owner/repo"
                autoFocus
                className="w-full rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-3 py-2 text-[12.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
              <div className="grid grid-cols-2 gap-2 pt-1">
                <BranchSwitcher
                  id="github-branch-input"
                  repoTarget={repoUrlDraft || connection.repoUrl || connection.repoFullName}
                  branch={branchDraft}
                  defaultBranchHint={connection.branch}
                  onChangeBranch={handleBranchSelectionChange}
                  onFetchRepoBranches={onFetchRepoBranches}
                  open={open}
                />
                <div>
                  <label
                    htmlFor="github-commit-msg-input"
                    className="block text-[11px] font-medium text-[var(--studio-muted)] mb-1"
                  >
                    Commit Message
                  </label>
                  <input
                    id="github-commit-msg-input"
                    type="text"
                    value={commitMessageDraft}
                    onChange={(e) => setCommitMessageDraft(e.target.value)}
                    placeholder="Update from Framecraft"
                    className="w-full h-8 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void onPullFromGitHub(repoUrlDraft, branchDraft, token)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[var(--studio-text-strong)] border border-[var(--studio-border)] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {busyAction === 'pull' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" strokeWidth={1.75} />
                ) : (
                  <DownloadCloud className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" strokeWidth={1.75} />
                )}
                Pull Changes
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void onPushToGitHub(repoUrlDraft, branchDraft, commitMessageDraft, token)
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border border-indigo-400/30 shadow-sm disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                {busyAction === 'push' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                Commit &amp; Push
              </button>
            </div>

            {!githubUser && (
              <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAuthSection((prev) => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left text-[11.5px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
                    Private Repo / Push Token (optional)
                  </span>
                  {showAuthSection ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                  )}
                </button>

                {showAuthSection && (
                  <div className="px-3 pb-3 pt-1 space-y-1.5 border-t border-[var(--studio-border-subtle)]">
                    <label
                      htmlFor="github-pat-input"
                      className="block text-[11px] text-[var(--studio-muted)]"
                    >
                      GitHub Personal Access Token (needed only if not signed in via GitHub OAuth;
                      kept in memory for this session only)
                    </label>
                    <input
                      id="github-pat-input"
                      type="password"
                      value={token}
                      onChange={(e) => onChangeToken(e.target.value)}
                      placeholder="ghp_... or github_pat_..."
                      autoComplete="off"
                      className="w-full rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Instant Auto-Sync Option */}
        {(repoUrlDraft.trim() || connection.repoUrl.trim()) && (
          <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[var(--studio-elevated)] border border-[var(--studio-border)] cursor-pointer">
            <div className="flex items-center gap-2 min-w-0">
              <Zap
                className={`w-3.5 h-3.5 shrink-0 ${
                  connection.autoSync
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-[var(--studio-muted)]'
                }`}
                strokeWidth={1.75}
              />
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-[var(--studio-text-strong)]">
                  Instant Auto-Sync Edits
                </div>
                <div className="text-[10.5px] text-[var(--studio-muted)] truncate">
                  Automatically commits edits to GitHub when connected
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={connection.autoSync}
              onChange={(e) => onToggleAutoSync(e.target.checked, repoUrlDraft, branchDraft)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer shrink-0"
            />
          </label>
        )}

        {/* Feedback Status */}
        {statusError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11.5px] text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
            <span className="leading-snug">{statusError}</span>
          </div>
        )}

        {statusMessage && !statusError && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11.5px] text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
            <div className="min-w-0 leading-snug">
              <div>{statusMessage}</div>
              {connection.lastCommitSha && (
                <div className="flex items-center gap-1 mt-1 font-mono-tabular text-[10.5px] opacity-85">
                  <GitCommitHorizontal className="w-3 h-3" />
                  <span>{connection.lastCommitSha.slice(0, 7)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export interface GitHubCommitModalProps {
  open: boolean;
  onClose: () => void;
  connection: GitHubConnectionConfig;
  token: string;
  onChangeToken: (token: string) => void;
  busyAction: 'pull' | 'push' | null;
  statusError: string | null;
  statusMessage: string | null;
  requiresAuthPrompt: boolean;
  githubUser?: GitHubUserProfile | null;
  githubAccountReadOnly?: boolean;
  githubRepos?: GitHubRepoSummary[];
  githubConnecting?: boolean;
  githubOAuthConfigured?: boolean | null;
  onConnectGitHub?: () => Promise<void>;
  onRefreshGitHubRepos?: (overridePatToken?: string) => Promise<void>;
  onFetchRepoBranches?: (owner: string, repo: string) => Promise<string[]>;
  onSwitchBranch?: (branch: string) => void;
  onPullFromGitHub: (repoUrl: string, branch: string, token: string) => Promise<void>;
  onPushToGitHub: (
    repoUrl: string,
    branch: string,
    commitMessage: string,
    token: string
  ) => Promise<void>;
}

export const GitHubCommitModal: React.FC<GitHubCommitModalProps> = ({
  open,
  onClose,
  connection,
  token,
  onChangeToken,
  busyAction,
  statusError,
  statusMessage,
  requiresAuthPrompt,
  githubUser,
  githubAccountReadOnly = false,
  githubRepos = [],
  githubConnecting = false,
  githubOAuthConfigured = null,
  onConnectGitHub,
  onRefreshGitHubRepos,
  onFetchRepoBranches,
  onSwitchBranch,
  onPullFromGitHub,
  onPushToGitHub,
}) => {
  const [repoUrlDraft, setRepoUrlDraft] = useState(connection.repoUrl);
  const [branchDraft, setBranchDraft] = useState(connection.branch);
  const [commitMessageDraft, setCommitMessageDraft] = useState('Update project from Framecraft');
  const [showRepoFields, setShowRepoFields] = useState(!connection.repoUrl.trim());
  const [showTokenField, setShowTokenField] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalFocus(open, panelRef);

  useEffect(() => {
    if (open) {
      setRepoUrlDraft(connection.repoUrl);
      setBranchDraft(connection.branch);
      setShowRepoFields(!connection.repoUrl.trim());
    }
  }, [open, connection.repoUrl, connection.branch]);

  useEffect(() => {
    if (requiresAuthPrompt || githubAccountReadOnly) {
      setShowTokenField(true);
    }
  }, [requiresAuthPrompt, githubAccountReadOnly]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const isBusy = busyAction !== null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-commit-modal-title"
      data-testid="github-commit-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-md studio-modal-panel rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-2xl studio-card-highlight overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--studio-border)] bg-[var(--studio-elevated)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <GitCommitHorizontal
                className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                strokeWidth={1.6}
              />
            </div>
            <div className="min-w-0">
              <h2
                id="github-commit-modal-title"
                className="font-display text-[13.5px] font-semibold text-[var(--studio-text-strong)] leading-tight"
              >
                Commit &amp; Sync Changes
              </h2>
              <p className="text-[11px] text-[var(--studio-muted)] truncate">
                {connection.repoFullName
                  ? `${connection.repoFullName} (${connection.branch || 'main'})`
                  : githubUser
                    ? `Signed in as @${githubUser.login}`
                    : 'Push workspace commits or pull latest upstream updates'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Commit dialog"
            className="p-1 rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5">
          {/* Connected Repo Bar + Instant Branch Switcher */}
          {!showRepoFields && connection.repoUrl.trim() ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)]">
                <div className="flex items-center gap-2 min-w-0">
                  <GitBranch
                    className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                    strokeWidth={1.5}
                  />
                  <span className="text-[12px] font-mono-tabular text-[var(--studio-text-strong)] truncate">
                    {connection.repoFullName || connection.repoUrl}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRepoFields(true)}
                  className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
                >
                  Change repo
                </button>
              </div>
              {onFetchRepoBranches && (
                <BranchSwitcher
                  id="github-commit-active-branch"
                  repoTarget={connection.repoUrl || connection.repoFullName}
                  branch={branchDraft}
                  defaultBranchHint={connection.branch}
                  onChangeBranch={(nextBranch) => {
                    setBranchDraft(nextBranch);
                    onSwitchBranch?.(nextBranch);
                  }}
                  onFetchRepoBranches={onFetchRepoBranches}
                  open={open}
                  compact
                />
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {githubRepos.length > 0 && (
                <div>
                  <label
                    htmlFor="github-commit-repo-select"
                    className="block text-[11.5px] font-medium text-[var(--studio-text-strong)] mb-1"
                  >
                    Select Connected Repository
                  </label>
                  <select
                    id="github-commit-repo-select"
                    value={repoUrlDraft}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRepoUrlDraft(val);
                      const matched = githubRepos.find((r) => r.htmlUrl === val);
                      if (matched) setBranchDraft(matched.defaultBranch || 'main');
                    }}
                    className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Choose a repository...</option>
                    {githubRepos.map((r) => (
                      <option key={r.id} value={r.htmlUrl}>
                        {r.fullName} {r.private ? '(private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="github-commit-repo-input"
                  className="block text-[11.5px] font-medium text-[var(--studio-text-strong)] mb-1"
                >
                  {githubRepos.length > 0 ? 'Or Repository URL' : 'GitHub Repository URL'}
                </label>
                <input
                  id="github-commit-repo-input"
                  type="text"
                  value={repoUrlDraft}
                  onChange={(e) => setRepoUrlDraft(e.target.value)}
                  placeholder="https://github.com/owner/repo or owner/repo"
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] px-3 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
              {onFetchRepoBranches ? (
                <BranchSwitcher
                  id="github-commit-branch-input"
                  repoTarget={repoUrlDraft || connection.repoUrl || connection.repoFullName}
                  branch={branchDraft}
                  defaultBranchHint={connection.branch}
                  onChangeBranch={(nextBranch) => {
                    setBranchDraft(nextBranch);
                    if (
                      connection.repoFullName &&
                      repoUrlDraft.trim().toLowerCase().includes(connection.repoFullName.toLowerCase())
                    ) {
                      onSwitchBranch?.(nextBranch);
                    }
                  }}
                  onFetchRepoBranches={onFetchRepoBranches}
                  open={open}
                />
              ) : (
                <div>
                  <label
                    htmlFor="github-commit-branch-input"
                    className="block text-[11px] font-medium text-[var(--studio-muted)] mb-1"
                  >
                    Branch (optional)
                  </label>
                  <input
                    id="github-commit-branch-input"
                    type="text"
                    value={branchDraft}
                    onChange={(e) => setBranchDraft(e.target.value)}
                    placeholder="default (main)"
                    className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  />
                </div>
              )}
            </div>
          )}

          {/* Commit Message Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="github-commit-modal-message"
                className="block text-[12px] font-medium text-[var(--studio-text-strong)]"
              >
                Commit Message
              </label>
              <span className="text-[10.5px] text-[var(--studio-muted-soft)]">
                Ctrl/Cmd + Enter to push
              </span>
            </div>
            <textarea
              id="github-commit-modal-message"
              rows={2}
              value={commitMessageDraft}
              onChange={(e) => setCommitMessageDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isBusy) {
                  e.preventDefault();
                  void onPushToGitHub(repoUrlDraft, branchDraft, commitMessageDraft, token);
                }
              }}
              placeholder="Describe the changes in this commit..."
              autoFocus
              className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] px-3 py-2 text-[12.5px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 resize-none"
            />
          </div>

          {/* Auth Status or Optional PAT */}
          {githubUser && !githubAccountReadOnly && !requiresAuthPrompt ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-[11.5px] text-emerald-700 dark:text-emerald-300">
              <span>Authorized via GitHub as @{githubUser.login}</span>
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            </div>
          ) : (
            <div className="space-y-2">
              {githubUser && githubAccountReadOnly && (
                <div className="px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-800 dark:text-amber-200">
                  Browsing @{githubUser.login} in public read-only mode — sign in or paste a token to push.
                </div>
              )}
              {onConnectGitHub && githubOAuthConfigured === true && (
                <button
                  type="button"
                  disabled={githubConnecting}
                  onClick={() => void onConnectGitHub()}
                  className="w-full h-8 rounded-xl border border-indigo-500/35 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 text-indigo-700 dark:text-indigo-300 text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {githubConnecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitBranch className="w-3.5 h-3.5" />
                  )}
                  {githubConnecting ? 'Authorizing with GitHub...' : 'Connect GitHub Account to Push'}
                </button>
              )}
              <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTokenField((prev) => !prev)}
                  className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[11.5px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
                    Personal Access Token {token.trim() ? '(set)' : ''}
                  </span>
                  {showTokenField ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
                  )}
                </button>
                {showTokenField && (
                  <div className="px-3 pb-2.5 pt-1.5 border-t border-[var(--studio-border-subtle)] space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--studio-muted)]">
                      <span>Requires repo / Contents write access</span>
                      <a
                        href="https://github.com/settings/tokens/new?description=Framecraft+Studio&scopes=repo,read:user"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-indigo-500 dark:text-indigo-400 hover:underline shrink-0"
                      >
                        <span>Get token</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        id="github-commit-pat-input"
                        type="password"
                        aria-label="GitHub Access Token"
                        value={token}
                        onChange={(e) => onChangeToken(e.target.value)}
                        placeholder="ghp_... or github_pat_..."
                        autoComplete="off"
                        className="flex-1 min-w-0 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                      />
                      {onRefreshGitHubRepos && (
                        <button
                          type="button"
                          disabled={!token.trim()}
                          onClick={() => void onRefreshGitHubRepos(token)}
                          className="h-8 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Feedback Status */}
          {statusError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-[11.5px] text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
              <span className="leading-snug">{statusError}</span>
            </div>
          )}

          {statusMessage && !statusError && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-[11.5px] text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.6} />
              <div className="min-w-0 leading-snug">
                <div>{statusMessage}</div>
                {connection.lastCommitSha && (
                  <div className="flex items-center gap-1 mt-1 font-mono-tabular text-[10.5px] opacity-85">
                    <GitCommitHorizontal className="w-3 h-3" />
                    <span>{connection.lastCommitSha.slice(0, 7)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Two Distinct Footer Buttons: Pull Latest & Commit & Push */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onPullFromGitHub(repoUrlDraft, branchDraft, token)}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[var(--studio-text-strong)] border border-[var(--studio-border)] disabled:opacity-50 studio-pressable cursor-pointer whitespace-nowrap"
            >
              {busyAction === 'pull' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-600 dark:text-cyan-400" strokeWidth={1.6} />
              ) : (
                <DownloadCloud className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.6} />
              )}
              Pull Latest
            </button>

            <button
              type="button"
              disabled={isBusy || !commitMessageDraft.trim()}
              onClick={() =>
                void onPushToGitHub(repoUrlDraft, branchDraft, commitMessageDraft, token)
              }
              className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/30 shadow-sm disabled:opacity-50 studio-pressable cursor-pointer whitespace-nowrap"
            >
              {busyAction === 'push' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />
              ) : (
                <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.6} />
              )}
              Commit &amp; Push
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

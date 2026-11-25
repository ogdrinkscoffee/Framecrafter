import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  GitCommitHorizontal,
  Lock,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  X,
  Zap,
} from 'lucide-react';
import type { GitHubConnectionConfig } from '../utils/githubSync';

export interface GitHubSyncPopoverProps {
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
}) => {
  const [repoUrlDraft, setRepoUrlDraft] = useState(connection.repoUrl);
  const [branchDraft, setBranchDraft] = useState(connection.branch);
  const [commitMessageDraft, setCommitMessageDraft] = useState('Update project from Framecraft');
  const [showAuthSection, setShowAuthSection] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setRepoUrlDraft(connection.repoUrl);
      setBranchDraft(connection.branch);
    }
  }, [open, connection.repoUrl, connection.branch]);

  useEffect(() => {
    if (requiresAuthPrompt) {
      setShowAuthSection(true);
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

  if (!open) return null;

  const isBusy = busyAction !== null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Sync to GitHub"
      data-testid="github-sync-popover"
      className="absolute right-0 top-full mt-2 w-[390px] max-w-[calc(100vw-24px)] z-50 rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-2xl studio-card-highlight overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--studio-border)] bg-[var(--studio-elevated)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-[13.5px] font-semibold text-[var(--studio-text-strong)] leading-tight">
              Sync to GitHub
            </h2>
            <p className="text-[11px] text-[var(--studio-muted)] truncate">
              {connection.repoFullName
                ? `Connected: ${connection.repoFullName} (${connection.branch || 'main'})`
                : 'Enter any GitHub URL — no key needed to pull public repos'}
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

      {/* Body */}
      <div className="p-4 space-y-3.5 max-h-[76vh] overflow-y-auto builder-scroll">
        {/* Repository URL Input (No key needed) */}
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
            <div>
              <label
                htmlFor="github-branch-input"
                className="block text-[11px] font-medium text-[var(--studio-muted)] mb-1"
              >
                Branch (optional)
              </label>
              <input
                id="github-branch-input"
                type="text"
                value={branchDraft}
                onChange={(e) => setBranchDraft(e.target.value)}
                placeholder="default (main)"
                className="w-full rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
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
                className="w-full rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
          </div>
        </div>

        {/* Two Primary Actions: Pull & Commit/Push */}
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

        {/* Instant Auto-Sync Option */}
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
                Automatically commits edits to GitHub when token is set
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

        {/* Optional Private Repo / Push Token Section (Collapsed unless needed) */}
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
                GitHub Personal Access Token (needed only for private pulls or pushing commits; kept
                in memory for this session only)
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
  onPullFromGitHub,
  onPushToGitHub,
}) => {
  const [repoUrlDraft, setRepoUrlDraft] = useState(connection.repoUrl);
  const [branchDraft, setBranchDraft] = useState(connection.branch);
  const [commitMessageDraft, setCommitMessageDraft] = useState('Update project from Framecraft');
  const [showRepoFields, setShowRepoFields] = useState(!connection.repoUrl.trim());
  const [showTokenField, setShowTokenField] = useState(false);

  useEffect(() => {
    if (open) {
      setRepoUrlDraft(connection.repoUrl);
      setBranchDraft(connection.branch);
      setShowRepoFields(!connection.repoUrl.trim());
    }
  }, [open, connection.repoUrl, connection.branch]);

  useEffect(() => {
    if (requiresAuthPrompt) {
      setShowTokenField(true);
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
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const isBusy = busyAction !== null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-commit-modal-title"
      data-testid="github-commit-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] text-[var(--studio-text)] shadow-2xl studio-card-highlight overflow-hidden">
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
          {/* Connected Repo Bar or Editable Repo Inputs */}
          {!showRepoFields && connection.repoUrl.trim() ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)]">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch
                  className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0"
                  strokeWidth={1.5}
                />
                <span className="text-[12px] font-mono-tabular text-[var(--studio-text-strong)] truncate">
                  {connection.repoFullName || connection.repoUrl}
                </span>
                <span className="text-[11px] font-mono-tabular text-[var(--studio-muted)] shrink-0">
                  · {connection.branch || 'main'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRepoFields(true)}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 cursor-pointer"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label
                  htmlFor="github-commit-repo-input"
                  className="block text-[11.5px] font-medium text-[var(--studio-text-strong)] mb-1"
                >
                  GitHub Repository URL
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

          {/* Optional Private Repo / Push Token Expander */}
          <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTokenField((prev) => !prev)}
              className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[11.5px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
                GitHub Access Token {token.trim() ? '(set)' : '(needed to push)'}
              </span>
              {showTokenField ? (
                <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)]" />
              )}
            </button>
            {showTokenField && (
              <div className="px-3 pb-2.5 pt-1.5 border-t border-[var(--studio-border-subtle)] space-y-1">
                <input
                  id="github-commit-pat-input"
                  type="password"
                  aria-label="GitHub Access Token"
                  value={token}
                  onChange={(e) => onChangeToken(e.target.value)}
                  placeholder="ghp_... or github_pat_..."
                  autoComplete="off"
                  className="w-full rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
            )}
          </div>

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


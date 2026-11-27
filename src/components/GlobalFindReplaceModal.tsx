import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Replace,
  Search,
  X,
} from 'lucide-react';
import type { ProjectFile } from '../types/editor';
import {
  type FindReplaceScopeFilter,
  searchAllProjectFiles,
} from '../utils/globalFindReplace';

interface GlobalFindReplaceModalProps {
  open: boolean;
  onClose: () => void;
  files: ProjectFile[];
  onExecuteBulkReplace: (params: {
    query: string;
    replacement: string;
    matchCase: boolean;
    wholeWord: boolean;
    useRegex: boolean;
    scope: FindReplaceScopeFilter;
    targetPaths?: Set<string>;
  }) => { replacedCount: number; modifiedFilePaths: string[]; error: string | null };
  onOpenFileAtLine: (path: string, lineNumber: number) => void;
}

const SCOPE_TABS: Array<{ id: FindReplaceScopeFilter; label: string }> = [
  { id: 'all', label: 'All Files' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'js', label: 'JS / TS' },
  { id: 'other', label: 'JSON / Other' },
];

export const GlobalFindReplaceModal: React.FC<GlobalFindReplaceModalProps> = ({
  open,
  onClose,
  files,
  onExecuteBulkReplace,
  onOpenFileAtLine,
}) => {
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [scope, setScope] = useState<FindReplaceScopeFilter>('all');
  const [excludedPaths, setExcludedPaths] = useState<Record<string, boolean>>({});
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [lastReplaceSummary, setLastReplaceSummary] = useState<{
    replacedCount: number;
    fileCount: number;
  } | null>(null);

  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLastReplaceSummary(null);
    window.setTimeout(() => findInputRef.current?.focus(), 15);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const searchResult = useMemo(
    () =>
      searchAllProjectFiles(files, query, {
        matchCase,
        wholeWord,
        useRegex,
        scope,
      }),
    [files, query, matchCase, wholeWord, useRegex, scope]
  );

  // Clear stale exclusions whenever search query or scope changes
  useEffect(() => {
    setExcludedPaths({});
  }, [query, scope, matchCase, wholeWord, useRegex]);

  const selectedFileMatches = useMemo(
    () => searchResult.fileMatches.filter((m) => !excludedPaths[m.file.path]),
    [searchResult.fileMatches, excludedPaths]
  );

  const selectedMatchTotal = useMemo(
    () => selectedFileMatches.reduce((acc, item) => acc + item.totalMatches, 0),
    [selectedFileMatches]
  );

  if (!open) return null;

  const toggleFileIncluded = (path: string) => {
    setExcludedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleFileCollapsed = (path: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const handleBulkReplace = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query || selectedFileMatches.length === 0 || searchResult.error) return;

    const allIncluded = selectedFileMatches.length === searchResult.fileMatches.length;
    const targetPaths = allIncluded
      ? undefined
      : new Set(selectedFileMatches.map((m) => m.file.path));

    const result = onExecuteBulkReplace({
      query,
      replacement,
      matchCase,
      wholeWord,
      useRegex,
      scope,
      targetPaths,
    });

    if (!result.error && result.replacedCount > 0) {
      setLastReplaceSummary({
        replacedCount: result.replacedCount,
        fileCount: result.modifiedFilePaths.length,
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Global Find and Replace"
      data-testid="global-find-replace-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl studio-card-highlight overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--studio-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/12 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <Replace className="w-4 h-4 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-[var(--studio-text-strong)] truncate">
                Global Find &amp; Replace
              </h2>
              <p className="text-[11.5px] text-[var(--studio-muted)] truncate">
                Search and bulk replace across all {files.length} project{' '}
                {files.length === 1 ? 'file' : 'files'} · Ctrl/Cmd+Z to undo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Global Find and Replace"
            className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>

        {/* Inputs & Filters */}
        <form
          onSubmit={handleBulkReplace}
          className="px-5 py-3.5 border-b border-[var(--studio-border)] bg-[var(--studio-elevated)] space-y-2.5 shrink-0"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Find Input */}
            <div className="relative flex items-center">
              <Search
                className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                ref={findInputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLastReplaceSummary(null);
                }}
                placeholder="Find text or pattern across files..."
                aria-label="Global Find text"
                className="w-full h-9 pl-8 pr-28 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] text-[12.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
              <div className="absolute right-1.5 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setMatchCase((prev) => !prev)}
                  aria-pressed={matchCase}
                  title="Match Case"
                  className={`h-6 px-1.5 rounded text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer ${
                    matchCase
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                  }`}
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setWholeWord((prev) => !prev)}
                  aria-pressed={wholeWord}
                  title="Match Whole Word"
                  className={`h-6 px-1.5 rounded text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer ${
                    wholeWord
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                  }`}
                >
                  \b
                </button>
                <button
                  type="button"
                  onClick={() => setUseRegex((prev) => !prev)}
                  aria-pressed={useRegex}
                  title="Use Regular Expression"
                  className={`h-6 px-1.5 rounded text-[11px] font-mono-tabular font-semibold transition-colors cursor-pointer ${
                    useRegex
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                  }`}
                >
                  .*
                </button>
              </div>
            </div>

            {/* Replace Input + Action */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0 flex items-center">
                <Replace
                  className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={replacement}
                  onChange={(e) => {
                    setReplacement(e.target.value);
                    setLastReplaceSummary(null);
                  }}
                  placeholder="Replace with..."
                  aria-label="Global Replace text"
                  className="w-full h-9 pl-8 pr-3 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] text-[12.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>

              <button
                type="submit"
                disabled={!query || selectedMatchTotal === 0 || Boolean(searchResult.error)}
                className="h-9 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-45 disabled:cursor-not-allowed text-[12px] font-semibold text-white whitespace-nowrap shrink-0 studio-pressable cursor-pointer"
              >
                {selectedFileMatches.length === searchResult.fileMatches.length
                  ? `Replace All (${selectedMatchTotal})`
                  : `Replace (${selectedMatchTotal})`}
              </button>
            </div>
          </div>

          {/* Scope Tabs & Selection Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)]"
              role="group"
              aria-label="File Type Scope"
            >
              {SCOPE_TABS.map((tab) => {
                const active = scope === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScope(tab.id)}
                    aria-pressed={active}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                        : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[var(--studio-muted)] font-mono-tabular">
              {query && !searchResult.error && (
                <span>
                  {searchResult.totalMatches.toLocaleString()}{' '}
                  {searchResult.totalMatches === 1 ? 'match' : 'matches'} ·{' '}
                  {searchResult.totalFilesMatched}{' '}
                  {searchResult.totalFilesMatched === 1 ? 'file' : 'files'}
                </span>
              )}
              {searchResult.fileMatches.length > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExcludedPaths({})}
                    className="text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      for (const m of searchResult.fileMatches) next[m.file.path] = true;
                      setExcludedPaths(next);
                    }}
                    className="text-[var(--studio-muted)] hover:underline cursor-pointer"
                  >
                    None
                  </button>
                </div>
              )}
            </div>
          </div>

          {searchResult.error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11.5px] text-rose-600 dark:text-rose-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Regex error: {searchResult.error}</span>
            </div>
          )}

          {lastReplaceSummary && (
            <div
              role="status"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11.5px] text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                Replaced{' '}
                <strong className="font-mono-tabular">
                  {lastReplaceSummary.replacedCount.toLocaleString()}
                </strong>{' '}
                {lastReplaceSummary.replacedCount === 1 ? 'occurrence' : 'occurrences'} across{' '}
                <strong className="font-mono-tabular">{lastReplaceSummary.fileCount}</strong>{' '}
                {lastReplaceSummary.fileCount === 1 ? 'file' : 'files'}.
              </span>
            </div>
          )}
        </form>

        {/* Results & Live Diff Preview */}
        <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-2.5 bg-[var(--studio-bg)]">
          {!query ? (
            <div className="py-12 text-center space-y-1.5">
              <p className="text-xs font-medium text-[var(--studio-text)]">
                Enter a search term to scan all files in this workspace.
              </p>
              <p className="text-[11px] text-[var(--studio-muted-soft)]">
                Supports case sensitivity, whole words, regex patterns, per-file selection, and live replacement previews.
              </p>
            </div>
          ) : searchResult.error ? null : searchResult.fileMatches.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--studio-muted)]">
              No matches found for &ldquo;{query}&rdquo; in the selected scope.
            </div>
          ) : (
            searchResult.fileMatches.map((fileMatch) => {
              const isIncluded = !excludedPaths[fileMatch.file.path];
              const isCollapsed = Boolean(collapsedFiles[fileMatch.file.path]);

              return (
                <div
                  key={fileMatch.file.path}
                  className={`rounded-xl border transition-colors overflow-hidden ${
                    isIncluded
                      ? 'bg-[var(--studio-surface)] border-[var(--studio-border)]'
                      : 'bg-[var(--studio-surface)]/50 border-[var(--studio-border-subtle)] opacity-65'
                  }`}
                >
                  {/* File Header Row */}
                  <div className="px-3 py-2 border-b border-[var(--studio-border-subtle)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleFileIncluded(fileMatch.file.path)}
                        aria-label={`Include ${fileMatch.file.path} in replacement`}
                        aria-pressed={isIncluded}
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          isIncluded
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-[var(--studio-input)] border-[var(--studio-border-strong)] text-transparent'
                        }`}
                      >
                        <Check className="w-3 h-3" strokeWidth={2.2} />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFileCollapsed(fileMatch.file.path)}
                        className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0" />
                        )}
                        <FileCode2
                          className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="text-[12px] font-semibold text-[var(--studio-text-strong)] truncate">
                          {fileMatch.file.path}
                        </span>
                      </button>
                    </div>

                    <span className="text-[11px] font-mono-tabular text-[var(--studio-muted)] shrink-0">
                      {fileMatch.totalMatches}{' '}
                      {fileMatch.totalMatches === 1 ? 'match' : 'matches'}
                    </span>
                  </div>

                  {/* Line Matches */}
                  {!isCollapsed && (
                    <div className="divide-y divide-[var(--studio-border-subtle)]">
                      {fileMatch.lineMatches.map((line) => (
                        <button
                          key={`${fileMatch.file.path}-L${line.lineNumber}`}
                          type="button"
                          onClick={() => {
                            onOpenFileAtLine(fileMatch.file.path, line.lineNumber);
                            onClose();
                          }}
                          title="Open in Code Editor"
                          className="w-full px-3 py-1.5 flex items-baseline gap-2.5 text-left hover:bg-[var(--studio-hover)]/50 transition-colors cursor-pointer"
                        >
                          <span className="text-[11px] font-mono-tabular text-indigo-600 dark:text-indigo-400 w-10 shrink-0 text-right">
                            L{line.lineNumber}
                          </span>
                          <span className="flex-1 min-w-0 text-[11.5px] font-mono-tabular text-[var(--studio-text)] truncate">
                            {line.segments.map((seg, idx) => {
                              if (!seg.isMatch) {
                                return <React.Fragment key={idx}>{seg.text}</React.Fragment>;
                              }
                              if (replacement.length > 0) {
                                return (
                                  <span key={idx} className="inline-flex items-baseline gap-1">
                                    <mark className="px-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 line-through">
                                      {seg.text}
                                    </mark>
                                    <span className="px-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                                      {replacement}
                                    </span>
                                  </span>
                                );
                              }
                              return (
                                <mark
                                  key={idx}
                                  className="px-0.5 rounded bg-amber-400/30 text-[var(--studio-text-strong)] font-semibold"
                                >
                                  {seg.text}
                                </mark>
                              );
                            })}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Clock,
  History,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import type { HistoryState } from '../types/editor';
import { getHistoryTimeline } from '../utils/historyManager';

interface HistoryTimelinePanelProps {
  history: HistoryState;
  onUndo: () => void;
  onRedo: () => void;
  onJumpToIndex: (index: number) => void;
}

function formatSnapshotTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export const HistoryTimelinePanel: React.FC<HistoryTimelinePanelProps> = ({
  history,
  onUndo,
  onRedo,
  onJumpToIndex,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const timeline = useMemo(() => getHistoryTimeline(history), [history]);

  // Display newest / future states at the top down to the initial project state
  const orderedEntries = useMemo(() => {
    const reversed = [...timeline].reverse();
    const q = filterQuery.trim().toLowerCase();
    if (!q) return reversed;
    return reversed.filter((entry) =>
      entry.snapshot.label.toLowerCase().includes(q)
    );
  }, [timeline, filterQuery]);

  const totalCount = timeline.length;
  const currentIndex = history.past.length;

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      data-testid="history-timeline-panel"
    >
      {/* Controls Bar */}
      <div className="px-3 py-2.5 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <History
              className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0"
              strokeWidth={1.6}
            />
            <span className="text-[12px] font-semibold text-[var(--studio-text-strong)] truncate">
              History Timeline
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onUndo}
              disabled={history.past.length === 0}
              title="Step Back (Ctrl+Z)"
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium text-[var(--studio-text-strong)] cursor-pointer"
            >
              <Undo2 className="w-3 h-3" strokeWidth={1.5} />
              Undo
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={history.future.length === 0}
              title="Step Forward (Ctrl+Shift+Z)"
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium text-[var(--studio-text-strong)] cursor-pointer"
            >
              <Redo2 className="w-3 h-3" strokeWidth={1.5} />
              Redo
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--studio-muted)] font-mono-tabular">
          <span>
            State {currentIndex + 1} / {totalCount}
          </span>
          <span>
            {history.past.length} back · {history.future.length} forward
          </span>
        </div>

        {totalCount > 4 && (
          <div className="relative flex items-center">
            <Search
              className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
              strokeWidth={1.4}
            />
            <input
              type="text"
              aria-label="Filter history snapshots"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter edit history..."
              className="w-full h-7 bg-[var(--studio-input)] border border-[var(--studio-border)] rounded-md pl-7.5 pr-7 text-[11.5px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="Clear history filter"
                className="absolute right-1.5 p-0.5 text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Visual Timeline List */}
      <div className="flex-1 overflow-y-auto builder-scroll p-3">
        {orderedEntries.length === 0 ? (
          <div className="py-10 text-center text-xs text-[var(--studio-muted-soft)]">
            No history states match &ldquo;{filterQuery.trim()}&rdquo;.
          </div>
        ) : (
          <div className="relative pl-5 space-y-1.5">
            {/* Vertical Timeline Rail */}
            <div
              aria-hidden="true"
              className="absolute left-[7px] top-3 bottom-3 w-px bg-[var(--studio-border-strong)]"
            />

            {orderedEntries.map((entry) => {
              const isPresent = entry.status === 'present';
              const isFuture = entry.status === 'future';
              const isInitial = entry.index === 0;

              return (
                <button
                  key={`${entry.index}-${entry.snapshot.timestamp}`}
                  type="button"
                  data-testid={`history-entry-${entry.index}`}
                  aria-current={isPresent ? 'step' : undefined}
                  onClick={() => onJumpToIndex(entry.index)}
                  className={`group relative w-full text-left rounded-lg border px-2.5 py-2 transition-colors cursor-pointer ${
                    isPresent
                      ? 'bg-indigo-500/12 border-indigo-500/50 text-[var(--studio-text-strong)]'
                      : isFuture
                        ? 'bg-[var(--studio-bg)]/70 border-dashed border-[var(--studio-border)] text-[var(--studio-muted)] hover:bg-[var(--studio-elevated)] hover:text-[var(--studio-text-strong)] opacity-80 hover:opacity-100'
                        : 'bg-[var(--studio-elevated)]/70 border-[var(--studio-border)] text-[var(--studio-text)] hover:bg-[var(--studio-hover)]/70 hover:border-[var(--studio-border-strong)]'
                  }`}
                >
                  {/* Timeline Node Marker */}
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[18px] top-3 w-2.5 h-2.5 rounded-full border transition-transform ${
                      isPresent
                        ? 'bg-indigo-500 border-indigo-300 ring-2 ring-indigo-500/25 scale-110'
                        : isFuture
                          ? 'bg-[var(--studio-surface)] border-dashed border-[var(--studio-muted)]'
                          : isInitial
                            ? 'bg-emerald-500/80 border-emerald-300'
                            : 'bg-[var(--studio-muted-soft)] border-[var(--studio-surface)] group-hover:bg-indigo-400'
                    }`}
                  />

                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold leading-snug truncate">
                        {entry.snapshot.label}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-mono-tabular text-[var(--studio-muted-soft)]">
                        <span>#{entry.index + 1}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                          {formatSnapshotTime(entry.snapshot.timestamp)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {isInitial
                            ? `${entry.fileCount} ${entry.fileCount === 1 ? 'file' : 'files'}`
                            : `${entry.changedFileCount} changed`}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10.5px] font-semibold shrink-0 pt-0.5">
                      {isPresent ? (
                        <span className="text-indigo-600 dark:text-indigo-400">Active</span>
                      ) : (
                        <span className="opacity-0 group-hover:opacity-100 text-indigo-500 dark:text-indigo-400 inline-flex items-center gap-0.5 transition-opacity">
                          <RotateCcw className="w-2.5 h-2.5" strokeWidth={1.7} />
                          {isFuture ? 'Restore' : 'Jump'}
                        </span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Tip */}
      {history.past.length > 0 && (
        <div className="px-3 py-2 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] flex items-center justify-between text-[11px] text-[var(--studio-muted)] shrink-0">
          <span>Click any step to jump directly</span>
          <button
            type="button"
            onClick={() => onJumpToIndex(0)}
            className="text-indigo-500 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
          >
            Jump to Start
          </button>
        </div>
      )}
    </div>
  );
};

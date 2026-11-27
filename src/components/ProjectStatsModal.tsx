import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Code2, FileCode2, Files, HardDrive, X } from 'lucide-react';
import type { ProjectFile } from '../types/editor';
import {
  computeProjectStatistics,
  formatBytesCompact,
  type StatsDistributionKey,
} from '../utils/projectStats';

interface ProjectStatsModalProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  files: ProjectFile[];
  onOpenFile?: (path: string) => void;
}

type DistributionMetric = 'lines' | 'files';

export const ProjectStatsModal: React.FC<ProjectStatsModalProps> = ({
  open,
  onClose,
  projectName,
  files,
  onOpenFile,
}) => {
  const [metric, setMetric] = useState<DistributionMetric>('lines');
  const [hoveredKey, setHoveredKey] = useState<StatsDistributionKey | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const stats = useMemo(() => computeProjectStatistics(files), [files]);

  const activeMetricTotal =
    metric === 'lines' ? stats.totalLinesOfCode : stats.totalFiles;

  const donutSlices = useMemo(() => {
    const radius = 74;
    const circumference = 2 * Math.PI * radius;
    const nonZero = stats.distribution.filter((item) =>
      metric === 'lines' ? item.lineCount > 0 : item.fileCount > 0
    );

    if (activeMetricTotal <= 0 || nonZero.length === 0) {
      return [];
    }

    const gapPx = nonZero.length > 1 ? 3 : 0;
    let offsetAccum = 0;

    return nonZero.map((item) => {
      const value = metric === 'lines' ? item.lineCount : item.fileCount;
      const ratio = value / activeMetricTotal;
      const rawLength = ratio * circumference;
      const dashLength = Math.max(2, rawLength - gapPx);
      const dashOffset = -offsetAccum;
      offsetAccum += rawLength;

      return {
        ...item,
        value,
        percent: metric === 'lines' ? item.linePercent : item.filePercent,
        dashArray: `${dashLength} ${circumference}`,
        dashOffset,
      };
    });
  }, [stats.distribution, metric, activeMetricTotal]);

  const focusedSlice = useMemo(() => {
    if (!hoveredKey) return null;
    return stats.distribution.find((item) => item.key === hoveredKey) ?? null;
  }, [hoveredKey, stats.distribution]);

  if (!open) return null;

  const focusedValue = focusedSlice
    ? metric === 'lines'
      ? focusedSlice.lineCount
      : focusedSlice.fileCount
    : activeMetricTotal;

  const focusedLabel = focusedSlice
    ? focusedSlice.shortLabel
    : metric === 'lines'
      ? 'Total LOC'
      : 'Total Files';

  const focusedSubLabel = focusedSlice
    ? `${metric === 'lines' ? focusedSlice.linePercent : focusedSlice.filePercent}% share`
    : `${stats.codeFileCount} code · ${stats.assetFileCount} asset`;

  const maxLargestLoc = stats.largestFiles[0]?.lineCount || 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Project Statistics"
      data-testid="project-stats-modal"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl studio-card-highlight overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--studio-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/12 border border-indigo-500/25 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold text-[var(--studio-text-strong)] truncate">
                Project Statistics
              </h2>
              <p className="text-[11.5px] text-[var(--studio-muted)] truncate">
                {projectName} · {stats.totalFiles} {stats.totalFiles === 1 ? 'file' : 'files'} ·{' '}
                <span className="font-mono-tabular">
                  {stats.totalLinesOfCode.toLocaleString()} LOC
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="inline-flex items-center p-0.5 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)]"
              role="group"
              aria-label="Chart Metric"
            >
              <button
                type="button"
                onClick={() => setMetric('lines')}
                aria-pressed={metric === 'lines'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  metric === 'lines'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                }`}
              >
                Lines of Code
              </button>
              <button
                type="button"
                onClick={() => setMetric('files')}
                aria-pressed={metric === 'files'}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  metric === 'files'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                }`}
              >
                File Count
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Project Statistics"
              className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto builder-scroll p-5 space-y-5">
          {/* Top Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--studio-border)]">
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--studio-muted)]">
                <Files className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
                Total Files
              </div>
              <div
                data-testid="stats-total-files"
                className="mt-1.5 text-2xl font-bold font-mono-tabular text-[var(--studio-text-strong)]"
              >
                {stats.totalFiles.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--studio-muted-soft)] font-mono-tabular">
                {stats.codeFileCount} source · {stats.assetFileCount} binary/assets
              </div>
            </div>

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--studio-muted)]">
                <Code2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" strokeWidth={1.5} />
                Total Lines of Code
              </div>
              <div
                data-testid="stats-total-loc"
                className="mt-1.5 text-2xl font-bold font-mono-tabular text-[var(--studio-text-strong)]"
              >
                {stats.totalLinesOfCode.toLocaleString()}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--studio-muted-soft)] font-mono-tabular">
                ~{stats.avgLinesPerCodeFile} avg lines / source file
              </div>
            </div>

            <div className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[var(--studio-muted)]">
                <HardDrive className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" strokeWidth={1.5} />
                Workspace Size
              </div>
              <div
                data-testid="stats-total-size"
                className="mt-1.5 text-2xl font-bold font-mono-tabular text-[var(--studio-text-strong)]"
              >
                {stats.formattedSize}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--studio-muted-soft)] font-mono-tabular">
                {stats.extensionBreakdown.length}{' '}
                {stats.extensionBreakdown.length === 1 ? 'extension' : 'extensions'}
              </div>
            </div>
          </div>

          {/* Distribution Visualization Section */}
          <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--studio-border)]">
              <div>
                <h3 className="text-[12.5px] font-semibold text-[var(--studio-text-strong)]">
                  File Type Distribution (HTML / CSS / JS)
                </h3>
                <p className="text-[11px] text-[var(--studio-muted)]">
                  Hover a segment or row to inspect share by{' '}
                  {metric === 'lines' ? 'lines of code' : 'file count'}.
                </p>
              </div>
              <span className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)]">
                {metric === 'lines'
                  ? `${stats.totalLinesOfCode.toLocaleString()} total lines`
                  : `${stats.totalFiles.toLocaleString()} total files`}
              </span>
            </div>

            {stats.totalFiles === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--studio-muted)]">
                No project files loaded yet. Load a template or folder to view file type metrics.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-center">
                {/* Donut Chart */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg
                      viewBox="0 0 220 220"
                      className="w-full h-full -rotate-90"
                      role="img"
                      aria-label="File type distribution donut chart"
                    >
                      <circle
                        cx="110"
                        cy="110"
                        r="74"
                        fill="none"
                        stroke="var(--studio-hover)"
                        strokeWidth="24"
                        opacity="0.45"
                      />
                      {donutSlices.map((slice) => {
                        const isHovered = hoveredKey === slice.key;
                        const isDimmed = hoveredKey !== null && !isHovered;
                        return (
                          <circle
                            key={slice.key}
                            cx="110"
                            cy="110"
                            r="74"
                            fill="none"
                            stroke={slice.color}
                            strokeWidth={isHovered ? 28 : 24}
                            strokeDasharray={slice.dashArray}
                            strokeDashoffset={slice.dashOffset}
                            opacity={isDimmed ? 0.32 : 1}
                            onMouseEnter={() => setHoveredKey(slice.key)}
                            onMouseLeave={() => setHoveredKey(null)}
                            className="transition-all duration-150 cursor-pointer"
                          >
                            <title>
                              {slice.label}: {slice.value.toLocaleString()} ({slice.percent}%)
                            </title>
                          </circle>
                        );
                      })}
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
                      <span className="text-[10.5px] uppercase tracking-wider font-semibold text-[var(--studio-muted)]">
                        {focusedLabel}
                      </span>
                      <span className="text-xl font-bold font-mono-tabular text-[var(--studio-text-strong)] leading-tight mt-0.5">
                        {focusedValue.toLocaleString()}
                      </span>
                      <span className="text-[10.5px] font-mono-tabular text-[var(--studio-muted-soft)] mt-0.5">
                        {focusedSubLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Comparative Bar Breakdown */}
                <div className="space-y-2.5" data-testid="stats-distribution-bars">
                  {stats.distribution.map((item) => {
                    const value = metric === 'lines' ? item.lineCount : item.fileCount;
                    const percent = metric === 'lines' ? item.linePercent : item.filePercent;
                    const isHighlighted = hoveredKey === item.key;

                    return (
                      <div
                        key={item.key}
                        onMouseEnter={() => setHoveredKey(item.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        className={`rounded-lg px-3 py-2 border transition-colors ${
                          isHighlighted
                            ? 'bg-[var(--studio-elevated)] border-[var(--studio-border-strong)]'
                            : 'bg-[var(--studio-surface)]/70 border-[var(--studio-border)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[12px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-[var(--studio-text-strong)] truncate">
                              {item.label}
                            </span>
                            <span className="text-[11px] text-[var(--studio-muted-soft)] font-mono-tabular">
                              {item.fileCount} {item.fileCount === 1 ? 'file' : 'files'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0 font-mono-tabular">
                            <span className="text-[11.5px] text-[var(--studio-text)]">
                              {metric === 'lines'
                                ? `${value.toLocaleString()} lines`
                                : `${value} ${value === 1 ? 'file' : 'files'}`}
                            </span>
                            <span className="w-12 text-right text-[11.5px] font-semibold text-[var(--studio-text-strong)]">
                              {percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-[var(--studio-hover)]/75 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${value > 0 ? Math.max(2, percent) : 0}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Largest Source Files Table */}
          {stats.largestFiles.length > 0 && (
            <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-bg)] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--studio-border)] flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[var(--studio-text-strong)]">
                  Largest Source Files
                </span>
                <span className="text-[11px] text-[var(--studio-muted-soft)]">
                  Click any file to inspect in Code Editor
                </span>
              </div>
              <div className="divide-y divide-[var(--studio-border)]">
                {stats.largestFiles.map((file) => {
                  const barPct = Math.max(
                    4,
                    Math.round((file.lineCount / maxLargestLoc) * 100)
                  );
                  return (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => {
                        onOpenFile?.(file.path);
                        onClose();
                      }}
                      className="w-full px-4 py-2 flex items-center justify-between gap-3 text-left hover:bg-[var(--studio-hover)]/45 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileCode2
                          className="w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="text-[12px] font-medium text-[var(--studio-text-strong)] truncate">
                          {file.path}
                        </span>
                        <span className="text-[10.5px] font-mono-tabular text-[var(--studio-muted-soft)] shrink-0">
                          {file.extension}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block w-24 h-1.5 rounded-full bg-[var(--studio-hover)]/75 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-indigo-500"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                        <span className="text-[11.5px] font-mono-tabular text-[var(--studio-text)] w-20 text-right">
                          {file.lineCount.toLocaleString()} LOC
                        </span>
                        <span className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)] w-14 text-right">
                          {formatBytesCompact(file.byteCount)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Palette, Plus, Trash2 } from 'lucide-react';
import { parseRootCssVariables } from '../utils/cssVariables';
import { cssColorToHex } from '../utils/htmlSync';

interface GlobalStylesPanelProps {
  cssPath: string | null;
  cssContent: string;
  onPreviewRootVar: (name: string, value: string) => void;
  onCommitRootVar: (name: string, value: string, label: string) => void;
  onDeleteRootVar: (name: string) => void;
}

const FONT_STACK_PRESETS = [
  { label: 'System Sans', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { label: 'Segoe UI (Office)', value: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif' },
  { label: 'Georgia Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Calibri / Arial', value: 'Calibri, Arial, Helvetica, sans-serif' },
  { label: 'Monospace', value: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
];

export const GlobalStylesPanel: React.FC<GlobalStylesPanelProps> = ({
  cssPath,
  cssContent,
  onPreviewRootVar,
  onCommitRootVar,
  onDeleteRootVar,
}) => {
  const variables = useMemo(() => parseRootCssVariables(cssContent), [cssContent]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('#2563eb');
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const v of variables) {
      next[v.name] = v.value;
    }
    setDraftValues(next);
  }, [variables]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  const scheduleColorCommit = (name: string, value: string) => {
    setDraftValues((prev) => ({ ...prev, [name]: value }));
    onPreviewRootVar(name, value);
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(() => {
      onCommitRootVar(name, value, `Update ${name}`);
      commitTimerRef.current = null;
    }, 180);
  };

  const handleAddVar = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newVarName.trim();
    if (!raw || !newVarValue.trim()) return;
    const normalized = raw.startsWith('--') ? raw : `--${raw}`;
    onPreviewRootVar(normalized, newVarValue.trim());
    onCommitRootVar(normalized, newVarValue.trim(), `Add ${normalized}`);
    setNewVarName('');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--studio-surface)]">
      <div className="px-4 py-3 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="studio-section-header">:root Theme Variables</h2>
          <p className="text-[12px] text-[var(--studio-muted)] font-mono-tabular truncate mt-0.5">
            {cssPath || 'styles.css (will be created)'}
          </p>
        </div>
        <Palette className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-4">
        {variables.length === 0 ? (
          <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] studio-card-highlight p-4 text-center space-y-1.5">
            <p className="text-[12.5px] font-medium text-[var(--studio-text)]">No :root CSS variables found</p>
            <p className="text-[11.5px] text-[var(--studio-muted)] leading-relaxed">
              Add a CSS custom property below to define global theme tokens across your project.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {variables.map((entry) => {
              const val = draftValues[entry.name] ?? entry.value;
              const hex = entry.kind === 'color' ? cssColorToHex(val) || '#3b82f6' : '';

              return (
                <div
                  key={entry.name}
                  className="p-2.5 rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] studio-card-highlight space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`cssvar-${entry.name}`}
                      className="text-[12px] font-mono-tabular font-medium text-cyan-700 dark:text-cyan-300 truncate"
                      title={entry.name}
                    >
                      {entry.name}
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteRootVar(entry.name)}
                      aria-label={`Delete variable ${entry.name}`}
                      title={`Delete ${entry.name}`}
                      className="p-1 rounded-md text-[var(--studio-muted-soft)] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  {entry.kind === 'color' ? (
                    <div className="flex items-center gap-2 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/60">
                      <label
                        className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer shadow-xs"
                        style={{ backgroundColor: hex }}
                        title="Pick color"
                      >
                        <input
                          type="color"
                          aria-label={`${entry.name} color picker`}
                          value={hex}
                          onChange={(e) => scheduleColorCommit(entry.name, e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </label>
                      <input
                        id={`cssvar-${entry.name}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setDraftValues((prev) => ({ ...prev, [entry.name]: nextVal }));
                          onPreviewRootVar(entry.name, nextVal);
                        }}
                        onBlur={() => {
                          if (val !== entry.value) {
                            onCommitRootVar(entry.name, val, `Update ${entry.name}`);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onCommitRootVar(entry.name, val, `Update ${entry.name}`);
                          }
                        }}
                        className="flex-1 min-w-0 bg-transparent text-[12px] font-mono-tabular text-[var(--studio-text)] focus:outline-none"
                      />
                    </div>
                  ) : entry.kind === 'font' ? (
                    <div className="space-y-1.5">
                      <select
                        aria-label={`${entry.name} font preset`}
                        value={FONT_STACK_PRESETS.some((p) => p.value === val) ? val : '__custom__'}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') return;
                          const nextVal = e.target.value;
                          setDraftValues((prev) => ({ ...prev, [entry.name]: nextVal }));
                          onPreviewRootVar(entry.name, nextVal);
                          onCommitRootVar(entry.name, nextVal, `Update ${entry.name}`);
                        }}
                        className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-1.5 text-[12px] text-[var(--studio-text)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                      >
                        {FONT_STACK_PRESETS.map((preset) => (
                          <option key={preset.label} value={preset.value}>
                            {preset.label}
                          </option>
                        ))}
                        {!FONT_STACK_PRESETS.some((p) => p.value === val) && (
                          <option value="__custom__">Custom Stack</option>
                        )}
                      </select>
                      <input
                        id={`cssvar-${entry.name}`}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const nextVal = e.target.value;
                          setDraftValues((prev) => ({ ...prev, [entry.name]: nextVal }));
                          onPreviewRootVar(entry.name, nextVal);
                        }}
                        onBlur={() => {
                          if (val !== entry.value) {
                            onCommitRootVar(entry.name, val, `Update ${entry.name}`);
                          }
                        }}
                        className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-1 text-[11.5px] font-mono-tabular text-[var(--studio-text-secondary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                      />
                    </div>
                  ) : (
                    <input
                      id={`cssvar-${entry.name}`}
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setDraftValues((prev) => ({ ...prev, [entry.name]: nextVal }));
                        onPreviewRootVar(entry.name, nextVal);
                      }}
                      onBlur={() => {
                        if (val !== entry.value) {
                          onCommitRootVar(entry.name, val, `Update ${entry.name}`);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onCommitRootVar(entry.name, val, `Update ${entry.name}`);
                        }
                      }}
                      className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Variable Form */}
        <form
          onSubmit={handleAddVar}
          className="pt-3.5 border-t border-[var(--studio-border)] space-y-2.5"
        >
          <div className="studio-section-header">Add :root Variable</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              aria-label="New CSS variable name"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              placeholder="--brand-gold"
              className="rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
            <input
              type="text"
              aria-label="New CSS variable value"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              placeholder="#f59e0b"
              className="rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border border-indigo-400/30 shadow-[0_0_16px_rgba(99,102,241,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] text-[12px] font-semibold text-white transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            Add Global Variable
          </button>
        </form>
      </div>
    </div>
  );
};

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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0a0f18] flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-slate-200">:root Theme Variables</h2>
          <p className="text-[11px] text-slate-400 font-mono-tabular truncate">
            {cssPath || 'styles.css (will be created)'}
          </p>
        </div>
        <Palette className="w-4 h-4 text-sky-400 shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-4">
        {variables.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center space-y-1.5">
            <p className="text-xs font-medium text-slate-200">No :root CSS variables found</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Add a CSS custom property below to define global theme tokens across your project.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {variables.map((entry) => {
              const val = draftValues[entry.name] ?? entry.value;
              const hex = entry.kind === 'color' ? cssColorToHex(val) || '#3b82f6' : '';

              return (
                <div
                  key={entry.name}
                  className="p-2.5 rounded-lg border border-slate-800/90 bg-slate-900/50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`cssvar-${entry.name}`}
                      className="text-xs font-mono-tabular font-medium text-sky-300 truncate"
                      title={entry.name}
                    >
                      {entry.name}
                    </label>
                    <button
                      type="button"
                      onClick={() => onDeleteRootVar(entry.name)}
                      aria-label={`Delete variable ${entry.name}`}
                      title={`Delete ${entry.name}`}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {entry.kind === 'color' ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label={`${entry.name} color picker`}
                        value={hex}
                        onChange={(e) => scheduleColorCommit(entry.name, e.target.value)}
                        className="w-8 h-7 rounded bg-transparent border border-slate-700 cursor-pointer shrink-0"
                      />
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
                        className="flex-1 min-w-0 rounded bg-[#090d16] border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
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
                        className="w-full rounded bg-[#090d16] border border-slate-700/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
                        className="w-full rounded bg-[#090d16] border border-slate-700/80 px-2 py-1 text-[11px] font-mono-tabular text-slate-300 focus:outline-none focus:border-blue-500"
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
                      className="w-full rounded bg-[#090d16] border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
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
          className="pt-3 border-t border-slate-800/80 space-y-2"
        >
          <div className="text-xs font-semibold text-slate-200">Add :root Variable</div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              aria-label="New CSS variable name"
              value={newVarName}
              onChange={(e) => setNewVarName(e.target.value)}
              placeholder="--brand-gold"
              className="rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs font-mono-tabular text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              aria-label="New CSS variable value"
              value={newVarValue}
              onChange={(e) => setNewVarValue(e.target.value)}
              placeholder="#f59e0b"
              className="rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs font-mono-tabular text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Global Variable
          </button>
        </form>
      </div>
    </div>
  );
};

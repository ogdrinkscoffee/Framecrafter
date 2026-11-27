import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Play, Search, X } from 'lucide-react';
import {
  KEYBOARD_SHORTCUTS,
  type ShortcutAction,
  type ShortcutDefinition,
} from '../utils/shortcuts';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
  onExecuteShortcut?: (action: ShortcutAction) => void;
}

const CATEGORIES: ShortcutDefinition['category'][] = [
  'General & Navigation',
  'Viewports, Zoom & Panels',
  'Transforms & Nudge',
  'Clipboard, Typography & Layers',
];

type CategoryFilter = 'All' | ShortcutDefinition['category'];

interface VisualKeyDef {
  id: string;
  label: string;
  matchTokens: string[];
  widthClass?: string;
}

const VISUAL_KEYBOARD_ROWS: VisualKeyDef[][] = [
  [
    { id: 'Esc', label: 'Esc', matchTokens: ['Esc'], widthClass: 'w-11' },
    { id: '1', label: '1', matchTokens: ['1'] },
    { id: '2', label: '2', matchTokens: ['2'] },
    { id: '3', label: '3', matchTokens: ['3'] },
    { id: '0', label: '0', matchTokens: ['0'] },
    { id: '-', label: '-', matchTokens: ['-'] },
    { id: '+', label: '+', matchTokens: ['+'] },
    { id: 'Del', label: 'Del', matchTokens: ['Del / Backspace'], widthClass: 'w-12' },
  ],
  [
    { id: 'Q', label: 'Q', matchTokens: ['Q'] },
    { id: 'W', label: 'W', matchTokens: ['W'] },
    { id: 'E', label: 'E', matchTokens: ['E'] },
    { id: 'R', label: 'R', matchTokens: ['R'] },
    { id: 'T', label: 'T', matchTokens: ['T'] },
    { id: 'Y', label: 'Y', matchTokens: ['Y', 'Redo edit (also Ctrl/Cmd + Y)'] },
    { id: 'U', label: 'U', matchTokens: ['U'] },
    { id: 'I', label: 'I', matchTokens: ['I'] },
    { id: 'P', label: 'P', matchTokens: ['P'] },
    { id: '[', label: '[', matchTokens: ['['] },
    { id: ']', label: ']', matchTokens: [']'] },
    { id: '\\', label: '\\', matchTokens: ['\\'] },
  ],
  [
    { id: 'A', label: 'A', matchTokens: ['A'] },
    { id: 'S', label: 'S', matchTokens: ['S'] },
    { id: 'D', label: 'D', matchTokens: ['D'] },
    { id: 'F', label: 'F', matchTokens: ['F'] },
    { id: 'G', label: 'G', matchTokens: ['G'] },
    { id: 'H', label: 'H', matchTokens: ['H'] },
    { id: 'K', label: 'K', matchTokens: ['K'] },
    { id: 'L', label: 'L', matchTokens: ['L'] },
    { id: 'Enter', label: 'Enter', matchTokens: ['Enter'], widthClass: 'w-14' },
  ],
  [
    { id: 'Shift', label: 'Shift', matchTokens: ['Shift'], widthClass: 'w-14' },
    { id: 'Z', label: 'Z', matchTokens: ['Z'] },
    { id: 'X', label: 'X', matchTokens: ['X'] },
    { id: 'C', label: 'C', matchTokens: ['C'] },
    { id: 'V', label: 'V', matchTokens: ['V'] },
    { id: 'B', label: 'B', matchTokens: ['B'] },
    { id: '?', label: '?', matchTokens: ['?'] },
  ],
  [
    { id: 'Ctrl / Cmd', label: 'Ctrl / Cmd', matchTokens: ['Ctrl / Cmd'], widthClass: 'w-20' },
    { id: 'Alt', label: 'Alt', matchTokens: ['Alt'], widthClass: 'w-12' },
    { id: '↑', label: '↑', matchTokens: ['↑', '↑ / ↓ / ← / →'] },
    { id: '↓', label: '↓', matchTokens: ['↓', '↑ / ↓ / ← / →'] },
    { id: '←', label: '←', matchTokens: ['←', '↑ / ↓ / ← / →'] },
    { id: '→', label: '→', matchTokens: ['→', '↑ / ↓ / ← / →'] },
  ],
];

const RUNNABLE_ACTIONS = new Set<ShortcutAction>([
  'open-command-palette',
  'global-find-replace',
  'undo',
  'redo',
  'save',
  'toggle-mode',
  'mode-edit',
  'toggle-left-sidebar',
  'toggle-right-sidebar',
  'toggle-zen',
  'toggle-outlines',
  'viewport-desktop',
  'viewport-tablet',
  'viewport-mobile',
  'zoom-in',
  'zoom-out',
  'zoom-100',
  'zoom-fit',
]);

function shortcutUsesKey(shortcut: ShortcutDefinition, keyDef: VisualKeyDef): boolean {
  return keyDef.matchTokens.some(
    (token) =>
      shortcut.keys.some((k) => k === token) ||
      shortcut.label.includes(token)
  );
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  open,
  onClose,
  onExecuteShortcut,
}) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All');
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [hoveredShortcut, setHoveredShortcut] = useState<ShortcutDefinition | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setHoveredShortcut(null);
    window.setTimeout(() => searchRef.current?.focus(), 15);
  }, [open]);

  const selectedKeyDef = useMemo(() => {
    if (!selectedKeyId) return null;
    for (const row of VISUAL_KEYBOARD_ROWS) {
      const found = row.find((k) => k.id === selectedKeyId);
      if (found) return found;
    }
    return null;
  }, [selectedKeyId]);

  const keyBoundCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of VISUAL_KEYBOARD_ROWS) {
      for (const keyDef of row) {
        counts[keyDef.id] = KEYBOARD_SHORTCUTS.filter((s) =>
          shortcutUsesKey(s, keyDef)
        ).length;
      }
    }
    return counts;
  }, []);

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const categoriesToShow =
      activeCategory === 'All' ? CATEGORIES : [activeCategory];

    return categoriesToShow
      .map((category) => ({
        category,
        items: KEYBOARD_SHORTCUTS.filter((s) => {
          if (s.category !== category) return false;
          if (selectedKeyDef && !shortcutUsesKey(s, selectedKeyDef)) return false;
          if (!q) return true;
          return (
            s.label.toLowerCase().includes(q) ||
            s.keys.join(' ').toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, activeCategory, selectedKeyDef]);

  const totalVisibleShortcuts = useMemo(
    () => filteredByCategory.reduce((acc, g) => acc + g.items.length, 0),
    [filteredByCategory]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      data-testid="keyboard-shortcuts-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl studio-card-highlight overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--studio-border)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center shrink-0">
              <Keyboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h2
                id="shortcuts-modal-title"
                className="font-display text-[14px] font-semibold tracking-[-0.015em] text-[var(--studio-text-strong)] truncate"
              >
                Keyboard Shortcuts Overlay
              </h2>
              <p className="text-[11px] text-[var(--studio-muted)] truncate">
                Press Shift + ? anytime to toggle · Click any keycap to filter · Hover a shortcut to highlight keys
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono-tabular text-[var(--studio-muted-soft)]">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--studio-bg)] border border-[var(--studio-border-strong)] text-[10.5px] text-[var(--studio-text-strong)]">
                Shift
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--studio-bg)] border border-[var(--studio-border-strong)] text-[10.5px] text-[var(--studio-text-strong)]">
                ?
              </kbd>
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close keyboard shortcuts"
              className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Interactive Visual Keyboard Map */}
        <div
          className="px-5 py-3.5 border-b border-[var(--studio-border)] bg-[var(--studio-bg)] shrink-0 space-y-2.5"
          data-testid="visual-keyboard-map"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-[var(--studio-muted)]">
              {hoveredShortcut ? (
                <span>
                  Previewing{' '}
                  <strong className="text-[var(--studio-text-strong)]">
                    {hoveredShortcut.keys.join(' + ')}
                  </strong>{' '}
                  — {hoveredShortcut.label}
                </span>
              ) : selectedKeyDef ? (
                <span>
                  Showing{' '}
                  <strong className="font-mono-tabular text-[var(--studio-text-strong)]">
                    {totalVisibleShortcuts}
                  </strong>{' '}
                  {totalVisibleShortcuts === 1 ? 'shortcut' : 'shortcuts'} using{' '}
                  <strong className="text-indigo-500 dark:text-indigo-400">
                    {selectedKeyDef.label}
                  </strong>
                </span>
              ) : (
                <span>
                  Interactive Hotkey Map ·{' '}
                  <span className="font-mono-tabular">{KEYBOARD_SHORTCUTS.length}</span> shortcuts available
                </span>
              )}
            </div>

            {selectedKeyId && (
              <button
                type="button"
                onClick={() => setSelectedKeyId(null)}
                className="text-[11px] font-medium text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Clear key filter
              </button>
            )}
          </div>

          <div className="flex flex-col items-center gap-1.5 select-none overflow-x-auto pb-0.5">
            {VISUAL_KEYBOARD_ROWS.map((row, rowIndex) => (
              <div key={rowIndex} className="flex items-center justify-center gap-1.5">
                {row.map((keyDef) => {
                  const boundCount = keyBoundCounts[keyDef.id] ?? 0;
                  const isSelected = selectedKeyId === keyDef.id;
                  const isHoveredTarget = hoveredShortcut
                    ? shortcutUsesKey(hoveredShortcut, keyDef)
                    : false;

                  return (
                    <button
                      key={keyDef.id}
                      type="button"
                      disabled={boundCount === 0}
                      onClick={() =>
                        setSelectedKeyId((prev) =>
                          prev === keyDef.id ? null : keyDef.id
                        )
                      }
                      aria-pressed={isSelected}
                      title={
                        boundCount > 0
                          ? `${keyDef.label}: ${boundCount} shortcut${boundCount === 1 ? '' : 's'} (click to filter)`
                          : `${keyDef.label}: no bound shortcuts`
                      }
                      className={`h-7 ${keyDef.widthClass ?? 'w-8'} px-1.5 rounded-md border text-[11px] font-mono-tabular font-semibold transition-all flex items-center justify-center ${
                        isHoveredTarget
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm scale-105'
                          : isSelected
                            ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500 ring-1 ring-indigo-500/40'
                            : boundCount > 0
                              ? 'bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] text-[var(--studio-text-strong)] border-[var(--studio-border-strong)] cursor-pointer'
                              : 'bg-[var(--studio-elevated)]/40 text-[var(--studio-muted-soft)] border-[var(--studio-border-subtle)] opacity-45 cursor-default'
                      }`}
                    >
                      {keyDef.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Search & Category Tabs */}
        <div className="px-5 py-2.5 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shortcuts (e.g. replace, nudge, zoom, undo)..."
              aria-label="Filter keyboard shortcuts"
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear shortcut filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Shortcut Categories">
            {(['All', ...CATEGORIES] as CategoryFilter[]).map((cat) => {
              const active = activeCategory === cat;
              const shortLabel =
                cat === 'All'
                  ? 'All'
                  : cat === 'General & Navigation'
                    ? 'General'
                    : cat === 'Viewports, Zoom & Panels'
                      ? 'View & Panels'
                      : cat === 'Transforms & Nudge'
                        ? 'Transforms'
                        : 'Clipboard & Text';
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-[var(--studio-elevated)] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                  }`}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcut Directory */}
        <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-4">
          {filteredByCategory.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-xs text-[var(--studio-muted)]">
                No shortcuts match the current filter.
              </p>
              {(query || selectedKeyId || activeCategory !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setSelectedKeyId(null);
                    setActiveCategory('All');
                  }}
                  className="text-[11.5px] font-medium text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            filteredByCategory.map(({ category, items }) => (
              <section key={category} className="space-y-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <h3 className="studio-section-header">{category}</h3>
                  <span className="text-[10.5px] font-mono-tabular text-[var(--studio-muted-soft)]">
                    {items.length}
                  </span>
                </div>
                <div className="divide-y divide-[var(--studio-border-subtle)] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)]">
                  {items.map((shortcut) => {
                    const canRunDirectly =
                      Boolean(onExecuteShortcut) && RUNNABLE_ACTIONS.has(shortcut.action);

                    return (
                      <div
                        key={shortcut.action}
                        onMouseEnter={() => setHoveredShortcut(shortcut)}
                        onMouseLeave={() => setHoveredShortcut(null)}
                        className="group px-3.5 py-2 flex items-center justify-between gap-4 hover:bg-[var(--studio-hover)]/45 transition-colors"
                      >
                        <span className="text-[12.5px] font-medium text-[var(--studio-text)]">
                          {shortcut.label}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {canRunDirectly && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onExecuteShortcut?.(shortcut.action);
                              }}
                              title={`Run "${shortcut.label}"`}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-300 hover:text-white text-[10.5px] font-semibold transition-all cursor-pointer"
                            >
                              <Play className="w-2.5 h-2.5" strokeWidth={2} />
                              Run
                            </button>
                          )}
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((keyLabel, idx) => (
                              <React.Fragment key={`${shortcut.action}-${keyLabel}-${idx}`}>
                                {idx > 0 && (
                                  <span className="text-[10px] text-[var(--studio-muted-soft)]">
                                    +
                                  </span>
                                )}
                                <kbd className="px-2 py-0.5 rounded-md bg-[var(--studio-bg)] border border-[var(--studio-border-strong)] text-[11px] font-mono-tabular text-[var(--studio-text-strong)]">
                                  {keyLabel}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--studio-muted)] shrink-0">
          <span>
            Shortcuts pause automatically while typing in inputs, inline text, or Code Editor
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[var(--studio-text-strong)] text-[12px] font-medium transition-colors cursor-pointer"
          >
            Close (Esc / Shift+?)
          </button>
        </div>
      </div>
    </div>
  );
};

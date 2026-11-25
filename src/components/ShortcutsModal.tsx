import React, { useMemo, useState } from 'react';
import { Keyboard, Search, X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, type ShortcutDefinition } from '../utils/shortcuts';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: ShortcutDefinition['category'][] = [
  'General & Navigation',
  'Viewports, Zoom & Panels',
  'Transforms & Nudge',
  'Clipboard, Typography & Layers',
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATEGORIES.map((category) => ({
      category,
      items: KEYBOARD_SHORTCUTS.filter(
        (s) =>
          s.category === category &&
          (!q ||
            s.label.toLowerCase().includes(q) ||
            s.keys.join(' ').toLowerCase().includes(q))
      ),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl studio-card-highlight overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--studio-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="font-display text-[14px] font-semibold tracking-[-0.015em] text-[var(--studio-text-strong)]"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-[var(--studio-muted)]">
                Figma, Adobe, MS 365 &amp; Blender conventions · Cmd on macOS, Ctrl on Windows/Linux
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-[var(--studio-border-subtle)]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter shortcuts (e.g. nudge, paste, zoom, layer, undo)..."
              aria-label="Filter keyboard shortcuts"
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="max-h-[68vh] overflow-y-auto builder-scroll p-4 space-y-4">
          {filteredByCategory.length === 0 ? (
            <p className="text-center text-xs text-[var(--studio-muted)] py-6">
              No shortcuts match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            filteredByCategory.map(({ category, items }) => (
              <section key={category} className="space-y-1.5">
                <h3 className="studio-section-header px-0.5">{category}</h3>
                <div className="divide-y divide-[var(--studio-border-subtle)] rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] studio-card-highlight">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="px-3 py-2 flex items-center justify-between gap-4"
                    >
                      <span className="text-[12.5px] font-medium text-[var(--studio-text)]">
                        {shortcut.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {shortcut.keys.map((keyLabel, idx) => (
                          <React.Fragment key={`${shortcut.action}-${keyLabel}-${idx}`}>
                            {idx > 0 && <span className="text-[10px] text-[var(--studio-muted-soft)]">+</span>}
                            <kbd className="px-2 py-0.5 rounded-md bg-[var(--studio-bg)] border border-[var(--studio-border-strong)] text-[11px] font-mono-tabular text-[var(--studio-text-strong)]">
                              {keyLabel}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] flex items-center justify-between text-[11px] text-[var(--studio-muted)]">
          <span>Shortcuts automatically pause while typing in forms, inline text, or Code Editor</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[var(--studio-text-strong)] text-[12px] font-medium transition-colors cursor-pointer"
          >
            Done (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};


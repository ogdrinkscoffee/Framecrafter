import React from 'react';
import { Keyboard, X } from 'lucide-react';
import { KEYBOARD_SHORTCUTS, type ShortcutDefinition } from '../utils/shortcuts';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: ShortcutDefinition['category'][] = [
  'General',
  'Viewports & Panels',
  'Editing & Elements',
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/[0.1] bg-[#111114] shadow-2xl shadow-black/70 studio-card-highlight overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/35 flex items-center justify-center">
              <Keyboard className="w-4 h-4 text-indigo-400" strokeWidth={1.5} />
            </div>
            <div>
              <h2
                id="shortcuts-modal-title"
                className="font-display text-[14px] font-semibold tracking-[-0.015em] text-zinc-100"
              >
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-zinc-400">
                Works anywhere in the workspace (Cmd on macOS, Ctrl on Windows/Linux)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto builder-scroll p-4 space-y-4">
          {CATEGORIES.map((category) => {
            const items = KEYBOARD_SHORTCUTS.filter((s) => s.category === category);
            return (
              <section key={category} className="space-y-1.5">
                <h3 className="studio-section-header px-0.5">{category}</h3>
                <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#18181b] studio-card-highlight">
                  {items.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="px-3 py-2 flex items-center justify-between gap-4"
                    >
                      <span className="text-[12.5px] font-medium text-[#e4e4e7]">
                        {shortcut.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {shortcut.keys.map((keyLabel, idx) => (
                          <React.Fragment key={`${shortcut.action}-${keyLabel}`}>
                            {idx > 0 && <span className="text-[10px] text-zinc-600">+</span>}
                            <kbd className="px-2 py-0.5 rounded-md bg-[#09090b] border border-white/[0.1] text-[11px] font-mono-tabular text-zinc-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                              {keyLabel}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-white/[0.08] bg-[#111114] flex items-center justify-between text-[11px] text-zinc-400">
          <span>Shortcuts automatically pause while typing in forms or the Code Editor</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] text-zinc-100 text-[12px] font-medium transition-colors cursor-pointer"
          >
            Done (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};

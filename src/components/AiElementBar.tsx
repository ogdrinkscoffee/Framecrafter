import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';

export interface AiQuickChip {
  id: 'improve-hierarchy' | 'make-responsive' | 'fix-contrast-a11y';
  label: string;
  prompt: string;
}

export const AI_QUICK_FIX_CHIPS: AiQuickChip[] = [
  {
    id: 'improve-hierarchy',
    label: 'Improve Hierarchy',
    prompt:
      'Improve visual hierarchy, spacing, typography weight, and scannability while preserving existing design tokens and behavior.',
  },
  {
    id: 'make-responsive',
    label: 'Make Responsive',
    prompt:
      'Make this element and its layout cleanly responsive across mobile (375px), tablet (768px), and desktop (1440px) viewports using fluid sizing and wrapping without breaking desktop alignment.',
  },
  {
    id: 'fix-contrast-a11y',
    label: 'Fix Contrast & A11y',
    prompt:
      'Fix foreground/background color contrast to meet WCAG AA (>= 4.5:1 normal text, >= 3:1 large text), ensure clear focus visibility, and add appropriate semantic HTML or ARIA attributes without breaking layout or behavior.',
  },
];

export interface AiElementCopilotControls {
  prompt: string;
  loading: boolean;
  error: string | null;
  explanation: string | null;
  onChangePrompt: (next: string) => void;
  onSubmit: (promptText: string, label?: string) => void;
  onCancel: () => void;
  onClearFeedback: () => void;
}

interface AiElementBarProps {
  variant: 'floating' | 'inspector';
  targetTagName: string;
  copilot: AiElementCopilotControls;
  onClose?: () => void;
}

export const AiElementBar: React.FC<AiElementBarProps> = ({
  variant,
  targetTagName,
  copilot,
  onClose,
}) => {
  const {
    prompt,
    loading,
    error,
    explanation,
    onChangePrompt,
    onSubmit,
    onCancel,
    onClearFeedback,
  } = copilot;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const isFloating = variant === 'floating';

  return (
    <div
      data-testid={isFloating ? 'floating-ai-prompt-bar' : 'inspector-ai-copilot-bar'}
      className={
        isFloating
          ? 'w-[340px] max-w-[calc(100%-16px)] rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-2.5 shadow-2xl studio-card-highlight space-y-2'
          : 'rounded-lg border border-[var(--studio-border)] bg-[var(--studio-elevated)] p-2.5 space-y-2'
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" strokeWidth={1.6} />
          <span className="studio-section-header truncate">
            AI Edit
          </span>
          <span className="font-mono-tabular text-[10.5px] text-indigo-600 dark:text-indigo-300 truncate">
            &lt;{targetTagName}&gt;
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {loading && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel AI edit"
              className="h-5 px-1.5 rounded border border-[var(--studio-border-strong)] bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] text-[10.5px] font-medium text-[var(--studio-text)] studio-pressable cursor-pointer"
            >
              Cancel
            </button>
          )}
          {isFloating && onClose && (
            <button
              type="button"
              onClick={() => {
                if (loading) onCancel();
                onClose();
              }}
              aria-label="Close AI prompt bar"
              className="h-5 w-5 inline-flex items-center justify-center rounded text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] cursor-pointer"
            >
              <X className="w-3 h-3" strokeWidth={1.6} />
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="flex items-center gap-1.5">
        <input
          type="text"
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          disabled={loading}
          maxLength={1000}
          aria-label="Describe AI edit for selected element"
          placeholder={`Edit <${targetTagName}> with AI...`}
          className="flex-1 min-w-0 h-7 rounded-md bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 text-[11.5px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          aria-label="Apply AI edit"
          className="h-7 px-2.5 rounded-md bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-45 text-[11px] font-semibold text-white inline-flex items-center gap-1 studio-pressable cursor-pointer shrink-0"
        >
          {loading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.75} />
              <span>Applying</span>
            </>
          ) : (
            <span>Apply</span>
          )}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="AI Quick Actions">
        {AI_QUICK_FIX_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={loading}
            onClick={() => onSubmit(chip.prompt, chip.label)}
            className="h-6 px-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] hover:border-[var(--studio-border-strong)] text-[10.5px] font-medium text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] disabled:opacity-45 studio-pressable cursor-pointer whitespace-nowrap"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span className="flex-1 min-w-0 leading-snug break-words">{error}</span>
          <button
            type="button"
            onClick={onClearFeedback}
            aria-label="Dismiss AI error"
            className="shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3 h-3" strokeWidth={1.6} />
          </button>
        </div>
      )}

      {!error && explanation && (
        <div
          role="status"
          className="flex items-start gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300"
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.6} />
          <span className="flex-1 min-w-0 leading-snug break-words">{explanation}</span>
          <button
            type="button"
            onClick={onClearFeedback}
            aria-label="Dismiss AI explanation"
            className="shrink-0 opacity-75 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3 h-3" strokeWidth={1.6} />
          </button>
        </div>
      )}
    </div>
  );
};

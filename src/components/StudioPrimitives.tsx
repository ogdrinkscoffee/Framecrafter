import React, { memo, type ComponentPropsWithRef, type ElementType } from 'react';

interface HoverIconButtonProps {
  onClick: () => void;
  label: string;
  ariaLabel?: string;
  title?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
  tone?: 'default' | 'accent' | 'danger';
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaHaspopup?: boolean | 'menu' | 'dialog';
  className?: string;
}

export const HoverIconButton = memo<HoverIconButtonProps>(function HoverIconButton({
  onClick,
  label,
  ariaLabel,
  title,
  icon,
  active = false,
  disabled = false,
  size = 'md',
  tone = 'default',
  ariaPressed,
  ariaExpanded,
  ariaHaspopup,
  className = '',
}) {
  const heightClass =
    size === 'xs'
      ? 'h-6 px-1.5 text-[11px] rounded-md'
      : size === 'sm'
        ? 'h-7 px-1.5 text-[11.5px] rounded-md'
        : 'h-8 px-2 text-[11.5px] rounded-lg';

  const toneClass = active
    ? tone === 'accent'
      ? 'bg-indigo-500/15 border-indigo-500/50 text-indigo-700 dark:text-indigo-300 shadow-[inset_0_0_0_1px_rgba(20,163,146,0.08)]'
      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
    : tone === 'danger'
      ? 'text-[var(--studio-muted)] bg-[var(--studio-elevated)] hover:bg-red-500/12 hover:text-red-600 dark:hover:text-red-400 border-[var(--studio-border)] hover:border-red-500/35'
      : 'text-[var(--studio-text)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      title={title ?? label}
      className={`group inline-flex items-center font-medium border studio-card-highlight studio-pressable whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 disabled:pointer-events-none ${heightClass} ${toneClass} ${className}`}
    >
      <span className="shrink-0 flex items-center justify-center">{icon}</span>
      <span className="studio-reveal-label">{label}</span>
    </button>
  );
});

/** Sharp geometric 1.5px stroke architectural frame mark (no gradient square cliché). */
export const FramecraftLogoMark = memo(function FramecraftLogoMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 text-[var(--studio-text-strong)]`}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="9.5"
        y="9.5"
        width="11.5"
        height="11.5"
        rx="2.5"
        fill="#14a392"
        fillOpacity="0.18"
        stroke="#14a392"
        strokeWidth="1.4"
      />
      <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.35" strokeOpacity="0.65" />
      <path d="M9.5 3V21" stroke="currentColor" strokeWidth="1.35" strokeOpacity="0.65" />
      <circle cx="15.25" cy="15.25" r="1.4" fill="#14a392" />
    </svg>
  );
});

export const DuotoneInspectorIcon = memo(function DuotoneInspectorIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M2.5 4.5H13.5M2.5 8H13.5M2.5 11.5H13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="5.5" cy="4.5" r="1.75" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="10.5" cy="8" r="1.75" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="6.5" cy="11.5" r="1.75" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
});

export const DuotoneElementsIcon = memo(function DuotoneElementsIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 2.2L13.5 5.2L8 8.2L2.5 5.2L8 2.2Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M2.5 8.2L8 11.2L13.5 8.2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 11L8 14L13.5 11" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
});

export const DuotoneSeoIcon = memo(function DuotoneSeoIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="currentColor" fillOpacity="0.14" stroke="currentColor" strokeWidth="1.25" />
      <ellipse cx="8" cy="8" rx="2.4" ry="5.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.8 8H13.2" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
});

export const DuotonePaletteIcon = memo(function DuotonePaletteIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 2.3C4.8 2.3 2.3 4.8 2.3 8C2.3 11.2 4.8 13.7 8 13.7C8.9 13.7 9.5 13.1 9.5 12.3C9.5 11.9 9.3 11.6 9.1 11.3C8.8 11 8.9 10.4 9.4 10.4H11.1C12.5 10.4 13.7 9.3 13.7 7.8C13.7 4.7 11.2 2.3 8 2.3Z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <circle cx="5.5" cy="7.5" r="0.85" fill="currentColor" />
      <circle cx="7.4" cy="5.2" r="0.85" fill="currentColor" />
      <circle cx="10.4" cy="5.6" r="0.85" fill="currentColor" />
    </svg>
  );
});

export const DuotoneUndoIcon = memo(function DuotoneUndoIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path
        d="M5.5 4L2.5 7L5.5 10"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.8 7H9.6C11.8 7 13.5 8.6 13.5 10.5C13.5 12.2 12.1 13.5 10.3 13.5H8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
});

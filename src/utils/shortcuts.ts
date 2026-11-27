import type { EditorMode, ViewportPreset } from '../types/editor';

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'toggle-mode'
  | 'mode-edit'
  | 'toggle-left-sidebar'
  | 'toggle-right-sidebar'
  | 'toggle-zen'
  | 'toggle-outlines'
  | 'open-command-palette'
  | 'global-find-replace'
  | 'duplicate'
  | 'copy-element'
  | 'cut-element'
  | 'paste-element'
  | 'copy-style'
  | 'paste-style'
  | 'delete'
  | 'move-up'
  | 'move-down'
  | 'bring-forward'
  | 'send-backward'
  | 'nudge-up'
  | 'nudge-down'
  | 'nudge-left'
  | 'nudge-right'
  | 'nudge-up-10'
  | 'nudge-down-10'
  | 'nudge-left-10'
  | 'nudge-right-10'
  | 'toggle-visibility'
  | 'toggle-aspect-lock'
  | 'edit-text'
  | 'select-parent'
  | 'format-bold'
  | 'format-italic'
  | 'format-underline'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-100'
  | 'zoom-fit'
  | 'viewport-desktop'
  | 'viewport-tablet'
  | 'viewport-mobile'
  | 'escape'
  | 'open-shortcuts';

export interface ShortcutDefinition {
  action: ShortcutAction;
  keys: string[];
  label: string;
  category:
    | 'General & Navigation'
    | 'Viewports, Zoom & Panels'
    | 'Transforms & Nudge'
    | 'Clipboard, Typography & Layers';
}

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  { action: 'open-command-palette', keys: ['Ctrl / Cmd', 'K'], label: 'Open Command Palette (search actions, fonts, templates)', category: 'General & Navigation' },
  { action: 'global-find-replace', keys: ['Ctrl / Cmd', 'Shift', 'F'], label: 'Global Find & Replace across all project files', category: 'General & Navigation' },
  { action: 'undo', keys: ['Ctrl / Cmd', 'Z'], label: 'Undo last visual or code edit (instant, no reload)', category: 'General & Navigation' },
  { action: 'redo', keys: ['Ctrl / Cmd', 'Shift', 'Z'], label: 'Redo edit (also Ctrl/Cmd + Y)', category: 'General & Navigation' },
  { action: 'save', keys: ['Ctrl / Cmd', 'S'], label: 'Save project to disk / workspace storage', category: 'General & Navigation' },
  { action: 'toggle-mode', keys: ['Ctrl / Cmd', 'E'], label: 'Toggle Editing Mode / Using Mode', category: 'General & Navigation' },
  { action: 'mode-edit', keys: ['V'], label: 'Switch directly to Selection / Editing Mode', category: 'General & Navigation' },
  { action: 'open-shortcuts', keys: ['Shift', '?'], label: 'Open interactive Keyboard Shortcuts overlay', category: 'General & Navigation' },
  { action: 'escape', keys: ['Esc'], label: 'Deselect element or close open dialog', category: 'General & Navigation' },

  { action: 'toggle-left-sidebar', keys: ['Ctrl / Cmd', 'B'], label: 'Collapse / expand Project Files sidebar', category: 'Viewports, Zoom & Panels' },
  { action: 'toggle-right-sidebar', keys: ['Ctrl / Cmd', 'I'], label: 'Collapse / expand Inspector sidebar', category: 'Viewports, Zoom & Panels' },
  { action: 'toggle-zen', keys: ['Ctrl / Cmd', '\\'], label: 'Toggle Zen Focus Mode (collapse both sidebars)', category: 'Viewports, Zoom & Panels' },
  { action: 'toggle-outlines', keys: ['G'], label: 'Toggle layout wireframe outlines', category: 'Viewports, Zoom & Panels' },
  { action: 'viewport-desktop', keys: ['1'], label: 'Switch to Desktop viewport', category: 'Viewports, Zoom & Panels' },
  { action: 'viewport-tablet', keys: ['2'], label: 'Switch to Tablet viewport', category: 'Viewports, Zoom & Panels' },
  { action: 'viewport-mobile', keys: ['3'], label: 'Switch to Mobile viewport', category: 'Viewports, Zoom & Panels' },
  { action: 'zoom-in', keys: ['Ctrl / Cmd', '+'], label: 'Zoom in canvas', category: 'Viewports, Zoom & Panels' },
  { action: 'zoom-out', keys: ['Ctrl / Cmd', '-'], label: 'Zoom out canvas', category: 'Viewports, Zoom & Panels' },
  { action: 'zoom-100', keys: ['Ctrl / Cmd', '0'], label: 'Reset canvas zoom to 100%', category: 'Viewports, Zoom & Panels' },
  { action: 'zoom-fit', keys: ['Shift', '1'], label: 'Zoom canvas to Fit screen', category: 'Viewports, Zoom & Panels' },

  { action: 'nudge-up', keys: ['↑ / ↓ / ← / →'], label: 'Nudge selected element by 1px', category: 'Transforms & Nudge' },
  { action: 'nudge-up-10', keys: ['Shift', '↑ / ↓ / ← / →'], label: 'Large nudge selected element by 10px', category: 'Transforms & Nudge' },
  { action: 'move-up', keys: ['Alt', '↑'], label: 'Reorder selected element up among siblings', category: 'Transforms & Nudge' },
  { action: 'move-down', keys: ['Alt', '↓'], label: 'Reorder selected element down among siblings', category: 'Transforms & Nudge' },
  { action: 'edit-text', keys: ['Enter'], label: 'Edit text inside selected element', category: 'Transforms & Nudge' },
  { action: 'select-parent', keys: ['Shift', 'Enter'], label: 'Select parent container (also Backslash \\)', category: 'Transforms & Nudge' },
  { action: 'toggle-aspect-lock', keys: ['Ctrl / Cmd', 'L'], label: 'Lock / unlock proportional aspect ratio', category: 'Transforms & Nudge' },

  { action: 'copy-element', keys: ['Ctrl / Cmd', 'C'], label: 'Copy selected element', category: 'Clipboard, Typography & Layers' },
  { action: 'cut-element', keys: ['Ctrl / Cmd', 'X'], label: 'Cut selected element', category: 'Clipboard, Typography & Layers' },
  { action: 'paste-element', keys: ['Ctrl / Cmd', 'V'], label: 'Paste element after / inside selection', category: 'Clipboard, Typography & Layers' },
  { action: 'duplicate', keys: ['Ctrl / Cmd', 'D'], label: 'Duplicate selected element', category: 'Clipboard, Typography & Layers' },
  { action: 'copy-style', keys: ['Ctrl / Cmd', 'Shift', 'C'], label: 'Copy Styles (Format Painter)', category: 'Clipboard, Typography & Layers' },
  { action: 'paste-style', keys: ['Ctrl / Cmd', 'Shift', 'V'], label: 'Paste Styles onto selected element', category: 'Clipboard, Typography & Layers' },
  { action: 'bring-forward', keys: ['Ctrl / Cmd', ']'], label: 'Bring element forward (z-index +1)', category: 'Clipboard, Typography & Layers' },
  { action: 'send-backward', keys: ['Ctrl / Cmd', '['], label: 'Send element backward (z-index -1)', category: 'Clipboard, Typography & Layers' },
  { action: 'toggle-visibility', keys: ['Ctrl / Cmd', 'Shift', 'H'], label: 'Hide / show selected element', category: 'Clipboard, Typography & Layers' },
  { action: 'format-underline', keys: ['Ctrl / Cmd', 'U'], label: 'Toggle underline on selected text', category: 'Clipboard, Typography & Layers' },
  { action: 'align-left', keys: ['Ctrl / Cmd', 'Shift', 'L'], label: 'Align text left (MS 365 / Figma)', category: 'Clipboard, Typography & Layers' },
  { action: 'align-center', keys: ['Ctrl / Cmd', 'Shift', 'E'], label: 'Align text center (MS 365)', category: 'Clipboard, Typography & Layers' },
  { action: 'align-right', keys: ['Ctrl / Cmd', 'Shift', 'R'], label: 'Align text right (MS 365)', category: 'Clipboard, Typography & Layers' },
  { action: 'delete', keys: ['Del / Backspace'], label: 'Remove selected element', category: 'Clipboard, Typography & Layers' },
];

export interface ShortcutTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => unknown;
}

export function isShortcutTypingTarget(
  target: EventTarget | ShortcutTargetLike | null
): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as ShortcutTargetLike;
  const tag = (el.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.getAttribute?.('contenteditable') === 'true') return true;
  if (el.closest?.('[data-code-editor="true"]')) return true;
  return false;
}

export interface ShortcutMatchContext {
  editorMode: EditorMode;
  hasSelectedElement: boolean;
  hasOpenModal: boolean;
  isTyping: boolean;
}

export function matchShortcutAction(
  event: {
    key: string;
    code?: string;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  },
  ctx: ShortcutMatchContext
): ShortcutAction | null {
  const keyLower = event.key.toLowerCase();
  const hasMod = event.ctrlKey || event.metaKey;

  // Escape & Ctrl/Cmd+S always apply even when typing in inputs or Code Editor
  if (event.key === 'Escape') {
    return 'escape';
  }
  if (hasMod && !event.altKey && keyLower === 's') {
    return 'save';
  }
  // Command palette (Ctrl/Cmd+K) works unless actively typing in a modal input
  if (hasMod && !event.altKey && !event.shiftKey && keyLower === 'k') {
    return 'open-command-palette';
  }

  if (ctx.isTyping) {
    return null;
  }

  // Ctrl/Cmd + Alt chords (MS 365 Format Painter & Adobe alt combos)
  if (hasMod && event.altKey && ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
    if (keyLower === 'c') return 'copy-style';
    if (keyLower === 'v') return 'paste-style';
  }

  if (hasMod && !event.altKey) {
    if (keyLower === 'f' && event.shiftKey) return 'global-find-replace';
    if (keyLower === 'z' && !event.shiftKey) return 'undo';
    if (keyLower === 'y' || (keyLower === 'z' && event.shiftKey)) return 'redo';
    if (keyLower === 'e' && !event.shiftKey) return 'toggle-mode';
    if (keyLower === 'b' && !event.shiftKey) return 'toggle-left-sidebar';
    if (keyLower === 'i' && !event.shiftKey) return 'toggle-right-sidebar';
    if (event.key === '\\' || event.code === 'Backslash') return 'toggle-zen';
    if (keyLower === '=' || keyLower === '+' || event.code === 'Equal' || event.code === 'NumpadAdd') return 'zoom-in';
    if (keyLower === '-' || event.code === 'Minus' || event.code === 'NumpadSubtract') return 'zoom-out';
    if (keyLower === '0' || event.code === 'Digit0' || event.code === 'Numpad0') return 'zoom-100';

    if (ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
      if (keyLower === 'd' && !event.shiftKey) return 'duplicate';
      if (keyLower === 'c' && !event.shiftKey) return 'copy-element';
      if (keyLower === 'x' && !event.shiftKey) return 'cut-element';
      if (keyLower === 'v' && !event.shiftKey) return 'paste-element';
      if (keyLower === 'c' && event.shiftKey) return 'copy-style';
      if (keyLower === 'v' && event.shiftKey) return 'paste-style';
      if (keyLower === 'h' && event.shiftKey) return 'toggle-visibility';
      if (keyLower === 'l' && !event.shiftKey) return 'toggle-aspect-lock';
      if (keyLower === 'l' && event.shiftKey) return 'align-left';
      if (keyLower === 'e' && event.shiftKey) return 'align-center';
      if (keyLower === 'r' && event.shiftKey) return 'align-right';
      if (keyLower === 'u' && !event.shiftKey) return 'format-underline';
      if (event.key === ']' || event.code === 'BracketRight') return 'bring-forward';
      if (event.key === '[' || event.code === 'BracketLeft') return 'send-backward';
    }
    return null;
  }

  if (event.altKey && !hasMod && ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
    if (event.key === 'ArrowUp') return 'move-up';
    if (event.key === 'ArrowDown') return 'move-down';
  }

  if (!hasMod && !event.altKey) {
    if (event.key === '?' || (event.shiftKey && event.code === 'Slash')) {
      return 'open-shortcuts';
    }
    if (ctx.hasOpenModal) return null;

    // Shift + 1 / ! -> Zoom to Fit (Figma convention)
    if ((event.shiftKey && event.code === 'Digit1') || event.key === '!') {
      return 'zoom-fit';
    }

    if (!event.shiftKey) {
      if (event.key === '1') return 'viewport-desktop';
      if (event.key === '2') return 'viewport-tablet';
      if (event.key === '3') return 'viewport-mobile';
      if (keyLower === 'v') return 'mode-edit';
      if (keyLower === 'g') return 'toggle-outlines';
    }

    if (ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
      if (event.key === 'Delete' || event.key === 'Backspace') return 'delete';
      if (event.key === 'Enter' && !event.shiftKey) return 'edit-text';
      if ((event.key === 'Enter' && event.shiftKey) || event.key === '\\') return 'select-parent';

      if (event.key === 'ArrowUp') return event.shiftKey ? 'nudge-up-10' : 'nudge-up';
      if (event.key === 'ArrowDown') return event.shiftKey ? 'nudge-down-10' : 'nudge-down';
      if (event.key === 'ArrowLeft') return event.shiftKey ? 'nudge-left-10' : 'nudge-left';
      if (event.key === 'ArrowRight') return event.shiftKey ? 'nudge-right-10' : 'nudge-right';
    }
  }

  return null;
}

export function classifyViewportPresetFromWidth(widthPx: number): ViewportPreset {
  if (widthPx < 560) return 'mobile';
  if (widthPx < 992) return 'tablet';
  return 'desktop';
}


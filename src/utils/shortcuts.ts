import type { EditorMode, ViewportPreset } from '../types/editor';

export type ShortcutAction =
  | 'undo'
  | 'redo'
  | 'save'
  | 'toggle-mode'
  | 'toggle-left-sidebar'
  | 'toggle-right-sidebar'
  | 'duplicate'
  | 'delete'
  | 'move-up'
  | 'move-down'
  | 'viewport-desktop'
  | 'viewport-tablet'
  | 'viewport-mobile'
  | 'escape'
  | 'open-shortcuts';

export interface ShortcutDefinition {
  action: ShortcutAction;
  keys: string[];
  label: string;
  category: 'General' | 'Viewports & Panels' | 'Editing & Elements';
}

export const KEYBOARD_SHORTCUTS: ShortcutDefinition[] = [
  { action: 'undo', keys: ['Ctrl / Cmd', 'Z'], label: 'Undo last visual or code edit', category: 'General' },
  { action: 'redo', keys: ['Ctrl / Cmd', 'Shift', 'Z'], label: 'Redo edit (also Ctrl/Cmd + Y)', category: 'General' },
  { action: 'save', keys: ['Ctrl / Cmd', 'S'], label: 'Save changes to disk / storage', category: 'General' },
  { action: 'toggle-mode', keys: ['Ctrl / Cmd', 'E'], label: 'Toggle Editing Mode / Using Mode', category: 'General' },
  { action: 'open-shortcuts', keys: ['?'], label: 'Open Keyboard Shortcuts reference', category: 'General' },
  { action: 'escape', keys: ['Esc'], label: 'Deselect element or close open modal', category: 'General' },
  { action: 'toggle-left-sidebar', keys: ['Ctrl / Cmd', 'B'], label: 'Collapse / expand Project Files sidebar', category: 'Viewports & Panels' },
  { action: 'toggle-right-sidebar', keys: ['Ctrl / Cmd', 'I'], label: 'Collapse / expand Inspector sidebar', category: 'Viewports & Panels' },
  { action: 'viewport-desktop', keys: ['1'], label: 'Switch to Desktop viewport', category: 'Viewports & Panels' },
  { action: 'viewport-tablet', keys: ['2'], label: 'Switch to Tablet viewport', category: 'Viewports & Panels' },
  { action: 'viewport-mobile', keys: ['3'], label: 'Switch to Mobile viewport', category: 'Viewports & Panels' },
  { action: 'duplicate', keys: ['Ctrl / Cmd', 'D'], label: 'Duplicate selected element', category: 'Editing & Elements' },
  { action: 'delete', keys: ['Del / Backspace'], label: 'Remove selected element', category: 'Editing & Elements' },
  { action: 'move-up', keys: ['Alt', '↑'], label: 'Reorder selected element up among siblings', category: 'Editing & Elements' },
  { action: 'move-down', keys: ['Alt', '↓'], label: 'Reorder selected element down among siblings', category: 'Editing & Elements' },
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

  if (ctx.isTyping) {
    return null;
  }

  if (hasMod && !event.altKey) {
    if (keyLower === 'z' && !event.shiftKey) return 'undo';
    if (keyLower === 'y' || (keyLower === 'z' && event.shiftKey)) return 'redo';
    if (keyLower === 'e') return 'toggle-mode';
    if (keyLower === 'b') return 'toggle-left-sidebar';
    if (keyLower === 'i') return 'toggle-right-sidebar';
    if (keyLower === 'd' && ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
      return 'duplicate';
    }
    return null;
  }

  if (event.altKey && !hasMod && ctx.editorMode === 'edit' && ctx.hasSelectedElement) {
    if (event.key === 'ArrowUp') return 'move-up';
    if (event.key === 'ArrowDown') return 'move-down';
  }

  if (!hasMod && !event.altKey) {
    if (event.key === '?') return 'open-shortcuts';
    if (ctx.hasOpenModal) return null;

    if (event.key === '1') return 'viewport-desktop';
    if (event.key === '2') return 'viewport-tablet';
    if (event.key === '3') return 'viewport-mobile';

    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      ctx.editorMode === 'edit' &&
      ctx.hasSelectedElement
    ) {
      return 'delete';
    }
  }

  return null;
}

export function classifyViewportPresetFromWidth(widthPx: number): ViewportPreset {
  if (widthPx < 560) return 'mobile';
  if (widthPx < 992) return 'tablet';
  return 'desktop';
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Blocks,
  Command,
  CornerDownLeft,
  Download,
  Eye,
  FileJson,
  GitBranch,
  History,
  Home,
  Image as ImageIcon,
  Keyboard,
  LayoutTemplate,
  Maximize2,
  MousePointer2,
  Plus,
  Redo2,
  Replace,
  Search,
  Shapes,
  Type,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import { DRAGGABLE_COMPONENTS } from '../utils/componentCatalog';
import { STUDIO_FONT_CATALOG } from '../utils/fontLibrary';
import { SAMPLE_TEMPLATES } from '../utils/sampleTemplates';

export interface CommandItem {
  id: string;
  group: 'Actions' | 'Fonts' | 'Insert' | 'Templates';
  label: string;
  detail?: string;
  shortcut?: string;
  disabled?: boolean;
  icon: React.ReactNode;
  run: () => void;
}

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  hasSelectedElement: boolean;
  editorMode: 'edit' | 'interact';
  onToggleMode: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggleZen: () => void;
  onToggleOutlines: () => void;
  onZoom100: () => void;
  onZoomFit: () => void;
  onOpenStartHub: () => void;
  onOpenShortcuts: () => void;
  onOpenProjectStats?: () => void;
  onOpenGlobalFindReplace?: () => void;
  onOpenHistoryTimeline?: () => void;
  onToggleComponentLibrary?: () => void;
  onOpenGithub: () => void;
  onExportZip: () => void;
  onExportJson?: () => void;
  onExportPngSnapshot?: () => void;
  onExportSvgSnapshot?: () => void;
  onApplyFont: (fontCssValue: string, label: string) => void;
  onQuickInsertComponent: (componentId: string) => void;
  onSelectTemplate: (templateId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  open,
  onClose,
  hasSelectedElement,
  editorMode,
  onToggleMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onToggleZen,
  onToggleOutlines,
  onZoom100,
  onZoomFit,
  onOpenStartHub,
  onOpenShortcuts,
  onOpenProjectStats,
  onOpenGlobalFindReplace,
  onOpenHistoryTimeline,
  onToggleComponentLibrary,
  onOpenGithub,
  onExportZip,
  onExportJson,
  onExportPngSnapshot,
  onExportSvgSnapshot,
  onApplyFont,
  onQuickInsertComponent,
  onSelectTemplate,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const allItems = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        id: 'act-toggle-mode',
        group: 'Actions',
        label: editorMode === 'edit' ? 'Switch to Using Mode (Interactive)' : 'Switch to Editing Mode',
        shortcut: 'Ctrl+E',
        icon: <MousePointer2 className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />,
        run: onToggleMode,
      },
      {
        id: 'act-undo',
        group: 'Actions',
        label: 'Undo Last Edit',
        shortcut: 'Ctrl+Z',
        disabled: !canUndo,
        icon: <Undo2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onUndo,
      },
      {
        id: 'act-redo',
        group: 'Actions',
        label: 'Redo Edit',
        shortcut: 'Ctrl+Shift+Z',
        disabled: !canRedo,
        icon: <Redo2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onRedo,
      },
      {
        id: 'act-zen',
        group: 'Actions',
        label: 'Toggle Zen Focus Mode (Hide Both Sidebars)',
        shortcut: 'Ctrl+\\',
        icon: <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onToggleZen,
      },
      {
        id: 'act-outlines',
        group: 'Actions',
        label: 'Toggle Layout Outlines',
        shortcut: 'G',
        icon: <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onToggleOutlines,
      },
      {
        id: 'act-zoom-fit',
        group: 'Actions',
        label: 'Zoom Canvas to Fit Screen',
        shortcut: 'Shift+1',
        icon: <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onZoomFit,
      },
      {
        id: 'act-zoom-100',
        group: 'Actions',
        label: 'Reset Canvas Zoom to 100%',
        shortcut: 'Ctrl+0',
        icon: <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onZoom100,
      },
      {
        id: 'act-hub',
        group: 'Actions',
        label: 'Open Start Hub / Switch Project',
        icon: <Home className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />,
        run: onOpenStartHub,
      },
      ...(onOpenGlobalFindReplace
        ? [
            {
              id: 'act-global-find-replace',
              group: 'Actions' as const,
              label: 'Global Find & Replace Across All Project Files',
              detail: 'Search text, regex, or whole words and bulk replace',
              shortcut: 'Ctrl+Shift+F',
              icon: <Replace className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />,
              run: onOpenGlobalFindReplace,
            },
          ]
        : []),
      ...(onOpenProjectStats
        ? [
            {
              id: 'act-project-stats',
              group: 'Actions' as const,
              label: 'View Project Statistics (Files, LOC & Distribution)',
              icon: <BarChart3 className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.5} />,
              run: onOpenProjectStats,
            },
          ]
        : []),
      ...(onToggleComponentLibrary
        ? [
            {
              id: 'act-component-library',
              group: 'Actions' as const,
              label: 'Toggle Component Library Sidebar Drawer',
              icon: <Blocks className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />,
              run: onToggleComponentLibrary,
            },
          ]
        : []),
      ...(onOpenHistoryTimeline
        ? [
            {
              id: 'act-history-timeline',
              group: 'Actions' as const,
              label: 'Open Visual History Timeline (Jump to Any State)',
              icon: <History className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />,
              run: onOpenHistoryTimeline,
            },
          ]
        : []),
      {
        id: 'act-github',
        group: 'Actions',
        label: 'GitHub Commit & Pull Modal',
        icon: <GitBranch className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />,
        run: onOpenGithub,
      },
      {
        id: 'act-shortcuts',
        group: 'Actions',
        label: 'View All Keyboard Shortcuts',
        shortcut: 'Shift+?',
        icon: <Keyboard className="w-3.5 h-3.5" strokeWidth={1.5} />,
        run: onOpenShortcuts,
      },
      {
        id: 'act-export',
        group: 'Actions',
        label: 'Export Project as ZIP Archive',
        icon: <Download className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />,
        run: onExportZip,
      },
      ...(onExportJson
        ? [
            {
              id: 'act-export-json',
              group: 'Actions' as const,
              label: 'Export Project Structure to JSON',
              icon: <FileJson className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />,
              run: onExportJson,
            },
          ]
        : []),
      ...(onExportPngSnapshot
        ? [
            {
              id: 'act-export-png',
              group: 'Actions' as const,
              label: 'Export Visual Preview as PNG Snapshot',
              icon: <ImageIcon className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.5} />,
              run: onExportPngSnapshot,
            },
          ]
        : []),
      ...(onExportSvgSnapshot
        ? [
            {
              id: 'act-export-svg',
              group: 'Actions' as const,
              label: 'Export Visual Preview as SVG Snapshot',
              icon: <ImageIcon className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.5} />,
              run: onExportSvgSnapshot,
            },
          ]
        : []),
    ];

    const fontItems: CommandItem[] = STUDIO_FONT_CATALOG.map((font) => ({
      id: `font-${font.id}`,
      group: 'Fonts',
      label: `Font: ${font.label}`,
      detail: hasSelectedElement ? font.category : `${font.category} · Select an element first`,
      disabled: !hasSelectedElement,
      icon: <Type className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.5} />,
      run: () => onApplyFont(font.cssValue, font.label),
    }));

    const insertItems: CommandItem[] = DRAGGABLE_COMPONENTS.slice(0, 14).map((comp) => ({
      id: `insert-${comp.id}`,
      group: 'Insert',
      label: `Insert ${comp.name}`,
      detail: comp.category,
      icon:
        comp.category === 'Shapes & Lines' ? (
          <Shapes className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
        ) : (
          <Plus className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
        ),
      run: () => onQuickInsertComponent(comp.id),
    }));

    const templateItems: CommandItem[] = SAMPLE_TEMPLATES.map((tpl) => ({
      id: `tpl-${tpl.id}`,
      group: 'Templates',
      label: `Template: ${tpl.name}`,
      detail: tpl.category || 'Starter',
      icon: <LayoutTemplate className="w-3.5 h-3.5 text-sky-400" strokeWidth={1.5} />,
      run: () => onSelectTemplate(tpl.id),
    }));

    return [...actions, ...insertItems, ...fontItems, ...templateItems];
  }, [
    editorMode,
    canUndo,
    canRedo,
    hasSelectedElement,
    onToggleMode,
    onUndo,
    onRedo,
    onToggleZen,
    onToggleOutlines,
    onZoomFit,
    onZoom100,
    onOpenStartHub,
    onOpenProjectStats,
    onOpenGlobalFindReplace,
    onOpenHistoryTimeline,
    onToggleComponentLibrary,
    onOpenGithub,
    onOpenShortcuts,
    onExportZip,
    onExportJson,
    onExportPngSnapshot,
    onExportSvgSnapshot,
    onApplyFont,
    onQuickInsertComponent,
    onSelectTemplate,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return allItems.filter((item) => item.group === 'Actions' || item.group === 'Templates').slice(0, 18);
    }
    return allItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.detail && item.detail.toLowerCase().includes(q)) ||
          item.group.toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [allItems, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const executeItem = (item: CommandItem | undefined) => {
    if (!item || item.disabled) return;
    onClose();
    item.run();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center pt-20 bg-[var(--studio-modal-backdrop)] backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl studio-modal-panel rounded-2xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl studio-card-highlight overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[var(--studio-border)] flex items-center gap-2.5">
          <Search className="w-4 h-4 text-[var(--studio-muted)] shrink-0" strokeWidth={1.6} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((prev) =>
                  filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((prev) =>
                  filteredItems.length === 0
                    ? 0
                    : (prev - 1 + filteredItems.length) % filteredItems.length
                );
              } else if (e.key === 'Enter') {
                e.preventDefault();
                executeItem(filteredItems[activeIndex]);
              }
            }}
            placeholder="Type a command, Google font, component, or template..."
            aria-label="Command Palette Search"
            className="flex-1 bg-transparent text-[13px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[10.5px] font-mono-tabular text-[var(--studio-muted)]">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto builder-scroll p-1.5 space-y-0.5">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--studio-muted)]">
              No matching commands for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => executeItem(item)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-indigo-500/18 text-[var(--studio-text-strong)]'
                      : 'text-[var(--studio-text)] hover:bg-[var(--studio-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{item.label}</div>
                      {item.detail && (
                        <div className="text-[11px] text-[var(--studio-muted)] truncate">
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--studio-muted-soft)]">
                      {item.group}
                    </span>
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[10.5px] font-mono-tabular text-[var(--studio-muted)]">
                        {item.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3 h-3 text-indigo-400" strokeWidth={1.5} />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-3.5 py-2 border-t border-[var(--studio-border)] bg-[var(--studio-elevated)] flex items-center justify-between text-[11px] text-[var(--studio-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3 h-3" />
            <span>Use ↑ ↓ and Enter to run</span>
          </span>
          <span>29 Google &amp; System Fonts · Templates · Quick Actions</span>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo, useState } from 'react';
import {
  Blocks,
  Eye,
  FolderTree,
  GripVertical,
  Monitor,
  Plus,
  Search,
  Smartphone,
  X,
} from 'lucide-react';
import type { ComponentLibraryGroup, DraggableComponentDef } from '../types/editor';
import { COMPONENT_LIBRARY_ITEMS } from '../utils/componentCatalog';

interface ComponentLibraryDrawerProps {
  widthPx: number;
  onClose: () => void;
  onShowFiles: () => void;
  onDragStartComponent: (component: DraggableComponentDef) => void;
  onDragEndComponent: () => void;
  onInsertComponent: (component: DraggableComponentDef) => void;
}

type LibraryFilterTab = 'All' | ComponentLibraryGroup;

const LIBRARY_TABS: LibraryFilterTab[] = [
  'All',
  'Heroes',
  'Cards',
  'Buttons',
  'Navigation',
  'Forms',
  'Layout',
];

function buildComponentPreviewSrcDoc(snippetHtml: string, compactMode = false): string {
  const safeHtml = snippetHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: ${compactMode ? '10px' : '14px'};
        background: #ffffff;
        color: #0f172a;
        font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      body > * {
        max-width: 100%;
      }
    </style>
  </head>
  <body>${safeHtml}</body>
</html>`;
}

export const ComponentLibraryDrawer: React.FC<ComponentLibraryDrawerProps> = ({
  widthPx,
  onClose,
  onShowFiles,
  onDragStartComponent,
  onDragEndComponent,
  onInsertComponent,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<LibraryFilterTab>('All');
  const [previewComponentId, setPreviewComponentId] = useState<string>(
    COMPONENT_LIBRARY_ITEMS[0]?.id ?? 'hero-split'
  );
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'compact'>('desktop');
  const [showLiveStage, setShowLiveStage] = useState(true);

  const filteredComponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return COMPONENT_LIBRARY_ITEMS.filter((item) => {
      if (activeGroup !== 'All' && item.libraryGroup !== activeGroup) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.libraryGroup && item.libraryGroup.toLowerCase().includes(q))
      );
    });
  }, [activeGroup, searchQuery]);

  const activePreviewItem = useMemo(() => {
    return (
      COMPONENT_LIBRARY_ITEMS.find((item) => item.id === previewComponentId) ??
      filteredComponents[0] ??
      COMPONENT_LIBRARY_ITEMS[0]
    );
  }, [previewComponentId, filteredComponents]);

  const drawerWidth = Math.max(widthPx, 296);

  return (
    <aside
      data-testid="component-library-drawer"
      aria-label="Component Library Drawer"
      style={{ width: `${drawerWidth}px` }}
      className="shrink-0 border border-[var(--studio-border)] rounded-[14px] bg-[var(--studio-surface)] studio-panel-shadow flex flex-col min-h-0 overflow-hidden"
    >
      {/* Drawer Header */}
      <div className="h-9 px-3 border-b border-[var(--studio-border)] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Blocks className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" strokeWidth={1.6} />
          <span className="studio-section-header truncate">Component Library</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onShowFiles}
            title="Switch to Project Files"
            className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
          >
            <FolderTree className="w-3 h-3" strokeWidth={1.5} />
            Files
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Component Library drawer"
            title="Close Component Library"
            className="p-1 rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Search & Category Tabs */}
      <div className="px-2.5 py-2 border-b border-[var(--studio-border)] space-y-2 shrink-0 bg-[var(--studio-surface)]">
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
            strokeWidth={1.4}
          />
          <input
            type="text"
            aria-label="Filter pre-styled components"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search heroes, cards, buttons..."
            className="w-full h-7 bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/50 border border-[var(--studio-border)] rounded-md pl-7.5 pr-7 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear component search"
              className="absolute right-1.5 p-0.5 rounded text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.4} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Component Categories">
          {LIBRARY_TABS.map((tab) => {
            const active = activeGroup === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveGroup(tab)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-[var(--studio-elevated)] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Live Preview Inspector Stage */}
      {activePreviewItem && (
        <div className="border-b border-[var(--studio-border)] bg-[var(--studio-bg)] px-2.5 py-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowLiveStage((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--studio-text-strong)] cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
              <span>Live Preview: {activePreviewItem.name}</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                aria-label="Desktop preview scale"
                title="Wide preview"
                className={`p-1 rounded cursor-pointer ${
                  previewViewport === 'desktop'
                    ? 'bg-[var(--studio-hover)] text-[var(--studio-text-strong)]'
                    : 'text-[var(--studio-muted-soft)] hover:text-[var(--studio-text)]'
                }`}
              >
                <Monitor className="w-3 h-3" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('compact')}
                aria-label="Compact mobile preview scale"
                title="Compact preview"
                className={`p-1 rounded cursor-pointer ${
                  previewViewport === 'compact'
                    ? 'bg-[var(--studio-hover)] text-[var(--studio-text-strong)]'
                    : 'text-[var(--studio-muted-soft)] hover:text-[var(--studio-text)]'
                }`}
              >
                <Smartphone className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {showLiveStage && (
            <div
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', activePreviewItem.id);
                e.dataTransfer.effectAllowed = 'copy';
                onDragStartComponent(activePreviewItem);
              }}
              onDragEnd={onDragEndComponent}
              data-testid="component-live-preview-stage"
              title="Drag preview directly onto the canvas or click Insert"
              className="mt-2 rounded-lg border border-[var(--studio-border)] bg-white overflow-hidden cursor-grab active:cursor-grabbing"
            >
              <div
                className="relative w-full overflow-hidden bg-white mx-auto transition-all"
                style={{
                  height: '124px',
                  maxWidth: previewViewport === 'compact' ? '210px' : '100%',
                }}
              >
                <iframe
                  title={`Live preview of ${activePreviewItem.name}`}
                  srcDoc={buildComponentPreviewSrcDoc(
                    activePreviewItem.html,
                    previewViewport === 'compact'
                  )}
                  sandbox=""
                  tabIndex={-1}
                  style={{
                    width: previewViewport === 'compact' ? '340px' : '640px',
                    height: '290px',
                    transform: previewViewport === 'compact' ? 'scale(0.58)' : 'scale(0.42)',
                    transformOrigin: 'top left',
                  }}
                  className="border-0 pointer-events-none select-none block bg-white"
                />
              </div>
              <div className="px-2.5 py-1.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-slate-600 truncate">
                  Drag to canvas or insert
                </span>
                <button
                  type="button"
                  onClick={() => onInsertComponent(activePreviewItem)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-[10.5px] font-semibold text-white cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" strokeWidth={1.8} />
                  Insert
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draggable Component Cards with Inline Live Previews */}
      <div className="flex-1 overflow-y-auto builder-scroll p-2.5 space-y-2.5">
        {filteredComponents.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--studio-muted-soft)]">
            No components match &ldquo;{searchQuery.trim()}&rdquo;.
          </div>
        ) : (
          filteredComponents.map((item) => {
            const isSelectedPreview = activePreviewItem?.id === item.id;
            return (
              <div
                key={item.id}
                data-testid={`library-component-${item.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', item.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  setPreviewComponentId(item.id);
                  onDragStartComponent(item);
                }}
                onDragEnd={onDragEndComponent}
                onMouseEnter={() => setPreviewComponentId(item.id)}
                onClick={() => setPreviewComponentId(item.id)}
                className={`group rounded-xl border bg-[var(--studio-elevated)] studio-card-highlight overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
                  isSelectedPreview
                    ? 'border-indigo-500/65 ring-1 ring-indigo-500/25'
                    : 'border-[var(--studio-border)] hover:border-[var(--studio-border-strong)]'
                }`}
              >
                {/* Live Scaled HTML/CSS Thumbnail */}
                <div className="relative h-22 w-full bg-white border-b border-[var(--studio-border)] overflow-hidden">
                  <iframe
                    title={`${item.name} thumbnail`}
                    srcDoc={buildComponentPreviewSrcDoc(item.html)}
                    sandbox=""
                    tabIndex={-1}
                    style={{
                      width: '620px',
                      height: '240px',
                      transform: 'scale(0.41)',
                      transformOrigin: 'top left',
                    }}
                    className="border-0 pointer-events-none select-none block bg-white"
                  />
                </div>

                {/* Metadata & Actions */}
                <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <GripVertical
                      className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] mt-0.5 shrink-0"
                      strokeWidth={1.5}
                    />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--studio-text-strong)] truncate">
                        {item.name}
                      </div>
                      <div className="text-[10.5px] text-[var(--studio-muted)] truncate">
                        {item.libraryGroup ?? item.category} · {item.description}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewComponentId(item.id);
                      onInsertComponent(item);
                    }}
                    aria-label={`Insert ${item.name}`}
                    title={`Insert ${item.name} onto canvas`}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-[var(--studio-surface)] hover:bg-indigo-600 text-[11px] font-semibold text-[var(--studio-text-strong)] hover:text-white border border-[var(--studio-border)] hover:border-indigo-500 transition-colors shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" strokeWidth={1.7} />
                    Add
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

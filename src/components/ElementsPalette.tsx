import React, { useMemo, useState } from 'react';
import { GripVertical, Plus, Search, Shapes } from 'lucide-react';
import type { DomTreeNode, DraggableComponentDef } from '../types/editor';
import { DRAGGABLE_COMPONENTS, SVG_SHAPE_TOOL_ITEMS } from '../utils/componentCatalog';
import { DomOutlineTree } from './DomOutlineTree';
import { HoverIconButton } from './StudioPrimitives';

interface ElementsPaletteProps {
  hasSelectedTarget: boolean;
  domTree: DomTreeNode[];
  selectedNodeKey: string | null;
  onSelectDomNode: (nodeId: string) => void;
  onHoverDomNode: (nodeId: string | null) => void;
  onDragStartComponent: (component: DraggableComponentDef) => void;
  onDragEndComponent: () => void;
  onInsertComponent: (component: DraggableComponentDef) => void;
}

const CATEGORY_ORDER: DraggableComponentDef['category'][] = [
  'Components',
  'Shapes & Lines',
  'Tables & Lists',
  'Layout',
  'Typography',
  'Inputs',
];

export const ElementsPalette: React.FC<ElementsPaletteProps> = ({
  hasSelectedTarget,
  domTree,
  selectedNodeKey,
  onSelectDomNode,
  onHoverDomNode,
  onDragStartComponent,
  onDragEndComponent,
  onInsertComponent,
}) => {
  const [filterText, setFilterText] = useState('');

  const filteredSvgTools = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return SVG_SHAPE_TOOL_ITEMS.filter(
      (tool) => !q || tool.label.toLowerCase().includes(q) || 'svg shape vector'.includes(q)
    );
  }, [filterText]);

  const filteredByCategory = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: DRAGGABLE_COMPONENTS.filter(
        (item) =>
          item.category === category &&
          (!q ||
            item.name.toLowerCase().includes(q) ||
            item.description.toLowerCase().includes(q))
      ),
    })).filter((group) => group.items.length > 0);
  }, [filterText]);

  const resolveToolComponent = (id: string): DraggableComponentDef | undefined =>
    DRAGGABLE_COMPONENTS.find((c) => c.id === id);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--studio-surface)]">
      <DomOutlineTree
        nodes={domTree}
        selectedNodeKey={selectedNodeKey}
        onSelectNode={onSelectDomNode}
        onHoverNode={onHoverDomNode}
      />

      <div className="p-2.5 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] space-y-1.5 shrink-0">
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
            strokeWidth={1.4}
          />
          <input
            type="text"
            aria-label="Filter UI elements"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter elements or SVG shapes..."
            className="w-full h-7 bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/50 border border-[var(--studio-border)] rounded-md pl-7.5 pr-2.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
          />
        </div>
        <p className="text-[11px] text-[var(--studio-muted)] leading-snug">
          Drag onto Live Canvas or insert{' '}
          {hasSelectedTarget ? 'into/after selection.' : 'at end of page.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-2.5 space-y-4">
        {/* Dedicated SVG Shapes Tool */}
        {filteredSvgTools.length > 0 && (
          <section aria-label="Shapes Tool" className="space-y-2 pb-3 border-b border-[var(--studio-border)]">
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.4} />
                Shapes (SVG)
              </h3>
              <span className="text-[10.5px] text-[var(--studio-muted-soft)]">Click or drag</span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {filteredSvgTools.map((tool) => {
                const comp = resolveToolComponent(tool.id);
                if (!comp) return null;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('text/plain', comp.id);
                      onDragStartComponent(comp);
                    }}
                    onDragEnd={onDragEndComponent}
                    onClick={() => onInsertComponent(comp)}
                    aria-label={`Insert ${tool.label} shape`}
                    title={`Insert ${tool.label} (SVG)`}
                    className="group flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] hover:border-indigo-500/50 studio-card-highlight studio-pressable cursor-pointer"
                  >
                    <svg
                      viewBox={tool.viewBox}
                      className="w-5 h-5 shrink-0"
                      aria-hidden="true"
                    >
                      {(() => {
                        const { 'stroke-width': strokeWidthAttr, ...restAttrs } = tool.attrs;
                        const sw = strokeWidthAttr ?? '4';
                        if (tool.primitive === 'circle') {
                          return <circle {...restAttrs} strokeWidth={sw} />;
                        }
                        if (tool.primitive === 'polygon') {
                          return <polygon {...restAttrs} strokeWidth={sw} />;
                        }
                        return <path {...restAttrs} strokeWidth={sw} />;
                      })()}
                    </svg>
                    <span className="text-[10px] font-medium text-[var(--studio-text-secondary)] group-hover:text-[var(--studio-text-strong)] truncate w-full text-center">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {filteredByCategory.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--studio-muted-soft)]">
            No matching components found.
          </div>
        ) : (
          filteredByCategory.map((group) => (
            <section key={group.category} className="space-y-1.5">
              <h3 className="studio-section-header">{group.category}</h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'copy';
                      e.dataTransfer.setData('text/plain', item.id);
                      onDragStartComponent(item);
                    }}
                    onDragEnd={onDragEndComponent}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/70 hover:border-[var(--studio-border-strong)] studio-card-highlight transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] shrink-0" strokeWidth={1.4} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-[var(--studio-text-strong)] truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[var(--studio-muted)] truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <HoverIconButton
                      size="xs"
                      tone="accent"
                      active
                      onClick={() => onInsertComponent(item)}
                      label="Insert"
                      ariaLabel={`Insert ${item.name}`}
                      title={`Insert ${item.name}`}
                      icon={<Plus className="w-3 h-3" strokeWidth={1.6} />}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

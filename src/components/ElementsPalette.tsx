import React, { useMemo, useState } from 'react';
import { GripVertical, Plus, Search, Shapes } from 'lucide-react';
import type { DraggableComponentDef } from '../types/editor';
import { DRAGGABLE_COMPONENTS, SVG_SHAPE_TOOL_ITEMS } from '../utils/componentCatalog';

interface ElementsPaletteProps {
  hasSelectedTarget: boolean;
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-slate-800/80 bg-[#0a0f18] space-y-2 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            aria-label="Filter UI elements"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter elements or SVG shapes..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <p className="text-[11px] text-slate-400 leading-snug">
          Drag onto the Live Canvas or click to insert{' '}
          {hasSelectedTarget ? 'into/after selected element.' : 'at end of page.'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-3 space-y-4">
        {/* Dedicated SVG Shapes Tool */}
        {filteredSvgTools.length > 0 && (
          <section aria-label="Shapes Tool" className="space-y-2 pb-3 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-sky-400" />
                Shapes (SVG)
              </h3>
              <span className="text-[10px] text-slate-500">Click or drag to canvas</span>
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
                    className="group flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <svg
                      viewBox={tool.viewBox}
                      className="w-6 h-6 shrink-0"
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
                    <span className="text-[10px] text-slate-300 group-hover:text-white truncate w-full text-center">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {filteredByCategory.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No matching components found.
          </div>
        ) : (
          filteredByCategory.map((group) => (
            <section key={group.category} className="space-y-2">
              <h3 className="text-[11px] font-semibold text-slate-400 tracking-wide">
                {group.category}
              </h3>
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
                    className="group flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-800/90 bg-slate-900/60 hover:bg-slate-800/70 hover:border-slate-700 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <GripVertical className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInsertComponent(item)}
                      aria-label={`Insert ${item.name}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-blue-300 bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 transition-colors shrink-0 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Insert
                    </button>
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

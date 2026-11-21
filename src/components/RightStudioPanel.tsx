import React from 'react';
import { Globe, Layers, Palette, PanelRightClose, SlidersHorizontal } from 'lucide-react';
import type {
  DomTreeNode,
  DraggableComponentDef,
  ResponsiveScope,
  RightPanelTab,
  SelectedElementInfo,
  SeoMetaValues,
} from '../types/editor';
import { ElementsPalette } from './ElementsPalette';
import { GlobalStylesPanel } from './GlobalStylesPanel';
import { InspectorPanel } from './InspectorPanel';
import { SeoMetaPanel } from './SeoMetaPanel';
import type { SvgShapeHtmlPatch } from '../utils/htmlSync';

interface RightStudioPanelProps {
  widthPx: number;
  onCollapse: () => void;
  activeTab: RightPanelTab;
  onChangeTab: (tab: RightPanelTab) => void;
  selectedElement: SelectedElementInfo | null;
  domTree: DomTreeNode[];
  onSelectDomNode: (nodeId: string) => void;
  onHoverDomNode: (nodeId: string | null) => void;
  onViewInCode: () => void;
  onHoverSpacing: (kind: 'margin' | 'padding' | null) => void;
  aspectRatioLocked: boolean;
  onToggleAspectRatioLock: (locked: boolean) => void;
  responsiveScope: ResponsiveScope;
  onChangeResponsiveScope: (scope: ResponsiveScope) => void;
  activeHtmlPath: string | null;
  activeHtmlContent: string;
  htmlPages: string[];
  primaryCssPath: string | null;
  stylesCssContent: string;
  onPreviewStyle: (styles: Record<string, string>) => void;
  onCommitStyle: (styles: Record<string, string | null>, label: string) => void;
  onCommitResponsiveStyle: (
    scope: ResponsiveScope,
    styles: Record<string, string | null>,
    label: string
  ) => void;
  onToggleDeviceVisibility: (device: 'desktop' | 'tablet' | 'mobile') => void;
  onPreviewText: (text: string) => void;
  onCommitText: (text: string) => void;
  onCommitAttributes: (attributes: Record<string, string | null>, label: string) => void;
  onPreviewSvgShape: (patch: SvgShapeHtmlPatch) => void;
  onCommitSvgShape: (patch: SvgShapeHtmlPatch, label: string) => void;
  onCreatePageAndLink: (pageName: string) => void;
  onAddTableRow: () => void;
  onRemoveTableRow: () => void;
  onAddTableColumn: () => void;
  onRemoveTableColumn: () => void;
  onUpdateTableCellStyles: (cellStyles: Record<string, string | null>, label: string) => void;
  onToggleTableStriped: (striped: boolean) => void;
  onDuplicateElement: () => void;
  onRemoveElement: () => void;
  onToggleVisibility: () => void;
  onDragStartComponent: (component: DraggableComponentDef) => void;
  onDragEndComponent: () => void;
  onInsertComponent: (component: DraggableComponentDef) => void;
  onCommitSeoMeta: (patch: Partial<SeoMetaValues>, label: string) => void;
  onPreviewRootVar: (name: string, value: string) => void;
  onCommitRootVar: (name: string, value: string, label: string) => void;
  onDeleteRootVar: (name: string) => void;
}

export const RightStudioPanel: React.FC<RightStudioPanelProps> = ({
  widthPx,
  onCollapse,
  activeTab,
  onChangeTab,
  selectedElement,
  domTree,
  onSelectDomNode,
  onHoverDomNode,
  onViewInCode,
  onHoverSpacing,
  aspectRatioLocked,
  onToggleAspectRatioLock,
  responsiveScope,
  onChangeResponsiveScope,
  activeHtmlPath,
  activeHtmlContent,
  htmlPages,
  primaryCssPath,
  stylesCssContent,
  onPreviewStyle,
  onCommitStyle,
  onCommitResponsiveStyle,
  onToggleDeviceVisibility,
  onPreviewText,
  onCommitText,
  onCommitAttributes,
  onPreviewSvgShape,
  onCommitSvgShape,
  onCreatePageAndLink,
  onAddTableRow,
  onRemoveTableRow,
  onAddTableColumn,
  onRemoveTableColumn,
  onUpdateTableCellStyles,
  onToggleTableStriped,
  onDuplicateElement,
  onRemoveElement,
  onToggleVisibility,
  onDragStartComponent,
  onDragEndComponent,
  onInsertComponent,
  onCommitSeoMeta,
  onPreviewRootVar,
  onCommitRootVar,
  onDeleteRootVar,
}) => {
  return (
    <aside
      data-testid="right-sidebar"
      style={{ width: `${widthPx}px` }}
      className="shrink-0 border-l border-white/[0.08] bg-[#111114] flex flex-col min-h-0"
    >
      {/* Pill Segmented Right Panel Tabs + Collapse Button */}
      <div className="h-10 px-2 border-b border-white/[0.08] flex items-center gap-1.5 shrink-0">
        <div
          className="flex items-center justify-between gap-0.5 flex-1 min-w-0 p-0.5 rounded-full bg-[#09090b] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden"
          role="tablist"
          aria-label="Right Studio Panel"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inspector'}
            onClick={() => onChangeTab('inspector')}
            className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-full text-[10.5px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            Inspector
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'elements'}
            onClick={() => onChangeTab('elements')}
            className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-full text-[10.5px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'elements'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            Elements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'seo'}
            onClick={() => onChangeTab('seo')}
            className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-full text-[10.5px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'seo'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Globe className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            SEO &amp; Meta
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'global-styles'}
            onClick={() => onChangeTab('global-styles')}
            className={`inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded-full text-[10.5px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'global-styles'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Palette className="w-3 h-3 shrink-0" strokeWidth={1.5} />
            Global Styles
          </button>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse Inspector sidebar"
          title="Collapse Inspector (Ctrl+I)"
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors shrink-0 cursor-pointer"
        >
          <PanelRightClose className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {activeTab === 'inspector' && (
        <InspectorPanel
          selectedElement={selectedElement}
          aspectRatioLocked={aspectRatioLocked}
          onToggleAspectRatioLock={onToggleAspectRatioLock}
          responsiveScope={responsiveScope}
          onChangeResponsiveScope={onChangeResponsiveScope}
          stylesCssContent={stylesCssContent}
          activeHtmlContent={activeHtmlContent}
          htmlPages={htmlPages}
          onPreviewStyle={onPreviewStyle}
          onCommitStyle={onCommitStyle}
          onCommitResponsiveStyle={onCommitResponsiveStyle}
          onToggleDeviceVisibility={onToggleDeviceVisibility}
          onPreviewText={onPreviewText}
          onCommitText={onCommitText}
          onCommitAttributes={onCommitAttributes}
          onPreviewSvgShape={onPreviewSvgShape}
          onCommitSvgShape={onCommitSvgShape}
          onCreatePageAndLink={onCreatePageAndLink}
          onAddTableRow={onAddTableRow}
          onRemoveTableRow={onRemoveTableRow}
          onAddTableColumn={onAddTableColumn}
          onRemoveTableColumn={onRemoveTableColumn}
          onUpdateTableCellStyles={onUpdateTableCellStyles}
          onToggleTableStriped={onToggleTableStriped}
          onDuplicateElement={onDuplicateElement}
          onRemoveElement={onRemoveElement}
          onToggleVisibility={onToggleVisibility}
          onViewInCode={onViewInCode}
          onHoverSpacing={onHoverSpacing}
        />
      )}

      {activeTab === 'elements' && (
        <ElementsPalette
          hasSelectedTarget={Boolean(selectedElement?.veId || selectedElement?.runtimeId)}
          domTree={domTree}
          selectedNodeKey={selectedElement ? selectedElement.veId || selectedElement.runtimeId : null}
          onSelectDomNode={onSelectDomNode}
          onHoverDomNode={onHoverDomNode}
          onDragStartComponent={onDragStartComponent}
          onDragEndComponent={onDragEndComponent}
          onInsertComponent={onInsertComponent}
        />
      )}

      {activeTab === 'seo' && (
        <SeoMetaPanel
          htmlPath={activeHtmlPath}
          htmlContent={activeHtmlContent}
          onCommitSeoMeta={onCommitSeoMeta}
        />
      )}

      {activeTab === 'global-styles' && (
        <GlobalStylesPanel
          cssPath={primaryCssPath}
          cssContent={stylesCssContent}
          onPreviewRootVar={onPreviewRootVar}
          onCommitRootVar={onCommitRootVar}
          onDeleteRootVar={onDeleteRootVar}
        />
      )}
    </aside>
  );
};

import React from 'react';
import { Globe, Layers, Palette, SlidersHorizontal } from 'lucide-react';
import type {
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
  activeTab: RightPanelTab;
  onChangeTab: (tab: RightPanelTab) => void;
  selectedElement: SelectedElementInfo | null;
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
  activeTab,
  onChangeTab,
  selectedElement,
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
    <aside className="w-[380px] shrink-0 border-l border-slate-800/90 bg-[#0c111b] flex flex-col min-h-0">
      {/* Segmented Right Panel Tabs */}
      <div className="h-10 px-2.5 border-b border-slate-800/80 flex items-center shrink-0">
        <div
          className="flex items-center gap-0.5 w-full p-0.5 rounded-md bg-[#090d16] border border-slate-800"
          role="tablist"
          aria-label="Right Studio Panel"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inspector'}
            onClick={() => onChangeTab('inspector')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'inspector'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3 shrink-0" />
            Inspector
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'elements'}
            onClick={() => onChangeTab('elements')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'elements'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            Elements
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'seo'}
            onClick={() => onChangeTab('seo')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'seo'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3 h-3 shrink-0" />
            SEO &amp; Meta
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'global-styles'}
            onClick={() => onChangeTab('global-styles')}
            className={`flex-1 inline-flex items-center justify-center gap-1 py-1 px-1.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'global-styles'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3 h-3 shrink-0" />
            Global Styles
          </button>
        </div>
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
        />
      )}

      {activeTab === 'elements' && (
        <ElementsPalette
          hasSelectedTarget={Boolean(selectedElement?.veId)}
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

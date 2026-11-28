import React from 'react';
import { History, PanelRightClose } from 'lucide-react';
import type {
  DomTreeNode,
  DraggableComponentDef,
  HistoryState,
  ProjectFile,
  BreakpointScope,
  ResponsiveScope,
  RightPanelTab,
  SelectedElementInfo,
  SeoMetaValues,
} from '../types/editor';
import { ElementsPalette } from './ElementsPalette';
import { GlobalStylesPanel } from './GlobalStylesPanel';
import { HistoryTimelinePanel } from './HistoryTimelinePanel';
import { InspectorPanel } from './InspectorPanel';
import { SeoMetaPanel } from './SeoMetaPanel';
import { PlatformConfigPanel } from './PlatformConfigPanel';
import type { RepoTarget } from '../utils/repoTargets';
import type { SvgShapeHtmlPatch } from '../utils/htmlSync';
import type { AiElementCopilotControls } from './AiElementBar';
import {
  DuotoneElementsIcon,
  DuotoneInspectorIcon,
  DuotonePaletteIcon,
  DuotoneSeoIcon,
  HoverIconButton,
} from './StudioPrimitives';

interface RightStudioPanelProps {
  widthPx: number;
  onCollapse: () => void;
  activeTab: RightPanelTab;
  onChangeTab: (tab: RightPanelTab) => void;
  selectedElement: SelectedElementInfo | null;
  projectImageAssets: ProjectFile[];
  onUploadImageAsset: (file: File) => Promise<string | null>;
  domTree: DomTreeNode[];
  onSelectDomNode: (nodeId: string) => void;
  onHoverDomNode: (nodeId: string | null) => void;
  onViewInCode: () => void;
  onHoverSpacing: (kind: 'margin' | 'padding' | null) => void;
  aspectRatioLocked: boolean;
  onToggleAspectRatioLock: (locked: boolean) => void;
  responsiveScope: ResponsiveScope;
  onChangeResponsiveScope: (scope: ResponsiveScope) => void;
  breakpointScope: BreakpointScope;
  onChangeBreakpointScope: (scope: BreakpointScope) => void;
  onResetScopeOverride: (property: string) => void;
  /** Active platform target — desktop/mobile swap the SEO tab for a config inspector. */
  platformTarget?: RepoTarget | null;
  projectFiles?: ProjectFile[];
  activeHtmlPath: string | null;
  activeHtmlContent: string;
  htmlPages: string[];
  primaryCssPath: string | null;
  stylesCssContent: string;
  overrideCssContent?: string;
  onPreviewStyle: (styles: Record<string, string>) => void;
  onCommitStyle: (styles: Record<string, string | null>, label: string) => void;
  onCommitResponsiveStyle: (
    scope: ResponsiveScope | BreakpointScope,
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
  history: HistoryState;
  onUndoHistory: () => void;
  onRedoHistory: () => void;
  onJumpToHistoryIndex: (index: number) => void;
  aiCopilot: AiElementCopilotControls;
}

const STUDIO_PANEL_TABS: Array<{
  id: RightPanelTab;
  label: string;
  renderIcon: (active: boolean) => React.ReactNode;
}> = [
  {
    id: 'inspector',
    label: 'Inspector',
    renderIcon: (active) => (
      <DuotoneInspectorIcon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
    ),
  },
  {
    id: 'elements',
    label: 'Elements',
    renderIcon: (active) => (
      <DuotoneElementsIcon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
    ),
  },
  {
    id: 'seo',
    label: 'SEO & Meta',
    renderIcon: (active) => (
      <DuotoneSeoIcon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
    ),
  },
  {
    id: 'global-styles',
    label: 'Global Styles',
    renderIcon: (active) => (
      <DuotonePaletteIcon className={`w-3.5 h-3.5 ${active ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
    ),
  },
  {
    id: 'history',
    label: 'History',
    renderIcon: (active) => (
      <History
        className={`w-3.5 h-3.5 ${active ? 'text-indigo-500 dark:text-indigo-400' : ''}`}
        strokeWidth={1.6}
      />
    ),
  },
];

export const RightStudioPanel: React.FC<RightStudioPanelProps> = ({
  widthPx,
  onCollapse,
  activeTab,
  onChangeTab,
  selectedElement,
  projectImageAssets,
  onUploadImageAsset,
  domTree,
  onSelectDomNode,
  onHoverDomNode,
  onViewInCode,
  onHoverSpacing,
  aspectRatioLocked,
  onToggleAspectRatioLock,
  responsiveScope,
  onChangeResponsiveScope,
  breakpointScope,
  onChangeBreakpointScope,
  onResetScopeOverride,
  platformTarget = null,
  projectFiles = [],
  activeHtmlPath,
  activeHtmlContent,
  htmlPages,
  primaryCssPath,
  stylesCssContent,
  overrideCssContent = '',
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
  history,
  onUndoHistory,
  onRedoHistory,
  onJumpToHistoryIndex,
  aiCopilot,
}) => {
  return (
    <aside
      data-testid="right-sidebar"
      style={{ width: `${widthPx}px` }}
      className="shrink-0 border border-[var(--studio-border)] rounded-[14px] bg-[var(--studio-surface)] studio-panel-shadow flex flex-col min-h-0"
    >
      {/* Active tab keeps visible label; non-active tabs are icon-only revealing label on hover */}
      <div className="h-9 px-2.5 border-b border-[var(--studio-border)] flex items-center justify-between gap-1.5 shrink-0">
        <div
          className="inline-flex items-center gap-0.5 flex-1 min-w-0 h-7 p-0.5 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] overflow-hidden"
          role="tablist"
          aria-label="Right Studio Panel"
        >
          {STUDIO_PANEL_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => onChangeTab(tab.id)}
                className={`group inline-flex items-center justify-center h-full px-2 rounded-md text-[11px] font-semibold studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'studio-reveal-open bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-elevated)] border border-transparent'
                }`}
              >
                <span className="shrink-0 flex items-center">{tab.renderIcon(isActive)}</span>
                <span className="studio-reveal-label">
                  {tab.id === 'seo' && platformTarget && platformTarget.kind !== 'web'
                    ? 'Platform Config'
                    : tab.label}
                </span>
              </button>
            );
          })}
        </div>

        <HoverIconButton
          size="xs"
          onClick={onCollapse}
          label="Hide"
          ariaLabel="Collapse Inspector sidebar"
          title="Collapse Inspector (Ctrl+I)"
          icon={<PanelRightClose className="w-3.5 h-3.5" strokeWidth={1.4} />}
        />
      </div>

      {activeTab === 'inspector' && (
        <InspectorPanel
          selectedElement={selectedElement}
          projectImageAssets={projectImageAssets}
          onUploadImageAsset={onUploadImageAsset}
          aspectRatioLocked={aspectRatioLocked}
          onToggleAspectRatioLock={onToggleAspectRatioLock}
          responsiveScope={responsiveScope}
          onChangeResponsiveScope={onChangeResponsiveScope}
          breakpointScope={breakpointScope}
          onChangeBreakpointScope={onChangeBreakpointScope}
          onResetScopeOverride={onResetScopeOverride}
          stylesCssContent={stylesCssContent}
          overrideCssContent={overrideCssContent}
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
          aiCopilot={aiCopilot}
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

      {activeTab === 'seo' &&
        (platformTarget && platformTarget.kind !== 'web' ? (
          <PlatformConfigPanel target={platformTarget} files={projectFiles} />
        ) : (
          <SeoMetaPanel
            htmlPath={activeHtmlPath}
            htmlContent={activeHtmlContent}
            onCommitSeoMeta={onCommitSeoMeta}
          />
        ))}

      {activeTab === 'global-styles' && (
        <GlobalStylesPanel
          cssPath={primaryCssPath}
          cssContent={stylesCssContent}
          onPreviewRootVar={onPreviewRootVar}
          onCommitRootVar={onCommitRootVar}
          onDeleteRootVar={onDeleteRootVar}
        />
      )}

      {activeTab === 'history' && (
        <HistoryTimelinePanel
          history={history}
          onUndo={onUndoHistory}
          onRedo={onRedoHistory}
          onJumpToIndex={onJumpToHistoryIndex}
        />
      )}
    </aside>
  );
};

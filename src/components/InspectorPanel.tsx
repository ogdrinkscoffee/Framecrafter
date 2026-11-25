import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  BringToFront,
  Code2,
  Copy,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Italic,
  Laptop,
  Link2,
  Lock,
  Minus,
  MousePointerClick,
  Plus,
  RotateCcw,
  RotateCw,
  SendToBack,
  Shapes,
  Smartphone,
  Strikethrough,
  Table2,
  Tablet,
  Trash2,
  Underline,
  Unlock,
  Upload,
} from 'lucide-react';
import type {
  ButtonActionType,
  ProjectFile,
  ResponsiveScope,
  SelectedElementInfo,
} from '../types/editor';
import {
  cssColorToHex,
  getTableMetricsInHtml,
  listHtmlElementIds,
  type SvgShapeHtmlPatch,
} from '../utils/htmlSync';
import { FONT_CATEGORIES, STUDIO_FONT_CATALOG, matchStudioFontOption } from '../utils/fontLibrary';
import { isImageAssetPath, toSvgDataUrl } from '../utils/projectBundler';
import { getNodeDeviceVisibility, getResponsiveNodeStyles } from '../utils/responsiveCss';
import { HoverIconButton } from './StudioPrimitives';

interface InspectorPanelProps {
  selectedElement: SelectedElementInfo | null;
  projectImageAssets: ProjectFile[];
  onUploadImageAsset: (file: File) => Promise<string | null>;
  aspectRatioLocked: boolean;
  onToggleAspectRatioLock: (locked: boolean) => void;
  responsiveScope: ResponsiveScope;
  onChangeResponsiveScope: (scope: ResponsiveScope) => void;
  stylesCssContent: string;
  activeHtmlContent: string;
  htmlPages: string[];
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
  onViewInCode: () => void;
  onHoverSpacing: (kind: 'margin' | 'padding' | null) => void;
}

const SCOPE_LABELS: Record<ResponsiveScope, string> = {
  all: 'Base styles (all screen sizes)',
  desktop: 'Desktop view only (≥ 769px)',
  tablet: 'Tablet view only (481px – 768px)',
  mobile: 'Mobile view only (≤ 480px)',
};

const POINT_PRESETS = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '32pt', '48pt'];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedElement,
  projectImageAssets,
  onUploadImageAsset,
  aspectRatioLocked,
  onToggleAspectRatioLock,
  responsiveScope,
  onChangeResponsiveScope,
  stylesCssContent,
  activeHtmlContent,
  htmlPages,
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
  onViewInCode,
  onHoverSpacing,
}) => {
  const [textDraft, setTextDraft] = useState('');
  const [widthDraft, setWidthDraft] = useState('');
  const [heightDraft, setHeightDraft] = useState('');
  const [fontSizeDraft, setFontSizeDraft] = useState('');
  const [lineHeightDraft, setLineHeightDraft] = useState('');
  const [paddingDraft, setPaddingDraft] = useState('');
  const [marginDraft, setMarginDraft] = useState('');
  const [borderWidthDraft, setBorderWidthDraft] = useState('');
  const [borderRadiusDraft, setBorderRadiusDraft] = useState('');
  const [topDraft, setTopDraft] = useState('');
  const [leftDraft, setLeftDraft] = useState('');
  const [gapDraft, setGapDraft] = useState('');
  const [maxWidthDraft, setMaxWidthDraft] = useState('');
  const [gridColsDraft, setGridColsDraft] = useState('');
  const [textColorDraft, setTextColorDraft] = useState('');
  const [bgColorDraft, setBgColorDraft] = useState('');
  const [spacingPerSideOpen, setSpacingPerSideOpen] = useState(false);
  const [padSideDrafts, setPadSideDrafts] = useState({ top: '0', right: '0', bottom: '0', left: '0' });
  const [marginSideDrafts, setMarginSideDrafts] = useState({ top: '0', right: '0', bottom: '0', left: '0' });
  const [cellPaddingDraft, setCellPaddingDraft] = useState('10px 12px');
  const [imgSrcDraft, setImgSrcDraft] = useState('');
  const [imgAltDraft, setImgAltDraft] = useState('');

  // SVG Shape Properties drafts
  const [shapeFillDraft, setShapeFillDraft] = useState('#3b82f6');
  const [shapeStrokeDraft, setShapeStrokeDraft] = useState('#1d4ed8');
  const [shapeStrokeWidthDraft, setShapeStrokeWidthDraft] = useState('3');
  const [shapePathDraft, setShapePathDraft] = useState('');

  // Button / Link action state
  const [actionTypeDraft, setActionTypeDraft] = useState<ButtonActionType>('none');
  const [actionValueDraft, setActionValueDraft] = useState('');
  const [actionTargetDraft, setActionTargetDraft] = useState('_blank');
  const [newPageName, setNewPageName] = useState('');

  const imgUploadInputRef = useRef<HTMLInputElement | null>(null);
  const colorCommitTimerRef = useRef<number | null>(null);
  const textCommitTimerRef = useRef<number | null>(null);
  const lastCommittedTextRef = useRef<string>('');
  const activeElementKeyRef = useRef<string | null>(null);
  const prevSvgShapeRef = useRef<SelectedElementInfo['svgShape']>(null);

  useEffect(() => {
    return () => {
      if (colorCommitTimerRef.current !== null) {
        window.clearTimeout(colorCommitTimerRef.current);
      }
      if (textCommitTimerRef.current !== null) {
        window.clearTimeout(textCommitTimerRef.current);
      }
    };
  }, []);

  const scopeOverrides = useMemo(
    () => getResponsiveNodeStyles(stylesCssContent, selectedElement?.veNode ?? null, responsiveScope),
    [stylesCssContent, selectedElement?.veNode, responsiveScope]
  );

  const deviceVisibility = useMemo(
    () => getNodeDeviceVisibility(stylesCssContent, selectedElement?.veNode ?? null),
    [stylesCssContent, selectedElement?.veNode]
  );

  const sectionIds = useMemo(
    () => listHtmlElementIds(activeHtmlContent),
    [activeHtmlContent]
  );

  const isTableTag = selectedElement
    ? ['table', 'tbody', 'thead', 'tr', 'td', 'th'].includes(selectedElement.tagName)
    : false;

  const tableMetrics = useMemo(() => {
    if (!selectedElement?.veId || !isTableTag) return null;
    return getTableMetricsInHtml(activeHtmlContent, selectedElement.veId);
  }, [activeHtmlContent, selectedElement?.veId, isTableTag]);

  useEffect(() => {
    if (tableMetrics) {
      setCellPaddingDraft(tableMetrics.cellPadding);
    }
  }, [tableMetrics]);

  useEffect(() => {
    if (!selectedElement) {
      activeElementKeyRef.current = null;
      prevSvgShapeRef.current = null;
      return;
    }
    const elementKey = selectedElement.veId || selectedElement.runtimeId;
    const isNewElement = activeElementKeyRef.current !== elementKey;
    if (isNewElement) {
      activeElementKeyRef.current = elementKey;
      prevSvgShapeRef.current = null;
      lastCommittedTextRef.current = selectedElement.textContent;
      setTextDraft(selectedElement.textContent);

      // Sync action state from selected element attributes
      const explicitAction = (selectedElement.actionType || '') as ButtonActionType;
      if (explicitAction) {
        setActionTypeDraft(explicitAction);
        setActionValueDraft(selectedElement.actionValue || selectedElement.href || '');
      } else if (selectedElement.href) {
        if (selectedElement.href.startsWith('#')) {
          setActionTypeDraft('scroll');
          setActionValueDraft(selectedElement.href);
        } else if (/\.html?($|[?#])/i.test(selectedElement.href) && !/^https?:\/\//i.test(selectedElement.href)) {
          setActionTypeDraft('page');
          setActionValueDraft(selectedElement.href);
        } else {
          setActionTypeDraft('url');
          setActionValueDraft(selectedElement.href);
        }
      } else {
        setActionTypeDraft('none');
        setActionValueDraft('');
      }
      setActionTargetDraft(selectedElement.target || '_blank');
    }

    const pick = (cssProp: string, fallback: string) => {
      if (responsiveScope !== 'all' && scopeOverrides[cssProp] !== undefined) {
        return scopeOverrides[cssProp];
      }
      return selectedElement.inlineStyles[cssProp] || fallback;
    };

    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    const activeId = activeEl?.id || '';

    if (isNewElement || activeId !== 'prop-img-src') {
      setImgSrcDraft(selectedElement.imgSrc || '');
    }
    if (isNewElement || activeId !== 'prop-img-alt') {
      setImgAltDraft(selectedElement.imgAlt || '');
    }

    setWidthDraft(pick('width', selectedElement.styles.width));
    setHeightDraft(pick('height', selectedElement.styles.height));
    setFontSizeDraft(pick('font-size', selectedElement.styles.fontSize));
    setLineHeightDraft(pick('line-height', selectedElement.styles.lineHeight));
    setPaddingDraft(pick('padding', selectedElement.styles.padding));
    setMarginDraft(pick('margin', selectedElement.styles.margin));
    setBorderWidthDraft(pick('border-width', selectedElement.styles.borderWidth));
    setBorderRadiusDraft(pick('border-radius', selectedElement.styles.borderRadius));
    setTopDraft(pick('top', selectedElement.styles.top));
    setLeftDraft(pick('left', selectedElement.styles.left));
    setGapDraft(pick('gap', selectedElement.styles.gap === 'normal' ? '0px' : selectedElement.styles.gap));
    setMaxWidthDraft(pick('max-width', selectedElement.styles.maxWidth || 'none'));
    setGridColsDraft(pick('grid-template-columns', selectedElement.styles.gridTemplateColumns || ''));

    if (isNewElement || activeId !== 'prop-text-color-hex') {
      const nextTextColor =
        (responsiveScope !== 'all' && scopeOverrides.color) ||
        cssColorToHex(selectedElement.styles.color) ||
        selectedElement.styles.color;
      setTextColorDraft(nextTextColor);
    }
    if (isNewElement || activeId !== 'prop-bg-color-hex') {
      const nextBgColor =
        (responsiveScope !== 'all' && scopeOverrides['background-color']) ||
        cssColorToHex(selectedElement.styles.backgroundColor) ||
        selectedElement.styles.backgroundColor;
      setBgColorDraft(nextBgColor);
    }
    if (selectedElement.boxModel && (isNewElement || !activeId.startsWith('prop-pad-'))) {
      setPadSideDrafts({
        top: String(selectedElement.boxModel.padding.top),
        right: String(selectedElement.boxModel.padding.right),
        bottom: String(selectedElement.boxModel.padding.bottom),
        left: String(selectedElement.boxModel.padding.left),
      });
    }
    if (selectedElement.boxModel && (isNewElement || !activeId.startsWith('prop-margin-'))) {
      setMarginSideDrafts({
        top: String(selectedElement.boxModel.margin.top),
        right: String(selectedElement.boxModel.margin.right),
        bottom: String(selectedElement.boxModel.margin.bottom),
        left: String(selectedElement.boxModel.margin.left),
      });
    }

    if (selectedElement.svgShape) {
      const nextShape = selectedElement.svgShape;
      const prevShape = prevSvgShapeRef.current;
      const activeAria = activeEl?.getAttribute('aria-label') || '';

      if ((isNewElement || prevShape?.fill !== nextShape.fill) && activeAria !== 'Shape fill value') {
        setShapeFillDraft(cssColorToHex(nextShape.fill) || nextShape.fill || '#3b82f6');
      }
      if ((isNewElement || prevShape?.stroke !== nextShape.stroke) && activeAria !== 'Shape stroke value') {
        setShapeStrokeDraft(
          nextShape.stroke === 'none'
            ? 'none'
            : cssColorToHex(nextShape.stroke) || nextShape.stroke || '#1d4ed8'
        );
      }
      if (
        (isNewElement || prevShape?.strokeWidth !== nextShape.strokeWidth) &&
        activeId !== 'prop-shape-stroke-width'
      ) {
        setShapeStrokeWidthDraft(nextShape.strokeWidth || '0');
      }
      if ((isNewElement || prevShape?.pathData !== nextShape.pathData) && activeId !== 'prop-shape-path') {
        setShapePathDraft(nextShape.pathData || '');
      }
      prevSvgShapeRef.current = nextShape;
    } else {
      prevSvgShapeRef.current = null;
    }
  }, [selectedElement, responsiveScope, scopeOverrides]);

  const projectImageAssetOptions = useMemo(() => {
    return projectImageAssets
      .filter((f) => isImageAssetPath(f.path))
      .map((file) => {
        const clean = file.path.replace(/^\/+/, '');
        const assetUrl = clean.toLowerCase().startsWith('public/')
          ? `/${clean.slice('public/'.length)}`
          : `./${clean}`;
        return {
          path: clean,
          assetUrl,
          previewUrl:
            file.blobUrl ||
            (/\.svg$/i.test(clean) ? toSvgDataUrl(file.content) : file.content),
        };
      });
  }, [projectImageAssets]);

  const resolveInspectorImagePreview = (rawSrc: string): string => {
    const trimmed = rawSrc.trim();
    if (!trimmed) return '';
    if (
      /^(https?:)?\/\//i.test(trimmed) ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('blob:')
    ) {
      return trimmed;
    }
    const norm = trimmed.replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase();
    const base = norm.split('/').pop() || norm;
    const match =
      projectImageAssetOptions.find(
        (opt) =>
          opt.path.toLowerCase() === norm ||
          opt.assetUrl.replace(/^\.\//, '').replace(/^\/+/, '').toLowerCase() === norm
      ) ||
      projectImageAssetOptions.find((opt) => (opt.path.split('/').pop() || '').toLowerCase() === base);
    return match ? match.previewUrl : '';
  };

  if (!selectedElement) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-[var(--studio-surface)]">
        <div className="w-11 h-11 rounded-xl bg-[var(--studio-elevated)] border border-[var(--studio-border)] studio-card-highlight flex items-center justify-center mb-3.5 shadow-sm">
          <MousePointerClick className="w-5 h-5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-[14px] font-semibold tracking-[-0.015em] text-[var(--studio-text-strong)] mb-1.5">
          Select an element
        </h2>
        <p className="text-[12px] text-[var(--studio-muted)] leading-relaxed max-w-60">
          Click any element in the Live Canvas to customize typography, images, button actions, or
          desktop and mobile layouts.
        </p>
      </div>
    );
  }

  const effectiveDisplay =
    (responsiveScope !== 'all' && scopeOverrides.display) || selectedElement.styles.display;
  const effectiveFlexDir =
    (responsiveScope !== 'all' && scopeOverrides['flex-direction']) ||
    selectedElement.styles.flexDirection;
  const effectiveTextAlign =
    (responsiveScope !== 'all' && scopeOverrides['text-align']) ||
    selectedElement.styles.textAlign;
  const effectiveFontWeight =
    (responsiveScope !== 'all' && scopeOverrides['font-weight']) ||
    selectedElement.styles.fontWeight;
  const effectiveFontStyle =
    (responsiveScope !== 'all' && scopeOverrides['font-style']) ||
    selectedElement.styles.fontStyle;
  const effectiveTextDeco =
    (responsiveScope !== 'all' && scopeOverrides['text-decoration']) ||
    selectedElement.styles.textDecoration;
  const effectiveFontFamily =
    (responsiveScope !== 'all' && scopeOverrides['font-family']) ||
    selectedElement.inlineStyles['font-family'] ||
    '';
  const effectivePosition =
    (responsiveScope !== 'all' && scopeOverrides.position) || selectedElement.styles.position;
  const effectiveBorderStyle =
    (responsiveScope !== 'all' && scopeOverrides['border-style']) ||
    selectedElement.styles.borderStyle;
  const effectiveJustify =
    (responsiveScope !== 'all' && scopeOverrides['justify-content']) ||
    selectedElement.styles.justifyContent ||
    'flex-start';
  const effectiveAlign =
    (responsiveScope !== 'all' && scopeOverrides['align-items']) ||
    selectedElement.styles.alignItems ||
    'stretch';
  const effectiveFlexWrap =
    (responsiveScope !== 'all' && scopeOverrides['flex-wrap']) ||
    selectedElement.styles.flexWrap ||
    'nowrap';
  const effectiveOverflow =
    (responsiveScope !== 'all' && scopeOverrides.overflow) ||
    selectedElement.styles.overflow ||
    'visible';

  const isBold = effectiveFontWeight === 'bold' || Number(effectiveFontWeight) >= 600;
  const isItalic = effectiveFontStyle === 'italic';
  const isUnderline = effectiveTextDeco.includes('underline');
  const isStrike = effectiveTextDeco.includes('line-through');

  const textColorHex =
    cssColorToHex(
      (responsiveScope !== 'all' && scopeOverrides.color) || selectedElement.styles.color
    ) || '#0f172a';
  const bgColorHex =
    cssColorToHex(
      (responsiveScope !== 'all' && scopeOverrides['background-color']) ||
        selectedElement.styles.backgroundColor
    ) || '#ffffff';
  const borderColorHex =
    cssColorToHex(
      (responsiveScope !== 'all' && scopeOverrides['border-color']) ||
        selectedElement.styles.borderColor
    ) || '#cbd5e1';

  const commitStylePatch = (patch: Record<string, string | null>, label: string) => {
    if (responsiveScope === 'all') {
      const previewPatch: Record<string, string> = {};
      for (const [k, v] of Object.entries(patch)) {
        previewPatch[k] = v ?? '';
      }
      onPreviewStyle(previewPatch);
      onCommitStyle(patch, label);
    } else {
      onCommitResponsiveStyle(responsiveScope, patch, `${label} (${responsiveScope})`);
    }
  };

  const commitField = (prop: string, value: string, label: string) => {
    commitStylePatch({ [prop]: value || null }, label);
  };

  const toggleTextDeco = (token: 'underline' | 'line-through') => {
    const active = new Set<string>();
    if (isUnderline) active.add('underline');
    if (isStrike) active.add('line-through');
    if (active.has(token)) active.delete(token);
    else active.add(token);
    commitField(
      'text-decoration',
      active.size > 0 ? Array.from(active).join(' ') : 'none',
      `Toggle ${token}`
    );
  };

  const scheduleColorCommit = (prop: string, value: string, label: string) => {
    if (responsiveScope === 'all') {
      onPreviewStyle({ [prop]: value });
    }
    if (colorCommitTimerRef.current !== null) {
      window.clearTimeout(colorCommitTimerRef.current);
    }
    colorCommitTimerRef.current = window.setTimeout(() => {
      commitStylePatch({ [prop]: value }, label);
      colorCommitTimerRef.current = null;
    }, 200);
  };

  const commitTextIfChanged = (nextText: string) => {
    if (textCommitTimerRef.current !== null) {
      window.clearTimeout(textCommitTimerRef.current);
      textCommitTimerRef.current = null;
    }
    if (nextText !== lastCommittedTextRef.current) {
      lastCommittedTextRef.current = nextText;
      onCommitText(nextText);
    }
  };

  const applyButtonAction = (
    nextType: ButtonActionType,
    nextVal: string,
    nextTarget: string
  ) => {
    const isAnchor = selectedElement.tagName === 'a';
    if (nextType === 'none') {
      onCommitAttributes(
        {
          'data-ve-action': null,
          'data-ve-value': null,
          target: null,
          ...(isAnchor ? { href: '#' } : {}),
        },
        'Clear element action'
      );
      return;
    }

    const attrs: Record<string, string | null> = {
      'data-ve-action': nextType,
      'data-ve-value': nextVal,
    };

    if (nextType === 'url') {
      attrs.target = nextTarget || '_blank';
      if (isAnchor) attrs.href = nextVal;
    } else if (nextType === 'page') {
      attrs.target = null;
      if (isAnchor) attrs.href = nextVal;
    } else if (nextType === 'scroll') {
      attrs.target = null;
      const hash = nextVal.startsWith('#') ? nextVal : `#${nextVal}`;
      attrs['data-ve-value'] = hash;
      if (isAnchor) attrs.href = hash;
    } else {
      attrs.target = null;
    }

    onCommitAttributes(attrs, `Set action: ${nextType}`);
  };

  const nudgePosition = (dx: number, dy: number) => {
    const parseAxisPx = (val: string, fallbackOffset?: number) => {
      if (val && val !== 'auto') {
        const num = parseFloat(val);
        if (Number.isFinite(num)) return num;
      }
      if (
        (effectivePosition === 'absolute' || effectivePosition === 'fixed') &&
        typeof fallbackOffset === 'number' &&
        Number.isFinite(fallbackOffset)
      ) {
        return fallbackOffset;
      }
      return 0;
    };
    const nextLeft = Math.round(parseAxisPx(leftDraft || '0', selectedElement.offsetLeft) + dx);
    const nextTop = Math.round(parseAxisPx(topDraft || '0', selectedElement.offsetTop) + dy);

    const patch: Record<string, string> = {
      left: `${nextLeft}px`,
      top: `${nextTop}px`,
    };
    if (effectivePosition === 'static') {
      patch.position = 'relative';
    } else if (effectivePosition === 'absolute' || effectivePosition === 'fixed') {
      if (selectedElement.styles.right && selectedElement.styles.right !== 'auto') {
        patch.right = 'auto';
      }
      if (selectedElement.styles.bottom && selectedElement.styles.bottom !== 'auto') {
        patch.bottom = 'auto';
      }
    }
    commitStylePatch(patch, 'Nudge element position');
  };

  const hasScopeOverrides = Object.keys(scopeOverrides).length > 0;
  const isActionableTag =
    selectedElement.tagName === 'button' ||
    selectedElement.tagName === 'a' ||
    Boolean(selectedElement.actionType);
  const isSvgShape = selectedElement.tagName === 'svg' || Boolean(selectedElement.veShape && selectedElement.tagName === 'svg');
  const isImageTag = selectedElement.tagName === 'img';
  const effectiveObjectFit =
    (responsiveScope !== 'all' && scopeOverrides['object-fit']) ||
    selectedElement.inlineStyles['object-fit'] ||
    selectedElement.styles.objectFit ||
    'cover';
  const inspectorPreviewUrl = isImageTag ? resolveInspectorImagePreview(imgSrcDraft) : '';
  const currentZIndex = Number.parseInt(
    (responsiveScope !== 'all' && scopeOverrides['z-index']) || selectedElement.styles.zIndex || '0',
    10
  ) || 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--studio-surface)]">
      {/* Element Identity & Quick Actions */}
      <div className="px-3 py-2.5 border-b border-[var(--studio-border)] space-y-2 shrink-0 bg-[var(--studio-surface)]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-[12px] font-semibold text-indigo-700 dark:text-indigo-300 truncate">
                &lt;{selectedElement.tagName}&gt;
                {selectedElement.veShape ? ` (${selectedElement.veShape})` : selectedElement.id ? `#${selectedElement.id}` : ''}
              </span>
              <span className="font-mono-tabular text-[11.5px] text-[var(--studio-muted)] shrink-0">
                {Math.round(selectedElement.rect.width)} × {Math.round(selectedElement.rect.height)}
              </span>
            </div>
            <div className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)] truncate mt-0.5" title={selectedElement.selectorPath}>
              {selectedElement.selectorPath}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <HoverIconButton
              size="xs"
              onClick={onViewInCode}
              label="Code"
              ariaLabel="View selected element in code"
              title="View in Code Editor"
              icon={<Code2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" strokeWidth={1.4} />}
            />
            <HoverIconButton
              size="xs"
              onClick={onDuplicateElement}
              label="Copy"
              ariaLabel="Duplicate selected element"
              title="Duplicate element (Ctrl+D)"
              icon={<Copy className="w-3.5 h-3.5" strokeWidth={1.4} />}
            />
            <HoverIconButton
              size="xs"
              onClick={onToggleVisibility}
              label={selectedElement.isHidden ? 'Show' : 'Hide'}
              ariaLabel={selectedElement.isHidden ? 'Show element' : 'Hide element'}
              title={selectedElement.isHidden ? 'Show element' : 'Hide element'}
              icon={
                selectedElement.isHidden ? (
                  <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.4} />
                ) : (
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.4} />
                )
              }
            />
            <HoverIconButton
              size="xs"
              tone="danger"
              onClick={onRemoveElement}
              label="Delete"
              ariaLabel="Remove selected element"
              title="Remove element"
              icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />}
            />
          </div>
        </div>

        {/* Responsive Breakpoint Scope Selector */}
        <div className="space-y-1">
          <div
            className="grid grid-cols-4 h-7 p-0.5 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)]"
            role="group"
            aria-label="Responsive Editing Scope"
          >
            {(['all', 'desktop', 'tablet', 'mobile'] as ResponsiveScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => onChangeResponsiveScope(scope)}
                aria-pressed={responsiveScope === scope}
                className={`h-full rounded-md text-[11px] font-medium capitalize studio-pressable cursor-pointer ${
                  responsiveScope === scope
                    ? scope === 'mobile'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : scope === 'desktop'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--studio-muted)] px-0.5">
            <span>{SCOPE_LABELS[responsiveScope]}</span>
            {responsiveScope !== 'all' && hasScopeOverrides && (
              <button
                type="button"
                onClick={() => {
                  const clearPatch: Record<string, null> = {};
                  for (const key of Object.keys(scopeOverrides)) {
                    clearPatch[key] = null;
                  }
                  onCommitResponsiveStyle(
                    responsiveScope,
                    clearPatch,
                    `Clear ${responsiveScope} overrides`
                  );
                }}
                className="text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 font-medium cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Properties */}
      <div className="flex-1 overflow-y-auto builder-scroll p-3 space-y-4">
        {/* Button & Link Action Section */}
        {isActionableTag && (
          <section className="space-y-2.5 pb-4 border-b border-[var(--studio-border)]">
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
                Button &amp; Link Action
              </h3>
              <span className="text-[10.5px] text-[var(--studio-muted-soft)]">Runs in Using Mode</span>
            </div>

            <div>
              <label htmlFor="prop-action-type" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                On Click Action
              </label>
              <select
                id="prop-action-type"
                value={actionTypeDraft}
                onChange={(e) => {
                  const nextType = e.target.value as ButtonActionType;
                  setActionTypeDraft(nextType);
                  let defaultVal = actionValueDraft;
                  if (nextType === 'page' && (!defaultVal || !htmlPages.includes(defaultVal))) {
                    defaultVal = htmlPages[0] || 'index.html';
                  } else if (nextType === 'scroll' && !defaultVal.startsWith('#')) {
                    defaultVal = sectionIds[0] ? `#${sectionIds[0].id}` : '#overview';
                  } else if (nextType === 'url' && !/^https?:\/\//i.test(defaultVal)) {
                    defaultVal = 'https://example.com';
                  } else if (nextType === 'alert' && !defaultVal) {
                    defaultVal = 'Action confirmed!';
                  } else if (nextType === 'toggle' && !defaultVal) {
                    defaultVal = sectionIds[0] ? `#${sectionIds[0].id}` : '#';
                  } else if (nextType === 'none') {
                    defaultVal = '';
                  }
                  setActionValueDraft(defaultVal);
                  applyButtonAction(nextType, defaultVal, actionTargetDraft);
                }}
                className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="none">None / Default script handler</option>
                <option value="url">Open External URL</option>
                <option value="page">Navigate to App Page</option>
                <option value="scroll">Scroll to Section (#id)</option>
                <option value="alert">Show Message Banner</option>
                <option value="toggle">Toggle Element Visibility</option>
              </select>
            </div>

            {actionTypeDraft === 'url' && (
              <div className="space-y-2">
                <div>
                  <label htmlFor="prop-action-url" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                    Destination URL
                  </label>
                  <input
                    id="prop-action-url"
                    type="text"
                    value={actionValueDraft}
                    onChange={(e) => setActionValueDraft(e.target.value)}
                    onBlur={() => applyButtonAction('url', actionValueDraft, actionTargetDraft)}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      applyButtonAction('url', actionValueDraft, actionTargetDraft)
                    }
                    placeholder="https://example.com"
                    className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/50 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  />
                </div>
                <div>
                  <label htmlFor="prop-action-target" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                    Open In
                  </label>
                  <select
                    id="prop-action-target"
                    value={actionTargetDraft}
                    onChange={(e) => {
                      setActionTargetDraft(e.target.value);
                      applyButtonAction('url', actionValueDraft, e.target.value);
                    }}
                    className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  >
                    <option value="_blank">New Tab (_blank)</option>
                    <option value="_self">Same Frame (_self)</option>
                  </select>
                </div>
              </div>
            )}

            {actionTypeDraft === 'page' && (
              <div className="space-y-2">
                <div>
                  <label htmlFor="prop-action-page" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                    Target App Page
                  </label>
                  <select
                    id="prop-action-page"
                    value={actionValueDraft}
                    onChange={(e) => {
                      setActionValueDraft(e.target.value);
                      applyButtonAction('page', e.target.value, actionTargetDraft);
                    }}
                    className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  >
                    {htmlPages.map((page) => (
                      <option key={page} value={page}>
                        {page}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    aria-label="Create new app page name"
                    value={newPageName}
                    onChange={(e) => setNewPageName(e.target.value)}
                    placeholder="New page (e.g. about.html)"
                    className="flex-1 min-w-0 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = newPageName.trim();
                      if (!trimmed) return;
                      const normalized = trimmed.endsWith('.html') ? trimmed : `${trimmed}.html`;
                      setActionValueDraft(normalized);
                      onCreatePageAndLink(normalized);
                      setNewPageName('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-[11.5px] font-semibold text-white shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" strokeWidth={1.5} />
                    Page
                  </button>
                </div>
              </div>
            )}

            {(actionTypeDraft === 'scroll' || actionTypeDraft === 'toggle') && (
              <div className="space-y-1.5">
                <label htmlFor="prop-action-target-id" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  Target Section / Element ID
                </label>
                {sectionIds.length > 0 && (
                  <select
                    aria-label="Choose existing element ID"
                    value={
                      sectionIds.some((s) => `#${s.id}` === actionValueDraft) ? actionValueDraft : ''
                    }
                    onChange={(e) => {
                      if (!e.target.value) return;
                      setActionValueDraft(e.target.value);
                      applyButtonAction(actionTypeDraft, e.target.value, actionTargetDraft);
                    }}
                    className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                  >
                    <option value="">Pick an element ID...</option>
                    {sectionIds.map((s) => (
                      <option key={s.id} value={`#${s.id}`}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id="prop-action-target-id"
                  type="text"
                  value={actionValueDraft}
                  onChange={(e) => setActionValueDraft(e.target.value)}
                  onBlur={() =>
                    applyButtonAction(actionTypeDraft, actionValueDraft, actionTargetDraft)
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    applyButtonAction(actionTypeDraft, actionValueDraft, actionTargetDraft)
                  }
                  placeholder="#section-id"
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
            )}

            {actionTypeDraft === 'alert' && (
              <div>
                <label htmlFor="prop-action-alert" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                  Message Text
                </label>
                <input
                  id="prop-action-alert"
                  type="text"
                  value={actionValueDraft}
                  onChange={(e) => setActionValueDraft(e.target.value)}
                  onBlur={() => applyButtonAction('alert', actionValueDraft, actionTargetDraft)}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    applyButtonAction('alert', actionValueDraft, actionTargetDraft)
                  }
                  placeholder="Saved successfully!"
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
            )}
          </section>
        )}

        {/* Table Subsection */}
        {isTableTag && (
          <section
            aria-label="Table Inspector"
            className="space-y-3 pb-4 border-b border-[var(--studio-border)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header flex items-center gap-1.5">
                <Table2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                Table
              </h3>
              {tableMetrics && (
                <span className="font-mono-tabular text-[12px] text-[var(--studio-muted)]">
                  {tableMetrics.rows} rows × {tableMetrics.cols} cols
                </span>
              )}
            </div>

            {/* Rows & Columns Controls */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onAddTableRow}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" strokeWidth={1.5} />
                Add Row
              </button>
              <button
                type="button"
                disabled={!tableMetrics || tableMetrics.rows <= 1}
                onClick={onRemoveTableRow}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 text-red-400" strokeWidth={1.5} />
                Remove Row
              </button>
              <button
                type="button"
                onClick={onAddTableColumn}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-indigo-400" strokeWidth={1.5} />
                Add Column
              </button>
              <button
                type="button"
                disabled={!tableMetrics || tableMetrics.cols <= 1}
                onClick={onRemoveTableColumn}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 text-red-400" strokeWidth={1.5} />
                Remove Column
              </button>
            </div>

            {/* Cell Padding */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="table-cell-padding" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  Cell Padding
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Compact', val: '6px 8px' },
                    { label: 'Normal', val: '10px 12px' },
                    { label: 'Roomy', val: '14px 18px' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setCellPaddingDraft(preset.val);
                        onUpdateTableCellStyles(
                          { padding: preset.val },
                          `Set table cell padding (${preset.label})`
                        );
                      }}
                      className={`px-1.5 py-0.5 rounded-md text-[10.5px] border transition-colors cursor-pointer ${
                        cellPaddingDraft === preset.val
                          ? 'bg-indigo-500/18 border-indigo-500/45 text-indigo-700 dark:text-indigo-300'
                          : 'bg-[var(--studio-input)] border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="table-cell-padding"
                type="text"
                value={cellPaddingDraft}
                onChange={(e) => setCellPaddingDraft(e.target.value)}
                onBlur={() =>
                  onUpdateTableCellStyles({ padding: cellPaddingDraft }, 'Update table cell padding')
                }
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  onUpdateTableCellStyles({ padding: cellPaddingDraft }, 'Update table cell padding')
                }
                placeholder="e.g. 10px 12px"
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>

            {/* Cell Alignment */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">Cell Horiz. Align</span>
                <div className="grid grid-cols-3 gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5">
                  {[
                    { val: 'left', icon: AlignLeft, label: 'Cell align left' },
                    { val: 'center', icon: AlignCenter, label: 'Cell align center' },
                    { val: 'right', icon: AlignRight, label: 'Cell align right' },
                  ].map(({ val, icon: Icon, label }) => (
                    <button
                      key={val}
                      type="button"
                      aria-label={label}
                      onClick={() =>
                        onUpdateTableCellStyles({ 'text-align': val }, `Table cell align ${val}`)
                      }
                      className={`flex items-center justify-center py-1 rounded-md text-xs cursor-pointer ${
                        tableMetrics?.cellAlign === val
                          ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs'
                          : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">Cell Vert. Align</span>
                <div className="grid grid-cols-3 gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5">
                  {[
                    { val: 'top', icon: AlignVerticalJustifyStart, label: 'Cell vertical align top' },
                    { val: 'middle', icon: AlignVerticalJustifyCenter, label: 'Cell vertical align middle' },
                    { val: 'bottom', icon: AlignVerticalJustifyEnd, label: 'Cell vertical align bottom' },
                  ].map(({ val, icon: Icon, label }) => (
                    <button
                      key={val}
                      type="button"
                      aria-label={label}
                      onClick={() =>
                        onUpdateTableCellStyles(
                          { 'vertical-align': val },
                          `Table cell vertical align ${val}`
                        )
                      }
                      className={`flex items-center justify-center py-1 rounded-md text-xs cursor-pointer ${
                        tableMetrics?.cellVAlign === val
                          ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs'
                          : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Style Options */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">Alternating Row Shading</span>
              <button
                type="button"
                aria-pressed={Boolean(tableMetrics?.isStriped)}
                onClick={() => onToggleTableStriped(!tableMetrics?.isStriped)}
                className={`px-2.5 py-1 rounded-lg text-[11.5px] font-medium border transition-colors cursor-pointer ${
                  tableMetrics?.isStriped
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-[var(--studio-input)] border-[var(--studio-border)] text-[var(--studio-text)] hover:bg-[var(--studio-hover)]'
                }`}
              >
                {tableMetrics?.isStriped ? 'Striped: On' : 'Striped: Off'}
              </button>
            </div>
          </section>
        )}

        {/* Per-Device Visibility */}
        <section className="space-y-2 pb-4 border-b border-[var(--studio-border)]">
          <div className="flex items-center justify-between">
            <h3 className="studio-section-header">Device Visibility</h3>
            <span className="text-[11px] text-[var(--studio-muted-soft)]">Per screen</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('desktop')}
              aria-pressed={deviceVisibility.desktop}
              className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md border studio-card-highlight text-[11.5px] font-medium studio-pressable cursor-pointer ${
                deviceVisibility.desktop
                  ? 'bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text-strong)]'
                  : 'bg-red-500/10 border-red-500/35 text-red-700 dark:text-red-300 line-through'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" strokeWidth={1.4} />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('tablet')}
              aria-pressed={deviceVisibility.tablet}
              className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md border studio-card-highlight text-[11.5px] font-medium studio-pressable cursor-pointer ${
                deviceVisibility.tablet
                  ? 'bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text-strong)]'
                  : 'bg-red-500/10 border-red-500/35 text-red-700 dark:text-red-300 line-through'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" strokeWidth={1.4} />
              Tablet
            </button>
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('mobile')}
              aria-pressed={deviceVisibility.mobile}
              className={`inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md border studio-card-highlight text-[11.5px] font-medium studio-pressable cursor-pointer ${
                deviceVisibility.mobile
                  ? 'bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text-strong)]'
                  : 'bg-red-500/10 border-red-500/35 text-red-700 dark:text-red-300 line-through'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" strokeWidth={1.4} />
              Mobile
            </button>
          </div>
        </section>

        {/* Text Content */}
        {selectedElement.isTextEditable && (
          <section className="space-y-2 pb-4 border-b border-[var(--studio-border)]">
            <label
              htmlFor="inspector-text-content"
              className="block studio-section-header"
            >
              Text Content
            </label>
            <textarea
              id="inspector-text-content"
              rows={2}
              value={textDraft}
              onChange={(e) => {
                const val = e.target.value;
                setTextDraft(val);
                onPreviewText(val);
                if (textCommitTimerRef.current !== null) {
                  window.clearTimeout(textCommitTimerRef.current);
                }
                textCommitTimerRef.current = window.setTimeout(() => {
                  commitTextIfChanged(val);
                }, 300);
              }}
              onBlur={() => commitTextIfChanged(textDraft)}
              className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12.5px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 resize-y"
            />
          </section>
        )}

        {/* Image Properties Section for <img> elements */}
        {isImageTag && (
          <section
            aria-label="Image Properties"
            className="space-y-3 pb-4 border-b border-[var(--studio-border)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
                Image Properties
              </h3>
              <span className="font-mono-tabular text-[11px] text-[var(--studio-muted)]">
                &lt;img&gt;
              </span>
            </div>

            <input
              ref={imgUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Upload replacement image"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const nextUrl = await onUploadImageAsset(file);
                if (nextUrl) {
                  setImgSrcDraft(nextUrl);
                  onCommitAttributes({ src: nextUrl }, `Replace image with ${file.name}`);
                }
              }}
            />

            <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] studio-card-highlight">
              {inspectorPreviewUrl ? (
                <img
                  src={inspectorPreviewUrl}
                  alt={imgAltDraft || 'Selected image preview'}
                  style={{ objectFit: effectiveObjectFit as React.CSSProperties['objectFit'] }}
                  className="w-14 h-14 rounded-md border border-[var(--studio-border)] studio-checkerboard shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-md border border-dashed border-[var(--studio-border-strong)] studio-checkerboard flex items-center justify-center shrink-0">
                  <ImageIcon className="w-5 h-5 text-[var(--studio-muted-soft)]" strokeWidth={1.4} />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="text-[11px] font-mono-tabular text-[var(--studio-muted)] truncate" title={imgSrcDraft}>
                  {imgSrcDraft || 'No image source set'}
                </div>
                <button
                  type="button"
                  onClick={() => imgUploadInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] font-medium text-[var(--studio-text-strong)] transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
                  Upload / Replace Image
                </button>
              </div>
            </div>

            {projectImageAssetOptions.length > 0 && (
              <div>
                <label htmlFor="prop-img-asset" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                  Project Image Asset
                </label>
                <select
                  id="prop-img-asset"
                  value={
                    projectImageAssetOptions.some((opt) => opt.assetUrl === imgSrcDraft)
                      ? imgSrcDraft
                      : ''
                  }
                  onChange={(e) => {
                    const nextUrl = e.target.value;
                    if (!nextUrl) return;
                    setImgSrcDraft(nextUrl);
                    onCommitAttributes({ src: nextUrl }, 'Select project image asset');
                  }}
                  className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                >
                  <option value="">Pick from loaded project assets...</option>
                  {projectImageAssetOptions.map((opt) => (
                    <option key={opt.path} value={opt.assetUrl}>
                      {opt.path}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="prop-img-src" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                Image Source (src)
              </label>
              <input
                id="prop-img-src"
                type="text"
                value={imgSrcDraft}
                onChange={(e) => setImgSrcDraft(e.target.value)}
                onBlur={() => onCommitAttributes({ src: imgSrcDraft }, 'Update image src')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && onCommitAttributes({ src: imgSrcDraft }, 'Update image src')
                }
                placeholder="./assets/photo.png or https://..."
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="prop-img-alt" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                  Alt Text
                </label>
                <input
                  id="prop-img-alt"
                  type="text"
                  value={imgAltDraft}
                  onChange={(e) => setImgAltDraft(e.target.value)}
                  onBlur={() => onCommitAttributes({ alt: imgAltDraft }, 'Update image alt')}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && onCommitAttributes({ alt: imgAltDraft }, 'Update image alt')
                  }
                  placeholder="Describe image..."
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
              <div>
                <label htmlFor="prop-object-fit" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                  Object Fit
                </label>
                <select
                  id="prop-object-fit"
                  value={effectiveObjectFit}
                  onChange={(e) => commitField('object-fit', e.target.value, 'Update object-fit')}
                  className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                >
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                  <option value="fill">fill</option>
                  <option value="scale-down">scale-down</option>
                  <option value="none">none</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* Shape Properties Section for SVG Shapes */}
        {isSvgShape && (
          <section
            aria-label="Shape Properties"
            className="space-y-3 pb-4 border-b border-[var(--studio-border)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
                Shape Properties
              </h3>
              {selectedElement.svgShape && (
                <span className="font-mono-tabular text-[11px] text-[var(--studio-muted)]">
                  &lt;{selectedElement.svgShape.childTag}&gt; · {selectedElement.svgShape.viewBox}
                </span>
              )}
            </div>

            {/* Fill Color */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="prop-shape-fill" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  Fill Color
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShapeFillDraft('none');
                    onPreviewSvgShape({ fill: 'none' });
                    onCommitSvgShape({ fill: 'none' }, 'Clear shape fill');
                  }}
                  className="text-[11px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
                >
                  Transparent
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/60">
                <span
                  className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer"
                  style={{
                    backgroundColor:
                      shapeFillDraft === 'none' ? 'transparent' : cssColorToHex(shapeFillDraft) || '#3b82f6',
                  }}
                >
                  <input
                    id="prop-shape-fill"
                    type="color"
                    value={cssColorToHex(shapeFillDraft) || '#3b82f6'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setShapeFillDraft(val);
                      onPreviewSvgShape({ fill: val });
                      if (colorCommitTimerRef.current !== null) {
                        window.clearTimeout(colorCommitTimerRef.current);
                      }
                      colorCommitTimerRef.current = window.setTimeout(() => {
                        onCommitSvgShape({ fill: val }, 'Update shape fill');
                        colorCommitTimerRef.current = null;
                      }, 200);
                    }}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </span>
                <input
                  type="text"
                  aria-label="Shape fill value"
                  value={shapeFillDraft}
                  onChange={(e) => setShapeFillDraft(e.target.value)}
                  onBlur={() => {
                    onPreviewSvgShape({ fill: shapeFillDraft });
                    onCommitSvgShape({ fill: shapeFillDraft }, 'Update shape fill');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onPreviewSvgShape({ fill: shapeFillDraft });
                      onCommitSvgShape({ fill: shapeFillDraft }, 'Update shape fill');
                    }
                  }}
                  className="flex-1 min-w-0 bg-transparent text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none"
                />
              </div>
            </div>

            {/* Stroke Color & Stroke Width */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="prop-shape-stroke" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                    Stroke Color
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShapeStrokeDraft('none');
                      setShapeStrokeWidthDraft('0');
                      onPreviewSvgShape({ stroke: 'none', strokeWidth: '0' });
                      onCommitSvgShape({ stroke: 'none', strokeWidth: '0' }, 'Remove shape stroke');
                    }}
                    className="text-[11px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
                  >
                    None
                  </button>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/60">
                  <span
                    className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer"
                    style={{
                      backgroundColor:
                        shapeStrokeDraft === 'none'
                          ? 'transparent'
                          : cssColorToHex(shapeStrokeDraft) || '#1d4ed8',
                    }}
                  >
                    <input
                      id="prop-shape-stroke"
                      type="color"
                      value={cssColorToHex(shapeStrokeDraft) || '#1d4ed8'}
                      onChange={(e) => {
                        const val = e.target.value;
                        setShapeStrokeDraft(val);
                        const nextW = Number(shapeStrokeWidthDraft) > 0 ? shapeStrokeWidthDraft : '3';
                        setShapeStrokeWidthDraft(nextW);
                        onPreviewSvgShape({ stroke: val, strokeWidth: nextW });
                        if (colorCommitTimerRef.current !== null) {
                          window.clearTimeout(colorCommitTimerRef.current);
                        }
                        colorCommitTimerRef.current = window.setTimeout(() => {
                          onCommitSvgShape({ stroke: val, strokeWidth: nextW }, 'Update shape stroke');
                          colorCommitTimerRef.current = null;
                        }, 200);
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </span>
                  <input
                    type="text"
                    aria-label="Shape stroke value"
                    value={shapeStrokeDraft}
                    onChange={(e) => setShapeStrokeDraft(e.target.value)}
                    onBlur={() => {
                      onPreviewSvgShape({ stroke: shapeStrokeDraft });
                      onCommitSvgShape({ stroke: shapeStrokeDraft }, 'Update shape stroke');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onPreviewSvgShape({ stroke: shapeStrokeDraft });
                        onCommitSvgShape({ stroke: shapeStrokeDraft }, 'Update shape stroke');
                      }
                    }}
                    className="w-full min-w-0 bg-transparent text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prop-shape-stroke-width" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                  Stroke W.
                </label>
                <input
                  id="prop-shape-stroke-width"
                  type="number"
                  min={0}
                  max={24}
                  step={1}
                  value={shapeStrokeWidthDraft}
                  onChange={(e) => {
                    const val = e.target.value;
                    setShapeStrokeWidthDraft(val);
                    onPreviewSvgShape({ strokeWidth: val });
                  }}
                  onBlur={() => onCommitSvgShape({ strokeWidth: shapeStrokeWidthDraft }, 'Update stroke width')}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    onCommitSvgShape({ strokeWidth: shapeStrokeWidthDraft }, 'Update stroke width')
                  }
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
            </div>

            {/* Path / Points / Geometry Data */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="prop-shape-path" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  {selectedElement.svgShape?.dataMode === 'points'
                    ? 'Polygon Points'
                    : selectedElement.svgShape?.dataMode === 'circle'
                      ? 'Circle / Path Data'
                      : 'SVG Path Data (d)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onPreviewSvgShape({ pathData: shapePathDraft });
                    onCommitSvgShape({ pathData: shapePathDraft }, 'Update shape path data');
                  }}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium cursor-pointer"
                >
                  Apply Path
                </button>
              </div>
              <textarea
                id="prop-shape-path"
                rows={2}
                value={shapePathDraft}
                onChange={(e) => {
                  const val = e.target.value;
                  setShapePathDraft(val);
                  onPreviewSvgShape({ pathData: val });
                }}
                onBlur={() => onCommitSvgShape({ pathData: shapePathDraft }, 'Update shape path data')}
                placeholder="e.g. M 50,5 L 95,94 L 5,94 Z or 50,5 95,94 5,94"
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 resize-y"
              />
              <div className="flex flex-wrap items-center gap-1">
                {[
                  { label: 'Triangle', val: 'M50,6 L94,92 L6,92 Z' },
                  { label: 'Hexagon', val: 'M25,6 L75,6 L96,50 L75,94 L25,94 L4,50 Z' },
                  { label: 'Circle Path', val: 'M50,6 A44,44 0 1,0 50,94 A44,44 0 1,0 50,6 Z' },
                  { label: 'Wave', val: 'M6,62 Q35,10 62,48 T96,24 L96,92 L6,92 Z' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setShapePathDraft(preset.val);
                      onPreviewSvgShape({ pathData: preset.val, viewBox: '0 0 100 100' });
                      onCommitSvgShape(
                        { pathData: preset.val, viewBox: '0 0 100 100' },
                        `Set ${preset.label} path`
                      );
                    }}
                    className="px-2 py-0.5 rounded-md bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[10.5px] text-[var(--studio-text)] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Typography (MS 365 Extended) */}
        {!isSvgShape && (
          <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
            <div className="flex items-center justify-between">
              <h3 className="studio-section-header">Typography</h3>
              <div className="inline-flex items-center gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5">
                <button
                  type="button"
                  aria-label="Inspector Bold"
                  aria-pressed={isBold}
                  onClick={() => commitField('font-weight', isBold ? '400' : '700', 'Toggle bold')}
                  className={`p-1 rounded-md text-xs cursor-pointer ${
                    isBold ? 'bg-indigo-500 text-white' : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Inspector Italic"
                  aria-pressed={isItalic}
                  onClick={() =>
                    commitField('font-style', isItalic ? 'normal' : 'italic', 'Toggle italic')
                  }
                  className={`p-1 rounded-md text-xs cursor-pointer ${
                    isItalic ? 'bg-indigo-500 text-white' : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                  }`}
                >
                  <Italic className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Inspector Underline"
                  aria-pressed={isUnderline}
                  onClick={() => toggleTextDeco('underline')}
                  className={`p-1 rounded-md text-xs cursor-pointer ${
                    isUnderline ? 'bg-indigo-500 text-white' : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                  }`}
                >
                  <Underline className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Inspector Strikethrough"
                  aria-pressed={isStrike}
                  onClick={() => toggleTextDeco('line-through')}
                  className={`p-1 rounded-md text-xs cursor-pointer ${
                    isStrike ? 'bg-indigo-500 text-white' : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                  }`}
                >
                  <Strikethrough className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="prop-font-family" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Font Family
              </label>
              <select
                id="prop-font-family"
                value={matchStudioFontOption(effectiveFontFamily)?.cssValue ?? effectiveFontFamily}
                onChange={(e) => commitField('font-family', e.target.value, 'Update font family')}
                className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="">Inherit / Default</option>
                {FONT_CATEGORIES.map((category) => (
                  <optgroup key={category} label={category}>
                    {STUDIO_FONT_CATALOG.filter((f) => f.category === category).map((f) => (
                      <option key={f.id} value={f.cssValue}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="prop-font-size" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                  Size
                </label>
                <input
                  id="prop-font-size"
                  list="point-size-presets"
                  type="text"
                  value={fontSizeDraft}
                  onChange={(e) => setFontSizeDraft(e.target.value)}
                  onBlur={() => commitField('font-size', fontSizeDraft, 'Update font size')}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && commitField('font-size', fontSizeDraft, 'Update font size')
                  }
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
                <datalist id="point-size-presets">
                  {POINT_PRESETS.map((pt) => (
                    <option key={pt} value={pt} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="prop-font-weight" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                  Weight
                </label>
                <select
                  id="prop-font-weight"
                  value={effectiveFontWeight}
                  onChange={(e) => commitField('font-weight', e.target.value, 'Update font weight')}
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-1.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                >
                  <option value="400">400</option>
                  <option value="500">500</option>
                  <option value="600">600</option>
                  <option value="700">700</option>
                </select>
              </div>
              <div>
                <label htmlFor="prop-line-height" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                  Line H.
                </label>
                <input
                  id="prop-line-height"
                  type="text"
                  value={lineHeightDraft}
                  onChange={(e) => setLineHeightDraft(e.target.value)}
                  onBlur={() => commitField('line-height', lineHeightDraft, 'Update line height')}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    commitField('line-height', lineHeightDraft, 'Update line height')
                  }
                  className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                />
              </div>
            </div>

            <div>
              <label htmlFor="prop-text-color" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Text Color
              </label>
              <div className="flex items-center gap-2 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/60">
                <span
                  className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer shadow-xs"
                  style={{ backgroundColor: textColorHex }}
                >
                  <input
                    id="prop-text-color"
                    type="color"
                    value={textColorHex}
                    onChange={(e) => scheduleColorCommit('color', e.target.value, 'Update text color')}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </span>
                <input
                  id="prop-text-color-hex"
                  type="text"
                  aria-label="Text color hex"
                  value={textColorDraft}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setTextColorDraft(nextVal);
                    if (responsiveScope === 'all' && nextVal.trim()) {
                      onPreviewStyle({ color: nextVal });
                    }
                  }}
                  onBlur={() => commitField('color', textColorDraft.trim(), 'Update text color')}
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    commitField('color', textColorDraft.trim(), 'Update text color')
                  }
                  className="flex-1 min-w-0 bg-transparent text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none"
                />
              </div>
            </div>
          </section>
        )}

        {/* Layout & Alignment */}
        <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
          <h3 className="studio-section-header">Layout &amp; Alignment</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-display" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Display
              </label>
              <select
                id="prop-display"
                value={effectiveDisplay}
                onChange={(e) => commitField('display', e.target.value, 'Update display')}
                className="w-full rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="block">block</option>
                <option value="flex">flex</option>
                <option value="inline-flex">inline-flex</option>
                <option value="grid">grid</option>
                <option value="inline-block">inline-block</option>
                <option value="table">table</option>
                <option value="none">none (hide)</option>
              </select>
            </div>
            <div>
              <span className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Flex Direction
              </span>
              <div
                id="prop-flex-dir"
                role="group"
                aria-label="Flex Direction"
                className="grid grid-cols-4 gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5"
              >
                {[
                  { val: 'row', icon: ArrowRight, label: 'Flex direction row', title: 'Row (→)' },
                  { val: 'column', icon: ArrowDown, label: 'Flex direction column', title: 'Column (↓)' },
                  { val: 'row-reverse', icon: ArrowLeft, label: 'Flex direction row-reverse', title: 'Row Reverse (←)' },
                  { val: 'column-reverse', icon: ArrowUp, label: 'Flex direction column-reverse', title: 'Column Reverse (↑)' },
                ].map(({ val, icon: Icon, label, title }) => (
                  <button
                    key={val}
                    type="button"
                    aria-label={label}
                    aria-pressed={effectiveFlexDir === val}
                    title={title}
                    onClick={() =>
                      commitStylePatch(
                        {
                          display: effectiveDisplay.includes('flex') ? effectiveDisplay : 'flex',
                          'flex-direction': val,
                        },
                        'Update flex direction'
                      )
                    }
                    className={`flex items-center justify-center py-1 rounded-md transition-colors cursor-pointer ${
                      effectiveFlexDir === val
                        ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-gap" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Gap
              </label>
              <input
                id="prop-gap"
                type="text"
                value={gapDraft}
                onChange={(e) => setGapDraft(e.target.value)}
                onBlur={() => commitField('gap', gapDraft, 'Update gap')}
                onKeyDown={(e) => e.key === 'Enter' && commitField('gap', gapDraft, 'Update gap')}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
            <div>
              <span className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">Text Align</span>
              <div
                role="group"
                aria-label="Text Alignment"
                className="grid grid-cols-4 gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5"
              >
                {[
                  { val: 'left', icon: AlignLeft },
                  { val: 'center', icon: AlignCenter },
                  { val: 'right', icon: AlignRight },
                  { val: 'justify', icon: AlignJustify },
                ].map(({ val, icon: Icon }) => (
                  <button
                    key={val}
                    type="button"
                    aria-label={`Align ${val}`}
                    aria-pressed={effectiveTextAlign === val}
                    onClick={() => commitField('text-align', val, 'Update text align')}
                    className={`flex items-center justify-center py-1 rounded-md transition-colors cursor-pointer ${
                      effectiveTextAlign === val
                        ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {(effectiveDisplay.includes('flex') || effectiveDisplay.includes('grid')) && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--studio-border-subtle)]">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="prop-justify" className="block text-[12px] font-medium text-[var(--studio-text-strong)] mb-1">
                    Justify
                  </label>
                  <select
                    id="prop-justify"
                    value={effectiveJustify}
                    onChange={(e) => commitField('justify-content', e.target.value, 'Update justify content')}
                    className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[11.5px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="flex-start">start</option>
                    <option value="center">center</option>
                    <option value="flex-end">end</option>
                    <option value="space-between">space-between</option>
                    <option value="space-around">space-around</option>
                    <option value="space-evenly">space-evenly</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prop-align-items" className="block text-[12px] font-medium text-[var(--studio-text-strong)] mb-1">
                    Align Items
                  </label>
                  <select
                    id="prop-align-items"
                    value={effectiveAlign}
                    onChange={(e) => commitField('align-items', e.target.value, 'Update align items')}
                    className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[11.5px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="stretch">stretch</option>
                    <option value="flex-start">start</option>
                    <option value="center">center</option>
                    <option value="flex-end">end</option>
                    <option value="baseline">baseline</option>
                  </select>
                </div>
              </div>

              {effectiveDisplay.includes('flex') && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-[var(--studio-text-strong)]">Flex Wrap</span>
                  <div className="grid grid-cols-2 gap-0.5 bg-[var(--studio-bg)] border border-[var(--studio-border)] rounded-lg p-0.5 w-36">
                    {(['nowrap', 'wrap'] as const).map((wrapVal) => (
                      <button
                        key={wrapVal}
                        type="button"
                        aria-pressed={effectiveFlexWrap === wrapVal}
                        onClick={() => commitField('flex-wrap', wrapVal, 'Update flex wrap')}
                        className={`py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                          effectiveFlexWrap === wrapVal
                            ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs'
                            : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                        }`}
                      >
                        {wrapVal}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {effectiveDisplay.includes('grid') && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="prop-grid-cols" className="text-[12px] font-medium text-[var(--studio-text-strong)]">
                      Grid Columns
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4].map((cols) => {
                        const val = `repeat(${cols}, minmax(0, 1fr))`;
                        return (
                          <button
                            key={cols}
                            type="button"
                            onClick={() => {
                              setGridColsDraft(val);
                              commitField('grid-template-columns', val, `Set ${cols} grid columns`);
                            }}
                            className="px-1.5 py-0.5 rounded bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[10.5px] font-mono-tabular text-[var(--studio-text)] cursor-pointer"
                          >
                            {cols}c
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <input
                    id="prop-grid-cols"
                    type="text"
                    value={gridColsDraft}
                    placeholder="e.g. repeat(3, minmax(0, 1fr))"
                    onChange={(e) => setGridColsDraft(e.target.value)}
                    onBlur={() => commitField('grid-template-columns', gridColsDraft, 'Update grid columns')}
                    onKeyDown={(e) =>
                      e.key === 'Enter' &&
                      commitField('grid-template-columns', gridColsDraft, 'Update grid columns')
                    }
                    className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Size & Position */}
        <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
          <div className="flex items-center justify-between">
            <h3 className="studio-section-header">Dimensions &amp; Position</h3>
            <button
              type="button"
              onClick={() => {
                setWidthDraft('auto');
                setHeightDraft('auto');
                commitStylePatch({ width: null, height: null }, 'Reset dimensions');
              }}
              className="text-[11px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
            >
              Reset auto
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="prop-width" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  Width
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Auto', val: 'auto' },
                    { label: '100%', val: '100%' },
                    { label: 'Fit', val: 'fit-content' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setWidthDraft(p.val);
                        commitField('width', p.val, `Set width ${p.val}`);
                      }}
                      className="px-1 py-0.5 rounded bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[9.5px] font-mono-tabular text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="prop-width"
                type="text"
                value={widthDraft}
                onChange={(e) => setWidthDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = widthDraft.trim();
                  const isNumericPx = /^-?\d+(?:\.\d+)?(?:px)?$/i.test(trimmed);
                  const numW = parseFloat(trimmed);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && isNumericPx && Number.isFinite(numW) && numW > 0 && rectRatio > 0) {
                    const nextH = `${Math.max(16, Math.round(numW / rectRatio))}px`;
                    setHeightDraft(nextH);
                    commitStylePatch(
                      { width: trimmed.endsWith('px') ? trimmed : `${numW}px`, height: nextH },
                      'Scale width proportionally'
                    );
                  } else {
                    commitField('width', trimmed, 'Update width');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const trimmed = widthDraft.trim();
                  const isNumericPx = /^-?\d+(?:\.\d+)?(?:px)?$/i.test(trimmed);
                  const numW = parseFloat(trimmed);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && isNumericPx && Number.isFinite(numW) && numW > 0 && rectRatio > 0) {
                    const nextH = `${Math.max(16, Math.round(numW / rectRatio))}px`;
                    setHeightDraft(nextH);
                    commitStylePatch(
                      { width: trimmed.endsWith('px') ? trimmed : `${numW}px`, height: nextH },
                      'Scale width proportionally'
                    );
                  } else {
                    commitField('width', trimmed, 'Update width');
                  }
                }}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="prop-height" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                  Height
                </label>
                <div className="flex items-center gap-1">
                  {[
                    { label: 'Auto', val: 'auto' },
                    { label: '100%', val: '100%' },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setHeightDraft(p.val);
                        commitField('height', p.val, `Set height ${p.val}`);
                      }}
                      className="px-1 py-0.5 rounded bg-[var(--studio-bg)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[9.5px] font-mono-tabular text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="prop-height"
                type="text"
                value={heightDraft}
                onChange={(e) => setHeightDraft(e.target.value)}
                onBlur={() => {
                  const trimmed = heightDraft.trim();
                  const isNumericPx = /^-?\d+(?:\.\d+)?(?:px)?$/i.test(trimmed);
                  const numH = parseFloat(trimmed);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && isNumericPx && Number.isFinite(numH) && numH > 0 && rectRatio > 0) {
                    const nextW = `${Math.max(20, Math.round(numH * rectRatio))}px`;
                    setWidthDraft(nextW);
                    commitStylePatch(
                      { width: nextW, height: trimmed.endsWith('px') ? trimmed : `${numH}px` },
                      'Scale height proportionally'
                    );
                  } else {
                    commitField('height', trimmed, 'Update height');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const trimmed = heightDraft.trim();
                  const isNumericPx = /^-?\d+(?:\.\d+)?(?:px)?$/i.test(trimmed);
                  const numH = parseFloat(trimmed);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && isNumericPx && Number.isFinite(numH) && numH > 0 && rectRatio > 0) {
                    const nextW = `${Math.max(20, Math.round(numH * rectRatio))}px`;
                    setWidthDraft(nextW);
                    commitStylePatch(
                      { width: nextW, height: trimmed.endsWith('px') ? trimmed : `${numH}px` },
                      'Scale height proportionally'
                    );
                  } else {
                    commitField('height', trimmed, 'Update height');
                  }
                }}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-max-width" className="block text-[12px] font-medium text-[var(--studio-text-strong)] mb-1">
                Max Width
              </label>
              <input
                id="prop-max-width"
                type="text"
                value={maxWidthDraft}
                onChange={(e) => setMaxWidthDraft(e.target.value)}
                onBlur={() => commitField('max-width', maxWidthDraft.trim(), 'Update max width')}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  commitField('max-width', maxWidthDraft.trim(), 'Update max width')
                }
                placeholder="none"
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="prop-overflow" className="block text-[12px] font-medium text-[var(--studio-text-strong)] mb-1">
                Overflow
              </label>
              <select
                id="prop-overflow"
                value={effectiveOverflow}
                onChange={(e) => commitField('overflow', e.target.value, 'Update overflow')}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
              >
                <option value="visible">visible</option>
                <option value="hidden">hidden</option>
                <option value="auto">auto</option>
                <option value="clip">clip</option>
              </select>
            </div>
          </div>

          {/* Visual Aspect Ratio Lock Checkbox */}
          <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)]/70 studio-card-highlight transition-colors cursor-pointer">
            <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-[var(--studio-text-strong)]">
              <input
                type="checkbox"
                aria-label="Lock aspect ratio"
                checked={aspectRatioLocked}
                onChange={(e) => onToggleAspectRatioLock(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--studio-border-strong)] bg-[var(--studio-bg)] accent-indigo-500 cursor-pointer"
              />
              {aspectRatioLocked ? (
                <Lock className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-[var(--studio-muted-soft)]" strokeWidth={1.5} />
              )}
              Lock aspect ratio
            </span>
            <span className="font-mono-tabular text-[12px] text-[var(--studio-muted)]">
              {selectedElement.rect.height > 0
                ? `${(selectedElement.rect.width / selectedElement.rect.height).toFixed(2)}:1`
                : '1.00:1'}
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="prop-position" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Position
              </label>
              <select
                id="prop-position"
                value={effectivePosition}
                onChange={(e) => commitField('position', e.target.value, 'Update position')}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-1.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="static">static</option>
                <option value="relative">relative</option>
                <option value="absolute">absolute</option>
                <option value="fixed">fixed</option>
                <option value="sticky">sticky</option>
              </select>
            </div>
            <div>
              <label htmlFor="prop-left" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Left
              </label>
              <input
                id="prop-left"
                type="text"
                value={leftDraft}
                onChange={(e) => setLeftDraft(e.target.value)}
                onBlur={() => commitField('left', leftDraft.trim(), 'Update left offset')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('left', leftDraft.trim(), 'Update left offset')
                }
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
            <div>
              <label htmlFor="prop-top" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Top
              </label>
              <input
                id="prop-top"
                type="text"
                value={topDraft}
                onChange={(e) => setTopDraft(e.target.value)}
                onBlur={() => commitField('top', topDraft.trim(), 'Update top offset')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('top', topDraft.trim(), 'Update top offset')
                }
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
          </div>

          {effectivePosition !== 'static' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  commitStylePatch(
                    { position: null, left: null, top: null, right: null, bottom: null },
                    'Reset positioning'
                  )
                }
                className="text-[11px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
              >
                Reset position offsets
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">Nudge (8px)</span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => nudgePosition(-8, 0)}
                aria-label="Nudge left"
                className="p-1.5 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text-strong)] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, -8)}
                aria-label="Nudge up"
                className="p-1.5 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text-strong)] cursor-pointer"
              >
                <ArrowUp className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, 8)}
                aria-label="Nudge down"
                className="p-1.5 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text-strong)] cursor-pointer"
              >
                <ArrowDown className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(8, 0)}
                aria-label="Nudge right"
                className="p-1.5 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text-strong)] cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
              Arrange <span className="font-mono-tabular text-[var(--studio-muted)]">(z: {currentZIndex})</span>
            </span>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  commitStylePatch(
                    {
                      position: effectivePosition === 'static' ? 'relative' : effectivePosition,
                      'z-index': String(currentZIndex + 1),
                    },
                    'Bring forward'
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] cursor-pointer"
              >
                <BringToFront className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
                Forward
              </button>
              <button
                type="button"
                onClick={() =>
                  commitStylePatch(
                    {
                      position: effectivePosition === 'static' ? 'relative' : effectivePosition,
                      'z-index': String(Math.max(0, currentZIndex - 1)),
                    },
                    'Send backward'
                  )
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] cursor-pointer"
              >
                <SendToBack className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
                Backward
              </button>
            </div>
          </div>

          {/* Rotation Controls (MS 365 Arrange) */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">Rotate</span>
            <div className="inline-flex items-center gap-1">
              {(() => {
                const rawTf = selectedElement.inlineStyles.transform || selectedElement.styles.transform || '';
                const m = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(rawTf);
                const curDeg = m ? Math.round(parseFloat(m[1])) : 0;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        commitField('transform', `rotate(${(curDeg - 15) % 360}deg)`, 'Rotate -15°')
                      }
                      aria-label="Inspector rotate left 15"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] text-[var(--studio-text-strong)] cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
                      -15°
                    </button>
                    <button
                      type="button"
                      onClick={() => commitField('transform', '', 'Reset rotation')}
                      className="px-2 py-1 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] text-[12px] font-mono-tabular text-[var(--studio-text)] cursor-pointer"
                    >
                      {curDeg}°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitField('transform', `rotate(${(curDeg + 15) % 360}deg)`, 'Rotate +15°')
                      }
                      aria-label="Inspector rotate right 15"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] text-[var(--studio-text-strong)] cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" strokeWidth={1.5} />
                      +15°
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
          <div className="flex items-center justify-between">
            <h3 className="studio-section-header">Appearance</h3>
            <button
              type="button"
              onClick={() =>
                commitStylePatch(
                  {
                    'backdrop-filter': null,
                    'box-shadow': null,
                    'border-width': null,
                    'border-style': null,
                    'border-color': null,
                    'border-radius': null,
                    opacity: null,
                  },
                  'Clear surface effects'
                )
              }
              className="text-[11px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
            >
              Reset effects
            </button>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[12px] font-medium text-[var(--studio-text-strong)]">Surface Presets</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  {
                    label: 'Glass Card',
                    patch: {
                      'background-color': 'rgba(255, 255, 255, 0.72)',
                      'backdrop-filter': 'blur(14px)',
                      'border-width': '1px',
                      'border-style': 'solid',
                      'border-color': 'rgba(148, 163, 184, 0.35)',
                      'border-radius': '12px',
                      'box-shadow': '0 10px 28px rgba(15, 23, 42, 0.08)',
                    },
                  },
                  {
                    label: 'Soft Elevated',
                    patch: {
                      'background-color': '#ffffff',
                      'border-width': '1px',
                      'border-style': 'solid',
                      'border-color': '#e2e8f0',
                      'border-radius': '12px',
                      'box-shadow': '0 12px 30px rgba(15, 23, 42, 0.1)',
                    },
                  },
                  {
                    label: 'Crisp Hairline',
                    patch: {
                      'border-width': '1px',
                      'border-style': 'solid',
                      'border-color': '#cbd5e1',
                      'border-radius': '8px',
                      'box-shadow': 'none',
                    },
                  },
                  {
                    label: 'Accent Pill',
                    patch: {
                      'background-color': '#4f46e5',
                      color: '#ffffff',
                      'border-width': '0px',
                      'border-style': 'none',
                      'border-radius': '9999px',
                      'box-shadow': '0 4px 14px rgba(79, 70, 229, 0.3)',
                    },
                  },
                ] as Array<{ label: string; patch: Record<string, string | null> }>
              ).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => commitStylePatch(preset.patch, `Apply ${preset.label} preset`)}
                  className="py-1.5 px-2 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11.5px] font-medium text-[var(--studio-text-strong)] text-left transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity & Shadow Presets (MS 365 Effects) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="prop-opacity" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                Opacity
              </label>
              <span className="font-mono-tabular text-[12px] text-[var(--studio-text)]">
                {Math.round((parseFloat(selectedElement.styles.opacity || '1') || 1) * 100)}%
              </span>
            </div>
            <input
              id="prop-opacity"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={parseFloat(selectedElement.styles.opacity || '1') || 1}
              onChange={(e) => commitField('opacity', e.target.value === '1' ? '' : e.target.value, 'Update opacity')}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-[12.5px] font-medium text-[var(--studio-text-strong)]">Drop Shadow</span>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'None', val: '' },
                { label: 'Soft', val: '0 2px 8px rgba(15, 23, 42, 0.08)' },
                { label: 'Card', val: '0 8px 20px rgba(15, 23, 42, 0.12)' },
                { label: 'High', val: '0 16px 32px rgba(15, 23, 42, 0.18)' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => commitField('box-shadow', preset.val, `Shadow ${preset.label}`)}
                  className="py-1.5 rounded-lg bg-[var(--studio-input)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight text-[11px] font-medium text-[var(--studio-text)] cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="prop-bg-color" className="text-[12.5px] font-medium text-[var(--studio-text-strong)]">
                Background Color
              </label>
              <button
                type="button"
                onClick={() => commitStylePatch({ 'background-color': 'transparent' }, 'Clear background')}
                className="text-[11px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
              >
                Transparent
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500/60">
              <span
                className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer shadow-xs"
                style={{ backgroundColor: bgColorHex }}
              >
                <input
                  id="prop-bg-color"
                  type="color"
                  value={bgColorHex}
                  onChange={(e) =>
                    scheduleColorCommit('background-color', e.target.value, 'Update background color')
                  }
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </span>
              <input
                id="prop-bg-color-hex"
                type="text"
                aria-label="Background color value"
                value={bgColorDraft}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  setBgColorDraft(nextVal);
                  if (responsiveScope === 'all' && nextVal.trim()) {
                    onPreviewStyle({ 'background-color': nextVal });
                  }
                }}
                onBlur={() =>
                  commitField('background-color', bgColorDraft.trim(), 'Update background color')
                }
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  commitField('background-color', bgColorDraft.trim(), 'Update background color')
                }
                className="flex-1 min-w-0 bg-transparent text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="prop-border-width" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Border
              </label>
              <input
                id="prop-border-width"
                type="text"
                value={borderWidthDraft}
                onChange={(e) => setBorderWidthDraft(e.target.value)}
                onBlur={() => {
                  const patch: Record<string, string> = { 'border-width': borderWidthDraft };
                  if (effectiveBorderStyle === 'none' && parseFloat(borderWidthDraft) > 0) {
                    patch['border-style'] = 'solid';
                  }
                  commitStylePatch(patch, 'Update border width');
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const patch: Record<string, string> = { 'border-width': borderWidthDraft };
                  if (effectiveBorderStyle === 'none' && parseFloat(borderWidthDraft) > 0) {
                    patch['border-style'] = 'solid';
                  }
                  commitStylePatch(patch, 'Update border width');
                }}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              />
            </div>
            <div>
              <label htmlFor="prop-border-style" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Style
              </label>
              <select
                id="prop-border-style"
                value={effectiveBorderStyle}
                onChange={(e) => commitField('border-style', e.target.value, 'Update border style')}
                className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-1.5 py-1.5 text-[12px] text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="none">none</option>
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
              </select>
            </div>
            <div>
              <label htmlFor="prop-border-color" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
                Color
              </label>
              <div className="flex items-center gap-1.5 rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-1.5 py-1 focus-within:border-indigo-500">
                <span
                  className="relative w-5 h-5 rounded-md border border-[var(--studio-border-strong)] shrink-0 overflow-hidden cursor-pointer"
                  style={{ backgroundColor: borderColorHex }}
                >
                  <input
                    id="prop-border-color"
                    type="color"
                    value={borderColorHex}
                    onChange={(e) =>
                      scheduleColorCommit('border-color', e.target.value, 'Update border color')
                    }
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </span>
                <span className="font-mono-tabular text-[11px] text-[var(--studio-muted)] truncate">
                  {borderColorHex}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="prop-border-radius" className="block text-[12.5px] font-medium text-[var(--studio-text-strong)] mb-1">
              Border Radius
            </label>
            <input
              id="prop-border-radius"
              type="text"
              value={borderRadiusDraft}
              onChange={(e) => setBorderRadiusDraft(e.target.value)}
              onBlur={() => commitField('border-radius', borderRadiusDraft, 'Update border radius')}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                commitField('border-radius', borderRadiusDraft, 'Update border radius')
              }
              className="w-full rounded-lg bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="studio-section-header">Spacing</h3>
            <div className="flex items-center gap-2 text-[11px] font-mono-tabular">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-xs bg-emerald-500/70 inline-block" />
                Pad
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <span className="w-2 h-2 rounded-xs bg-amber-500/70 inline-block" />
                Margin
              </span>
              <button
                type="button"
                onClick={() => setSpacingPerSideOpen((prev) => !prev)}
                className="text-[10.5px] font-sans font-medium text-indigo-500 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                {spacingPerSideOpen ? 'Simple' : '4-side'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div
              onMouseEnter={() => onHoverSpacing('padding')}
              onMouseLeave={() => onHoverSpacing(null)}
            >
              <label htmlFor="prop-padding" className="block text-[12px] font-medium text-emerald-700 dark:text-emerald-300/90 mb-1">
                Padding
              </label>
              <input
                id="prop-padding"
                type="text"
                value={paddingDraft}
                onChange={(e) => setPaddingDraft(e.target.value)}
                onFocus={() => onHoverSpacing('padding')}
                onBlur={() => {
                  onHoverSpacing(null);
                  commitField('padding', paddingDraft, 'Update padding');
                }}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('padding', paddingDraft, 'Update padding')
                }
                className="w-full h-7 rounded-md bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <div
              onMouseEnter={() => onHoverSpacing('margin')}
              onMouseLeave={() => onHoverSpacing(null)}
            >
              <label htmlFor="prop-margin" className="block text-[12px] font-medium text-amber-700 dark:text-amber-300/90 mb-1">
                Margin
              </label>
              <input
                id="prop-margin"
                type="text"
                value={marginDraft}
                onChange={(e) => setMarginDraft(e.target.value)}
                onFocus={() => onHoverSpacing('margin')}
                onBlur={() => {
                  onHoverSpacing(null);
                  commitField('margin', marginDraft, 'Update margin');
                }}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('margin', marginDraft, 'Update margin')
                }
                className="w-full h-7 rounded-md bg-[var(--studio-input)] border border-[var(--studio-border)] studio-card-highlight px-2.5 text-[12px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
          </div>

          {spacingPerSideOpen && (
            <div className="space-y-2.5 pt-1 border-t border-[var(--studio-border-subtle)]">
              <div
                onMouseEnter={() => onHoverSpacing('padding')}
                onMouseLeave={() => onHoverSpacing(null)}
                className="space-y-1"
              >
                <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300/90">
                  Padding sides (px)
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                    const commitSide = () => {
                      const raw = padSideDrafts[side].trim() || '0';
                      const cssVal = /^-?\d+(?:\.\d+)?$/.test(raw) ? `${raw}px` : raw;
                      commitField(`padding-${side}`, cssVal, `Update padding-${side}`);
                    };
                    return (
                      <div key={`pad-${side}`}>
                        <label
                          htmlFor={`prop-pad-${side}`}
                          className="block text-[10px] uppercase text-[var(--studio-muted-soft)] mb-0.5"
                        >
                          {side[0]}
                        </label>
                        <input
                          id={`prop-pad-${side}`}
                          type="text"
                          value={padSideDrafts[side]}
                          onFocus={() => onHoverSpacing('padding')}
                          onChange={(e) =>
                            setPadSideDrafts((prev) => ({ ...prev, [side]: e.target.value }))
                          }
                          onBlur={() => {
                            onHoverSpacing(null);
                            commitSide();
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && commitSide()}
                          className="w-full h-6 rounded bg-[var(--studio-input)] border border-[var(--studio-border)] px-1.5 text-[11px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                onMouseEnter={() => onHoverSpacing('margin')}
                onMouseLeave={() => onHoverSpacing(null)}
                className="space-y-1"
              >
                <span className="block text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
                  Margin sides (px)
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                    const commitSide = () => {
                      const raw = marginSideDrafts[side].trim() || '0';
                      const cssVal = /^-?\d+(?:\.\d+)?$/.test(raw) ? `${raw}px` : raw;
                      commitField(`margin-${side}`, cssVal, `Update margin-${side}`);
                    };
                    return (
                      <div key={`mar-${side}`}>
                        <label
                          htmlFor={`prop-margin-${side}`}
                          className="block text-[10px] uppercase text-[var(--studio-muted-soft)] mb-0.5"
                        >
                          {side[0]}
                        </label>
                        <input
                          id={`prop-margin-${side}`}
                          type="text"
                          value={marginSideDrafts[side]}
                          onFocus={() => onHoverSpacing('margin')}
                          onChange={(e) =>
                            setMarginSideDrafts((prev) => ({ ...prev, [side]: e.target.value }))
                          }
                          onBlur={() => {
                            onHoverSpacing(null);
                            commitSide();
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && commitSide()}
                          className="w-full h-6 rounded bg-[var(--studio-input)] border border-[var(--studio-border)] px-1.5 text-[11px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-2.5 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] shrink-0">
        <button
          type="button"
          onClick={onRemoveElement}
          className="w-full h-8 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/18 border border-red-500/30 studio-pressable cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.4} />
          Remove Element
        </button>
      </div>
    </div>
  );
};

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
  Copy,
  Eye,
  EyeOff,
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
} from 'lucide-react';
import type {
  ButtonActionType,
  ResponsiveScope,
  SelectedElementInfo,
} from '../types/editor';
import {
  cssColorToHex,
  getTableMetricsInHtml,
  listHtmlElementIds,
  type SvgShapeHtmlPatch,
} from '../utils/htmlSync';
import { getNodeDeviceVisibility, getResponsiveNodeStyles } from '../utils/responsiveCss';

interface InspectorPanelProps {
  selectedElement: SelectedElementInfo | null;
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
}

const SCOPE_LABELS: Record<ResponsiveScope, string> = {
  all: 'Base styles (all screen sizes)',
  desktop: 'Desktop view only (≥ 769px)',
  tablet: 'Tablet view only (481px – 768px)',
  mobile: 'Mobile view only (≤ 480px)',
};

const FONT_FAMILY_OPTIONS = [
  { label: 'Inherit / Default', value: '' },
  { label: 'Segoe UI (Office)', value: '"Segoe UI", Tahoma, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia Serif', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const POINT_PRESETS = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt', '32pt', '48pt'];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedElement,
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
  const [cellPaddingDraft, setCellPaddingDraft] = useState('10px 12px');

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

    if (selectedElement.svgShape) {
      const nextShape = selectedElement.svgShape;
      const prevShape = prevSvgShapeRef.current;
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      const activeAria = activeEl?.getAttribute('aria-label') || '';
      const activeId = activeEl?.id || '';

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

  if (!selectedElement) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-lg bg-slate-800/70 border border-slate-700/80 flex items-center justify-center mb-3">
          <MousePointerClick className="w-5 h-5 text-slate-400" />
        </div>
        <h2 className="font-display text-sm font-semibold text-slate-200 mb-1.5">
          Select an element
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-60">
          Click any element in the Live Canvas to customize typography, button actions, or
          desktop/mobile layouts.
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
    const parsePx = (val: string) => {
      const num = parseFloat(val);
      return Number.isFinite(num) ? num : 0;
    };
    const nextLeft = Math.round(parsePx(leftDraft || '0') + dx);
    const nextTop = Math.round(parsePx(topDraft || '0') + dy);

    const patch: Record<string, string> = {
      left: `${nextLeft}px`,
      top: `${nextTop}px`,
    };
    if (effectivePosition === 'static') {
      patch.position = 'relative';
    }
    commitStylePatch(patch, 'Nudge element position');
  };

  const hasScopeOverrides = Object.keys(scopeOverrides).length > 0;
  const isActionableTag =
    selectedElement.tagName === 'button' ||
    selectedElement.tagName === 'a' ||
    Boolean(selectedElement.actionType);
  const isSvgShape = selectedElement.tagName === 'svg' || Boolean(selectedElement.veShape && selectedElement.tagName === 'svg');
  const currentZIndex = Number.parseInt(
    (responsiveScope !== 'all' && scopeOverrides['z-index']) || selectedElement.styles.zIndex || '0',
    10
  ) || 0;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Element Identity & Quick Actions */}
      <div className="px-4 py-3 border-b border-slate-800/80 space-y-2.5 shrink-0 bg-[#0a0f18]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono-tabular text-xs font-semibold text-blue-400 truncate">
                &lt;{selectedElement.tagName}&gt;
                {selectedElement.veShape ? ` (${selectedElement.veShape})` : selectedElement.id ? `#${selectedElement.id}` : ''}
              </span>
              <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">
                {Math.round(selectedElement.rect.width)} × {Math.round(selectedElement.rect.height)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate" title={selectedElement.selectorPath}>
              {selectedElement.selectorPath}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDuplicateElement}
              aria-label="Duplicate selected element"
              title="Duplicate element (Ctrl+D)"
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleVisibility}
              aria-label={selectedElement.isHidden ? 'Show element' : 'Hide element'}
              title={selectedElement.isHidden ? 'Show element' : 'Hide element'}
              className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {selectedElement.isHidden ? (
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onRemoveElement}
              aria-label="Remove selected element"
              title="Remove element"
              className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Responsive Breakpoint Scope Selector */}
        <div className="space-y-1">
          <div
            className="grid grid-cols-4 p-0.5 rounded-md bg-[#090d16] border border-slate-800"
            role="group"
            aria-label="Responsive Editing Scope"
          >
            {(['all', 'desktop', 'tablet', 'mobile'] as ResponsiveScope[]).map((scope) => (
              <button
                key={scope}
                type="button"
                onClick={() => onChangeResponsiveScope(scope)}
                aria-pressed={responsiveScope === scope}
                className={`py-1 rounded text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                  responsiveScope === scope
                    ? scope === 'mobile'
                      ? 'bg-amber-600 text-white'
                      : scope === 'desktop'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
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
                className="text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Properties */}
      <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-5">
        {/* Button & Link Action Section */}
        {isActionableTag && (
          <section className="space-y-2.5 pb-4 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
                Button &amp; Link Action
              </h3>
              <span className="text-[10px] text-slate-400">Runs in Using Mode</span>
            </div>

            <div>
              <label htmlFor="prop-action-type" className="block text-[11px] text-slate-400 mb-1">
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
                  <label htmlFor="prop-action-url" className="block text-[11px] text-slate-400 mb-1">
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
                    className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="prop-action-target" className="block text-[11px] text-slate-400 mb-1">
                    Open In
                  </label>
                  <select
                    id="prop-action-target"
                    value={actionTargetDraft}
                    onChange={(e) => {
                      setActionTargetDraft(e.target.value);
                      applyButtonAction('url', actionValueDraft, e.target.value);
                    }}
                    className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
                  <label htmlFor="prop-action-page" className="block text-[11px] text-slate-400 mb-1">
                    Target App Page
                  </label>
                  <select
                    id="prop-action-page"
                    value={actionValueDraft}
                    onChange={(e) => {
                      setActionValueDraft(e.target.value);
                      applyButtonAction('page', e.target.value, actionTargetDraft);
                    }}
                    className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
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
                    className="flex-1 min-w-0 rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
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
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-medium text-white shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Page
                  </button>
                </div>
              </div>
            )}

            {(actionTypeDraft === 'scroll' || actionTypeDraft === 'toggle') && (
              <div className="space-y-1.5">
                <label htmlFor="prop-action-target-id" className="block text-[11px] text-slate-400">
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
                    className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
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
                  className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {actionTypeDraft === 'alert' && (
              <div>
                <label htmlFor="prop-action-alert" className="block text-[11px] text-slate-400 mb-1">
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
                  className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </section>
        )}

        {/* Table Subsection */}
        {isTableTag && (
          <section
            aria-label="Table Inspector"
            className="space-y-3 pb-4 border-b border-slate-800/80"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                Table
              </h3>
              {tableMetrics && (
                <span className="font-mono-tabular text-[11px] text-slate-400">
                  {tableMetrics.rows} rows × {tableMetrics.cols} cols
                </span>
              )}
            </div>

            {/* Rows & Columns Controls */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onAddTableRow}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-emerald-400" />
                Add Row
              </button>
              <button
                type="button"
                disabled={!tableMetrics || tableMetrics.rows <= 1}
                onClick={onRemoveTableRow}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 text-red-400" />
                Remove Row
              </button>
              <button
                type="button"
                onClick={onAddTableColumn}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-100 transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3 text-blue-400" />
                Add Column
              </button>
              <button
                type="button"
                disabled={!tableMetrics || tableMetrics.cols <= 1}
                onClick={onRemoveTableColumn}
                className="inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 text-red-400" />
                Remove Column
              </button>
            </div>

            {/* Cell Padding */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="table-cell-padding" className="text-[11px] text-slate-400">
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
                      className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                        cellPaddingDraft === preset.val
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Cell Alignment */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Cell Horiz. Align</span>
                <div className="grid grid-cols-3 gap-0.5 bg-slate-900 border border-slate-700/80 rounded p-0.5">
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
                      className={`flex items-center justify-center py-1 rounded text-xs cursor-pointer ${
                        tableMetrics?.cellAlign === val
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-[11px] text-slate-400 mb-1">Cell Vert. Align</span>
                <div className="grid grid-cols-3 gap-0.5 bg-slate-900 border border-slate-700/80 rounded p-0.5">
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
                      className={`flex items-center justify-center py-1 rounded text-xs cursor-pointer ${
                        tableMetrics?.cellVAlign === val
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table Style Options */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-slate-400">Alternating Row Shading</span>
              <button
                type="button"
                aria-pressed={Boolean(tableMetrics?.isStriped)}
                onClick={() => onToggleTableStriped(!tableMetrics?.isStriped)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                  tableMetrics?.isStriped
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {tableMetrics?.isStriped ? 'Striped: On' : 'Striped: Off'}
              </button>
            </div>
          </section>
        )}

        {/* Per-Device Visibility */}
        <section className="space-y-2 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200">Device Visibility</h3>
            <span className="text-[11px] text-slate-500">Show / hide per screen</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('desktop')}
              aria-pressed={deviceVisibility.desktop}
              className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                deviceVisibility.desktop
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                  : 'bg-red-500/10 border-red-500/30 text-red-300 line-through'
              }`}
            >
              <Laptop className="w-3 h-3" />
              Desktop
            </button>
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('tablet')}
              aria-pressed={deviceVisibility.tablet}
              className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                deviceVisibility.tablet
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                  : 'bg-red-500/10 border-red-500/30 text-red-300 line-through'
              }`}
            >
              <Tablet className="w-3 h-3" />
              Tablet
            </button>
            <button
              type="button"
              onClick={() => onToggleDeviceVisibility('mobile')}
              aria-pressed={deviceVisibility.mobile}
              className={`inline-flex items-center justify-center gap-1 py-1.5 px-2 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                deviceVisibility.mobile
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100'
                  : 'bg-red-500/10 border-red-500/30 text-red-300 line-through'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              Mobile
            </button>
          </div>
        </section>

        {/* Text Content */}
        {selectedElement.isTextEditable && (
          <section className="space-y-2 pb-4 border-b border-slate-800/80">
            <label
              htmlFor="inspector-text-content"
              className="block text-xs font-semibold text-slate-200"
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
              className="w-full rounded-md bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
            />
          </section>
        )}

        {/* Shape Properties Section for SVG Shapes */}
        {isSvgShape && (
          <section
            aria-label="Shape Properties"
            className="space-y-3 pb-4 border-b border-slate-800/80"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Shapes className="w-3.5 h-3.5 text-sky-400" />
                Shape Properties
              </h3>
              {selectedElement.svgShape && (
                <span className="font-mono-tabular text-[10px] text-slate-400">
                  &lt;{selectedElement.svgShape.childTag}&gt; · {selectedElement.svgShape.viewBox}
                </span>
              )}
            </div>

            {/* Fill Color */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="prop-shape-fill" className="text-[11px] text-slate-400">
                  Fill Color
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShapeFillDraft('none');
                    onPreviewSvgShape({ fill: 'none' });
                    onCommitSvgShape({ fill: 'none' }, 'Clear shape fill');
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Transparent
                </button>
              </div>
              <div className="flex items-center gap-2">
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
                  className="w-8 h-7 rounded bg-transparent border border-slate-700 cursor-pointer shrink-0"
                />
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
                  className="flex-1 rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Stroke Color & Stroke Width */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="prop-shape-stroke" className="text-[11px] text-slate-400">
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
                    className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    None
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
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
                    className="w-8 h-7 rounded bg-transparent border border-slate-700 cursor-pointer shrink-0"
                  />
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
                    className="w-full min-w-0 rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prop-shape-stroke-width" className="block text-[11px] text-slate-400 mb-1">
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
                  className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Path / Points / Geometry Data */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="prop-shape-path" className="text-[11px] text-slate-400">
                  {selectedElement.svgShape?.dataMode === 'points'
                    ? 'Polygon Points (or SVG Path M...)'
                    : selectedElement.svgShape?.dataMode === 'circle'
                      ? 'Circle (cx, cy, r) or Path Data (M...)'
                      : 'SVG Path Data (d)'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onPreviewSvgShape({ pathData: shapePathDraft });
                    onCommitSvgShape({ pathData: shapePathDraft }, 'Update shape path data');
                  }}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-[11px] font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
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
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 cursor-pointer"
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
          <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200">Typography</h3>
            <div className="inline-flex items-center gap-0.5 bg-slate-900 border border-slate-700/80 rounded p-0.5">
              <button
                type="button"
                aria-label="Inspector Bold"
                aria-pressed={isBold}
                onClick={() => commitField('font-weight', isBold ? '400' : '700', 'Toggle bold')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  isBold ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Bold className="w-3 h-3" />
              </button>
              <button
                type="button"
                aria-label="Inspector Italic"
                aria-pressed={isItalic}
                onClick={() =>
                  commitField('font-style', isItalic ? 'normal' : 'italic', 'Toggle italic')
                }
                className={`p-1 rounded text-xs cursor-pointer ${
                  isItalic ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Italic className="w-3 h-3" />
              </button>
              <button
                type="button"
                aria-label="Inspector Underline"
                aria-pressed={isUnderline}
                onClick={() => toggleTextDeco('underline')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  isUnderline ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Underline className="w-3 h-3" />
              </button>
              <button
                type="button"
                aria-label="Inspector Strikethrough"
                aria-pressed={isStrike}
                onClick={() => toggleTextDeco('line-through')}
                className={`p-1 rounded text-xs cursor-pointer ${
                  isStrike ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Strikethrough className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="prop-font-family" className="block text-[11px] text-slate-400 mb-1">
              Font Family
            </label>
            <select
              id="prop-font-family"
              value={effectiveFontFamily}
              onChange={(e) => commitField('font-family', e.target.value, 'Update font family')}
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {FONT_FAMILY_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="prop-font-size" className="block text-[11px] text-slate-400 mb-1">
                Size (pt/px)
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <datalist id="point-size-presets">
                {POINT_PRESETS.map((pt) => (
                  <option key={pt} value={pt} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="prop-font-weight" className="block text-[11px] text-slate-400 mb-1">
                Weight
              </label>
              <select
                id="prop-font-weight"
                value={effectiveFontWeight}
                onChange={(e) => commitField('font-weight', e.target.value, 'Update font weight')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-1.5 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="400">400</option>
                <option value="500">500</option>
                <option value="600">600</option>
                <option value="700">700</option>
              </select>
            </div>
            <div>
              <label htmlFor="prop-line-height" className="block text-[11px] text-slate-400 mb-1">
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prop-text-color" className="block text-[11px] text-slate-400 mb-1">
              Text Color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="prop-text-color"
                type="color"
                value={textColorHex}
                onChange={(e) => scheduleColorCommit('color', e.target.value, 'Update text color')}
                className="w-8 h-7 rounded bg-transparent border border-slate-700 cursor-pointer shrink-0"
              />
              <input
                type="text"
                aria-label="Text color hex"
                value={textColorHex}
                onChange={(e) => commitField('color', e.target.value, 'Update text color')}
                className="flex-1 rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>
        )}

        {/* Layout & Alignment */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <h3 className="text-xs font-semibold text-slate-200">Layout &amp; Alignment</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-display" className="block text-[11px] text-slate-400 mb-1">
                Display
              </label>
              <select
                id="prop-display"
                value={effectiveDisplay}
                onChange={(e) => commitField('display', e.target.value, 'Update display')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
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
              <label htmlFor="prop-flex-dir" className="block text-[11px] text-slate-400 mb-1">
                Flex Direction
              </label>
              <select
                id="prop-flex-dir"
                value={effectiveFlexDir}
                onChange={(e) =>
                  commitStylePatch(
                    {
                      display: effectiveDisplay.includes('flex') ? effectiveDisplay : 'flex',
                      'flex-direction': e.target.value,
                    },
                    'Update flex direction'
                  )
                }
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="row">row</option>
                <option value="column">column</option>
                <option value="row-reverse">row-reverse</option>
                <option value="column-reverse">column-reverse</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-gap" className="block text-[11px] text-slate-400 mb-1">
                Gap
              </label>
              <input
                id="prop-gap"
                type="text"
                value={gapDraft}
                onChange={(e) => setGapDraft(e.target.value)}
                onBlur={() => commitField('gap', gapDraft, 'Update gap')}
                onKeyDown={(e) => e.key === 'Enter' && commitField('gap', gapDraft, 'Update gap')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <span className="block text-[11px] text-slate-400 mb-1">Text Align</span>
              <div className="grid grid-cols-4 gap-0.5 bg-slate-900 border border-slate-700/80 rounded p-0.5">
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
                    onClick={() => commitField('text-align', val, 'Update text align')}
                    className={`flex items-center justify-center py-1 rounded text-xs cursor-pointer ${
                      effectiveTextAlign === val
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Size & Position */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200">Dimensions &amp; Position</h3>
            <button
              type="button"
              onClick={() => {
                setWidthDraft('auto');
                setHeightDraft('auto');
                commitStylePatch({ width: null, height: null }, 'Reset dimensions');
              }}
              className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Reset auto
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-width" className="block text-[11px] text-slate-400 mb-1">
                Width
              </label>
              <input
                id="prop-width"
                type="text"
                value={widthDraft}
                onChange={(e) => setWidthDraft(e.target.value)}
                onBlur={() => {
                  const numW = parseFloat(widthDraft);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && Number.isFinite(numW) && numW > 0 && rectRatio > 0) {
                    const nextH = `${Math.max(16, Math.round(numW / rectRatio))}px`;
                    setHeightDraft(nextH);
                    commitStylePatch(
                      { width: widthDraft, height: nextH },
                      'Scale width proportionally'
                    );
                  } else {
                    commitField('width', widthDraft, 'Update width');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const numW = parseFloat(widthDraft);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && Number.isFinite(numW) && numW > 0 && rectRatio > 0) {
                    const nextH = `${Math.max(16, Math.round(numW / rectRatio))}px`;
                    setHeightDraft(nextH);
                    commitStylePatch(
                      { width: widthDraft, height: nextH },
                      'Scale width proportionally'
                    );
                  } else {
                    commitField('width', widthDraft, 'Update width');
                  }
                }}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="prop-height" className="block text-[11px] text-slate-400 mb-1">
                Height
              </label>
              <input
                id="prop-height"
                type="text"
                value={heightDraft}
                onChange={(e) => setHeightDraft(e.target.value)}
                onBlur={() => {
                  const numH = parseFloat(heightDraft);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && Number.isFinite(numH) && numH > 0 && rectRatio > 0) {
                    const nextW = `${Math.max(20, Math.round(numH * rectRatio))}px`;
                    setWidthDraft(nextW);
                    commitStylePatch(
                      { width: nextW, height: heightDraft },
                      'Scale height proportionally'
                    );
                  } else {
                    commitField('height', heightDraft, 'Update height');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  const numH = parseFloat(heightDraft);
                  const rectRatio =
                    selectedElement.rect.height > 0
                      ? selectedElement.rect.width / selectedElement.rect.height
                      : 1;
                  if (aspectRatioLocked && Number.isFinite(numH) && numH > 0 && rectRatio > 0) {
                    const nextW = `${Math.max(20, Math.round(numH * rectRatio))}px`;
                    setWidthDraft(nextW);
                    commitStylePatch(
                      { width: nextW, height: heightDraft },
                      'Scale height proportionally'
                    );
                  } else {
                    commitField('height', heightDraft, 'Update height');
                  }
                }}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Visual Aspect Ratio Lock Checkbox */}
          <label className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-200">
              <input
                type="checkbox"
                aria-label="Lock aspect ratio"
                checked={aspectRatioLocked}
                onChange={(e) => onToggleAspectRatioLock(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-950 accent-blue-500 cursor-pointer"
              />
              {aspectRatioLocked ? (
                <Lock className="w-3 h-3 text-blue-400" />
              ) : (
                <Unlock className="w-3 h-3 text-slate-500" />
              )}
              Lock aspect ratio
            </span>
            <span className="font-mono-tabular text-[10px] text-slate-400">
              {selectedElement.rect.height > 0
                ? `${(selectedElement.rect.width / selectedElement.rect.height).toFixed(2)}:1`
                : '1.00:1'}
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="prop-position" className="block text-[11px] text-slate-400 mb-1">
                Position
              </label>
              <select
                id="prop-position"
                value={effectivePosition}
                onChange={(e) => commitField('position', e.target.value, 'Update position')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="static">static</option>
                <option value="relative">relative</option>
                <option value="absolute">absolute</option>
              </select>
            </div>
            <div>
              <label htmlFor="prop-left" className="block text-[11px] text-slate-400 mb-1">
                Left
              </label>
              <input
                id="prop-left"
                type="text"
                value={leftDraft}
                onChange={(e) => setLeftDraft(e.target.value)}
                onBlur={() => commitField('left', leftDraft, 'Update left offset')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="prop-top" className="block text-[11px] text-slate-400 mb-1">
                Top
              </label>
              <input
                id="prop-top"
                type="text"
                value={topDraft}
                onChange={(e) => setTopDraft(e.target.value)}
                onBlur={() => commitField('top', topDraft, 'Update top offset')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">Nudge (8px)</span>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => nudgePosition(-8, 0)}
                aria-label="Nudge left"
                className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, -8)}
                aria-label="Nudge up"
                className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(0, 8)}
                aria-label="Nudge down"
                className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => nudgePosition(8, 0)}
                aria-label="Nudge right"
                className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">Arrange (z: {currentZIndex})</span>
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
              >
                <BringToFront className="w-3 h-3 text-blue-400" />
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
              >
                <SendToBack className="w-3 h-3 text-slate-400" />
                Backward
              </button>
            </div>
          </div>

          {/* Rotation Controls (MS 365 Arrange) */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">Rotate</span>
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
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      -15°
                    </button>
                    <button
                      type="button"
                      onClick={() => commitField('transform', '', 'Reset rotation')}
                      className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono-tabular text-slate-300 cursor-pointer"
                    >
                      {curDeg}°
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        commitField('transform', `rotate(${(curDeg + 15) % 360}deg)`, 'Rotate +15°')
                      }
                      aria-label="Inspector rotate right 15"
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      +15°
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <h3 className="text-xs font-semibold text-slate-200">Appearance</h3>

          {/* Opacity & Shadow Presets (MS 365 Effects) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="prop-opacity" className="text-[11px] text-slate-400">
                Opacity
              </label>
              <span className="font-mono-tabular text-[11px] text-slate-300">
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
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <span className="block text-[11px] text-slate-400">Drop Shadow</span>
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
                  className="py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="prop-bg-color" className="text-[11px] text-slate-400">
                Background Color
              </label>
              <button
                type="button"
                onClick={() => commitStylePatch({ 'background-color': 'transparent' }, 'Clear background')}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Transparent
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="prop-bg-color"
                type="color"
                value={bgColorHex}
                onChange={(e) =>
                  scheduleColorCommit('background-color', e.target.value, 'Update background color')
                }
                className="w-8 h-7 rounded bg-transparent border border-slate-700 cursor-pointer shrink-0"
              />
              <input
                type="text"
                aria-label="Background color value"
                value={
                  (responsiveScope !== 'all' && scopeOverrides['background-color']) ||
                  cssColorToHex(selectedElement.styles.backgroundColor) ||
                  selectedElement.styles.backgroundColor
                }
                onChange={(e) =>
                  commitField('background-color', e.target.value, 'Update background color')
                }
                className="flex-1 rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="prop-border-width" className="block text-[11px] text-slate-400 mb-1">
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
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="prop-border-style" className="block text-[11px] text-slate-400 mb-1">
                Style
              </label>
              <select
                id="prop-border-style"
                value={effectiveBorderStyle}
                onChange={(e) => commitField('border-style', e.target.value, 'Update border style')}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-1.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="none">none</option>
                <option value="solid">solid</option>
                <option value="dashed">dashed</option>
                <option value="dotted">dotted</option>
              </select>
            </div>
            <div>
              <label htmlFor="prop-border-color" className="block text-[11px] text-slate-400 mb-1">
                Color
              </label>
              <input
                id="prop-border-color"
                type="color"
                value={borderColorHex}
                onChange={(e) =>
                  scheduleColorCommit('border-color', e.target.value, 'Update border color')
                }
                className="w-full h-7 rounded bg-transparent border border-slate-700 cursor-pointer"
              />
            </div>
          </div>

          <div>
            <label htmlFor="prop-border-radius" className="block text-[11px] text-slate-400 mb-1">
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
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-3 pb-2">
          <h3 className="text-xs font-semibold text-slate-200">Spacing</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="prop-padding" className="block text-[11px] text-slate-400 mb-1">
                Padding
              </label>
              <input
                id="prop-padding"
                type="text"
                value={paddingDraft}
                onChange={(e) => setPaddingDraft(e.target.value)}
                onBlur={() => commitField('padding', paddingDraft, 'Update padding')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('padding', paddingDraft, 'Update padding')
                }
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="prop-margin" className="block text-[11px] text-slate-400 mb-1">
                Margin
              </label>
              <input
                id="prop-margin"
                type="text"
                value={marginDraft}
                onChange={(e) => setMarginDraft(e.target.value)}
                onBlur={() => commitField('margin', marginDraft, 'Update margin')}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commitField('margin', marginDraft, 'Update margin')
                }
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-800/80 bg-[#0a0f18] shrink-0">
        <button
          type="button"
          onClick={onRemoveElement}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Element
        </button>
      </div>
    </div>
  );
};

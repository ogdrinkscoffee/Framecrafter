import React, { useEffect, useRef, useState } from 'react';
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftRight,
  ArrowRight,
  Bold,
  BringToFront,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  Copy,
  Diamond,
  Eye,
  Heart,
  Hexagon,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  Minus,
  MousePointerClick,
  Move,
  Paintbrush,
  Pentagon,
  RefreshCw,
  RemoveFormatting,
  Replace,
  RotateCcw,
  RotateCw,
  SendToBack,
  Shapes,
  Square,
  Star,
  StickyNote,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Triangle,
  Underline,
} from 'lucide-react';
import type {
  AutoSaveStatus,
  CenterTab,
  DraggableComponentDef,
  EditorMode,
  ElementRect,
  ProjectFile,
  SelectedElementInfo,
  ViewportPreset,
} from '../types/editor';
import { buildTableHtml, cssColorToHex } from '../utils/htmlSync';

interface CanvasWorkspaceProps {
  centerTab: CenterTab;
  onChangeCenterTab: (tab: CenterTab) => void;
  editorMode: EditorMode;
  defaultStartupMode: EditorMode;
  onToggleDefaultStartupMode: () => void;
  autoSaveStatus: AutoSaveStatus;
  onToggleAutoSave: () => void;
  viewport: ViewportPreset;
  srcDoc: string;
  previewKey: number;
  entryHtmlPath: string | null;
  htmlPages: string[];
  onSwitchPreviewPage: (pagePath: string) => void;
  activeFile: ProjectFile | null;
  jumpToLine: { path: string; line: number; token: number } | null;
  selectedElement: SelectedElementInfo | null;
  aspectRatioLocked: boolean;
  draggingComponent: DraggableComponentDef | null;
  formatPainterActive: boolean;
  onToggleFormatPainter: () => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onRefreshPreview: () => void;
  onPreviewResizeStyle: (styles: Record<string, string>) => void;
  onCommitResizeStyle: (styles: Record<string, string | null>, label: string) => void;
  onCommitFormattingStyle: (styles: Record<string, string | null>, label: string) => void;
  onQuickInsertById: (componentId: string) => void;
  onInsertCustomHtml: (snippet: string, label: string) => void;
  onInsertSymbol: (symbol: string) => void;
  onFindAndReplace: (findText: string, replaceText: string, matchCase: boolean) => number;
  onDuplicateSelected: () => void;
  onUpdateCodeContent: (path: string, nextContent: string) => void;
  onPostIframeMessage: (msg: Record<string, unknown>) => void;
  onDropComponentOnCanvas: (component: DraggableComponentDef) => void;
}

type ResizeHandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_CURSORS: Record<ResizeHandleDir, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

const HANDLE_POSITIONS: Record<ResizeHandleDir, string> = {
  nw: '-top-1.5 -left-1.5',
  n: '-top-1.5 left-1/2 -translate-x-1/2',
  ne: '-top-1.5 -right-1.5',
  e: 'top-1/2 -translate-y-1/2 -right-1.5',
  se: '-bottom-1.5 -right-1.5',
  s: '-bottom-1.5 left-1/2 -translate-x-1/2',
  sw: '-bottom-1.5 -left-1.5',
  w: 'top-1/2 -translate-y-1/2 -left-1.5',
};

const RIBBON_FONT_OPTIONS = [
  { label: 'Segoe UI', value: '"Segoe UI", Tahoma, sans-serif' },
  { label: 'Calibri', value: 'Calibri, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
];

const POINT_SIZE_OPTIONS = [
  '8pt',
  '9pt',
  '10pt',
  '11pt',
  '12pt',
  '14pt',
  '16pt',
  '18pt',
  '20pt',
  '24pt',
  '28pt',
  '36pt',
  '48pt',
  '72pt',
];

const SHAPE_GALLERY_ITEMS = [
  { id: 'shape-circle', label: 'Circle (SVG)', icon: Circle },
  { id: 'shape-triangle', label: 'Triangle (SVG)', icon: Triangle },
  { id: 'shape-polygon', label: 'Polygon (SVG)', icon: Hexagon },
  { id: 'shape-diamond', label: 'Diamond', icon: Diamond },
  { id: 'shape-pentagon', label: 'Pentagon', icon: Pentagon },
  { id: 'shape-hexagon', label: 'Hexagon', icon: Hexagon },
  { id: 'shape-star', label: '5-Point Star', icon: Star },
  { id: 'shape-arrow-right', label: 'Right Arrow', icon: ArrowRight },
  { id: 'shape-arrow-double', label: 'Double Arrow', icon: ArrowLeftRight },
  { id: 'shape-speech-bubble', label: 'Speech Bubble', icon: MessageSquare },
  { id: 'shape-heart', label: 'Heart', icon: Heart },
  { id: 'shape-custom-path', label: 'Custom Path', icon: Shapes },
  { id: 'shape-rectangle', label: 'Rectangle', icon: Square },
  { id: 'shape-rounded', label: 'Rounded Box', icon: Square },
  { id: 'shape-pill', label: 'Pill Badge', icon: Circle },
  { id: 'callout-box', label: 'Callout Note', icon: MessageSquare },
  { id: 'sticky-note', label: 'Sticky Note', icon: StickyNote },
  { id: 'divider-line', label: 'Solid Line', icon: Minus },
  { id: 'dashed-line', label: 'Dashed Line', icon: Minus },
  { id: 'vertical-line', label: 'Vertical Line', icon: Minus },
];

const OFFICE_SYMBOLS = ['©', '®', '™', '§', '°', '±', '×', '÷', '→', '←', '↑', '↓', '★', '✓', '•', '€', '£', '¥'];

type DragSessionState =
  | {
      kind: 'resize';
      dir: ResizeHandleDir;
      startX: number;
      startY: number;
      startRect: ElementRect;
      currentWidth: number;
      currentHeight: number;
      startPosition: string;
      startLeft: number;
      startTop: number;
      currentLeft: number;
      currentTop: number;
      wasInline: boolean;
      aspectLocked: boolean;
      proportionalActive: boolean;
    }
  | {
      kind: 'move';
      startX: number;
      startY: number;
      targetPosition: string;
      startLeft: number;
      startTop: number;
      currentLeft: number;
      currentTop: number;
    };

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  centerTab,
  onChangeCenterTab,
  editorMode,
  defaultStartupMode,
  onToggleDefaultStartupMode,
  autoSaveStatus,
  onToggleAutoSave,
  viewport,
  srcDoc,
  previewKey,
  entryHtmlPath,
  htmlPages,
  onSwitchPreviewPage,
  activeFile,
  jumpToLine,
  selectedElement,
  aspectRatioLocked,
  draggingComponent,
  formatPainterActive,
  onToggleFormatPainter,
  iframeRef,
  onRefreshPreview,
  onPreviewResizeStyle,
  onCommitResizeStyle,
  onCommitFormattingStyle,
  onQuickInsertById,
  onInsertCustomHtml,
  onInsertSymbol,
  onFindAndReplace,
  onDuplicateSelected,
  onUpdateCodeContent,
  onPostIframeMessage,
  onDropComponentOnCanvas,
}) => {
  const [dragState, setDragState] = useState<DragSessionState | null>(null);
  const [openMenu, setOpenMenu] = useState<'shapes' | 'table' | 'image' | 'symbols' | 'find' | null>(
    null
  );
  const [tableHover, setTableHover] = useState<{ rows: number; cols: number }>({
    rows: 3,
    cols: 3,
  });
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [imageAltDraft, setImageAltDraft] = useState('');
  const [findDraft, setFindDraft] = useState('');
  const [replaceDraft, setReplaceDraft] = useState('');
  const [findMatchCase, setFindMatchCase] = useState(false);
  const [findStatus, setFindStatus] = useState<string | null>(null);

  const dragRef = useRef(dragState);
  dragRef.current = dragState;

  const previewStyleRef = useRef(onPreviewResizeStyle);
  previewStyleRef.current = onPreviewResizeStyle;

  const commitStyleRef = useRef(onCommitResizeStyle);
  commitStyleRef.current = onCommitResizeStyle;

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (centerTab !== 'code' || !jumpToLine || !activeFile) return;
    if (jumpToLine.path !== activeFile.path) return;
    const textarea = codeTextareaRef.current;
    if (!textarea) return;

    const lines = activeFile.content.split(/\r?\n/);
    const targetIdx = Math.max(0, Math.min(lines.length - 1, jumpToLine.line - 1));
    let charStart = 0;
    for (let i = 0; i < targetIdx; i++) {
      charStart += lines[i].length + 1;
    }
    const charEnd = charStart + lines[targetIdx].length;
    textarea.focus();
    textarea.setSelectionRange(charStart, charEnd);
    const lineHeight = 24;
    textarea.scrollTop = Math.max(0, targetIdx * lineHeight - 120);
  }, [centerTab, jumpToLine, activeFile]);

  const isDraggingOverlay = Boolean(dragState);

  useEffect(() => {
    if (!isDraggingOverlay) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const dx = e.clientX - current.startX;
      const dy = e.clientY - current.startY;

      if (current.kind === 'move') {
        const nextLeft = Math.round(current.startLeft + dx);
        const nextTop = Math.round(current.startTop + dy);
        previewStyleRef.current({
          position: current.targetPosition,
          left: `${nextLeft}px`,
          top: `${nextTop}px`,
        });
        setDragState((prev) =>
          prev && prev.kind === 'move' ? { ...prev, currentLeft: nextLeft, currentTop: nextTop } : prev
        );
        return;
      }

      let nextW = current.startRect.width;
      let nextH = current.startRect.height;
      let nextLeft = current.startLeft;
      let nextTop = current.startTop;

      const isDiagonal =
        current.dir === 'nw' || current.dir === 'ne' || current.dir === 'sw' || current.dir === 'se';
      const proportional =
        isDiagonal && (current.aspectLocked || e.shiftKey) && current.startRect.height > 0;

      if (proportional) {
        const ratio = current.startRect.width / current.startRect.height;
        const candW = current.dir.includes('e')
          ? current.startRect.width + dx
          : current.startRect.width - dx;
        const candH = current.dir.includes('s')
          ? current.startRect.height + dy
          : current.startRect.height - dy;

        const normDx = Math.abs(candW - current.startRect.width) / Math.max(1, current.startRect.width);
        const normDy = Math.abs(candH - current.startRect.height) / Math.max(1, current.startRect.height);

        if (normDx >= normDy) {
          nextW = Math.max(20, Math.round(candW));
          nextH = Math.max(16, Math.round(nextW / ratio));
        } else {
          nextH = Math.max(16, Math.round(candH));
          nextW = Math.max(20, Math.round(nextH * ratio));
        }
      } else {
        if (current.dir.includes('e')) {
          nextW = Math.max(20, Math.round(current.startRect.width + dx));
        }
        if (current.dir.includes('w')) {
          nextW = Math.max(20, Math.round(current.startRect.width - dx));
        }
        if (current.dir.includes('s')) {
          nextH = Math.max(16, Math.round(current.startRect.height + dy));
        }
        if (current.dir.includes('n')) {
          nextH = Math.max(16, Math.round(current.startRect.height - dy));
        }
      }

      if (current.dir.includes('w') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
        nextLeft = Math.round(current.startLeft + (current.startRect.width - nextW));
      }
      if (current.dir.includes('n') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
        nextTop = Math.round(current.startTop + (current.startRect.height - nextH));
      }

      const patch: Record<string, string> = {
        'box-sizing': 'border-box',
      };
      if (current.wasInline) {
        patch.display = 'inline-block';
      }
      if (proportional || current.dir.includes('e') || current.dir.includes('w')) {
        patch.width = `${nextW}px`;
        if (current.dir.includes('w') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
          patch.left = `${nextLeft}px`;
        }
      }
      if (proportional || current.dir.includes('s') || current.dir.includes('n')) {
        patch.height = `${nextH}px`;
        if (current.dir.includes('n') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
          patch.top = `${nextTop}px`;
        }
      }

      previewStyleRef.current(patch);
      setDragState((prev) =>
        prev && prev.kind === 'resize'
          ? {
              ...prev,
              currentWidth: nextW,
              currentHeight: nextH,
              currentLeft: nextLeft,
              currentTop: nextTop,
              proportionalActive: proportional,
            }
          : prev
      );
    };

    const handlePointerUp = () => {
      const current = dragRef.current;
      if (!current) return;

      if (current.kind === 'move') {
        setDragState(null);
        commitStyleRef.current(
          {
            position: current.targetPosition,
            left: `${current.currentLeft}px`,
            top: `${current.currentTop}px`,
          },
          'Move element'
        );
        return;
      }

      const patch: Record<string, string> = {
        'box-sizing': 'border-box',
      };
      if (current.wasInline) {
        patch.display = 'inline-block';
      }
      if (current.proportionalActive || current.dir.includes('e') || current.dir.includes('w')) {
        patch.width = `${current.currentWidth}px`;
        if (current.dir.includes('w') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
          patch.left = `${current.currentLeft}px`;
        }
      }
      if (current.proportionalActive || current.dir.includes('s') || current.dir.includes('n')) {
        patch.height = `${current.currentHeight}px`;
        if (current.dir.includes('n') && (current.startPosition === 'relative' || current.startPosition === 'absolute')) {
          patch.top = `${current.currentTop}px`;
        }
      }
      setDragState(null);
      commitStyleRef.current(
        patch,
        current.proportionalActive ? 'Scale element proportionally' : 'Resize element'
      );
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDraggingOverlay]);

  const startResize = (dir: ResizeHandleDir, e: React.PointerEvent) => {
    if (!selectedElement) return;
    e.preventDefault();
    e.stopPropagation();
    const parsedLeft = parseFloat(selectedElement.styles.left);
    const parsedTop = parseFloat(selectedElement.styles.top);
    const isDiagonal = dir === 'nw' || dir === 'ne' || dir === 'sw' || dir === 'se';
    setDragState({
      kind: 'resize',
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: selectedElement.rect,
      currentWidth: Math.round(selectedElement.rect.width),
      currentHeight: Math.round(selectedElement.rect.height),
      startPosition: selectedElement.styles.position || 'static',
      startLeft: Number.isFinite(parsedLeft) ? parsedLeft : 0,
      startTop: Number.isFinite(parsedTop) ? parsedTop : 0,
      currentLeft: Number.isFinite(parsedLeft) ? parsedLeft : 0,
      currentTop: Number.isFinite(parsedTop) ? parsedTop : 0,
      wasInline: selectedElement.styles.display === 'inline',
      aspectLocked: aspectRatioLocked,
      proportionalActive: isDiagonal && (aspectRatioLocked || e.shiftKey),
    });
  };

  const startMove = (e: React.PointerEvent) => {
    if (!selectedElement) return;
    e.preventDefault();
    e.stopPropagation();
    const parsedLeft = parseFloat(selectedElement.styles.left);
    const parsedTop = parseFloat(selectedElement.styles.top);
    const startLeft = Number.isFinite(parsedLeft) ? parsedLeft : 0;
    const startTop = Number.isFinite(parsedTop) ? parsedTop : 0;
    const targetPosition =
      selectedElement.styles.position === 'static' ? 'relative' : selectedElement.styles.position;

    setDragState({
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      targetPosition,
      startLeft,
      startTop,
      currentLeft: startLeft,
      currentTop: startTop,
    });
  };

  const handleDragOverCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingComponent) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const iframeRect = iframeRef.current?.getBoundingClientRect();
    if (!iframeRect) return;
    onPostIframeMessage({
      type: 'HIGHLIGHT_DROP_TARGET',
      x: e.clientX - iframeRect.left,
      y: e.clientY - iframeRect.top,
    });
  };

  const handleDropCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingComponent) return;
    e.preventDefault();
    onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' });
    onDropComponentOnCanvas(draggingComponent);
  };

  const viewportWidthClass =
    viewport === 'mobile'
      ? 'w-[375px]'
      : viewport === 'tablet'
        ? 'w-[768px]'
        : 'w-full max-w-[1200px]';

  const viewportLabel =
    viewport === 'mobile'
      ? '375px · Mobile'
      : viewport === 'tablet'
        ? '768px · Tablet'
        : 'Responsive · Desktop';

  const displayRect = selectedElement?.rect;
  const liveW =
    dragState && dragState.kind === 'resize'
      ? dragState.currentWidth
      : Math.round(displayRect?.width ?? 0);
  const liveH =
    dragState && dragState.kind === 'resize'
      ? dragState.currentHeight
      : Math.round(displayRect?.height ?? 0);

  const isBold =
    selectedElement &&
    (selectedElement.styles.fontWeight === 'bold' ||
      Number(selectedElement.styles.fontWeight) >= 600);
  const isItalic = selectedElement?.styles.fontStyle === 'italic';
  const textDeco = selectedElement?.styles.textDecoration || '';
  const isUnderline = textDeco.includes('underline');
  const isStrike = textDeco.includes('line-through');
  const isSuper = selectedElement?.styles.verticalAlign === 'super';
  const isSub = selectedElement?.styles.verticalAlign === 'sub';
  const currentTransform = selectedElement?.inlineStyles.transform || selectedElement?.styles.transform || '';
  const rotateMatch = /rotate\((-?\d+(?:\.\d+)?)deg\)/.exec(currentTransform);
  const currentRotateDeg = rotateMatch ? Math.round(parseFloat(rotateMatch[1])) : 0;

  const rotateBy = (deltaDeg: number) => {
    if (!selectedElement) return;
    const nextDeg = (currentRotateDeg + deltaDeg) % 360;
    const nextTransform = nextDeg === 0 ? null : `rotate(${nextDeg}deg)`;
    onCommitFormattingStyle({ transform: nextTransform }, `Rotate ${nextDeg}°`);
  };

  const toggleTextDecoration = (token: 'underline' | 'line-through') => {
    if (!selectedElement) return;
    const activeSet = new Set<string>();
    if (isUnderline) activeSet.add('underline');
    if (isStrike) activeSet.add('line-through');
    if (activeSet.has(token)) {
      activeSet.delete(token);
    } else {
      activeSet.add(token);
    }
    const nextVal = activeSet.size > 0 ? Array.from(activeSet).join(' ') : 'none';
    onCommitFormattingStyle({ 'text-decoration': nextVal }, `Toggle ${token}`);
  };

  const stepFontSize = (deltaPt: number) => {
    if (!selectedElement) return;
    const raw = selectedElement.inlineStyles['font-size'] || selectedElement.styles.fontSize || '14px';
    const num = parseFloat(raw) || 14;
    const currentPt = raw.trim().endsWith('pt') ? num : Math.round(num * 0.75);
    const nextPt = Math.max(8, Math.min(96, Math.round(currentPt + deltaPt)));
    onCommitFormattingStyle({ 'font-size': `${nextPt}pt` }, `Font size ${nextPt}pt`);
  };

  const adjustIndent = (deltaPx: number) => {
    if (!selectedElement) return;
    const currentMarginLeft =
      parseFloat(selectedElement.inlineStyles['margin-left'] || '0') || 0;
    const nextMarginLeft = Math.max(0, Math.round(currentMarginLeft + deltaPx));
    onCommitFormattingStyle(
      { 'margin-left': nextMarginLeft === 0 ? null : `${nextMarginLeft}px` },
      deltaPx > 0 ? 'Increase indent' : 'Decrease indent'
    );
  };

  const clearInlineFormatting = () => {
    if (!selectedElement) return;
    onCommitFormattingStyle(
      {
        'font-family': null,
        'font-size': null,
        'font-weight': null,
        'font-style': null,
        'text-decoration': null,
        'text-transform': null,
        'vertical-align': null,
        color: null,
        'background-color': null,
        'text-align': null,
        'line-height': null,
      },
      'Clear formatting'
    );
  };

  const currentInlineSize =
    selectedElement?.inlineStyles['font-size'] || selectedElement?.styles.fontSize || '';
  const selectedColorHex = cssColorToHex(selectedElement?.styles.color || '') || '#0f172a';
  const currentZIndex = Number.parseInt(selectedElement?.styles.zIndex || '0', 10) || 0;

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-[#090d16] min-h-0 overflow-x-hidden">
      {/* Workspace Sub-Toolbar */}
      <div className="h-10 shrink-0 border-b border-slate-800/80 bg-[#0c111b] px-4 flex items-center justify-between gap-3">
        <div
          className="inline-flex items-center p-0.5 rounded-md bg-[#090d16] border border-slate-800 shrink-0"
          role="tablist"
          aria-label="Workspace View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'preview'}
            onClick={() => onChangeCenterTab('preview')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'preview'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Live Canvas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'code'}
            onClick={() => onChangeCenterTab('code')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'code'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Code Editor
          </button>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleDefaultStartupMode}
            title="Choose whether Framecraft starts in Editing Mode or Using Mode by default"
            className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Default startup:{' '}
            <span className="text-slate-200 font-medium">
              {defaultStartupMode === 'interact' ? 'Using Mode' : 'Editing Mode'}
            </span>
          </button>

          <span className="text-slate-700" aria-hidden="true">
            ·
          </span>

          <button
            type="button"
            onClick={onToggleAutoSave}
            title="Toggle automatic saving of layout edits into project code"
            className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 ${
                autoSaveStatus.enabled ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span>
              Auto-Save:{' '}
              <strong className="font-medium text-slate-200">
                {autoSaveStatus.enabled
                  ? autoSaveStatus.diskConnected
                    ? `Disk (${autoSaveStatus.diskFolderName})`
                    : 'Code'
                  : 'Off'}
              </strong>
            </span>
          </button>
        </div>
      </div>

      {/* MS 365 Two-Tier Ribbon (Home Formatting + Insert & Arrange) */}
      {centerTab === 'preview' && editorMode === 'edit' && (
        <div
          ref={menuContainerRef}
          className="shrink-0 border-b border-slate-800/80 bg-[#0a0f18]"
          role="toolbar"
          aria-label="MS 365 Formatting and Insert Ribbon"
        >
          {/* Tier 1: Home / Text Formatting */}
          <div className="min-h-8.5 px-2.5 py-0.5 border-b border-slate-800/60 flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={!selectedElement && !formatPainterActive}
              onClick={onToggleFormatPainter}
              aria-label="Format Painter"
              aria-pressed={formatPainterActive}
              title={
                formatPainterActive
                  ? 'Click any target element on the canvas to paste copied styles'
                  : 'Copy styles from selected element (Format Painter)'
              }
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                formatPainterActive
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Paintbrush className="w-3 h-3" />
              <span className="hidden xl:inline">Format</span>
            </button>

            <div className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

            <select
              aria-label="Ribbon font family"
              disabled={!selectedElement}
              value={
                RIBBON_FONT_OPTIONS.some((f) => f.value === selectedElement?.styles.fontFamily)
                  ? selectedElement?.styles.fontFamily
                  : ''
              }
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'font-family': e.target.value }, 'Change font family');
              }}
              className="h-6 w-20 rounded bg-slate-900 border border-slate-800 px-1 text-[11px] text-slate-200 disabled:opacity-40 focus:outline-none focus:border-blue-500 shrink-0"
            >
              <option value="">Font</option>
              {RIBBON_FONT_OPTIONS.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Ribbon font size in points"
              disabled={!selectedElement}
              value={POINT_SIZE_OPTIONS.includes(currentInlineSize) ? currentInlineSize : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'font-size': e.target.value }, `Set size ${e.target.value}`);
              }}
              className="h-6 w-12 rounded bg-slate-900 border border-slate-800 px-1 text-[11px] font-mono-tabular text-slate-200 disabled:opacity-40 focus:outline-none focus:border-blue-500 shrink-0"
            >
              <option value="">pt</option>
              {POINT_SIZE_OPTIONS.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => stepFontSize(2)}
              aria-label="Increase font size"
              title="Increase Font Size"
              className="p-1 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <AArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => stepFontSize(-2)}
              aria-label="Decrease font size"
              title="Decrease Font Size"
              className="p-1 rounded text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <AArrowDown className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle({ 'font-weight': isBold ? '400' : '700' }, 'Toggle bold')
              }
              aria-label="Bold"
              aria-pressed={Boolean(isBold)}
              title="Bold"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isBold ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle(
                  { 'font-style': isItalic ? 'normal' : 'italic' },
                  'Toggle italic'
                )
              }
              aria-label="Italic"
              aria-pressed={Boolean(isItalic)}
              title="Italic"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isItalic ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => toggleTextDecoration('underline')}
              aria-label="Underline"
              aria-pressed={isUnderline}
              title="Underline"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isUnderline ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => toggleTextDecoration('line-through')}
              aria-label="Strikethrough"
              aria-pressed={isStrike}
              title="Strikethrough"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isStrike ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle(
                  { 'vertical-align': isSuper ? null : 'super', 'font-size': isSuper ? null : '0.75em' },
                  'Toggle superscript'
                )
              }
              aria-label="Superscript"
              aria-pressed={isSuper}
              title="Superscript"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isSuper ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Superscript className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle(
                  { 'vertical-align': isSub ? null : 'sub', 'font-size': isSub ? null : '0.75em' },
                  'Toggle subscript'
                )
              }
              aria-label="Subscript"
              aria-pressed={isSub}
              title="Subscript"
              className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isSub ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Subscript className="w-3.5 h-3.5" />
            </button>

            <select
              aria-label="Change text case"
              disabled={!selectedElement}
              value={selectedElement?.inlineStyles['text-transform'] || ''}
              onChange={(e) =>
                onCommitFormattingStyle(
                  { 'text-transform': e.target.value || null },
                  `Text case ${e.target.value || 'normal'}`
                )
              }
              title="Change Case (Aa)"
              className="h-6 w-12 rounded bg-slate-900 border border-slate-800 px-1 text-[11px] text-slate-200 disabled:opacity-40 focus:outline-none focus:border-blue-500 shrink-0"
            >
              <option value="">Aa</option>
              <option value="uppercase">ABC</option>
              <option value="lowercase">abc</option>
              <option value="capitalize">Title</option>
              <option value="none">Normal</option>
            </select>

            <label
              title="Font Color / Shape Fill"
              className={`inline-flex items-center px-1 py-0.5 rounded hover:bg-slate-800 shrink-0 ${
                selectedElement ? 'cursor-pointer' : 'opacity-40 pointer-events-none'
              }`}
            >
              <span className="text-[11px] font-bold mr-0.5 text-slate-200">A</span>
              <input
                type="color"
                aria-label="Ribbon font color"
                disabled={!selectedElement}
                value={selectedColorHex}
                onChange={(e) => onCommitFormattingStyle({ color: e.target.value }, 'Font color')}
                className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer"
              />
            </label>

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle(
                  { 'background-color': '#fef08a', color: '#0f172a' },
                  'Highlight text'
                )
              }
              aria-label="Highlight yellow"
              title="Text Highlight"
              className="p-1 rounded text-amber-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={!selectedElement}
              onClick={clearInlineFormatting}
              aria-label="Clear formatting"
              title="Clear All Formatting"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

            {[
              { val: 'left', icon: AlignLeft, label: 'Ribbon align left' },
              { val: 'center', icon: AlignCenter, label: 'Ribbon align center' },
              { val: 'right', icon: AlignRight, label: 'Ribbon align right' },
              { val: 'justify', icon: AlignJustify, label: 'Ribbon justify' },
            ].map(({ val, icon: Icon, label }) => (
              <button
                key={val}
                type="button"
                disabled={!selectedElement}
                aria-label={label}
                onClick={() => onCommitFormattingStyle({ 'text-align': val }, `Align ${val}`)}
                className={`p-1 rounded transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                  selectedElement?.styles.textAlign === val
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}

            <div className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(-16)}
              aria-label="Decrease indent"
              title="Decrease Indent"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <IndentDecrease className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(16)}
              aria-label="Increase indent"
              title="Increase Indent"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <IndentIncrease className="w-3.5 h-3.5" />
            </button>

            <select
              aria-label="Line spacing"
              disabled={!selectedElement}
              value={selectedElement?.inlineStyles['line-height'] || ''}
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'line-height': e.target.value }, `Line spacing ${e.target.value}`);
              }}
              className="h-6 w-12 rounded bg-slate-900 border border-slate-800 px-1 text-[11px] font-mono-tabular text-slate-200 disabled:opacity-40 focus:outline-none focus:border-blue-500 shrink-0"
            >
              <option value="">Line</option>
              <option value="1.0">1.0</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="2.0">2.0</option>
            </select>
          </div>

          {/* Tier 2: MS 365 Insert (Shapes Gallery, Table Grid, Lists, Media) & Arrange */}
          <div className="min-h-8.5 px-3 py-1 flex flex-wrap items-center justify-between gap-1.5 relative">
            <div className="flex flex-wrap items-center gap-1">
              {/* Shapes Gallery Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'shapes'}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu((m) => (m === 'shapes' ? null : 'shapes'))}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'shapes'
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <Shapes className="w-3.5 h-3.5 text-sky-400" />
                  Shapes
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {openMenu === 'shapes' && (
                  <div
                    role="menu"
                    aria-label="Shapes Gallery"
                    className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-slate-700 bg-[#0d121d] p-2.5 shadow-2xl"
                  >
                    <div className="text-[11px] font-semibold text-slate-300 mb-2 px-1">
                      Insert Shape or Line
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SHAPE_GALLERY_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenu(null);
                            onQuickInsertById(id);
                          }}
                          className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 text-slate-200 transition-colors cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-sky-400" />
                          <span className="text-[10px] leading-tight text-center truncate w-full">
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MS Word Table Grid Picker */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'table'}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu((m) => (m === 'table' ? null : 'table'))}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'table'
                      ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5 text-emerald-400" />
                  Table
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {openMenu === 'table' && (
                  <div
                    role="menu"
                    aria-label="Insert Table Grid"
                    className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-slate-700 bg-[#0d121d] p-3 shadow-2xl"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-200 mb-2">
                      <span>Insert Table</span>
                      <span className="font-mono-tabular text-emerald-400">
                        {tableHover.rows} × {tableHover.cols}
                      </span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 5 }, (_, rIdx) =>
                        Array.from({ length: 6 }, (_, cIdx) => {
                          const r = rIdx + 1;
                          const c = cIdx + 1;
                          const active = r <= tableHover.rows && c <= tableHover.cols;
                          return (
                            <button
                              key={`${r}-${c}`}
                              type="button"
                              aria-label={`Insert ${r} by ${c} table`}
                              onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                              onClick={() => {
                                setOpenMenu(null);
                                onInsertCustomHtml(buildTableHtml(r, c), `${r}×${c} Table`);
                              }}
                              className={`h-5 rounded-xs border transition-colors cursor-pointer ${
                                active
                                  ? 'bg-emerald-500/35 border-emerald-400'
                                  : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                              }`}
                            />
                          );
                        })
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        onQuickInsertById('table-3x3');
                      }}
                      className="mt-2.5 w-full py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                    >
                      Quick 3×3 Data Table
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickInsertById('list-bulleted')}
                title="Insert Bulleted List"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-200 cursor-pointer"
              >
                <List className="w-3.5 h-3.5 text-amber-400" />
                Bullets
              </button>

              <button
                type="button"
                onClick={() => onQuickInsertById('list-numbered')}
                title="Insert Numbered List"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-200 cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
                Numbered
              </button>

              {/* Insert Image Popover */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'image'}
                  onClick={() => setOpenMenu((m) => (m === 'image' ? null : 'image'))}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'image'
                      ? 'bg-purple-600/20 border-purple-500/50 text-purple-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  Image
                </button>

                {openMenu === 'image' && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-slate-700 bg-[#0d121d] p-3 shadow-2xl space-y-2">
                    <div className="text-[11px] font-semibold text-slate-200">Insert Image</div>
                    <input
                      type="url"
                      aria-label="Image URL"
                      value={imageUrlDraft}
                      onChange={(e) => setImageUrlDraft(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      aria-label="Image alt text"
                      value={imageAltDraft}
                      onChange={(e) => setImageAltDraft(e.target.value)}
                      placeholder="Alt description"
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={!imageUrlDraft.trim()}
                        onClick={() => {
                          const safeUrl = imageUrlDraft.trim().replace(/"/g, '&quot;');
                          const safeAlt = (imageAltDraft.trim() || 'Inserted image').replace(/"/g, '&quot;');
                          setOpenMenu(null);
                          setImageUrlDraft('');
                          setImageAltDraft('');
                          onInsertCustomHtml(
                            `<img src="${safeUrl}" alt="${safeAlt}" style="width: 320px; height: 180px; object-fit: cover; border-radius: 10px; display: block; margin: 10px 0;" />`,
                            'Image'
                          );
                        }}
                        className="flex-1 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[11px] font-medium text-white cursor-pointer"
                      >
                        Insert URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onQuickInsertById('image-placeholder');
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                      >
                        Placeholder
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onQuickInsertById('link-anchor')}
                title="Insert Hyperlink"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-200 cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-blue-400" />
                Link
              </button>

              {/* MS Word Symbol Picker */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'symbols'}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu((m) => (m === 'symbols' ? null : 'symbols'))}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'symbols'
                      ? 'bg-amber-600/20 border-amber-500/50 text-amber-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <span className="font-semibold text-amber-400">Ω</span>
                  Symbol
                </button>
                {openMenu === 'symbols' && (
                  <div
                    role="menu"
                    aria-label="Insert Symbol"
                    className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-slate-700 bg-[#0d121d] p-2.5 shadow-2xl"
                  >
                    <div className="text-[11px] font-semibold text-slate-300 mb-2">
                      Insert Symbol
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {OFFICE_SYMBOLS.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setOpenMenu(null);
                            onInsertSymbol(sym);
                          }}
                          className="h-7 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-sm text-slate-100 cursor-pointer"
                        >
                          {sym}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* MS Word Find & Replace */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'find'}
                  onClick={() => {
                    setFindStatus(null);
                    setOpenMenu((m) => (m === 'find' ? null : 'find'));
                  }}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[11px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'find'
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <Replace className="w-3.5 h-3.5 text-sky-400" />
                  Replace
                </button>
                {openMenu === 'find' && (
                  <div
                    aria-label="Find and Replace"
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-slate-700 bg-[#0d121d] p-3 shadow-2xl space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-200">
                        Find &amp; Replace
                      </span>
                      {findStatus && (
                        <span className="text-[10px] text-emerald-400 font-medium">{findStatus}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      aria-label="Find text"
                      value={findDraft}
                      onChange={(e) => setFindDraft(e.target.value)}
                      placeholder="Find text on page..."
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      aria-label="Replace with text"
                      value={replaceDraft}
                      onChange={(e) => setReplaceDraft(e.target.value)}
                      placeholder="Replace with..."
                      className="w-full rounded bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={findMatchCase}
                          onChange={(e) => setFindMatchCase(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 accent-blue-500"
                        />
                        Match case
                      </label>
                      <button
                        type="button"
                        disabled={!findDraft}
                        onClick={() => {
                          const count = onFindAndReplace(findDraft, replaceDraft, findMatchCase);
                          setFindStatus(
                            count > 0 ? `Replaced ${count}` : 'No matches found'
                          );
                        }}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-[11px] font-medium text-white cursor-pointer"
                      >
                        Replace All
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Arrange, Rotate & Duplicate Shortcuts */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={!selectedElement}
                onClick={onDuplicateSelected}
                aria-label="Duplicate selected"
                title="Duplicate Element (Ctrl+D)"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-200 disabled:opacity-40 cursor-pointer"
              >
                <Copy className="w-3 h-3 text-slate-300" />
                <span className="hidden 2xl:inline">Duplicate</span>
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() => rotateBy(-15)}
                aria-label="Rotate left 15 degrees"
                title="Rotate Left 15°"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() => rotateBy(15)}
                aria-label="Rotate right 15 degrees"
                title="Rotate Right 15°"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() =>
                  onCommitFormattingStyle(
                    {
                      position:
                        selectedElement?.styles.position === 'static'
                          ? 'relative'
                          : selectedElement?.styles.position || 'relative',
                      'z-index': String(currentZIndex + 1),
                    },
                    'Bring forward'
                  )
                }
                aria-label="Bring Forward"
                title="Bring Forward"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <BringToFront className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() =>
                  onCommitFormattingStyle(
                    {
                      position:
                        selectedElement?.styles.position === 'static'
                          ? 'relative'
                          : selectedElement?.styles.position || 'relative',
                      'z-index': String(Math.max(0, currentZIndex - 1)),
                    },
                    'Send backward'
                  )
                }
                aria-label="Send Backward"
                title="Send Backward"
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
              >
                <SendToBack className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Stage or Code Editor */}
      {centerTab === 'preview' ? (
        <div className="flex-1 min-h-0 overflow-auto builder-scroll canvas-grid-bg p-5 flex justify-center">
          {!entryHtmlPath ? (
            <div className="self-center max-w-md text-center bg-[#0d121d] border border-slate-800 rounded-xl p-6">
              <h2 className="font-display text-base font-semibold text-slate-100 mb-2">
                No HTML entry file found
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Load a project containing an <code className="text-slate-200">index.html</code>{' '}
                file or select one of the starter templates from the left sidebar to launch the
                live preview.
              </p>
            </div>
          ) : (
            <div
              className={`${viewportWidthClass} h-full min-h-[500px] flex flex-col rounded-xl border border-slate-800 bg-[#0d121d] shadow-2xl overflow-hidden transition-[width] duration-200`}
            >
              {/* Frame Title Bar */}
              <div className="h-8 shrink-0 px-3 border-b border-slate-800 bg-[#111726] flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 min-w-0">
                  {htmlPages.length > 1 ? (
                    <select
                      aria-label="Active preview HTML page"
                      value={entryHtmlPath}
                      onChange={(e) => onSwitchPreviewPage(e.target.value)}
                      className="rounded bg-[#090d16] border border-slate-700 px-1.5 py-0.5 text-[11px] font-mono-tabular text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {htmlPages.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono-tabular text-slate-300 truncate">
                      {entryHtmlPath}
                    </span>
                  )}
                  <span className="font-mono-tabular truncate">
                    · {viewportLabel} ·{' '}
                    {editorMode === 'edit'
                      ? formatPainterActive
                        ? 'Format Painter Armed (click element)'
                        : 'Editing (drag to move · corners to resize)'
                      : 'Using (scroll & test)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRefreshPreview}
                  aria-label="Reload preview"
                  title="Reload preview"
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reload
                </button>
              </div>

              {/* Sandboxed Iframe + Selection/Move/Resize Overlay + Drag-Drop Target */}
              <div className="relative flex-1 bg-white overflow-hidden" data-testid="preview-stage">
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  title="Live App Preview"
                  srcDoc={srcDoc}
                  sandbox="allow-scripts allow-forms allow-popups"
                  className={`w-full h-full border-0 block bg-white ${
                    dragState || draggingComponent ? 'pointer-events-none select-none' : ''
                  }`}
                />

                {/* Drag-and-Drop Overlay for inserting components from Elements tab */}
                {draggingComponent && (
                  <div
                    data-testid="canvas-drop-overlay"
                    onDragOver={handleDragOverCanvas}
                    onDragLeave={() => onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' })}
                    onDrop={handleDropCanvas}
                    className="absolute inset-0 z-30 bg-emerald-500/5 border-2 border-dashed border-emerald-500/50"
                  />
                )}

                {/* Visual Selection, Drag-to-Move Grip & 8-Handle Resize Overlay */}
                {editorMode === 'edit' &&
                  !draggingComponent &&
                  selectedElement &&
                  displayRect &&
                  !selectedElement.isHidden && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div
                        data-testid="selection-overlay-box"
                        style={{
                          transform: `translate3d(${Math.round(displayRect.left)}px, ${Math.round(displayRect.top)}px, 0)`,
                          width: `${Math.max(1, Math.round(displayRect.width))}px`,
                          height: `${Math.max(1, Math.round(displayRect.height))}px`,
                        }}
                        className="absolute top-0 left-0 border-2 border-blue-500"
                      >
                        <div className="absolute -top-6 left-0 flex items-center gap-1 whitespace-nowrap">
                          <span className="bg-blue-600 text-white text-[10px] font-mono-tabular font-medium px-1.5 py-0.5 rounded shadow">
                            {selectedElement.tagName} ·{' '}
                            {dragState?.kind === 'move'
                              ? `x:${dragState.currentLeft} y:${dragState.currentTop}`
                              : `${liveW} × ${liveH}${aspectRatioLocked ? ' · Locked' : ''}`}
                          </span>
                          <button
                            type="button"
                            onPointerDown={startMove}
                            aria-label="Move selected element"
                            title="Drag to move element freely"
                            className="pointer-events-auto inline-flex items-center gap-1 bg-slate-900 hover:bg-blue-600 text-white border border-blue-400 text-[10px] font-medium px-1.5 py-0.5 rounded shadow cursor-grab active:cursor-grabbing"
                          >
                            <Move className="w-2.5 h-2.5" />
                            Move
                          </button>
                        </div>

                        {(Object.keys(HANDLE_POSITIONS) as ResizeHandleDir[]).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onPointerDown={(e) => startResize(dir, e)}
                            aria-label={`Resize ${dir}`}
                            style={{ cursor: HANDLE_CURSORS[dir] }}
                            className={`pointer-events-auto z-20 absolute w-3 h-3 rounded-xs bg-white border-2 border-blue-600 shadow-sm hover:scale-125 transition-transform ${HANDLE_POSITIONS[dir]}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Code Editor Tab */
        <div className="flex-1 min-h-0 flex flex-col bg-[#0b101a]">
          {activeFile ? (
            <>
              <div className="h-9 shrink-0 px-4 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono-tabular text-slate-300">{activeFile.path}</span>
                <span>Changes sync automatically when switching back to Live Canvas</span>
              </div>
              <textarea
                ref={codeTextareaRef}
                aria-label={`Code editor for ${activeFile.path}`}
                value={activeFile.content}
                onChange={(e) => onUpdateCodeContent(activeFile.path, e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 bg-[#090d16] text-slate-100 font-mono-tabular text-[13px] leading-6 resize-none focus:outline-none builder-scroll"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
              Select a file from the explorer to inspect or edit its source code.
            </div>
          )}
        </div>
      )}
    </main>
  );
};

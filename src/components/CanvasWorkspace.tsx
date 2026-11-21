import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bold,
  BoxSelect,
  BringToFront,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  Copy,
  CornerLeftUp,
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
  Plus,
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
  Trash2,
  Triangle,
  Underline,
} from 'lucide-react';
import type {
  AutoSaveStatus,
  CanvasZoomMode,
  CenterTab,
  DraggableComponentDef,
  EditorMode,
  ElementRect,
  ProjectFile,
  QuickInsertKind,
  SelectedElementInfo,
  ViewportPreset,
} from '../types/editor';
import { QUICK_INSERT_ITEMS } from '../utils/codeSync';
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
  canvasWidthPx: number | null;
  canvasHeightPx: number | null;
  onResizeCanvasFrame: (widthPx: number | null, heightPx: number | null) => void;
  canvasZoom: CanvasZoomMode;
  onChangeCanvasZoom: (zoom: CanvasZoomMode) => void;
  showOutlines: boolean;
  onToggleOutlines: () => void;
  activeSpacingOverlay: 'margin' | 'padding' | null;
  srcDoc: string;
  previewKey: number;
  entryHtmlPath: string | null;
  htmlPages: string[];
  onSwitchPreviewPage: (pagePath: string) => void;
  activeFile: ProjectFile | null;
  jumpToLine: { path: string; line: number; endLine?: number; token: number } | null;
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
  onQuickInsertKind: (kind: QuickInsertKind) => void;
  onInsertCustomHtml: (snippet: string, label: string) => void;
  onInsertSymbol: (symbol: string) => void;
  onFindAndReplace: (findText: string, replaceText: string, matchCase: boolean) => number;
  onDuplicateSelected: () => void;
  onSelectParent: () => void;
  onMoveSibling: (direction: 'up' | 'down') => void;
  onRemoveSelected: () => void;
  onViewSelectedInCode: () => void;
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
  canvasWidthPx,
  canvasHeightPx,
  onResizeCanvasFrame,
  canvasZoom,
  onChangeCanvasZoom,
  showOutlines,
  onToggleOutlines,
  activeSpacingOverlay,
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
  onQuickInsertKind,
  onInsertCustomHtml,
  onInsertSymbol,
  onFindAndReplace,
  onDuplicateSelected,
  onSelectParent,
  onMoveSibling,
  onRemoveSelected,
  onViewSelectedInCode,
  onUpdateCodeContent,
  onPostIframeMessage,
  onDropComponentOnCanvas,
}) => {
  const [dragState, setDragState] = useState<DragSessionState | null>(null);
  const [frameDrag, setFrameDrag] = useState<{
    axis: 'left' | 'right' | 'bottom';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    currentW: number;
    currentH: number;
  } | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({
    width: 1100,
    height: 700,
  });
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

  const frameDragRef = useRef(frameDrag);
  frameDragRef.current = frameDrag;

  const previewStyleRef = useRef(onPreviewResizeStyle);
  previewStyleRef.current = onPreviewResizeStyle;

  const commitStyleRef = useRef(onCommitResizeStyle);
  commitStyleRef.current = onCommitResizeStyle;

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  const stageScrollRef = useRef<HTMLDivElement | null>(null);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const effectiveFrameWidthPx =
    canvasWidthPx ??
    (viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : Math.min(1200, Math.max(600, stageSize.width - 48)));

  const zoomScale = useMemo(() => {
    if (canvasZoom === '50') return 0.5;
    if (canvasZoom === '75') return 0.75;
    if (canvasZoom === 'fit') {
      const availW = Math.max(320, stageSize.width - 56);
      return Math.min(1, Math.max(0.35, availW / Math.max(320, effectiveFrameWidthPx)));
    }
    return 1;
  }, [canvasZoom, stageSize.width, effectiveFrameWidthPx]);

  const zoomScaleRef = useRef(zoomScale);
  zoomScaleRef.current = zoomScale;

  useEffect(() => {
    const el = stageScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!openMenu && !quickAddOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (openMenu && menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
      if (quickAddOpen && quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setQuickAddOpen(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenu, quickAddOpen]);

  // Bidirectional Live Canvas Frame Resize Pointer Tracking
  const isResizingFrame = Boolean(frameDrag);
  useEffect(() => {
    if (!isResizingFrame) return;
    const onPointerMove = (e: PointerEvent) => {
      const prev = frameDragRef.current;
      if (!prev) return;
      const scale = zoomScaleRef.current || 1;
      if (prev.axis === 'bottom') {
        const dy = (e.clientY - prev.startY) / scale;
        const nextH = Math.max(260, Math.min(1800, Math.round(prev.startH + dy)));
        const nextDrag = { ...prev, currentH: nextH };
        frameDragRef.current = nextDrag;
        setFrameDrag(nextDrag);
        onResizeCanvasFrame(canvasWidthPx, nextH);
        return;
      }
      const dx = (e.clientX - prev.startX) / scale;
      const deltaW = prev.axis === 'right' ? dx * 2 : -dx * 2;
      const nextW = Math.max(320, Math.min(1800, Math.round(prev.startW + deltaW)));
      const nextDrag = { ...prev, currentW: nextW };
      frameDragRef.current = nextDrag;
      setFrameDrag(nextDrag);
      onResizeCanvasFrame(nextW, canvasHeightPx);
    };
    const onPointerUp = () => {
      frameDragRef.current = null;
      setFrameDrag(null);
      window.requestAnimationFrame(() => {
        onPostIframeMessage({ type: 'REQUEST_RECT' });
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isResizingFrame, canvasWidthPx, canvasHeightPx, onResizeCanvasFrame, onPostIframeMessage]);

  useEffect(() => {
    if (centerTab !== 'code' || !jumpToLine || !activeFile) return;
    if (jumpToLine.path !== activeFile.path) return;
    const textarea = codeTextareaRef.current;
    if (!textarea) return;

    const lines = activeFile.content.split(/\r?\n/);
    const startIdx = Math.max(0, Math.min(lines.length - 1, jumpToLine.line - 1));
    const endIdx = Math.max(
      startIdx,
      Math.min(lines.length - 1, (jumpToLine.endLine ?? jumpToLine.line) - 1)
    );
    let charStart = 0;
    for (let i = 0; i < startIdx; i++) {
      charStart += lines[i].length + 1;
    }
    let charEnd = charStart;
    for (let i = startIdx; i <= endIdx; i++) {
      charEnd += lines[i].length + (i < endIdx ? 1 : 0);
    }
    textarea.focus();
    textarea.setSelectionRange(charStart, charEnd);
    const lineHeight = 24;
    textarea.scrollTop = Math.max(0, startIdx * lineHeight - 120);
  }, [centerTab, jumpToLine, activeFile]);

  const isDraggingOverlay = Boolean(dragState);

  useEffect(() => {
    if (!isDraggingOverlay) return;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      const scale = zoomScaleRef.current || 1;
      const dx = (e.clientX - current.startX) / scale;
      const dy = (e.clientY - current.startY) / scale;

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
    const scale = zoomScale || 1;
    onPostIframeMessage({
      type: 'HIGHLIGHT_DROP_TARGET',
      x: (e.clientX - iframeRect.left) / scale,
      y: (e.clientY - iframeRect.top) / scale,
    });
  };

  const handleDropCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingComponent) return;
    e.preventDefault();
    onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' });
    onDropComponentOnCanvas(draggingComponent);
  };

  const startFrameResize = (axis: 'left' | 'right' | 'bottom', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = frameContainerRef.current?.getBoundingClientRect();
    const scale = zoomScale || 1;
    const startW = Math.round(canvasWidthPx ?? (rect ? rect.width / scale : effectiveFrameWidthPx));
    const startH = Math.round(canvasHeightPx ?? (rect ? rect.height / scale : 620));
    setFrameDrag({
      axis,
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
      currentW: startW,
      currentH: startH,
    });
  };

  const viewportLabel = canvasWidthPx
    ? `${canvasWidthPx}px · ${viewport.charAt(0).toUpperCase() + viewport.slice(1)}`
    : viewport === 'mobile'
      ? '375px · Mobile'
      : viewport === 'tablet'
        ? '768px · Tablet'
        : 'Responsive · Desktop';

  const frameSizeDisplay = frameDrag
    ? `${frameDrag.currentW} × ${frameDrag.currentH} px`
    : `${Math.round(canvasWidthPx ?? effectiveFrameWidthPx)} × ${
        canvasHeightPx ? `${canvasHeightPx} px` : 'Auto'
      }`;

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
    <main className="flex-1 min-w-0 flex flex-col bg-[#09090b] min-h-0 overflow-x-hidden">
      {/* Workspace Sub-Toolbar */}
      <div className="h-10 shrink-0 border-b border-white/[0.08] bg-[#111114] px-4 flex items-center justify-between gap-3">
        <div
          className="inline-flex items-center p-0.5 rounded-full bg-[#09090b] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] shrink-0"
          role="tablist"
          aria-label="Workspace View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'preview'}
            onClick={() => onChangeCenterTab('preview')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'preview'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
            Live Canvas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'code'}
            onClick={() => onChangeCenterTab('code')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'code'
                ? 'bg-[#27272a] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Code Editor
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {centerTab === 'preview' && (
            <>
              {editorMode === 'edit' && (
                <div className="relative" ref={quickAddRef}>
                  <button
                    type="button"
                    onClick={() => setQuickAddOpen((prev) => !prev)}
                    aria-expanded={quickAddOpen}
                    aria-haspopup="menu"
                    title="Quick Insert Component"
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11.5px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                      quickAddOpen
                        ? 'bg-gradient-to-b from-blue-500 to-indigo-600 text-white border-indigo-400/40 shadow-[0_0_14px_rgba(99,102,241,0.35)]'
                        : 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Add
                  </button>
                  {quickAddOpen && (
                    <div
                      role="menu"
                      aria-label="Quick Insert Component Palette"
                      className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-white/[0.1] bg-[#18181b] p-1.5 shadow-2xl shadow-black/70 studio-card-highlight space-y-0.5"
                    >
                      <div className="px-2 py-1 studio-section-header">Quick Insert</div>
                      {QUICK_INSERT_ITEMS.map((item) => (
                        <button
                          key={item.kind}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setQuickAddOpen(false);
                            onQuickInsertKind(item.kind);
                          }}
                          className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[#e4e4e7] hover:bg-[#27272a] hover:text-white transition-colors cursor-pointer"
                        >
                          <span>{item.label}</span>
                          <Plus className="w-3 h-3 text-indigo-400" strokeWidth={1.5} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={onToggleOutlines}
                aria-pressed={showOutlines}
                title="Show dashed layout outlines around elements"
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  showOutlines
                    ? 'bg-cyan-500/15 border-cyan-400/45 text-cyan-300'
                    : 'bg-[#18181b] border-white/[0.08] studio-card-highlight text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a]'
                }`}
              >
                <BoxSelect className="w-3.5 h-3.5" strokeWidth={1.5} />
                Outlines
              </button>

              <select
                aria-label="Canvas Zoom"
                value={canvasZoom}
                onChange={(e) => onChangeCanvasZoom(e.target.value as CanvasZoomMode)}
                className="h-7 rounded-lg bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight px-2 text-[12px] font-mono-tabular text-[#e4e4e7] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 cursor-pointer"
              >
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
                <option value="fit">Fit ({Math.round(zoomScale * 100)}%)</option>
              </select>

              <span className="text-zinc-700 hidden 2xl:inline" aria-hidden="true">
                ·
              </span>
            </>
          )}

          <button
            type="button"
            onClick={onToggleDefaultStartupMode}
            title="Choose whether Framecraft starts in Editing Mode or Using Mode by default"
            className="hidden 2xl:inline text-[11.5px] text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Default startup:{' '}
            <span className="text-[#e4e4e7] font-medium">
              {defaultStartupMode === 'interact' ? 'Using Mode' : 'Editing Mode'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoSave}
            title="Toggle automatic saving of layout edits into project code"
            className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400 hover:text-zinc-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 ${
                autoSaveStatus.enabled ? 'text-emerald-400' : 'text-zinc-500'
              }`}
              strokeWidth={1.5}
            />
            <span className="truncate max-w-[140px]">
              Auto-Save:{' '}
              <strong className="font-medium text-[#e4e4e7]">
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
          className="shrink-0 border-b border-white/[0.08] bg-[#111114]"
          role="toolbar"
          aria-label="MS 365 Formatting and Insert Ribbon"
        >
          {/* Tier 1: Home / Text Formatting */}
          <div className="min-h-9 px-2.5 py-1 border-b border-white/[0.06] flex flex-wrap items-center gap-1">
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
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                formatPainterActive
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="hidden xl:inline">Format</span>
            </button>

            <div className="h-4 w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

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
              className="h-6.5 w-22 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] px-1.5 text-[11.5px] text-[#e4e4e7] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
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
              className="h-6.5 w-14 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] px-1 text-[11.5px] font-mono-tabular text-[#e4e4e7] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
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
              className="p-1 rounded-md text-zinc-300 hover:text-white hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <AArrowUp className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => stepFontSize(-2)}
              aria-label="Decrease font size"
              title="Decrease Font Size"
              className="p-1 rounded-md text-zinc-300 hover:text-white hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <AArrowDown className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <div className="h-4 w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle({ 'font-weight': isBold ? '400' : '700' }, 'Toggle bold')
              }
              aria-label="Bold"
              aria-pressed={Boolean(isBold)}
              title="Bold"
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isBold ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Bold className="w-3.5 h-3.5" strokeWidth={1.5} />
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
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isItalic ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Italic className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => toggleTextDecoration('underline')}
              aria-label="Underline"
              aria-pressed={isUnderline}
              title="Underline"
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isUnderline ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Underline className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => toggleTextDecoration('line-through')}
              aria-label="Strikethrough"
              aria-pressed={isStrike}
              title="Strikethrough"
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isStrike ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Strikethrough className="w-3.5 h-3.5" strokeWidth={1.5} />
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
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isSuper ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Superscript className="w-3.5 h-3.5" strokeWidth={1.5} />
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
              className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                isSub ? 'bg-indigo-500 text-white shadow-xs' : 'text-zinc-300 hover:text-white hover:bg-[#27272a]'
              }`}
            >
              <Subscript className="w-3.5 h-3.5" strokeWidth={1.5} />
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
              className="h-6.5 w-13 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] px-1 text-[11.5px] text-[#e4e4e7] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
            >
              <option value="">Aa</option>
              <option value="uppercase">ABC</option>
              <option value="lowercase">abc</option>
              <option value="capitalize">Title</option>
              <option value="none">Normal</option>
            </select>

            <label
              title="Font Color / Shape Fill"
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#18181b] border border-white/[0.08] hover:bg-[#27272a] shrink-0 ${
                selectedElement ? 'cursor-pointer' : 'opacity-40 pointer-events-none'
              }`}
            >
              <span className="text-[11px] font-bold text-[#e4e4e7]">A</span>
              <span
                className="relative w-3.5 h-3.5 rounded-xs border border-white/[0.2] overflow-hidden"
                style={{ backgroundColor: selectedColorHex }}
              >
                <input
                  type="color"
                  aria-label="Ribbon font color"
                  disabled={!selectedElement}
                  value={selectedColorHex}
                  onChange={(e) => onCommitFormattingStyle({ color: e.target.value }, 'Font color')}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </span>
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
              className="p-1 rounded-md text-amber-300 hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Highlighter className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              disabled={!selectedElement}
              onClick={clearInlineFormatting}
              aria-label="Clear formatting"
              title="Clear All Formatting"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <RemoveFormatting className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <div className="h-4 w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

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
                className={`p-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer shrink-0 ${
                  selectedElement?.styles.textAlign === val
                    ? 'bg-[#27272a] text-white ring-1 ring-white/[0.12]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            ))}

            <div className="h-4 w-px bg-white/[0.08] shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(-16)}
              aria-label="Decrease indent"
              title="Decrease Indent"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <IndentDecrease className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(16)}
              aria-label="Increase indent"
              title="Increase Indent"
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] disabled:opacity-40 cursor-pointer shrink-0"
            >
              <IndentIncrease className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <select
              aria-label="Line spacing"
              disabled={!selectedElement}
              value={selectedElement?.inlineStyles['line-height'] || ''}
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'line-height': e.target.value }, `Line spacing ${e.target.value}`);
              }}
              className="h-6.5 w-14 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] px-1 text-[11.5px] font-mono-tabular text-[#e4e4e7] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
            >
              <option value="">Line</option>
              <option value="1.0">1.0</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="2.0">2.0</option>
            </select>
          </div>

          {/* Tier 2: MS 365 Insert (Shapes Gallery, Table Grid, Lists, Media) & Arrange */}
          <div className="min-h-9 px-3 py-1 flex flex-wrap items-center justify-between gap-1.5 relative">
            <div className="flex flex-wrap items-center gap-1">
              {/* Shapes Gallery Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'shapes'}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu((m) => (m === 'shapes' ? null : 'shapes'))}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'shapes'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-white/[0.08] studio-card-highlight text-[#e4e4e7]'
                  }`}
                >
                  <Shapes className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
                  Shapes
                  <ChevronDown className="w-3 h-3 text-zinc-400" strokeWidth={1.5} />
                </button>

                {openMenu === 'shapes' && (
                  <div
                    role="menu"
                    aria-label="Shapes Gallery"
                    className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-white/[0.1] bg-[#18181b] p-2.5 shadow-2xl shadow-black/70 studio-card-highlight"
                  >
                    <div className="studio-section-header mb-2 px-1">
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
                          className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg bg-[#111114] hover:bg-[#27272a] border border-white/[0.08] hover:border-indigo-500/45 text-[#e4e4e7] transition-colors cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
                          <span className="text-[10.5px] leading-tight text-center truncate w-full">
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
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'table'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-white/[0.08] studio-card-highlight text-[#e4e4e7]'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
                  Table
                  <ChevronDown className="w-3 h-3 text-zinc-400" strokeWidth={1.5} />
                </button>

                {openMenu === 'table' && (
                  <div
                    role="menu"
                    aria-label="Insert Table Grid"
                    className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-white/[0.1] bg-[#18181b] p-3 shadow-2xl shadow-black/70 studio-card-highlight"
                  >
                    <div className="flex items-center justify-between text-[11.5px] font-medium text-[#e4e4e7] mb-2">
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
                                  : 'bg-[#111114] border-white/[0.1] hover:border-zinc-500'
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
                      className="mt-2.5 w-full py-1.5 rounded-lg bg-[#27272a] hover:bg-zinc-700 text-[11.5px] text-zinc-100 font-medium cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-[11.5px] font-medium text-[#e4e4e7] cursor-pointer"
              >
                <List className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                Bullets
              </button>

              <button
                type="button"
                onClick={() => onQuickInsertById('list-numbered')}
                title="Insert Numbered List"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-[11.5px] font-medium text-[#e4e4e7] cursor-pointer"
              >
                <ListOrdered className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                Numbered
              </button>

              {/* Insert Image Popover */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'image'}
                  onClick={() => setOpenMenu((m) => (m === 'image' ? null : 'image'))}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'image'
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-300'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-white/[0.08] studio-card-highlight text-[#e4e4e7]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-violet-400" strokeWidth={1.5} />
                  Image
                </button>

                {openMenu === 'image' && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-white/[0.1] bg-[#18181b] p-3 shadow-2xl shadow-black/70 studio-card-highlight space-y-2">
                    <div className="studio-section-header">Insert Image</div>
                    <input
                      type="url"
                      aria-label="Image URL"
                      value={imageUrlDraft}
                      onChange={(e) => setImageUrlDraft(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded-lg bg-[#09090b] border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <input
                      type="text"
                      aria-label="Image alt text"
                      value={imageAltDraft}
                      onChange={(e) => setImageAltDraft(e.target.value)}
                      placeholder="Alt description"
                      className="w-full rounded-lg bg-[#09090b] border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
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
                        className="flex-1 py-1.5 rounded-lg bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-40 text-[11.5px] font-semibold text-white cursor-pointer"
                      >
                        Insert URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenu(null);
                          onQuickInsertById('image-placeholder');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#27272a] hover:bg-zinc-700 text-[11.5px] text-zinc-100 cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-[11.5px] font-medium text-[#e4e4e7] cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5 text-indigo-400" strokeWidth={1.5} />
                Link
              </button>

              {/* MS Word Symbol Picker */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'symbols'}
                  aria-haspopup="menu"
                  onClick={() => setOpenMenu((m) => (m === 'symbols' ? null : 'symbols'))}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'symbols'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-white/[0.08] studio-card-highlight text-[#e4e4e7]'
                  }`}
                >
                  <span className="font-semibold text-amber-400">Ω</span>
                  Symbol
                </button>
                {openMenu === 'symbols' && (
                  <div
                    role="menu"
                    aria-label="Insert Symbol"
                    className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-white/[0.1] bg-[#18181b] p-2.5 shadow-2xl shadow-black/70 studio-card-highlight"
                  >
                    <div className="studio-section-header mb-2">Insert Symbol</div>
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
                          className="h-7 rounded-md bg-[#111114] hover:bg-[#27272a] border border-white/[0.08] hover:border-amber-500/50 text-sm text-zinc-100 cursor-pointer"
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
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11.5px] font-medium transition-colors cursor-pointer ${
                    openMenu === 'find'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-[#18181b] hover:bg-[#27272a] border-white/[0.08] studio-card-highlight text-[#e4e4e7]'
                  }`}
                >
                  <Replace className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
                  Replace
                </button>
                {openMenu === 'find' && (
                  <div
                    aria-label="Find and Replace"
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-white/[0.1] bg-[#18181b] p-3 shadow-2xl shadow-black/70 studio-card-highlight space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="studio-section-header">Find &amp; Replace</span>
                      {findStatus && (
                        <span className="text-[11px] text-emerald-400 font-medium">{findStatus}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      aria-label="Find text"
                      value={findDraft}
                      onChange={(e) => setFindDraft(e.target.value)}
                      placeholder="Find text on page..."
                      className="w-full rounded-lg bg-[#09090b] border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <input
                      type="text"
                      aria-label="Replace with text"
                      value={replaceDraft}
                      onChange={(e) => setReplaceDraft(e.target.value)}
                      placeholder="Replace with..."
                      className="w-full rounded-lg bg-[#09090b] border border-white/[0.08] px-2.5 py-1.5 text-[12px] text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <label className="inline-flex items-center gap-1.5 text-[11.5px] text-zinc-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={findMatchCase}
                          onChange={(e) => setFindMatchCase(e.target.checked)}
                          className="rounded border-white/[0.15] bg-[#09090b] accent-indigo-500"
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
                        className="px-2.5 py-1 rounded-lg bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 disabled:opacity-40 text-[11.5px] font-semibold text-white cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-[11.5px] font-medium text-[#e4e4e7] disabled:opacity-40 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-zinc-300" strokeWidth={1.5} />
                <span className="hidden 2xl:inline">Duplicate</span>
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() => rotateBy(-15)}
                aria-label="Rotate left 15 degrees"
                title="Rotate Left 15°"
                className="p-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                disabled={!selectedElement}
                onClick={() => rotateBy(15)}
                aria-label="Rotate right 15 degrees"
                title="Rotate Right 15°"
                className="p-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" strokeWidth={1.5} />
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
                className="p-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <BringToFront className="w-3.5 h-3.5" strokeWidth={1.5} />
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
                className="p-1 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight text-zinc-300 disabled:opacity-40 cursor-pointer"
              >
                <SendToBack className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Stage or Code Editor */}
      {centerTab === 'preview' ? (
        <div
          ref={stageScrollRef}
          className="flex-1 min-h-0 overflow-auto builder-scroll canvas-grid-bg p-5 flex justify-center items-start"
        >
          {!entryHtmlPath ? (
            <div className="self-center max-w-md text-center bg-[#18181b] border border-white/[0.08] studio-card-highlight rounded-2xl p-6 shadow-2xl shadow-black/60">
              <h2 className="font-display text-base font-semibold text-zinc-100 mb-2">
                No HTML entry file found
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Load a project containing an <code className="font-mono-tabular text-zinc-200">index.html</code>{' '}
                file or select one of the starter templates from the left sidebar to launch the
                live preview.
              </p>
            </div>
          ) : (
            <div
              className="relative flex flex-col items-center shrink-0"
              style={{
                width: `${Math.round(effectiveFrameWidthPx * zoomScale)}px`,
              }}
            >
              {/* Live Frame Dimensions Pill while dragging */}
              {frameDrag && (
                <div
                  data-testid="canvas-size-badge"
                  className="fixed top-28 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-[#18181b]/95 border border-indigo-500/70 text-[12px] font-mono-tabular font-semibold text-indigo-200 shadow-2xl pointer-events-none"
                >
                  {frameDrag.currentW} × {frameDrag.currentH} px
                </div>
              )}

              <div
                ref={frameContainerRef}
                data-testid="canvas-frame"
                style={{
                  width: `${Math.round(effectiveFrameWidthPx)}px`,
                  height: canvasHeightPx
                    ? `${canvasHeightPx}px`
                    : `${Math.max(480, Math.round(stageSize.height - 44))}px`,
                  transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
                  transformOrigin: 'top center',
                }}
                className="relative min-h-[300px] flex flex-col rounded-xl border border-white/[0.1] bg-[#111114] shadow-2xl shadow-black/60"
              >
                {/* Left Edge Frame Resize Handle */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize canvas width left edge"
                  data-testid="canvas-resize-left"
                  onPointerDown={(e) => startFrameResize('left', e)}
                  style={{ cursor: 'ew-resize' }}
                  title="Drag horizontally to resize Live Canvas width"
                  className="absolute -left-2 top-8 bottom-8 w-3 z-30 flex items-center justify-center group"
                >
                  <div className="w-1 h-10 rounded-full bg-zinc-600/80 group-hover:bg-indigo-400 transition-colors" />
                </div>

                {/* Right Edge Frame Resize Handle */}
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize canvas width right edge"
                  data-testid="canvas-resize-right"
                  onPointerDown={(e) => startFrameResize('right', e)}
                  style={{ cursor: 'ew-resize' }}
                  title="Drag horizontally to resize Live Canvas width"
                  className="absolute -right-2 top-8 bottom-8 w-3 z-30 flex items-center justify-center group"
                >
                  <div className="w-1 h-10 rounded-full bg-zinc-600/80 group-hover:bg-indigo-400 transition-colors" />
                </div>

                {/* Bottom Edge Frame Resize Handle */}
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize canvas height bottom edge"
                  data-testid="canvas-resize-bottom"
                  onPointerDown={(e) => startFrameResize('bottom', e)}
                  style={{ cursor: 'ns-resize' }}
                  title="Drag vertically to resize Live Canvas height"
                  className="absolute left-8 right-8 -bottom-2 h-3 z-30 flex items-center justify-center group"
                >
                  <div className="h-1 w-12 rounded-full bg-zinc-600/80 group-hover:bg-indigo-400 transition-colors" />
                </div>

                {/* Compact Elevated Device Header Bar */}
                <div className="h-9 shrink-0 px-3.5 border-b border-white/[0.08] bg-[#18181b] rounded-t-xl flex items-center justify-between gap-2 text-[12px] text-zinc-400 studio-card-highlight">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 mr-1 shrink-0" aria-hidden="true">
                      <span className="w-2 h-2 rounded-full bg-white/[0.12]" />
                      <span className="w-2 h-2 rounded-full bg-white/[0.12]" />
                      <span className="w-2 h-2 rounded-full bg-white/[0.12]" />
                    </div>
                    {htmlPages.length > 1 ? (
                      <select
                        aria-label="Active preview HTML page"
                        value={entryHtmlPath}
                        onChange={(e) => onSwitchPreviewPage(e.target.value)}
                        className="rounded-md bg-[#09090b] border border-white/[0.08] px-2 py-0.5 text-[12px] font-mono-tabular text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        {htmlPages.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono-tabular text-[12px] text-zinc-200 truncate">
                        {entryHtmlPath}
                      </span>
                    )}
                    <span className="font-mono-tabular text-[12px] text-zinc-500 truncate">
                      · {viewportLabel} · {frameSizeDisplay}
                    </span>
                    {canvasWidthPx !== null || canvasHeightPx !== null ? (
                      <button
                        type="button"
                        onClick={() => onResizeCanvasFrame(null, null)}
                        title="Reset custom canvas dimensions"
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer shrink-0"
                      >
                        Reset size
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={onRefreshPreview}
                    aria-label="Reload preview"
                    title="Reload preview"
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11.5px] font-medium text-zinc-300 hover:text-white hover:bg-[#27272a] transition-colors shrink-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                    Reload
                  </button>
                </div>

                {/* Sandboxed Iframe + Selection/Move/Resize Overlay + Spacing Guides + Drag-Drop Target */}
                <div
                  className="relative flex-1 bg-white overflow-hidden rounded-b-xl"
                  data-testid="preview-stage"
                >
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    title="Live App Preview"
                    srcDoc={srcDoc}
                    sandbox="allow-scripts allow-forms allow-popups"
                    className={`w-full h-full border-0 block bg-white ${
                      dragState || frameDrag || draggingComponent
                        ? 'pointer-events-none select-none'
                        : ''
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

                  {/* Visual Selection, Spacing Guides, Quick Action Bar & 8-Handle Resize Overlay */}
                  {editorMode === 'edit' &&
                    !draggingComponent &&
                    selectedElement &&
                    displayRect &&
                    !selectedElement.isHidden && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        {/* Box-Model Margin & Padding Visual Overlays */}
                        {selectedElement.boxModel && activeSpacingOverlay === 'margin' && (
                          <div
                            data-testid="margin-spacing-guide"
                            style={{
                              transform: `translate3d(${Math.round(
                                displayRect.left - selectedElement.boxModel.margin.left
                              )}px, ${Math.round(
                                displayRect.top - selectedElement.boxModel.margin.top
                              )}px, 0)`,
                              width: `${Math.max(
                                1,
                                Math.round(
                                  displayRect.width +
                                    selectedElement.boxModel.margin.left +
                                    selectedElement.boxModel.margin.right
                                )
                              )}px`,
                              height: `${Math.max(
                                1,
                                Math.round(
                                  displayRect.height +
                                    selectedElement.boxModel.margin.top +
                                    selectedElement.boxModel.margin.bottom
                                )
                              )}px`,
                              borderTopWidth: `${selectedElement.boxModel.margin.top}px`,
                              borderRightWidth: `${selectedElement.boxModel.margin.right}px`,
                              borderBottomWidth: `${selectedElement.boxModel.margin.bottom}px`,
                              borderLeftWidth: `${selectedElement.boxModel.margin.left}px`,
                            }}
                            className="absolute top-0 left-0 border-solid border-amber-500/45 box-border"
                          />
                        )}

                        <div
                          data-testid="selection-overlay-box"
                          style={{
                            transform: `translate3d(${Math.round(displayRect.left)}px, ${Math.round(displayRect.top)}px, 0)`,
                            width: `${Math.max(1, Math.round(displayRect.width))}px`,
                            height: `${Math.max(1, Math.round(displayRect.height))}px`,
                          }}
                          className="absolute top-0 left-0 border-2 border-indigo-500 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]"
                        >
                          {/* Inner Padding Guide */}
                          {selectedElement.boxModel && activeSpacingOverlay === 'padding' && (
                            <div
                              data-testid="padding-spacing-guide"
                              style={{
                                borderTopWidth: `${selectedElement.boxModel.padding.top}px`,
                                borderRightWidth: `${selectedElement.boxModel.padding.right}px`,
                                borderBottomWidth: `${selectedElement.boxModel.padding.bottom}px`,
                                borderLeftWidth: `${selectedElement.boxModel.padding.left}px`,
                              }}
                              className="w-full h-full border-solid border-emerald-500/45 box-border"
                            />
                          )}

                          {/* Floating Element Label, Move Grip & Quick-Action Bar */}
                          <div
                            data-testid="floating-quick-actions"
                            className={`absolute left-0 flex items-center gap-1 whitespace-nowrap z-30 ${
                              displayRect.top < 36 ? '-bottom-7' : '-top-7'
                            }`}
                          >
                            <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10.5px] font-mono-tabular font-medium px-2 py-0.5 rounded-md shadow-md">
                              {selectedElement.tagName} ·{' '}
                              {dragState?.kind === 'move'
                                ? `x:${dragState.currentLeft} y:${dragState.currentTop}`
                                : `${liveW} × ${liveH}${aspectRatioLocked ? ' · Locked' : ''}`}
                            </span>
                            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg bg-[#18181b]/95 border border-white/[0.1] p-0.5 shadow-xl shadow-black/50 studio-card-highlight">
                              <button
                                type="button"
                                onPointerDown={startMove}
                                aria-label="Move selected element"
                                title="Drag to move element freely"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-medium text-zinc-200 hover:bg-indigo-600 hover:text-white cursor-grab active:cursor-grabbing"
                              >
                                <Move className="w-3 h-3" strokeWidth={1.5} />
                                Move
                              </button>
                              <button
                                type="button"
                                onClick={onSelectParent}
                                aria-label="Select parent element"
                                title="Select Parent Element"
                                className="p-1 rounded-md text-zinc-300 hover:bg-[#27272a] hover:text-white cursor-pointer"
                              >
                                <CornerLeftUp className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveSibling('up')}
                                aria-label="Move element up"
                                title="Move Up (Alt+↑)"
                                className="p-1 rounded-md text-zinc-300 hover:bg-[#27272a] hover:text-white cursor-pointer"
                              >
                                <ArrowUp className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveSibling('down')}
                                aria-label="Move element down"
                                title="Move Down (Alt+↓)"
                                className="p-1 rounded-md text-zinc-300 hover:bg-[#27272a] hover:text-white cursor-pointer"
                              >
                                <ArrowDown className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={onDuplicateSelected}
                                aria-label="Floating duplicate element"
                                title="Duplicate (Ctrl+D)"
                                className="p-1 rounded-md text-zinc-300 hover:bg-[#27272a] hover:text-white cursor-pointer"
                              >
                                <Copy className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={onViewSelectedInCode}
                                aria-label="View in code editor"
                                title="View in Code"
                                className="p-1 rounded-md text-cyan-300 hover:bg-[#27272a] hover:text-cyan-200 cursor-pointer"
                              >
                                <Code2 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                              <button
                                type="button"
                                onClick={onRemoveSelected}
                                aria-label="Floating delete element"
                                title="Delete (Del)"
                                className="p-1 rounded-md text-red-400 hover:bg-red-500/20 hover:text-red-300 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>

                          {(Object.keys(HANDLE_POSITIONS) as ResizeHandleDir[]).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              onPointerDown={(e) => startResize(dir, e)}
                              aria-label={`Resize ${dir}`}
                              style={{ cursor: HANDLE_CURSORS[dir] }}
                              className={`pointer-events-auto z-20 absolute w-3 h-3 rounded-xs bg-white border-2 border-indigo-600 shadow-sm hover:scale-125 transition-transform ${HANDLE_POSITIONS[dir]}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Code Editor Tab */
        <div className="flex-1 min-h-0 flex flex-col bg-[#09090b]" data-code-editor="true">
          {activeFile ? (
            <>
              <div className="h-9 shrink-0 px-4 border-b border-white/[0.08] bg-[#111114] flex items-center justify-between text-xs text-zinc-400">
                <span className="font-mono-tabular text-[12px] text-zinc-200">
                  {activeFile.path}
                  {jumpToLine && jumpToLine.path === activeFile.path
                    ? ` · Line ${jumpToLine.line}${
                        jumpToLine.endLine && jumpToLine.endLine !== jumpToLine.line
                          ? `–${jumpToLine.endLine}`
                          : ''
                      }`
                    : ''}
                </span>
                <span className="text-[11.5px] text-zinc-500">
                  Changes sync automatically when switching back to Live Canvas
                </span>
              </div>
              <textarea
                ref={codeTextareaRef}
                data-code-editor="true"
                aria-label={`Code editor for ${activeFile.path}`}
                value={activeFile.content}
                onChange={(e) => onUpdateCodeContent(activeFile.path, e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 bg-[#09090b] text-[#e4e4e7] font-mono-tabular text-[12.5px] leading-6 resize-none focus:outline-none builder-scroll"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">
              Select a file from the explorer to inspect or edit its source code.
            </div>
          )}
        </div>
      )}
    </main>
  );
};

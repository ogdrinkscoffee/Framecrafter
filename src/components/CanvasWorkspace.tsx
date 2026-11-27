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
  Hand,
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
  Maximize2,
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
  SlidersHorizontal,
  Sparkles,
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
  ArtboardId,
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
import { DRAGGABLE_COMPONENTS } from '../utils/componentCatalog';
import { FONT_CATEGORIES, STUDIO_FONT_CATALOG, matchStudioFontOption } from '../utils/fontLibrary';
import { buildTableHtml, cssColorToHex } from '../utils/htmlSync';
import { isShortcutTypingTarget } from '../utils/shortcuts';
import { AiElementBar, type AiElementCopilotControls } from './AiElementBar';
import { HoverIconButton } from './StudioPrimitives';

interface CanvasWorkspaceProps {
  centerTab: CenterTab;
  onChangeCenterTab: (tab: CenterTab) => void;
  editorMode: EditorMode;
  defaultStartupMode: EditorMode;
  onToggleDefaultStartupMode: () => void;
  autoSaveStatus: AutoSaveStatus;
  onToggleAutoSave: () => void;
  viewport: ViewportPreset;
  onChangeViewport?: (viewport: ViewportPreset) => void;
  activeArtboard: ArtboardId;
  onSelectArtboard: (artboard: ArtboardId) => void;
  onRegisterArtboardIframe: (artboard: ArtboardId, el: HTMLIFrameElement | null) => void;
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
  onPostIframeMessage: (msg: Record<string, unknown>, targetArtboard?: ArtboardId | 'all') => void;
  onDropComponentOnCanvas: (component: DraggableComponentDef) => void;
  aiCopilot: AiElementCopilotControls;
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

const MULTI_ARTBOARD_DEFS: ReadonlyArray<{
  id: ArtboardId;
  label: string;
  widthPx: number;
  heightPx: number;
}> = [
  { id: 'desktop', label: 'DESKTOP', widthPx: 1440, heightPx: 900 },
  { id: 'tablet', label: 'TABLET', widthPx: 768, heightPx: 900 },
  { id: 'mobile', label: 'MOBILE', widthPx: 375, heightPx: 812 },
];
const MULTI_ARTBOARD_GAP_PX = 48;
const MULTI_ARTBOARD_TOTAL_W = 1440 + 768 + 375 + MULTI_ARTBOARD_GAP_PX * 2;
const MULTI_ARTBOARD_TOTAL_H = 928;

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
      clearRight: boolean;
      clearBottom: boolean;
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
      clearRight: boolean;
      clearBottom: boolean;
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
  onChangeViewport,
  activeArtboard,
  onSelectArtboard,
  onRegisterArtboardIframe,
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
  aiCopilot,
}) => {
  const [dragState, setDragState] = useState<DragSessionState | null>(null);
  const [aiBarOpen, setAiBarOpen] = useState(false);
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

  const selectedKey = selectedElement ? (selectedElement.veId || selectedElement.runtimeId) : null;
  useEffect(() => {
    setAiBarOpen(false);
  }, [selectedKey]);

  const frameDragRef = useRef(frameDrag);
  frameDragRef.current = frameDrag;

  const previewStyleRef = useRef(onPreviewResizeStyle);
  previewStyleRef.current = onPreviewResizeStyle;

  const commitStyleRef = useRef(onCommitResizeStyle);
  commitStyleRef.current = onCommitResizeStyle;

  const menuContainerRef = useRef<HTMLDivElement | null>(null);
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  const stageScrollRef = useRef<HTMLDivElement | null>(null);
  const multiStageRef = useRef<HTMLDivElement | null>(null);
  const frameContainerRef = useRef<HTMLDivElement | null>(null);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const artboardIframesRef = useRef<Record<ArtboardId, HTMLIFrameElement | null>>({
    desktop: null,
    tablet: null,
    mobile: null,
  });

  const [multiPan, setMultiPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [multiCustomZoom, setMultiCustomZoom] = useState<number | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [panDrag, setPanDrag] = useState<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const effectiveFrameWidthPx =
    canvasWidthPx ??
    (viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : 1440);

  const effectiveFrameHeightPx =
    canvasHeightPx ?? Math.max(480, Math.round(stageSize.height - 44));

  const zoomScale = useMemo(() => {
    if (viewport === 'all') {
      if (multiCustomZoom !== null) {
        return multiCustomZoom;
      }
      if (canvasZoom === '50') return 0.5;
      if (canvasZoom === '75') return 0.75;
      if (canvasZoom === '100') return 1;
      const availW = Math.max(320, stageSize.width - 72);
      const availH = Math.max(240, stageSize.height - 104);
      const fitScale = Math.min(availW / MULTI_ARTBOARD_TOTAL_W, availH / MULTI_ARTBOARD_TOTAL_H);
      return Math.min(1, Math.max(0.18, Number(fitScale.toFixed(3))));
    }
    if (canvasZoom === '50') return 0.5;
    if (canvasZoom === '75') return 0.75;
    if (canvasZoom === 'fit') {
      const availW = Math.max(320, stageSize.width - 56);
      return Math.min(1, Math.max(0.35, availW / Math.max(320, effectiveFrameWidthPx)));
    }
    return 1;
  }, [viewport, multiCustomZoom, canvasZoom, stageSize.width, stageSize.height, effectiveFrameWidthPx]);

  const zoomScaleRef = useRef(zoomScale);
  zoomScaleRef.current = zoomScale;

  useEffect(() => {
    setMultiCustomZoom(null);
  }, [canvasZoom]);

  useEffect(() => {
    if (viewport === 'all') {
      setMultiPan({ x: 0, y: 0 });
      setMultiCustomZoom(null);
    }
  }, [viewport]);

  useEffect(() => {
    if (viewport !== 'all' || centerTab !== 'preview') {
      setSpacePressed(false);
      setPanDrag(null);
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isShortcutTypingTarget(e.target)) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    const onBlur = () => {
      setSpacePressed(false);
      setPanDrag(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [viewport, centerTab]);

  useEffect(() => {
    if (!panDrag) return;
    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - panDrag.startX;
      const dy = e.clientY - panDrag.startY;
      setMultiPan({
        x: Math.round(panDrag.startPanX + dx),
        y: Math.round(panDrag.startPanY + dy),
      });
    };
    const onPointerUp = () => {
      setPanDrag(null);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [panDrag]);

  useEffect(() => {
    const el = multiStageRef.current;
    if (!el || viewport !== 'all' || centerTab !== 'preview') return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const currentScale = zoomScaleRef.current || 1;
        const factor = Math.exp(-e.deltaY * 0.0022);
        const nextScale = Math.min(1.5, Math.max(0.18, Number((currentScale * factor).toFixed(3))));
        setMultiCustomZoom(nextScale);
        return;
      }
      setMultiPan((prev) => ({
        x: Math.round(prev.x - e.deltaX),
        y: Math.round(prev.y - e.deltaY),
      }));
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewport, centerTab]);

  useEffect(() => {
    if (viewport !== 'all') {
      artboardIframesRef.current = { desktop: null, tablet: null, mobile: null };
      onRegisterArtboardIframe('desktop', null);
      onRegisterArtboardIframe('tablet', null);
      onRegisterArtboardIframe('mobile', null);
      return;
    }
    const activeFrameEl = artboardIframesRef.current[activeArtboard];
    if (activeFrameEl) {
      (iframeRef as { current: HTMLIFrameElement | null }).current = activeFrameEl;
    }
  }, [viewport, activeArtboard, iframeRef, onRegisterArtboardIframe]);

  useEffect(() => {
    if (viewport !== 'all') return;
    const targets = Object.values(artboardIframesRef.current);
    for (const frameEl of targets) {
      frameEl?.contentWindow?.postMessage({ target: 've-iframe', type: 'SET_MODE', mode: editorMode }, '*');
    }
  }, [viewport, editorMode]);

  useEffect(() => {
    if (viewport !== 'all') return;
    const targets = Object.values(artboardIframesRef.current);
    for (const frameEl of targets) {
      frameEl?.contentWindow?.postMessage(
        { target: 've-iframe', type: 'SET_OUTLINES', enabled: showOutlines },
        '*'
      );
    }
  }, [viewport, showOutlines]);

  useEffect(() => {
    const el = viewport === 'all' ? multiStageRef.current : stageScrollRef.current;
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
  }, [viewport, centerTab]);

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
        const movePatch: Record<string, string> = {
          position: current.targetPosition,
          left: `${nextLeft}px`,
          top: `${nextTop}px`,
        };
        if (current.clearRight) movePatch.right = 'auto';
        if (current.clearBottom) movePatch.bottom = 'auto';
        previewStyleRef.current(movePatch);
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

      const isPositioned =
        current.startPosition === 'relative' ||
        current.startPosition === 'absolute' ||
        current.startPosition === 'fixed' ||
        current.startPosition === 'sticky';

      if (current.dir.includes('w') && isPositioned) {
        nextLeft = Math.round(current.startLeft + (current.startRect.width - nextW));
      }
      if (current.dir.includes('n') && isPositioned) {
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
        if (current.dir.includes('w') && isPositioned) {
          patch.left = `${nextLeft}px`;
          if (current.clearRight) patch.right = 'auto';
        }
      }
      if (proportional || current.dir.includes('s') || current.dir.includes('n')) {
        patch.height = `${nextH}px`;
        if (current.dir.includes('n') && isPositioned) {
          patch.top = `${nextTop}px`;
          if (current.clearBottom) patch.bottom = 'auto';
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
        const moveCommitPatch: Record<string, string | null> = {
          position: current.targetPosition,
          left: `${current.currentLeft}px`,
          top: `${current.currentTop}px`,
        };
        if (current.clearRight) moveCommitPatch.right = 'auto';
        if (current.clearBottom) moveCommitPatch.bottom = 'auto';
        commitStyleRef.current(moveCommitPatch, 'Move element');
        return;
      }

      const isPositioned =
        current.startPosition === 'relative' ||
        current.startPosition === 'absolute' ||
        current.startPosition === 'fixed' ||
        current.startPosition === 'sticky';

      const patch: Record<string, string> = {
        'box-sizing': 'border-box',
      };
      if (current.wasInline) {
        patch.display = 'inline-block';
      }
      if (current.proportionalActive || current.dir.includes('e') || current.dir.includes('w')) {
        patch.width = `${current.currentWidth}px`;
        if (current.dir.includes('w') && isPositioned) {
          patch.left = `${current.currentLeft}px`;
          if (current.clearRight) patch.right = 'auto';
        }
      }
      if (current.proportionalActive || current.dir.includes('s') || current.dir.includes('n')) {
        patch.height = `${current.currentHeight}px`;
        if (current.dir.includes('n') && isPositioned) {
          patch.top = `${current.currentTop}px`;
          if (current.clearBottom) patch.bottom = 'auto';
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

  const resolveStartCoord = (el: SelectedElementInfo, axis: 'left' | 'top'): number => {
    const raw = axis === 'left' ? el.styles.left : el.styles.top;
    if (raw && raw !== 'auto') {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    if (el.styles.position === 'absolute' || el.styles.position === 'fixed') {
      const fallback = axis === 'left' ? el.offsetLeft : el.offsetTop;
      if (typeof fallback === 'number' && Number.isFinite(fallback)) return Math.round(fallback);
    }
    return 0;
  };

  const hasSideAnchorConflict = (el: SelectedElementInfo, side: 'right' | 'bottom'): boolean => {
    const pos = el.styles.position;
    if (pos !== 'absolute' && pos !== 'fixed') return false;
    const val = side === 'right' ? el.styles.right : el.styles.bottom;
    return Boolean(val && val !== 'auto');
  };

  const startResize = (dir: ResizeHandleDir, e: React.PointerEvent) => {
    if (!selectedElement) return;
    e.preventDefault();
    e.stopPropagation();
    const startLeft = resolveStartCoord(selectedElement, 'left');
    const startTop = resolveStartCoord(selectedElement, 'top');
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
      startLeft,
      startTop,
      currentLeft: startLeft,
      currentTop: startTop,
      clearRight: hasSideAnchorConflict(selectedElement, 'right'),
      clearBottom: hasSideAnchorConflict(selectedElement, 'bottom'),
      wasInline: selectedElement.styles.display === 'inline',
      aspectLocked: aspectRatioLocked,
      proportionalActive: isDiagonal && (aspectRatioLocked || e.shiftKey),
    });
  };

  const startMove = (e: React.PointerEvent) => {
    if (!selectedElement) return;
    e.preventDefault();
    e.stopPropagation();
    const startLeft = resolveStartCoord(selectedElement, 'left');
    const startTop = resolveStartCoord(selectedElement, 'top');
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
      clearRight: hasSideAnchorConflict(selectedElement, 'right'),
      clearBottom: hasSideAnchorConflict(selectedElement, 'bottom'),
    });
  };

  const handleDragOverCanvas = (
    e: React.DragEvent<HTMLDivElement>,
    boardId?: ArtboardId
  ) => {
    if (!draggingComponent) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const targetFrame = boardId ? artboardIframesRef.current[boardId] : iframeRef.current;
    const iframeRect = targetFrame?.getBoundingClientRect();
    if (!iframeRect) return;
    const scale = zoomScale || 1;
    onPostIframeMessage(
      {
        type: 'HIGHLIGHT_DROP_TARGET',
        x: (e.clientX - iframeRect.left) / scale,
        y: (e.clientY - iframeRect.top) / scale,
      },
      boardId
    );
  };

  const handleDropCanvas = (
    e: React.DragEvent<HTMLDivElement>,
    boardId?: ArtboardId
  ) => {
    const droppedId = e.dataTransfer?.getData('text/plain');
    const resolvedComponent =
      draggingComponent ??
      (droppedId ? DRAGGABLE_COMPONENTS.find((c) => c.id === droppedId) ?? null : null);
    if (!resolvedComponent) return;
    e.preventDefault();
    if (boardId && boardId !== activeArtboard) {
      onSelectArtboard(boardId);
    }
    onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' }, 'all');
    onDropComponentOnCanvas(resolvedComponent);
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
    ? `${canvasWidthPx}px · ${viewport === 'all' ? 'All Viewports' : viewport.charAt(0).toUpperCase() + viewport.slice(1)}`
    : viewport === 'mobile'
      ? '375px · Mobile'
      : viewport === 'tablet'
        ? '768px · Tablet'
        : viewport === 'all'
          ? 'All Viewports'
          : '1440px · Desktop';

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

  const renderSelectionOverlay = (frameW: number, frameH: number) => {
    if (
      editorMode !== 'edit' ||
      draggingComponent ||
      !selectedElement ||
      !displayRect ||
      selectedElement.isHidden
    ) {
      return null;
    }

    const alignRight = displayRect.left > Math.max(120, frameW - 290);
    const canFitBottom = displayRect.top + displayRect.height + 34 <= frameH - 32;
    const vClass =
      displayRect.top >= 36 ? '-top-7' : canFitBottom ? '-bottom-7' : 'top-1.5';
    const hClass = alignRight ? 'right-0' : 'left-0';

    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
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

          <div
            data-testid="floating-quick-actions"
            className={`absolute ${hClass} ${vClass} flex items-center gap-1 whitespace-nowrap z-30`}
          >
            <span className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10.5px] font-mono-tabular font-medium px-2 py-0.5 rounded-md shadow-md">
              {selectedElement.tagName} ·{' '}
              {dragState?.kind === 'move'
                ? `x:${dragState.currentLeft} y:${dragState.currentTop}`
                : `${liveW} × ${liveH}${aspectRatioLocked ? ' · Locked' : ''}`}
            </span>
            <div className="pointer-events-auto inline-flex items-center gap-0.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border-strong)] p-0.5 shadow-xl studio-card-highlight">
              <button
                type="button"
                onPointerDown={startMove}
                aria-label="Move selected element"
                title="Drag to move element freely"
                className="inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[10.5px] font-medium text-[var(--studio-text-strong)] hover:bg-indigo-600 hover:text-white studio-pressable cursor-grab active:cursor-grabbing"
              >
                <Move className="w-3 h-3" strokeWidth={1.4} />
                Move
              </button>
              <button
                type="button"
                onClick={() => setAiBarOpen((prev) => !prev)}
                aria-label="Edit selected element with AI"
                aria-expanded={aiBarOpen}
                title="Edit selected element with AI"
                className={`inline-flex items-center gap-1 h-6 px-1.5 rounded-md text-[10.5px] font-medium studio-pressable cursor-pointer ${
                  aiBarOpen
                    ? 'bg-indigo-600 text-white'
                    : 'text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/15'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                <span>AI</span>
              </button>
              <button
                type="button"
                onClick={onSelectParent}
                aria-label="Select parent element"
                title="Select Parent Element"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-strong)] studio-pressable cursor-pointer"
              >
                <CornerLeftUp className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Parent</span>
              </button>
              <button
                type="button"
                onClick={() => onMoveSibling('up')}
                aria-label="Move element up"
                title="Move Up (Alt+↑)"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-strong)] studio-pressable cursor-pointer"
              >
                <ArrowUp className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Up</span>
              </button>
              <button
                type="button"
                onClick={() => onMoveSibling('down')}
                aria-label="Move element down"
                title="Move Down (Alt+↓)"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-strong)] studio-pressable cursor-pointer"
              >
                <ArrowDown className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Down</span>
              </button>
              <button
                type="button"
                onClick={onDuplicateSelected}
                aria-label="Floating duplicate element"
                title="Duplicate (Ctrl+D)"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-[var(--studio-muted)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-strong)] studio-pressable cursor-pointer"
              >
                <Copy className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Duplicate</span>
              </button>
              <button
                type="button"
                onClick={onViewSelectedInCode}
                aria-label="View in code editor"
                title="View in Code"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-cyan-700 dark:text-cyan-300 hover:bg-[var(--studio-hover)] studio-pressable cursor-pointer"
              >
                <Code2 className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Code</span>
              </button>
              <button
                type="button"
                onClick={onRemoveSelected}
                aria-label="Floating delete element"
                title="Delete (Del)"
                className="group inline-flex items-center h-6 px-1 rounded-md text-[10.5px] font-medium text-red-600 dark:text-red-400 hover:bg-red-500/20 studio-pressable cursor-pointer"
              >
                <Trash2 className="w-3 h-3 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">Delete</span>
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

        {aiBarOpen && (() => {
          const maxLeft = Math.max(8, frameW - 348);
          const clampedLeft = Math.max(8, Math.min(maxLeft, Math.round(displayRect.left)));
          const preferredBelowTop = Math.round(displayRect.top + displayRect.height + 10);
          const maxTop = Math.max(8, frameH - 210);
          const clampedTop =
            preferredBelowTop <= maxTop
              ? preferredBelowTop
              : Math.max(8, Math.min(maxTop, Math.round(displayRect.top - 160)));
          return (
            <div
              style={{ left: `${clampedLeft}px`, top: `${clampedTop}px` }}
              className="pointer-events-auto absolute z-40"
            >
              <AiElementBar
                variant="floating"
                targetTagName={selectedElement.tagName}
                copilot={aiCopilot}
                onClose={() => setAiBarOpen(false)}
              />
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <main className="flex-1 min-w-0 flex flex-col bg-[var(--studio-bg)] min-h-0 overflow-x-hidden">
      {/* Workspace Sub-Toolbar */}
      <div className="h-9 shrink-0 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 flex items-center justify-between gap-2">
        <div
          className="inline-flex items-center h-7 p-0.5 rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] shrink-0"
          role="tablist"
          aria-label="Workspace View"
        >
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'preview'}
            onClick={() => onChangeCenterTab('preview')}
            className={`inline-flex items-center gap-1.5 h-full px-2.5 rounded-md text-[11.5px] font-medium studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'preview'
                ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] border border-transparent'
            }`}
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.4} />
            Live Canvas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={centerTab === 'code'}
            onClick={() => onChangeCenterTab('code')}
            className={`inline-flex items-center gap-1.5 h-full px-2.5 rounded-md text-[11.5px] font-medium studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              centerTab === 'code'
                ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] border border-transparent'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" strokeWidth={1.4} />
            Code Editor
          </button>
        </div>

        <div className="flex items-center gap-1.5 min-w-0">
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
                    className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11.5px] font-semibold studio-pressable whitespace-nowrap cursor-pointer ${
                      quickAddOpen
                        ? 'bg-gradient-to-b from-blue-500 to-indigo-600 text-white border-indigo-400/40 shadow-[0_0_14px_rgba(99,102,241,0.35)]'
                        : 'bg-indigo-500/15 hover:bg-indigo-500/25 border-indigo-500/35 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Add
                  </button>
                  {quickAddOpen && (
                    <div
                      role="menu"
                      aria-label="Quick Insert Component Palette"
                      className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-1.5 shadow-2xl studio-card-highlight space-y-0.5"
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
                          className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-hover)] hover:text-[var(--studio-text-strong)] transition-colors cursor-pointer"
                        >
                          <span>{item.label}</span>
                          <Plus className="w-3 h-3 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <HoverIconButton
                onClick={onToggleOutlines}
                label="Outlines"
                ariaLabel="Toggle layout outlines"
                title="Show dashed layout outlines around elements"
                active={showOutlines}
                ariaPressed={showOutlines}
                size="sm"
                tone="accent"
                icon={<BoxSelect className="w-3.5 h-3.5" strokeWidth={1.4} />}
              />

              <select
                aria-label="Canvas Zoom"
                value={canvasZoom}
                onChange={(e) => onChangeCanvasZoom(e.target.value as CanvasZoomMode)}
                className="h-7 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] studio-card-highlight px-2 text-[11.5px] font-mono-tabular text-[var(--studio-text)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 cursor-pointer"
              >
                <option value="50">50%</option>
                <option value="75">75%</option>
                <option value="100">100%</option>
                <option value="fit">Fit ({Math.round(zoomScale * 100)}%)</option>
              </select>

              <span className="text-[var(--studio-border-strong)] hidden xl:inline" aria-hidden="true">
                ·
              </span>
            </>
          )}

          <button
            type="button"
            onClick={onToggleDefaultStartupMode}
            aria-label={`Default startup: ${defaultStartupMode === 'interact' ? 'Using Mode' : 'Editing Mode'}`}
            title={`Default startup: ${defaultStartupMode === 'interact' ? 'Using Mode' : 'Editing Mode'} (click to switch)`}
            className="group hidden xl:inline-flex items-center h-7 px-1.5 rounded-md text-[11.5px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
            <span className="studio-reveal-label">
              {defaultStartupMode === 'interact' ? 'Startup: Using' : 'Startup: Editing'}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleAutoSave}
            aria-label={`Auto-Save: ${
              autoSaveStatus.enabled
                ? autoSaveStatus.diskConnected
                  ? `Disk (${autoSaveStatus.diskFolderName})`
                  : 'Code'
                : 'Off'
            }`}
            title={
              autoSaveStatus.enabled
                ? autoSaveStatus.diskConnected
                  ? `Auto-Save: Disk (${autoSaveStatus.diskFolderName})`
                  : 'Auto-Save: Code (click to toggle)'
                : 'Auto-Save: Off (click to enable)'
            }
            className="group inline-flex items-center h-7 px-1.5 rounded-md text-[11.5px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckCircle2
              className={`w-3.5 h-3.5 shrink-0 ${
                autoSaveStatus.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--studio-muted-soft)]'
              }`}
              strokeWidth={1.4}
            />
            <span className="studio-reveal-label">
              {autoSaveStatus.enabled
                ? autoSaveStatus.diskConnected
                  ? 'Auto-Save: Disk'
                  : 'Auto-Save: Code'
                : 'Auto-Save: Off'}
            </span>
          </button>
        </div>
      </div>

      {/* MS 365 Two-Tier Ribbon (Home Formatting + Insert & Arrange) */}
      {centerTab === 'preview' && editorMode === 'edit' && (
        <div
          ref={menuContainerRef}
          className="shrink-0 border-b border-[var(--studio-border)] bg-[var(--studio-surface)]"
          role="toolbar"
          aria-label="MS 365 Formatting and Insert Ribbon"
        >
          {/* Tier 1: Home / Text Formatting */}
          <div className="min-h-9 px-3 py-1 border-b border-[var(--studio-border-subtle)] flex flex-wrap items-center gap-1">
            <HoverIconButton
              onClick={onToggleFormatPainter}
              disabled={!selectedElement && !formatPainterActive}
              label="Format"
              ariaLabel="Format Painter"
              ariaPressed={formatPainterActive}
              title={
                formatPainterActive
                  ? 'Click any target element on the canvas to paste copied styles'
                  : 'Copy styles from selected element (Format Painter)'
              }
              active={formatPainterActive}
              tone="accent"
              size="sm"
              icon={<Paintbrush className="w-3.5 h-3.5" strokeWidth={1.4} />}
            />

            <div className="h-4 w-px bg-[var(--studio-border)] shrink-0" aria-hidden="true" />

            <select
              aria-label="Ribbon font family"
              disabled={!selectedElement}
              value={
                matchStudioFontOption(
                  selectedElement?.inlineStyles['font-family'] || selectedElement?.styles.fontFamily
                )?.cssValue ?? ''
              }
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'font-family': e.target.value }, 'Change font family');
              }}
              className="h-7 w-32 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] px-1.5 text-[11.5px] text-[var(--studio-text)] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
            >
              <option value="">Font Family</option>
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

            <select
              aria-label="Ribbon font size in points"
              disabled={!selectedElement}
              value={POINT_SIZE_OPTIONS.includes(currentInlineSize) ? currentInlineSize : ''}
              onChange={(e) => {
                if (!e.target.value) return;
                onCommitFormattingStyle({ 'font-size': e.target.value }, `Set size ${e.target.value}`);
              }}
              className="h-7 w-14 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] px-1 text-[11.5px] font-mono-tabular text-[var(--studio-text)] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
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
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
            >
              <AArrowUp className="w-3.5 h-3.5" strokeWidth={1.4} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => stepFontSize(-2)}
              aria-label="Decrease font size"
              title="Decrease Font Size"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
            >
              <AArrowDown className="w-3.5 h-3.5" strokeWidth={1.4} />
            </button>

            <div className="h-4 w-px bg-[var(--studio-border)] shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() =>
                onCommitFormattingStyle({ 'font-weight': isBold ? '400' : '700' }, 'Toggle bold')
              }
              aria-label="Bold"
              aria-pressed={Boolean(isBold)}
              title="Bold"
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isBold ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isItalic ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isUnderline ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isStrike ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isSuper ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                isSub ? 'bg-indigo-500 text-white shadow-xs' : 'text-[var(--studio-text-secondary)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
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
              className="h-7 w-13 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] px-1 text-[11.5px] text-[var(--studio-text)] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
            >
              <option value="">Aa</option>
              <option value="uppercase">ABC</option>
              <option value="lowercase">abc</option>
              <option value="capitalize">Title</option>
              <option value="none">Normal</option>
            </select>

            <label
              title="Font Color / Shape Fill"
              className={`inline-flex items-center gap-1 h-7 px-1.5 rounded-md bg-[var(--studio-elevated)] border border-[var(--studio-border)] hover:bg-[var(--studio-hover)] shrink-0 ${
                selectedElement ? 'cursor-pointer' : 'opacity-40 pointer-events-none'
              }`}
            >
              <span className="text-[11px] font-bold text-[var(--studio-text)]">A</span>
              <span
                className="relative w-3.5 h-3.5 rounded-xs border border-[var(--studio-border-strong)] overflow-hidden"
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
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-amber-600 dark:text-amber-300 hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
            >
              <Highlighter className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <button
              type="button"
              disabled={!selectedElement}
              onClick={clearInlineFormatting}
              aria-label="Clear formatting"
              title="Clear All Formatting"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
            >
              <RemoveFormatting className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>

            <div className="h-4 w-px bg-[var(--studio-border)] shrink-0" aria-hidden="true" />

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
                className={`h-7 w-7 inline-flex items-center justify-center rounded-md studio-pressable disabled:opacity-40 cursor-pointer shrink-0 ${
                  selectedElement?.styles.textAlign === val
                    ? 'bg-[var(--studio-hover)] text-[var(--studio-text-strong)] ring-1 ring-[var(--studio-border-strong)]'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            ))}

            <div className="h-4 w-px bg-[var(--studio-border)] shrink-0" aria-hidden="true" />

            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(-16)}
              aria-label="Decrease indent"
              title="Decrease Indent"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
            >
              <IndentDecrease className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              disabled={!selectedElement}
              onClick={() => adjustIndent(16)}
              aria-label="Increase indent"
              title="Increase Indent"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] disabled:opacity-40 studio-pressable cursor-pointer shrink-0"
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
              className="h-7 w-14 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] px-1 text-[11.5px] font-mono-tabular text-[var(--studio-text)] disabled:opacity-40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 shrink-0"
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
                  className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11.5px] font-medium studio-pressable cursor-pointer ${
                    openMenu === 'shapes'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text)]'
                  }`}
                >
                  <Shapes className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
                  Shapes
                  <ChevronDown className="w-3 h-3 text-[var(--studio-muted)]" strokeWidth={1.5} />
                </button>

                {openMenu === 'shapes' && (
                  <div
                    role="menu"
                    aria-label="Shapes Gallery"
                    className="absolute left-0 top-full mt-1.5 z-50 w-80 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-2.5 shadow-2xl studio-card-highlight"
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
                          className="flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] hover:border-indigo-500/45 text-[var(--studio-text)] transition-colors cursor-pointer"
                        >
                          <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
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
                  className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11.5px] font-medium studio-pressable cursor-pointer ${
                    openMenu === 'table'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                      : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text)]'
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.4} />
                  Table
                  <ChevronDown className="w-3 h-3 text-[var(--studio-muted)]" strokeWidth={1.4} />
                </button>

                {openMenu === 'table' && (
                  <div
                    role="menu"
                    aria-label="Insert Table Grid"
                    className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-3 shadow-2xl studio-card-highlight"
                  >
                    <div className="flex items-center justify-between text-[11.5px] font-medium text-[var(--studio-text)] mb-2">
                      <span>Insert Table</span>
                      <span className="font-mono-tabular text-emerald-600 dark:text-emerald-400">
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
                                  ? 'bg-emerald-500/35 border-emerald-500'
                                  : 'bg-[var(--studio-elevated)] border-[var(--studio-border)] hover:border-[var(--studio-border-strong)]'
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
                      className="mt-2.5 w-full py-1.5 rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] text-[var(--studio-text-strong)] font-medium cursor-pointer"
                    >
                      Quick 3×3 Data Table
                    </button>
                  </div>
                )}
              </div>

              <HoverIconButton
                onClick={() => onQuickInsertById('list-bulleted')}
                label="Bullets"
                ariaLabel="Insert Bulleted List"
                title="Insert Bulleted List"
                size="sm"
                icon={<List className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.4} />}
              />

              <HoverIconButton
                onClick={() => onQuickInsertById('list-numbered')}
                label="Numbered"
                ariaLabel="Insert Numbered List"
                title="Insert Numbered List"
                size="sm"
                icon={<ListOrdered className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.4} />}
              />

              {/* Insert Image Popover */}
              <div className="relative">
                <button
                  type="button"
                  aria-expanded={openMenu === 'image'}
                  onClick={() => setOpenMenu((m) => (m === 'image' ? null : 'image'))}
                  className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11.5px] font-medium studio-pressable cursor-pointer ${
                    openMenu === 'image'
                      ? 'bg-violet-500/20 border-violet-500/50 text-violet-700 dark:text-violet-300'
                      : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] studio-card-highlight text-[var(--studio-text)]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" strokeWidth={1.4} />
                  Image
                </button>

                {openMenu === 'image' && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-3 shadow-2xl studio-card-highlight space-y-2">
                    <div className="studio-section-header">Insert Image</div>
                    <input
                      type="url"
                      aria-label="Image URL"
                      value={imageUrlDraft}
                      onChange={(e) => setImageUrlDraft(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <input
                      type="text"
                      aria-label="Image alt text"
                      value={imageAltDraft}
                      onChange={(e) => setImageAltDraft(e.target.value)}
                      placeholder="Alt description"
                      className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
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
                        className="px-2.5 py-1.5 rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] text-[var(--studio-text-strong)] cursor-pointer"
                      >
                        Placeholder
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <HoverIconButton
                onClick={() => onQuickInsertById('link-anchor')}
                label="Link"
                ariaLabel="Insert Hyperlink"
                title="Insert Hyperlink"
                size="sm"
                icon={<Link2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" strokeWidth={1.4} />}
              />

              {/* MS Word Symbol Picker */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Insert Symbol"
                  aria-expanded={openMenu === 'symbols'}
                  aria-haspopup="menu"
                  title="Insert Symbol"
                  onClick={() => setOpenMenu((m) => (m === 'symbols' ? null : 'symbols'))}
                  className={`group inline-flex items-center h-7 px-1.5 rounded-md border text-[11.5px] font-medium studio-card-highlight studio-pressable cursor-pointer ${
                    openMenu === 'symbols'
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300'
                      : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text)]'
                  }`}
                >
                  <span className="font-semibold text-amber-600 dark:text-amber-400 leading-none w-3.5 text-center">Ω</span>
                  <span className="studio-reveal-label">Symbol</span>
                </button>
                {openMenu === 'symbols' && (
                  <div
                    role="menu"
                    aria-label="Insert Symbol"
                    className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-2.5 shadow-2xl studio-card-highlight"
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
                          className="h-7 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] hover:border-amber-500/50 text-sm text-[var(--studio-text-strong)] cursor-pointer"
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
                  aria-label="Find and Replace"
                  aria-expanded={openMenu === 'find'}
                  title="Find & Replace text"
                  onClick={() => {
                    setFindStatus(null);
                    setOpenMenu((m) => (m === 'find' ? null : 'find'));
                  }}
                  className={`group inline-flex items-center h-7 px-1.5 rounded-md border text-[11.5px] font-medium studio-card-highlight studio-pressable cursor-pointer ${
                    openMenu === 'find'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text)]'
                  }`}
                >
                  <Replace className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" strokeWidth={1.4} />
                  <span className="studio-reveal-label">Replace</span>
                </button>
                {openMenu === 'find' && (
                  <div
                    aria-label="Find and Replace"
                    className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] p-3 shadow-2xl studio-card-highlight space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="studio-section-header">Find &amp; Replace</span>
                      {findStatus && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{findStatus}</span>
                      )}
                    </div>
                    <input
                      type="text"
                      aria-label="Find text"
                      value={findDraft}
                      onChange={(e) => setFindDraft(e.target.value)}
                      placeholder="Find text on page..."
                      className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <input
                      type="text"
                      aria-label="Replace with text"
                      value={replaceDraft}
                      onChange={(e) => setReplaceDraft(e.target.value)}
                      placeholder="Replace with..."
                      className="w-full rounded-lg bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
                    />
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <label className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--studio-muted)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={findMatchCase}
                          onChange={(e) => setFindMatchCase(e.target.checked)}
                          className="rounded border-[var(--studio-border-strong)] bg-[var(--studio-bg)] accent-indigo-500"
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
              <HoverIconButton
                onClick={onDuplicateSelected}
                disabled={!selectedElement}
                label="Duplicate"
                ariaLabel="Duplicate selected"
                title="Duplicate Element (Ctrl+D)"
                size="sm"
                icon={<Copy className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
              />
              <HoverIconButton
                onClick={() => rotateBy(-15)}
                disabled={!selectedElement}
                label="-15°"
                ariaLabel="Rotate left 15 degrees"
                title="Rotate Left 15°"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
              />
              <HoverIconButton
                onClick={() => rotateBy(15)}
                disabled={!selectedElement}
                label="+15°"
                ariaLabel="Rotate right 15 degrees"
                title="Rotate Right 15°"
                size="sm"
                icon={<RotateCw className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
              />
              <HoverIconButton
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
                disabled={!selectedElement}
                label="Forward"
                ariaLabel="Bring Forward"
                title="Bring Forward"
                size="sm"
                icon={<BringToFront className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
              />
              <HoverIconButton
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
                disabled={!selectedElement}
                label="Backward"
                ariaLabel="Send Backward"
                title="Send Backward"
                size="sm"
                icon={<SendToBack className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
              />
            </div>
          </div>
        </div>
      )}

      {/* Preview Stage or Code Editor */}
      {centerTab === 'preview' ? (
        viewport === 'all' ? (
          <div
            ref={multiStageRef}
            data-testid="multi-artboard-stage"
            data-canvas-backdrop="true"
            onPointerDown={(e) => {
              const target = e.target as HTMLElement;
              const isBackdrop = target.dataset.canvasBackdrop === 'true';
              if (e.button === 1 || spacePressed || (e.button === 0 && isBackdrop)) {
                e.preventDefault();
                setPanDrag({
                  startX: e.clientX,
                  startY: e.clientY,
                  startPanX: multiPan.x,
                  startPanY: multiPan.y,
                });
              }
            }}
            style={{
              cursor: panDrag ? 'grabbing' : spacePressed ? 'grab' : 'default',
            }}
            className="flex-1 min-h-0 relative overflow-hidden canvas-grid-bg select-none"
          >
            {!entryHtmlPath ? (
              <div className="w-full h-full flex items-center justify-center p-6">
                <div className="max-w-md text-center bg-[var(--studio-surface)] border border-[var(--studio-border)] studio-card-highlight rounded-2xl p-6 shadow-xl">
                  <h2 className="font-display text-base font-semibold text-[var(--studio-text-strong)] mb-2">
                    No HTML entry file found
                  </h2>
                  <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
                    Load a project containing an <code className="font-mono-tabular text-[var(--studio-text-strong)]">index.html</code>{' '}
                    file or select one of the starter templates from the left sidebar to launch the
                    live preview.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Top Multi-Artboard Context HUD */}
                <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between gap-2 pointer-events-none">
                  <div className="pointer-events-auto inline-flex items-center gap-2.5 h-8 px-2.5 rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-surface)]/95 backdrop-blur-md shadow-lg">
                    {htmlPages.length > 1 ? (
                      <select
                        aria-label="Active preview HTML page"
                        value={entryHtmlPath}
                        onChange={(e) => onSwitchPreviewPage(e.target.value)}
                        className="h-6 rounded-md bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 text-[11px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                      >
                        {htmlPages.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono-tabular text-[11px] text-[var(--studio-text-strong)]">
                        {entryHtmlPath}
                      </span>
                    )}
                    <span className="h-3.5 w-px bg-[var(--studio-border)]" aria-hidden="true" />
                    <span className="font-mono tabular-nums text-[10.5px] uppercase tracking-[0.18em] text-[var(--studio-muted)]">
                      3 ARTBOARDS · 1440 / 768 / 375
                    </span>
                  </div>

                  <div className="pointer-events-auto inline-flex items-center gap-1.5 h-8 px-2 rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-surface)]/95 backdrop-blur-md shadow-lg">
                    <span className="hidden md:inline-flex items-center gap-1 px-1.5 font-mono tabular-nums text-[10px] uppercase tracking-[0.16em] text-[var(--studio-muted-soft)]">
                      <Hand className="w-3 h-3" strokeWidth={1.4} />
                      Drag grid or Space+Drag · Ctrl+Scroll zoom
                    </span>
                    <span className="hidden md:inline-block h-3.5 w-px bg-[var(--studio-border)]" aria-hidden="true" />
                    <span
                      data-testid="multi-artboard-zoom-readout"
                      className="px-1.5 font-mono tabular-nums text-[10.5px] uppercase tracking-[0.16em] text-[var(--studio-text-strong)]"
                    >
                      {Math.round(zoomScale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setMultiPan({ x: 0, y: 0 });
                        setMultiCustomZoom(null);
                        onChangeCanvasZoom('fit');
                      }}
                      title="Fit all 3 artboards and center stage"
                      className="h-6 px-2 rounded border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] font-mono tabular-nums text-[10px] uppercase tracking-[0.14em] text-[var(--studio-text)] studio-pressable cursor-pointer"
                    >
                      Fit All
                    </button>
                    <HoverIconButton
                      onClick={onRefreshPreview}
                      label="Reload"
                      ariaLabel="Reload all artboards"
                      title="Reload all artboards"
                      size="xs"
                      icon={<RefreshCw className="w-3 h-3 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
                    />
                  </div>
                </div>

                {/* Pannable / Zoomable Multi-Artboard Plane */}
                <div
                  data-canvas-backdrop="true"
                  className="w-full h-full flex items-center justify-center overflow-hidden pt-10"
                >
                  <div
                    data-canvas-backdrop="true"
                    style={{
                      width: `${MULTI_ARTBOARD_TOTAL_W}px`,
                      transform: `translate3d(${multiPan.x}px, ${multiPan.y}px, 0) scale(${zoomScale})`,
                      transformOrigin: 'center center',
                    }}
                    className="shrink-0 flex items-start gap-12 transition-transform duration-75 ease-out will-change-transform"
                  >
                    {MULTI_ARTBOARD_DEFS.map((board) => {
                      const isActive = activeArtboard === board.id;
                      return (
                        <section
                          key={board.id}
                          data-testid={`artboard-${board.id}`}
                          aria-label={`${board.label} ${board.widthPx}px artboard`}
                          style={{ width: `${board.widthPx}px` }}
                          className="shrink-0 flex flex-col"
                        >
                          <div className="mb-2.5 flex items-center justify-between gap-2 px-0.5">
                            <button
                              type="button"
                              onClick={() => onSelectArtboard(board.id)}
                              className="inline-flex items-center gap-2 cursor-pointer group"
                              title={`Focus ${board.label} (${board.widthPx}px) artboard`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                  isActive
                                    ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.75)]'
                                    : 'bg-[var(--studio-muted-soft)] group-hover:bg-indigo-400'
                                }`}
                              />
                              <span
                                className={`font-mono tabular-nums text-[10.5px] uppercase tracking-[0.18em] transition-colors ${
                                  isActive
                                    ? 'text-[var(--studio-text-strong)] font-semibold'
                                    : 'text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]'
                                }`}
                              >
                                {board.label} · {board.widthPx}PX
                              </span>
                            </button>

                            <div className="flex items-center gap-2">
                              <span className="font-mono tabular-nums text-[10px] uppercase tracking-[0.18em] text-[var(--studio-muted-soft)]">
                                {board.widthPx} × {board.heightPx}
                              </span>
                              {onChangeViewport && (
                                <button
                                  type="button"
                                  onClick={() => onChangeViewport(board.id)}
                                  aria-label={`Solo ${board.label} viewport`}
                                  title={`Focus ${board.label} viewport alone`}
                                  className="inline-flex items-center gap-1 h-5 px-1.5 rounded border border-[var(--studio-border)] bg-[var(--studio-surface)] hover:bg-[var(--studio-hover)] font-mono tabular-nums text-[10px] uppercase tracking-[0.14em] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] studio-pressable cursor-pointer"
                                >
                                  <Maximize2 className="w-2.5 h-2.5" strokeWidth={1.5} />
                                  <span>Solo</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div
                            onPointerDown={() => {
                              if (activeArtboard !== board.id) {
                                onSelectArtboard(board.id);
                              }
                            }}
                            style={{
                              width: `${board.widthPx}px`,
                              height: `${board.heightPx}px`,
                            }}
                            className={`relative rounded-lg border bg-white shadow-2xl overflow-hidden transition-shadow ${
                              isActive
                                ? 'border-indigo-500/80 ring-2 ring-indigo-500/20'
                                : 'border-[var(--studio-border-strong)] hover:border-indigo-400/50'
                            }`}
                          >
                            <iframe
                              key={`${board.id}-${previewKey}`}
                              name={`ve-artboard:${board.id}`}
                              ref={(el) => {
                                artboardIframesRef.current[board.id] = el;
                                onRegisterArtboardIframe(board.id, el);
                                if (board.id === activeArtboard) {
                                  (iframeRef as { current: HTMLIFrameElement | null }).current = el;
                                }
                              }}
                              title={`${board.label} ${board.widthPx}px Preview`}
                              data-testid={`artboard-iframe-${board.id}`}
                              srcDoc={srcDoc}
                              sandbox="allow-scripts allow-forms allow-popups"
                              className={`w-full h-full border-0 block bg-white ${
                                panDrag || spacePressed || dragState || draggingComponent
                                  ? 'pointer-events-none select-none'
                                  : ''
                              }`}
                            />
                            {draggingComponent && (
                              <div
                                data-testid={`artboard-drop-overlay-${board.id}`}
                                onDragOver={(e) => handleDragOverCanvas(e, board.id)}
                                onDragLeave={() => onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' }, board.id)}
                                onDrop={(e) => handleDropCanvas(e, board.id)}
                                className="absolute inset-0 z-30 bg-emerald-500/5 border-2 border-dashed border-emerald-500/50"
                              />
                            )}
                            {isActive && renderSelectionOverlay(board.widthPx, board.heightPx)}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
        <div
          ref={stageScrollRef}
          className="flex-1 min-h-0 overflow-auto builder-scroll canvas-grid-bg p-5 flex items-start"
        >
          {!entryHtmlPath ? (
            <div className="m-auto max-w-md text-center bg-[var(--studio-surface)] border border-[var(--studio-border)] studio-card-highlight rounded-2xl p-6 shadow-xl">
              <h2 className="font-display text-base font-semibold text-[var(--studio-text-strong)] mb-2">
                No HTML entry file found
              </h2>
              <p className="text-xs text-[var(--studio-muted)] leading-relaxed">
                Load a project containing an <code className="font-mono-tabular text-[var(--studio-text-strong)]">index.html</code>{' '}
                file or select one of the starter templates from the left sidebar to launch the
                live preview.
              </p>
            </div>
          ) : (
            <div
              className="relative shrink-0 mx-auto"
              style={{
                width: `${Math.round(effectiveFrameWidthPx * zoomScale)}px`,
                height: `${Math.round(effectiveFrameHeightPx * zoomScale)}px`,
              }}
            >
              {/* Live Frame Dimensions Pill while dragging */}
              {frameDrag && (
                <div
                  data-testid="canvas-size-badge"
                  className="fixed top-28 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-[var(--studio-surface)] border border-indigo-500/70 text-[12px] font-mono-tabular font-semibold text-indigo-600 dark:text-indigo-200 shadow-2xl pointer-events-none"
                >
                  {frameDrag.currentW} × {frameDrag.currentH} px
                </div>
              )}

              <div
                ref={frameContainerRef}
                data-testid="canvas-frame"
                style={{
                  width: `${Math.round(effectiveFrameWidthPx)}px`,
                  height: `${effectiveFrameHeightPx}px`,
                  transform: zoomScale !== 1 ? `scale(${zoomScale})` : undefined,
                  transformOrigin: 'top left',
                }}
                className="relative min-h-[300px] flex flex-col rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-2xl"
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
                  <div className="w-1 h-10 rounded-full bg-[var(--studio-muted-soft)] group-hover:bg-indigo-500 transition-colors" />
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
                  <div className="w-1 h-10 rounded-full bg-[var(--studio-muted-soft)] group-hover:bg-indigo-500 transition-colors" />
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
                  <div className="h-1 w-12 rounded-full bg-[var(--studio-muted-soft)] group-hover:bg-indigo-500 transition-colors" />
                </div>

                {/* Compact Elevated Device Header Bar */}
                <div className="h-8 shrink-0 px-3 border-b border-[var(--studio-border)] bg-[var(--studio-elevated)] rounded-t-xl flex items-center justify-between gap-2 text-[11.5px] text-[var(--studio-muted)] studio-card-highlight">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1.5 mr-1 shrink-0" aria-hidden="true">
                      <span className="w-2 h-2 rounded-full bg-[var(--studio-border-strong)]" />
                      <span className="w-2 h-2 rounded-full bg-[var(--studio-border-strong)]" />
                      <span className="w-2 h-2 rounded-full bg-[var(--studio-border-strong)]" />
                    </div>
                    {htmlPages.length > 1 ? (
                      <select
                        aria-label="Active preview HTML page"
                        value={entryHtmlPath}
                        onChange={(e) => onSwitchPreviewPage(e.target.value)}
                        className="h-6 rounded-md bg-[var(--studio-bg)] border border-[var(--studio-border)] px-2 text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] focus:outline-none focus:border-indigo-500"
                      >
                        {htmlPages.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono-tabular text-[11.5px] text-[var(--studio-text-strong)] truncate">
                        {entryHtmlPath}
                      </span>
                    )}
                    <span className="font-mono-tabular text-[11.5px] text-[var(--studio-muted-soft)] truncate">
                      · {viewportLabel} · {frameSizeDisplay}
                    </span>
                    {canvasWidthPx !== null || canvasHeightPx !== null ? (
                      <button
                        type="button"
                        onClick={() => onResizeCanvasFrame(null, null)}
                        aria-label="Reset size"
                        title="Reset custom canvas dimensions"
                        className="group inline-flex items-center h-5 px-1 rounded text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                        <span className="studio-reveal-label">Reset size</span>
                      </button>
                    ) : null}
                  </div>
                  <HoverIconButton
                    onClick={onRefreshPreview}
                    label="Reload"
                    ariaLabel="Reload preview"
                    title="Reload preview"
                    size="xs"
                    icon={<RefreshCw className="w-3 h-3 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
                  />
                </div>

                {/* Sandboxed Iframe + Selection/Move/Resize Overlay + Spacing Guides + Drag-Drop Target */}
                <div
                  className="relative flex-1 bg-white overflow-hidden rounded-b-xl"
                  data-testid="preview-stage"
                >
                  <iframe
                    key={previewKey}
                    name={`ve-artboard:${viewport}`}
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
                      onDragOver={(e) => handleDragOverCanvas(e)}
                      onDragLeave={() => onPostIframeMessage({ type: 'CLEAR_DROP_TARGET' })}
                      onDrop={(e) => handleDropCanvas(e)}
                      className="absolute inset-0 z-30 bg-emerald-500/5 border-2 border-dashed border-emerald-500/50"
                    />
                  )}

                  {/* Visual Selection, Spacing Guides, Quick Action Bar & 8-Handle Resize Overlay */}
                  {renderSelectionOverlay(effectiveFrameWidthPx, effectiveFrameHeightPx)}
                </div>
              </div>
            </div>
          )}
        </div>
        )
      ) : (
        /* Code Editor Tab */
        <div className="flex-1 min-h-0 flex flex-col bg-[var(--studio-bg)]" data-code-editor="true">
          {activeFile ? (
            <>
              <div className="h-9 shrink-0 px-4 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] flex items-center justify-between text-xs text-[var(--studio-muted)]">
                <span className="font-mono-tabular text-[12px] text-[var(--studio-text-strong)]">
                  {activeFile.path}
                  {jumpToLine && jumpToLine.path === activeFile.path
                    ? ` · Line ${jumpToLine.line}${
                        jumpToLine.endLine && jumpToLine.endLine !== jumpToLine.line
                          ? `–${jumpToLine.endLine}`
                          : ''
                      }`
                    : ''}
                </span>
                <span className="text-[11.5px] text-[var(--studio-muted-soft)]">
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
                className="flex-1 w-full p-4 bg-[var(--studio-bg)] text-[var(--studio-text)] font-mono-tabular text-[12.5px] leading-6 resize-none focus:outline-none builder-scroll"
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--studio-muted-soft)]">
              Select a file from the explorer to inspect or edit its source code.
            </div>
          )}
        </div>
      )}
    </main>
  );
};

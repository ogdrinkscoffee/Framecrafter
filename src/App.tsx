import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { FileExplorer } from './components/FileExplorer';
import { RightStudioPanel } from './components/RightStudioPanel';
import { ShortcutsModal } from './components/ShortcutsModal';
import { TopToolbar } from './components/TopToolbar';
import type {
  AutoSaveStatus,
  CanvasZoomMode,
  CenterTab,
  DomTreeNode,
  DraggableComponentDef,
  EditorMode,
  HtmlElementPatch,
  ProjectFile,
  QuickInsertKind,
  ResponsiveScope,
  RightPanelTab,
  SelectedElementInfo,
  SeoMetaValues,
  ViewportPreset,
} from './types/editor';
import { findElementSourceLocation, insertQuickComponentInProject } from './utils/codeSync';
import { DRAGGABLE_COMPONENTS } from './utils/componentCatalog';
import { deleteRootCssVariable, updateRootCssVariable } from './utils/cssVariables';
import { exportProjectAsZip, exportSingleFile } from './utils/exportProject';
import {
  clearWorkspaceStorage,
  type FileSystemDirectoryHandleLike,
  loadDefaultModePreference,
  loadWorkspaceFromStorage,
  requestWritableDirectoryHandle,
  saveDefaultModePreference,
  saveWorkspaceToStorage,
  writeProjectFilesToDirectory,
} from './utils/fileSystemSync';
import {
  cloneProjectFiles,
  createHistoryState,
  pushHistoryState,
  redoHistoryState,
  undoHistoryState,
} from './utils/historyManager';
import {
  appendTableColumnInHtml,
  appendTableRowInHtml,
  applyElementPatchToHtml,
  createPageHtmlTemplate,
  duplicateElementInHtml,
  ensureElementNodeAttr,
  ensureStylesheetLinkInHtml,
  insertHtmlSnippet,
  moveElementSiblingInHtml,
  removeLastTableColumnInHtml,
  removeLastTableRowInHtml,
  replaceTextInHtmlBody,
  type SvgShapeHtmlPatch,
  toggleTableStripedRowsInHtml,
  updateSvgShapeInHtml,
  updateTableCellsStyleInHtml,
} from './utils/htmlSync';
import { buildIframeBridgeMarkup } from './utils/iframeBridge';
import { bundleProjectInBrowser } from './utils/browserBundler';
import {
  buildSrcDoc,
  type CompiledProjectBundle,
  detectFileType,
  detectProjectTitleFromUpload,
  findEntryHtmlPath,
  needsModuleBundling,
  normalizeUploadedFiles,
  shouldIgnoreUploadPath,
} from './utils/projectBundler';
import {
  applyRuntimeStylePatchToFiles,
  applyRuntimeTextPatchToFiles,
} from './utils/reactVisualSync';
import {
  getNodeDeviceVisibility,
  parseResponsiveCssStore,
  serializeResponsiveCssStore,
  upsertResponsiveStylesInCss,
} from './utils/responsiveCss';
import { SAMPLE_TEMPLATES } from './utils/sampleTemplates';
import { updateHeadSeoMeta } from './utils/seoMeta';
import {
  classifyViewportPresetFromWidth,
  isShortcutTypingTarget,
  matchShortcutAction,
  type ShortcutAction,
} from './utils/shortcuts';

const CONTAINER_TAGS = new Set([
  'div',
  'section',
  'main',
  'article',
  'aside',
  'header',
  'footer',
  'nav',
  'form',
  'ul',
  'ol',
]);

export default function App() {
  const defaultTemplate = SAMPLE_TEMPLATES[0];
  const savedWorkspace = useMemo(() => loadWorkspaceFromStorage(), []);
  const initialStartupMode = useMemo(() => loadDefaultModePreference(), []);

  const startingFiles = savedWorkspace ? savedWorkspace.files : defaultTemplate.files;
  const startingName = savedWorkspace ? savedWorkspace.projectName : defaultTemplate.name;
  const startingTemplateId = savedWorkspace ? savedWorkspace.activeTemplateId : defaultTemplate.id;

  const [history, setHistory] = useState(() =>
    createHistoryState(startingFiles, `Loaded ${startingName}`)
  );
  const [initialFiles, setInitialFiles] = useState<ProjectFile[]>(() => {
    const matchedTpl = SAMPLE_TEMPLATES.find((t) => t.id === startingTemplateId);
    return cloneProjectFiles(matchedTpl ? matchedTpl.files : startingFiles);
  });
  const [projectName, setProjectName] = useState(startingName);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(startingTemplateId);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(
    () => findEntryHtmlPath(startingFiles) ?? startingFiles[0]?.path ?? null
  );
  const [activePreviewHtmlPath, setActivePreviewHtmlPath] = useState<string | null>(
    () => findEntryHtmlPath(startingFiles)
  );

  const [defaultStartupMode, setDefaultStartupMode] = useState<EditorMode>(initialStartupMode);
  const [editorMode, setEditorMode] = useState<EditorMode>(initialStartupMode);
  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [responsiveScope, setResponsiveScope] = useState<ResponsiveScope>('all');
  const [centerTab, setCenterTab] = useState<CenterTab>('preview');
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('inspector');
  const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
  const [aspectLocksByKey, setAspectLocksByKey] = useState<Record<string, boolean>>({});
  const [draggingComponent, setDraggingComponent] = useState<DraggableComponentDef | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<Record<string, string | null> | null>(null);
  const [jumpToLine, setJumpToLine] = useState<{
    path: string;
    line: number;
    endLine?: number;
    token: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Split-pane sidebar sizing & collapse
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(244);
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(392);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [splitDrag, setSplitDrag] = useState<'left' | 'right' | null>(null);

  // Canvas frame dimensions, zoom, outlines, DOM tree & modal
  const [canvasWidthPx, setCanvasWidthPx] = useState<number | null>(null);
  const [canvasHeightPx, setCanvasHeightPx] = useState<number | null>(null);
  const [canvasZoom, setCanvasZoom] = useState<CanvasZoomMode>('100');
  const [showOutlines, setShowOutlines] = useState(false);
  const [domTree, setDomTree] = useState<DomTreeNode[]>([]);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [activeSpacingOverlay, setActiveSpacingOverlay] = useState<'margin' | 'padding' | null>(
    null
  );

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({
    enabled: true,
    diskConnected: false,
    diskFolderName: null,
    lastSavedAt: null,
    permissionState: 'none',
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const diskHandleRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const dropTargetRef = useRef<{
    targetVeId: string | null;
    placement: 'inside' | 'after';
  }>({ targetVeId: null, placement: 'inside' });

  const files = history.present.files;
  const htmlPages = useMemo(
    () => files.filter((f) => f.type === 'html').map((f) => f.path),
    [files]
  );

  const entryHtmlPath = useMemo(() => {
    if (activePreviewHtmlPath && files.some((f) => f.path === activePreviewHtmlPath)) {
      return activePreviewHtmlPath;
    }
    return findEntryHtmlPath(files);
  }, [activePreviewHtmlPath, files]);

  const activeHtmlFile = useMemo(
    () => (entryHtmlPath ? files.find((f) => f.path === entryHtmlPath) ?? null : null),
    [files, entryHtmlPath]
  );

  const primaryCssFile = useMemo(() => {
    return (
      files.find((f) => f.path === 'styles.css') ??
      files.find((f) => f.type === 'css') ??
      null
    );
  }, [files]);

  const [previewKey, setPreviewKey] = useState(1);
  const [renderedSrcDoc, setRenderedSrcDoc] = useState(() => {
    const entry = findEntryHtmlPath(startingFiles);
    if (!entry) return '';
    return buildSrcDoc(
      startingFiles,
      entry,
      buildIframeBridgeMarkup(initialStartupMode, null)
    );
  });

  const codeDirtyRef = useRef(false);
  const bundleSeqRef = useRef(0);
  const selectedOriginalTextRef = useRef('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  // Automatic save into localStorage + connected local disk directory
  useEffect(() => {
    if (!autoSaveStatus.enabled) return;

    const timer = window.setTimeout(async () => {
      saveWorkspaceToStorage({
        projectName,
        activeTemplateId,
        files,
        savedAt: Date.now(),
      });

      if (diskHandleRef.current) {
        const res = await writeProjectFilesToDirectory(diskHandleRef.current, files);
        if (!res.ok) {
          showToast(res.error || 'Disk auto-save failed');
          return;
        }
      }

      setAutoSaveStatus((prev) => ({ ...prev, lastSavedAt: Date.now() }));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [files, projectName, activeTemplateId, autoSaveStatus.enabled, showToast]);

  // Bidirectional vertical split-pane divider pointer dragging
  useEffect(() => {
    if (!splitDrag) return;
    const onPointerMove = (e: PointerEvent) => {
      if (splitDrag === 'left') {
        const nextW = Math.max(180, Math.min(480, Math.round(e.clientX)));
        setLeftSidebarWidth(nextW);
      } else {
        const nextW = Math.max(300, Math.min(560, Math.round(window.innerWidth - e.clientX)));
        setRightSidebarWidth(nextW);
      }
    };
    const onPointerUp = () => {
      setSplitDrag(null);
      window.requestAnimationFrame(() => {
        postToIframe({ type: 'REQUEST_RECT' });
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
  }, [splitDrag]);

  const rebuildPreview = useCallback(
    (
      nextFiles: ProjectFile[],
      modeOverride: EditorMode = editorMode,
      restoreVeId: string | null = null,
      pageOverride?: string | null
    ) => {
      const targetPage =
        pageOverride && nextFiles.some((f) => f.path === pageOverride)
          ? pageOverride
          : activePreviewHtmlPath && nextFiles.some((f) => f.path === activePreviewHtmlPath)
            ? activePreviewHtmlPath
            : findEntryHtmlPath(nextFiles);

      if (!targetPage) {
        setRenderedSrcDoc('');
        setPreviewKey((k) => k + 1);
        return;
      }

      const bridge = buildIframeBridgeMarkup(modeOverride, restoreVeId);
      const seq = ++bundleSeqRef.current;

      if (!needsModuleBundling(nextFiles, targetPage)) {
        setRenderedSrcDoc(buildSrcDoc(nextFiles, targetPage, bridge));
        setPreviewKey((k) => k + 1);
        return;
      }

      void (async () => {
        try {
          const bundle = await bundleProjectInBrowser(nextFiles, targetPage);
          if (seq !== bundleSeqRef.current) return;
          setRenderedSrcDoc(buildSrcDoc(nextFiles, targetPage, bridge, bundle));
          setPreviewKey((k) => k + 1);
          if (bundle.error) {
            showToast('Build error — check preview diagnostic panel');
          }
        } catch (err) {
          if (seq !== bundleSeqRef.current) return;
          const fallbackBundle: CompiledProjectBundle = {
            error: err instanceof Error ? err.message : 'Failed to bundle uploaded app',
          };
          setRenderedSrcDoc(buildSrcDoc(nextFiles, targetPage, bridge, fallbackBundle));
          setPreviewKey((k) => k + 1);
        }
      })();
    },
    [editorMode, activePreviewHtmlPath, showToast]
  );

  // If restored workspace from localStorage uses TSX/ESM/Vite, bundle it on initial mount
  useEffect(() => {
    const initialEntry = findEntryHtmlPath(startingFiles);
    if (initialEntry && needsModuleBundling(startingFiles, initialEntry)) {
      rebuildPreview(startingFiles, initialStartupMode, null, initialEntry);
    }
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const postToIframe = useCallback((message: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ target: 've-iframe', ...message }, '*');
  }, []);

  const handleSwitchPreviewPage = useCallback(
    (pagePath: string) => {
      const target = files.find((f) => f.path === pagePath && f.type === 'html');
      if (!target) {
        showToast(`Page "${pagePath}" not found in project`);
        return;
      }
      setActivePreviewHtmlPath(pagePath);
      setActiveFilePath(pagePath);
      setSelectedElement(null);
      rebuildPreview(files, editorMode, null, pagePath);
      showToast(`Navigated to ${pagePath}`);
    },
    [files, editorMode, rebuildPreview, showToast]
  );

  const handleChangeMode = useCallback(
    (nextMode: EditorMode) => {
      setEditorMode(nextMode);
      postToIframe({ type: 'SET_MODE', mode: nextMode });
      if (nextMode === 'interact') {
        setSelectedElement(null);
      }
    },
    [postToIframe]
  );

  const handleToggleDefaultStartupMode = useCallback(() => {
    const nextDefault: EditorMode = defaultStartupMode === 'edit' ? 'interact' : 'edit';
    setDefaultStartupMode(nextDefault);
    saveDefaultModePreference(nextDefault);
    showToast(
      nextDefault === 'interact'
        ? 'Default startup set to Using Mode'
        : 'Default startup set to Editing Mode'
    );
  }, [defaultStartupMode, showToast]);

  const handleChangeViewport = useCallback((nextViewport: ViewportPreset) => {
    setViewport(nextViewport);
    setCanvasWidthPx(null);
    if (nextViewport === 'mobile') {
      setResponsiveScope('mobile');
    } else if (nextViewport === 'tablet') {
      setResponsiveScope('tablet');
    } else {
      setResponsiveScope((prev) => (prev === 'mobile' || prev === 'tablet' ? 'desktop' : prev));
    }
  }, []);

  const handleResizeCanvasFrame = useCallback((widthPx: number | null, heightPx: number | null) => {
    setCanvasWidthPx(widthPx);
    setCanvasHeightPx(heightPx);
    if (widthPx !== null) {
      const matchedPreset = classifyViewportPresetFromWidth(widthPx);
      setViewport(matchedPreset);
    }
  }, []);

  const handleToggleOutlines = useCallback(() => {
    setShowOutlines((prev) => {
      const next = !prev;
      postToIframe({ type: 'SET_OUTLINES', enabled: next });
      return next;
    });
  }, [postToIframe]);

  const handleManualSave = useCallback(async () => {
    saveWorkspaceToStorage({
      projectName,
      activeTemplateId,
      files,
      savedAt: Date.now(),
    });
    if (diskHandleRef.current) {
      const res = await writeProjectFilesToDirectory(diskHandleRef.current, files);
      if (!res.ok) {
        showToast(res.error || 'Disk save failed');
        return;
      }
      setAutoSaveStatus((prev) => ({ ...prev, lastSavedAt: Date.now() }));
      showToast(`Saved to ${diskHandleRef.current.name}`);
      return;
    }
    setAutoSaveStatus((prev) => ({ ...prev, lastSavedAt: Date.now() }));
    showToast('Saved');
  }, [projectName, activeTemplateId, files, showToast]);

  const executeShortcutActionRef = useRef<(action: ShortcutAction) => void>(() => {});

  // Listen for messages from sandboxed iframe bridge
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 've-iframe') return;

      if (data.type === 'IFRAME_KEYDOWN') {
        const action = matchShortcutAction(
          {
            key: String(data.key || ''),
            ctrlKey: Boolean(data.ctrlKey),
            metaKey: Boolean(data.metaKey),
            shiftKey: Boolean(data.shiftKey),
            altKey: Boolean(data.altKey),
          },
          {
            editorMode,
            hasSelectedElement: Boolean(selectedElement),
            hasOpenModal: shortcutsModalOpen,
            isTyping: false,
          }
        );
        if (action) {
          executeShortcutActionRef.current(action);
        }
        return;
      }

      if (data.type === 'DOM_TREE_UPDATE' && Array.isArray(data.nodes)) {
        setDomTree(data.nodes as DomTreeNode[]);
        return;
      }

      if (data.type === 'DOM_MOUNTED') {
        postToIframe({ type: 'SET_OUTLINES', enabled: showOutlines });
        return;
      }

      if (data.type === 'NAVIGATE_PAGE' && typeof data.page === 'string') {
        handleSwitchPreviewPage(data.page);
        return;
      }

      if (data.type === 'ELEMENT_SELECTED' && data.element) {
        const nextEl = data.element as SelectedElementInfo;
        selectedOriginalTextRef.current = nextEl.textContent || '';
        setSelectedElement(nextEl);
        setRightPanelTab('inspector');

        if (copiedFormat) {
          const previewPatch: Record<string, string> = {};
          for (const [k, v] of Object.entries(copiedFormat)) {
            if (v) previewPatch[k] = v;
          }
          postToIframe({ type: 'PREVIEW_STYLE', styles: previewPatch });
          if (nextEl.veId && entryHtmlPath) {
            setHistory((prevHistory) => {
              const nextFiles = prevHistory.present.files.map((file) =>
                file.path === entryHtmlPath
                  ? {
                      ...file,
                      content: applyElementPatchToHtml(file.content, nextEl.veId!, {
                        styles: copiedFormat,
                      }),
                    }
                  : file
              );
              return pushHistoryState(prevHistory, nextFiles, 'Apply Format Painter');
            });
          } else if (nextEl.uniqueSelector || nextEl.selectorPath) {
            const sel = nextEl.uniqueSelector || nextEl.selectorPath;
            setHistory((prevHistory) => {
              const nextFiles = applyRuntimeStylePatchToFiles(
                prevHistory.present.files,
                sel,
                copiedFormat
              );
              return pushHistoryState(prevHistory, nextFiles, 'Apply Format Painter');
            });
          }
          setCopiedFormat(null);
          showToast('Applied copied formatting');
        }
        return;
      }

      if (data.type === 'ELEMENT_CLEARED') {
        selectedOriginalTextRef.current = '';
        setSelectedElement(null);
        return;
      }

      if (data.type === 'DROP_TARGET_RESOLVED') {
        dropTargetRef.current = {
          targetVeId: data.targetVeId ?? null,
          placement: data.placement === 'after' ? 'after' : 'inside',
        };
        return;
      }

      if (data.type === 'RECT_UPDATE' && data.element) {
        setSelectedElement((prev) => {
          if (!prev) return data.element as SelectedElementInfo;
          if (
            prev.runtimeId === data.element.runtimeId ||
            (prev.veId && prev.veId === data.element.veId)
          ) {
            return data.element as SelectedElementInfo;
          }
          return prev;
        });
        return;
      }

      if (data.type === 'POSITION_COMMITTED' && data.styles) {
        const updatedEl = data.element as SelectedElementInfo;
        setSelectedElement(updatedEl);
        if (data.veId && entryHtmlPath) {
          setHistory((prevHistory) => {
            const nextFiles = prevHistory.present.files.map((file) =>
              file.path === entryHtmlPath
                ? {
                    ...file,
                    content: applyElementPatchToHtml(file.content, data.veId, {
                      styles: data.styles,
                    }),
                  }
                : file
            );
            return pushHistoryState(prevHistory, nextFiles, 'Move element');
          });
        } else if (updatedEl?.uniqueSelector || updatedEl?.selectorPath) {
          const sel = updatedEl.uniqueSelector || updatedEl.selectorPath;
          setHistory((prevHistory) => {
            const nextFiles = applyRuntimeStylePatchToFiles(
              prevHistory.present.files,
              sel,
              data.styles
            );
            return pushHistoryState(prevHistory, nextFiles, 'Move element');
          });
        }
        return;
      }

      if (data.type === 'TEXT_COMMITTED') {
        const updatedEl = data.element as SelectedElementInfo;
        const prevText =
          typeof data.previousText === 'string'
            ? data.previousText
            : selectedOriginalTextRef.current;
        selectedOriginalTextRef.current = data.textContent || '';
        setSelectedElement(updatedEl);
        if (data.veId && entryHtmlPath) {
          setHistory((prevHistory) => {
            const nextFiles = prevHistory.present.files.map((file) =>
              file.path === entryHtmlPath
                ? {
                    ...file,
                    content: applyElementPatchToHtml(file.content, data.veId, {
                      textContent: data.textContent,
                    }),
                  }
                : file
            );
            return pushHistoryState(prevHistory, nextFiles, 'Edit element text');
          });
        } else if (updatedEl) {
          const sel = updatedEl.uniqueSelector || updatedEl.selectorPath;
          setHistory((prevHistory) => {
            const nextFiles = applyRuntimeTextPatchToFiles(prevHistory.present.files, {
              selector: sel,
              tagName: updatedEl.tagName,
              previousText: prevText,
              nextText: data.textContent,
            });
            return pushHistoryState(prevHistory, nextFiles, 'Edit element text');
          });
        }
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [
    entryHtmlPath,
    handleSwitchPreviewPage,
    copiedFormat,
    postToIframe,
    showToast,
    editorMode,
    selectedElement,
    shortcutsModalOpen,
    showOutlines,
  ]);

  const applyPatchAndSync = useCallback(
    (patch: HtmlElementPatch, label: string, shouldRebuildAfter = false) => {
      if (!selectedElement) return;

      if (!selectedElement.veId || !entryHtmlPath) {
        const sel = selectedElement.uniqueSelector || selectedElement.selectorPath;
        setHistory((prevHistory) => {
          let nextFiles = prevHistory.present.files;
          if (patch.styles && sel) {
            nextFiles = applyRuntimeStylePatchToFiles(nextFiles, sel, patch.styles);
          }
          if (patch.textContent !== undefined) {
            const prevText = selectedOriginalTextRef.current || selectedElement.textContent;
            nextFiles = applyRuntimeTextPatchToFiles(nextFiles, {
              selector: sel,
              tagName: selectedElement.tagName,
              previousText: prevText,
              nextText: patch.textContent,
            });
            selectedOriginalTextRef.current = patch.textContent;
          }
          if (patch.remove && sel) {
            nextFiles = applyRuntimeStylePatchToFiles(nextFiles, sel, { display: 'none' });
          }
          return pushHistoryState(prevHistory, nextFiles, label);
        });
        if (shouldRebuildAfter) {
          postToIframe({ type: 'REMOVE_SELECTED' });
          setSelectedElement(null);
        }
        return;
      }

      const targetVeId = selectedElement.veId;
      let updatedFilesSnapshot: ProjectFile[] | null = null;

      setHistory((prevHistory) => {
        const nextFiles = prevHistory.present.files.map((file) =>
          file.path === entryHtmlPath
            ? {
                ...file,
                content: applyElementPatchToHtml(file.content, targetVeId, patch),
              }
            : file
        );
        updatedFilesSnapshot = nextFiles;
        return pushHistoryState(prevHistory, nextFiles, label);
      });

      if (shouldRebuildAfter && updatedFilesSnapshot) {
        setSelectedElement(null);
        rebuildPreview(updatedFilesSnapshot, editorMode, null, entryHtmlPath);
      }
    },
    [selectedElement, entryHtmlPath, editorMode, rebuildPreview, postToIframe]
  );

  // Base inline style preview & commit
  const handlePreviewStyle = useCallback(
    (styles: Record<string, string>) => {
      postToIframe({ type: 'PREVIEW_STYLE', styles });
    },
    [postToIframe]
  );

  const handleCommitStyle = useCallback(
    (styles: Record<string, string | null>, label: string) => {
      applyPatchAndSync({ styles }, label, false);
    },
    [applyPatchAndSync]
  );

  // Breakpoint-specific responsive CSS commit (Desktop / Tablet / Mobile)
  const handleCommitResponsiveStyle = useCallback(
    (scope: ResponsiveScope, styles: Record<string, string | null>, label: string) => {
      if (!selectedElement?.veId || !entryHtmlPath) {
        showToast('Select a static HTML element to apply responsive rules');
        return;
      }

      const targetVeId = selectedElement.veId;
      const targetCssPath = primaryCssFile ? primaryCssFile.path : 'responsive.css';
      const htmlFile = files.find((f) => f.path === entryHtmlPath);
      if (!htmlFile) return;

      const ensured = ensureElementNodeAttr(
        htmlFile.content,
        targetVeId,
        selectedElement.veNode || undefined
      );
      if (!ensured.nodeId) return;

      const updatedHtml = ensureStylesheetLinkInHtml(ensured.html, targetCssPath);
      const existingCssFile = files.find((f) => f.path === targetCssPath);
      const nextCssContent = upsertResponsiveStylesInCss(
        existingCssFile?.content ?? '',
        ensured.nodeId,
        scope,
        styles
      );

      const nextFiles = files.map((f) =>
        f.path === entryHtmlPath
          ? { ...f, content: updatedHtml }
          : f.path === targetCssPath
            ? { ...f, content: nextCssContent }
            : f
      );

      if (!existingCssFile) {
        nextFiles.push({
          path: targetCssPath,
          name: targetCssPath,
          type: 'css',
          content: nextCssContent,
        });
        nextFiles.sort((a, b) => a.path.localeCompare(b.path));
      }

      setHistory((prevHistory) => pushHistoryState(prevHistory, nextFiles, label));
      postToIframe({ type: 'ASSIGN_VE_NODE', nodeId: ensured.nodeId });
      const managedCss = serializeResponsiveCssStore(parseResponsiveCssStore(nextCssContent));
      postToIframe({ type: 'LIVE_CSS_OVERRIDE', cssText: managedCss });
    },
    [selectedElement, entryHtmlPath, primaryCssFile, files, postToIframe, showToast]
  );

  const handleCommitFormattingStyle = useCallback(
    (styles: Record<string, string | null>, label: string) => {
      if (!selectedElement) {
        showToast('Select an element on the canvas to format');
        return;
      }
      if (responsiveScope === 'all') {
        const previewPatch: Record<string, string> = {};
        for (const [k, v] of Object.entries(styles)) {
          previewPatch[k] = v ?? '';
        }
        handlePreviewStyle(previewPatch);
        handleCommitStyle(styles, label);
      } else {
        handleCommitResponsiveStyle(responsiveScope, styles, `${label} (${responsiveScope})`);
      }
    },
    [
      selectedElement,
      responsiveScope,
      handlePreviewStyle,
      handleCommitStyle,
      handleCommitResponsiveStyle,
      showToast,
    ]
  );

  const handleToggleDeviceVisibility = useCallback(
    (device: 'desktop' | 'tablet' | 'mobile') => {
      if (!selectedElement) return;
      const cssContent = primaryCssFile?.content ?? '';
      const current = getNodeDeviceVisibility(cssContent, selectedElement.veNode);
      const nextVisible = !current[device];
      handleCommitResponsiveStyle(
        device,
        { display: nextVisible ? null : 'none' },
        `${nextVisible ? 'Show' : 'Hide'} on ${device}`
      );
    },
    [selectedElement, primaryCssFile, handleCommitResponsiveStyle]
  );

  const handlePreviewText = useCallback(
    (textContent: string) => {
      postToIframe({ type: 'PREVIEW_TEXT', textContent });
    },
    [postToIframe]
  );

  const handleCommitText = useCallback(
    (textContent: string) => {
      applyPatchAndSync({ textContent }, 'Edit element text', false);
    },
    [applyPatchAndSync]
  );

  const handleCommitAttributes = useCallback(
    (attributes: Record<string, string | null>, label: string) => {
      postToIframe({ type: 'UPDATE_ATTRS', attributes });
      applyPatchAndSync({ attributes }, label, false);
    },
    [postToIframe, applyPatchAndSync]
  );

  const selectedAspectRatioLocked = useMemo(() => {
    if (!selectedElement) return false;
    const key = selectedElement.veId || selectedElement.runtimeId;
    if (key in aspectLocksByKey) {
      return aspectLocksByKey[key];
    }
    if (selectedElement.aspectLockedAttr === 'true') return true;
    if (selectedElement.aspectLockedAttr === 'false') return false;
    return selectedElement.tagName === 'svg' || selectedElement.tagName === 'img';
  }, [selectedElement, aspectLocksByKey]);

  const handleToggleAspectRatioLock = useCallback(
    (locked: boolean) => {
      if (!selectedElement) return;
      const key = selectedElement.veId || selectedElement.runtimeId;
      setAspectLocksByKey((prev) => ({ ...prev, [key]: locked }));
      handleCommitAttributes(
        { 'data-ve-aspect-lock': locked ? 'true' : 'false' },
        locked ? 'Lock aspect ratio' : 'Unlock aspect ratio'
      );
    },
    [selectedElement, handleCommitAttributes]
  );

  const handlePreviewSvgShape = useCallback(
    (patch: SvgShapeHtmlPatch) => {
      postToIframe({ type: 'PREVIEW_SVG_SHAPE', patch });
    },
    [postToIframe]
  );

  const handleCommitSvgShape = useCallback(
    (patch: SvgShapeHtmlPatch, label: string) => {
      if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
      postToIframe({ type: 'PREVIEW_SVG_SHAPE', patch });
      const targetVeId = selectedElement.veId;
      setHistory((prevHistory) => {
        const nextFiles = prevHistory.present.files.map((file) =>
          file.path === entryHtmlPath
            ? {
                ...file,
                content: updateSvgShapeInHtml(file.content, targetVeId, patch),
              }
            : file
        );
        return pushHistoryState(prevHistory, nextFiles, label);
      });
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, postToIframe]
  );

  const handleCreatePageAndLink = useCallback(
    (pageFilename: string) => {
      const cleanPath = pageFilename.replace(/^\/+/, '');
      const titleSlug = cleanPath.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
      const pageTitle = titleSlug.charAt(0).toUpperCase() + titleSlug.slice(1);
      const cssPath = primaryCssFile ? primaryCssFile.path : null;

      let nextFiles = [...files];
      if (!nextFiles.some((f) => f.path === cleanPath)) {
        nextFiles.push({
          path: cleanPath,
          name: cleanPath.split('/').pop() || cleanPath,
          type: 'html',
          content: createPageHtmlTemplate(pageTitle, cssPath),
        });
        nextFiles.sort((a, b) => a.path.localeCompare(b.path));
      }

      if (selectedElement?.veId && entryHtmlPath) {
        const isAnchor = selectedElement.tagName === 'a';
        const attrs: Record<string, string | null> = {
          'data-ve-action': 'page',
          'data-ve-value': cleanPath,
          ...(isAnchor ? { href: cleanPath } : {}),
        };
        postToIframe({ type: 'UPDATE_ATTRS', attributes: attrs });
        nextFiles = nextFiles.map((f) =>
          f.path === entryHtmlPath
            ? {
                ...f,
                content: applyElementPatchToHtml(f.content, selectedElement.veId!, {
                  attributes: attrs,
                }),
              }
            : f
        );
      }

      setHistory((prev) => pushHistoryState(prev, nextFiles, `Create page ${cleanPath}`));
      showToast(`Created & linked ${cleanPath}`);
    },
    [files, primaryCssFile, selectedElement, entryHtmlPath, postToIframe, showToast]
  );

  const handleAddTableRow = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = appendTableRowInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Add table row'));
    rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    showToast('Added table row');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, showToast]);

  const handleRemoveTableRow = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = removeLastTableRowInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Remove table row'));
    rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    showToast('Removed table row');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, showToast]);

  const handleAddTableColumn = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = appendTableColumnInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Add table column'));
    rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    showToast('Added table column');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, showToast]);

  const handleRemoveTableColumn = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = removeLastTableColumnInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Remove table column'));
    rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    showToast('Removed table column');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, showToast]);

  const handleUpdateTableCellStyles = useCallback(
    (cellStyles: Record<string, string | null>, label: string) => {
      if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
      const updatedHtml = updateTableCellsStyleInHtml(
        activeHtmlFile.content,
        selectedElement.veId,
        cellStyles
      );
      if (updatedHtml === activeHtmlFile.content) return;
      const nextFiles = files.map((f) =>
        f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
      );
      setHistory((prev) => pushHistoryState(prev, nextFiles, label));
      rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview]
  );

  const handleToggleTableStriped = useCallback(
    (striped: boolean) => {
      if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
      const updatedHtml = toggleTableStripedRowsInHtml(
        activeHtmlFile.content,
        selectedElement.veId,
        striped
      );
      if (updatedHtml === activeHtmlFile.content) return;
      const nextFiles = files.map((f) =>
        f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
      );
      setHistory((prev) =>
        pushHistoryState(prev, nextFiles, striped ? 'Enable striped rows' : 'Disable striped rows')
      );
      rebuildPreview(nextFiles, editorMode, selectedElement.veId, entryHtmlPath);
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview]
  );

  const handleDuplicateElement = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const dup = duplicateElementInHtml(activeHtmlFile.content, selectedElement.veId);
    if (!dup.duplicatedVeId) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: dup.html } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Duplicate element'));
    rebuildPreview(nextFiles, editorMode, dup.duplicatedVeId, entryHtmlPath);
    showToast('Duplicated element');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, showToast]);

  const handleToggleFormatPainter = useCallback(() => {
    if (copiedFormat) {
      setCopiedFormat(null);
      showToast('Format Painter cancelled');
      return;
    }
    if (!selectedElement) return;
    const snapshot: Record<string, string | null> = {
      'font-family': selectedElement.inlineStyles['font-family'] || selectedElement.styles.fontFamily || null,
      'font-size': selectedElement.inlineStyles['font-size'] || selectedElement.styles.fontSize || null,
      'font-weight': selectedElement.inlineStyles['font-weight'] || selectedElement.styles.fontWeight || null,
      'font-style': selectedElement.inlineStyles['font-style'] || selectedElement.styles.fontStyle || null,
      'text-decoration': selectedElement.inlineStyles['text-decoration'] || null,
      color: selectedElement.inlineStyles.color || selectedElement.styles.color || null,
      'background-color': selectedElement.inlineStyles['background-color'] || null,
      'border-radius': selectedElement.inlineStyles['border-radius'] || null,
      padding: selectedElement.inlineStyles.padding || null,
      'text-align': selectedElement.inlineStyles['text-align'] || null,
    };
    setCopiedFormat(snapshot);
    showToast('Format Painter ready — click any element to apply');
  }, [copiedFormat, selectedElement, showToast]);

  const handleRemoveElement = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.veId && entryHtmlPath) {
      const nextFiles = files.map((file) =>
        file.path === entryHtmlPath
          ? {
              ...file,
              content: applyElementPatchToHtml(file.content, selectedElement.veId!, {
                remove: true,
              }),
            }
          : file
      );
      setHistory((prev) => pushHistoryState(prev, nextFiles, 'Remove element'));
      setSelectedElement(null);
      rebuildPreview(nextFiles, editorMode, null, entryHtmlPath);
      showToast('Element removed');
    } else {
      const sel = selectedElement.uniqueSelector || selectedElement.selectorPath;
      if (sel) {
        setHistory((prev) =>
          pushHistoryState(
            prev,
            applyRuntimeStylePatchToFiles(prev.present.files, sel, { display: 'none' }),
            'Remove element'
          )
        );
      }
      postToIframe({ type: 'REMOVE_SELECTED' });
      setSelectedElement(null);
      showToast('Element removed');
    }
  }, [selectedElement, entryHtmlPath, files, editorMode, rebuildPreview, postToIframe, showToast]);

  const handleToggleVisibility = useCallback(() => {
    if (!selectedElement) return;
    const nextHidden = !selectedElement.isHidden;
    const nextDisplay = nextHidden ? 'none' : '';
    postToIframe({ type: 'PREVIEW_STYLE', styles: { display: nextDisplay } });
    applyPatchAndSync(
      { styles: { display: nextHidden ? 'none' : null } },
      nextHidden ? 'Hide element' : 'Show element',
      false
    );
  }, [selectedElement, postToIframe, applyPatchAndSync]);

  // SEO & Meta commit
  const handleCommitSeoMeta = useCallback(
    (patch: Partial<SeoMetaValues>, label: string) => {
      if (!entryHtmlPath) return;
      setHistory((prev) => {
        const nextFiles = prev.present.files.map((file) =>
          file.path === entryHtmlPath
            ? { ...file, content: updateHeadSeoMeta(file.content, patch) }
            : file
        );
        return pushHistoryState(prev, nextFiles, label);
      });
    },
    [entryHtmlPath]
  );

  // Global Styles (:root CSS Variables) preview, commit & delete
  const handlePreviewRootVar = useCallback(
    (name: string, value: string) => {
      postToIframe({ type: 'UPDATE_ROOT_VAR', name, value });
    },
    [postToIframe]
  );

  const handleCommitRootVar = useCallback(
    (name: string, value: string, label: string) => {
      const targetCssPath = primaryCssFile ? primaryCssFile.path : 'styles.css';
      const existingCssFile = files.find((f) => f.path === targetCssPath);
      const nextCssContent = updateRootCssVariable(existingCssFile?.content ?? '', name, value);

      let nextFiles = files.map((f) =>
        f.path === targetCssPath ? { ...f, content: nextCssContent } : f
      );
      if (!existingCssFile) {
        nextFiles.push({
          path: targetCssPath,
          name: targetCssPath,
          type: 'css',
          content: nextCssContent,
        });
        if (entryHtmlPath) {
          nextFiles = nextFiles.map((f) =>
            f.path === entryHtmlPath
              ? { ...f, content: ensureStylesheetLinkInHtml(f.content, targetCssPath) }
              : f
          );
        }
        nextFiles.sort((a, b) => a.path.localeCompare(b.path));
      }

      setHistory((prev) => pushHistoryState(prev, nextFiles, label));
    },
    [primaryCssFile, files, entryHtmlPath]
  );

  const handleDeleteRootVar = useCallback(
    (name: string) => {
      if (!primaryCssFile) return;
      const nextCss = deleteRootCssVariable(primaryCssFile.content, name);
      const nextFiles = files.map((f) =>
        f.path === primaryCssFile.path ? { ...f, content: nextCss } : f
      );
      setHistory((prev) => pushHistoryState(prev, nextFiles, `Delete ${name}`));
      postToIframe({ type: 'UPDATE_ROOT_VAR', name, value: '' });
      showToast(`Removed ${name}`);
    },
    [primaryCssFile, files, postToIframe, showToast]
  );

  // Drag-and-Drop or Click-to-Insert component from Elements tab or Ribbon
  const insertComponentIntoHtml = useCallback(
    (
      component: DraggableComponentDef,
      targetVeId: string | null,
      placement: 'inside' | 'after'
    ) => {
      if (!entryHtmlPath) {
        showToast('No HTML entry file to insert element into');
        return;
      }

      const htmlFile = files.find((f) => f.path === entryHtmlPath);
      if (!htmlFile) return;

      const inserted = insertHtmlSnippet(htmlFile.content, targetVeId, placement, component.html);
      const nextFiles = files.map((file) =>
        file.path === entryHtmlPath ? { ...file, content: inserted.html } : file
      );

      setHistory((prev) => pushHistoryState(prev, nextFiles, `Insert ${component.name}`));
      setCenterTab('preview');
      if (editorMode !== 'edit') {
        setEditorMode('edit');
      }
      rebuildPreview(nextFiles, 'edit', inserted.insertedVeId, entryHtmlPath);
      showToast(`Inserted ${component.name}`);
    },
    [entryHtmlPath, files, editorMode, rebuildPreview, showToast]
  );

  const handleDropComponentOnCanvas = useCallback(
    (component: DraggableComponentDef) => {
      setDraggingComponent(null);
      const { targetVeId, placement } = dropTargetRef.current;
      insertComponentIntoHtml(component, targetVeId, placement);
      setRightPanelTab('inspector');
    },
    [insertComponentIntoHtml]
  );

  const handleInsertComponentButton = useCallback(
    (component: DraggableComponentDef) => {
      const targetVeId = selectedElement?.veId ?? null;
      const placement =
        selectedElement && CONTAINER_TAGS.has(selectedElement.tagName) ? 'inside' : 'after';
      insertComponentIntoHtml(component, targetVeId, targetVeId ? placement : 'inside');
    },
    [selectedElement, insertComponentIntoHtml]
  );

  const handleQuickInsertById = useCallback(
    (componentId: string) => {
      const comp = DRAGGABLE_COMPONENTS.find((c) => c.id === componentId);
      if (!comp) return;
      handleInsertComponentButton(comp);
    },
    [handleInsertComponentButton]
  );

  const handleInsertCustomHtml = useCallback(
    (snippet: string, label: string) => {
      const targetVeId = selectedElement?.veId ?? null;
      const placement =
        selectedElement && CONTAINER_TAGS.has(selectedElement.tagName) ? 'inside' : 'after';
      insertComponentIntoHtml(
        {
          id: `custom-${Date.now()}`,
          name: label,
          category: 'Components',
          description: label,
          html: snippet,
        },
        targetVeId,
        targetVeId ? placement : 'inside'
      );
    },
    [selectedElement, insertComponentIntoHtml]
  );

  const handleInsertSymbol = useCallback(
    (symbol: string) => {
      if (selectedElement?.isTextEditable && selectedElement.veId) {
        const nextText = `${selectedElement.textContent}${symbol}`;
        handlePreviewText(nextText);
        handleCommitText(nextText);
        showToast(`Inserted symbol ${symbol}`);
        return;
      }
      handleInsertCustomHtml(
        `<span style="display: inline-block; font-size: 18px; padding: 2px 4px;">${symbol}</span>`,
        `Symbol ${symbol}`
      );
    },
    [selectedElement, handlePreviewText, handleCommitText, handleInsertCustomHtml, showToast]
  );

  const handleFindAndReplace = useCallback(
    (findText: string, replaceText: string, matchCase: boolean) => {
      if (!entryHtmlPath || !activeHtmlFile || !findText) return 0;
      const res = replaceTextInHtmlBody(activeHtmlFile.content, findText, replaceText, matchCase);
      if (res.count === 0) {
        showToast(`No matches for "${findText}"`);
        return 0;
      }
      const nextFiles = files.map((f) =>
        f.path === entryHtmlPath ? { ...f, content: res.html } : f
      );
      setHistory((prev) => pushHistoryState(prev, nextFiles, `Replace "${findText}"`));
      rebuildPreview(nextFiles, editorMode, selectedElement?.veId ?? null, entryHtmlPath);
      showToast(`Replaced ${res.count} occurrence${res.count === 1 ? '' : 's'}`);
      return res.count;
    },
    [entryHtmlPath, activeHtmlFile, files, editorMode, selectedElement?.veId, rebuildPreview, showToast]
  );

  // Grant read/write folder permission via File System Access API
  const handleConnectDiskFolder = useCallback(async () => {
    const result = await requestWritableDirectoryHandle();
    if (result.handle) {
      diskHandleRef.current = result.handle;
      const writeRes = await writeProjectFilesToDirectory(result.handle, files);
      setAutoSaveStatus((prev) => ({
        ...prev,
        enabled: true,
        diskConnected: true,
        diskFolderName: result.handle!.name,
        permissionState: 'granted',
        lastSavedAt: Date.now(),
      }));
      showToast(
        writeRes.ok
          ? `Connected & saved to "${result.handle.name}"`
          : `Connected "${result.handle.name}" (${writeRes.error})`
      );
    } else {
      setAutoSaveStatus((prev) => ({
        ...prev,
        permissionState: result.permission,
      }));
      if (result.errorMessage) {
        showToast(result.errorMessage);
      }
    }
  }, [files, showToast]);

  const handleSelectParent = useCallback(() => {
    if (!selectedElement) return;
    postToIframe({ type: 'SELECT_PARENT' });
  }, [selectedElement, postToIframe]);

  const handleMoveElementSibling = useCallback(
    (direction: 'up' | 'down') => {
      if (!selectedElement) return;
      if (selectedElement.veId && entryHtmlPath && activeHtmlFile) {
        const res = moveElementSiblingInHtml(
          activeHtmlFile.content,
          selectedElement.veId,
          direction
        );
        if (!res.moved) {
          showToast(
            direction === 'up' ? 'Already first among siblings' : 'Already last among siblings'
          );
          return;
        }
        const nextFiles = files.map((f) =>
          f.path === entryHtmlPath ? { ...f, content: res.html } : f
        );
        setHistory((prev) =>
          pushHistoryState(prev, nextFiles, direction === 'up' ? 'Move element up' : 'Move element down')
        );
        rebuildPreview(nextFiles, editorMode, res.nextVeId ?? selectedElement.veId, entryHtmlPath);
        showToast(direction === 'up' ? 'Moved element up' : 'Moved element down');
        return;
      }
      postToIframe({ type: 'MOVE_SIBLING', direction });
      showToast(direction === 'up' ? 'Moved element up' : 'Moved element down');
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, editorMode, rebuildPreview, postToIframe, showToast]
  );

  const handleViewSelectedInCode = useCallback(() => {
    if (!selectedElement) return;
    const match = findElementSourceLocation(files, entryHtmlPath, selectedElement);
    if (match) {
      setActiveFilePath(match.path);
      setCenterTab('code');
      setJumpToLine({
        path: match.path,
        line: match.line,
        endLine: match.endLine,
        token: Date.now(),
      });
      showToast(`Viewing <${selectedElement.tagName}> in ${match.path}:${match.line}`);
      return;
    }
    const fallbackPath = entryHtmlPath || activeFilePath || files[0]?.path || null;
    if (fallbackPath) {
      setActiveFilePath(fallbackPath);
      setCenterTab('code');
      showToast(`Opened ${fallbackPath}`);
    }
  }, [selectedElement, files, entryHtmlPath, activeFilePath, showToast]);

  const handleQuickInsertKind = useCallback(
    (kind: QuickInsertKind) => {
      const result = insertQuickComponentInProject(files, entryHtmlPath, kind, selectedElement);
      if (!result.targetPath) {
        showToast('No editable target file found');
        return;
      }
      setHistory((prev) => pushHistoryState(prev, result.files, `Insert ${kind}`));
      setCenterTab('preview');
      if (editorMode !== 'edit') {
        setEditorMode('edit');
      }
      rebuildPreview(result.files, 'edit', result.insertedVeId, entryHtmlPath);
      showToast(`Inserted ${kind} into ${result.targetPath}`);
    },
    [files, entryHtmlPath, selectedElement, editorMode, rebuildPreview, showToast]
  );

  // Undo & Redo
  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const nextState = undoHistoryState(history);
    setHistory(nextState);
    const keepVeId = selectedElement?.veId ?? null;
    setSelectedElement(null);
    rebuildPreview(nextState.present.files, editorMode, keepVeId);
    showToast(`Undid: ${history.present.label}`);
  }, [history, selectedElement, editorMode, rebuildPreview, showToast]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const nextState = redoHistoryState(history);
    setHistory(nextState);
    const keepVeId = selectedElement?.veId ?? null;
    setSelectedElement(null);
    rebuildPreview(nextState.present.files, editorMode, keepVeId);
    showToast(`Redid: ${nextState.present.label}`);
  }, [history, selectedElement, editorMode, rebuildPreview, showToast]);

  const executeShortcutAction = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case 'undo':
          handleUndo();
          break;
        case 'redo':
          handleRedo();
          break;
        case 'save':
          void handleManualSave();
          break;
        case 'toggle-mode':
          handleChangeMode(editorMode === 'edit' ? 'interact' : 'edit');
          break;
        case 'toggle-left-sidebar':
          setLeftSidebarCollapsed((prev) => !prev);
          window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
          break;
        case 'toggle-right-sidebar':
          setRightSidebarCollapsed((prev) => !prev);
          window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
          break;
        case 'duplicate':
          if (editorMode === 'edit' && selectedElement) handleDuplicateElement();
          break;
        case 'delete':
          if (editorMode === 'edit' && selectedElement) handleRemoveElement();
          break;
        case 'move-up':
          if (editorMode === 'edit' && selectedElement) handleMoveElementSibling('up');
          break;
        case 'move-down':
          if (editorMode === 'edit' && selectedElement) handleMoveElementSibling('down');
          break;
        case 'viewport-desktop':
          handleChangeViewport('desktop');
          break;
        case 'viewport-tablet':
          handleChangeViewport('tablet');
          break;
        case 'viewport-mobile':
          handleChangeViewport('mobile');
          break;
        case 'open-shortcuts':
          setShortcutsModalOpen((prev) => !prev);
          break;
        case 'escape':
          if (shortcutsModalOpen) {
            setShortcutsModalOpen(false);
          } else if (selectedElement) {
            setCopiedFormat(null);
            postToIframe({ type: 'SELECT_VE_ID', veId: null });
            setSelectedElement(null);
          }
          break;
      }
    },
    [
      handleUndo,
      handleRedo,
      handleManualSave,
      handleChangeMode,
      editorMode,
      selectedElement,
      handleDuplicateElement,
      handleRemoveElement,
      handleMoveElementSibling,
      handleChangeViewport,
      shortcutsModalOpen,
      postToIframe,
    ]
  );

  executeShortcutActionRef.current = executeShortcutAction;

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const action = matchShortcutAction(
        {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        },
        {
          editorMode,
          hasSelectedElement: Boolean(selectedElement),
          hasOpenModal: shortcutsModalOpen,
          isTyping: isShortcutTypingTarget(e.target),
        }
      );
      if (!action) return;
      e.preventDefault();
      executeShortcutAction(action);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorMode, selectedElement, shortcutsModalOpen, executeShortcutAction]);

  const handleLoadTemplate = useCallback(
    (templateId: string) => {
      const tpl = SAMPLE_TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const cloned = cloneProjectFiles(tpl.files);
      const nextEntry = findEntryHtmlPath(cloned);
      setInitialFiles(cloneProjectFiles(tpl.files));
      setHistory(createHistoryState(cloned, `Loaded ${tpl.name}`));
      setProjectName(tpl.name);
      setActiveTemplateId(tpl.id);
      setActiveFilePath(nextEntry ?? cloned[0]?.path ?? null);
      setActivePreviewHtmlPath(nextEntry);
      setSelectedElement(null);
      setCenterTab('preview');
      codeDirtyRef.current = false;
      rebuildPreview(cloned, editorMode, null, nextEntry);
      showToast(`Loaded ${tpl.name}`);
    },
    [editorMode, rebuildPreview, showToast]
  );

  const handleResetProject = useCallback(() => {
    const cloned = cloneProjectFiles(initialFiles);
    const nextEntry = findEntryHtmlPath(cloned);
    clearWorkspaceStorage();
    setHistory(createHistoryState(cloned, 'Reset project'));
    setActivePreviewHtmlPath(nextEntry);
    setSelectedElement(null);
    codeDirtyRef.current = false;
    rebuildPreview(cloned, editorMode, null, nextEntry);
    showToast('Project reset to original state');
  }, [initialFiles, editorMode, rebuildPreview, showToast]);

  const handleUploadFiles = useCallback(
    async (fileList: FileList) => {
      const binaryExtensions = new Set([
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'avif',
        'ico',
        'woff',
        'woff2',
        'ttf',
        'eot',
        'otf',
        'apk',
        'aab',
        'jar',
        'keystore',
        'jks',
        'mp4',
        'webm',
        'mp3',
        'wav',
        'pdf',
        'zip',
      ]);

      const readAsDataUrl = (file: File): Promise<string> =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(reader.error || new Error('Failed to read binary file'));
          reader.readAsDataURL(file);
        });

      const rawEntries: Array<{ path: string; name: string; content: string }> = [];

      for (const file of Array.from(fileList)) {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        if (shouldIgnoreUploadPath(rel)) continue;
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
        const content = binaryExtensions.has(ext)
          ? await readAsDataUrl(file)
          : await file.text();
        rawEntries.push({ path: rel, name: file.name, content });
      }

      if (rawEntries.length === 0) {
        showToast('No supported files found in selection');
        return;
      }

      const normalized = normalizeUploadedFiles(rawEntries);
      const nextEntry = findEntryHtmlPath(normalized);
      const detectedTitle = detectProjectTitleFromUpload(rawEntries, normalized);
      setInitialFiles(cloneProjectFiles(normalized));
      setHistory(createHistoryState(normalized, 'Loaded custom project'));
      setProjectName(detectedTitle || 'Custom Project');
      setActiveTemplateId(null);
      setActiveFilePath(nextEntry ?? normalized[0]?.path ?? null);
      setActivePreviewHtmlPath(nextEntry);
      setSelectedElement(null);
      setCenterTab('preview');
      codeDirtyRef.current = false;
      rebuildPreview(normalized, editorMode, null, nextEntry);
      if (!nextEntry) {
        showToast(`Loaded ${normalized.length} files (no HTML entry found)`);
      } else if (needsModuleBundling(normalized, nextEntry)) {
        showToast(`Loaded & running ${normalized.length} files (${nextEntry})`);
      } else {
        showToast(`Loaded ${normalized.length} files (${nextEntry})`);
      }
    },
    [editorMode, rebuildPreview, showToast]
  );

  const handleCreateFile = useCallback(
    (filename: string) => {
      const cleanPath = filename.replace(/^\/+/, '');
      if (files.some((f) => f.path === cleanPath)) {
        setActiveFilePath(cleanPath);
        setCenterTab('code');
        return;
      }
      const type = detectFileType(cleanPath);
      const newFile: ProjectFile = {
        path: cleanPath,
        name: cleanPath.split('/').pop() || cleanPath,
        type,
        content:
          type === 'html'
            ? createPageHtmlTemplate(
                cleanPath.replace(/\.html?$/i, ''),
                primaryCssFile?.path ?? null
              )
            : '',
      };
      const nextFiles = [...files, newFile].sort((a, b) => a.path.localeCompare(b.path));
      setHistory((prev) => pushHistoryState(prev, nextFiles, `Create ${cleanPath}`));
      setActiveFilePath(cleanPath);
      setCenterTab('code');
      codeDirtyRef.current = true;
    },
    [files, primaryCssFile]
  );

  const handleUpdateCodeContent = useCallback((path: string, nextContent: string) => {
    codeDirtyRef.current = true;
    setHistory((prev) => {
      const nextFiles = prev.present.files.map((file) =>
        file.path === path ? { ...file, content: nextContent } : file
      );
      return pushHistoryState(prev, nextFiles, `Edit ${path}`);
    });
  }, []);

  const handleChangeCenterTab = useCallback(
    (tab: CenterTab) => {
      setCenterTab(tab);
      if (tab === 'preview' && codeDirtyRef.current) {
        codeDirtyRef.current = false;
        setSelectedElement(null);
        rebuildPreview(files, editorMode, null);
      }
    },
    [files, editorMode, rebuildPreview]
  );

  const handleExportZip = useCallback(async () => {
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project';
    await exportProjectAsZip(files, `${slug}.zip`);
    showToast(`Exported ${slug}.zip`);
  }, [files, projectName, showToast]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activeFilePath) ?? null,
    [files, activeFilePath]
  );

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#09090b] text-[#e4e4e7]">
      <TopToolbar
        projectName={projectName}
        editorMode={editorMode}
        onChangeMode={handleChangeMode}
        viewport={viewport}
        onChangeViewport={handleChangeViewport}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSaveProject={() => void handleManualSave()}
        onResetProject={handleResetProject}
        onExportZip={handleExportZip}
        onUploadFiles={handleUploadFiles}
        autoSaveStatus={autoSaveStatus}
        onConnectDiskFolder={handleConnectDiskFolder}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
      />

      <div className="flex-1 min-h-0 flex relative">
        {/* Transparent drag shield over iframe while resizing split panes */}
        {splitDrag && <div className="fixed inset-0 z-40 cursor-col-resize select-none" />}

        {leftSidebarCollapsed ? (
          <div className="w-9 shrink-0 border-r border-white/[0.08] bg-[#111114] flex flex-col items-center py-2.5">
            <button
              type="button"
              onClick={() => {
                setLeftSidebarCollapsed(false);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              aria-label="Expand Project Files sidebar"
              title="Expand Project Files (Ctrl+B)"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <>
            <FileExplorer
              widthPx={leftSidebarWidth}
              onCollapse={() => {
                setLeftSidebarCollapsed(true);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              files={files}
              activeFilePath={activeFilePath}
              entryHtmlPath={entryHtmlPath}
              templates={SAMPLE_TEMPLATES}
              activeTemplateId={activeTemplateId}
              onSelectFile={(path) => {
                setActiveFilePath(path);
                const targetFile = files.find((f) => f.path === path);
                if (targetFile?.type === 'html' && centerTab === 'preview') {
                  handleSwitchPreviewPage(path);
                }
              }}
              onOpenCodeEditor={(path, lineNumber) => {
                setActiveFilePath(path);
                setCenterTab('code');
                if (lineNumber) {
                  setJumpToLine({ path, line: lineNumber, token: Date.now() });
                }
              }}
              onDownloadFile={(file) => {
                exportSingleFile(file);
                showToast(`Downloaded ${file.name}`);
              }}
              onCreateFile={handleCreateFile}
              onLoadTemplate={handleLoadTemplate}
            />
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Project Files panel"
              data-testid="left-split-divider"
              onPointerDown={(e) => {
                e.preventDefault();
                setSplitDrag('left');
              }}
              onDoubleClick={() => {
                setLeftSidebarWidth(256);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              style={{ cursor: 'col-resize' }}
              title="Drag to resize · Double-click to reset"
              className="w-1 shrink-0 bg-transparent hover:bg-indigo-500/70 transition-colors z-50"
            />
          </>
        )}

        <CanvasWorkspace
          centerTab={centerTab}
          onChangeCenterTab={handleChangeCenterTab}
          editorMode={editorMode}
          defaultStartupMode={defaultStartupMode}
          onToggleDefaultStartupMode={handleToggleDefaultStartupMode}
          autoSaveStatus={autoSaveStatus}
          onToggleAutoSave={() =>
            setAutoSaveStatus((prev) => ({ ...prev, enabled: !prev.enabled }))
          }
          viewport={viewport}
          canvasWidthPx={canvasWidthPx}
          canvasHeightPx={canvasHeightPx}
          onResizeCanvasFrame={handleResizeCanvasFrame}
          canvasZoom={canvasZoom}
          onChangeCanvasZoom={setCanvasZoom}
          showOutlines={showOutlines}
          onToggleOutlines={handleToggleOutlines}
          activeSpacingOverlay={activeSpacingOverlay}
          srcDoc={renderedSrcDoc}
          previewKey={previewKey}
          entryHtmlPath={entryHtmlPath}
          htmlPages={htmlPages}
          onSwitchPreviewPage={handleSwitchPreviewPage}
          activeFile={activeFile}
          jumpToLine={jumpToLine}
          selectedElement={selectedElement}
          aspectRatioLocked={selectedAspectRatioLocked}
          draggingComponent={draggingComponent}
          formatPainterActive={Boolean(copiedFormat)}
          onToggleFormatPainter={handleToggleFormatPainter}
          iframeRef={iframeRef}
          onRefreshPreview={() =>
            rebuildPreview(files, editorMode, selectedElement?.veId ?? null, entryHtmlPath)
          }
          onPreviewResizeStyle={handlePreviewStyle}
          onCommitResizeStyle={handleCommitFormattingStyle}
          onCommitFormattingStyle={handleCommitFormattingStyle}
          onQuickInsertById={handleQuickInsertById}
          onQuickInsertKind={handleQuickInsertKind}
          onInsertCustomHtml={handleInsertCustomHtml}
          onInsertSymbol={handleInsertSymbol}
          onFindAndReplace={handleFindAndReplace}
          onDuplicateSelected={handleDuplicateElement}
          onSelectParent={handleSelectParent}
          onMoveSibling={handleMoveElementSibling}
          onRemoveSelected={handleRemoveElement}
          onViewSelectedInCode={handleViewSelectedInCode}
          onUpdateCodeContent={handleUpdateCodeContent}
          onPostIframeMessage={postToIframe}
          onDropComponentOnCanvas={handleDropComponentOnCanvas}
        />

        {rightSidebarCollapsed ? (
          <div className="w-9 shrink-0 border-l border-white/[0.08] bg-[#111114] flex flex-col items-center py-2.5">
            <button
              type="button"
              onClick={() => {
                setRightSidebarCollapsed(false);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              aria-label="Expand Inspector sidebar"
              title="Expand Inspector (Ctrl+I)"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
            >
              <PanelRightOpen className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize Inspector panel"
              data-testid="right-split-divider"
              onPointerDown={(e) => {
                e.preventDefault();
                setSplitDrag('right');
              }}
              onDoubleClick={() => {
                setRightSidebarWidth(380);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              style={{ cursor: 'col-resize' }}
              title="Drag to resize · Double-click to reset"
              className="w-1 shrink-0 bg-transparent hover:bg-indigo-500/70 transition-colors z-50"
            />
            <RightStudioPanel
              widthPx={rightSidebarWidth}
              onCollapse={() => {
                setRightSidebarCollapsed(true);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              activeTab={rightPanelTab}
              onChangeTab={setRightPanelTab}
              selectedElement={selectedElement}
              domTree={domTree}
              onSelectDomNode={(nodeId) => {
                if (editorMode !== 'edit') {
                  handleChangeMode('edit');
                }
                if (centerTab !== 'preview') {
                  setCenterTab('preview');
                }
                postToIframe({ type: 'SELECT_NODE_ID', nodeId });
              }}
              onHoverDomNode={(nodeId) => {
                postToIframe({ type: 'HOVER_NODE_ID', nodeId });
              }}
              onViewInCode={handleViewSelectedInCode}
              onHoverSpacing={setActiveSpacingOverlay}
              aspectRatioLocked={selectedAspectRatioLocked}
              onToggleAspectRatioLock={handleToggleAspectRatioLock}
              responsiveScope={responsiveScope}
              onChangeResponsiveScope={setResponsiveScope}
              activeHtmlPath={entryHtmlPath}
              activeHtmlContent={activeHtmlFile?.content ?? ''}
              htmlPages={htmlPages}
              primaryCssPath={primaryCssFile?.path ?? null}
              stylesCssContent={primaryCssFile?.content ?? ''}
              onPreviewStyle={handlePreviewStyle}
              onCommitStyle={handleCommitStyle}
              onCommitResponsiveStyle={handleCommitResponsiveStyle}
              onToggleDeviceVisibility={handleToggleDeviceVisibility}
              onPreviewText={handlePreviewText}
              onCommitText={handleCommitText}
              onCommitAttributes={handleCommitAttributes}
              onPreviewSvgShape={handlePreviewSvgShape}
              onCommitSvgShape={handleCommitSvgShape}
              onCreatePageAndLink={handleCreatePageAndLink}
              onAddTableRow={handleAddTableRow}
              onRemoveTableRow={handleRemoveTableRow}
              onAddTableColumn={handleAddTableColumn}
              onRemoveTableColumn={handleRemoveTableColumn}
              onUpdateTableCellStyles={handleUpdateTableCellStyles}
              onToggleTableStriped={handleToggleTableStriped}
              onDuplicateElement={handleDuplicateElement}
              onRemoveElement={handleRemoveElement}
              onToggleVisibility={handleToggleVisibility}
              onDragStartComponent={(component) => {
                setDraggingComponent(component);
                if (centerTab !== 'preview') {
                  setCenterTab('preview');
                }
              }}
              onDragEndComponent={() => {
                setDraggingComponent(null);
                postToIframe({ type: 'CLEAR_DROP_TARGET' });
              }}
              onInsertComponent={handleInsertComponentButton}
              onCommitSeoMeta={handleCommitSeoMeta}
              onPreviewRootVar={handlePreviewRootVar}
              onCommitRootVar={handleCommitRootVar}
              onDeleteRootVar={handleDeleteRootVar}
            />
          </>
        )}
      </div>

      <ShortcutsModal open={shortcutsModalOpen} onClose={() => setShortcutsModalOpen(false)} />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-3.5 py-2 rounded-xl bg-[#18181b] border border-white/[0.1] studio-card-highlight text-[12px] font-medium text-zinc-100 shadow-2xl shadow-black/70 pointer-events-none"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Blocks, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import type { AiElementCopilotControls } from './components/AiElementBar';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { ComponentLibraryDrawer } from './components/ComponentLibraryDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FileExplorer } from './components/FileExplorer';
import { GlobalFindReplaceModal } from './components/GlobalFindReplaceModal';
import { ProjectStatsModal } from './components/ProjectStatsModal';
import { RightStudioPanel } from './components/RightStudioPanel';
import { ShortcutsModal } from './components/ShortcutsModal';
import { StartHub } from './components/StartHub';
import { TopToolbar } from './components/TopToolbar';
import type {
  ArtboardId,
  AutoSaveStatus,
  BreakpointScope,
  CanvasZoomMode,
  CenterTab,
  DomTreeNode,
  DraggableComponentDef,
  EditorMode,
  HtmlElementPatch,
  LayoutIssue,
  ProjectFile,
  QuickInsertKind,
  ResponsiveScope,
  RightPanelTab,
  SelectedElementInfo,
  SeoMetaValues,
  StudioThemeId,
  ViewportPreset,
} from './types/editor';
import {
  commitAiElementPatchWithHistory,
  extractDesignTokensMap,
  extractElementSourceSlice,
} from './utils/aiElementSync';
import { useActionLock } from './utils/asyncLock';
import { findElementSourceLocation, insertQuickComponentInProject } from './utils/codeSync';
import { DRAGGABLE_COMPONENTS } from './utils/componentCatalog';
import { deleteRootCssVariable, updateRootCssVariable } from './utils/cssVariables';
import { FETCH_TIMEOUT_MS, describeFetchError, fetchWithTimeout } from './utils/fetchWithTimeout';
import {
  exportPngSnapshot,
  exportProjectAsJson,
  exportProjectAsZip,
  exportSingleFile,
  exportSvgSnapshot,
  extractBodyAndStylesFromHtml,
} from './utils/exportProject';
import {
  clearWorkspaceStorage,
  type FileSystemDirectoryHandleLike,
  loadDefaultModePreference,
  loadStudioThemePreference,
  loadWorkspaceFromStorage,
  requestWritableDirectoryHandle,
  saveDefaultModePreference,
  saveStudioThemePreference,
  saveWorkspaceToStorage,
  writeProjectFilesToDirectory,
} from './utils/fileSystemSync';
import {
  buildGoogleFontsHref,
  collectUsedGoogleFonts,
  ensureGoogleFontInHtml,
} from './utils/fontLibrary';
import {
  type FindReplaceScopeFilter,
  replaceAcrossProjectFiles,
} from './utils/globalFindReplace';
import {
  computeFilesFingerprint,
  type GitHubAuthStatusResponse,
  type GitHubBranchesResponse,
  type GitHubConnectionConfig,
  type GitHubReposResponse,
  type GitHubRepoSummary,
  type GitHubUserProfile,
  mergeUpstreamFilesWithWorkspace,
} from './utils/githubSync';
import {
  cloneProjectFiles,
  createHistoryState,
  jumpToHistoryIndex,
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
  extractElementHtmlByVeId,
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
  extractHotPatchPayload,
  findEntryHtmlPath,
  isImageAssetPath,
  needsModuleBundling,
  normalizeUploadedFiles,
  shouldIgnoreUploadPath,
  toSvgDataUrl,
} from './utils/projectBundler';
import {
  applyRuntimeAttrPatchToFiles,
  applyRuntimeStylePatchToFiles,
  applyRuntimeTextPatchToFiles,
  getRuntimeDeviceVisibilityFromCss,
} from './utils/reactVisualSync';
import {
  breakpointRangeToLabel,
  breakpointScopeToRange,
  extractManagedSection,
  getNodeDeviceVisibility,
  normalizeBreakpointScope,
  presetScopeFromRange,
  rangeForPresetScope,
  removeScopedDeclarations,
  upsertScopedStylesInCss,
} from './utils/responsiveCss';
import { SAMPLE_TEMPLATES } from './utils/sampleTemplates';
import {
  getDefaultRepoTarget,
  getRepoTargetById,
  isPathInTarget,
  resolveRepoTargetEntryPath,
  scanRepoTargets,
  targetPreviewPlatform,
  type RepoTarget,
  type RepoScanResult,
} from './utils/repoTargets';
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

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generatePkceCodeVerifier(): string {
  const randomBytes = new Uint8Array(48);
  window.crypto.getRandomValues(randomBytes);
  return encodeBase64Url(randomBytes);
}

async function computePkceCodeChallengeS256(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return encodeBase64Url(new Uint8Array(digest));
}

function resolveOriginFromUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  try {
    return new URL(rawUrl).origin;
  } catch {
    return '';
  }
}

export default function App() {
  return (
    <ErrorBoundary label="Framecraft editor" variant="root">
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
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
  // Multi-target workspace (Web / Desktop .exe / Mobile .apk) detection for imports
  const [repoScan, setRepoScan] = useState<RepoScanResult>(() => scanRepoTargets(startingFiles));
  const [activeRepoTargetId, setActiveRepoTargetId] = useState<string | null>(
    () => getDefaultRepoTarget(scanRepoTargets(startingFiles).targets)?.id ?? null
  );
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(startingTemplateId);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(
    () => findEntryHtmlPath(startingFiles) ?? startingFiles[0]?.path ?? null
  );
  const [activePreviewHtmlPath, setActivePreviewHtmlPath] = useState<string | null>(
    () => findEntryHtmlPath(startingFiles)
  );

  const [studioTheme, setStudioTheme] = useState<StudioThemeId>(() => loadStudioThemePreference());
  const [defaultStartupMode, setDefaultStartupMode] = useState<EditorMode>(initialStartupMode);
  const [editorMode, setEditorMode] = useState<EditorMode>(initialStartupMode);
  const [viewport, setViewport] = useState<ViewportPreset>('desktop');
  const [activeArtboard, setActiveArtboard] = useState<ArtboardId>('desktop');
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
  const [breakpointScopeOverride, setBreakpointScopeOverride] = useState<BreakpointScope | null>(
    null
  );
  const [overlapXray, setOverlapXray] = useState(false);
  const [layoutIssues, setLayoutIssues] = useState<LayoutIssue[]>([]);
  const [canvasHeightPx, setCanvasHeightPx] = useState<number | null>(null);
  const [canvasZoom, setCanvasZoom] = useState<CanvasZoomMode>('100');
  const [showOutlines, setShowOutlines] = useState(false);
  const [domTree, setDomTree] = useState<DomTreeNode[]>([]);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [globalFindReplaceOpen, setGlobalFindReplaceOpen] = useState(false);
  const [componentLibraryOpen, setComponentLibraryOpen] = useState(false);
  const [showStartHub, setShowStartHub] = useState<boolean>(() => {
    try {
      return new URLSearchParams(window.location.search).get('autostart') !== '1';
    } catch {
      return true;
    }
  });
  const [activeSpacingOverlay, setActiveSpacingOverlay] = useState<'margin' | 'padding' | null>(
    null
  );

  // Element-targeted AI Co-Pilot state
  const [aiPromptDraft, setAiPromptDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const { begin: beginAction, end: endAction } = useActionLock();
  const preserveNextAiExplanationRef = useRef(false);

  // GitHub Sync & OAuth state (tokens kept strictly in component state memory, never persisted)
  const [githubOpen, setGithubOpen] = useState(false);
  const [githubCommitModalOpen, setGithubCommitModalOpen] = useState(false);
  const [githubConnection, setGithubConnection] = useState<GitHubConnectionConfig>({
    repoUrl: '',
    repoFullName: '',
    branch: 'main',
    autoSync: false,
    lastSyncedAt: null,
    lastCommitSha: undefined,
    lastCommitUrl: undefined,
  });
  const [githubToken, setGithubToken] = useState('');
  const [githubSessionToken, setGithubSessionToken] = useState('');
  const [githubBrowseUsername, setGithubBrowseUsername] = useState('');
  const [githubUser, setGithubUser] = useState<GitHubUserProfile | null>(null);
  const [githubRepos, setGithubRepos] = useState<GitHubRepoSummary[]>([]);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposError, setGithubReposError] = useState<string | null>(null);
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [githubOAuthConfigured, setGithubOAuthConfigured] = useState<boolean | null>(null);
  const [githubCallbackUrl, setGithubCallbackUrl] = useState('');
  const [githubBusyAction, setGithubBusyAction] = useState<'pull' | 'push' | null>(null);
  const [githubStatusError, setGithubStatusError] = useState<string | null>(null);
  const [githubStatusMessage, setGithubStatusMessage] = useState<string | null>(null);
  const [githubRequiresAuthPrompt, setGithubRequiresAuthPrompt] = useState(false);

  const oauthPopupRef = useRef<Window | null>(null);
  const oauthNonceRef = useRef<string>('');
  const oauthPkceVerifierRef = useRef<string>('');
  const oauthCallbackOriginRef = useRef<string>('');
  const oauthPollTimerRef = useRef<number | null>(null);

  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>({
    enabled: true,
    diskConnected: false,
    diskFolderName: null,
    lastSavedAt: null,
    permissionState: 'none',
  });

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const artboardIframeRefs = useRef<Partial<Record<ArtboardId, HTMLIFrameElement | null>>>({});
  const activeArtboardRef = useRef<ArtboardId>(activeArtboard);
  activeArtboardRef.current = activeArtboard;
  const registerArtboardIframe = useCallback(
    (boardId: ArtboardId, el: HTMLIFrameElement | null) => {
      artboardIframeRefs.current[boardId] = el;
    },
    []
  );
  const diskHandleRef = useRef<FileSystemDirectoryHandleLike | null>(null);
  const lastPushedFingerprintRef = useRef<string>('');
  const copiedElementHtmlRef = useRef<{ html: string; tagName: string } | null>(null);
  const dropTargetRef = useRef<{
    targetVeId: string | null;
    placement: 'inside' | 'after';
  }>({ targetVeId: null, placement: 'inside' });
  const pendingSnapshotRef = useRef<
    Map<
      string,
      (payload: {
        cssText: string;
        bodyHtml: string;
        width: number;
        height: number;
        bodyBg: string;
      }) => void
    >
  >(new Map());

  const files = history.present.files;

  // Re-scan runnable targets whenever the workspace files change (import, pull, scaffold).
  useEffect(() => {
    const scan = scanRepoTargets(files);
    setRepoScan(scan);
    setActiveRepoTargetId((prev) =>
      prev && scan.targets.some((target) => target.id === prev)
        ? prev
        : getDefaultRepoTarget(scan.targets)?.id ?? null
    );
  }, [files]);

  const activeRepoTarget = useMemo(
    () => getRepoTargetById(repoScan.targets, activeRepoTargetId),
    [repoScan, activeRepoTargetId]
  );

  const previewPlatform = activeRepoTarget
    ? targetPreviewPlatform(activeRepoTarget.kind)
    : 'browser';

  const htmlPages = useMemo(
    () =>
      files
        .filter((f) => f.type === 'html' && isPathInTarget(f.path, activeRepoTarget))
        .map((f) => f.path),
    [files, activeRepoTarget]
  );

  const projectImageAssets = useMemo(
    () => files.filter((f) => isImageAssetPath(f.path)),
    [files]
  );

  const entryHtmlPath = useMemo(() => {
    // Prefer an explicitly opened page, but only while it belongs to the active target.
    if (
      activePreviewHtmlPath &&
      files.some((f) => f.path === activePreviewHtmlPath) &&
      isPathInTarget(activePreviewHtmlPath, activeRepoTarget)
    ) {
      return activePreviewHtmlPath;
    }
    const targetEntry = resolveRepoTargetEntryPath(files, activeRepoTarget);
    if (targetEntry) return targetEntry;
    return findEntryHtmlPath(files);
  }, [activePreviewHtmlPath, files, activeRepoTarget]);

  const activeHtmlFile = useMemo(
    () => (entryHtmlPath ? files.find((f) => f.path === entryHtmlPath) ?? null : null),
    [files, entryHtmlPath]
  );

  const activeBreakpointScope: BreakpointScope = useMemo(() => {
    if (breakpointScopeOverride) return breakpointScopeOverride;
    if (responsiveScope === 'all') return { mode: 'all', label: 'All Screens' };
    const range = rangeForPresetScope(responsiveScope);
    return { mode: 'preset', ...range, label: breakpointRangeToLabel(range) };
  }, [breakpointScopeOverride, responsiveScope]);

  const activeBreakpointScopeRef = useRef(activeBreakpointScope);
  activeBreakpointScopeRef.current = activeBreakpointScope;

  const primaryCssFile = useMemo(() => {
    return (
      files.find((f) => f.path === 'styles.css') ??
      files.find((f) => f.type === 'css') ??
      null
    );
  }, [files]);

  const overrideCssFile = useMemo(() => {
    return (
      files.find((f) => f.path === 'src/framecraft-edits.css') ??
      files.find((f) => f.path === 'framecraft-edits.css') ??
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
  const historyRef = useRef(history);
  historyRef.current = history;
  const selectedElementRef = useRef(selectedElement);
  selectedElementRef.current = selectedElement;
  const entryHtmlPathRef = useRef(entryHtmlPath);
  entryHtmlPathRef.current = entryHtmlPath;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const resetAiCopilotState = useCallback((clearPrompt = false) => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    preserveNextAiExplanationRef.current = false;
    setAiLoading(false);
    setAiError(null);
    setAiExplanation(null);
    if (clearPrompt) {
      setAiPromptDraft('');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
        aiAbortControllerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const isDark = studioTheme === 'obsidian' || studioTheme === 'slate';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-studio-theme', studioTheme);
    saveStudioThemePreference(studioTheme);
  }, [studioTheme]);

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
        postToIframe({ type: 'REQUEST_RECT' }, activeArtboardRef.current);
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

  const getStaticScriptSignature = useCallback(
    (projectFiles: ProjectFile[], pagePath: string | null): string => {
      if (!pagePath) return '';
      const html = projectFiles.find((f) => f.path === pagePath)?.content ?? '';
      const matches = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi);
      return matches ? matches.join('\n') : '';
    },
    []
  );

  const renderedPageRef = useRef<string | null>(findEntryHtmlPath(startingFiles));
  const renderedScriptSigRef = useRef<string>(
    getStaticScriptSignature(startingFiles, findEntryHtmlPath(startingFiles))
  );

  const getTargetIframeWindows = useCallback(
    (targetArtboard?: ArtboardId | 'all'): Window[] => {
      if (viewportRef.current !== 'all') {
        const win = iframeRef.current?.contentWindow;
        return win ? [win] : [];
      }
      if (targetArtboard && targetArtboard !== 'all') {
        const win = artboardIframeRefs.current[targetArtboard]?.contentWindow;
        return win ? [win] : [];
      }
      const seen = new Set<Window>();
      const windows: Window[] = [];
      for (const boardId of ['desktop', 'tablet', 'mobile'] as ArtboardId[]) {
        const win = artboardIframeRefs.current[boardId]?.contentWindow;
        if (win && !seen.has(win)) {
          seen.add(win);
          windows.push(win);
        }
      }
      return windows;
    },
    []
  );

  const postToIframe = useCallback(
    (message: Record<string, unknown>, targetArtboard?: ArtboardId | 'all') => {
      const windows = getTargetIframeWindows(targetArtboard);
      for (const win of windows) {
        win.postMessage({ target: 've-iframe', ...message }, '*');
      }
    },
    [getTargetIframeWindows]
  );

  const postToSiblingArtboards = useCallback(
    (sourceArtboard: ArtboardId | null, message: Record<string, unknown>) => {
      if (viewportRef.current !== 'all') return;
      for (const boardId of ['desktop', 'tablet', 'mobile'] as ArtboardId[]) {
        if (sourceArtboard && boardId === sourceArtboard) continue;
        const win = artboardIframeRefs.current[boardId]?.contentWindow;
        if (win) {
          win.postMessage({ target: 've-iframe', ...message }, '*');
        }
      }
    },
    []
  );

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
        renderedPageRef.current = null;
        renderedScriptSigRef.current = '';
        setRenderedSrcDoc('');
        setPreviewKey((k) => k + 1);
        return;
      }

      renderedPageRef.current = targetPage;
      renderedScriptSigRef.current = getStaticScriptSignature(nextFiles, targetPage);

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
    [editorMode, activePreviewHtmlPath, getStaticScriptSignature, showToast]
  );

  /** Switches platform target: re-roots the preview/file tree and opens its config inspector. */
  const handleChangeRepoTarget = useCallback(
    (targetId: string) => {
      const target = getRepoTargetById(repoScan.targets, targetId);
      if (!target) return;
      setActiveRepoTargetId(targetId);
      setSelectedElement(null);
      setDomTree([]);
      const nextEntry = resolveRepoTargetEntryPath(files, target);
      setActivePreviewHtmlPath(nextEntry);
      if (nextEntry) setActiveFilePath(nextEntry);
      setRightSidebarCollapsed(false);
      setRightPanelTab('seo');
      rebuildPreview(files, editorMode, null, nextEntry);
    },
    [repoScan, files, editorMode, rebuildPreview]
  );

  const hotSyncIframe = useCallback(
    (
      nextFiles: ProjectFile[],
      selectVeId: string | null = null,
      pageOverride?: string | null,
      prevFilesForDiff?: ProjectFile[]
    ): boolean => {
      const targetPage =
        pageOverride && nextFiles.some((f) => f.path === pageOverride)
          ? pageOverride
          : activePreviewHtmlPath && nextFiles.some((f) => f.path === activePreviewHtmlPath)
            ? activePreviewHtmlPath
            : findEntryHtmlPath(nextFiles);

      const hasLiveFrame =
        viewportRef.current === 'all'
          ? (['desktop', 'tablet', 'mobile'] as ArtboardId[]).some((id) =>
              Boolean(artboardIframeRefs.current[id]?.contentWindow)
            )
          : Boolean(iframeRef.current?.contentWindow);

      if (
        !targetPage ||
        showStartHub ||
        centerTab !== 'preview' ||
        !hasLiveFrame ||
        targetPage !== renderedPageRef.current
      ) {
        rebuildPreview(nextFiles, editorMode, selectVeId, pageOverride);
        return false;
      }

      if (!needsModuleBundling(nextFiles, targetPage)) {
        const nextScriptSig = getStaticScriptSignature(nextFiles, targetPage);
        if (nextScriptSig === renderedScriptSigRef.current) {
          const payload = extractHotPatchPayload(nextFiles, targetPage);
          if (payload) {
            const nextCssFile =
              nextFiles.find((f) => f.path === 'styles.css') ??
              nextFiles.find((f) => f.type === 'css') ??
              null;
            const liveResponsiveCss = nextCssFile
              ? extractManagedSection(nextCssFile.content)
              : '';
            postToIframe(
              {
                type: 'HOT_PATCH_HTML',
                ...payload,
                liveResponsiveCss,
                selectVeId,
                primaryArtboardId:
                  viewportRef.current === 'all' ? activeArtboardRef.current : undefined,
              },
              'all'
            );
            return true;
          }
        }
        rebuildPreview(nextFiles, editorMode, selectVeId, pageOverride);
        return false;
      }

      if (prevFilesForDiff) {
        const prevNonOverride = prevFilesForDiff.filter(
          (f) => f.path !== 'src/framecraft-edits.css' && f.path !== 'framecraft-edits.css'
        );
        const nextNonOverride = nextFiles.filter(
          (f) => f.path !== 'src/framecraft-edits.css' && f.path !== 'framecraft-edits.css'
        );
        const onlyOverrideChanged =
          prevNonOverride.length === nextNonOverride.length &&
          prevNonOverride.every(
            (pf, idx) =>
              pf.path === nextNonOverride[idx].path && pf.content === nextNonOverride[idx].content
          );
        if (onlyOverrideChanged) {
          const nextOverrideCss =
            nextFiles.find((f) => f.path === 'src/framecraft-edits.css') ??
            nextFiles.find((f) => f.path === 'framecraft-edits.css');
          const usedFamilies = collectUsedGoogleFonts(
            nextFiles
              .filter((f) => f.type === 'html' || f.type === 'css' || f.type === 'js')
              .map((f) => f.content)
          );
          postToIframe(
            {
              type: 'HOT_PATCH_CSS',
              overrideCss: nextOverrideCss?.content ?? '',
              googleFontHref: buildGoogleFontsHref(usedFamilies),
            },
            'all'
          );
          return true;
        }
      }

      rebuildPreview(nextFiles, editorMode, selectVeId, pageOverride);
      return false;
    },
    [
      activePreviewHtmlPath,
      showStartHub,
      centerTab,
      editorMode,
      rebuildPreview,
      getStaticScriptSignature,
      postToIframe,
    ]
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
        resetAiCopilotState(false);
        setSelectedElement(null);
      }
    },
    [postToIframe, resetAiCopilotState]
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

  const preAllZoomRef = useRef<CanvasZoomMode | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const canvasZoomRef = useRef(canvasZoom);
  canvasZoomRef.current = canvasZoom;

  const handleChangeCanvasZoom = useCallback((nextZoom: CanvasZoomMode) => {
    preAllZoomRef.current = null;
    setCanvasZoom(nextZoom);
  }, []);

  const handleChangeViewport = useCallback((nextViewport: ViewportPreset) => {
    const prevViewport = viewportRef.current;
    setBreakpointScopeOverride(null);
    setViewport(nextViewport);
    setCanvasWidthPx(null);
    if (nextViewport === 'all') {
      setCanvasHeightPx(null);
      if (prevViewport !== 'all') {
        activeArtboardRef.current = prevViewport;
        setActiveArtboard(prevViewport);
        preAllZoomRef.current = canvasZoomRef.current;
        setCanvasZoom('fit');
      }
      return;
    }

    if (prevViewport === 'all' && preAllZoomRef.current !== null) {
      setCanvasZoom(preAllZoomRef.current);
      preAllZoomRef.current = null;
    }

    activeArtboardRef.current = nextViewport;
    setActiveArtboard(nextViewport);

    if (nextViewport === 'mobile') {
      setResponsiveScope('mobile');
    } else if (nextViewport === 'tablet') {
      setResponsiveScope('tablet');
    } else {
      setResponsiveScope((prev) => (prev === 'mobile' || prev === 'tablet' ? 'desktop' : prev));
    }
  }, []);

  const handleSelectArtboard = useCallback(
    (boardId: ArtboardId) => {
      activeArtboardRef.current = boardId;
      setActiveArtboard(boardId);
      setBreakpointScopeOverride(null);
      setResponsiveScope(boardId);
      const currentSelected = selectedElementRef.current;
      if (currentSelected && viewportRef.current === 'all') {
        postToIframe(
          {
            type: 'SELECT_NODE_ID',
            veId: currentSelected.veId,
            rtId: currentSelected.runtimeId,
            nodeId: currentSelected.veId || currentSelected.runtimeId,
            uniqueSelector: currentSelected.uniqueSelector,
            scrollIntoView: false,
            notifyParent: true,
          },
          boardId
        );
      }
    },
    [postToIframe]
  );

  const handleResizeCanvasFrame = useCallback((widthPx: number | null, heightPx: number | null) => {
    setCanvasWidthPx(widthPx);
    setCanvasHeightPx(heightPx);
    if (widthPx !== null) {
      const matchedPreset = classifyViewportPresetFromWidth(widthPx);
      setViewport(matchedPreset);
      // Scrubbing across the ruler retargets the inspector's edit scope so the next
      // edit lands in the breakpoint the user is actually looking at.
      setBreakpointScopeOverride(null);
      setResponsiveScope(
        matchedPreset === 'mobile'
          ? 'mobile'
          : matchedPreset === 'tablet'
            ? 'tablet'
            : 'desktop'
      );
    }
  }, []);

  const handleChangeBreakpointScope = useCallback((scope: BreakpointScope) => {
    if (scope.mode === 'all') {
      setBreakpointScopeOverride(null);
      setResponsiveScope('all');
      return;
    }
    const range = breakpointScopeToRange(scope);
    if (!range) {
      setBreakpointScopeOverride(null);
      setResponsiveScope('all');
      return;
    }
    setBreakpointScopeOverride(scope);
    const preset = presetScopeFromRange(range);
    if (preset) {
      setResponsiveScope(preset);
      return;
    }
    // Custom window: keep the preset label in sync with the range's widest side so
    // runtime (React) overrides still serialize into the closest legacy block.
    const probeWidth =
      range.maxWidth !== undefined
        ? range.maxWidth
        : range.minWidth !== undefined
          ? range.minWidth
          : 1440;
    const presetFromProbe = classifyViewportPresetFromWidth(probeWidth);
    setResponsiveScope(presetFromProbe === 'all' ? 'desktop' : presetFromProbe);
  }, []);

  const handleToggleOverlapXray = useCallback(() => {
    setOverlapXray((prev) => {
      const next = !prev;
      postToIframe({ type: 'SET_OVERLAP_XRAY', enabled: next }, 'all');
      if (!next) setLayoutIssues([]);
      return next;
    });
  }, [postToIframe]);

  const handleResetBreakpointOverride = useCallback(
    (property: string) => {
      if (!selectedElement?.veNode || !entryHtmlPath) {
        showToast('Select an element with a saved source node first');
        return;
      }
      const targetCssPath = primaryCssFile ? primaryCssFile.path : 'responsive.css';
      const existingCss = files.find((f) => f.path === targetCssPath);
      if (!existingCss) return;
      const scope = activeBreakpointScopeRef.current;
      const nextCss = removeScopedDeclarations(
        existingCss.content,
        selectedElement.veNode,
        scope,
        [property]
      );
      const nextFiles = files.map((f) =>
        f.path === targetCssPath ? { ...f, content: nextCss } : f
      );
      setHistory((prevHistory) =>
        pushHistoryState(prevHistory, nextFiles, `Reset ${property} (${scope.label})`)
      );
      postToIframe({ type: 'HOT_PATCH_CSS', cssSources: { [targetCssPath]: nextCss } }, 'all');
      postToIframe(
        { type: 'LIVE_CSS_OVERRIDE', cssText: extractManagedSection(nextCss) },
        'all'
      );
    },
    [selectedElement, entryHtmlPath, primaryCssFile, files, postToIframe, showToast]
  );

  const handleAutoFixLayoutIssue = useCallback(
    (issue: LayoutIssue) => {
      const scope = activeBreakpointScopeRef.current;
      if (!issue.veId) {
        showToast('Auto-fix needs an element from the project HTML (runtime nodes are read-only)');
        return;
      }
      if (!entryHtmlPath) return;
      const htmlFile = files.find((f) => f.path === entryHtmlPath);
      if (!htmlFile) return;
      const ensured = ensureElementNodeAttr(htmlFile.content, issue.veId);
      if (!ensured.nodeId) {
        showToast('Could not resolve that element in the source HTML');
        return;
      }
      const targetCssPath = primaryCssFile ? primaryCssFile.path : 'responsive.css';
      const patch: Record<string, string> =
        issue.kind === 'overflow'
          ? {
              'min-width': '0',
              'max-width': '100%',
              'overflow-wrap': 'anywhere',
              'box-sizing': 'border-box',
            }
          : issue.parentDisplay === 'grid'
            ? { 'grid-template-columns': 'minmax(0, 1fr)', 'min-width': '0' }
            : { 'flex-wrap': 'wrap', 'min-width': '0' };
      const updatedHtml = ensureStylesheetLinkInHtml(ensured.html, targetCssPath);
      const existingCss = files.find((f) => f.path === targetCssPath);
      const nextCss = upsertScopedStylesInCss(
        existingCss?.content ?? '',
        ensured.nodeId,
        scope,
        patch
      );
      const nextFiles = files.map((f) =>
        f.path === entryHtmlPath
          ? { ...f, content: updatedHtml }
          : f.path === targetCssPath
            ? { ...f, content: nextCss }
            : f
      );
      if (!existingCss) {
        nextFiles.push({
          path: targetCssPath,
          name: targetCssPath,
          type: 'css',
          content: nextCss,
        });
        nextFiles.sort((a, b) => a.path.localeCompare(b.path));
      }
      setHistory((prevHistory) =>
        pushHistoryState(
          prevHistory,
          nextFiles,
          `Auto-fix ${issue.kind} (${scope.label})`
        )
      );
      postToIframe({ type: 'ASSIGN_VE_NODE', nodeId: ensured.nodeId }, 'all');
      postToIframe({ type: 'HOT_PATCH_CSS', cssSources: { [targetCssPath]: nextCss } }, 'all');
      postToIframe(
        { type: 'LIVE_CSS_OVERRIDE', cssText: extractManagedSection(nextCss) },
        'all'
      );
      window.setTimeout(() => {
        postToIframe({ type: 'RUN_OVERLAP_SCAN' }, 'all');
      }, 260);
      showToast(`Auto-fixed ${issue.kind} for ${scope.label}`);
    },
    [entryHtmlPath, primaryCssFile, files, postToIframe, showToast]
  );

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

      if (data.type === 'OVERLAP_REPORT') {
        setLayoutIssues(Array.isArray(data.issues) ? (data.issues as LayoutIssue[]) : []);
        return;
      }

      if (data.type === 'IFRAME_KEYDOWN') {
        const action = matchShortcutAction(
          {
            key: String(data.key || ''),
            code: typeof data.code === 'string' ? data.code : undefined,
            ctrlKey: Boolean(data.ctrlKey),
            metaKey: Boolean(data.metaKey),
            shiftKey: Boolean(data.shiftKey),
            altKey: Boolean(data.altKey),
          },
          {
            editorMode,
            hasSelectedElement: Boolean(selectedElement),
            hasOpenModal:
              shortcutsModalOpen ||
              githubCommitModalOpen ||
              commandPaletteOpen ||
              statsModalOpen ||
              globalFindReplaceOpen ||
              showStartHub,
            isTyping: false,
          }
        );
        if (action) {
          executeShortcutActionRef.current(action);
        }
        return;
      }

      const srcArtboard: ArtboardId | null =
        data.artboardId === 'desktop' ||
        data.artboardId === 'tablet' ||
        data.artboardId === 'mobile'
          ? data.artboardId
          : null;

      if (data.type === 'DOM_TREE_UPDATE' && Array.isArray(data.nodes)) {
        if (viewportRef.current !== 'all' || !srcArtboard || srcArtboard === activeArtboardRef.current) {
          setDomTree(data.nodes as DomTreeNode[]);
        }
        return;
      }

      if (data.type === 'DOM_MOUNTED') {
        const target = srcArtboard ?? 'all';
        postToIframe({ type: 'SET_MODE', mode: editorMode }, target);
        postToIframe({ type: 'SET_OUTLINES', enabled: showOutlines }, target);
        postToIframe({ type: 'SET_OVERLAP_XRAY', enabled: overlapXray }, target);
        if (
          viewportRef.current === 'all' &&
          srcArtboard &&
          srcArtboard !== activeArtboardRef.current &&
          selectedElementRef.current
        ) {
          const curSel = selectedElementRef.current;
          postToIframe(
            {
              type: 'SELECT_NODE_ID',
              veId: curSel.veId,
              rtId: curSel.runtimeId,
              nodeId: curSel.veId || curSel.runtimeId,
              uniqueSelector: curSel.uniqueSelector,
              scrollIntoView: false,
              silent: true,
            },
            srcArtboard
          );
        }
        return;
      }

      if (data.type === 'ELEMENT_HOVERED') {
        if (viewportRef.current === 'all' && srcArtboard) {
          postToSiblingArtboards(srcArtboard, {
            type: 'HOVER_NODE_ID',
            silentBadge: true,
            nodeId: data.nodeKey ?? null,
            veId: data.veId ?? null,
            rtId: data.rtId ?? null,
            uniqueSelector: data.uniqueSelector ?? null,
          });
        }
        return;
      }

      if (data.type === 'NAVIGATE_PAGE' && typeof data.page === 'string') {
        handleSwitchPreviewPage(data.page);
        return;
      }

      if (data.type === 'SNAPSHOT_HTML_RESPONSE' && typeof data.requestId === 'string') {
        const resolver = pendingSnapshotRef.current.get(data.requestId);
        if (resolver) {
          pendingSnapshotRef.current.delete(data.requestId);
          resolver({
            cssText: typeof data.cssText === 'string' ? data.cssText : '',
            bodyHtml: typeof data.bodyHtml === 'string' ? data.bodyHtml : '',
            width: typeof data.width === 'number' ? data.width : 1280,
            height: typeof data.height === 'number' ? data.height : 720,
            bodyBg: typeof data.bodyBg === 'string' ? data.bodyBg : '#ffffff',
          });
        }
        return;
      }

      if (data.type === 'ELEMENT_SELECTED' && data.element) {
        const nextEl = data.element as SelectedElementInfo;
        selectedOriginalTextRef.current = nextEl.textContent || '';

        if (viewportRef.current === 'all' && srcArtboard) {
          if (srcArtboard !== activeArtboardRef.current) {
            activeArtboardRef.current = srcArtboard;
            setActiveArtboard(srcArtboard);
            setResponsiveScope(srcArtboard);
          }
          postToSiblingArtboards(srcArtboard, {
            type: 'SELECT_NODE_ID',
            veId: nextEl.veId,
            rtId: nextEl.runtimeId,
            nodeId: nextEl.veId || nextEl.runtimeId,
            uniqueSelector: nextEl.uniqueSelector,
            scrollIntoView: false,
            silent: true,
          });
        }

        postToIframe({ type: 'CLEAR_RESPONSIVE_PREVIEW' }, 'all');
        setSelectedElement(nextEl);
        setRightPanelTab('inspector');
        if (preserveNextAiExplanationRef.current) {
          preserveNextAiExplanationRef.current = false;
        } else {
          resetAiCopilotState(false);
        }

        if (copiedFormat) {
          const previewPatch: Record<string, string> = {};
          for (const [k, v] of Object.entries(copiedFormat)) {
            if (v) previewPatch[k] = v;
          }
          postToIframe({ type: 'PREVIEW_STYLE', styles: previewPatch }, 'all');
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
        if (viewportRef.current === 'all' && srcArtboard && srcArtboard !== activeArtboardRef.current) {
          return;
        }
        selectedOriginalTextRef.current = '';
        resetAiCopilotState(false);
        postToIframe({ type: 'CLEAR_RESPONSIVE_PREVIEW' }, 'all');
        setSelectedElement(null);
        if (viewportRef.current === 'all') {
          postToSiblingArtboards(srcArtboard, {
            type: 'SELECT_VE_ID',
            veId: null,
            silent: true,
          });
        }
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
        if (viewportRef.current === 'all' && srcArtboard && srcArtboard !== activeArtboardRef.current) {
          return;
        }
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

      if (data.type === 'POSITION_PREVIEW' && data.styles) {
        if (viewportRef.current === 'all' && srcArtboard) {
          postToSiblingArtboards(srcArtboard, {
            type: 'SYNC_NODE_STYLE',
            veId: data.veId ?? null,
            rtId: data.runtimeId ?? null,
            uniqueSelector: data.uniqueSelector ?? null,
            styles: data.styles,
          });
        }
        return;
      }

      if (data.type === 'POSITION_COMMITTED' && data.styles) {
        const updatedEl = data.element as SelectedElementInfo;
        if (viewportRef.current === 'all' && srcArtboard) {
          if (srcArtboard !== activeArtboardRef.current) {
            activeArtboardRef.current = srcArtboard;
            setActiveArtboard(srcArtboard);
          }
          postToSiblingArtboards(srcArtboard, {
            type: 'SYNC_NODE_STYLE',
            veId: data.veId ?? null,
            rtId: updatedEl?.runtimeId ?? data.runtimeId ?? null,
            uniqueSelector: updatedEl?.uniqueSelector ?? null,
            styles: data.styles,
          });
        }
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
        if (viewportRef.current === 'all' && srcArtboard) {
          postToSiblingArtboards(srcArtboard, {
            type: 'SYNC_NODE_TEXT',
            veId: data.veId ?? null,
            rtId: updatedEl?.runtimeId ?? data.runtimeId ?? null,
            uniqueSelector: updatedEl?.uniqueSelector ?? null,
            textContent: data.textContent,
          });
        }
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
    postToSiblingArtboards,
    showToast,
    editorMode,
    selectedElement,
    shortcutsModalOpen,
    githubCommitModalOpen,
    commandPaletteOpen,
    statsModalOpen,
    globalFindReplaceOpen,
    showStartHub,
    showOutlines,
    overlapXray,
    resetAiCopilotState,
  ]);

  const applyPatchAndSync = useCallback(
    (patch: HtmlElementPatch, label: string, shouldRebuildAfter = false) => {
      if (!selectedElement) return;
      const fontPatch = patch.styles?.['font-family'];

      if (!selectedElement.veId || !entryHtmlPath) {
        const sel = selectedElement.uniqueSelector || selectedElement.selectorPath;
        let runtimeCssText: string | null = null;
        let updatedNextFiles: ProjectFile[] = historyRef.current.present.files;
        setHistory((prevHistory) => {
          let nextFiles = prevHistory.present.files;
          if (patch.styles && sel) {
            nextFiles = applyRuntimeStylePatchToFiles(nextFiles, sel, patch.styles, 'all');
          }
          if (patch.attributes && sel) {
            nextFiles = applyRuntimeAttrPatchToFiles(nextFiles, sel, patch.attributes);
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
            nextFiles = applyRuntimeStylePatchToFiles(nextFiles, sel, { display: 'none' }, 'all');
          }
          if (fontPatch && entryHtmlPath) {
            nextFiles = nextFiles.map((file) =>
              file.path === entryHtmlPath
                ? { ...file, content: ensureGoogleFontInHtml(file.content, fontPatch) }
                : file
            );
          }
          updatedNextFiles = nextFiles;
          const nextOverrideCss =
            nextFiles.find((f) => f.path === 'src/framecraft-edits.css') ??
            nextFiles.find((f) => f.path === 'framecraft-edits.css');
          runtimeCssText = nextOverrideCss?.content ?? null;
          return pushHistoryState(prevHistory, nextFiles, label);
        });
        if (runtimeCssText !== null && (patch.styles || patch.remove)) {
          const usedFamilies = collectUsedGoogleFonts(
            updatedNextFiles
              .filter((f) => f.type === 'html' || f.type === 'css' || f.type === 'js')
              .map((f) => f.content)
          );
          postToIframe(
            {
              type: 'HOT_PATCH_CSS',
              overrideCss: runtimeCssText,
              googleFontHref: buildGoogleFontsHref(usedFamilies),
            },
            'all'
          );
        }
        if (shouldRebuildAfter) {
          postToIframe({ type: 'REMOVE_SELECTED' }, 'all');
          setSelectedElement(null);
        }
        return;
      }

      const targetVeId = selectedElement.veId;
      let updatedFilesSnapshot: ProjectFile[] | null = null;

      setHistory((prevHistory) => {
        const nextFiles = prevHistory.present.files.map((file) => {
          if (file.path !== entryHtmlPath) return file;
          let nextHtml = applyElementPatchToHtml(file.content, targetVeId, patch);
          if (fontPatch) {
            nextHtml = ensureGoogleFontInHtml(nextHtml, fontPatch);
          }
          return { ...file, content: nextHtml };
        });
        updatedFilesSnapshot = nextFiles;
        return pushHistoryState(prevHistory, nextFiles, label);
      });

      if (shouldRebuildAfter && updatedFilesSnapshot) {
        setSelectedElement(null);
        hotSyncIframe(updatedFilesSnapshot, null, entryHtmlPath);
      }
    },
    [selectedElement, entryHtmlPath, hotSyncIframe, postToIframe]
  );

  // Base inline style preview & commit
  const handlePreviewStyle = useCallback(
    (styles: Record<string, string>) => {
      if (styles['font-family']) {
        const googleFontHref = buildGoogleFontsHref(
          collectUsedGoogleFonts([styles['font-family']])
        );
        if (googleFontHref) {
          postToIframe({ type: 'HOT_PATCH_CSS', googleFontHref }, 'all');
        }
      }
      if (responsiveScope !== 'all') {
        // Preview the breakpoint override as a real @media rule in every artboard,
        // so each artboard renders it only where its own width matches.
        const previewSelector = selectedElement?.veId
          ? `[data-ve-id="${selectedElement.veId}"]`
          : selectedElement?.uniqueSelector || selectedElement?.selectorPath || null;
        if (previewSelector) {
          postToIframe(
            {
              type: 'PREVIEW_RESPONSIVE_STYLE',
              selector: previewSelector,
              scope: responsiveScope,
              breakpoint: breakpointScopeToRange(activeBreakpointScope),
              styles,
            },
            'all'
          );
        } else {
          postToIframe({ type: 'PREVIEW_STYLE', styles, important: true }, 'all');
        }
      } else {
        postToIframe({ type: 'PREVIEW_STYLE', styles }, 'all');
      }
    },
    [postToIframe, responsiveScope, selectedElement, activeBreakpointScope]
  );

  const handleCommitStyle = useCallback(
    (styles: Record<string, string | null>, label: string) => {
      if (styles['font-family']) {
        const googleFontHref = buildGoogleFontsHref(
          collectUsedGoogleFonts([styles['font-family']])
        );
        if (googleFontHref) {
          postToIframe({ type: 'HOT_PATCH_CSS', googleFontHref }, 'all');
        }
      }
      applyPatchAndSync({ styles }, label, false);
    },
    [applyPatchAndSync, postToIframe]
  );

  // Breakpoint-specific responsive CSS commit (Desktop / Tablet / Mobile)
  const handleCommitResponsiveStyle = useCallback(
    (
      scope: ResponsiveScope | BreakpointScope,
      styles: Record<string, string | null>,
      label: string
    ) => {
      if (!selectedElement) return;
      const normalizedScope = normalizeBreakpointScope(scope);
      const scopeRange = breakpointScopeToRange(normalizedScope);
      const legacyScope: ResponsiveScope = scopeRange
        ? presetScopeFromRange(scopeRange) ?? 'all'
        : 'all';
      const fontPatch = styles['font-family'];
      const googleFontHref = fontPatch
        ? buildGoogleFontsHref(collectUsedGoogleFonts([fontPatch]))
        : '';

      if (!selectedElement.veId || !entryHtmlPath) {
        const sel = selectedElement.uniqueSelector || selectedElement.selectorPath;
        if (!sel) return;
        let nextFiles = applyRuntimeStylePatchToFiles(files, sel, styles, legacyScope);
        if (fontPatch && entryHtmlPath) {
          nextFiles = nextFiles.map((file) =>
            file.path === entryHtmlPath
              ? { ...file, content: ensureGoogleFontInHtml(file.content, fontPatch) }
              : file
          );
        }
        setHistory((prevHistory) => pushHistoryState(prevHistory, nextFiles, label));
        const nextOverrideCss =
          nextFiles.find((f) => f.path === 'src/framecraft-edits.css') ??
          nextFiles.find((f) => f.path === 'framecraft-edits.css');
        postToIframe(
          {
            type: 'HOT_PATCH_CSS',
            overrideCss: nextOverrideCss?.content ?? '',
            ...(googleFontHref ? { googleFontHref } : {}),
          },
          'all'
        );
        postToIframe({ type: 'CLEAR_RESPONSIVE_PREVIEW' }, 'all');
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

      let updatedHtml = ensureStylesheetLinkInHtml(ensured.html, targetCssPath);
      if (fontPatch) {
        updatedHtml = ensureGoogleFontInHtml(updatedHtml, fontPatch);
      }
      const existingCssFile = files.find((f) => f.path === targetCssPath);
      const nextCssContent = upsertScopedStylesInCss(
        existingCssFile?.content ?? '',
        ensured.nodeId,
        normalizedScope,
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
      postToIframe({ type: 'ASSIGN_VE_NODE', nodeId: ensured.nodeId }, 'all');
      const managedCss = extractManagedSection(nextCssContent);
      postToIframe({ type: 'LIVE_CSS_OVERRIDE', cssText: managedCss }, 'all');
      postToIframe(
        {
          type: 'HOT_PATCH_CSS',
          cssSources: { [targetCssPath]: nextCssContent },
          ...(googleFontHref ? { googleFontHref } : {}),
        },
        'all'
      );
      postToIframe({ type: 'CLEAR_RESPONSIVE_PREVIEW' }, 'all');
    },
    [selectedElement, entryHtmlPath, primaryCssFile, files, postToIframe]
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
        const restoreInline: Record<string, string | null> = {};
        for (const k of Object.keys(styles)) {
          restoreInline[k] = selectedElement.inlineStyles[k] ?? null;
        }
        postToIframe(
          { type: 'PREVIEW_STYLE', styles: restoreInline },
          viewportRef.current === 'all' ? activeArtboardRef.current : undefined
        );
        handleCommitResponsiveStyle(responsiveScope, styles, `${label} (${responsiveScope})`);
      }
    },
    [
      selectedElement,
      responsiveScope,
      handlePreviewStyle,
      handleCommitStyle,
      handleCommitResponsiveStyle,
      postToIframe,
      showToast,
    ]
  );

  const handleToggleDeviceVisibility = useCallback(
    (device: 'desktop' | 'tablet' | 'mobile') => {
      if (!selectedElement) return;
      if (!selectedElement.veId || !entryHtmlPath) {
        const sel = selectedElement.uniqueSelector || selectedElement.selectorPath;
        if (!sel) return;
        const current = getRuntimeDeviceVisibilityFromCss(overrideCssFile?.content ?? '', sel);
        const nextVisible = !current[device];
        handleCommitResponsiveStyle(
          device,
          { display: nextVisible ? null : 'none' },
          `${nextVisible ? 'Show' : 'Hide'} on ${device}`
        );
        return;
      }
      const cssContent = primaryCssFile?.content ?? '';
      const current = getNodeDeviceVisibility(cssContent, selectedElement.veNode);
      const nextVisible = !current[device];
      handleCommitResponsiveStyle(
        device,
        { display: nextVisible ? null : 'none' },
        `${nextVisible ? 'Show' : 'Hide'} on ${device}`
      );
    },
    [selectedElement, entryHtmlPath, primaryCssFile, overrideCssFile, handleCommitResponsiveStyle]
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
    hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    showToast('Added table row');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, showToast]);

  const handleRemoveTableRow = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = removeLastTableRowInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Remove table row'));
    hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    showToast('Removed table row');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, showToast]);

  const handleAddTableColumn = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = appendTableColumnInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Add table column'));
    hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    showToast('Added table column');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, showToast]);

  const handleRemoveTableColumn = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const updatedHtml = removeLastTableColumnInHtml(activeHtmlFile.content, selectedElement.veId);
    if (updatedHtml === activeHtmlFile.content) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: updatedHtml } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Remove table column'));
    hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    showToast('Removed table column');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, showToast]);

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
      hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe]
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
      hotSyncIframe(nextFiles, selectedElement.veId, entryHtmlPath);
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe]
  );

  const handleDuplicateElement = useCallback(() => {
    if (!selectedElement?.veId || !entryHtmlPath || !activeHtmlFile) return;
    const dup = duplicateElementInHtml(activeHtmlFile.content, selectedElement.veId);
    if (!dup.duplicatedVeId) return;
    const nextFiles = files.map((f) =>
      f.path === entryHtmlPath ? { ...f, content: dup.html } : f
    );
    setHistory((prev) => pushHistoryState(prev, nextFiles, 'Duplicate element'));
    hotSyncIframe(nextFiles, dup.duplicatedVeId, entryHtmlPath);
    showToast('Duplicated element');
  }, [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, showToast]);

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
      hotSyncIframe(nextFiles, null, entryHtmlPath);
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
  }, [selectedElement, entryHtmlPath, files, hotSyncIframe, postToIframe, showToast]);

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
        postToIframe({ type: 'SET_MODE', mode: 'edit' });
      }
      hotSyncIframe(nextFiles, inserted.insertedVeId, entryHtmlPath);
      showToast(`Inserted ${component.name}`);
    },
    [entryHtmlPath, files, editorMode, hotSyncIframe, postToIframe, showToast]
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
      hotSyncIframe(nextFiles, selectedElement?.veId ?? null, entryHtmlPath);
      showToast(`Replaced ${res.count} occurrence${res.count === 1 ? '' : 's'}`);
      return res.count;
    },
    [entryHtmlPath, activeHtmlFile, files, selectedElement?.veId, hotSyncIframe, showToast]
  );

  const handleGlobalBulkReplace = useCallback(
    (params: {
      query: string;
      replacement: string;
      matchCase: boolean;
      wholeWord: boolean;
      useRegex: boolean;
      scope: FindReplaceScopeFilter;
      targetPaths?: Set<string>;
    }) => {
      const result = replaceAcrossProjectFiles(
        files,
        params.query,
        params.replacement,
        {
          matchCase: params.matchCase,
          wholeWord: params.wholeWord,
          useRegex: params.useRegex,
          scope: params.scope,
        },
        params.targetPaths
      );

      if (result.error || result.replacedCount === 0) {
        if (result.error) showToast(`Replace failed: ${result.error}`);
        return {
          replacedCount: result.replacedCount,
          modifiedFilePaths: result.modifiedFilePaths,
          error: result.error,
        };
      }

      setHistory((prev) =>
        pushHistoryState(
          prev,
          result.files,
          `Global Replace "${params.query}" (${result.replacedCount})`
        )
      );
      if (entryHtmlPath) {
        rebuildPreview(result.files, editorMode, selectedElement?.veId ?? null, entryHtmlPath);
      }
      showToast(
        `Replaced ${result.replacedCount} occurrence${result.replacedCount === 1 ? '' : 's'} across ${result.modifiedFilePaths.length} file${result.modifiedFilePaths.length === 1 ? '' : 's'}`
      );
      return {
        replacedCount: result.replacedCount,
        modifiedFilePaths: result.modifiedFilePaths,
        error: null,
      };
    },
    [files, entryHtmlPath, editorMode, selectedElement?.veId, rebuildPreview, showToast]
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
    postToIframe({ type: 'SELECT_PARENT' }, activeArtboardRef.current);
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
        hotSyncIframe(nextFiles, res.nextVeId ?? selectedElement.veId, entryHtmlPath);
        showToast(direction === 'up' ? 'Moved element up' : 'Moved element down');
        return;
      }
      postToIframe({ type: 'MOVE_SIBLING', direction });
      showToast(direction === 'up' ? 'Moved element up' : 'Moved element down');
    },
    [selectedElement, entryHtmlPath, activeHtmlFile, files, hotSyncIframe, postToIframe, showToast]
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
        postToIframe({ type: 'SET_MODE', mode: 'edit' });
      }
      hotSyncIframe(result.files, result.insertedVeId, entryHtmlPath);
      showToast(`Inserted ${kind} into ${result.targetPath}`);
    },
    [files, entryHtmlPath, selectedElement, editorMode, hotSyncIframe, postToIframe, showToast]
  );

  const handleNudgeSelected = useCallback(
    (dx: number, dy: number) => {
      if (!selectedElement || editorMode !== 'edit') return;
      const curPos =
        selectedElement.inlineStyles.position || selectedElement.styles.position || 'static';
      const nextPos = curPos === 'static' || !curPos ? 'relative' : curPos;
      const rawLeft = selectedElement.inlineStyles.left || selectedElement.styles.left || '0px';
      const rawTop = selectedElement.inlineStyles.top || selectedElement.styles.top || '0px';
      const curLeft = Number.isFinite(parseFloat(rawLeft)) ? parseFloat(rawLeft) : 0;
      const curTop = Number.isFinite(parseFloat(rawTop)) ? parseFloat(rawTop) : 0;
      const nextLeft = `${Math.round(curLeft + dx)}px`;
      const nextTop = `${Math.round(curTop + dy)}px`;

      setSelectedElement((prev) =>
        prev
          ? {
              ...prev,
              inlineStyles: {
                ...prev.inlineStyles,
                position: nextPos,
                left: nextLeft,
                top: nextTop,
              },
            }
          : prev
      );

      handleCommitFormattingStyle(
        {
          position: nextPos,
          left: nextLeft,
          top: nextTop,
        },
        `Nudge (${dx >= 0 ? `+${dx}` : dx}, ${dy >= 0 ? `+${dy}` : dy})`
      );
    },
    [selectedElement, editorMode, handleCommitFormattingStyle]
  );

  const handleCopyElement = useCallback(() => {
    if (!selectedElement?.veId || !activeHtmlFile) {
      showToast('Select a static HTML element to copy');
      return;
    }
    const snippet = extractElementHtmlByVeId(activeHtmlFile.content, selectedElement.veId);
    if (!snippet) return;
    copiedElementHtmlRef.current = { html: snippet, tagName: selectedElement.tagName };
    showToast(`Copied <${selectedElement.tagName}>`);
  }, [selectedElement, activeHtmlFile, showToast]);

  const handleCutElement = useCallback(() => {
    if (!selectedElement?.veId || !activeHtmlFile) return;
    const snippet = extractElementHtmlByVeId(activeHtmlFile.content, selectedElement.veId);
    if (!snippet) return;
    const tagName = selectedElement.tagName;
    copiedElementHtmlRef.current = { html: snippet, tagName };
    handleRemoveElement();
    showToast(`Cut <${tagName}>`);
  }, [selectedElement, activeHtmlFile, handleRemoveElement, showToast]);

  const handlePasteElement = useCallback(() => {
    if (!copiedElementHtmlRef.current) {
      showToast('Clipboard empty — select an element and press Ctrl+C first');
      return;
    }
    const targetVeId = selectedElement?.veId ?? null;
    const placement =
      selectedElement && CONTAINER_TAGS.has(selectedElement.tagName) ? 'inside' : 'after';
    insertComponentIntoHtml(
      {
        id: `clipboard-${Date.now()}`,
        name: `<${copiedElementHtmlRef.current.tagName}>`,
        category: 'Components',
        description: 'Pasted element',
        html: copiedElementHtmlRef.current.html,
      },
      targetVeId,
      targetVeId ? placement : 'inside'
    );
  }, [selectedElement, insertComponentIntoHtml, showToast]);

  const handleCopyStyleOnly = useCallback(() => {
    if (!selectedElement) return;
    const snapshot: Record<string, string | null> = {
      'font-family':
        selectedElement.inlineStyles['font-family'] || selectedElement.styles.fontFamily || null,
      'font-size':
        selectedElement.inlineStyles['font-size'] || selectedElement.styles.fontSize || null,
      'font-weight':
        selectedElement.inlineStyles['font-weight'] || selectedElement.styles.fontWeight || null,
      'font-style':
        selectedElement.inlineStyles['font-style'] || selectedElement.styles.fontStyle || null,
      'text-decoration': selectedElement.inlineStyles['text-decoration'] || null,
      color: selectedElement.inlineStyles.color || selectedElement.styles.color || null,
      'background-color': selectedElement.inlineStyles['background-color'] || null,
      'border-radius': selectedElement.inlineStyles['border-radius'] || null,
      padding: selectedElement.inlineStyles.padding || null,
      'text-align': selectedElement.inlineStyles['text-align'] || null,
    };
    setCopiedFormat(snapshot);
    showToast('Copied styles (Ctrl+Shift+V to paste)');
  }, [selectedElement, showToast]);

  const handlePasteStyleOnly = useCallback(() => {
    if (!copiedFormat) {
      showToast('No copied styles — press Ctrl+Shift+C on an element first');
      return;
    }
    if (!selectedElement) {
      showToast('Select an element to paste styles onto');
      return;
    }
    handleCommitFormattingStyle(copiedFormat, 'Paste style');
    showToast('Pasted styles');
  }, [copiedFormat, selectedElement, handleCommitFormattingStyle, showToast]);

  const handleShiftZIndex = useCallback(
    (delta: number) => {
      if (!selectedElement || editorMode !== 'edit') return;
      const curPos =
        selectedElement.inlineStyles.position || selectedElement.styles.position || 'static';
      const nextPos = curPos === 'static' || !curPos ? 'relative' : curPos;
      const rawZ = selectedElement.inlineStyles['z-index'] || selectedElement.styles.zIndex || '0';
      const curZ = Number.isFinite(parseInt(rawZ, 10)) ? parseInt(rawZ, 10) : 0;
      const nextZ = String(curZ + delta);
      handleCommitFormattingStyle(
        { position: nextPos, 'z-index': nextZ },
        delta > 0 ? 'Bring forward' : 'Send backward'
      );
      showToast(`Layer z-index: ${nextZ}`);
    },
    [selectedElement, editorMode, handleCommitFormattingStyle, showToast]
  );

  // Undo & Redo (zero-reload DOM/CSS hot-patch when page structure permits)
  const handleUndo = useCallback(() => {
    if (history.past.length === 0) return;
    const nextState = undoHistoryState(history);
    setHistory(nextState);
    const keepVeId = selectedElement?.veId ?? null;
    const didHotPatch = hotSyncIframe(
      nextState.present.files,
      keepVeId,
      undefined,
      history.present.files
    );
    if (!didHotPatch) {
      setSelectedElement(null);
    }
    showToast(`Undid: ${history.present.label}`);
  }, [history, selectedElement, hotSyncIframe, showToast]);

  const handleRedo = useCallback(() => {
    if (history.future.length === 0) return;
    const nextState = redoHistoryState(history);
    setHistory(nextState);
    const keepVeId = selectedElement?.veId ?? null;
    const didHotPatch = hotSyncIframe(
      nextState.present.files,
      keepVeId,
      undefined,
      history.present.files
    );
    if (!didHotPatch) {
      setSelectedElement(null);
    }
    showToast(`Redid: ${nextState.present.label}`);
  }, [history, selectedElement, hotSyncIframe, showToast]);

  const handleJumpToHistoryIndex = useCallback(
    (targetIndex: number) => {
      const nextState = jumpToHistoryIndex(history, targetIndex);
      if (nextState === history) return;
      setHistory(nextState);
      const keepVeId = selectedElement?.veId ?? null;
      const didHotPatch = hotSyncIframe(
        nextState.present.files,
        keepVeId,
        undefined,
        history.present.files
      );
      if (!didHotPatch) {
        setSelectedElement(null);
      }
      showToast(`Jumped to: ${nextState.present.label}`);
    },
    [history, selectedElement, hotSyncIframe, showToast]
  );

  const handleCancelAiEdit = useCallback(() => {
    if (aiAbortControllerRef.current) {
      aiAbortControllerRef.current.abort();
      aiAbortControllerRef.current = null;
    }
    setAiLoading(false);
  }, []);

  const handleClearAiFeedback = useCallback(() => {
    setAiError(null);
    setAiExplanation(null);
  }, []);

  const handleRunAiElementEdit = useCallback(
    async (
      rawPromptText: string,
      quickLabel?: string,
      botProof?: { captchaToken?: string; honeypot?: string }
    ) => {
      const trimmedPrompt = rawPromptText.trim();
      if (!trimmedPrompt) {
        setAiError('Describe how you want to edit the selected element.');
        return;
      }
      if (trimmedPrompt.length > 1000) {
        setAiError('Prompt must be 1,000 characters or fewer.');
        return;
      }

      const currentSelected = selectedElementRef.current;
      if (!currentSelected) {
        setAiError('Select an element on the canvas before running an AI edit.');
        return;
      }

      const currentFiles = historyRef.current.present.files;
      const currentEntryHtmlPath = entryHtmlPathRef.current;
      const slice = extractElementSourceSlice(currentFiles, currentEntryHtmlPath, currentSelected);
      if (!slice) {
        setAiError(
          `Could not locate editable source code for <${currentSelected.tagName}>. Try selecting a more specific element.`
        );
        return;
      }
      if (slice.targetCode.length > 15000) {
        setAiError(
          `<${currentSelected.tagName}> is too large (${slice.targetCode.length.toLocaleString()} chars, max 15,000). Select a smaller child element.`
        );
        return;
      }

      if (aiAbortControllerRef.current) {
        aiAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      aiAbortControllerRef.current = controller;

      setAiLoading(true);
      setAiError(null);
      setAiExplanation(null);

      const designTokens = extractDesignTokensMap(currentFiles, 60);

      try {
        const response = await fetchWithTimeout('/api/ai/edit-element', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: trimmedPrompt,
            targetCode: slice.targetCode,
            fileType: slice.fileType,
            ...(Object.keys(designTokens).length > 0 ? { designTokens } : {}),
            ...(slice.surroundingContext ? { surroundingContext: slice.surroundingContext } : {}),
            ...(botProof?.captchaToken ? { captchaToken: botProof.captchaToken } : {}),
            ...(botProof?.honeypot ? { honeypot: botProof.honeypot } : {}),
          }),
        }, FETCH_TIMEOUT_MS.llm, 'AI edit');

        let payload: { updatedCode?: unknown; explanation?: unknown; error?: unknown } = {};
        try {
          payload = (await response.json()) as {
            updatedCode?: unknown;
            explanation?: unknown;
            error?: unknown;
          };
        } catch {
          payload = {};
        }

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          const msg =
            typeof payload.error === 'string' && payload.error.trim()
              ? payload.error.trim()
              : `AI edit request failed (${response.status}).`;
          setAiError(msg);
          return;
        }

        const updatedCode = typeof payload.updatedCode === 'string' ? payload.updatedCode : '';
        const explanation =
          typeof payload.explanation === 'string' && payload.explanation.trim()
            ? payload.explanation.trim()
            : `Updated <${slice.tagName}>.`;

        const labelPrefix = quickLabel ? `AI: ${quickLabel}` : `AI edit <${slice.tagName}>`;
        const committed = commitAiElementPatchWithHistory({
          history: historyRef.current,
          entryHtmlPath: entryHtmlPathRef.current,
          slice,
          updatedCode,
          label: labelPrefix,
        });

        if (!committed.ok) {
          setAiError(committed.error);
          return;
        }

        const prevFiles = historyRef.current.present.files;
        setHistory(committed.nextHistory);
        const restoreVeId = currentSelected.veId ?? null;
        preserveNextAiExplanationRef.current = true;

        if (committed.needsPreviewRebuild) {
          rebuildPreview(
            committed.nextFiles,
            editorMode,
            restoreVeId,
            entryHtmlPathRef.current
          );
        } else {
          const didHotPatch = hotSyncIframe(
            committed.nextFiles,
            restoreVeId,
            entryHtmlPathRef.current,
            prevFiles
          );
          if (!didHotPatch && !restoreVeId) {
            preserveNextAiExplanationRef.current = false;
          }
        }

        setAiExplanation(explanation);
        setAiPromptDraft('');
        showToast(explanation);
      } catch (err) {
        if (
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError')
        ) {
          return;
        }
        setAiError(
          describeFetchError(err, 'Network error while requesting AI edit.')
        );
      } finally {
        if (aiAbortControllerRef.current === controller) {
          aiAbortControllerRef.current = null;
          setAiLoading(false);
        }
      }
    },
    [editorMode, hotSyncIframe, rebuildPreview, showToast]
  );

  const aiCopilot = useMemo<AiElementCopilotControls>(
    () => ({
      prompt: aiPromptDraft,
      loading: aiLoading,
      error: aiError,
      explanation: aiExplanation,
      onChangePrompt: (next) => {
        setAiPromptDraft(next);
        if (aiError) setAiError(null);
      },
      onSubmit: (promptText, label, botProof) => {
        void handleRunAiElementEdit(promptText, label, botProof);
      },
      onCancel: handleCancelAiEdit,
      onClearFeedback: handleClearAiFeedback,
    }),
    [
      aiPromptDraft,
      aiLoading,
      aiError,
      aiExplanation,
      handleRunAiElementEdit,
      handleCancelAiEdit,
      handleClearAiFeedback,
    ]
  );

  const handleOpenHistoryTimeline = useCallback(() => {
    setShowStartHub(false);
    if (rightSidebarCollapsed) {
      setRightSidebarCollapsed(false);
    }
    setRightPanelTab('history');
    window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
  }, [rightSidebarCollapsed, postToIframe]);

  const handleToggleZenMode = useCallback(() => {
    const nextZen = !(leftSidebarCollapsed && rightSidebarCollapsed);
    setLeftSidebarCollapsed(nextZen);
    setRightSidebarCollapsed(nextZen);
    window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
    showToast(nextZen ? 'Zen Focus Mode' : 'Panels restored');
  }, [leftSidebarCollapsed, rightSidebarCollapsed, postToIframe, showToast]);

  const handleStepZoom = useCallback(
    (dir: 'in' | 'out') => {
      const steps: CanvasZoomMode[] = ['50', '75', '100'];
      setCanvasZoom((prev) => {
        if (prev === 'fit') return dir === 'in' ? '100' : '75';
        const idx = steps.indexOf(prev);
        if (idx === -1) return '100';
        const nextIdx = Math.max(0, Math.min(steps.length - 1, idx + (dir === 'in' ? 1 : -1)));
        return steps[nextIdx];
      });
    },
    []
  );

  const executeShortcutAction = useCallback(
    (action: ShortcutAction) => {
      switch (action) {
        case 'open-command-palette':
          setCommandPaletteOpen((prev) => !prev);
          break;
        case 'global-find-replace':
          setShowStartHub(false);
          setCommandPaletteOpen(false);
          setGlobalFindReplaceOpen((prev) => !prev);
          break;
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
        case 'mode-edit':
          if (editorMode !== 'edit') {
            handleChangeMode('edit');
          }
          showToast('Editing Mode');
          break;
        case 'toggle-outlines':
          handleToggleOutlines();
          break;
        case 'toggle-left-sidebar':
          setLeftSidebarCollapsed((prev) => !prev);
          window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
          break;
        case 'toggle-right-sidebar':
          setRightSidebarCollapsed((prev) => !prev);
          window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
          break;
        case 'toggle-zen':
          handleToggleZenMode();
          break;
        case 'duplicate':
          if (editorMode === 'edit' && selectedElement) handleDuplicateElement();
          break;
        case 'copy-element':
          if (editorMode === 'edit' && selectedElement) handleCopyElement();
          break;
        case 'cut-element':
          if (editorMode === 'edit' && selectedElement) handleCutElement();
          break;
        case 'paste-element':
          if (editorMode === 'edit') handlePasteElement();
          break;
        case 'copy-style':
          if (editorMode === 'edit' && selectedElement) handleCopyStyleOnly();
          break;
        case 'paste-style':
          if (editorMode === 'edit' && selectedElement) handlePasteStyleOnly();
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
        case 'bring-forward':
          if (editorMode === 'edit' && selectedElement) handleShiftZIndex(1);
          break;
        case 'send-backward':
          if (editorMode === 'edit' && selectedElement) handleShiftZIndex(-1);
          break;
        case 'nudge-up':
          handleNudgeSelected(0, -1);
          break;
        case 'nudge-down':
          handleNudgeSelected(0, 1);
          break;
        case 'nudge-left':
          handleNudgeSelected(-1, 0);
          break;
        case 'nudge-right':
          handleNudgeSelected(1, 0);
          break;
        case 'nudge-up-10':
          handleNudgeSelected(0, -10);
          break;
        case 'nudge-down-10':
          handleNudgeSelected(0, 10);
          break;
        case 'nudge-left-10':
          handleNudgeSelected(-10, 0);
          break;
        case 'nudge-right-10':
          handleNudgeSelected(10, 0);
          break;
        case 'toggle-visibility':
          if (editorMode === 'edit' && selectedElement) handleToggleVisibility();
          break;
        case 'toggle-aspect-lock':
          if (editorMode === 'edit' && selectedElement) {
            handleToggleAspectRatioLock(!selectedAspectRatioLocked);
          }
          break;
        case 'edit-text':
          if (editorMode === 'edit' && selectedElement) {
            postToIframe({ type: 'START_INLINE_EDIT' }, activeArtboardRef.current);
          }
          break;
        case 'select-parent':
          if (editorMode === 'edit' && selectedElement) handleSelectParent();
          break;
        case 'format-underline':
          if (editorMode === 'edit' && selectedElement) {
            const cur =
              selectedElement.inlineStyles['text-decoration'] ||
              selectedElement.styles.textDecoration ||
              '';
            const next = cur.includes('underline') ? 'none' : 'underline';
            handleCommitFormattingStyle({ 'text-decoration': next }, 'Toggle underline');
          }
          break;
        case 'align-left':
          if (editorMode === 'edit' && selectedElement) {
            handleCommitFormattingStyle({ 'text-align': 'left' }, 'Align left');
          }
          break;
        case 'align-center':
          if (editorMode === 'edit' && selectedElement) {
            handleCommitFormattingStyle({ 'text-align': 'center' }, 'Align center');
          }
          break;
        case 'align-right':
          if (editorMode === 'edit' && selectedElement) {
            handleCommitFormattingStyle({ 'text-align': 'right' }, 'Align right');
          }
          break;
        case 'zoom-in':
          handleStepZoom('in');
          break;
        case 'zoom-out':
          handleStepZoom('out');
          break;
        case 'zoom-100':
          handleChangeCanvasZoom('100');
          break;
        case 'zoom-fit':
          handleChangeCanvasZoom('fit');
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
        case 'viewport-all':
          handleChangeViewport('all');
          break;
        case 'open-shortcuts':
          setShortcutsModalOpen((prev) => !prev);
          break;
        case 'escape':
          if (commandPaletteOpen) {
            setCommandPaletteOpen(false);
          } else if (globalFindReplaceOpen) {
            setGlobalFindReplaceOpen(false);
          } else if (statsModalOpen) {
            setStatsModalOpen(false);
          } else if (githubCommitModalOpen) {
            setGithubCommitModalOpen(false);
          } else if (shortcutsModalOpen) {
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
      handleToggleOutlines,
      handleToggleZenMode,
      editorMode,
      selectedElement,
      handleDuplicateElement,
      handleCopyElement,
      handleCutElement,
      handlePasteElement,
      handleCopyStyleOnly,
      handlePasteStyleOnly,
      handleRemoveElement,
      handleMoveElementSibling,
      handleShiftZIndex,
      handleNudgeSelected,
      handleToggleVisibility,
      handleToggleAspectRatioLock,
      selectedAspectRatioLocked,
      handleSelectParent,
      handleCommitFormattingStyle,
      handleStepZoom,
      handleChangeCanvasZoom,
      handleChangeViewport,
      commandPaletteOpen,
      globalFindReplaceOpen,
      statsModalOpen,
      githubCommitModalOpen,
      shortcutsModalOpen,
      postToIframe,
      showToast,
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
          hasOpenModal:
            shortcutsModalOpen ||
            githubCommitModalOpen ||
            commandPaletteOpen ||
            statsModalOpen ||
            globalFindReplaceOpen ||
            showStartHub,
          isTyping: isShortcutTypingTarget(e.target),
        }
      );
      if (!action) return;
      if (
        showStartHub &&
        action !== 'escape' &&
        action !== 'open-shortcuts' &&
        action !== 'open-command-palette'
      ) {
        return;
      }
      e.preventDefault();
      executeShortcutAction(action);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    editorMode,
    selectedElement,
    shortcutsModalOpen,
    githubCommitModalOpen,
    commandPaletteOpen,
    statsModalOpen,
    globalFindReplaceOpen,
    showStartHub,
    executeShortcutAction,
  ]);

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
      resetAiCopilotState(true);
      setCenterTab('preview');
      setShowStartHub(false);
      codeDirtyRef.current = false;
      rebuildPreview(cloned, editorMode, null, nextEntry);
      showToast(`Loaded ${tpl.name}`);
    },
    [editorMode, rebuildPreview, resetAiCopilotState, showToast]
  );

  const handleResetProject = useCallback(() => {
    const cloned = cloneProjectFiles(initialFiles);
    const nextEntry = findEntryHtmlPath(cloned);
    clearWorkspaceStorage();
    setHistory(createHistoryState(cloned, 'Reset project'));
    setActivePreviewHtmlPath(nextEntry);
    setSelectedElement(null);
    resetAiCopilotState(true);
    codeDirtyRef.current = false;
    rebuildPreview(cloned, editorMode, null, nextEntry);
    showToast('Project reset to original state');
  }, [initialFiles, editorMode, rebuildPreview, resetAiCopilotState, showToast]);

  const handleUploadFiles = useCallback(
    async (fileList: FileList) => {
      const binaryExtensions = new Set([
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'bmp',
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

      const rawEntries: Array<{
        path: string;
        name: string;
        content: string;
        blobUrl?: string;
      }> = [];

      for (const file of Array.from(fileList)) {
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        if (shouldIgnoreUploadPath(rel)) continue;
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.includes('.') ? lowerName.split('.').pop() ?? '' : '';
        if (binaryExtensions.has(ext)) {
          const blobUrl = URL.createObjectURL(file);
          const content = await readAsDataUrl(file);
          rawEntries.push({ path: rel, name: file.name, content, blobUrl });
        } else if (ext === 'svg') {
          const content = await file.text();
          const blobUrl = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
          rawEntries.push({ path: rel, name: file.name, content, blobUrl });
        } else {
          const content = await file.text();
          rawEntries.push({ path: rel, name: file.name, content });
        }
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
      resetAiCopilotState(true);
      setCenterTab('preview');
      setShowStartHub(false);
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
    [editorMode, rebuildPreview, resetAiCopilotState, showToast]
  );

  const handleUploadImageAsset = useCallback(
    async (file: File): Promise<string | null> => {
      const safeName = (file.name || 'image.png').replace(/[^\w.-]+/g, '-');
      const isSvg = /\.svg$/i.test(safeName);
      const hasPublicDir = files.some((f) => f.path.toLowerCase().startsWith('public/'));
      const usesBundler = needsModuleBundling(files, entryHtmlPath);
      const usePublicFolder = hasPublicDir || usesBundler;

      const targetDir = usePublicFolder
        ? 'public/images'
        : files.some((f) => f.path.toLowerCase().startsWith('assets/'))
          ? 'assets'
          : 'images';
      const targetPath = `${targetDir}/${safeName}`;
      const assetUrl = usePublicFolder ? `/images/${safeName}` : `./${targetPath}`;

      let content = '';
      let blobUrl = '';
      if (isSvg) {
        content = await file.text();
        blobUrl = URL.createObjectURL(new Blob([content], { type: 'image/svg+xml' }));
      } else {
        blobUrl = URL.createObjectURL(file);
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(reader.error || new Error('Failed to read image file'));
          reader.readAsDataURL(file);
        });
      }

      if (!content) return null;

      const sandboxUrl = isSvg ? toSvgDataUrl(content) : content;
      const newAsset: ProjectFile = {
        path: targetPath,
        name: safeName,
        type: 'other',
        content,
        blobUrl,
      };

      setHistory((prev) => {
        const filtered = prev.present.files.filter((f) => f.path !== targetPath);
        const nextFiles = [...filtered, newAsset].sort((a, b) => a.path.localeCompare(b.path));
        return pushHistoryState(prev, nextFiles, `Add image ${targetPath}`);
      });

      postToIframe({
        type: 'REGISTER_PROJECT_ASSET',
        keys: [targetPath, `./${targetPath}`, `/${targetPath}`, assetUrl, `.${assetUrl}`, safeName],
        url: sandboxUrl,
      });

      showToast(`Added ${targetPath}`);
      return assetUrl;
    },
    [files, entryHtmlPath, postToIframe, showToast]
  );

  const handleBrowseGitHubUsername = useCallback(
    async (username: string) => {
      const clean = username.trim().replace(/^@+/, '');
      if (!clean) {
        setGithubReposError('Enter a GitHub username to load public repositories.');
        return;
      }
      if (!beginAction('github:browse')) return;
      setGithubReposLoading(true);
      setGithubReposError(null);
      try {
        const headers: Record<string, string> = {};
        if (githubSessionToken) {
          headers.Authorization = `Bearer ${githubSessionToken}`;
        } else if (githubToken.trim()) {
          headers['X-GitHub-Token'] = githubToken.trim();
        }
        const res = await fetchWithTimeout(`/api/github/users/${encodeURIComponent(clean)}/repos`, {
          headers,
        }, FETCH_TIMEOUT_MS.read, 'GitHub repositories');
        const data = (await res.json()) as GitHubReposResponse;
        if (!res.ok || !data.ok) {
          setGithubReposError(data.error || `Could not load repositories for @${clean}.`);
          return;
        }
        setGithubBrowseUsername(clean);
        if (data.user) {
          setGithubUser(data.user);
        }
        setGithubRepos(Array.isArray(data.repos) ? data.repos : []);
      } catch (err) {
        setGithubReposError(
          describeFetchError(err, 'Network error browsing GitHub repositories.')
        );
      } finally {
        endAction('github:browse');
        setGithubReposLoading(false);
      }
    },
    [githubSessionToken, githubToken]
  );

  const handleRefreshGitHubRepos = useCallback(
    async (overridePatToken?: string, overrideSessionToken?: string) => {
      const effectiveSession = overrideSessionToken ?? githubSessionToken;
      const effectivePat = (overridePatToken ?? githubToken).trim();
      if (!effectiveSession && !effectivePat) {
        if (githubBrowseUsername) {
          await handleBrowseGitHubUsername(githubBrowseUsername);
        }
        return;
      }

      if (!beginAction('github:refresh')) return;
      setGithubReposLoading(true);
      setGithubReposError(null);
      try {
        const headers: Record<string, string> = {};
        if (effectiveSession) {
          headers.Authorization = `Bearer ${effectiveSession}`;
        } else if (effectivePat) {
          headers['X-GitHub-Token'] = effectivePat;
        }
        const res = await fetchWithTimeout('/api/github/repos', { headers }, FETCH_TIMEOUT_MS.read, 'GitHub repositories');
        const data = (await res.json()) as GitHubReposResponse;
        if (!res.ok || !data.ok) {
          if (res.status === 401 && effectiveSession) {
            setGithubSessionToken('');
            setGithubUser(null);
            setGithubRepos([]);
          }
          setGithubReposError(data.error || 'Could not load your GitHub repositories.');
          return;
        }
        setGithubBrowseUsername('');
        setGithubRequiresAuthPrompt(false);
        setGithubStatusError(null);
        if (data.user) {
          setGithubUser(data.user);
        }
        setGithubRepos(Array.isArray(data.repos) ? data.repos : []);
      } catch (err) {
        setGithubReposError(
          describeFetchError(err, 'Network error loading GitHub repositories.')
        );
      } finally {
        endAction('github:refresh');
        setGithubReposLoading(false);
      }
    },
    [githubBrowseUsername, githubSessionToken, githubToken, handleBrowseGitHubUsername]
  );

  const handleFetchRepoBranches = useCallback(
    async (owner: string, repo: string): Promise<string[]> => {
      try {
        const headers: Record<string, string> = {};
        if (githubSessionToken) {
          headers.Authorization = `Bearer ${githubSessionToken}`;
        } else if (githubToken.trim()) {
          headers['X-GitHub-Token'] = githubToken.trim();
        }
        const res = await fetchWithTimeout(
          `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
          { headers }
        , FETCH_TIMEOUT_MS.read, 'GitHub branches');
        const data = (await res.json()) as GitHubBranchesResponse;
        return res.ok && data.ok && Array.isArray(data.branches) ? data.branches : [];
      } catch {
        return [];
      }
    },
    [githubSessionToken, githubToken]
  );

  useEffect(() => {
    let active = true;
    const checkStatus = async () => {
      try {
        const originParam = encodeURIComponent(window.location.origin);
        const res = await fetchWithTimeout(`/api/auth/github/status?origin=${originParam}`, {}, FETCH_TIMEOUT_MS.probe, 'GitHub status');
        if (!res.ok || !active) return;
        const data = (await res.json()) as GitHubAuthStatusResponse & {
          callbackOrigin?: string;
        };
        if (!active) return;
        setGithubOAuthConfigured(Boolean(data.configured));
        const resolvedCallback =
          data.callbackUrl || `${window.location.origin}/auth/github/callback`;
        setGithubCallbackUrl(resolvedCallback);
        oauthCallbackOriginRef.current =
          data.callbackOrigin || resolveOriginFromUrl(resolvedCallback) || window.location.origin;
      } catch {
        if (active) {
          setGithubCallbackUrl(`${window.location.origin}/auth/github/callback`);
          oauthCallbackOriginRef.current = window.location.origin;
        }
      }
    };
    void checkStatus();
    return () => {
      active = false;
    };
  }, []);

  const clearOAuthHandshake = useCallback((keepConnecting = false) => {
    if (oauthPollTimerRef.current !== null) {
      window.clearInterval(oauthPollTimerRef.current);
      oauthPollTimerRef.current = null;
    }
    oauthPopupRef.current = null;
    oauthNonceRef.current = '';
    oauthPkceVerifierRef.current = '';
    if (!keepConnecting) {
      setGithubConnecting(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (oauthPollTimerRef.current !== null) {
        window.clearInterval(oauthPollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const completePkceCodeExchange = async (
      payload: {
        code: string;
        exchangeToken?: string;
        state?: string;
        redirectUri?: string;
      },
      codeVerifier: string
    ) => {
      try {
        const exchangeRes = await fetchWithTimeout('/api/auth/github/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: payload.code,
            codeVerifier,
            ...(payload.exchangeToken ? { exchangeToken: payload.exchangeToken } : {}),
            ...(payload.state ? { state: payload.state } : {}),
            ...(payload.redirectUri ? { redirectUri: payload.redirectUri } : {}),
          }),
        }, FETCH_TIMEOUT_MS.mutation, 'GitHub sign-in');
        const exchangeData = (await exchangeRes.json()) as {
          ok?: boolean;
          sessionToken?: string;
          user?: GitHubUserProfile;
          error?: string;
        };
        if (!exchangeRes.ok || !exchangeData.ok || !exchangeData.sessionToken || !exchangeData.user) {
          const errMsg =
            exchangeData.error || 'Failed exchanging GitHub PKCE authorization code.';
          setGithubReposError(errMsg);
          setGithubStatusError(errMsg);
          return;
        }

        setGithubSessionToken(exchangeData.sessionToken);
        setGithubUser(exchangeData.user);
        setGithubRequiresAuthPrompt(false);
        setGithubStatusError(null);
        setGithubReposError(null);
        setGithubStatusMessage(`Connected to GitHub as @${exchangeData.user.login}`);
        showToast(`Connected to GitHub as @${exchangeData.user.login}`);
        void handleRefreshGitHubRepos(undefined, exchangeData.sessionToken);
      } catch (err) {
        const errMsg =
          describeFetchError(err, 'Unable to exchange GitHub authorization code.');
        setGithubReposError(errMsg);
        setGithubStatusError(errMsg);
      } finally {
        setGithubConnecting(false);
      }
    };

    const handleOAuthMessage = (event: MessageEvent) => {
      // Strictly validate origin (same-origin OR configured external callback origin),
      // popup window source, and one-time client handshake nonce
      const externalEnvUrl = (
        import.meta as unknown as { env?: Record<string, string | undefined> }
      ).env?.VITE_GITHUB_OAUTH_CALLBACK_URL;
      const allowedCallbackOrigin =
        oauthCallbackOriginRef.current || resolveOriginFromUrl(externalEnvUrl);
      const isAllowedOrigin =
        event.origin === window.location.origin ||
        (Boolean(allowedCallbackOrigin) && event.origin === allowedCallbackOrigin);
      if (!isAllowedOrigin) return;
      if (oauthPopupRef.current && event.source !== oauthPopupRef.current) return;

      const data = event.data as
        | {
            type?: string;
            code?: string;
            exchangeToken?: string;
            state?: string;
            redirectUri?: string;
            sessionToken?: string;
            user?: GitHubUserProfile;
            error?: string;
            nonce?: string;
          }
        | undefined;
      if (!data || typeof data.type !== 'string') return;
      if (!oauthNonceRef.current || data.nonce !== oauthNonceRef.current) return;

      if (data.type === 'GITHUB_OAUTH_CODE' && data.code) {
        const verifier = oauthPkceVerifierRef.current;
        clearOAuthHandshake(true);
        if (!verifier) {
          setGithubConnecting(false);
          const msg = 'Missing PKCE verifier for GitHub authorization handshake.';
          setGithubReposError(msg);
          setGithubStatusError(msg);
          return;
        }
        void completePkceCodeExchange(
          {
            code: data.code,
            exchangeToken: data.exchangeToken,
            state: data.state,
            redirectUri: data.redirectUri,
          },
          verifier
        );
      } else if (data.type === 'GITHUB_OAUTH_SUCCESS' && data.sessionToken && data.user) {
        clearOAuthHandshake();
        setGithubSessionToken(data.sessionToken);
        setGithubUser(data.user);
        setGithubRequiresAuthPrompt(false);
        setGithubStatusError(null);
        setGithubReposError(null);
        setGithubStatusMessage(`Connected to GitHub as @${data.user.login}`);
        showToast(`Connected to GitHub as @${data.user.login}`);
        void handleRefreshGitHubRepos(undefined, data.sessionToken);
      } else if (data.type === 'GITHUB_OAUTH_ERROR') {
        clearOAuthHandshake();
        const errMsg = data.error || 'GitHub authorization was not completed.';
        setGithubReposError(errMsg);
        setGithubStatusError(errMsg);
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [clearOAuthHandshake, handleRefreshGitHubRepos, showToast]);

  const handleConnectGitHub = useCallback(async () => {
    setGithubReposError(null);
    setGithubStatusError(null);
    setGithubConnecting(true);
    try {
      const nonceBytes = new Uint8Array(24);
      window.crypto.getRandomValues(nonceBytes);
      const clientNonce = Array.from(nonceBytes, (b) => b.toString(16).padStart(2, '0')).join('');
      const codeVerifier = generatePkceCodeVerifier();
      const codeChallenge = await computePkceCodeChallengeS256(codeVerifier);

      oauthNonceRef.current = clientNonce;
      oauthPkceVerifierRef.current = codeVerifier;

      const originParam = encodeURIComponent(window.location.origin);
      const nonceParam = encodeURIComponent(clientNonce);
      const challengeParam = encodeURIComponent(codeChallenge);
      const res = await fetchWithTimeout(
        `/api/auth/github/url?origin=${originParam}&nonce=${nonceParam}&code_challenge=${challengeParam}&code_challenge_method=S256`,
        {},
        FETCH_TIMEOUT_MS.read,
        'GitHub connect'
      );
      const data = (await res.json()) as {
        ok?: boolean;
        configured?: boolean;
        callbackUrl?: string;
        callbackOrigin?: string;
        url?: string;
        error?: string;
      };
      if (typeof data.configured === 'boolean') {
        setGithubOAuthConfigured(data.configured);
      }
      if (data.callbackUrl) {
        setGithubCallbackUrl(data.callbackUrl);
      }
      const externalEnvUrl = (
        import.meta as unknown as { env?: Record<string, string | undefined> }
      ).env?.VITE_GITHUB_OAUTH_CALLBACK_URL;
      oauthCallbackOriginRef.current =
        data.callbackOrigin ||
        resolveOriginFromUrl(data.callbackUrl) ||
        resolveOriginFromUrl(externalEnvUrl) ||
        window.location.origin;

      if (!res.ok || !data.url) {
        clearOAuthHandshake();
        setGithubReposError(
          data.error ||
            'GitHub OAuth is not configured on the server yet. Add GITHUB_CLIENT_ID in Secrets (secret optional with PKCE) or use a Personal Access Token.'
        );
        return;
      }

      const authWindow = window.open(
        data.url,
        'framecraft_github_oauth',
        'width=620,height=720'
      );
      if (!authWindow) {
        clearOAuthHandshake();
        setGithubReposError(
          'Popup was blocked by the browser. Allow popups for this site and click Connect GitHub again.'
        );
        return;
      }

      oauthPopupRef.current = authWindow;
      if (oauthPollTimerRef.current !== null) {
        window.clearInterval(oauthPollTimerRef.current);
      }
      oauthPollTimerRef.current = window.setInterval(() => {
        if (authWindow.closed) {
          clearOAuthHandshake();
        }
      }, 600);
    } catch (err) {
      clearOAuthHandshake();
      setGithubReposError(
        describeFetchError(err, 'Unable to start GitHub connection.')
      );
    }
  }, [clearOAuthHandshake]);

  const handleDisconnectGitHub = useCallback(async () => {
    if (!beginAction('github:disconnect')) return;
    const tokenToRevoke = githubSessionToken;
    setGithubSessionToken('');
    setGithubBrowseUsername('');
    setGithubUser(null);
    setGithubRepos([]);
    setGithubReposError(null);
    setGithubToken('');
    setGithubStatusMessage(null);
    if (tokenToRevoke) {
      try {
        await fetchWithTimeout('/api/auth/github/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenToRevoke}` },
        }, FETCH_TIMEOUT_MS.probe, 'GitHub sign-out');
      } catch {
        // Ignore network errors during local logout
      }
    }
    endAction('github:disconnect');
    showToast('Disconnected GitHub account');
  }, [githubSessionToken, showToast, beginAction, endAction]);

  // Pull & Push integration with GitHub (supports OAuth session or repo URL)
  const handlePullFromGitHub = useCallback(
    async (repoUrl: string, branch: string, token: string): Promise<boolean> => {
      if (!beginAction('github:pull')) return false;
      setGithubBusyAction('pull');
      setGithubStatusError(null);
      setGithubStatusMessage(null);
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (githubSessionToken) {
          headers.Authorization = `Bearer ${githubSessionToken}`;
        }
        const res = await fetchWithTimeout('/api/github/pull', {
          method: 'POST',
          headers,
          body: JSON.stringify({ repoUrl, branch, token }),
        }, FETCH_TIMEOUT_MS.mutation, 'GitHub pull');
        const data = (await res.json()) as {
          error?: string;
          requiresAuth?: boolean;
          sessionExpired?: boolean;
          repoFullName?: string;
          branch?: string;
          files?: Array<{ path: string; name: string; content: string }>;
        };

        if (!res.ok || !data.files) {
          if (data.sessionExpired || (res.status === 401 && githubSessionToken)) {
            setGithubSessionToken('');
          }
          if (data.requiresAuth || res.status === 401) {
            setGithubRequiresAuthPrompt(true);
          }
          setGithubStatusError(data.error || 'Failed to pull from GitHub repository');
          return false;
        }

        const pulledEntries = data.files.map((entry) => ({
          path: entry.path,
          name: entry.name,
          content: entry.content,
        }));
        const normalized = normalizeUploadedFiles(pulledEntries);
        if (normalized.length === 0) {
          setGithubStatusError('Repository archive did not contain any supported web files.');
          return false;
        }

        const resolvedBranch = data.branch || branch || 'main';
        const resolvedRepoName = data.repoFullName || repoUrl;
        const isSameConnectedRepo =
          Boolean(githubConnection.repoFullName) &&
          githubConnection.repoFullName.toLowerCase() === resolvedRepoName.toLowerCase();

        const mergeOutcome = isSameConnectedRepo
          ? mergeUpstreamFilesWithWorkspace(files, normalized)
          : null;
        const workspaceFiles = mergeOutcome ? mergeOutcome.merged : normalized;

        const nextEntry = findEntryHtmlPath(workspaceFiles);
        const repoShortTitle =
          resolvedRepoName.split('/').pop() ||
          detectProjectTitleFromUpload(pulledEntries, workspaceFiles) ||
          'GitHub Project';

        setInitialFiles(cloneProjectFiles(workspaceFiles));
        if (mergeOutcome) {
          setHistory((prev) => pushHistoryState(prev, workspaceFiles, `Pull ${resolvedRepoName}`));
        } else {
          setHistory(createHistoryState(workspaceFiles, `Pulled ${resolvedRepoName}`));
        }
        setProjectName(repoShortTitle);
        setActiveTemplateId(null);
        setActiveFilePath((prevPath) =>
          prevPath && workspaceFiles.some((f) => f.path === prevPath)
            ? prevPath
            : nextEntry ?? workspaceFiles[0]?.path ?? null
        );
        setActivePreviewHtmlPath(nextEntry);
        setSelectedElement(null);
        resetAiCopilotState(true);
        setCenterTab('preview');
        setShowStartHub(false);
        codeDirtyRef.current = false;
        rebuildPreview(workspaceFiles, editorMode, null, nextEntry);

        lastPushedFingerprintRef.current = computeFilesFingerprint(workspaceFiles);
        setGithubRequiresAuthPrompt(false);
        setGithubConnection((prev) => ({
          ...prev,
          repoUrl,
          repoFullName: resolvedRepoName,
          branch: resolvedBranch,
          lastSyncedAt: Date.now(),
        }));
        const pullSummary = mergeOutcome
          ? `Merged ${mergeOutcome.updatedCount} upstream files${
              mergeOutcome.preservedLocalCount > 0
                ? ` (+${mergeOutcome.preservedLocalCount} local kept)`
                : ''
            } from ${resolvedRepoName} (${resolvedBranch})`
          : `Pulled ${normalized.length} files from ${resolvedRepoName} (${resolvedBranch})`;
        setGithubStatusMessage(pullSummary);
        showToast(pullSummary);
        return true;
      } catch (err) {
        setGithubStatusError(
          describeFetchError(err, 'Network error pulling repository')
        );
        return false;
      } finally {
        endAction('github:pull');
        setGithubBusyAction(null);
      }
    },
    [editorMode, files, githubConnection.repoFullName, githubSessionToken, rebuildPreview, resetAiCopilotState, showToast]
  );

  const handlePushToGitHub = useCallback(
    async (
      repoUrl: string,
      branch: string,
      commitMessage: string,
      token: string,
      silent = false
    ): Promise<boolean> => {
      if (!beginAction('github:push')) return false;
      if (!silent) {
        setGithubBusyAction('push');
        setGithubStatusError(null);
        setGithubStatusMessage(null);
      }
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (githubSessionToken) {
          headers.Authorization = `Bearer ${githubSessionToken}`;
        }
        const res = await fetchWithTimeout('/api/github/push', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            repoUrl,
            branch,
            commitMessage,
            token,
            files: files.map(({ path, name, content, type }) => ({
              path,
              name,
              content,
              type,
            })),
          }),
        }, FETCH_TIMEOUT_MS.mutation, 'GitHub push');
        const data = (await res.json()) as {
          error?: string;
          requiresAuth?: boolean;
          sessionExpired?: boolean;
          repoFullName?: string;
          branch?: string;
          commitSha?: string;
          commitUrl?: string;
          filesCommitted?: number;
        };

        if (!res.ok) {
          if (data.sessionExpired || (res.status === 401 && githubSessionToken)) {
            setGithubSessionToken('');
          }
          if (data.requiresAuth || res.status === 401) {
            setGithubRequiresAuthPrompt(true);
            if (silent) {
              setGithubOpen(true);
            }
          }
          setGithubStatusError(data.error || 'Failed to push commit to GitHub');
          return false;
        }

        const resolvedRepoName = data.repoFullName || repoUrl;
        const resolvedBranch = data.branch || branch || 'main';
        lastPushedFingerprintRef.current = computeFilesFingerprint(files);
        setGithubRequiresAuthPrompt(false);
        setGithubConnection((prev) => ({
          ...prev,
          repoUrl,
          repoFullName: resolvedRepoName,
          branch: resolvedBranch,
          lastSyncedAt: Date.now(),
          lastCommitSha: data.commitSha || prev.lastCommitSha,
          lastCommitUrl: data.commitUrl || prev.lastCommitUrl,
        }));
        const okMsg = `Pushed commit ${data.commitSha?.slice(0, 7) || ''} to ${resolvedRepoName} (${resolvedBranch})`;
        setGithubStatusMessage(okMsg);
        showToast(silent ? 'Synced edits to GitHub' : okMsg);
        return true;
      } catch (err) {
        setGithubStatusError(
          describeFetchError(err, 'Network error pushing to GitHub')
        );
        return false;
      } finally {
        endAction('github:push');
        if (!silent) {
          setGithubBusyAction(null);
        }
      }
    },
    [files, githubSessionToken, showToast]
  );

  const handleSwitchGithubBranch = useCallback(
    (nextBranch: string) => {
      const trimmed = nextBranch.trim();
      if (!trimmed) return;
      setGithubConnection((prev) => {
        if (prev.branch === trimmed) return prev;
        return { ...prev, branch: trimmed };
      });
      setGithubStatusError(null);
    },
    []
  );

  const handleToggleGithubAutoSync = useCallback(
    (enabled: boolean, repoUrl: string, branch: string) => {
      setGithubConnection((prev) => ({
        ...prev,
        repoUrl: repoUrl || prev.repoUrl,
        branch: branch || prev.branch,
        autoSync: enabled,
      }));
      const hasAuth = Boolean(githubSessionToken || githubToken.trim());
      if (enabled && !hasAuth) {
        setGithubRequiresAuthPrompt(true);
        setGithubStatusError(
          'Connect your GitHub account or enter a GitHub push token so instant auto-sync can push commits.'
        );
      } else {
        setGithubStatusError(null);
      }
    },
    [githubSessionToken, githubToken]
  );

  useEffect(() => {
    const hasAuth = Boolean(githubSessionToken || githubToken.trim());
    if (!githubConnection.autoSync || !githubConnection.repoUrl.trim() || !hasAuth) {
      return;
    }
    const nextFp = computeFilesFingerprint(files);
    if (!lastPushedFingerprintRef.current) {
      lastPushedFingerprintRef.current = nextFp;
      return;
    }
    if (nextFp === lastPushedFingerprintRef.current) return;

    const timer = window.setTimeout(() => {
      void (async () => {
        const ok = await handlePushToGitHub(
          githubConnection.repoUrl,
          githubConnection.branch,
          'Auto-sync Framecraft edits',
          githubToken,
          true
        );
        if (!ok) {
          setGithubConnection((prev) => ({ ...prev, autoSync: false }));
        }
      })();
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [
    files,
    githubConnection.autoSync,
    githubConnection.repoUrl,
    githubConnection.branch,
    githubSessionToken,
    githubToken,
    handlePushToGitHub,
  ]);

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

  const handleExportJson = useCallback(() => {
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project';
    exportProjectAsJson({
      projectName,
      entryHtmlPath,
      viewport,
      files,
      filename: `${slug}.json`,
    });
    showToast(`Exported ${slug}.json`);
  }, [projectName, entryHtmlPath, viewport, files, showToast]);

  const captureLiveSnapshot = useCallback(async () => {
    const defaultWidth =
      canvasWidthPx ?? (viewport === 'mobile' ? 375 : viewport === 'tablet' ? 768 : 1440);
    const defaultHeight = canvasHeightPx ?? 760;

    const targetFrameWin = (
      viewportRef.current === 'all'
        ? artboardIframeRefs.current[activeArtboardRef.current]
        : iframeRef.current
    )?.contentWindow;

    if (centerTab === 'preview' && targetFrameWin) {
      const requestId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const liveCapture = await new Promise<{
        cssText: string;
        bodyHtml: string;
        width: number;
        height: number;
        bodyBg: string;
      } | null>((resolve) => {
        const timer = window.setTimeout(() => {
          pendingSnapshotRef.current.delete(requestId);
          resolve(null);
        }, 450);

        pendingSnapshotRef.current.set(requestId, (payload) => {
          window.clearTimeout(timer);
          resolve(payload);
        });

        targetFrameWin.postMessage(
          { target: 've-iframe', type: 'REQUEST_SNAPSHOT_HTML', requestId },
          '*'
        );
      });

      if (liveCapture && liveCapture.bodyHtml) {
        return {
          cssText: liveCapture.cssText,
          bodyHtml: liveCapture.bodyHtml,
          width: liveCapture.width || defaultWidth,
          height: liveCapture.height || defaultHeight,
          bodyBg: liveCapture.bodyBg,
        };
      }
    }

    const fallbackHtml = renderedSrcDoc || activeHtmlFile?.content || '';
    const extracted = extractBodyAndStylesFromHtml(fallbackHtml);
    return {
      cssText: extracted.cssText,
      bodyHtml: extracted.bodyHtml,
      width: defaultWidth,
      height: defaultHeight,
      bodyBg: '#ffffff',
    };
  }, [canvasWidthPx, canvasHeightPx, viewport, centerTab, renderedSrcDoc, activeHtmlFile]);

  const handleExportSnapshot = useCallback(
    async (format: 'png' | 'svg') => {
      const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'project';
      try {
        const snap = await captureLiveSnapshot();
        if (format === 'svg') {
          exportSvgSnapshot({
            ...snap,
            title: `${projectName} Snapshot`,
            filename: `${slug}-snapshot.svg`,
          });
          showToast(`Exported ${slug}-snapshot.svg`);
          return;
        }
        await exportPngSnapshot({
          ...snap,
          title: `${projectName} Snapshot`,
          filename: `${slug}-snapshot.png`,
        });
        showToast(`Exported ${slug}-snapshot.png`);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : `Unable to export ${format.toUpperCase()} snapshot`
        );
      }
    },
    [projectName, captureLiveSnapshot, showToast]
  );

  const activeFile = useMemo(
    () => files.find((f) => f.path === activeFilePath) ?? null,
    [files, activeFilePath]
  );

  return (
          <div id="main-content" tabIndex={-1} className="relative studio-shell-height w-full overflow-hidden flex flex-col gap-2 p-2 studio-shell text-[var(--studio-text-strong)] focus:outline-none">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only fixed left-4 top-4 z-50 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-neutral-950"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('main-content');
          if (main) main.focus();
        }}
      >
        Skip to main content
      </a>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 studio-grain" />

      {showStartHub ? (
        <ErrorBoundary label="Start hub">
        <StartHub
          templates={SAMPLE_TEMPLATES}
          currentProjectName={projectName}
          currentFileCount={files.length}
          repoTargets={repoScan.targets}
          repoLayout={repoScan.layout}
          onSelectRepoTarget={(targetId) => {
            handleChangeRepoTarget(targetId);
            setShowStartHub(false);
          }}
          studioTheme={studioTheme}
          onChangeStudioTheme={setStudioTheme}
          onResumeWorkspace={() => setShowStartHub(false)}
          onSelectTemplate={handleLoadTemplate}
          onUploadFiles={(list) => void handleUploadFiles(list)}
          onPullFromGitHub={(repoUrl, branch) => handlePullFromGitHub(repoUrl, branch, githubToken)}
          githubBusy={githubBusyAction === 'pull'}
          githubError={githubStatusError}
          githubUser={githubUser}
          githubAccountReadOnly={Boolean(githubUser && !githubSessionToken && !githubToken.trim())}
          githubRepos={githubRepos}
          githubReposLoading={githubReposLoading}
          githubReposError={githubReposError}
          githubConnecting={githubConnecting}
          githubOAuthConfigured={githubOAuthConfigured}
          githubCallbackUrl={githubCallbackUrl}
          githubToken={githubToken}
          onChangeGithubToken={setGithubToken}
          onConnectGitHub={handleConnectGitHub}
          onDisconnectGitHub={handleDisconnectGitHub}
          onRefreshGitHubRepos={(overridePat) => handleRefreshGitHubRepos(overridePat)}
          onBrowseGitHubUsername={handleBrowseGitHubUsername}
          onFetchRepoBranches={handleFetchRepoBranches}
          onOpenShortcuts={() => setShortcutsModalOpen(true)}
        />
        </ErrorBoundary>
      ) : (
        <>
          <TopToolbar
            projectName={projectName}
            editorMode={editorMode}
            onChangeMode={handleChangeMode}
            viewport={viewport}
            onChangeViewport={handleChangeViewport}
            repoTargets={repoScan.targets}
            activeRepoTargetId={activeRepoTargetId}
            onChangeRepoTarget={handleChangeRepoTarget}
            studioTheme={studioTheme}
            onChangeStudioTheme={setStudioTheme}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSaveProject={() => void handleManualSave()}
            onResetProject={handleResetProject}
            onExportZip={handleExportZip}
            onExportJson={handleExportJson}
            onExportPngSnapshot={() => void handleExportSnapshot('png')}
            onExportSvgSnapshot={() => void handleExportSnapshot('svg')}
            onUploadFiles={handleUploadFiles}
            autoSaveStatus={autoSaveStatus}
            onConnectDiskFolder={handleConnectDiskFolder}
            onOpenStartHub={() => setShowStartHub(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenShortcuts={() => setShortcutsModalOpen(true)}
            onOpenProjectStats={() => setStatsModalOpen(true)}
            overlapXray={overlapXray}
            onToggleOverlapXray={handleToggleOverlapXray}
            historyTimelineActive={!rightSidebarCollapsed && rightPanelTab === 'history'}
            onOpenHistoryTimeline={handleOpenHistoryTimeline}
            componentLibraryOpen={componentLibraryOpen && !leftSidebarCollapsed}
            onToggleComponentLibrary={() => {
              setComponentLibraryOpen((prev) => {
                const next = leftSidebarCollapsed ? true : !prev;
                if (next && leftSidebarCollapsed) {
                  setLeftSidebarCollapsed(false);
                }
                return next;
              });
              window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
            }}
            githubOpen={githubOpen}
            onToggleGithubOpen={setGithubOpen}
            commitModalOpen={githubCommitModalOpen}
            onToggleCommitModal={setGithubCommitModalOpen}
            githubConnection={githubConnection}
            githubToken={githubToken}
            onChangeGithubToken={setGithubToken}
            githubBusyAction={githubBusyAction}
            githubStatusError={githubStatusError}
            githubStatusMessage={githubStatusMessage}
            githubRequiresAuthPrompt={githubRequiresAuthPrompt}
            onPullFromGitHub={async (repoUrl, branch, token) => {
              await handlePullFromGitHub(repoUrl, branch, token);
            }}
            onPushToGitHub={async (repoUrl, branch, commitMessage, token) => {
              await handlePushToGitHub(repoUrl, branch, commitMessage, token, false);
            }}
            onToggleGithubAutoSync={handleToggleGithubAutoSync}
            githubUser={githubUser}
            githubAccountReadOnly={Boolean(githubUser && !githubSessionToken && !githubToken.trim())}
            githubRepos={githubRepos}
            githubReposLoading={githubReposLoading}
            githubReposError={githubReposError}
            githubConnecting={githubConnecting}
            githubOAuthConfigured={githubOAuthConfigured}
            githubCallbackUrl={githubCallbackUrl}
            onConnectGitHub={handleConnectGitHub}
            onDisconnectGitHub={handleDisconnectGitHub}
            onRefreshGitHubRepos={(overridePat) => handleRefreshGitHubRepos(overridePat)}
            onBrowseGitHubUsername={handleBrowseGitHubUsername}
            onFetchRepoBranches={handleFetchRepoBranches}
            onSwitchBranch={handleSwitchGithubBranch}
          />

          <ErrorBoundary label="Editor workspace">
          <div className="flex-1 min-h-0 flex relative z-10 gap-1.5">
        {/* Transparent drag shield over iframe while resizing split panes */}
        {splitDrag && <div className="fixed inset-0 z-30 cursor-col-resize select-none" />}

        {leftSidebarCollapsed ? (
          <div className="w-10 shrink-0 border border-[var(--studio-border)] rounded-[14px] bg-[var(--studio-surface)] studio-panel-shadow flex flex-col items-start gap-1.5 px-1.5 py-2 relative z-20">
            <button
              type="button"
              onClick={() => {
                setLeftSidebarCollapsed(false);
                setComponentLibraryOpen(false);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              aria-label="Expand Project Files sidebar"
              title="Expand Project Files (Ctrl+B)"
              className="group inline-flex items-center h-7 px-1.5 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] studio-card-highlight studio-pressable shadow-sm cursor-pointer"
            >
              <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
              <span className="studio-reveal-label">Files</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLeftSidebarCollapsed(false);
                setComponentLibraryOpen(true);
                window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
              }}
              aria-label="Open Component Library drawer"
              title="Open Component Library Drawer"
              className="group inline-flex items-center h-7 px-1.5 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-[var(--studio-text-strong)] studio-card-highlight studio-pressable shadow-sm cursor-pointer"
            >
              <Blocks className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
              <span className="studio-reveal-label">Library</span>
            </button>
          </div>
        ) : (
          <>
            {componentLibraryOpen ? (
              <ComponentLibraryDrawer
                widthPx={leftSidebarWidth}
                onClose={() => {
                  setComponentLibraryOpen(false);
                  window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
                }}
                onShowFiles={() => {
                  setComponentLibraryOpen(false);
                  window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
                }}
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
              />
            ) : (
              <FileExplorer
                widthPx={leftSidebarWidth}
                onCollapse={() => {
                  setLeftSidebarCollapsed(true);
                  window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
                }}
                files={files}
                activeFilePath={activeFilePath}
                entryHtmlPath={entryHtmlPath}
                targetRootPath={activeRepoTarget?.rootPath ?? ''}
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
                onOpenComponentLibrary={() => {
                  setComponentLibraryOpen(true);
                  window.requestAnimationFrame(() => postToIframe({ type: 'REQUEST_RECT' }));
                }}
                onOpenProjectStats={() => setStatsModalOpen(true)}
              />
            )}
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
              className="w-1.5 shrink-0 rounded-full bg-transparent hover:bg-[var(--studio-accent)]/70 transition-colors z-10"
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
          onChangeViewport={handleChangeViewport}
          previewPlatform={previewPlatform}
          activeArtboard={activeArtboard}
          onSelectArtboard={handleSelectArtboard}
          onRegisterArtboardIframe={registerArtboardIframe}
          canvasWidthPx={canvasWidthPx}
          canvasHeightPx={canvasHeightPx}
          onResizeCanvasFrame={handleResizeCanvasFrame}
          canvasZoom={canvasZoom}
          onChangeCanvasZoom={handleChangeCanvasZoom}
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
          overlapXray={overlapXray}
          layoutIssues={layoutIssues}
          onAutoFixLayoutIssue={handleAutoFixLayoutIssue}
          aiCopilot={aiCopilot}
        />

        {rightSidebarCollapsed ? (
          <div className="w-10 shrink-0 border border-[var(--studio-border)] rounded-[14px] bg-[var(--studio-surface)] studio-panel-shadow flex flex-col items-end px-1.5 py-2 relative z-20">
            <button
              type="button"
              onClick={() => {
                setRightSidebarCollapsed(false);
                window.requestAnimationFrame(() =>
                  postToIframe({ type: 'REQUEST_RECT' }, activeArtboardRef.current)
                );
              }}
              aria-label="Expand Inspector sidebar"
              title="Expand Inspector (Ctrl+I)"
              className="group inline-flex flex-row-reverse items-center h-7 px-1.5 rounded-md bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border border-[var(--studio-border)] text-[11.5px] font-medium text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] studio-card-highlight studio-pressable shadow-sm cursor-pointer"
            >
              <PanelRightOpen className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
              <span className="studio-reveal-label">Inspector</span>
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
                window.requestAnimationFrame(() =>
                  postToIframe({ type: 'REQUEST_RECT' }, activeArtboardRef.current)
                );
              }}
              style={{ cursor: 'col-resize' }}
              title="Drag to resize · Double-click to reset"
              className="w-1.5 shrink-0 rounded-full bg-transparent hover:bg-[var(--studio-accent)]/70 transition-colors z-10"
            />
            <RightStudioPanel
              widthPx={rightSidebarWidth}
              onCollapse={() => {
                setRightSidebarCollapsed(true);
                window.requestAnimationFrame(() =>
                  postToIframe({ type: 'REQUEST_RECT' }, activeArtboardRef.current)
                );
              }}
              activeTab={rightPanelTab}
              onChangeTab={setRightPanelTab}
              selectedElement={selectedElement}
              projectImageAssets={projectImageAssets}
              onUploadImageAsset={handleUploadImageAsset}
              domTree={domTree}
              onSelectDomNode={(nodeId) => {
                if (editorMode !== 'edit') {
                  handleChangeMode('edit');
                }
                if (centerTab !== 'preview') {
                  setCenterTab('preview');
                }
                postToIframe(
                  { type: 'SELECT_NODE_ID', nodeId, notifyParent: true },
                  activeArtboardRef.current
                );
              }}
              onHoverDomNode={(nodeId) => {
                postToIframe({ type: 'HOVER_NODE_ID', nodeId }, 'all');
              }}
              onViewInCode={handleViewSelectedInCode}
              onHoverSpacing={setActiveSpacingOverlay}
              aspectRatioLocked={selectedAspectRatioLocked}
              onToggleAspectRatioLock={handleToggleAspectRatioLock}
              responsiveScope={responsiveScope}
              onChangeResponsiveScope={setResponsiveScope}
              breakpointScope={activeBreakpointScope}
              onChangeBreakpointScope={handleChangeBreakpointScope}
              onResetScopeOverride={handleResetBreakpointOverride}
              platformTarget={activeRepoTarget}
              projectFiles={files}
              activeHtmlPath={entryHtmlPath}
              activeHtmlContent={activeHtmlFile?.content ?? ''}
              htmlPages={htmlPages}
              primaryCssPath={primaryCssFile?.path ?? null}
              stylesCssContent={primaryCssFile?.content ?? ''}
              overrideCssContent={overrideCssFile?.content ?? ''}
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
              history={history}
              onUndoHistory={handleUndo}
              onRedoHistory={handleRedo}
              onJumpToHistoryIndex={handleJumpToHistoryIndex}
              aiCopilot={aiCopilot}
            />
          </>
        )}
      </div>
          </ErrorBoundary>
        </>
      )}

      <CommandPaletteModal
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        hasSelectedElement={Boolean(selectedElement)}
        editorMode={editorMode}
        onToggleMode={() => handleChangeMode(editorMode === 'edit' ? 'interact' : 'edit')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        onToggleZen={handleToggleZenMode}
        onToggleOutlines={handleToggleOutlines}
        onZoom100={() => setCanvasZoom('100')}
        onZoomFit={() => setCanvasZoom('fit')}
        onOpenStartHub={() => setShowStartHub(true)}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onOpenProjectStats={() => setStatsModalOpen(true)}
        onOpenGlobalFindReplace={() => {
          setShowStartHub(false);
          setGlobalFindReplaceOpen(true);
        }}
        onToggleComponentLibrary={() => {
          setShowStartHub(false);
          if (leftSidebarCollapsed) {
            setLeftSidebarCollapsed(false);
            setComponentLibraryOpen(true);
          } else {
            setComponentLibraryOpen((prev) => !prev);
          }
        }}
        onOpenGithub={() => setGithubCommitModalOpen(true)}
        onOpenHistoryTimeline={handleOpenHistoryTimeline}
        onExportZip={() => void handleExportZip()}
        onExportJson={handleExportJson}
        onExportPngSnapshot={() => void handleExportSnapshot('png')}
        onExportSvgSnapshot={() => void handleExportSnapshot('svg')}
        onApplyFont={(fontCssValue, label) => {
          if (!selectedElement) {
            showToast('Select an element on the canvas first');
            return;
          }
          handleCommitFormattingStyle({ 'font-family': fontCssValue }, `Font: ${label}`);
          showToast(`Applied ${label}`);
        }}
        onQuickInsertComponent={(componentId) => {
          setShowStartHub(false);
          handleQuickInsertById(componentId);
        }}
        onSelectTemplate={handleLoadTemplate}
      />

      <GlobalFindReplaceModal
        open={globalFindReplaceOpen}
        onClose={() => setGlobalFindReplaceOpen(false)}
        files={files}
        onExecuteBulkReplace={handleGlobalBulkReplace}
        onOpenFileAtLine={(path, lineNumber) => {
          setActiveFilePath(path);
          setCenterTab('code');
          setJumpToLine({ path, line: lineNumber, token: Date.now() });
        }}
      />

      <ProjectStatsModal
        open={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        projectName={projectName}
        files={files}
        onOpenFile={(path) => {
          setActiveFilePath(path);
          setCenterTab('code');
        }}
      />

      <ShortcutsModal
        open={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
        onExecuteShortcut={(action) => executeShortcutAction(action)}
      />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[var(--studio-surface)]/95 backdrop-blur-md border border-[var(--studio-border-strong)] ring-1 ring-[var(--studio-accent)]/25 studio-panel-shadow text-[11.5px] font-medium text-[var(--studio-text-strong)] pointer-events-none whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}


import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Blocks,
  Check,
  Globe,
  Monitor,
  ChevronDown,
  Columns3,
  Command,
  Download,
  FileArchive,
  FileJson,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  History,
  Home,
  Image as ImageIcon,
  Keyboard,
  Laptop,
  Moon,
  MousePointer2,
  Palette,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Sun,
  Tablet,
  Upload,
} from 'lucide-react';
import type {
  AutoSaveStatus,
  EditorMode,
  StudioThemeId,
  ViewportPreset,
} from '../types/editor';
import type { GitHubConnectionConfig } from '../utils/githubSync';
import type { RepoTarget } from '../utils/repoTargets';
import {
  GitHubCommitModal,
  type GitHubOAuthProps,
  GitHubSyncPopover,
} from './GitHubSyncModal';
import {
  DuotoneUndoIcon,
  FramecraftLogoMark,
  HoverIconButton,
} from './StudioPrimitives';

const STUDIO_THEMES: Array<{
  id: StudioThemeId;
  label: string;
  mode: 'dark' | 'light';
  swatch: string;
}> = [
  { id: 'obsidian', label: 'Obsidian Dark', mode: 'dark', swatch: '#09090b' },
  { id: 'slate', label: 'Midnight Slate', mode: 'dark', swatch: '#0f172a' },
  { id: 'daylight', label: 'Daylight Light', mode: 'light', swatch: '#f1f5f9' },
  { id: 'paper', label: 'Warm Paper Light', mode: 'light', swatch: '#f5f2eb' },
];

interface TopToolbarProps extends GitHubOAuthProps {
  projectName: string;
  editorMode: EditorMode;
  onChangeMode: (mode: EditorMode) => void;
  viewport: ViewportPreset;
  onChangeViewport: (viewport: ViewportPreset) => void;
  repoTargets: RepoTarget[];
  activeRepoTargetId: string | null;
  onChangeRepoTarget: (targetId: string) => void;
  overlapXray: boolean;
  onToggleOverlapXray: () => void;
  studioTheme: StudioThemeId;
  onChangeStudioTheme: (theme: StudioThemeId) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onResetProject: () => void;
  onExportZip: () => void;
  onExportJson: () => void;
  onExportPngSnapshot: () => void;
  onExportSvgSnapshot: () => void;
  onUploadFiles: (fileList: FileList) => void;
  autoSaveStatus: AutoSaveStatus;
  onConnectDiskFolder: () => void;
  onOpenStartHub: () => void;
  onOpenCommandPalette: () => void;
  onOpenShortcuts: () => void;
  onOpenProjectStats: () => void;
  historyTimelineActive: boolean;
  onOpenHistoryTimeline: () => void;
  componentLibraryOpen: boolean;
  onToggleComponentLibrary: () => void;
  githubOpen: boolean;
  onToggleGithubOpen: (open: boolean) => void;
  commitModalOpen: boolean;
  onToggleCommitModal: (open: boolean) => void;
  githubConnection: GitHubConnectionConfig;
  githubToken: string;
  onChangeGithubToken: (token: string) => void;
  githubBusyAction: 'pull' | 'push' | null;
  githubStatusError: string | null;
  githubStatusMessage: string | null;
  githubRequiresAuthPrompt: boolean;
  onPullFromGitHub: (repoUrl: string, branch: string, token: string) => Promise<void>;
  onPushToGitHub: (
    repoUrl: string,
    branch: string,
    commitMessage: string,
    token: string
  ) => Promise<void>;
  onToggleGithubAutoSync: (enabled: boolean, repoUrl: string, branch: string) => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  projectName,
  editorMode,
  onChangeMode,
  viewport,
  onChangeViewport,
  repoTargets,
  activeRepoTargetId,
  onChangeRepoTarget,
  overlapXray,
  onToggleOverlapXray,
  studioTheme,
  onChangeStudioTheme,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveProject,
  onResetProject,
  onExportZip,
  onExportJson,
  onExportPngSnapshot,
  onExportSvgSnapshot,
  onUploadFiles,
  autoSaveStatus,
  onConnectDiskFolder,
  onOpenStartHub,
  onOpenCommandPalette,
  onOpenShortcuts,
  onOpenProjectStats,
  historyTimelineActive,
  onOpenHistoryTimeline,
  componentLibraryOpen,
  onToggleComponentLibrary,
  githubOpen,
  onToggleGithubOpen,
  commitModalOpen,
  onToggleCommitModal,
  githubConnection,
  githubToken,
  onChangeGithubToken,
  githubBusyAction,
  githubStatusError,
  githubStatusMessage,
  githubRequiresAuthPrompt,
  onPullFromGitHub,
  onPushToGitHub,
  onToggleGithubAutoSync,
  githubUser,
  githubAccountReadOnly,
  githubRepos,
  githubReposLoading,
  githubReposError,
  githubConnecting,
  githubOAuthConfigured,
  githubCallbackUrl,
  onConnectGitHub,
  onDisconnectGitHub,
  onRefreshGitHubRepos,
  onBrowseGitHubUsername,
  onFetchRepoBranches,
  onSwitchBranch,
}) => {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const isLightTheme = studioTheme === 'daylight' || studioTheme === 'paper';

  useEffect(() => {
    if (!themeMenuOpen && !exportMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (themeMenuOpen && themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (exportMenuOpen && exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
        setExportMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [themeMenuOpen, exportMenuOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <>
      <header className="h-12 shrink-0 border border-[var(--studio-border)] rounded-[14px] bg-[var(--studio-surface)] studio-panel-shadow px-2.5 flex items-center justify-between gap-2 select-none relative z-30 overflow-x-auto overflow-y-hidden builder-scroll">
      {/* Left: Architectural Mark, Project Title & Icon-Only Loaders */}
      <div className="flex items-center gap-2 min-w-0">
        <HoverIconButton
          onClick={onOpenStartHub}
          label="Projects"
          ariaLabel="Open Start Hub"
          title="Open Start Hub & Starter Templates"
          size="sm"
          icon={<Home className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.5} />}
        />

        <button
          type="button"
          onClick={onOpenStartHub}
          title="Return to Project Hub"
          className="flex items-center gap-2 shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <FramecraftLogoMark className="w-6 h-6" />
          <span className="font-display font-semibold text-[14px] tracking-[-0.02em] text-[var(--studio-text-strong)] whitespace-nowrap">
            Framecraft
          </span>
        </button>

        <span className="text-[var(--studio-muted-soft)] text-xs shrink-0" aria-hidden="true">
          /
        </span>

        <h1
          className="font-display text-[13px] font-medium tracking-[-0.01em] text-[var(--studio-text-secondary)] truncate max-w-40 min-w-12"
          title={projectName}
        >
          {projectName}
        </h1>

        <div className="flex items-center gap-1 shrink-0 ml-1 pl-2 border-l border-[var(--studio-border)]">
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".html,.htm,.css,.scss,.js,.mjs,.cjs,.ts,.mts,.cts,.tsx,.jsx,.json,.svg,.txt,.md,.xml,.yml,.yaml,.kt,.kts,.gradle,.properties,.pro,.sh,.png,.jpg,.jpeg,.gif,.webp,.bmp,.avif,.ico,.woff,.woff2,.apk"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload project files"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            webkitdirectory=""
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload project folder"
          />
          <HoverIconButton
            onClick={() => filesInputRef.current?.click()}
            label="Load Files"
            ariaLabel="Load Files"
            title="Load individual project files"
            icon={<Upload className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.35} />}
          />
          <HoverIconButton
            onClick={() => folderInputRef.current?.click()}
            label="Load Folder"
            ariaLabel="Load Folder"
            title="Load full project folder"
            icon={<FolderOpen className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.35} />}
          />
        </div>
      </div>

      {/* Center: Target Switch, Mode Switch & Icon-Only Viewport Presets */}
      <div className="flex items-center gap-2 shrink-0">
        {repoTargets.length > 1 && (
          <div
            className="inline-flex items-center h-8 p-0.5 rounded-[10px] bg-[var(--studio-bg)] border border-[var(--studio-border)]"
            role="group"
            aria-label="Project Target"
          >
            {repoTargets.map((target) => {
              const active = target.id === activeRepoTargetId;
              const Icon =
                target.kind === 'mobile' ? Smartphone : target.kind === 'desktop' ? Monitor : Globe;
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => onChangeRepoTarget(target.id)}
                  aria-pressed={active}
                  aria-label={`Switch to ${target.label}`}
                  title={`${target.label} · ${target.framework}${target.rootPath ? ` · ${target.rootPath}` : ''}`}
                  className={`inline-flex items-center h-full px-2 rounded-md text-[11.5px] font-medium studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                      : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
                  <span className="studio-reveal-label">{target.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div
          className="inline-flex items-center h-8 p-0.5 rounded-[10px] bg-[var(--studio-bg)] border border-[var(--studio-border)]"
          role="group"
          aria-label="Editor Mode"
        >
          <button
            type="button"
            onClick={() => onChangeMode('edit')}
            aria-pressed={editorMode === 'edit'}
            title="Editing Mode (Ctrl+E)"
            className={`inline-flex items-center gap-1.5 h-full px-2.5 rounded-md text-[11.5px] font-semibold studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'edit'
                ? 'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[0_2px_10px_-4px_rgba(20,163,146,0.9)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" strokeWidth={1.4} />
            Editing Mode
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('interact')}
            aria-pressed={editorMode === 'interact'}
            title="Using Mode (Ctrl+E)"
            className={`inline-flex items-center gap-1.5 h-full px-2.5 rounded-md text-[11.5px] font-semibold studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'interact'
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[0_2px_10px_-4px_rgba(16,185,129,0.8)]'
                : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
            }`}
          >
            <Play className="w-3.5 h-3.5" strokeWidth={1.4} />
            Using Mode
          </button>
        </div>

        <div
          className="inline-flex items-center h-8 p-0.5 rounded-[10px] bg-[var(--studio-bg)] border border-[var(--studio-border)]"
          role="group"
          aria-label="Viewport Width"
        >
          {(
            [
              { id: 'desktop', label: 'Desktop', key: '1', icon: Laptop },
              { id: 'tablet', label: 'Tablet', key: '2', icon: Tablet },
              { id: 'mobile', label: 'Mobile', key: '3', icon: Smartphone },
              { id: 'all', label: 'All Viewports', key: '4', icon: Columns3 },
            ] as const
          ).map(({ id, label, key, icon: Icon }) => {
            const active = viewport === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChangeViewport(id)}
                aria-label={id === 'all' ? 'All Viewports' : `${label} viewport`}
                aria-pressed={active}
                title={id === 'all' ? `All Viewports (${key})` : `${label} viewport (${key})`}
                className={`group inline-flex items-center h-full px-2 rounded-md text-[11.5px] font-medium studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
                  active && id === 'all' ? 'studio-reveal-open' : ''
                } ${
                  active
                    ? 'bg-[var(--studio-surface)] text-[var(--studio-text-strong)] shadow-xs border border-[var(--studio-border)]'
                    : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
                <span className="studio-reveal-label">{label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToggleOverlapXray}
          aria-pressed={overlapXray}
          aria-label="Toggle Overlap X-Ray"
          title="Overlap X-Ray — highlight colliding and horizontally overflowing elements at this resolution"
          className={`inline-flex items-center h-8 px-2 rounded-md border text-[11.5px] font-medium studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
            overlapXray
              ? 'border-amber-500/70 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-[var(--studio-border)] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
          <span className="studio-reveal-label">Overlap X-Ray</span>
        </button>
      </div>

      {/* Right: Icon-Only Utilities (Reveal on Hover) + Critical Primary Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="inline-flex items-center gap-1 pr-1.5 border-r border-[var(--studio-border)]">
          <HoverIconButton
            onClick={onUndo}
            disabled={!canUndo}
            label="Undo"
            ariaLabel="Undo"
            title="Undo (Ctrl+Z)"
            icon={<DuotoneUndoIcon className="w-3.5 h-3.5" />}
          />
          <HoverIconButton
            onClick={onRedo}
            disabled={!canRedo}
            label="Redo"
            ariaLabel="Redo"
            title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            icon={<Redo2 className="w-3.5 h-3.5" strokeWidth={1.4} />}
          />
          <HoverIconButton
            onClick={onOpenHistoryTimeline}
            active={historyTimelineActive}
            tone="accent"
            label="History"
            ariaLabel="Open Visual History Timeline"
            title="Visual History Timeline (Jump to any state)"
            icon={
              <History
                className={`w-3.5 h-3.5 ${
                  historyTimelineActive
                    ? 'text-indigo-500 dark:text-indigo-300'
                    : 'text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]'
                }`}
                strokeWidth={1.4}
              />
            }
          />
          <HoverIconButton
            onClick={onSaveProject}
            label="Save"
            ariaLabel="Save changes"
            title="Save changes to disk / storage (Ctrl+S)"
            icon={<Save className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.4} />}
          />
          <HoverIconButton
            onClick={onConnectDiskFolder}
            label={autoSaveStatus.diskConnected ? 'Disk Synced' : 'Disk Save'}
            ariaLabel={autoSaveStatus.diskConnected ? 'Disk Synced' : 'Grant Disk Save'}
            title={
              autoSaveStatus.diskConnected
                ? `Synced to folder: ${autoSaveStatus.diskFolderName}`
                : 'Grant write access to a local folder to save edits directly to disk'
            }
            active={autoSaveStatus.diskConnected}
            icon={
              <HardDrive
                className={`w-3.5 h-3.5 ${
                  autoSaveStatus.diskConnected
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]'
                }`}
                strokeWidth={1.4}
              />
            }
          />
        </div>

        {/* Theme Selector (Icon-Only, Reveals Label on Hover) */}
        <div className="relative" ref={themeMenuRef}>
          <HoverIconButton
            onClick={() => setThemeMenuOpen((prev) => !prev)}
            label={isLightTheme ? 'Light' : 'Dark'}
            ariaLabel="Switch light or dark theme"
            ariaExpanded={themeMenuOpen}
            title={`Theme: ${STUDIO_THEMES.find((t) => t.id === studioTheme)?.label ?? 'Dark'}`}
            icon={
              isLightTheme ? (
                <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" strokeWidth={1.5} />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={1.5} />
              )
            }
          />

          {themeMenuOpen && (
            <div
              role="menu"
              aria-label="Studio Themes"
              className="absolute right-0 top-full mt-2 w-48 z-50 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-xl studio-card-highlight p-1.5 space-y-0.5"
            >
              <div className="px-2 py-1 flex items-center gap-1.5 studio-section-header">
                <Palette className="w-3 h-3" />
                Studio Theme
              </div>
              {STUDIO_THEMES.map((item) => {
                const selected = item.id === studioTheme;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChangeStudioTheme(item.id);
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300'
                        : 'text-[var(--studio-text)] hover:bg-[var(--studio-hover)]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-[var(--studio-border-strong)] shrink-0"
                        style={{ backgroundColor: item.swatch }}
                      />
                      {item.label}
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <HoverIconButton
          onClick={onToggleComponentLibrary}
          active={componentLibraryOpen}
          tone="accent"
          label="Library"
          ariaLabel="Toggle Component Library drawer"
          title="Component Library Drawer"
          icon={
            <Blocks
              className={`w-3.5 h-3.5 ${
                componentLibraryOpen
                  ? 'text-indigo-500 dark:text-indigo-300'
                  : 'text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]'
              }`}
              strokeWidth={1.5}
            />
          }
        />

        <HoverIconButton
          onClick={onOpenProjectStats}
          label="Stats"
          ariaLabel="Open Project Statistics"
          title="Project Statistics (File Count, LOC & Distribution)"
          icon={<BarChart3 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" strokeWidth={1.5} />}
        />

        <HoverIconButton
          onClick={onOpenCommandPalette}
          label="Commands"
          ariaLabel="Open Command Palette"
          title="Command Palette (Ctrl/Cmd + K)"
          icon={<Command className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" strokeWidth={1.5} />}
        />

        <HoverIconButton
          onClick={onOpenShortcuts}
          label="Shortcuts"
          ariaLabel="Keyboard shortcuts"
          title="Keyboard Shortcuts (Shift + ?)"
          icon={<Keyboard className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
        />

        <HoverIconButton
          onClick={onResetProject}
          label="Reset"
          ariaLabel="Reset project"
          title="Reset to original project state"
          icon={<RotateCcw className="w-3.5 h-3.5 text-[var(--studio-muted)] group-hover:text-[var(--studio-text-strong)]" strokeWidth={1.4} />}
        />

        {/* Sync to GitHub & Dedicated Commit Modal Trigger */}
        <div className="relative pl-1 border-l border-[var(--studio-border)] flex items-center gap-1" data-github-sync-root="true">
          <button
            type="button"
            onClick={() => {
              if (commitModalOpen) onToggleCommitModal(false);
              onToggleGithubOpen(!githubOpen);
            }}
            aria-expanded={githubOpen}
            title={
              githubConnection.repoFullName
                ? `GitHub: ${githubConnection.repoFullName} (${githubConnection.branch})`
                : 'Connect a GitHub repository URL to pull or commit & push'
            }
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11.5px] font-semibold border studio-card-highlight studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              githubConnection.repoFullName
                ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text-strong)]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            Sync to GitHub
            {githubConnection.autoSync && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                title="Instant auto-sync active"
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (githubOpen) onToggleGithubOpen(false);
              onToggleCommitModal(!commitModalOpen);
            }}
            aria-haspopup="dialog"
            aria-expanded={commitModalOpen}
            title="Open GitHub Commit & Pull modal"
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11.5px] font-semibold border studio-card-highlight studio-pressable whitespace-nowrap shrink-0 cursor-pointer ${
              commitModalOpen
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                : 'bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] border-[var(--studio-border)] text-[var(--studio-text-strong)]'
            }`}
          >
            <GitCommitHorizontal className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            Commit
          </button>

          <GitHubSyncPopover
            open={githubOpen}
            onClose={() => onToggleGithubOpen(false)}
            connection={githubConnection}
            token={githubToken}
            onChangeToken={onChangeGithubToken}
            busyAction={githubBusyAction}
            statusError={githubStatusError}
            statusMessage={githubStatusMessage}
            requiresAuthPrompt={githubRequiresAuthPrompt}
            onPullFromGitHub={onPullFromGitHub}
            onPushToGitHub={onPushToGitHub}
            onToggleAutoSync={onToggleGithubAutoSync}
            githubUser={githubUser}
            githubAccountReadOnly={githubAccountReadOnly}
            githubRepos={githubRepos}
            githubReposLoading={githubReposLoading}
            githubReposError={githubReposError}
            githubConnecting={githubConnecting}
            githubOAuthConfigured={githubOAuthConfigured}
            githubCallbackUrl={githubCallbackUrl}
            onConnectGitHub={onConnectGitHub}
            onDisconnectGitHub={onDisconnectGitHub}
            onRefreshGitHubRepos={onRefreshGitHubRepos}
            onBrowseGitHubUsername={onBrowseGitHubUsername}
            onFetchRepoBranches={onFetchRepoBranches}
            onSwitchBranch={onSwitchBranch}
          />
        </div>

        {/* Export Dropdown Menu (ZIP, JSON, PNG Snapshot, SVG Snapshot) */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen((prev) => !prev)}
            data-testid="export-menu-button"
            aria-haspopup="menu"
            aria-expanded={exportMenuOpen}
            aria-label="Export options"
            title="Export ZIP, JSON, or PNG/SVG visual snapshot"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-[11.5px] font-semibold text-white bg-gradient-to-b from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-600 border border-indigo-400/40 shadow-[0_8px_20px_-12px_rgba(20,163,146,0.95)] studio-pressable whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 opacity-85 shrink-0" strokeWidth={1.7} />
          </button>

          {exportMenuOpen && (
            <div
              role="menu"
              aria-label="Export options"
              data-testid="export-menu-popover"
              className="absolute right-0 top-full mt-2 w-60 z-50 rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] shadow-xl studio-card-highlight p-1.5 space-y-0.5"
            >
              <div className="px-2.5 py-1 studio-section-header">Export Project &amp; Preview</div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportZip();
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
              >
                <FileArchive className="w-4 h-4 text-indigo-500 dark:text-indigo-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--studio-text-strong)]">
                    Export as ZIP Archive
                  </div>
                  <div className="text-[10.5px] text-[var(--studio-muted)]">
                    Full workspace source files &amp; assets
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportJson();
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
              >
                <FileJson className="w-4 h-4 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--studio-text-strong)]">
                    Export to JSON
                  </div>
                  <div className="text-[10.5px] text-[var(--studio-muted)]">
                    Structured project tree &amp; metadata
                  </div>
                </div>
              </button>

              <div className="my-1 border-t border-[var(--studio-border-subtle)]" />

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportPngSnapshot();
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-sky-500 dark:text-sky-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--studio-text-strong)]">
                    Export PNG Snapshot
                  </div>
                  <div className="text-[10.5px] text-[var(--studio-muted)]">
                    High-DPI raster image of canvas preview
                  </div>
                </div>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setExportMenuOpen(false);
                  onExportSvgSnapshot();
                }}
                className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[var(--studio-hover)] transition-colors cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-violet-500 dark:text-violet-400 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--studio-text-strong)]">
                    Export SVG Snapshot
                  </div>
                  <div className="text-[10.5px] text-[var(--studio-muted)]">
                    Scalable vector &amp; HTML preview capture
                  </div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

      <GitHubCommitModal
        open={commitModalOpen}
        onClose={() => onToggleCommitModal(false)}
        connection={githubConnection}
        token={githubToken}
        onChangeToken={onChangeGithubToken}
        busyAction={githubBusyAction}
        statusError={githubStatusError}
        statusMessage={githubStatusMessage}
        requiresAuthPrompt={githubRequiresAuthPrompt}
        githubUser={githubUser}
        githubAccountReadOnly={githubAccountReadOnly}
        githubRepos={githubRepos}
        githubConnecting={githubConnecting}
        githubOAuthConfigured={githubOAuthConfigured}
        onConnectGitHub={onConnectGitHub}
        onRefreshGitHubRepos={onRefreshGitHubRepos}
        onFetchRepoBranches={onFetchRepoBranches}
        onSwitchBranch={onSwitchBranch}
        onPullFromGitHub={onPullFromGitHub}
        onPushToGitHub={onPushToGitHub}
      />
    </>
  );
};

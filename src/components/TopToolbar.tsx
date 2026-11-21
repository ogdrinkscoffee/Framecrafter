import React, { useRef } from 'react';
import {
  Download,
  FolderOpen,
  HardDrive,
  Keyboard,
  Laptop,
  MousePointer2,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Tablet,
  Upload,
} from 'lucide-react';
import type { AutoSaveStatus, EditorMode, ViewportPreset } from '../types/editor';

interface TopToolbarProps {
  projectName: string;
  editorMode: EditorMode;
  onChangeMode: (mode: EditorMode) => void;
  viewport: ViewportPreset;
  onChangeViewport: (viewport: ViewportPreset) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSaveProject: () => void;
  onResetProject: () => void;
  onExportZip: () => void;
  onUploadFiles: (fileList: FileList) => void;
  autoSaveStatus: AutoSaveStatus;
  onConnectDiskFolder: () => void;
  onOpenShortcuts: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  projectName,
  editorMode,
  onChangeMode,
  viewport,
  onChangeViewport,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveProject,
  onResetProject,
  onExportZip,
  onUploadFiles,
  autoSaveStatus,
  onConnectDiskFolder,
  onOpenShortcuts,
}) => {
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="h-13 shrink-0 border-b border-white/[0.08] bg-[#111114] px-3 flex items-center justify-between gap-2 select-none">
      {/* Left: Brand Mark, Project Title & Loaders */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <FramecraftBrandMark />
          <span className="font-display font-semibold text-[14px] tracking-[-0.015em] text-zinc-100 whitespace-nowrap">
            Framecraft
          </span>
        </div>

        <span className="text-zinc-700 text-sm shrink-0" aria-hidden="true">
          /
        </span>

        <h1
          className="font-display text-[14px] font-semibold tracking-[-0.015em] text-[#e4e4e7] truncate max-w-44 min-w-16"
          title={projectName}
        >
          {projectName}
        </h1>

        <div className="flex items-center gap-1 shrink-0 ml-0.5">
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".html,.htm,.css,.scss,.js,.mjs,.cjs,.ts,.mts,.cts,.tsx,.jsx,.json,.svg,.txt,.md,.xml,.yml,.yaml,.kt,.kts,.gradle,.properties,.pro,.sh,.png,.jpg,.jpeg,.gif,.webp,.ico,.woff,.woff2,.apk"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload project files"
          />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            // @ts-expect-error webkitdirectory is supported in Chromium/Firefox/Safari
            webkitdirectory=""
            className="hidden"
            onChange={handleFileChange}
            aria-label="Upload project folder"
          />
          <button
            type="button"
            onClick={() => filesInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11.5px] font-medium text-[#e4e4e7] bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
            Load Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11.5px] font-medium text-[#e4e4e7] bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
            Load Folder
          </button>
        </div>
      </div>

      {/* Center: Pill Segmented Mode Switch & Viewport Presets */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="inline-flex items-center p-0.5 rounded-full bg-[#09090b] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Editor Mode"
        >
          <button
            type="button"
            onClick={() => onChangeMode('edit')}
            aria-pressed={editorMode === 'edit'}
            title="Editing Mode (Ctrl+E)"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'edit'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_0_16px_rgba(99,102,241,0.38),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Editing Mode
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('interact')}
            aria-pressed={editorMode === 'interact'}
            title="Using Mode (Ctrl+E)"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'interact'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.32),inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Play className="w-3.5 h-3.5" strokeWidth={1.5} />
            Using Mode
          </button>
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-full bg-[#09090b] border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Viewport Width"
        >
          <button
            type="button"
            onClick={() => onChangeViewport('desktop')}
            aria-label="Desktop viewport"
            aria-pressed={viewport === 'desktop'}
            title="Desktop viewport (1)"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'desktop'
                ? 'bg-[#27272a] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" strokeWidth={1.5} />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('tablet')}
            aria-label="Tablet viewport"
            aria-pressed={viewport === 'tablet'}
            title="Tablet viewport (2)"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-[#27272a] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" strokeWidth={1.5} />
            Tablet
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('mobile')}
            aria-label="Mobile viewport"
            aria-pressed={viewport === 'mobile'}
            title="Mobile viewport (3)"
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-[#27272a] text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" strokeWidth={1.5} />
            Mobile
          </button>
        </div>
      </div>

      {/* Right: Undo, Redo, Save, Disk Sync, Shortcuts, Reset, Export */}
      <div className="flex items-center gap-1 shrink-0">
        <div className="inline-flex items-center p-0.5 rounded-lg bg-[#18181b] border border-white/[0.08] studio-card-highlight">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-[#27272a] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-[#27272a] disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <button
          type="button"
          onClick={onSaveProject}
          aria-label="Save changes"
          title="Save changes to disk / storage (Ctrl+S)"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-medium text-[#e4e4e7] bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
          Save
        </button>

        <button
          type="button"
          onClick={onConnectDiskFolder}
          title={
            autoSaveStatus.diskConnected
              ? `Synced to folder: ${autoSaveStatus.diskFolderName}`
              : 'Grant write access to a local folder to save edits directly to disk'
          }
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-medium border studio-card-highlight transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            autoSaveStatus.diskConnected
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'text-zinc-300 hover:text-zinc-100 bg-[#18181b] hover:bg-[#27272a] border-white/[0.08]'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" strokeWidth={1.5} />
          {autoSaveStatus.diskConnected ? 'Disk Synced' : 'Grant Disk Save'}
        </button>

        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard Shortcuts (?)"
          className="p-1.5 rounded-lg text-zinc-300 hover:text-zinc-100 bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight transition-colors shrink-0 cursor-pointer"
        >
          <Keyboard className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <button
          type="button"
          onClick={onResetProject}
          aria-label="Reset project"
          title="Reset to original project state"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11.5px] font-medium text-zinc-300 hover:text-zinc-100 bg-[#18181b] hover:bg-[#27272a] border border-white/[0.08] studio-card-highlight transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
          Reset
        </button>

        <button
          type="button"
          onClick={onExportZip}
          title="Export modified project as ZIP"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-white bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border border-indigo-400/30 shadow-[0_0_20px_rgba(99,102,241,0.35),inset_0_1px_0_rgba(255,255,255,0.22)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Export ZIP
        </button>
      </div>
    </header>
  );
};

function FramecraftBrandMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_0_10px_rgba(99,102,241,0.35)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="framecraft-brand-bg" x1="2" y1="2" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="7" fill="url(#framecraft-brand-bg)" />
      <rect
        x="0.75"
        y="0.75"
        width="26.5"
        height="26.5"
        rx="6.25"
        stroke="white"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      {/* Precision frame + nested UI window geometry */}
      <rect
        x="6.5"
        y="6.5"
        width="15"
        height="15"
        rx="3"
        stroke="white"
        strokeWidth="1.5"
        strokeOpacity="0.95"
      />
      <path d="M6.5 11.5H21.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" />
      <path d="M12.5 11.5V21.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.85" />
      <circle cx="17" cy="16.5" r="1.6" fill="white" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

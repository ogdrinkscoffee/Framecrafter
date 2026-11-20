import React, { useRef } from 'react';
import {
  Download,
  FolderOpen,
  HardDrive,
  Laptop,
  MousePointer2,
  Play,
  Redo2,
  RotateCcw,
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
  onResetProject: () => void;
  onExportZip: () => void;
  onUploadFiles: (fileList: FileList) => void;
  autoSaveStatus: AutoSaveStatus;
  onConnectDiskFolder: () => void;
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
  onResetProject,
  onExportZip,
  onUploadFiles,
  autoSaveStatus,
  onConnectDiskFolder,
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
    <header className="h-13 shrink-0 border-b border-slate-800/90 bg-[#0d121d] px-3.5 flex items-center justify-between gap-3 select-none">
      {/* Left: Brand & Project Loaders */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white font-display font-bold text-sm">
            F
          </div>
          <span className="font-display font-semibold text-sm tracking-tight text-slate-100 whitespace-nowrap">
            Framecraft
          </span>
        </div>

        <div className="h-4 w-px bg-slate-800 shrink-0" aria-hidden="true" />

        <span className="text-xs text-slate-400 truncate max-w-36" title={projectName}>
          {projectName}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={filesInputRef}
            type="file"
            multiple
            accept=".html,.htm,.css,.js,.mjs,.ts,.tsx,.jsx,.json,.svg,.txt,.md"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-400" />
            Load Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
            Load Folder
          </button>
        </div>
      </div>

      {/* Center: Mode Switch & Viewport Presets */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-[#090d16] border border-slate-800"
          role="group"
          aria-label="Editor Mode"
        >
          <button
            type="button"
            onClick={() => onChangeMode('edit')}
            aria-pressed={editorMode === 'edit'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'edit'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            Editing Mode
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('interact')}
            aria-pressed={editorMode === 'interact'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              editorMode === 'interact'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            Using Mode
          </button>
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-[#090d16] border border-slate-800"
          role="group"
          aria-label="Viewport Width"
        >
          <button
            type="button"
            onClick={() => onChangeViewport('desktop')}
            aria-label="Desktop viewport"
            aria-pressed={viewport === 'desktop'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'desktop'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('tablet')}
            aria-label="Tablet viewport"
            aria-pressed={viewport === 'tablet'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'tablet'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" />
            Tablet
          </button>
          <button
            type="button"
            onClick={() => onChangeViewport('mobile')}
            aria-label="Mobile viewport"
            aria-pressed={viewport === 'mobile'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewport === 'mobile'
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Mobile
          </button>
        </div>
      </div>

      {/* Right: Undo, Redo, Disk Save Permission, Reset, Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-md text-slate-300 hover:bg-slate-800 disabled:opacity-35 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={onConnectDiskFolder}
          title={
            autoSaveStatus.diskConnected
              ? `Synced to folder: ${autoSaveStatus.diskFolderName}`
              : 'Grant write access to a local folder to save edits directly to disk'
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            autoSaveStatus.diskConnected
              ? 'bg-emerald-600/15 border-emerald-500/40 text-emerald-300'
              : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800 border-slate-800'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          {autoSaveStatus.diskConnected ? 'Disk Synced' : 'Grant Disk Save'}
        </button>

        <button
          type="button"
          onClick={onResetProject}
          aria-label="Reset project"
          title="Reset to original project state"
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-800 border border-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>

        <button
          type="button"
          onClick={onExportZip}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export ZIP
        </button>
      </div>
    </header>
  );
};

function UndoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );
}

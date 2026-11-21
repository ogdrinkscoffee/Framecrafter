import React, { useMemo, useState } from 'react';
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  Palette,
  PanelLeftClose,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { ProjectFile, SampleTemplate } from '../types/editor';
import { searchProjectFiles } from '../utils/fileSearch';
import {
  buildProjectFileTree,
  getFileBadgeStyle,
  type FileTreeNode,
} from '../utils/fileTree';

interface FileExplorerProps {
  widthPx: number;
  onCollapse: () => void;
  files: ProjectFile[];
  activeFilePath: string | null;
  entryHtmlPath: string | null;
  templates: SampleTemplate[];
  activeTemplateId: string | null;
  onSelectFile: (path: string) => void;
  onOpenCodeEditor: (path: string, lineNumber?: number) => void;
  onDownloadFile: (file: ProjectFile) => void;
  onCreateFile: (filename: string) => void;
  onLoadTemplate: (templateId: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  widthPx,
  onCollapse,
  files,
  activeFilePath,
  entryHtmlPath,
  templates,
  activeTemplateId,
  onSelectFile,
  onOpenCodeEditor,
  onDownloadFile,
  onCreateFile,
  onLoadTemplate,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const searchResults = useMemo(
    () => searchProjectFiles(files, searchQuery),
    [files, searchQuery]
  );

  const fileTree = useMemo(() => buildProjectFileTree(files), [files]);

  const isSearching = searchQuery.trim().length > 0;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFilename.trim();
    if (!trimmed) return;
    onCreateFile(trimmed);
    setNewFilename('');
    setIsCreating(false);
  };

  const toggleFolder = (folderPath: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderPath]: !prev[folderPath] }));
  };

  return (
    <aside
      data-testid="left-sidebar"
      style={{ width: `${widthPx}px` }}
      className="shrink-0 border-r border-white/[0.08] bg-[#111114] flex flex-col min-h-0"
    >
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-white/[0.08] flex items-center justify-between shrink-0">
        <span className="studio-section-header">Project Files</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setIsCreating((prev) => !prev)}
            aria-label="Create new file"
            title="New File"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse Project Files sidebar"
            title="Collapse Project Files (Ctrl+B)"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-colors cursor-pointer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Global Search Input */}
      <div className="p-2.5 border-b border-white/[0.08] bg-[#111114] shrink-0">
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            aria-label="Search files or content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or code..."
            className="w-full bg-[#18181b] hover:bg-[#27272a]/50 border border-white/[0.08] studio-card-highlight rounded-lg pl-8 pr-7 py-1.5 text-[12px] text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 p-0.5 rounded text-zinc-400 hover:text-zinc-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* New File Input */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-2.5 border-b border-white/[0.08] bg-[#09090b] flex items-center gap-1.5"
        >
          <input
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            placeholder="e.g. src/notes.css"
            autoFocus
            className="flex-1 min-w-0 bg-[#18181b] border border-white/[0.1] rounded-md px-2 py-1 text-[12px] font-mono-tabular text-[#e4e4e7] placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded-md bg-gradient-to-b from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-[12px] font-medium text-white shrink-0 cursor-pointer"
          >
            Add
          </button>
        </form>
      )}

      {/* File Tree / Search Results */}
      <div className="flex-1 overflow-y-auto builder-scroll p-2 space-y-0.5">
        {files.length === 0 ? (
          <div className="px-2 py-6 text-xs text-zinc-500 text-center">
            No files loaded. Upload a folder or pick a template below.
          </div>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <div className="px-2 py-6 text-xs text-zinc-500 text-center">
              No matches for &ldquo;{searchQuery.trim()}&rdquo;
            </div>
          ) : (
            searchResults.map(({ file, lineMatches, totalLineMatches }) => {
              const isActive = file.path === activeFilePath;
              const isEntry = file.path === entryHtmlPath;
              return (
                <div key={file.path} className="space-y-0.5">
                  <FileRow
                    file={file}
                    label={file.path}
                    isActive={isActive}
                    isEntry={isEntry}
                    matchCount={totalLineMatches}
                    onSelect={() => {
                      onSelectFile(file.path);
                      onOpenCodeEditor(file.path, lineMatches[0]?.lineNumber);
                    }}
                    onDoubleClick={() => onOpenCodeEditor(file.path)}
                    onDownload={() => onDownloadFile(file)}
                  />

                  {/* Inline Content Match Snippets */}
                  {lineMatches.length > 0 && (
                    <div className="ml-3 pl-2.5 border-l border-white/[0.08] pb-1 space-y-0.5">
                      {lineMatches.map((match) => (
                        <button
                          key={`${file.path}-L${match.lineNumber}`}
                          type="button"
                          onClick={() => onOpenCodeEditor(file.path, match.lineNumber)}
                          className="w-full text-left flex items-baseline gap-1.5 px-1.5 py-1 rounded-md text-[11px] text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a]/70 transition-colors cursor-pointer"
                        >
                          <span className="font-mono-tabular text-indigo-400 shrink-0">
                            L{match.lineNumber}
                          </span>
                          <span className="truncate font-mono-tabular">{match.lineText}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          fileTree.map((node) => (
            <TreeNodeBranch
              key={node.path}
              node={node}
              activeFilePath={activeFilePath}
              entryHtmlPath={entryHtmlPath}
              collapsedFolders={collapsedFolders}
              onToggleFolder={toggleFolder}
              onSelectFile={onSelectFile}
              onOpenCodeEditor={onOpenCodeEditor}
              onDownloadFile={onDownloadFile}
            />
          ))
        )}
      </div>

      {/* Starter Templates Section */}
      <div className="border-t border-white/[0.08] p-3 space-y-2.5 shrink-0 bg-[#111114]">
        <div className="studio-section-header">Starter Templates</div>
        <div className="space-y-2">
          {templates.map((tpl) => {
            const isCurrent = tpl.id === activeTemplateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onLoadTemplate(tpl.id)}
                className={`group w-full text-left p-2.5 rounded-xl border studio-card-highlight transition-all duration-150 hover:-translate-y-0.5 cursor-pointer flex items-center gap-2.5 ${
                  isCurrent
                    ? 'bg-[#18181b] border-indigo-500/50 ring-1 ring-indigo-500/25 text-zinc-100 shadow-[0_6px_20px_rgba(99,102,241,0.12),inset_0_1px_0_rgba(255,255,255,0.06)]'
                    : 'bg-[#18181b] border-white/[0.08] text-zinc-200 hover:bg-[#27272a]/75 hover:border-white/[0.16]'
                }`}
              >
                <TemplateWireframeThumb templateId={tpl.id} active={isCurrent} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-[#e4e4e7] truncate group-hover:text-white">
                    {tpl.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                    {tpl.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="pt-0.5 flex items-center justify-between text-[11px] text-zinc-500 font-mono-tabular">
          <span>
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
          <span className="truncate max-w-[140px]" title={entryHtmlPath ?? 'no html entry'}>
            {entryHtmlPath ?? 'no html entry'}
          </span>
        </div>
      </div>
    </aside>
  );
};

interface TreeNodeBranchProps {
  node: FileTreeNode;
  activeFilePath: string | null;
  entryHtmlPath: string | null;
  collapsedFolders: Record<string, boolean>;
  onToggleFolder: (folderPath: string) => void;
  onSelectFile: (path: string) => void;
  onOpenCodeEditor: (path: string) => void;
  onDownloadFile: (file: ProjectFile) => void;
}

const TreeNodeBranch: React.FC<TreeNodeBranchProps> = ({
  node,
  activeFilePath,
  entryHtmlPath,
  collapsedFolders,
  onToggleFolder,
  onSelectFile,
  onOpenCodeEditor,
  onDownloadFile,
}) => {
  if (node.kind === 'file') {
    return (
      <FileRow
        file={node.file}
        label={node.name}
        isActive={node.file.path === activeFilePath}
        isEntry={node.file.path === entryHtmlPath}
        onSelect={() => onSelectFile(node.file.path)}
        onDoubleClick={() => onOpenCodeEditor(node.file.path)}
        onDownload={() => onDownloadFile(node.file)}
      />
    );
  }

  const isCollapsed = Boolean(collapsedFolders[node.path]);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onToggleFolder(node.path)}
        aria-expanded={!isCollapsed}
        className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[12.5px] font-medium text-[#e4e4e7] hover:bg-[#18181b] transition-colors cursor-pointer text-left"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" strokeWidth={1.5} />
        )}
        {isCollapsed ? (
          <Folder className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
        ) : (
          <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" strokeWidth={1.5} />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {!isCollapsed && (
        <div className="ml-3.5 pl-2 border-l border-white/[0.08] space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeBranch
              key={child.path}
              node={child}
              activeFilePath={activeFilePath}
              entryHtmlPath={entryHtmlPath}
              collapsedFolders={collapsedFolders}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              onOpenCodeEditor={onOpenCodeEditor}
              onDownloadFile={onDownloadFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface FileRowProps {
  file: ProjectFile;
  label: string;
  isActive: boolean;
  isEntry: boolean;
  matchCount?: number;
  onSelect: () => void;
  onDoubleClick: () => void;
  onDownload: () => void;
}

const FileRow: React.FC<FileRowProps> = ({
  file,
  label,
  isActive,
  isEntry,
  matchCount,
  onSelect,
  onDoubleClick,
  onDownload,
}) => {
  const badge = getFileBadgeStyle(file.path, file.type);

  return (
    <div
      className={`group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors ${
        isActive
          ? 'bg-indigo-500/15 text-white ring-1 ring-indigo-500/30'
          : 'text-[#e4e4e7] hover:bg-[#18181b] hover:text-white'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
        title={`${file.path} (click to select, double-click to edit code)`}
      >
        <FileExtensionIcon path={file.path} type={file.type} />
        <span className="text-[12.5px] font-medium truncate">{label}</span>
        {typeof matchCount === 'number' && matchCount > 0 ? (
          <span className="text-[10px] font-mono-tabular text-indigo-300 shrink-0 ml-auto">
            {matchCount}
          </span>
        ) : isEntry ? (
          <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 shrink-0 ml-auto">
            entry
          </span>
        ) : (
          <span
            className={`text-[9.5px] font-mono-tabular px-1 py-0.2 rounded border shrink-0 ml-auto opacity-85 group-hover:opacity-100 ${badge.badgeClass}`}
          >
            {badge.shortLabel}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onDownload}
        aria-label={`Download ${file.name}`}
        title={`Download ${file.name}`}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1 p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-[#27272a] transition-opacity shrink-0 cursor-pointer"
      >
        <Download className="w-3 h-3" strokeWidth={1.5} />
      </button>
    </div>
  );
};

function FileExtensionIcon({ path, type }: { path: string; type: ProjectFile['type'] }) {
  const badge = getFileBadgeStyle(path, type);
  switch (badge.category) {
    case 'react':
      return <Sparkles className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    case 'script':
      return <FileCode2 className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    case 'style':
      return <Palette className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    case 'json':
      return <Braces className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    case 'html':
      return <Code2 className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    case 'native':
      return <Cpu className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
    default:
      return <FileText className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.5} />;
  }
}

function TemplateWireframeThumb({ templateId, active }: { templateId: string; active: boolean }) {
  if (templateId === 'pulse-dashboard') {
    return (
      <div
        aria-hidden="true"
        className={`w-12 h-9 rounded-md border shrink-0 overflow-hidden bg-[#09090b] p-1 flex flex-col gap-1 transition-colors ${
          active ? 'border-indigo-400/50' : 'border-white/[0.1] group-hover:border-white/[0.2]'
        }`}
      >
        {/* Top bar wireframe */}
        <div className="flex items-center justify-between">
          <span className="w-3 h-1 rounded-full bg-indigo-400/80" />
          <span className="w-2.5 h-1 rounded-full bg-cyan-400/70" />
        </div>
        {/* 3 KPI tiles */}
        <div className="grid grid-cols-3 gap-0.5">
          <span className="h-2.5 rounded-[2px] bg-indigo-500/30 border border-indigo-400/30" />
          <span className="h-2.5 rounded-[2px] bg-cyan-500/25 border border-cyan-400/30" />
          <span className="h-2.5 rounded-[2px] bg-emerald-500/25 border border-emerald-400/30" />
        </div>
        {/* Checklist bars */}
        <div className="space-y-0.5">
          <div className="h-1 w-full rounded-full bg-zinc-700/80" />
          <div className="h-1 w-4/5 rounded-full bg-zinc-800" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`w-12 h-9 rounded-md border shrink-0 overflow-hidden bg-[#09090b] p-1 flex flex-col justify-between transition-colors ${
        active ? 'border-indigo-400/50' : 'border-white/[0.1] group-hover:border-white/[0.2]'
      }`}
    >
      {/* Hero pill + title + CTAs */}
      <div className="flex flex-col items-center gap-0.5 pt-0.5">
        <span className="w-6 h-1 rounded-full bg-violet-400/80" />
        <span className="w-8 h-0.5 rounded-full bg-zinc-600" />
        <div className="flex items-center gap-0.5 mt-0.5">
          <span className="w-2.5 h-1 rounded-full bg-indigo-500/80" />
          <span className="w-2.5 h-1 rounded-full bg-zinc-700" />
        </div>
      </div>
      {/* 3 pricing columns */}
      <div className="grid grid-cols-3 gap-0.5">
        <span className="h-2.5 rounded-[2px] bg-zinc-800 border border-white/[0.08]" />
        <span className="h-2.5 rounded-[2px] bg-indigo-500/30 border border-indigo-400/40" />
        <span className="h-2.5 rounded-[2px] bg-zinc-800 border border-white/[0.08]" />
      </div>
    </div>
  );
}

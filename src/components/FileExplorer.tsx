import React, { useMemo, useState } from 'react';
import {
  Braces,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  Download,
  FileCode2,
  FileImage,
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
import { HoverIconButton } from './StudioPrimitives';

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
      className="shrink-0 border-r border-[var(--studio-border)] bg-[var(--studio-surface)] flex flex-col min-h-0"
    >
      {/* Header */}
      <div className="h-9 px-3 border-b border-[var(--studio-border)] flex items-center justify-between gap-2 shrink-0">
        <span className="studio-section-header truncate">Project Files</span>
        <div className="flex items-center gap-1 shrink-0">
          <HoverIconButton
            size="xs"
            onClick={() => setIsCreating((prev) => !prev)}
            label="New File"
            ariaLabel="Create new file"
            title="New File"
            active={isCreating}
            tone="accent"
            icon={<FilePlus2 className="w-3.5 h-3.5" strokeWidth={1.4} />}
          />
          <HoverIconButton
            size="xs"
            onClick={onCollapse}
            label="Hide"
            ariaLabel="Collapse Project Files sidebar"
            title="Collapse Project Files (Ctrl+B)"
            icon={<PanelLeftClose className="w-3.5 h-3.5" strokeWidth={1.4} />}
          />
        </div>
      </div>

      {/* Global Search Input */}
      <div className="px-2.5 py-2 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] shrink-0">
        <div className="relative flex items-center">
          <Search
            className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 pointer-events-none"
            strokeWidth={1.4}
          />
          <input
            type="text"
            aria-label="Search files or content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or code..."
            className="w-full h-7 bg-[var(--studio-input)] hover:bg-[var(--studio-hover)]/50 border border-[var(--studio-border)] rounded-md pl-7.5 pr-7 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 transition-colors"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 p-0.5 rounded text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.4} />
            </button>
          )}
        </div>
      </div>

      {/* New File Input */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="px-2.5 py-2 border-b border-[var(--studio-border)] bg-[var(--studio-bg)] flex items-center gap-1.5"
        >
          <input
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            placeholder="e.g. src/notes.css"
            autoFocus
            className="flex-1 min-w-0 h-7 bg-[var(--studio-elevated)] border border-[var(--studio-border-strong)] rounded-md px-2 text-[12px] font-mono-tabular text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
          />
          <button
            type="submit"
            className="h-7 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[11.5px] font-semibold text-white shrink-0 studio-pressable cursor-pointer"
          >
            Add
          </button>
        </form>
      )}

      {/* File Tree / Search Results */}
      <div className="flex-1 overflow-y-auto builder-scroll px-2 py-2 space-y-0.5">
        {files.length === 0 ? (
          <div className="px-2 py-6 text-xs text-[var(--studio-muted-soft)] text-center">
            No files loaded. Upload a folder or pick a template below.
          </div>
        ) : isSearching ? (
          searchResults.length === 0 ? (
            <div className="px-2 py-6 text-xs text-[var(--studio-muted-soft)] text-center">
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

                  {lineMatches.length > 0 && (
                    <div className="ml-3 pl-2.5 border-l border-[var(--studio-border)] pb-1 space-y-0.5">
                      {lineMatches.map((match) => (
                        <button
                          key={`${file.path}-L${match.lineNumber}`}
                          type="button"
                          onClick={() => onOpenCodeEditor(file.path, match.lineNumber)}
                          className="w-full text-left flex items-baseline gap-1.5 px-1.5 py-1 rounded-md text-[11px] text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)]/70 transition-colors cursor-pointer"
                        >
                          <span className="font-mono-tabular text-indigo-600 dark:text-indigo-400 shrink-0">
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
      <div className="border-t border-[var(--studio-border)] p-2.5 space-y-2 shrink-0 bg-[var(--studio-surface)]">
        <div className="studio-section-header px-0.5">Starter Templates</div>
        <div className="space-y-1.5">
          {templates.map((tpl) => {
            const isCurrent = tpl.id === activeTemplateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onLoadTemplate(tpl.id)}
                className={`group w-full text-left p-2 rounded-lg border studio-card-highlight studio-pressable cursor-pointer flex items-center gap-2 ${
                  isCurrent
                    ? 'bg-[var(--studio-elevated)] border-indigo-500/45 text-[var(--studio-text-strong)]'
                    : 'bg-[var(--studio-elevated)]/60 border-[var(--studio-border)] text-[var(--studio-text)] hover:bg-[var(--studio-hover)]/70 hover:border-[var(--studio-border-strong)]'
                }`}
              >
                <TemplateWireframeThumb templateId={tpl.id} active={isCurrent} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-[var(--studio-text-strong)] truncate">
                    {tpl.name}
                  </div>
                  <div className="text-[11px] text-[var(--studio-muted)] line-clamp-1 mt-0.5">
                    {tpl.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="pt-0.5 px-0.5 flex items-center justify-between text-[11px] text-[var(--studio-muted-soft)] font-mono-tabular">
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
        className="w-full h-7 flex items-center gap-1.5 px-2 rounded-md text-[12px] font-medium text-[var(--studio-text)] hover:bg-[var(--studio-elevated)] transition-colors cursor-pointer text-left"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] shrink-0" strokeWidth={1.4} />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] shrink-0" strokeWidth={1.4} />
        )}
        {isCollapsed ? (
          <Folder className="w-3.5 h-3.5 text-[var(--studio-muted)] shrink-0" strokeWidth={1.4} />
        ) : (
          <FolderOpen className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" strokeWidth={1.4} />
        )}
        <span className="truncate">{node.name}</span>
      </button>

      {!isCollapsed && (
        <div className="ml-3.5 pl-2 border-l border-[var(--studio-border)] space-y-0.5">
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
      className={`group h-7 flex items-center justify-between rounded-md px-2 transition-colors ${
        isActive
          ? 'bg-indigo-500/14 text-[var(--studio-text-strong)] ring-1 ring-indigo-500/35'
          : 'text-[var(--studio-text)] hover:bg-[var(--studio-elevated)] hover:text-[var(--studio-text-strong)]'
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
        <span className="text-[12px] font-medium truncate">{label}</span>
        {typeof matchCount === 'number' && matchCount > 0 ? (
          <span className="text-[10px] font-mono-tabular text-indigo-600 dark:text-indigo-300 shrink-0 ml-auto">
            {matchCount}
          </span>
        ) : isEntry ? (
          <span className="text-[10px] font-mono-tabular font-semibold text-indigo-600 dark:text-indigo-300 shrink-0 ml-auto">
            entry
          </span>
        ) : (
          <span
            className={`text-[10px] font-mono-tabular shrink-0 ml-auto opacity-75 group-hover:opacity-100 ${badge.textColorClass}`}
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
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1 p-1 rounded text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)] hover:bg-[var(--studio-hover)] transition-opacity shrink-0 cursor-pointer"
      >
        <Download className="w-3 h-3" strokeWidth={1.4} />
      </button>
    </div>
  );
};

function FileExtensionIcon({ path, type }: { path: string; type: ProjectFile['type'] }) {
  const badge = getFileBadgeStyle(path, type);
  switch (badge.category) {
    case 'react':
      return <Sparkles className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'script':
      return <FileCode2 className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'style':
      return <Palette className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'json':
      return <Braces className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'html':
      return <Code2 className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'image':
      return <FileImage className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    case 'native':
      return <Cpu className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
    default:
      return <FileText className={`w-3.5 h-3.5 ${badge.textColorClass} shrink-0`} strokeWidth={1.4} />;
  }
}

function TemplateWireframeThumb({ templateId, active }: { templateId: string; active: boolean }) {
  if (templateId === 'pulse-dashboard') {
    return (
      <div
        aria-hidden="true"
        className={`w-11 h-8 rounded-md border shrink-0 overflow-hidden bg-[var(--studio-bg)] p-1 flex flex-col gap-0.5 transition-colors ${
          active ? 'border-indigo-500/60' : 'border-[var(--studio-border)] group-hover:border-[var(--studio-border-strong)]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="w-3 h-0.5 rounded-full bg-indigo-500/80" />
          <span className="w-2 h-0.5 rounded-full bg-cyan-500/70" />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <span className="h-2 rounded-[2px] bg-indigo-500/30 border border-indigo-400/40" />
          <span className="h-2 rounded-[2px] bg-cyan-500/25 border border-cyan-400/40" />
          <span className="h-2 rounded-[2px] bg-emerald-500/25 border border-emerald-400/40" />
        </div>
        <div className="space-y-0.5">
          <div className="h-0.5 w-full rounded-full bg-[var(--studio-muted-soft)]/50" />
          <div className="h-0.5 w-4/5 rounded-full bg-[var(--studio-muted-soft)]/35" />
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`w-11 h-8 rounded-md border shrink-0 overflow-hidden bg-[var(--studio-bg)] p-1 flex flex-col justify-between transition-colors ${
        active ? 'border-indigo-500/60' : 'border-[var(--studio-border)] group-hover:border-[var(--studio-border-strong)]'
      }`}
    >
      <div className="flex flex-col items-center gap-0.5 pt-0.5">
        <span className="w-5 h-0.5 rounded-full bg-violet-500/80" />
        <span className="w-7 h-0.5 rounded-full bg-[var(--studio-muted-soft)]/50" />
      </div>
      <div className="grid grid-cols-3 gap-0.5">
        <span className="h-2 rounded-[2px] bg-[var(--studio-hover)] border border-[var(--studio-border)]" />
        <span className="h-2 rounded-[2px] bg-indigo-500/30 border border-indigo-400/40" />
        <span className="h-2 rounded-[2px] bg-[var(--studio-hover)] border border-[var(--studio-border)]" />
      </div>
    </div>
  );
}

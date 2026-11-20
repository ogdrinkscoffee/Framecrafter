import React, { useMemo, useState } from 'react';
import {
  Braces,
  Code2,
  Download,
  FileCode,
  FilePlus2,
  FileText,
  Palette,
  Search,
  X,
} from 'lucide-react';
import type { ProjectFile, SampleTemplate } from '../types/editor';
import { searchProjectFiles } from '../utils/fileSearch';

interface FileExplorerProps {
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

  const searchResults = useMemo(
    () => searchProjectFiles(files, searchQuery),
    [files, searchQuery]
  );

  const isSearching = searchQuery.trim().length > 0;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFilename.trim();
    if (!trimmed) return;
    onCreateFile(trimmed);
    setNewFilename('');
    setIsCreating(false);
  };

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/90 bg-[#0c111b] flex flex-col min-h-0">
      {/* Header */}
      <div className="h-10 px-3.5 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-slate-200 tracking-tight">
          Project Files
        </span>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          aria-label="Create new file"
          title="New File"
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <FilePlus2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Global Search Input */}
      <div className="p-2 border-b border-slate-800/80 bg-[#0a0f18] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            aria-label="Search files or content"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or code..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-md pl-8 pr-7 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 p-0.5 rounded text-slate-400 hover:text-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* New File Input */}
      {isCreating && (
        <form
          onSubmit={handleCreateSubmit}
          className="p-2.5 border-b border-slate-800/80 bg-[#090d16] flex items-center gap-1.5"
        >
          <input
            type="text"
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
            placeholder="e.g. notes.css"
            autoFocus
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shrink-0 cursor-pointer"
          >
            Add
          </button>
        </form>
      )}

      {/* File Tree / Search Results */}
      <div className="flex-1 overflow-y-auto builder-scroll p-2 space-y-0.5">
        {files.length === 0 ? (
          <div className="px-2 py-6 text-xs text-slate-500 text-center">
            No files loaded. Upload a folder or pick a template below.
          </div>
        ) : searchResults.length === 0 ? (
          <div className="px-2 py-6 text-xs text-slate-500 text-center">
            No matches for &ldquo;{searchQuery.trim()}&rdquo;
          </div>
        ) : (
          searchResults.map(({ file, lineMatches, totalLineMatches }) => {
            const isActive = file.path === activeFilePath;
            const isEntry = file.path === entryHtmlPath;
            return (
              <div key={file.path} className="space-y-0.5">
                <div
                  className={`group flex items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-200'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectFile(file.path);
                      if (isSearching) {
                        onOpenCodeEditor(file.path, lineMatches[0]?.lineNumber);
                      }
                    }}
                    onDoubleClick={() => onOpenCodeEditor(file.path)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                    title={`${file.path} (click to select, double-click to edit code)`}
                  >
                    <FileTypeIcon type={file.type} />
                    <span className="text-xs truncate font-medium">{file.path}</span>
                    {isSearching && totalLineMatches > 0 ? (
                      <span className="text-[10px] font-mono-tabular text-blue-400 shrink-0">
                        {totalLineMatches}
                      </span>
                    ) : (
                      isEntry && (
                        <span className="text-[10px] text-slate-400 shrink-0">entry</span>
                      )
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDownloadFile(file)}
                    aria-label={`Download ${file.name}`}
                    title={`Download ${file.name}`}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700/70 transition-opacity shrink-0 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>

                {/* Inline Content Match Snippets */}
                {isSearching && lineMatches.length > 0 && (
                  <div className="pl-5 pr-1 pb-1 space-y-0.5">
                    {lineMatches.map((match) => (
                      <button
                        key={`${file.path}-L${match.lineNumber}`}
                        type="button"
                        onClick={() => onOpenCodeEditor(file.path, match.lineNumber)}
                        className="w-full text-left flex items-baseline gap-1.5 px-1.5 py-1 rounded text-[11px] text-slate-400 hover:text-slate-100 hover:bg-slate-800/70 transition-colors cursor-pointer"
                      >
                        <span className="font-mono-tabular text-slate-500 shrink-0">
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
        )}
      </div>

      {/* Templates Section */}
      <div className="border-t border-slate-800/80 p-3 space-y-2 shrink-0 bg-[#0a0f18]">
        <div className="text-xs font-semibold text-slate-300">Starter Templates</div>
        <div className="space-y-1.5">
          {templates.map((tpl) => {
            const isCurrent = tpl.id === activeTemplateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onLoadTemplate(tpl.id)}
                className={`w-full text-left px-2.5 py-2 rounded-md border transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-800/90 border-blue-500/50 text-slate-100'
                    : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-medium truncate">{tpl.name}</div>
                <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {tpl.description}
                </div>
              </button>
            );
          })}
        </div>
        <div className="pt-1 text-[11px] text-slate-500 font-mono-tabular">
          {files.length} {files.length === 1 ? 'file' : 'files'} ·{' '}
          {entryHtmlPath ?? 'no html entry'}
        </div>
      </div>
    </aside>
  );
};

function FileTypeIcon({ type }: { type: ProjectFile['type'] }) {
  switch (type) {
    case 'html':
      return <Code2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />;
    case 'css':
      return <Palette className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case 'js':
      return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case 'json':
      return <Braces className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
}

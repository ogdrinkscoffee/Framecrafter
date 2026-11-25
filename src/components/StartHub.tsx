import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Keyboard,
  LayoutTemplate,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import type { SampleTemplate, StudioThemeId } from '../types/editor';
import { FramecraftLogoMark } from './StudioPrimitives';

interface StartHubProps {
  templates: SampleTemplate[];
  currentProjectName: string;
  currentFileCount: number;
  studioTheme: StudioThemeId;
  onChangeStudioTheme: (theme: StudioThemeId) => void;
  onResumeWorkspace: () => void;
  onSelectTemplate: (templateId: string) => void;
  onUploadFiles: (files: FileList) => void;
  onPullFromGitHub: (repoUrl: string, branch: string) => Promise<boolean>;
  githubBusy: boolean;
  githubError: string | null;
  onOpenShortcuts: () => void;
}

const TEMPLATE_CATEGORIES = ['All', 'Web App', 'Landing', 'Editorial', 'Commerce', 'Starter'] as const;

const TemplateWireframePreview: React.FC<{ templateId: string }> = ({ templateId }) => {
  if (templateId === 'atelier-editorial') {
    return (
      <div className="h-32 w-full bg-[#f6f4ef] border-b border-[#ddd6c9] p-3 flex flex-col justify-between text-[#1c1917] select-none overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#ddd6c9] pb-1.5 text-[8px] uppercase tracking-[0.14em] text-[#57534e]">
          <span>Issue 14</span>
          <span className="font-serif font-bold text-[10px] tracking-normal text-[#1c1917] capitalize">Atelier</span>
          <span>Archive</span>
        </div>
        <div className="py-1">
          <div className="text-[7px] uppercase tracking-widest text-[#9a3412] font-semibold mb-0.5">Monograph</div>
          <div className="font-serif text-[13px] font-semibold leading-tight text-[#1c1917]">
            Quiet Structure &amp; Attention
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#ddd6c9]">
          <div className="h-5 border-r border-[#ddd6c9] pr-1">
            <div className="h-1 w-4 bg-[#9a3412]/60 mb-1" />
            <div className="h-1 w-full bg-[#1c1917]/20" />
          </div>
          <div className="h-5 border-r border-[#ddd6c9] pr-1">
            <div className="h-1 w-4 bg-[#9a3412]/60 mb-1" />
            <div className="h-1 w-full bg-[#1c1917]/20" />
          </div>
          <div className="h-5">
            <div className="h-1 w-4 bg-[#9a3412]/60 mb-1" />
            <div className="h-1 w-full bg-[#1c1917]/20" />
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'signal-bento') {
    return (
      <div className="h-32 w-full bg-[#09090b] border-b border-zinc-800 p-3 flex flex-col justify-between text-zinc-100 select-none overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] text-indigo-400 tracking-wider">SIGNAL // V3</span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-[7px] font-medium">Ping</span>
        </div>
        <div className="text-[11px] font-semibold tracking-tight text-white">
          Edge routing, zero jitter
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <div className="col-span-2 rounded border border-zinc-800 bg-zinc-900/90 p-1.5">
            <div className="text-[7px] font-mono text-indigo-400">INGESTION</div>
            <div className="text-[10px] font-mono font-semibold text-white">1.42 ms</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900/90 p-1.5">
            <div className="text-[7px] font-mono text-zinc-400">EDGE</div>
            <div className="text-[10px] font-mono font-semibold text-white">42 PoPs</div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'kanso-commerce') {
    return (
      <div className="h-32 w-full bg-[#f5f5f4] border-b border-zinc-200 p-3 flex flex-col justify-between text-zinc-900 select-none overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
          <span className="text-[8px] font-bold tracking-[0.14em]">KANSO</span>
          <span className="text-[7.5px] font-mono px-1.5 py-0.5 rounded border border-zinc-300 bg-white">Bag (0)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded border border-zinc-200 bg-white p-1.5">
            <div className="h-7 rounded-sm bg-slate-200 mb-1" />
            <div className="h-1.5 w-8 bg-zinc-800 rounded-xs" />
          </div>
          <div className="rounded border border-zinc-200 bg-white p-1.5">
            <div className="h-7 rounded-sm bg-[#e5dccf] mb-1" />
            <div className="h-1.5 w-8 bg-zinc-800 rounded-xs" />
          </div>
          <div className="rounded border border-zinc-200 bg-white p-1.5">
            <div className="h-7 rounded-sm bg-zinc-800 mb-1" />
            <div className="h-1.5 w-8 bg-zinc-800 rounded-xs" />
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'horizon-landing') {
    return (
      <div className="h-32 w-full bg-white border-b border-slate-200 p-3 flex flex-col justify-between text-slate-900 select-none overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold">Horizon</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[7px] font-medium">Start</span>
        </div>
        <div>
          <div className="text-[7px] font-semibold text-blue-600 mb-0.5">Design Infrastructure</div>
          <div className="text-[11px] font-bold leading-tight text-slate-900">Build interfaces that scale cleanly</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded border border-slate-200 p-1.5">
            <div className="text-[7px] text-slate-500">Starter</div>
            <div className="text-[10px] font-bold">$19</div>
          </div>
          <div className="rounded border border-blue-500 bg-blue-50/50 p-1.5">
            <div className="text-[7px] text-blue-600 font-semibold">Studio Team</div>
            <div className="text-[10px] font-bold text-slate-900">$49</div>
          </div>
        </div>
      </div>
    );
  }

  if (templateId === 'blank-canvas') {
    return (
      <div className="h-32 w-full bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-center select-none overflow-hidden">
        <div className="w-full rounded-md border border-dashed border-slate-300 bg-white p-3 text-left">
          <div className="text-[7px] uppercase tracking-wider font-semibold text-indigo-600 mb-1">Starter Canvas</div>
          <div className="text-[11px] font-semibold text-slate-900 mb-1">Design your layout visually</div>
          <div className="flex gap-1.5">
            <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[7px] font-medium">Primary</span>
            <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-600 text-[7px] font-medium">Secondary</span>
          </div>
        </div>
      </div>
    );
  }

  // Default: Pulse Operations App
  return (
    <div className="h-32 w-full bg-slate-50 border-b border-slate-200 p-3 flex flex-col justify-between text-slate-900 select-none overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-indigo-600 text-white text-[7px] font-bold flex items-center justify-center">P</span>
          <span className="text-[9px] font-semibold">Pulse Operations</span>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[7px]">New</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <div className="rounded border border-slate-200 bg-white p-1.5">
          <div className="text-[6.5px] text-slate-400">MRR</div>
          <div className="text-[9.5px] font-bold">$84,290</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-1.5">
          <div className="text-[6.5px] text-slate-400">Velocity</div>
          <div className="text-[9.5px] font-bold">42 pts</div>
        </div>
        <div className="rounded border border-slate-200 bg-white p-1.5">
          <div className="text-[6.5px] text-slate-400">Uptime</div>
          <div className="text-[9.5px] font-bold text-emerald-600">99.98%</div>
        </div>
      </div>
      <div className="rounded border border-slate-200 bg-white px-2 py-1 flex items-center justify-between text-[7.5px] text-slate-500">
        <span>Release Checklist · Live Filter</span>
        <span className="font-mono text-indigo-600">3 tasks</span>
      </div>
    </div>
  );
};

export const StartHub: React.FC<StartHubProps> = ({
  templates,
  currentProjectName,
  currentFileCount,
  studioTheme,
  onChangeStudioTheme,
  onResumeWorkspace,
  onSelectTemplate,
  onUploadFiles,
  onPullFromGitHub,
  githubBusy,
  githubError,
  onOpenShortcuts,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<(typeof TEMPLATE_CATEGORIES)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [repoInput, setRepoInput] = useState('');
  const [branchInput, setBranchInput] = useState('');

  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const isLightTheme = studioTheme === 'daylight' || studioTheme === 'paper';

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((tpl) => {
      const cat = tpl.category || 'Starter';
      if (selectedCategory !== 'All' && cat !== selectedCategory) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q)
      );
    });
  }, [templates, selectedCategory, searchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleGitPullSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoInput.trim();
    if (!trimmed) return;
    await onPullFromGitHub(trimmed, branchInput.trim());
  };

  return (
    <div
      data-testid="start-hub"
      className="relative h-screen w-screen overflow-y-auto builder-scroll bg-[var(--studio-bg)] text-[var(--studio-text-strong)] flex flex-col"
    >
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 studio-grain" />

      <input
        ref={filesInputRef}
        type="file"
        multiple
        accept=".html,.htm,.css,.scss,.js,.mjs,.cjs,.ts,.mts,.cts,.tsx,.jsx,.json,.svg,.txt,.md,.xml,.yml,.yaml,.kt,.kts,.gradle,.properties,.pro,.sh,.png,.jpg,.jpeg,.gif,.webp,.bmp,.avif,.ico,.woff,.woff2,.apk"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Open project files from Start Hub"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory supported on Chromium/WebKit
        webkitdirectory=""
        className="hidden"
        onChange={handleFileChange}
        aria-label="Open project folder from Start Hub"
      />

      {/* Minimal Header */}
      <header className="sticky top-0 z-20 h-13 shrink-0 border-b border-[var(--studio-border)] bg-[var(--studio-surface)]/95 backdrop-blur-md px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <FramecraftLogoMark className="w-6 h-6" />
          <span className="font-display font-semibold text-[15px] tracking-[-0.02em] text-[var(--studio-text-strong)]">
            Framecraft
          </span>
          <span className="text-[var(--studio-muted-soft)] text-xs hidden sm:inline">·</span>
          <span className="text-[12px] text-[var(--studio-muted)] hidden sm:inline">
            Visual Design &amp; Code Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeStudioTheme(isLightTheme ? 'obsidian' : 'daylight')}
            aria-label="Toggle studio light/dark theme"
            className="h-8 px-2.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[12px] font-medium text-[var(--studio-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            {isLightTheme ? (
              <Moon className="w-3.5 h-3.5 text-indigo-500" strokeWidth={1.5} />
            ) : (
              <Sun className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
            )}
            <span>{isLightTheme ? 'Dark' : 'Light'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenShortcuts}
            className="h-8 px-2.5 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[12px] font-medium text-[var(--studio-text)] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Keyboard className="w-3.5 h-3.5 text-[var(--studio-muted)]" strokeWidth={1.5} />
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={onResumeWorkspace}
            className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <span>Open Studio</span>
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-8 space-y-8 flex-1">
        {/* Hero & Quick Start Row */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo-500 dark:text-indigo-400 mb-1">
                Project Hub
              </p>
              <h1 className="font-display text-[26px] font-semibold tracking-[-0.025em] text-[var(--studio-text-strong)] leading-tight">
                Start from a canvas, local folder, or GitHub repo
              </h1>
            </div>
            <p className="text-[12.5px] text-[var(--studio-muted)] max-w-md">
              Edit visually with direct nudging, snap guides, instant zero-reload undo/redo, and two-way source code sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Resume Current Workspace */}
            <button
              type="button"
              onClick={onResumeWorkspace}
              className="text-left rounded-xl border border-[var(--studio-border-strong)] bg-[var(--studio-surface)] hover:border-indigo-500/70 p-4 flex flex-col justify-between gap-3 studio-card-highlight transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-500">
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                </span>
                <span className="font-mono-tabular text-[11px] text-[var(--studio-muted)]">
                  {currentFileCount} files
                </span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--studio-text-strong)] group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors flex items-center justify-between">
                  <span className="truncate">Continue: {currentProjectName}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <p className="text-[11.5px] text-[var(--studio-muted)] mt-0.5">
                  Resume your active canvas session immediately
                </p>
              </div>
            </button>

            {/* 2. New Blank Canvas */}
            <button
              type="button"
              onClick={() => onSelectTemplate('blank-canvas')}
              className="text-left rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] hover:border-[var(--studio-border-strong)] hover:bg-[var(--studio-elevated)] p-4 flex flex-col justify-between gap-3 studio-card-highlight transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] flex items-center justify-center text-[var(--studio-text-strong)]">
                  <FilePlus2 className="w-4 h-4" strokeWidth={1.5} />
                </span>
                <span className="text-[11px] font-medium text-[var(--studio-muted-soft)]">HTML · CSS</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--studio-text-strong)] flex items-center justify-between">
                  <span>New Blank Canvas</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-80 transition-opacity" />
                </div>
                <p className="text-[11.5px] text-[var(--studio-muted)] mt-0.5">
                  Clean responsive wireframe ready for components
                </p>
              </div>
            </button>

            {/* 3. Open Local Folder or Files */}
            <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 flex flex-col justify-between gap-3 studio-card-highlight">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] flex items-center justify-center text-cyan-500">
                  <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                </span>
                <span className="text-[11px] font-medium text-[var(--studio-muted-soft)]">React · Vite · HTML</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--studio-text-strong)]">
                  Import Local Project
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="flex-1 h-7 px-2 rounded-md border border-[var(--studio-border-strong)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[11.5px] font-medium text-[var(--studio-text-strong)] inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <FolderOpen className="w-3 h-3" strokeWidth={1.5} />
                    Folder
                  </button>
                  <button
                    type="button"
                    onClick={() => filesInputRef.current?.click()}
                    className="flex-1 h-7 px-2 rounded-md border border-[var(--studio-border-strong)] bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)] text-[11.5px] font-medium text-[var(--studio-text-strong)] inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" strokeWidth={1.5} />
                    Files
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Pull from GitHub Repo */}
            <form
              onSubmit={handleGitPullSubmit}
              className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-4 flex flex-col justify-between gap-2.5 studio-card-highlight"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-[var(--studio-elevated)] border border-[var(--studio-border)] flex items-center justify-center text-emerald-500">
                  <GitBranch className="w-4 h-4" strokeWidth={1.5} />
                </span>
                <span className="text-[11px] font-medium text-[var(--studio-muted-soft)]">No API key needed</span>
              </div>
              <div className="space-y-1.5">
                <div className="text-[13px] font-semibold text-[var(--studio-text-strong)]">
                  Pull from GitHub Repo
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    placeholder="owner/repo"
                    aria-label="GitHub repository URL to pull"
                    className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--studio-input)] border border-[var(--studio-border)] text-[11.5px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="auto"
                    aria-label="GitHub branch"
                    className="w-14 h-7 px-1.5 rounded-md bg-[var(--studio-input)] border border-[var(--studio-border)] text-[11px] font-mono-tabular text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={githubBusy || !repoInput.trim()}
                    className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {githubBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Pull'}
                  </button>
                </div>
                {githubError && (
                  <p className="text-[11px] text-red-500 dark:text-red-400 leading-snug">
                    {githubError}
                  </p>
                )}
              </div>
            </form>
          </div>
        </section>

        {/* Starter Templates Gallery */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--studio-border)] pb-3">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-indigo-500" strokeWidth={1.5} />
              <h2 className="font-display text-[15px] font-semibold text-[var(--studio-text-strong)]">
                Starter Templates
              </h2>
              <span className="font-mono-tabular text-[11.5px] text-[var(--studio-muted)]">
                ({filteredTemplates.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                role="tablist"
                aria-label="Template categories"
                className="inline-flex items-center p-0.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)]"
              >
                {TEMPLATE_CATEGORIES.map((category) => {
                  const active = selectedCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedCategory(category)}
                      className={`h-7 px-2.5 rounded-md text-[11.5px] font-medium cursor-pointer transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-[var(--studio-muted)] hover:text-[var(--studio-text-strong)]'
                      }`}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--studio-muted-soft)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  aria-label="Search starter templates"
                  className="h-8 w-44 pl-8 pr-2.5 rounded-lg bg-[var(--studio-surface)] border border-[var(--studio-border)] text-[12px] text-[var(--studio-text-strong)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] p-8 text-center text-xs text-[var(--studio-muted)]">
              No templates match &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((tpl) => {
                const category = tpl.category || 'Starter';
                return (
                  <article
                    key={tpl.id}
                    className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-surface)] hover:border-indigo-500/60 overflow-hidden flex flex-col studio-card-highlight transition-all group"
                  >
                    <TemplateWireframePreview templateId={tpl.id} />
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-indigo-600 dark:text-indigo-400">
                            {category}
                          </span>
                          <span className="font-mono-tabular text-[11px] text-[var(--studio-muted-soft)]">
                            {tpl.files.length} files
                          </span>
                        </div>
                        <h3 className="font-display text-[14px] font-semibold text-[var(--studio-text-strong)]">
                          {tpl.name}
                        </h3>
                        <p className="text-[12px] text-[var(--studio-muted)] mt-1 leading-relaxed">
                          {tpl.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTemplate(tpl.id)}
                        className="w-full h-8 rounded-lg border border-[var(--studio-border-strong)] bg-[var(--studio-elevated)] group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 text-[12px] font-semibold text-[var(--studio-text-strong)] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Use Template</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Share2 } from 'lucide-react';
import type { SeoMetaValues } from '../types/editor';
import { parseHeadSeoMeta } from '../utils/seoMeta';

interface SeoMetaPanelProps {
  htmlPath: string | null;
  htmlContent: string;
  onCommitSeoMeta: (patch: Partial<SeoMetaValues>, label: string) => void;
}

export const SeoMetaPanel: React.FC<SeoMetaPanelProps> = ({
  htmlPath,
  htmlContent,
  onCommitSeoMeta,
}) => {
  const parsed = useMemo(() => parseHeadSeoMeta(htmlContent), [htmlContent]);
  const [draft, setDraft] = useState<SeoMetaValues>(parsed);
  const commitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft(parsed);
  }, [parsed]);

  useEffect(() => {
    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
      }
    };
  }, []);

  if (!htmlPath) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center bg-[var(--studio-surface)]">
        <Globe className="w-7 h-7 text-[var(--studio-muted-soft)] mb-2.5" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-[var(--studio-text-strong)] mb-1">No HTML page active</h2>
        <p className="text-xs text-[var(--studio-muted)] max-w-56">
          Load or create an HTML page to configure document head SEO and OpenGraph tags.
        </p>
      </div>
    );
  }

  const updateField = (
    key: keyof SeoMetaValues,
    value: string,
    label: string,
    immediate = false
  ) => {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);

    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (immediate) {
      onCommitSeoMeta({ [key]: value }, label);
      return;
    }

    commitTimerRef.current = window.setTimeout(() => {
      onCommitSeoMeta({ [key]: value }, label);
      commitTimerRef.current = null;
    }, 300);
  };

  const commitNow = (key: keyof SeoMetaValues, label: string) => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    if (draft[key] !== parsed[key]) {
      onCommitSeoMeta({ [key]: draft[key] }, label);
    }
  };

  const previewTitle = draft.ogTitle || draft.title || 'Untitled Page';
  const previewDesc =
    draft.ogDescription ||
    draft.description ||
    'Add a meta description to summarize this page for search results and social previews.';
  const previewDomain = draft.ogUrl || 'https://example.com';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--studio-surface)]">
      <div className="px-4 py-3 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h2 className="studio-section-header">Document &lt;head&gt; SEO</h2>
          <p className="text-[12px] text-[var(--studio-muted)] font-mono-tabular truncate mt-0.5">{htmlPath}</p>
        </div>
        <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" strokeWidth={1.5} />
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-5">
        {/* Search Engine Meta */}
        <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-title" className="text-[12.5px] font-medium text-[var(--studio-text)]">
                Page &lt;title&gt;
              </label>
              <span className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)]">
                {draft.title.length} / 60
              </span>
            </div>
            <input
              id="seo-title"
              type="text"
              value={draft.title}
              onChange={(e) => updateField('title', e.target.value, 'Update page <title>')}
              onBlur={() => commitNow('title', 'Update page <title>')}
              placeholder="e.g. Pulse Operations Workspace"
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-description" className="text-[12.5px] font-medium text-[var(--studio-text)]">
                Meta Description
              </label>
              <span className="text-[11px] font-mono-tabular text-[var(--studio-muted-soft)]">
                {draft.description.length} / 160
              </span>
            </div>
            <textarea
              id="seo-description"
              rows={3}
              value={draft.description}
              onChange={(e) =>
                updateField('description', e.target.value, 'Update meta description')
              }
              onBlur={() => commitNow('description', 'Update meta description')}
              placeholder="Concise summary shown in search engine snippets..."
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 resize-y"
            />
          </div>
        </section>

        {/* OpenGraph & Social */}
        <section className="space-y-3 pb-4 border-b border-[var(--studio-border)]">
          <div className="flex items-center justify-between">
            <h3 className="studio-section-header flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={1.5} />
              OpenGraph &amp; Social
            </h3>
            <button
              type="button"
              onClick={() => {
                const synced = {
                  ogTitle: draft.title,
                  ogDescription: draft.description,
                };
                setDraft((prev) => ({ ...prev, ...synced }));
                onCommitSeoMeta(synced, 'Sync OpenGraph from Title & Description');
              }}
              className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 cursor-pointer"
            >
              Sync from Page
            </button>
          </div>

          <div>
            <label htmlFor="seo-og-title" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
              og:title
            </label>
            <input
              id="seo-og-title"
              type="text"
              value={draft.ogTitle}
              onChange={(e) => updateField('ogTitle', e.target.value, 'Update og:title')}
              onBlur={() => commitNow('ogTitle', 'Update og:title')}
              placeholder={draft.title || 'Social share title'}
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>

          <div>
            <label htmlFor="seo-og-desc" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
              og:description
            </label>
            <textarea
              id="seo-og-desc"
              rows={2}
              value={draft.ogDescription}
              onChange={(e) =>
                updateField('ogDescription', e.target.value, 'Update og:description')
              }
              onBlur={() => commitNow('ogDescription', 'Update og:description')}
              placeholder="Social share summary..."
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60 resize-y"
            />
          </div>

          <div>
            <label htmlFor="seo-og-image" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
              og:image URL
            </label>
            <input
              id="seo-og-image"
              type="text"
              value={draft.ogImage}
              onChange={(e) => updateField('ogImage', e.target.value, 'Update og:image')}
              onBlur={() => commitNow('ogImage', 'Update og:image')}
              placeholder="/assets/og-cover.png"
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>

          <div>
            <label htmlFor="seo-og-url" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
              og:url
            </label>
            <input
              id="seo-og-url"
              type="text"
              value={draft.ogUrl}
              onChange={(e) => updateField('ogUrl', e.target.value, 'Update og:url')}
              onBlur={() => commitNow('ogUrl', 'Update og:url')}
              placeholder="https://example.com/"
              className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2.5 py-1.5 text-[12px] font-mono-tabular text-[var(--studio-text)] placeholder:text-[var(--studio-muted-soft)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="seo-og-type" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                og:type
              </label>
              <select
                id="seo-og-type"
                value={draft.ogType}
                onChange={(e) => updateField('ogType', e.target.value, 'Update og:type', true)}
                className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] text-[var(--studio-text)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
                <option value="profile">profile</option>
              </select>
            </div>
            <div>
              <label htmlFor="seo-twitter-card" className="block text-[12.5px] font-medium text-[var(--studio-text)] mb-1">
                twitter:card
              </label>
              <select
                id="seo-twitter-card"
                value={draft.twitterCard}
                onChange={(e) =>
                  updateField('twitterCard', e.target.value, 'Update twitter:card', true)
                }
                className="w-full rounded-lg bg-[var(--studio-elevated)] hover:bg-[var(--studio-hover)]/60 border border-[var(--studio-border)] studio-card-highlight px-2 py-1.5 text-[12px] text-[var(--studio-text)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/60"
              >
                <option value="summary_large_image">summary_large_image</option>
                <option value="summary">summary</option>
              </select>
            </div>
          </div>
        </section>

        {/* Live Search & Share Card Preview */}
        <section className="space-y-2">
          <h3 className="studio-section-header">Live Social &amp; Search Preview</h3>
          <div className="rounded-xl border border-[var(--studio-border)] bg-[var(--studio-elevated)] studio-card-highlight p-3 space-y-1.5">
            <div className="text-[11px] font-mono-tabular text-emerald-600 dark:text-emerald-400 truncate">
              {previewDomain}
            </div>
            <div className="text-[13px] font-semibold text-indigo-700 dark:text-indigo-300 leading-snug line-clamp-2">
              {previewTitle}
            </div>
            <p className="text-[12px] text-[var(--studio-muted)] leading-relaxed line-clamp-3">
              {previewDesc}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

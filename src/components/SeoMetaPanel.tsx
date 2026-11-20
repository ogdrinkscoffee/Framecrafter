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
      <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
        <Globe className="w-7 h-7 text-slate-500 mb-2.5" />
        <h2 className="text-sm font-semibold text-slate-200 mb-1">No HTML page active</h2>
        <p className="text-xs text-slate-400 max-w-56">
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
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0a0f18] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-xs font-semibold text-slate-200">Document &lt;head&gt; SEO</h2>
          <p className="text-[11px] text-slate-400 font-mono-tabular truncate">{htmlPath}</p>
        </div>
        <Globe className="w-4 h-4 text-blue-400 shrink-0" />
      </div>

      <div className="flex-1 overflow-y-auto builder-scroll p-4 space-y-4">
        {/* Search Engine Meta */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-title" className="text-[11px] font-medium text-slate-300">
                Page &lt;title&gt;
              </label>
              <span className="text-[10px] font-mono-tabular text-slate-500">
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
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="seo-description" className="text-[11px] font-medium text-slate-300">
                Meta Description
              </label>
              <span className="text-[10px] font-mono-tabular text-slate-500">
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
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>
        </section>

        {/* OpenGraph & Social */}
        <section className="space-y-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5 text-sky-400" />
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
              className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
            >
              Sync from Page
            </button>
          </div>

          <div>
            <label htmlFor="seo-og-title" className="block text-[11px] text-slate-400 mb-1">
              og:title
            </label>
            <input
              id="seo-og-title"
              type="text"
              value={draft.ogTitle}
              onChange={(e) => updateField('ogTitle', e.target.value, 'Update og:title')}
              onBlur={() => commitNow('ogTitle', 'Update og:title')}
              placeholder={draft.title || 'Social share title'}
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="seo-og-desc" className="block text-[11px] text-slate-400 mb-1">
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
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          <div>
            <label htmlFor="seo-og-image" className="block text-[11px] text-slate-400 mb-1">
              og:image URL
            </label>
            <input
              id="seo-og-image"
              type="text"
              value={draft.ogImage}
              onChange={(e) => updateField('ogImage', e.target.value, 'Update og:image')}
              onBlur={() => commitNow('ogImage', 'Update og:image')}
              placeholder="/assets/og-cover.png"
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="seo-og-url" className="block text-[11px] text-slate-400 mb-1">
              og:url
            </label>
            <input
              id="seo-og-url"
              type="text"
              value={draft.ogUrl}
              onChange={(e) => updateField('ogUrl', e.target.value, 'Update og:url')}
              onBlur={() => commitNow('ogUrl', 'Update og:url')}
              placeholder="https://example.com/"
              className="w-full rounded bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="seo-og-type" className="block text-[11px] text-slate-400 mb-1">
                og:type
              </label>
              <select
                id="seo-og-type"
                value={draft.ogType}
                onChange={(e) => updateField('ogType', e.target.value, 'Update og:type', true)}
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="website">website</option>
                <option value="article">article</option>
                <option value="product">product</option>
                <option value="profile">profile</option>
              </select>
            </div>
            <div>
              <label htmlFor="seo-twitter-card" className="block text-[11px] text-slate-400 mb-1">
                twitter:card
              </label>
              <select
                id="seo-twitter-card"
                value={draft.twitterCard}
                onChange={(e) =>
                  updateField('twitterCard', e.target.value, 'Update twitter:card', true)
                }
                className="w-full rounded bg-slate-900 border border-slate-700/80 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="summary_large_image">summary_large_image</option>
                <option value="summary">summary</option>
              </select>
            </div>
          </div>
        </section>

        {/* Live Search & Share Card Preview */}
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold text-slate-400">Live Social &amp; Search Preview</h3>
          <div className="rounded-lg border border-slate-800 bg-[#090d16] p-3 space-y-1.5">
            <div className="text-[11px] font-mono-tabular text-emerald-400 truncate">
              {previewDomain}
            </div>
            <div className="text-xs font-semibold text-blue-400 leading-snug line-clamp-2">
              {previewTitle}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3">
              {previewDesc}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

import type { SeoMetaValues } from '../types/editor';

function decodeHtmlAttr(val: string): string {
  return val
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function extractMetaContent(headHtml: string, attrName: 'name' | 'property', key: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRegex = new RegExp(`<meta\\b[^>]*\\b${attrName}\\s*=\\s*["']${escapedKey}["'][^>]*>`, 'i');
  const match = tagRegex.exec(headHtml);
  if (!match) return '';

  const contentMatch = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(match[0]);
  if (!contentMatch) return '';
  return decodeHtmlAttr(contentMatch[1] ?? contentMatch[2] ?? '');
}

export function parseHeadSeoMeta(html: string): SeoMetaValues {
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html);
  const headHtml = headMatch ? headMatch[1] : html;

  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(headHtml);
  const title = titleMatch ? decodeHtmlAttr(titleMatch[1].trim()) : '';

  return {
    title,
    description: extractMetaContent(headHtml, 'name', 'description'),
    ogTitle: extractMetaContent(headHtml, 'property', 'og:title'),
    ogDescription: extractMetaContent(headHtml, 'property', 'og:description'),
    ogImage: extractMetaContent(headHtml, 'property', 'og:image'),
    ogUrl: extractMetaContent(headHtml, 'property', 'og:url'),
    ogType: extractMetaContent(headHtml, 'property', 'og:type') || 'website',
    twitterCard: extractMetaContent(headHtml, 'name', 'twitter:card') || 'summary_large_image',
  };
}

function upsertMetaTagInHead(
  headInner: string,
  attrName: 'name' | 'property',
  key: string,
  value: string,
  removeIfEmpty = true
): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tagRegex = new RegExp(
    `[ \\t]*<meta\\b[^>]*\\b${attrName}\\s*=\\s*["']${escapedKey}["'][^>]*>\\r?\\n?`,
    'i'
  );

  const trimmed = value.trim();
  const newTag = `    <meta ${attrName}="${key}" content="${encodeHtmlAttr(trimmed)}" />`;

  if (!trimmed && removeIfEmpty) {
    return headInner.replace(tagRegex, '');
  }

  if (tagRegex.test(headInner)) {
    return headInner.replace(tagRegex, (existing) => {
      const endsWithNewline = existing.endsWith('\n');
      return endsWithNewline ? `${newTag}\n` : newTag;
    });
  }

  return headInner.trimEnd() + `\n${newTag}\n  `;
}

export function updateHeadSeoMeta(
  html: string,
  patch: Partial<SeoMetaValues>
): string {
  const current = parseHeadSeoMeta(html);
  const next: SeoMetaValues = { ...current, ...patch };

  const headRegex = /(<head\b[^>]*>)([\s\S]*?)(<\/head>)/i;
  const headMatch = headRegex.exec(html);

  let headOpen = '<head>';
  let headInner = '';
  let headClose = '</head>';
  let hasHead = Boolean(headMatch);

  if (headMatch) {
    headOpen = headMatch[1];
    headInner = headMatch[2];
    headClose = headMatch[3];
  }

  // Update <title>
  const encodedTitle = encodeHtmlAttr(next.title.trim());
  const titleRegex = /<title\b[^>]*>[\s\S]*?<\/title>/i;
  if (titleRegex.test(headInner)) {
    headInner = headInner.replace(titleRegex, `<title>${encodedTitle}</title>`);
  } else {
    headInner = `\n    <title>${encodedTitle}</title>${headInner}`;
  }

  headInner = upsertMetaTagInHead(headInner, 'name', 'description', next.description, false);
  headInner = upsertMetaTagInHead(headInner, 'property', 'og:title', next.ogTitle, true);
  headInner = upsertMetaTagInHead(
    headInner,
    'property',
    'og:description',
    next.ogDescription,
    true
  );
  headInner = upsertMetaTagInHead(headInner, 'property', 'og:image', next.ogImage, true);
  headInner = upsertMetaTagInHead(headInner, 'property', 'og:url', next.ogUrl, true);
  headInner = upsertMetaTagInHead(headInner, 'property', 'og:type', next.ogType, true);
  headInner = upsertMetaTagInHead(headInner, 'name', 'twitter:card', next.twitterCard, true);

  if (hasHead && headMatch) {
    return (
      html.slice(0, headMatch.index) +
      `${headOpen}${headInner}${headClose}` +
      html.slice(headMatch.index + headMatch[0].length)
    );
  }

  const headBlock = `${headOpen}${headInner}${headClose}\n`;
  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (m) => `${m}\n  ${headBlock}`);
  }
  return `${headBlock}${html}`;
}

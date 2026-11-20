import type { ProjectFile, ProjectFileType } from '../types/editor';
import { tagHtmlWithVeIds } from './htmlSync';

export function detectFileType(filename: string): ProjectFileType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css')) return 'css';
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx')
  ) {
    return 'js';
  }
  if (lower.endsWith('.json')) return 'json';
  return 'other';
}

export function normalizeRelativePath(rawPath: string): string {
  const cleaned = rawPath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
  const parts = cleaned.split('/').filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      stack.pop();
    } else {
      stack.push(part);
    }
  }
  return stack.join('/');
}

export function normalizeUploadedFiles(
  rawFiles: Array<{ path: string; name: string; content: string }>
): ProjectFile[] {
  if (rawFiles.length === 0) return [];

  // Strip shared top-level folder prefix if all files come from a single folder upload
  const splitPaths = rawFiles.map((f) => normalizeRelativePath(f.path || f.name).split('/'));
  const firstSegment = splitPaths[0][0];
  const hasSharedRootFolder =
    splitPaths.every((parts) => parts.length > 1 && parts[0] === firstSegment);

  const normalized = rawFiles.map((f, index) => {
    const parts = splitPaths[index];
    const relPath = hasSharedRootFolder ? parts.slice(1).join('/') : parts.join('/');
    return {
      path: relPath || f.name,
      name: f.name,
      content: f.content,
      type: detectFileType(f.name),
    };
  });

  return normalized.sort((a, b) => a.path.localeCompare(b.path));
}

export function findEntryHtmlPath(files: ProjectFile[]): string | null {
  const htmlFiles = files.filter((f) => f.type === 'html');
  if (htmlFiles.length === 0) return null;

  const rootIndex = htmlFiles.find((f) => f.path.toLowerCase() === 'index.html');
  if (rootIndex) return rootIndex.path;

  const nestedIndex = htmlFiles.find((f) => f.name.toLowerCase() === 'index.html');
  if (nestedIndex) return nestedIndex.path;

  return htmlFiles[0].path;
}

function resolveRelativeToEntry(entryPath: string, refPath: string): string {
  const entryDir = entryPath.includes('/')
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : '';
  return normalizeRelativePath(entryDir + refPath);
}

function buildVirtualFetchShim(files: ProjectFile[], entryPath: string): string {
  const fileMap: Record<string, string> = {};
  for (const file of files) {
    fileMap[file.path] = file.content;
    fileMap['./' + file.path] = file.content;
    fileMap['/' + file.path] = file.content;
  }
  const serializedMap = JSON.stringify(fileMap)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const serializedEntry = JSON.stringify(entryPath)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return `<script data-ve-internal="virtual-fetch">
(function() {
  var __VE_FILES__ = ${serializedMap};
  var __VE_ENTRY__ = ${serializedEntry};
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  function resolveRef(url) {
    if (typeof url !== 'string') return null;
    if (/^https?:\\/\\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return null;
    var clean = url.split('?')[0].split('#')[0].replace(/^\\.\\//, '').replace(/^\\/+/, '');
    if (__VE_FILES__[clean] !== undefined) return __VE_FILES__[clean];
    var dir = __VE_ENTRY__.indexOf('/') !== -1 ? __VE_ENTRY__.slice(0, __VE_ENTRY__.lastIndexOf('/') + 1) : '';
    var combined = (dir + clean).replace(/^\\.\\//, '');
    return __VE_FILES__[combined] !== undefined ? __VE_FILES__[combined] : null;
  }
  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var content = resolveRef(url);
    if (content !== null) {
      var mime = url.endsWith('.json') ? 'application/json' : 'text/plain';
      return Promise.resolve(new Response(content, { status: 200, headers: { 'Content-Type': mime } }));
    }
    return origFetch ? origFetch(input, init) : Promise.reject(new Error('Network unavailable in sandbox'));
  };
})();
</script>`;
}

export function buildSrcDoc(
  files: ProjectFile[],
  entryPath: string,
  bridgeMarkup = ''
): string {
  const entryFile = files.find((f) => f.path === entryPath);
  if (!entryFile) {
    return '<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#cbd5e1;background:#0f172a;">No HTML entry file found.</body></html>';
  }

  const fileLookup = new Map<string, ProjectFile>();
  for (const file of files) {
    fileLookup.set(file.path, file);
  }

  let html = tagHtmlWithVeIds(entryFile.content);

  // Inline local <link rel="stylesheet" href="...">
  html = html.replace(
    /<link\b([^>]*?)rel=["']stylesheet["']([^>]*?)>/gi,
    (fullMatch, before, after) => {
      const combined = before + ' ' + after;
      const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(combined);
      if (!hrefMatch) return fullMatch;
      const href = hrefMatch[1];
      if (/^(https?:)?\/\//i.test(href) || href.startsWith('data:')) {
        return fullMatch;
      }
      const resolved = resolveRelativeToEntry(entryPath, href);
      const cssFile = fileLookup.get(resolved) ?? fileLookup.get(normalizeRelativePath(href));
      if (!cssFile) return fullMatch;
      return `<style data-ve-source="${cssFile.path}">\n${cssFile.content}\n</style>`;
    }
  );

  // Inline local <script src="..."></script>
  html = html.replace(
    /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>\s*<\/script>/gi,
    (fullMatch, _before, src) => {
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
        return fullMatch;
      }
      const resolved = resolveRelativeToEntry(entryPath, src);
      const jsFile = fileLookup.get(resolved) ?? fileLookup.get(normalizeRelativePath(src));
      if (!jsFile) return fullMatch;
      const safeJs = jsFile.content.replace(/<\/script>/gi, '<\\/script>');
      return `<script data-ve-source="${jsFile.path}">\n${safeJs}\n</script>`;
    }
  );

  const virtualFetchShim = buildVirtualFetchShim(files, entryPath);

  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${virtualFetchShim}`);
  } else {
    html = `${virtualFetchShim}\n${html}`;
  }

  if (bridgeMarkup) {
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${bridgeMarkup}\n</body>`);
    } else {
      html = `${html}\n${bridgeMarkup}`;
    }
  }

  return html;
}

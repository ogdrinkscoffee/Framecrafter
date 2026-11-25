import type { ProjectFile, ProjectFileType } from '../types/editor';
import { buildGoogleFontsHref, collectUsedGoogleFonts } from './fontLibrary.ts';
import { tagHtmlWithVeIds } from './htmlSync.ts';

export const IGNORED_UPLOAD_SEGMENTS = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.next',
  '.nuxt',
  '.turbo',
  '.vite',
  '.cache',
  'coverage',
  '__macosx',
  '.vscode',
  '.idea',
]);

export const IGNORED_UPLOAD_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

const TEST_OR_DOC_SEGMENTS = new Set([
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'e2e',
  'cypress',
  'playwright',
  'fixtures',
  'mocks',
  '__mocks__',
  'docs',
  'doc',
  'examples',
  'example',
  'storybook-static',
  '.storybook',
]);

const DOC_OR_META_ROOT_FILES = new Set([
  'readme',
  'readme.md',
  'readme.txt',
  'license',
  'license.md',
  'license.txt',
  'changelog.md',
  'contributing.md',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.prettierrc',
  '.prettierignore',
  '.eslintignore',
  '.npmrc',
  '.nvmrc',
  '.env',
  '.env.example',
  '.env.local',
  'docker-compose.yml',
  'docker-compose.yaml',
  'dockerfile',
  'makefile',
  'vercel.json',
  'netlify.toml',
]);

const NON_RUNTIME_EXACT_BASENAMES = new Set([
  'server.ts',
  'server.js',
  'server.mjs',
  'server.cjs',
  'serverbundler.ts',
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.config.mjs',
  'jest.config.ts',
  'jest.config.js',
  'jest.config.cjs',
  'webpack.config.ts',
  'webpack.config.js',
  'rollup.config.ts',
  'rollup.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'postcss.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  'eslint.config.ts',
  'eslint.config.js',
  'eslint.config.mjs',
  'prettier.config.js',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'astro.config.mjs',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'jsconfig.json',
  'gradlew',
  'gradlew.bat',
  'proguard-rules.pro',
  'local.properties',
  'gradle.properties',
  'build.gradle',
  'build.gradle.kts',
  'settings.gradle',
  'settings.gradle.kts',
  'androidmanifest.xml',
]);

export interface BundleErrorDetail {
  file: string;
  line: number | null;
  column: number | null;
  lineText: string;
  message: string;
}

export interface CompiledProjectBundle {
  js?: string;
  css?: string;
  externalCssUrls?: string[];
  replacedScriptSrcs?: string[];
  hasInlineModuleReplacement?: boolean;
  usesTailwind?: boolean;
  importMap?: Record<string, string>;
  error?: string;
  errorDetails?: BundleErrorDetail[];
}

export function detectFileType(filename: string): ProjectFileType {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass') || lower.endsWith('.less')) {
    return 'css';
  }
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.mts') ||
    lower.endsWith('.cts') ||
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

export function shouldIgnoreUploadPath(rawPath: string): boolean {
  const normalized = normalizeRelativePath(rawPath);
  if (!normalized) return true;
  const parts = normalized.split('/');
  const filename = parts[parts.length - 1].toLowerCase();
  if (IGNORED_UPLOAD_FILES.has(filename)) return true;
  for (let i = 0; i < parts.length - 1; i++) {
    if (IGNORED_UPLOAD_SEGMENTS.has(parts[i].toLowerCase())) {
      return true;
    }
  }
  return false;
}

const NON_RUNTIME_EXTENSION_RE =
  /\.(xml|ya?ml|kt|kts|gradle|properties|pro|sh|bash|zsh|bat|ps1|md|markdown|apk|aab|jar|keystore|jks|java|swift|py|rb|go|rs|c|cpp|cc|h|hpp|lock|toml)$/i;

const NON_RUNTIME_SEGMENTS = new Set([
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'e2e',
  'cypress',
  'playwright',
  '__mocks__',
  'android',
  'android-kiosk-launcher',
  'ios',
  'pods',
  '.gradle',
  'gradle',
  '.github',
]);

export function isNonRuntimeBundleFile(rawPath: string): boolean {
  const normalized = normalizeRelativePath(rawPath);
  if (!normalized) return true;
  const lower = normalized.toLowerCase();
  const parts = lower.split('/');
  const base = parts[parts.length - 1];

  if (shouldIgnoreUploadPath(normalized)) return true;
  if (NON_RUNTIME_EXACT_BASENAMES.has(base)) return true;
  if (/^tsconfig(\..+)?\.json$/i.test(base)) return true;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(base)) return true;
  if (NON_RUNTIME_EXTENSION_RE.test(base)) return true;

  for (let i = 0; i < parts.length - 1; i++) {
    if (NON_RUNTIME_SEGMENTS.has(parts[i])) {
      return true;
    }
  }
  return false;
}

function isDocOrMetaFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  if (DOC_OR_META_ROOT_FILES.has(lower)) return true;
  if (lower.endsWith('.md') || lower.endsWith('.lock') || lower === 'package-lock.json' || lower === 'yarn.lock' || lower === 'pnpm-lock.yaml') {
    return true;
  }
  return false;
}

function getDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
}

function isUnderTestOrDocs(filePath: string): boolean {
  const parts = filePath.toLowerCase().split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    if (TEST_OR_DOC_SEGMENTS.has(parts[i])) return true;
  }
  return false;
}

function findDetectedSubRootPrefix(paths: string[]): string {
  const hasRootIndex = paths.some((p) => p.toLowerCase() === 'index.html');
  const hasRootPublicIndex = paths.some((p) => p.toLowerCase() === 'public/index.html');
  const hasRootPkg = paths.some((p) => p.toLowerCase() === 'package.json');
  const hasRootSrc = paths.some((p) => p.toLowerCase().startsWith('src/'));

  if (hasRootIndex || hasRootPublicIndex || (hasRootPkg && hasRootSrc)) {
    return '';
  }

  const candidateDirs = new Set<string>();
  const pathSet = new Set(paths.map((p) => p.toLowerCase()));

  for (const p of paths) {
    const lower = p.toLowerCase();
    if (isUnderTestOrDocs(lower)) continue;
    const base = lower.split('/').pop() ?? lower;
    const dir = getDirname(p);
    if (!dir) continue;

    if (base === 'index.html' || base === 'index.htm') {
      const dirParts = dir.split('/');
      const lastSeg = dirParts[dirParts.length - 1].toLowerCase();
      if (lastSeg === 'public') {
        const parentDir = dirParts.slice(0, -1).join('/');
        const prefix = parentDir ? `${parentDir.toLowerCase()}/` : '';
        const hasSiblingSrcOrPkg = paths.some((other) => {
          const ol = other.toLowerCase();
          return (
            ol.startsWith(`${prefix}src/`) ||
            ol === `${prefix}package.json`
          );
        });
        if (hasSiblingSrcOrPkg) {
          if (parentDir) candidateDirs.add(parentDir);
          continue;
        }
      }
      candidateDirs.add(dir);
    } else if (base === 'package.json') {
      const prefix = `${dir.toLowerCase()}/`;
      const hasHtmlOrSrc = paths.some((other) => {
        const ol = other.toLowerCase();
        return ol === `${prefix}index.html` || ol === `${prefix}public/index.html` || ol.startsWith(`${prefix}src/`);
      });
      if (hasHtmlOrSrc) candidateDirs.add(dir);
    }
  }

  if (candidateDirs.size === 0) return '';

  let bestCandidate = '';
  let bestScore = -Infinity;

  for (const dir of candidateDirs) {
    const prefix = `${dir}/`;
    const prefixLower = prefix.toLowerCase();
    const inside = paths.filter((p) => p.toLowerCase().startsWith(prefixLower));
    const outside = paths.filter((p) => !p.toLowerCase().startsWith(prefixLower));

    const outsideHasCodeOrHtml = outside.some((p) => {
      if (isUnderTestOrDocs(p)) return false;
      const base = p.split('/').pop() ?? p;
      if (isDocOrMetaFilename(base)) return false;
      const type = detectFileType(base);
      if (type === 'html' || type === 'css' || type === 'js') return true;
      return /\.(kt|kts|gradle|xml|java|swift|py|go|rs|apk|sh)$/i.test(base);
    });

    if (outsideHasCodeOrHtml) continue;

    let score = 0;
    const rels = inside.map((p) => p.slice(prefix.length).toLowerCase());
    if (rels.includes('index.html')) score += 100;
    if (rels.includes('public/index.html')) score += 85;
    if (rels.includes('package.json')) score += 40;
    if (rels.some((r) => r.startsWith('src/'))) score += 30;
    if (pathSet.has(`${prefixLower}styles.css`) || rels.some((r) => r.endsWith('.css'))) score += 15;
    const lastSeg = dir.split('/').pop()?.toLowerCase() ?? '';
    if (lastSeg === 'dist' || lastSeg === 'build' || lastSeg === 'out') score -= 45;
    score -= dir.split('/').length * 5;

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = dir;
    }
  }

  return bestCandidate;
}

export function normalizeUploadedFiles(
  rawFiles: Array<{ path: string; name: string; content: string; blobUrl?: string }>
): ProjectFile[] {
  if (rawFiles.length === 0) return [];

  const nonIgnored = rawFiles.filter((f) => !shouldIgnoreUploadPath(f.path || f.name));
  const sourceEntries = nonIgnored.length > 0 ? nonIgnored : rawFiles;

  let working = sourceEntries.map((f) => ({
    path: normalizeRelativePath(f.path || f.name) || normalizeRelativePath(f.name),
    name: f.name,
    content: f.content,
    blobUrl: f.blobUrl,
  }));

  while (working.length > 0) {
    const splitPaths = working.map((f) => f.path.split('/').filter(Boolean));
    const first = splitPaths[0]?.[0];
    if (!first) break;
    const allShareFirst = splitPaths.every((parts) => parts.length > 1 && parts[0] === first);
    if (!allShareFirst) break;
    working = working.map((f, idx) => ({
      ...f,
      path: splitPaths[idx].slice(1).join('/'),
    }));
  }

  const subRoot = findDetectedSubRootPrefix(working.map((f) => f.path));
  if (subRoot) {
    const prefix = `${subRoot}/`;
    const prefixLower = prefix.toLowerCase();
    const filtered = working.filter((f) => f.path.toLowerCase().startsWith(prefixLower));
    if (filtered.length > 0) {
      working = filtered.map((f) => ({
        ...f,
        path: f.path.slice(prefix.length),
      }));
    }
  }

  const deduped = new Map<string, ProjectFile>();
  for (const f of working) {
    const finalPath = f.path || f.name;
    const finalName = finalPath.split('/').pop() || f.name;
    deduped.set(finalPath, {
      path: finalPath,
      name: finalName,
      content: f.content,
      type: detectFileType(finalName),
      ...(f.blobUrl ? { blobUrl: f.blobUrl } : {}),
    });
  }

  return Array.from(deduped.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export function detectProjectTitleFromUpload(
  rawFiles: Array<{ path: string; name: string; content: string }>,
  normalizedFiles: ProjectFile[]
): string | null {
  const pkg = normalizedFiles.find((f) => f.path.toLowerCase() === 'package.json');
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg.content) as { name?: unknown };
      if (typeof parsed.name === 'string' && parsed.name.trim()) {
        return parsed.name.trim();
      }
    } catch {
      // Ignore malformed package.json
    }
  }
  for (const f of rawFiles) {
    const norm = normalizeRelativePath(f.path || f.name);
    if (norm.includes('/')) {
      return norm.split('/')[0];
    }
  }
  return null;
}

export function findEntryHtmlPath(files: ProjectFile[]): string | null {
  const htmlFiles = files.filter((f) => f.type === 'html');
  if (htmlFiles.length === 0) return null;

  const scoreHtmlFile = (file: ProjectFile): number => {
    const lower = file.path.toLowerCase();
    const name = file.name.toLowerCase();
    const depth = lower.split('/').length - 1;
    let score = 0;

    if (lower === 'index.html' || lower === 'index.htm') return 10000;
    if (lower === 'public/index.html') score += 8000;
    else if (lower === 'src/index.html' || lower === 'app/index.html') score += 7500;
    else if (name === 'index.html' || name === 'index.htm') score += 6000;
    else if (name === 'main.html' || name === 'app.html' || name === 'home.html') score += 3000;
    else score += 1000;

    if (isUnderTestOrDocs(lower)) score -= 5000;
    if (/^(dist|build|out)\//.test(lower)) score -= 1500;
    score -= depth * 120;
    return score;
  };

  const ranked = [...htmlFiles].sort((a, b) => {
    const diff = scoreHtmlFile(b) - scoreHtmlFile(a);
    return diff !== 0 ? diff : a.path.localeCompare(b.path);
  });

  return ranked[0].path;
}

export function resolveRelativeToEntry(entryPath: string, refPath: string): string {
  const cleanRef = refPath.split('?')[0].split('#')[0].replace(/%PUBLIC_URL%/g, '');
  if (cleanRef.startsWith('/')) {
    return normalizeRelativePath(cleanRef);
  }
  const entryDir = entryPath.includes('/')
    ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1)
    : '';
  return normalizeRelativePath(entryDir + cleanRef);
}

export interface ParsedHtmlScripts {
  moduleSrcs: Array<{ rawSrc: string; resolvedPath: string | null }>;
  inlineModules: string[];
}

export function extractScriptsFromHtml(
  html: string,
  entryPath: string,
  files: ProjectFile[]
): ParsedHtmlScripts {
  const fileSet = new Set(files.map((f) => f.path));
  const entryDir = getDirname(entryPath);
  const moduleSrcs: Array<{ rawSrc: string; resolvedPath: string | null }> = [];
  const inlineModules: string[] = [];

  const findResolved = (rawSrc: string): string | null => {
    const clean = rawSrc.split('?')[0].split('#')[0].replace(/%PUBLIC_URL%/g, '');
    const candidates = clean.startsWith('/')
      ? [normalizeRelativePath(clean), normalizeRelativePath((entryDir ? `${entryDir}/` : '') + clean.slice(1))]
      : [normalizeRelativePath((entryDir ? `${entryDir}/` : '') + clean), normalizeRelativePath(clean)];
    for (const c of candidates) {
      if (fileSet.has(c) && !isNonRuntimeBundleFile(c)) {
        return c;
      }
    }
    return null;
  };

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const scripts = Array.from(doc.querySelectorAll('script'));
    for (const script of scripts) {
      const src = script.getAttribute('src');
      const type = (script.getAttribute('type') || '').toLowerCase();
      const isModule = type === 'module';
      if (src) {
        if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
        const resolved = findResolved(src);
        if (resolved && (isModule || /\.(tsx?|jsx|mjs|mts|cts)(\?.*)?$/i.test(src))) {
          moduleSrcs.push({ rawSrc: src, resolvedPath: resolved });
        } else if (resolved) {
          const fileObj = files.find((f) => f.path === resolved);
          if (fileObj && /\b(import|export)\s/m.test(fileObj.content)) {
            moduleSrcs.push({ rawSrc: src, resolvedPath: resolved });
          }
        }
      } else if (isModule && (script.textContent || '').trim()) {
        inlineModules.push(script.textContent || '');
      }
    }
    return { moduleSrcs, inlineModules };
  }

  const scriptTagRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptTagRegex.exec(html)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(attrs);
    const typeMatch = /\btype=["']([^"']+)["']/i.exec(attrs);
    const isModule = typeMatch?.[1]?.toLowerCase() === 'module';
    if (srcMatch) {
      const src = srcMatch[1];
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) continue;
      const resolved = findResolved(src);
      if (resolved && (isModule || /\.(tsx?|jsx|mjs|mts|cts)(\?.*)?$/i.test(src))) {
        moduleSrcs.push({ rawSrc: src, resolvedPath: resolved });
      } else if (resolved) {
        const fileObj = files.find((f) => f.path === resolved);
        if (fileObj && /\b(import|export)\s/m.test(fileObj.content)) {
          moduleSrcs.push({ rawSrc: src, resolvedPath: resolved });
        }
      }
    } else if (isModule && body.trim()) {
      inlineModules.push(body);
    }
  }

  return { moduleSrcs, inlineModules };
}

export function needsModuleBundling(files: ProjectFile[], entryPath: string | null): boolean {
  if (!entryPath) return false;
  const entryFile = files.find((f) => f.path === entryPath);
  if (!entryFile) return false;

  const parsed = extractScriptsFromHtml(entryFile.content, entryPath, files);
  if (parsed.moduleSrcs.length > 0 || parsed.inlineModules.length > 0) {
    return true;
  }

  const lowerEntry = entryPath.toLowerCase();
  const hasRootContainer =
    /id=["'](root|app)["']/i.test(entryFile.content) || lowerEntry === 'public/index.html';
  if (hasRootContainer) {
    const hasSpaEntry = files.some((f) => {
      if (isNonRuntimeBundleFile(f.path)) return false;
      const lp = f.path.toLowerCase();
      return (
        lp === 'src/main.tsx' ||
        lp === 'src/main.ts' ||
        lp === 'src/main.jsx' ||
        lp === 'src/main.js' ||
        lp === 'src/index.tsx' ||
        lp === 'src/index.ts' ||
        lp === 'src/index.jsx' ||
        lp === 'src/index.js'
      );
    });
    if (hasSpaEntry) return true;
  }

  const usesTailwindCss = files.some(
    (f) =>
      f.type === 'css' &&
      !isNonRuntimeBundleFile(f.path) &&
      (/@import\s+["']tailwindcss["']/.test(f.content) ||
        /@tailwind\s+(base|components|utilities)/.test(f.content))
  );
  return usesTailwindCss;
}

function escapeJsonForScriptTag(jsonText: string): string {
  return jsonText
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const IMAGE_ASSET_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico)$/i;

export function isImageAssetPath(filePath: string): boolean {
  const clean = filePath.split('?')[0].split('#')[0];
  return IMAGE_ASSET_EXT_RE.test(clean);
}

export function toSvgDataUrl(svgContent: string): string {
  if (svgContent.startsWith('data:')) return svgContent;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

export function getSandboxReadableAssetUrl(file: ProjectFile): string | null {
  if (file.content.startsWith('data:')) {
    return file.content;
  }
  if (/\.svg$/i.test(file.path) && file.content.trim()) {
    return toSvgDataUrl(file.content);
  }
  if (file.blobUrl) {
    return file.blobUrl;
  }
  return null;
}

export function buildProjectAssetUrlMap(
  files: ProjectFile[],
  entryPath: string
): Record<string, string> {
  const map: Record<string, string> = {};
  const entryDir = getDirname(normalizeRelativePath(entryPath));
  const basenameCounts = new Map<string, number>();

  for (const file of files) {
    if (!isImageAssetPath(file.path) && !file.content.startsWith('data:')) continue;
    const base = (file.path.split('/').pop() || file.path).toLowerCase();
    basenameCounts.set(base, (basenameCounts.get(base) || 0) + 1);
  }

  for (const file of files) {
    if (!isImageAssetPath(file.path) && !file.content.startsWith('data:')) continue;
    const url = getSandboxReadableAssetUrl(file);
    if (!url) continue;

    const norm = normalizeRelativePath(file.path);
    const registerKey = (key: string) => {
      if (!key) return;
      map[key] = url;
      map[key.toLowerCase()] = url;
    };

    registerKey(norm);
    registerKey('./' + norm);
    registerKey('/' + norm);

    if (norm.toLowerCase().startsWith('public/')) {
      const publicSub = norm.slice('public/'.length);
      registerKey(publicSub);
      registerKey('./' + publicSub);
      registerKey('/' + publicSub);
    }

    if (entryDir && norm.toLowerCase().startsWith(entryDir.toLowerCase() + '/')) {
      const rel = norm.slice(entryDir.length + 1);
      registerKey(rel);
      registerKey('./' + rel);
      registerKey('/' + rel);
    }

    const base = norm.split('/').pop() || norm;
    if ((basenameCounts.get(base.toLowerCase()) || 0) === 1 && !map[base]) {
      registerKey(base);
    }
  }

  return map;
}

export function resolveAssetUrlReference(
  rawRef: string,
  baseFilePath: string | null,
  assetMap: Record<string, string>,
  entryPath: string
): string | null {
  if (!rawRef) return null;
  const trimmed = rawRef.trim();
  if (
    !trimmed ||
    /^(https?:)?\/\//i.test(trimmed) ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('#')
  ) {
    return null;
  }

  const clean = trimmed
    .split('?')[0]
    .split('#')[0]
    .replace(/%PUBLIC_URL%\//g, '/')
    .replace(/%PUBLIC_URL%/g, '');

  const candidates: string[] = [];
  const normDirect = normalizeRelativePath(clean);

  if (clean.startsWith('/')) {
    candidates.push('/' + normDirect, normDirect, `public/${normDirect}`);
  } else {
    if (baseFilePath) {
      const baseDir = getDirname(normalizeRelativePath(baseFilePath));
      const rel = normalizeRelativePath((baseDir ? `${baseDir}/` : '') + clean);
      candidates.push(rel, '/' + rel, './' + rel);
    }
    const entryDir = getDirname(normalizeRelativePath(entryPath));
    if (entryDir) {
      const entryRel = normalizeRelativePath(`${entryDir}/${clean}`);
      candidates.push(entryRel, '/' + entryRel);
    }
    candidates.push(normDirect, '/' + normDirect, `public/${normDirect}`);
  }

  const baseName = clean.split('/').pop() || '';
  if (baseName) candidates.push(baseName);

  for (const c of candidates) {
    if (assetMap[c]) return assetMap[c];
    if (assetMap[c.toLowerCase()]) return assetMap[c.toLowerCase()];
  }
  return null;
}

export function rewriteCssAssetUrls(
  cssText: string,
  cssFilePath: string | null,
  assetMap: Record<string, string>,
  entryPath: string
): string {
  if (!cssText || Object.keys(assetMap).length === 0) return cssText;
  return cssText.replace(
    /url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi,
    (full, _quote: string, rawUrl: string) => {
      const resolved = resolveAssetUrlReference(rawUrl, cssFilePath, assetMap, entryPath);
      if (!resolved) return full;
      return `url(${JSON.stringify(resolved)})`;
    }
  );
}

export function rewriteHtmlAssetRefs(
  html: string,
  entryPath: string,
  assetMap: Record<string, string>
): string {
  if (!html || Object.keys(assetMap).length === 0) return html;

  let next = html.replace(
    /(<(?:img|source|video|audio)\b[^>]*?\s(?:src|poster)=)(["'])([^"']+)(\2[^>]*?>)/gi,
    (full, prefix: string, quote: string, rawSrc: string, suffix: string) => {
      const resolved = resolveAssetUrlReference(rawSrc, entryPath, assetMap, entryPath);
      if (!resolved) return full;
      const safeRaw = rawSrc.replace(/"/g, '&quot;');
      return `${prefix}${quote}${resolved}${quote} data-ve-raw-src="${safeRaw}"${suffix.slice(1)}`;
    }
  );

  next = next.replace(
    /(<link\b[^>]*?\bhref=["'])([^"']+)(["'][^>]*?>)/gi,
    (full, prefix: string, rawHref: string, suffix: string) => {
      if (!/rel=["'][^"']*(?:icon|apple-touch-icon)/i.test(full)) return full;
      const resolved = resolveAssetUrlReference(rawHref, entryPath, assetMap, entryPath);
      if (!resolved) return full;
      return `${prefix}${resolved}${suffix}`;
    }
  );

  next = next.replace(
    /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_full, open: string, cssBody: string, close: string) =>
      `${open}${rewriteCssAssetUrls(cssBody, entryPath, assetMap, entryPath)}${close}`
  );

  next = next.replace(
    /(\sstyle=["'])([^"']*url\([^"']*)(["'])/gi,
    (_full, pre: string, styleBody: string, post: string) =>
      `${pre}${rewriteCssAssetUrls(styleBody, entryPath, assetMap, entryPath)}${post}`
  );

  return next;
}

function buildVirtualFetchShim(
  files: ProjectFile[],
  entryPath: string,
  assetMap: Record<string, string>
): string {
  const fileMap: Record<string, string> = {};
  for (const file of files) {
    if (isNonRuntimeBundleFile(file.path) && file.path.toLowerCase() !== 'package.json') continue;
    fileMap[file.path] = file.content;
    fileMap['./' + file.path] = file.content;
    fileMap['/' + file.path] = file.content;
  }
  const serializedMap = escapeJsonForScriptTag(JSON.stringify(fileMap));
  const serializedAssets = escapeJsonForScriptTag(JSON.stringify(assetMap));
  const serializedEntry = escapeJsonForScriptTag(JSON.stringify(entryPath));

  return `<script data-ve-internal="virtual-fetch">
(function() {
  var __VE_FILES__ = ${serializedMap};
  var __VE_ENTRY__ = ${serializedEntry};
  window.__PROJECT_ASSETS__ = ${serializedAssets};
  var origFetch = window.fetch ? window.fetch.bind(window) : null;

  if (window.location && window.location.protocol === 'about:' && window.history) {
    try {
      var origPush = window.history.pushState;
      var origReplace = window.history.replaceState;
      if (typeof origPush === 'function') {
        window.history.pushState = function() {
          try { return origPush.apply(this, arguments); } catch (e) {}
        };
      }
      if (typeof origReplace === 'function') {
        window.history.replaceState = function() {
          try { return origReplace.apply(this, arguments); } catch (e) {}
        };
      }
    } catch (e) {}
  }

  function resolveAssetUrl(rawUrl) {
    if (typeof rawUrl !== 'string') return null;
    var trimmed = rawUrl.trim();
    if (!trimmed || /^(https?:)?\\/\\//i.test(trimmed) || trimmed.indexOf('data:') === 0 || trimmed.indexOf('blob:') === 0 || trimmed.charAt(0) === '#') {
      return null;
    }
    var clean = trimmed.split('?')[0].split('#')[0].replace(/%PUBLIC_URL%\\//g, '/').replace(/%PUBLIC_URL%/g, '');
    var stripped = clean.replace(/^\\.\\//, '').replace(/^\\/+/, '');
    var assets = window.__PROJECT_ASSETS__ || {};
    var candidates = [clean, '/' + stripped, './' + stripped, stripped, 'public/' + stripped];
    var dir = __VE_ENTRY__.indexOf('/') !== -1 ? __VE_ENTRY__.slice(0, __VE_ENTRY__.lastIndexOf('/') + 1) : '';
    if (dir) candidates.push(dir + stripped);
    var base = stripped.split('/').pop();
    if (base) candidates.push(base);
    for (var i = 0; i < candidates.length; i++) {
      var k = candidates[i];
      if (assets[k]) return assets[k];
      if (assets[k.toLowerCase()]) return assets[k.toLowerCase()];
    }
    return null;
  }
  window.__resolveProjectAsset__ = resolveAssetUrl;

  function resolveRef(url) {
    if (typeof url !== 'string') return null;
    if (/^https?:\\/\\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) return null;
    var clean = url.split('?')[0].split('#')[0].replace(/^\\.\\//, '').replace(/^\\/+/, '');
    if (__VE_FILES__[clean] !== undefined) return __VE_FILES__[clean];
    if (__VE_FILES__['public/' + clean] !== undefined) return __VE_FILES__['public/' + clean];
    var dir = __VE_ENTRY__.indexOf('/') !== -1 ? __VE_ENTRY__.slice(0, __VE_ENTRY__.lastIndexOf('/') + 1) : '';
    var combined = (dir + clean).replace(/^\\.\\//, '');
    return __VE_FILES__[combined] !== undefined ? __VE_FILES__[combined] : null;
  }

  function decodeDataUrlToBlob(dataUrl) {
    try {
      var parts = dataUrl.split(',');
      var meta = parts[0] || '';
      var mimeMatch = /data:([^;]+)/.exec(meta);
      var mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      if (meta.indexOf(';base64') !== -1) {
        var bin = atob(parts[1] || '');
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
      }
      return new Blob([decodeURIComponent(parts[1] || '')], { type: mime });
    } catch (e) {
      return null;
    }
  }

  window.fetch = function(input, init) {
    var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    var assetData = resolveAssetUrl(url);
    if (assetData && assetData.indexOf('data:') === 0) {
      var blob = decodeDataUrlToBlob(assetData);
      if (blob) {
        return Promise.resolve(new Response(blob, { status: 200 }));
      }
    }
    var content = resolveRef(url);
    if (content !== null) {
      var mime = url.endsWith('.json') ? 'application/json' : (url.endsWith('.svg') ? 'image/svg+xml' : 'text/plain');
      return Promise.resolve(new Response(content, { status: 200, headers: { 'Content-Type': mime } }));
    }
    return origFetch ? origFetch(input, init) : Promise.reject(new Error('Network unavailable in sandbox'));
  };

  function rewriteNodeAssets(node) {
    if (!node || node.nodeType !== 1) return;
    var tag = node.tagName ? node.tagName.toLowerCase() : '';
    if (tag === 'img' || tag === 'source') {
      var rawSrc = node.getAttribute('src');
      if (rawSrc) {
        var resolved = resolveAssetUrl(rawSrc);
        if (resolved && resolved !== rawSrc) {
          if (!node.getAttribute('data-ve-raw-src')) {
            node.setAttribute('data-ve-raw-src', rawSrc);
          }
          node.setAttribute('src', resolved);
        }
      }
    }
    var inlineStyle = node.getAttribute && node.getAttribute('style');
    if (inlineStyle && inlineStyle.indexOf('url(') !== -1) {
      var nextStyle = inlineStyle.replace(/url\\(\\s*(['"]?)([^)'"]+)\\1\\s*\\)/gi, function(full, _q, raw) {
        var resolved = resolveAssetUrl(raw);
        return resolved ? ('url("' + resolved + '")') : full;
      });
      if (nextStyle !== inlineStyle) {
        node.setAttribute('style', nextStyle);
      }
    }
  }

  function scanSubtreeAssets(root) {
    if (!root) return;
    if (root.nodeType === 1) rewriteNodeAssets(root);
    if (root.querySelectorAll) {
      var targets = root.querySelectorAll('img[src], source[src], [style*="url("]');
      for (var i = 0; i < targets.length; i++) {
        rewriteNodeAssets(targets[i]);
      }
    }
  }

  if (typeof MutationObserver !== 'undefined') {
    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes') {
          rewriteNodeAssets(m.target);
        } else if (m.addedNodes) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            scanSubtreeAssets(m.addedNodes[j]);
          }
        }
      }
    });
    document.addEventListener('DOMContentLoaded', function() {
      scanSubtreeAssets(document.body || document.documentElement);
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style']
    });
  }
})();
</script>`;
}

function buildRuntimeErrorGuard(): string {
  return `<script data-ve-internal="error-guard">
(function() {
  var shown = false;
  function renderErrorBanner(title, detail) {
    if (shown) return;
    var root = document.getElementById('root') || document.getElementById('app');
    var rootEmpty = !root || root.innerHTML.trim() === '';
    var bodyText = document.body ? document.body.innerText.trim() : '';
    if (!rootEmpty && bodyText.length > 0) return;
    shown = true;
    var box = document.createElement('div');
    box.setAttribute('data-ve-internal', 'error-banner');
    box.style.cssText = 'position:fixed;inset:16px;z-index:2147483646;overflow:auto;background:#0b1120;color:#e2e8f0;border:1px solid #ef4444;border-radius:12px;padding:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;box-shadow:0 20px 50px rgba(0,0,0,0.45);';
    var h = document.createElement('div');
    h.style.cssText = 'color:#f87171;font-weight:700;font-size:14px;margin-bottom:8px;font-family:system-ui,sans-serif;';
    h.textContent = title;
    var p = document.createElement('pre');
    p.style.cssText = 'margin:0;white-space:pre-wrap;word-break:break-word;color:#cbd5e1;';
    p.textContent = detail;
    box.appendChild(h);
    box.appendChild(p);
    if (document.body) document.body.appendChild(box);
  }
  window.addEventListener('error', function(ev) {
    var loc = ev && ev.filename ? ('\\nFile: ' + ev.filename + (ev.lineno ? ':' + ev.lineno + ':' + (ev.colno || 0) : '')) : '';
    renderErrorBanner('App Runtime Error', ((ev && ev.message) ? ev.message : String(ev)) + loc);
  });
  window.addEventListener('unhandledrejection', function(ev) {
    var reason = ev && ev.reason ? (ev.reason.stack || ev.reason.message || String(ev.reason)) : 'Unhandled promise rejection';
    renderErrorBanner('App Async Error', reason);
  });
})();
</script>`;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildBlobModuleLoaderMarkup(compiledJs: string): string {
  const safeJson = escapeJsonForScriptTag(JSON.stringify({ js: compiledJs }));
  return `<script type="application/json" id="__ve_bundle_payload__" data-ve-internal="bundle-payload">${safeJson}</script>
<script data-ve-internal="blob-loader">
(function() {
  var payloadEl = document.getElementById('__ve_bundle_payload__');
  if (!payloadEl) return;
  var payload;
  try {
    payload = JSON.parse(payloadEl.textContent || '{}');
  } catch (err) {
    window.dispatchEvent(new ErrorEvent('error', { message: err && err.message ? err.message : String(err) }));
    return;
  }
  if (!payload || !payload.js) return;

  function collectImportedSpecs(code) {
    var specs = [];
    var seen = Object.create(null);
    var re = /(?:^|[;\\n])\\s*(?:import|export)\\s+(?:[^;'"\\n]*?\\s+from\\s+)?['"]([^'"]+)['"]/g;
    var m;
    while ((m = re.exec(code)) !== null) {
      if (m[1] && !seen[m[1]]) {
        seen[m[1]] = true;
        specs.push(m[1]);
      }
    }
    return specs;
  }

  function tryImportDiagnostic(failedBlobUrl, fallbackMessage) {
    try {
      import(failedBlobUrl).catch(function(impErr) {
        var detail = impErr && (impErr.stack || impErr.message) ? (impErr.stack || impErr.message) : fallbackMessage;
        window.dispatchEvent(new ErrorEvent('error', { message: detail }));
      });
    } catch (syncErr) {
      window.dispatchEvent(new ErrorEvent('error', {
        message: (syncErr && syncErr.message) ? syncErr.message : fallbackMessage
      }));
    }
  }

  function diagnoseFailureAndReport(jsCode, failedBlobUrl) {
    var mapEl = document.querySelector('script[type="importmap"]');
    var importMap = {};
    if (mapEl && mapEl.textContent) {
      try {
        var parsedMap = JSON.parse(mapEl.textContent);
        if (parsedMap && parsedMap.imports) importMap = parsedMap.imports;
      } catch (e) {}
    }

    var specs = collectImportedSpecs(jsCode);
    var externalProbes = [];
    var unmapped = [];
    for (var i = 0; i < specs.length; i++) {
      var spec = specs[i];
      if (/^https?:\\/\\//i.test(spec)) {
        externalProbes.push({ spec: spec, url: spec });
      } else if (importMap[spec]) {
        externalProbes.push({ spec: spec, url: importMap[spec] });
      } else if (spec.charAt(0) !== '.' && spec.charAt(0) !== '/' && spec.indexOf('blob:') !== 0 && spec.indexOf('data:') !== 0) {
        var matchedPrefix = false;
        var keys = Object.keys(importMap);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          if (key.charAt(key.length - 1) === '/' && spec.indexOf(key) === 0) {
            externalProbes.push({ spec: spec, url: importMap[key] + spec.slice(key.length) });
            matchedPrefix = true;
            break;
          }
        }
        if (!matchedPrefix) unmapped.push(spec);
      }
    }

    if (unmapped.length > 0) {
      window.dispatchEvent(new ErrorEvent('error', {
        message: 'Failed to resolve external module import(s): ' + unmapped.join(', ')
      }));
      return;
    }

    var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!nativeFetch || externalProbes.length === 0) {
      var inlineEl = document.createElement('script');
      inlineEl.type = 'module';
      inlineEl.setAttribute('data-ve-bundled', 'true');
      inlineEl.setAttribute('data-ve-fallback', 'inline');
      inlineEl.textContent = jsCode;
      inlineEl.onerror = function() {
        tryImportDiagnostic(failedBlobUrl, 'Failed to execute bundled Blob module script (and inline module fallback failed)');
      };
      document.body.appendChild(inlineEl);
      return;
    }

    Promise.all(externalProbes.slice(0, 12).map(function(item) {
      return nativeFetch(item.url, { mode: 'cors' })
        .then(function(res) {
          var ct = (res.headers.get('content-type') || '').toLowerCase();
          if (!res.ok) {
            return item.spec + ' -> HTTP ' + res.status + ' (' + item.url + ')';
          }
          if (ct && ct.indexOf('javascript') === -1 && ct.indexOf('ecmascript') === -1) {
            return item.spec + ' -> invalid MIME "' + ct + '" (' + item.url + ')';
          }
          return null;
        })
        .catch(function(err) {
          return item.spec + ' -> ' + (err && err.message ? err.message : 'network/CORS error') + ' (' + item.url + ')';
        });
    })).then(function(results) {
      var problems = results.filter(Boolean);
      if (problems.length > 0) {
        window.dispatchEvent(new ErrorEvent('error', {
          message: 'Failed to load external module(s):\\n' + problems.join('\\n')
        }));
        return;
      }
      var inlineEl = document.createElement('script');
      inlineEl.type = 'module';
      inlineEl.setAttribute('data-ve-bundled', 'true');
      inlineEl.setAttribute('data-ve-fallback', 'inline');
      inlineEl.textContent = jsCode;
      inlineEl.onerror = function() {
        tryImportDiagnostic(failedBlobUrl, 'Failed to execute bundled Blob module script (check browser console for transitive dependency error)');
      };
      document.body.appendChild(inlineEl);
    });
  }

  try {
    var blob = new Blob([payload.js], { type: 'text/javascript' });
    var blobUrl = URL.createObjectURL(blob);
    var scriptEl = document.createElement('script');
    scriptEl.type = 'module';
    scriptEl.setAttribute('data-ve-bundled', 'true');
    scriptEl.src = blobUrl;
    scriptEl.onerror = function() {
      diagnoseFailureAndReport(payload.js, blobUrl);
    };
    document.body.appendChild(scriptEl);
  } catch (err) {
    window.dispatchEvent(new ErrorEvent('error', { message: err && err.message ? err.message : String(err) }));
  }
})();
</script>`;
}

function buildCompileErrorOverlay(compiledBundle: CompiledProjectBundle): string {
  const details = compiledBundle.errorDetails ?? [];
  const formattedDetails =
    details.length > 0
      ? details
          .map((d) => {
            const loc = d.line !== null ? `Line ${d.line}${d.column !== null ? `:${d.column}` : ''}` : '';
            const header = [d.file || 'Unknown file', loc].filter(Boolean).join(' · ');
            const frame = d.lineText ? `\n  > ${d.lineText}` : '';
            return `${header}\n  ${d.message}${frame}`;
          })
          .join('\n\n')
      : compiledBundle.error || 'Unknown bundling error';

  return `<div data-ve-internal="bundle-error" style="position:fixed;inset:16px;z-index:2147483646;overflow:auto;background:#0b1120;color:#e2e8f0;border:1px solid #ef4444;border-radius:12px;padding:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;box-shadow:0 20px 50px rgba(0,0,0,0.45);"><div style="color:#f87171;font-weight:700;font-size:14px;margin-bottom:10px;font-family:system-ui,sans-serif;">Project Build Error</div><pre style="margin:0;white-space:pre-wrap;word-break:break-word;color:#f1f5f9;">${escapeHtmlText(formattedDetails)}</pre></div>`;
}

export function buildSrcDoc(
  files: ProjectFile[],
  entryPath: string,
  bridgeMarkup = '',
  compiledBundle?: CompiledProjectBundle | null
): string {
  const entryFile = files.find((f) => f.path === entryPath);
  if (!entryFile) {
    return '<!doctype html><html><body style="font-family:sans-serif;padding:24px;color:#cbd5e1;background:#0f172a;">No HTML entry file found.</body></html>';
  }

  const fileLookup = new Map<string, ProjectFile>();
  for (const file of files) {
    fileLookup.set(file.path, file);
  }

  const assetMap = buildProjectAssetUrlMap(files, entryPath);

  let html = tagHtmlWithVeIds(entryFile.content).replace(/%PUBLIC_URL%\//g, '/').replace(/%PUBLIC_URL%/g, '');
  html = rewriteHtmlAssetRefs(html, entryPath, assetMap);

  const stripTailwindDirectives = (cssText: string): string =>
    cssText
      .replace(/@import\s+["']tailwindcss["']\s*;?/gi, '')
      .replace(/@tailwind\s+(base|components|utilities)\s*;?/gi, '');

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
      const rawCssContent = compiledBundle?.usesTailwind
        ? stripTailwindDirectives(cssFile.content)
        : cssFile.content;
      const cssContent = rewriteCssAssetUrls(rawCssContent, cssFile.path, assetMap, entryPath);
      const safeCss = cssContent.replace(/<\/style>/gi, '<\\/style>');
      return `<style data-ve-source="${cssFile.path}">\n${safeCss}\n</style>`;
    }
  );

  // Strip any existing Content-Security-Policy meta tags that would block blob: or esm.sh in sandbox
  html = html.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi, '');

  // Extract and merge any existing <script type="importmap"> from source HTML so only one importmap sits at top of <head>
  const mergedImports: Record<string, string> = {};
  html = html.replace(
    /<script\b([^>]*\btype=["']importmap["'][^>]*)>([\s\S]*?)<\/script>/gi,
    (_full, _attrs: string, body: string) => {
      try {
        const parsed = JSON.parse(body) as { imports?: Record<string, unknown> };
        if (parsed && parsed.imports && typeof parsed.imports === 'object') {
          for (const [k, v] of Object.entries(parsed.imports)) {
            if (typeof v === 'string') mergedImports[k] = v;
          }
        }
      } catch {
        // Ignore malformed source importmap
      }
      return '';
    }
  );

  if (compiledBundle?.importMap) {
    for (const [k, v] of Object.entries(compiledBundle.importMap)) {
      mergedImports[k] = v;
    }
  }

  // Handle script tags cleanly: remove bundled entry scripts (they run safely via Blob URL below),
  // and embed unbundled classic local scripts safely.
  const replacedSet = new Set(
    (compiledBundle?.replacedScriptSrcs ?? []).map((s) => s.trim())
  );
  const inlineModuleQueue = new Set(
    compiledBundle?.hasInlineModuleReplacement ? ['__inline_module__'] : []
  );

  html = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (fullMatch, attrs: string, body: string) => {
      const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(attrs);
      const isModuleType = /\btype=["']module["']/i.test(attrs);

      if (srcMatch) {
        const src = srcMatch[1];
        if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) {
          return fullMatch;
        }
        const resolved = resolveRelativeToEntry(entryPath, src);
        const normSrc = normalizeRelativePath(src);
        if (
          compiledBundle &&
          (replacedSet.has(src) ||
            replacedSet.has(resolved) ||
            replacedSet.has(normSrc) ||
            compiledBundle.js !== undefined ||
            compiledBundle.error !== undefined)
        ) {
          return '';
        }

        if (/\.(tsx?|jsx|mts|cts)(\?.*)?$/i.test(src)) {
          return '';
        }

        const jsFile = fileLookup.get(resolved) ?? fileLookup.get(normSrc);
        if (!jsFile || isNonRuntimeBundleFile(jsFile.path)) {
          return '';
        }
        const safeJs = jsFile.content.replace(/<\/script>/gi, '<\\/script>');
        return `<script${isModuleType ? ' type="module"' : ''} data-ve-source="${jsFile.path}">\n${safeJs}\n</script>`;
      }

      if (
        compiledBundle &&
        inlineModuleQueue.has('__inline_module__') &&
        isModuleType &&
        body.trim()
      ) {
        return '';
      }

      return fullMatch;
    }
  );

  // Build <head> injections with <script type="importmap"> FIRST before any module script
  const headInjections: string[] = [];
  if (Object.keys(mergedImports).length > 0) {
    const mapJson = escapeJsonForScriptTag(JSON.stringify({ imports: mergedImports }));
    headInjections.push(`<script type="importmap" data-ve-internal="importmap">${mapJson}</script>`);
  }

  headInjections.push(buildVirtualFetchShim(files, entryPath, assetMap));
  headInjections.push(buildRuntimeErrorGuard());

  if (compiledBundle?.usesTailwind && !/cdn\.tailwindcss\.com/i.test(html)) {
    headInjections.push(`<script src="https://cdn.tailwindcss.com" data-ve-internal="tailwind-cdn"></script>`);
  }

  if (compiledBundle?.externalCssUrls && compiledBundle.externalCssUrls.length > 0) {
    const seenCss = new Set<string>();
    for (const cssUrl of compiledBundle.externalCssUrls) {
      if (!cssUrl || seenCss.has(cssUrl)) continue;
      seenCss.add(cssUrl);
      headInjections.push(
        `<link rel="stylesheet" href="${escapeHtmlAttr(cssUrl)}" data-ve-internal="external-css" />`
      );
    }
  }

  if (compiledBundle?.css) {
    const strippedCss = compiledBundle.usesTailwind
      ? stripTailwindDirectives(compiledBundle.css)
      : compiledBundle.css;
    const cleanedCss = rewriteCssAssetUrls(strippedCss, entryPath, assetMap, entryPath);
    if (cleanedCss.trim()) {
      const safeCss = cleanedCss.replace(/<\/style>/gi, '<\\/style>');
      headInjections.push(`<style data-ve-bundled="true">\n${safeCss}\n</style>`);
    }
  }

  // Inject visual override CSS if present in project files (persists restyles on React DOM)
  const visualOverrideCss =
    fileLookup.get('src/framecraft-edits.css') ?? fileLookup.get('framecraft-edits.css');
  if (visualOverrideCss && visualOverrideCss.content.trim()) {
    const safeOverrideCss = visualOverrideCss.content.replace(/<\/style>/gi, '<\\/style>');
    headInjections.push(
      `<style data-ve-internal="visual-overrides" data-ve-source="${visualOverrideCss.path}">\n${safeOverrideCss}\n</style>`
    );
  }

  const usedGoogleFamilies = collectUsedGoogleFonts(
    files
      .filter((f) => f.type === 'html' || f.type === 'css' || f.type === 'js')
      .map((f) => f.content)
  );
  const autoFontsHref = buildGoogleFontsHref(usedGoogleFamilies);
  if (autoFontsHref && !html.includes(autoFontsHref)) {
    headInjections.push(
      `<link rel="stylesheet" href="${autoFontsHref}" data-ve-internal="auto-fonts" />`
    );
  }

  const headBlock = headInjections.join('\n');
  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${headBlock}`);
  } else {
    html = `${headBlock}\n${html}`;
  }

  // Inject compiled JS safely via JSON payload -> Blob URL inside <body>
  const bodyInjections: string[] = [];
  if (compiledBundle?.js) {
    bodyInjections.push(buildBlobModuleLoaderMarkup(compiledBundle.js));
  }

  // Inject visual text/removal overrides if present in project files
  const visualOverrideJs =
    fileLookup.get('src/framecraft-edits.js') ?? fileLookup.get('framecraft-edits.js');
  if (visualOverrideJs && visualOverrideJs.content.trim()) {
    const safeJson = escapeJsonForScriptTag(JSON.stringify({ js: visualOverrideJs.content }));
    bodyInjections.push(
      `<script type="application/json" id="__ve_edits_payload__" data-ve-internal="edits-payload">${safeJson}</script>
<script data-ve-internal="edits-loader">
(function() {
  var el = document.getElementById('__ve_edits_payload__');
  if (!el) return;
  try {
    var d = JSON.parse(el.textContent || '{}');
    if (d.js) {
      var u = URL.createObjectURL(new Blob([d.js], { type: 'text/javascript' }));
      var s = document.createElement('script');
      s.src = u;
      document.body.appendChild(s);
    }
  } catch (e) {}
})();
</script>`
    );
  }

  if (compiledBundle?.error || (compiledBundle?.errorDetails && compiledBundle.errorDetails.length > 0)) {
    bodyInjections.push(buildCompileErrorOverlay(compiledBundle));
  }

  if (bridgeMarkup) {
    bodyInjections.push(bridgeMarkup);
  }

    if (bodyInjections.length > 0) {
    const bodyBlock = bodyInjections.join('\n');
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, () => `${bodyBlock}\n</body>`);
    } else {
      html = `${html}\n${bodyBlock}`;
    }
  }

  return html;
}

export interface HotPatchPayload {
  bodyHtml: string;
  cssSources: Record<string, string>;
  overrideCss: string;
  googleFontHref: string | null;
}

export function extractHotPatchPayload(
  files: ProjectFile[],
  entryPath: string
): HotPatchPayload | null {
  const entryFile = files.find((f) => f.path === entryPath);
  if (!entryFile) return null;

  const assetMap = buildProjectAssetUrlMap(files, entryPath);
  let html = tagHtmlWithVeIds(entryFile.content)
    .replace(/%PUBLIC_URL%\//g, '/')
    .replace(/%PUBLIC_URL%/g, '');
  html = rewriteHtmlAssetRefs(html, entryPath, assetMap);

  // Strip local/inline <script> tags so hot-patching body DOM doesn't duplicate script execution
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;

  const cssSources: Record<string, string> = {};
  for (const f of files) {
    if (f.type === 'css') {
      cssSources[f.path] = rewriteCssAssetUrls(f.content, f.path, assetMap, entryPath);
    }
  }

  const overrideCssFile =
    files.find((f) => f.path === 'src/framecraft-edits.css') ??
    files.find((f) => f.path === 'framecraft-edits.css');

  const usedFamilies = collectUsedGoogleFonts(
    files
      .filter((f) => f.type === 'html' || f.type === 'css' || f.type === 'js')
      .map((f) => f.content)
  );

  return {
    bodyHtml,
    cssSources,
    overrideCss: overrideCssFile?.content ?? '',
    googleFontHref: buildGoogleFontsHref(usedFamilies),
  };
}


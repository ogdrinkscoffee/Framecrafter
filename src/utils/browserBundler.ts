import * as esbuild from 'esbuild-wasm';
import type { ProjectFile } from '../types/editor';
import {
  type BundleErrorDetail,
  type CompiledProjectBundle,
  extractScriptsFromHtml,
  isNonRuntimeBundleFile,
  normalizeRelativePath,
} from './projectBundler';

const CODE_EXTENSIONS = [
  '',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.css',
  '.scss',
  '/index.tsx',
  '/index.ts',
  '/index.jsx',
  '/index.js',
  '/index.mjs',
];

const STATIC_ASSET_RE =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf|apk|mp4|webm|mp3|wav|pdf)$/i;

let esbuildInitPromise: Promise<void> | null = null;

async function ensureEsbuildWasmReady(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }
  if (!esbuildInitPromise) {
    esbuildInitPromise = esbuild
      .initialize({
        wasmURL: '/esbuild.wasm',
        worker: true,
      })
      .catch(() => {
        return esbuild.initialize({
          wasmURL: '/esbuild.wasm',
          worker: false,
        });
      });
  }
  return esbuildInitPromise;
}

function getDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
}

function joinPosix(dir: string, rel: string): string {
  const combined = dir ? `${dir}/${rel}` : rel;
  return normalizeRelativePath(combined);
}

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function parsePathAliases(fileMap: Map<string, string>): Array<{ prefix: string; targets: string[] }> {
  const aliases: Array<{ prefix: string; targets: string[] }> = [];
  const cfgRaw = fileMap.get('tsconfig.json') ?? fileMap.get('jsconfig.json');
  if (cfgRaw) {
    try {
      const parsed = JSON.parse(stripJsonComments(cfgRaw)) as {
        compilerOptions?: { paths?: Record<string, string[]> };
      };
      const paths = parsed.compilerOptions?.paths;
      if (paths && typeof paths === 'object') {
        for (const [pattern, targets] of Object.entries(paths)) {
          if (!Array.isArray(targets)) continue;
          const cleanPattern = pattern.replace(/\*$/, '');
          aliases.push({
            prefix: cleanPattern,
            targets: targets.map((t) => normalizeRelativePath(t.replace(/\*$/, ''))),
          });
        }
      }
    } catch {
      // Ignore malformed tsconfig/jsconfig
    }
  }
  if (!aliases.some((a) => a.prefix === '@/')) {
    aliases.push({ prefix: '@/', targets: ['src', ''] });
  }
  return aliases;
}

function parsePkgDependencies(fileMap: Map<string, string>): Record<string, string> {
  const pkgRaw = fileMap.get('package.json');
  if (!pkgRaw) return {};
  try {
    const parsed = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      ...(parsed.devDependencies ?? {}),
      ...(parsed.dependencies ?? {}),
    };
  } catch {
    return {};
  }
}

function parseExactSemver(rawVer: string | undefined): string | null {
  if (!rawVer || typeof rawVer !== 'string') return null;
  const cleaned = rawVer.trim().replace(/^[~^>=<\s]+/, '').split(/\s+/)[0];
  return /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(cleaned) ? cleaned : null;
}

function splitPackageSpecifier(spec: string): { pkgName: string; subpath: string } {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    if (parts.length >= 2) {
      return {
        pkgName: `${parts[0]}/${parts[1]}`,
        subpath: parts.length > 2 ? `/${parts.slice(2).join('/')}` : '',
      };
    }
  }
  const slashIdx = spec.indexOf('/');
  if (slashIdx === -1) {
    return { pkgName: spec, subpath: '' };
  }
  return {
    pkgName: spec.slice(0, slashIdx),
    subpath: spec.slice(slashIdx),
  };
}

export function buildEsmShImportMap(
  externalSpecs: Set<string>,
  pkgDeps: Record<string, string>
): Record<string, string> {
  const reactVer = parseExactSemver(pkgDeps.react) ?? '19.0.1';
  const reactDomVer = parseExactSemver(pkgDeps['react-dom']) ?? reactVer;

  const map: Record<string, string> = {
    react: `https://esm.sh/react@${reactVer}`,
    'react/': `https://esm.sh/react@${reactVer}/`,
    'react/jsx-runtime': `https://esm.sh/react@${reactVer}/jsx-runtime`,
    'react/jsx-dev-runtime': `https://esm.sh/react@${reactVer}/jsx-dev-runtime`,
    'react-dom': `https://esm.sh/react-dom@${reactDomVer}`,
    'react-dom/': `https://esm.sh/react-dom@${reactDomVer}/`,
    'react-dom/client': `https://esm.sh/react-dom@${reactDomVer}/client`,
  };

  for (const spec of externalSpecs) {
    if (map[spec] || spec.startsWith('react/') || spec.startsWith('react-dom/')) {
      continue;
    }
    const { pkgName, subpath } = splitPackageSpecifier(spec);
    const ver = parseExactSemver(pkgDeps[pkgName]);
    const pkgPinned = ver ? `${pkgName}@${ver}` : pkgName;
    map[spec] = `https://esm.sh/${pkgPinned}${subpath}?external=react,react-dom`;
  }

  return map;
}

function getLoaderForPath(filePath: string): esbuild.Loader {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return 'ts';
  if (lower.endsWith('.jsx')) return 'jsx';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) return 'js';
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
  return 'text';
}

function lookupRawFile(fileMap: Map<string, string>, rawKey: string): string | undefined {
  const stripped = rawKey.replace(/^\.\//, '').replace(/^\/+/, '');
  const normalized = normalizeRelativePath(rawKey);
  return fileMap.get(rawKey) ?? fileMap.get(stripped) ?? fileMap.get(normalized);
}

const NODE_CRYPTO_SHIM = `
const gCrypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : null;

function wrapBytes(bytes) {
  const out = new Uint8Array(bytes);
  out.toString = function(encoding = 'hex') {
    if (encoding === 'hex') {
      return Array.from(out).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    if (encoding === 'base64') {
      let bin = '';
      for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
      return typeof btoa === 'function' ? btoa(bin) : bin;
    }
    return new TextDecoder().decode(out);
  };
  return out;
}

export function randomUUID() {
  if (gCrypto && typeof gCrypto.randomUUID === 'function') {
    return gCrypto.randomUUID();
  }
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
}

export function randomBytes(size) {
  const buf = new Uint8Array(Math.max(0, Number(size) || 0));
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    gCrypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return wrapBytes(buf);
}

export function getRandomValues(typedArray) {
  if (gCrypto && typeof gCrypto.getRandomValues === 'function') {
    return gCrypto.getRandomValues(typedArray);
  }
  for (let i = 0; i < typedArray.length; i++) typedArray[i] = Math.floor(Math.random() * 256);
  return typedArray;
}

function fnvHashBytes(chunks) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const combined = chunks.join('');
  for (let i = 0; i < combined.length; i++) {
    const c = combined.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= (c + i) & 0xff;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const seed = (i % 2 === 0 ? h1 : h2) ^ (i * 31);
    out[i] = (seed >>> ((i % 4) * 8)) & 0xff;
  }
  return wrapBytes(out);
}

export function createHash() {
  const chunks = [];
  return {
    update(data) {
      chunks.push(typeof data === 'string' ? data : String(data));
      return this;
    },
    digest(encoding = 'hex') {
      const bytes = fnvHashBytes(chunks);
      return encoding ? bytes.toString(encoding) : bytes;
    }
  };
}

export function createHmac(_alg, key) {
  const chunks = [String(key || '')];
  return {
    update(data) {
      chunks.push(typeof data === 'string' ? data : String(data));
      return this;
    },
    digest(encoding = 'hex') {
      const bytes = fnvHashBytes(chunks);
      return encoding ? bytes.toString(encoding) : bytes;
    }
  };
}

export const webcrypto = gCrypto;
export const subtle = gCrypto ? gCrypto.subtle : undefined;
const cryptoDefault = {
  randomUUID,
  randomBytes,
  getRandomValues,
  createHash,
  createHmac,
  webcrypto,
  subtle,
};
export default cryptoDefault;
`;

const NODE_PATH_SHIM = `
export const sep = '/';
export const delimiter = ':';
export function normalize(p) {
  const parts = String(p || '').replace(/\\\\/g, '/').split('/');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return (String(p || '').startsWith('/') ? '/' : '') + out.join('/');
}
export function join(...args) { return normalize(args.filter(Boolean).join('/')); }
export function resolve(...args) { return '/' + normalize(args.filter(Boolean).join('/')).replace(/^\\/+/, ''); }
export function dirname(p) {
  const s = String(p || '').replace(/\\\\/g, '/');
  const idx = s.lastIndexOf('/');
  return idx <= 0 ? (s.startsWith('/') ? '/' : '.') : s.slice(0, idx);
}
export function basename(p, ext) {
  const base = String(p || '').replace(/\\\\/g, '/').split('/').pop() || '';
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}
export function extname(p) {
  const base = basename(p);
  const idx = base.lastIndexOf('.');
  return idx <= 0 ? '' : base.slice(idx);
}
export const posix = { sep, delimiter, normalize, join, resolve, dirname, basename, extname };
export default { sep, delimiter, normalize, join, resolve, dirname, basename, extname, posix };
`;

const NODE_PROCESS_SHIM = `
export const env = { NODE_ENV: 'development' };
export const browser = true;
export function cwd() { return '/'; }
export function nextTick(fn, ...args) { Promise.resolve().then(() => fn(...args)); }
export default { env, browser, cwd, nextTick };
`;

const NODE_EVENTS_SHIM = `
export class EventEmitter {
  constructor() { this._events = {}; }
  on(ev, fn) { (this._events[ev] = this._events[ev] || []).push(fn); return this; }
  addListener(ev, fn) { return this.on(ev, fn); }
  off(ev, fn) { this._events[ev] = (this._events[ev] || []).filter(f => f !== fn); return this; }
  removeListener(ev, fn) { return this.off(ev, fn); }
  emit(ev, ...args) {
    for (const fn of (this._events[ev] || [])) fn(...args);
    return (this._events[ev] || []).length > 0;
  }
}
export default EventEmitter;
`;

const NODE_BUFFER_SHIM = `
export const Buffer = {
  isBuffer: (v) => v instanceof Uint8Array,
  from(input, enc) {
    if (typeof input === 'string') {
      if (enc === 'base64' && typeof atob === 'function') {
        const bin = atob(input);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
      }
      return new TextEncoder().encode(input);
    }
    return new Uint8Array(input || []);
  },
  alloc: (size) => new Uint8Array(Number(size) || 0),
};
export default Buffer;
`;

const NODE_SHIMS: Record<string, string> = {
  crypto: NODE_CRYPTO_SHIM,
  'node:crypto': NODE_CRYPTO_SHIM,
  path: NODE_PATH_SHIM,
  'node:path': NODE_PATH_SHIM,
  'path/posix': NODE_PATH_SHIM,
  process: NODE_PROCESS_SHIM,
  'node:process': NODE_PROCESS_SHIM,
  events: NODE_EVENTS_SHIM,
  'node:events': NODE_EVENTS_SHIM,
  buffer: NODE_BUFFER_SHIM,
  'node:buffer': NODE_BUFFER_SHIM,
};

function collectEntryModules(
  files: ProjectFile[],
  rawFileMap: Map<string, string>,
  runtimeFileMap: Map<string, string>,
  entryPath: string
): {
  entryModules: string[];
  inlineModules: Array<{ virtualPath: string; content: string }>;
  replacedScriptSrcs: string[];
  hasInlineModuleReplacement: boolean;
  usesTailwind: boolean;
} {
  const entryHtml = rawFileMap.get(entryPath) ?? '';
  const entryDir = getDirname(entryPath);
  const parsedScripts = extractScriptsFromHtml(entryHtml, entryPath, files);

  const entryModules: string[] = [];
  const inlineModules: Array<{ virtualPath: string; content: string }> = [];
  const replacedScriptSrcs: string[] = [];

  for (const mod of parsedScripts.moduleSrcs) {
    if (mod.resolvedPath && runtimeFileMap.has(mod.resolvedPath)) {
      entryModules.push(mod.resolvedPath);
      replacedScriptSrcs.push(mod.rawSrc);
    }
  }

  parsedScripts.inlineModules.forEach((code, idx) => {
    const vPath = `__ve_inline_${idx}.tsx`;
    inlineModules.push({ virtualPath: vPath, content: code });
    entryModules.push(vPath);
  });

  if (entryModules.length === 0) {
    const candidates = [
      'src/main.tsx',
      'src/main.ts',
      'src/main.jsx',
      'src/main.js',
      'src/index.tsx',
      'src/index.ts',
      'src/index.jsx',
      'src/index.js',
      'main.tsx',
      'main.ts',
      'main.jsx',
      'main.js',
      'index.tsx',
      'index.ts',
      'index.jsx',
      'index.js',
    ];
    for (const c of candidates) {
      const inEntryDir = entryDir ? `${entryDir}/${c}` : c;
      if (runtimeFileMap.has(inEntryDir)) {
        entryModules.push(inEntryDir);
        break;
      }
      if (runtimeFileMap.has(c)) {
        entryModules.push(c);
        break;
      }
    }
  }

  let usesTailwind = false;
  for (const content of runtimeFileMap.values()) {
    if (
      /@import\s+["']tailwindcss["']/.test(content) ||
      /@tailwind\s+(base|components|utilities)/.test(content)
    ) {
      usesTailwind = true;
      break;
    }
  }

  return {
    entryModules,
    inlineModules,
    replacedScriptSrcs,
    hasInlineModuleReplacement: inlineModules.length > 0,
    usesTailwind,
  };
}

export async function bundleProjectInBrowser(
  files: ProjectFile[],
  entryPath: string
): Promise<CompiledProjectBundle> {
  await ensureEsbuildWasmReady();

  const rawFileMap = new Map<string, string>();
  const runtimeFileMap = new Map<string, string>();

  for (const f of files) {
    const norm = normalizeRelativePath(f.path);
    rawFileMap.set(norm, f.content);
    if (!isNonRuntimeBundleFile(norm)) {
      runtimeFileMap.set(norm, f.content);
    }
  }

  const normalizedEntry = normalizeRelativePath(entryPath);
  const entryDir = getDirname(normalizedEntry);
  const {
    entryModules,
    inlineModules,
    replacedScriptSrcs,
    hasInlineModuleReplacement,
    usesTailwind: initialTailwind,
  } = collectEntryModules(files, rawFileMap, runtimeFileMap, normalizedEntry);

  for (const im of inlineModules) {
    runtimeFileMap.set(im.virtualPath, im.content);
  }

  if (entryModules.length === 0) {
    return {
      usesTailwind: initialTailwind,
      replacedScriptSrcs,
      hasInlineModuleReplacement,
    };
  }

  const aliases = parsePathAliases(rawFileMap);
  const pkgDeps = parsePkgDependencies(rawFileMap);

  const useSyntheticWrapper = entryModules.length > 1;
  const syntheticWrapperCode = useSyntheticWrapper
    ? entryModules.map((m) => `import ${JSON.stringify('./' + m)};`).join('\n')
    : '';
  const esbuildEntryPoints = useSyntheticWrapper ? ['__ve_root_entry__.tsx'] : [entryModules[0]];

  const resolveFromBase = (
    targetMap: Map<string, string>,
    cleanSpec: string,
    fromDir: string,
    allowExtensionFallback: boolean
  ): string | null => {
    const candidateBases: string[] = [];
    if (cleanSpec.startsWith('/')) {
      const rootRel = normalizeRelativePath(cleanSpec.slice(1));
      candidateBases.push(rootRel);
      if (entryDir) {
        candidateBases.push(joinPosix(entryDir, rootRel));
      }
    } else if (cleanSpec.startsWith('.')) {
      candidateBases.push(joinPosix(fromDir, cleanSpec));
    } else {
      for (const alias of aliases) {
        if (cleanSpec.startsWith(alias.prefix)) {
          const rest = cleanSpec.slice(alias.prefix.length);
          for (const target of alias.targets) {
            const aliased = normalizeRelativePath(target ? `${target}/${rest}` : rest);
            candidateBases.push(aliased);
            if (entryDir) {
              candidateBases.push(joinPosix(entryDir, aliased));
            }
          }
        }
      }
    }

    const extsToTry = allowExtensionFallback ? CODE_EXTENSIONS : [''];
    for (const base of candidateBases) {
      for (const ext of extsToTry) {
        const candidate = normalizeRelativePath(base + ext);
        if (targetMap.has(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  };

  let tailwindDetected = initialTailwind;
  const externalSpecs = new Set<string>();
  const collectedCssChunks: string[] = [];
  const processedCssPaths = new Set<string>();

  const collectCssRecursive = (cssPath: string, visited: Set<string>): string => {
    if (visited.has(cssPath)) return '';
    visited.add(cssPath);
    const rawCss = runtimeFileMap.get(cssPath) ?? rawFileMap.get(cssPath) ?? '';
    if (
      /@import\s+["']tailwindcss["']/.test(rawCss) ||
      /@tailwind\s+(base|components|utilities)/.test(rawCss)
    ) {
      tailwindDetected = true;
    }

    const cssDir = getDirname(cssPath);
    const expanded = rawCss.replace(
      /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/gi,
      (full, importTarget: string) => {
        const trimmed = importTarget.trim();
        if (trimmed === 'tailwindcss') return '';
        if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
          return full;
        }
        const resolvedImport = resolveFromBase(rawFileMap, trimmed, cssDir, false);
        if (resolvedImport) {
          return collectCssRecursive(resolvedImport, visited);
        }
        return full;
      }
    );

    return expanded.replace(/@tailwind\s+(base|components|utilities)\s*;?/gi, '');
  };

  const plugin: esbuild.Plugin = {
    name: 've-browser-vfs',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const spec = args.path;
        if (/^(https?:)?\/\//i.test(spec) || spec.startsWith('data:') || spec.startsWith('blob:')) {
          return { path: spec, external: true };
        }

        if (args.kind === 'entry-point') {
          if (spec === '__ve_root_entry__.tsx') {
            return { path: '__ve_root_entry__.tsx', namespace: 've-vfs' };
          }
          const cleanEntry = normalizeRelativePath(spec);
          if (runtimeFileMap.has(cleanEntry)) {
            return { path: cleanEntry, namespace: 've-vfs' };
          }
          return {
            errors: [{ text: `Web entry file "${cleanEntry}" not found in project` }],
          };
        }

        const qIdx = spec.indexOf('?');
        const hasQuery = qIdx !== -1;
        const cleanSpec = (hasQuery ? spec.slice(0, qIdx) : spec).split('#')[0];
        const queryStr = hasQuery ? spec.slice(qIdx + 1).split('#')[0] : '';
        const queryParams = new URLSearchParams(queryStr);
        const isRawQuery = queryParams.has('raw') || spec.endsWith('?raw');
        const isUrlQuery = queryParams.has('url') || queryParams.has('inline');

        if (!hasQuery && NODE_SHIMS[spec]) {
          return { path: spec, namespace: 've-node-shim' };
        }

        const importerClean =
          args.importer === '__ve_root_entry__.tsx'
            ? ''
            : normalizeRelativePath(args.importer || '');
        const resolveDirClean =
          args.resolveDir && args.resolveDir !== '.' && args.resolveDir !== '/'
            ? normalizeRelativePath(args.resolveDir)
            : '';
        const fromDir = importerClean ? getDirname(importerClean) : resolveDirClean;

        // 1. Vite ?raw imports: resolve against ALL virtual project files (including .kt, .xml, .yml, .sh, .md, etc.)
        if (isRawQuery) {
          const resolvedRaw =
            resolveFromBase(rawFileMap, cleanSpec, fromDir, false) ??
            resolveFromBase(rawFileMap, cleanSpec, fromDir, true);
          if (resolvedRaw) {
            return { path: resolvedRaw, namespace: 'raw-asset' };
          }
          return {
            errors: [
              {
                text: `Cannot resolve ?raw import "${spec}" from "${importerClean || normalizedEntry}"`,
              },
            ],
          };
        }

        // 2. Vite ?url / ?inline or binary/static asset imports (.png, .jpg, .svg, .ico, .woff, .woff2, .apk, etc.)
        if (isUrlQuery || STATIC_ASSET_RE.test(cleanSpec)) {
          const resolvedAsset =
            resolveFromBase(rawFileMap, cleanSpec, fromDir, false) ??
            resolveFromBase(rawFileMap, cleanSpec, fromDir, true);
          if (resolvedAsset) {
            return { path: resolvedAsset, namespace: 've-asset' };
          }
          if (cleanSpec.startsWith('.') || cleanSpec.startsWith('/') || cleanSpec.startsWith('@/')) {
            return { path: cleanSpec, namespace: 've-missing-asset' };
          }
        }

        // 3. Normal web JS/TS/JSX/TSX/JSON/CSS imports inside the virtual project
        const resolvedVfs = resolveFromBase(runtimeFileMap, cleanSpec, fromDir, true);
        if (resolvedVfs) {
          return { path: resolvedVfs, namespace: 've-vfs' };
        }

        if (cleanSpec.startsWith('.') || cleanSpec.startsWith('/')) {
          const candidateRaw = cleanSpec.startsWith('/')
            ? normalizeRelativePath(cleanSpec.slice(1))
            : joinPosix(fromDir, cleanSpec);
          if (isNonRuntimeBundleFile(candidateRaw)) {
            return { path: candidateRaw, namespace: 've-noop-stub' };
          }
          return {
            errors: [
              {
                text: `Cannot resolve relative import "${spec}" from "${importerClean || normalizedEntry}"`,
              },
            ],
          };
        }

        // 4. Bare npm package specifier -> map via <script type="importmap"> to https://esm.sh/
        externalSpecs.add(spec);
        return { path: spec, external: true };
      });

      build.onLoad({ filter: /.*/, namespace: 'raw-asset' }, (args) => {
        const fileText = lookupRawFile(rawFileMap, args.path);
        if (fileText === undefined) {
          return {
            errors: [{ text: `Raw asset not found in virtual filesystem: "${args.path}"` }],
          };
        }
        return {
          contents: fileText,
          loader: 'text',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-asset' }, (args) => {
        const content = lookupRawFile(rawFileMap, args.path) ?? '';
        if (content.startsWith('data:')) {
          return {
            contents: `export default ${JSON.stringify(content)};`,
            loader: 'js',
          };
        }
        return {
          contents: content,
          loader: 'dataurl',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-node-shim' }, (args) => {
        return {
          contents: NODE_SHIMS[args.path] ?? 'export default {};',
          loader: 'js',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-noop-stub' }, () => {
        return {
          contents: 'export default {};',
          loader: 'js',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-missing-asset' }, () => {
        const placeholderSvg =
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="#1e293b"/><text x="60" y="44" fill="#94a3b8" font-size="11" font-family="sans-serif" text-anchor="middle">Asset</text></svg>'
          );
        return {
          contents: `export default ${JSON.stringify(placeholderSvg)};`,
          loader: 'js',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-vfs' }, (args) => {
        if (args.path === '__ve_root_entry__.tsx') {
          return { contents: syntheticWrapperCode, loader: 'tsx', resolveDir: '/' };
        }

        const content = runtimeFileMap.get(args.path) ?? '';
        const lower = args.path.toLowerCase();
        const fileDir = getDirname(args.path);
        const virtualResolveDir = fileDir ? `/${fileDir}` : '/';

        if (lower.endsWith('.css') || lower.endsWith('.scss')) {
          if (!processedCssPaths.has(args.path)) {
            processedCssPaths.add(args.path);
            const expandedCss = collectCssRecursive(args.path, new Set<string>());
            if (expandedCss.trim()) {
              collectedCssChunks.push(expandedCss);
            }
          }
          return { contents: 'export default {};', loader: 'js', resolveDir: virtualResolveDir };
        }

        return {
          contents: content,
          loader: getLoaderForPath(args.path),
          resolveDir: virtualResolveDir,
        };
      });
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: esbuildEntryPoints,
      bundle: true,
      write: false,
      outdir: 'out',
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      jsx: 'automatic',
      define: {
        'process.env.NODE_ENV': '"development"',
        'import.meta.env.DEV': 'true',
        'import.meta.env.PROD': 'false',
        'import.meta.env.MODE': '"development"',
        'import.meta.env.BASE_URL': '"/"',
      },
      plugins: [plugin],
      logLevel: 'silent',
    });

    let js = '';
    let css = collectedCssChunks.join('\n\n');
    for (const outFile of result.outputFiles ?? []) {
      if (outFile.path.endsWith('.js')) {
        js += outFile.text + '\n';
      } else if (outFile.path.endsWith('.css')) {
        css += (css ? '\n\n' : '') + outFile.text;
      }
    }

    const importMap =
      externalSpecs.size > 0 ? buildEsmShImportMap(externalSpecs, pkgDeps) : undefined;

    return {
      js: js.trim(),
      css: css.trim(),
      replacedScriptSrcs,
      hasInlineModuleReplacement,
      usesTailwind: tailwindDetected,
      importMap,
    };
  } catch (err) {
    const maybeBuildFailure = err as { errors?: esbuild.Message[]; message?: string };
    const rawErrors = Array.isArray(maybeBuildFailure?.errors) ? maybeBuildFailure.errors : [];
    const errorDetails: BundleErrorDetail[] = rawErrors.map((e) => {
      const cleanFile = e.location?.file
        ? e.location.file.replace(/^ve-vfs:/, '').replace(/^raw-asset:/, '')
        : normalizedEntry;
      return {
        file: cleanFile,
        line: typeof e.location?.line === 'number' ? e.location.line : null,
        column: typeof e.location?.column === 'number' ? e.location.column : null,
        lineText: e.location?.lineText ?? '',
        message: e.text,
      };
    });

    const summary =
      errorDetails.length > 0
        ? errorDetails
            .map(
              (d) =>
                `${d.file}${d.line !== null ? `:${d.line}` : ''}${d.column !== null ? `:${d.column}` : ''} — ${d.message}`
            )
            .join('\n')
        : err instanceof Error
          ? err.message
          : String(err);

    return {
      usesTailwind: initialTailwind,
      replacedScriptSrcs,
      hasInlineModuleReplacement,
      error: summary,
      errorDetails,
    };
  }
}

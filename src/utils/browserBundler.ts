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
  /\.(png|jpe?g|gif|webp|avif|bmp|svg|ico|woff2?|ttf|eot|otf|apk|mp4|webm|mp3|wav|pdf)$/i;

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

interface PathAliasEntry {
  prefix: string;
  targets: string[];
}

function parsePathAliases(
  fileMap: Map<string, string>,
  entryDir = ''
): { aliases: PathAliasEntry[]; baseUrls: string[] } {
  const aliases: PathAliasEntry[] = [];
  const baseUrls: string[] = [];

  const configNames = [
    'tsconfig.app.json',
    'tsconfig.json',
    'tsconfig.base.json',
    'jsconfig.json',
  ];
  const candidateConfigs = [...configNames];
  if (entryDir) {
    for (const name of configNames) {
      candidateConfigs.push(`${entryDir}/${name}`);
    }
  }

  for (const cfgPath of candidateConfigs) {
    const cfgRaw = fileMap.get(cfgPath);
    if (!cfgRaw) continue;
    const cfgDir = getDirname(cfgPath);
    try {
      const parsed = JSON.parse(stripJsonComments(cfgRaw)) as {
        compilerOptions?: {
          baseUrl?: string;
          paths?: Record<string, string[]>;
        };
      };
      const rawBaseUrl = parsed.compilerOptions?.baseUrl;
      const resolvedBaseUrl =
        typeof rawBaseUrl === 'string'
          ? normalizeRelativePath(
              cfgDir
                ? `${cfgDir}/${rawBaseUrl === '.' ? '' : rawBaseUrl}`
                : rawBaseUrl === '.'
                  ? ''
                  : rawBaseUrl
            )
          : cfgDir;
      if (typeof rawBaseUrl === 'string' && !baseUrls.includes(resolvedBaseUrl)) {
        baseUrls.push(resolvedBaseUrl);
      }

      const paths = parsed.compilerOptions?.paths;
      if (paths && typeof paths === 'object') {
        for (const [pattern, targets] of Object.entries(paths)) {
          if (!Array.isArray(targets)) continue;
          const cleanPattern = pattern.replace(/\*$/, '');
          aliases.push({
            prefix: cleanPattern,
            targets: targets.map((t) => {
              const stripped = t.replace(/\*$/, '');
              const joined = resolvedBaseUrl ? `${resolvedBaseUrl}/${stripped}` : stripped;
              return normalizeRelativePath(joined);
            }),
          });
        }
      }
    } catch {
      // Ignore malformed tsconfig/jsconfig
    }
  }

  if (!aliases.some((a) => a.prefix === '@/')) {
    const fallbackTargets = entryDir ? [`${entryDir}/src`, 'src', entryDir, ''] : ['src', ''];
    aliases.push({ prefix: '@/', targets: fallbackTargets.map((t) => normalizeRelativePath(t)) });
  }
  return { aliases, baseUrls };
}

function parseWorkspaceEntries(
  rawFileMap: Map<string, string>,
  runtimeFileMap: Map<string, string>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [filePath, rawContent] of rawFileMap.entries()) {
    if (!filePath.endsWith('/package.json')) continue;
    if (filePath.split('/').length > 4) continue;
    try {
      const pkg = JSON.parse(rawContent) as {
        name?: string;
        main?: string;
        module?: string;
        exports?: Record<string, unknown> | string;
      };
      if (!pkg.name || typeof pkg.name !== 'string') continue;
      const pkgDir = getDirname(filePath);
      const candidates: string[] = [];
      if (typeof pkg.exports === 'string') candidates.push(pkg.exports);
      else if (pkg.exports && typeof pkg.exports === 'object') {
        const dot = pkg.exports['.'];
        if (typeof dot === 'string') candidates.push(dot);
        else if (dot && typeof dot === 'object') {
          const dotObj = dot as Record<string, unknown>;
          for (const key of ['import', 'browser', 'default', 'require']) {
            if (typeof dotObj[key] === 'string') candidates.push(dotObj[key] as string);
          }
        }
      }
      if (typeof pkg.module === 'string') candidates.push(pkg.module);
      if (typeof pkg.main === 'string') candidates.push(pkg.main);
      candidates.push('src/index.tsx', 'src/index.ts', 'src/index.jsx', 'src/index.js', 'index.ts', 'index.tsx', 'index.js');

      for (const rel of candidates) {
        for (const ext of ['', '.tsx', '.ts', '.jsx', '.js']) {
          const joined = joinPosix(pkgDir, rel + ext);
          if (runtimeFileMap.has(joined)) {
            map.set(pkg.name, joined);
            break;
          }
        }
        if (map.has(pkg.name)) break;
      }
    } catch {
      // Ignore invalid workspace package.json
    }
  }
  return map;
}

function parsePkgDependencies(fileMap: Map<string, string>, entryDir = ''): Record<string, string> {
  const pkgPaths = entryDir ? [`${entryDir}/package.json`, 'package.json'] : ['package.json'];
  const merged: Record<string, string> = {};
  for (let i = pkgPaths.length - 1; i >= 0; i--) {
    const pkgRaw = fileMap.get(pkgPaths[i]);
    if (!pkgRaw) continue;
    try {
      const parsed = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
      };
      Object.assign(
        merged,
        parsed.peerDependencies ?? {},
        parsed.devDependencies ?? {},
        parsed.dependencies ?? {}
      );
    } catch {
      // Ignore malformed package.json
    }
  }
  return merged;
}

function parseExactSemver(rawVer: string | undefined): string | null {
  if (!rawVer || typeof rawVer !== 'string') return null;
  const cleaned = rawVer.trim().replace(/^[~^>=<\s]+/, '').split(/\s+/)[0];
  if (/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(cleaned)) return cleaned;
  if (/^\d+\.\d+$/.test(cleaned) || /^\d+$/.test(cleaned)) return cleaned;
  return null;
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

const EXTERNAL_CSS_PACKAGES = new Set([
  'normalize.css',
  'animate.css',
  'modern-normalize',
  'sanitize.css',
  'reset-css',
  'ress',
  'water.css',
  'mvp.css',
  'pico.css',
  '@picocss/pico',
]);

function isExternalCssSpecifier(cleanSpec: string): boolean {
  if (/\.(css|scss|sass|less|styl)$/i.test(cleanSpec)) return true;
  if (EXTERNAL_CSS_PACKAGES.has(cleanSpec)) return true;
  if (cleanSpec === 'swiper/css' || cleanSpec.startsWith('swiper/css/')) return true;
  return false;
}

function buildEsmShCssUrl(spec: string, pkgDeps: Record<string, string>): string {
  const { pkgName, subpath } = splitPackageSpecifier(spec);
  const ver = parseExactSemver(pkgDeps[pkgName]);
  const pkgPinned = ver ? `${pkgName}@${ver}` : pkgName;
  return `https://esm.sh/${pkgPinned}${subpath}`;
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

const NODE_URL_SHIM = `
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export function fileURLToPath(u) { return String(u || '').replace(/^file:\\/\\//i, ''); }
export function pathToFileURL(p) { return new URL('file://' + (String(p || '').startsWith('/') ? '' : '/') + String(p || '')); }
export function parse(u) { try { const p = new globalThis.URL(u, 'http://localhost'); return { href: p.href, protocol: p.protocol, host: p.host, hostname: p.hostname, port: p.port, pathname: p.pathname, search: p.search, query: p.search.slice(1), hash: p.hash }; } catch { return { href: String(u || '') }; } }
export function format(obj) { return typeof obj === 'string' ? obj : (obj && obj.href) || ''; }
export function resolve(from, to) { try { return new globalThis.URL(to, from).href; } catch { return String(to || ''); } }
export default { URL, URLSearchParams, fileURLToPath, pathToFileURL, parse, format, resolve };
`;

const NODE_UTIL_SHIM = `
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export function promisify(fn) { return (...args) => new Promise((resolve, reject) => fn(...args, (err, res) => err ? reject(err) : resolve(res))); }
export function inherits(ctor, superCtor) { if (ctor && superCtor) { ctor.super_ = superCtor; Object.setPrototypeOf(ctor.prototype, superCtor.prototype); } }
export function inspect(v) { try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }
export function format(f, ...args) { return [f, ...args].map(v => typeof v === 'string' ? v : inspect(v)).join(' '); }
export function deprecate(fn) { return fn; }
export const types = { isUint8Array: (v) => v instanceof Uint8Array, isDate: (v) => v instanceof Date, isRegExp: (v) => v instanceof RegExp };
export default { TextEncoder, TextDecoder, promisify, inherits, inspect, format, deprecate, types };
`;

const NODE_ASSERT_SHIM = `
export function ok(val, msg) { if (!val) throw new Error(msg || 'Assertion failed'); }
export function strictEqual(a, b, msg) { if (!Object.is(a, b)) throw new Error(msg || 'Expected ' + a + ' === ' + b); }
export function equal(a, b, msg) { if (a != b) throw new Error(msg || 'Expected ' + a + ' == ' + b); }
export const strict = ok;
export default Object.assign(ok, { ok, strictEqual, equal, strict });
`;

const NODE_QUERYSTRING_SHIM = `
export function parse(str) {
  const out = {};
  const params = new URLSearchParams(String(str || '').replace(/^\\?/, ''));
  params.forEach((v, k) => { out[k] = k in out ? (Array.isArray(out[k]) ? [...out[k], v] : [out[k], v]) : v; });
  return out;
}
export function stringify(obj) {
  const params = new URLSearchParams();
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) v.forEach(item => params.append(k, String(item)));
      else if (v !== undefined) params.append(k, String(v));
    }
  }
  return params.toString();
}
export const encode = stringify;
export const decode = parse;
export default { parse, stringify, encode, decode };
`;

const NODE_STREAM_SHIM = `
import { EventEmitter } from 'events';
export class Stream extends EventEmitter { pipe(dest) { return dest; } }
export class Readable extends Stream { read() { return null; } destroy() { return this; } }
export class Writable extends Stream { write() { return true; } end() { return this; } destroy() { return this; } }
export class Duplex extends Stream { read() { return null; } write() { return true; } end() { return this; } }
export class Transform extends Duplex {}
export class PassThrough extends Transform {}
export function pipeline(...args) { const cb = args[args.length - 1]; if (typeof cb === 'function') cb(); return args[args.length - 1]; }
export function finished(_s, cb) { if (typeof cb === 'function') cb(); return () => {}; }
export default { Stream, Readable, Writable, Duplex, Transform, PassThrough, pipeline, finished };
`;

const NODE_OS_SHIM = `
export const EOL = '\\n';
export function platform() { return 'browser'; }
export function arch() { return 'wasm'; }
export function type() { return 'Browser'; }
export function release() { return '1.0.0'; }
export function hostname() { return 'localhost'; }
export function homedir() { return '/'; }
export function tmpdir() { return '/tmp'; }
export function cpus() { return []; }
export default { EOL, platform, arch, type, release, hostname, homedir, tmpdir, cpus };
`;

const NODE_FS_SHIM = `
export function existsSync() { return false; }
export function readFileSync() { return ''; }
export function writeFileSync() {}
export function readdirSync() { return []; }
export function statSync() { return { isFile: () => false, isDirectory: () => false, size: 0 }; }
export const promises = {
  readFile: async () => '',
  writeFile: async () => {},
  readdir: async () => [],
  stat: async () => ({ isFile: () => false, isDirectory: () => false, size: 0 }),
  mkdir: async () => {},
};
export default { existsSync, readFileSync, writeFileSync, readdirSync, statSync, promises };
`;

const EMPTY_BROWSER_SHIM = `export default {};`;
const VITE_CLIENT_SHIM = `export function createHotContext() { return { accept() {}, dispose() {}, invalidate() {}, decline() {}, on() {}, off() {}, send() {} }; } export function updateStyle() {} export function removeStyle() {} export default {};`;

const NODE_SHIMS: Record<string, string> = {
  crypto: NODE_CRYPTO_SHIM,
  'node:crypto': NODE_CRYPTO_SHIM,
  path: NODE_PATH_SHIM,
  'node:path': NODE_PATH_SHIM,
  'path/posix': NODE_PATH_SHIM,
  'node:path/posix': NODE_PATH_SHIM,
  process: NODE_PROCESS_SHIM,
  'node:process': NODE_PROCESS_SHIM,
  events: NODE_EVENTS_SHIM,
  'node:events': NODE_EVENTS_SHIM,
  buffer: NODE_BUFFER_SHIM,
  'node:buffer': NODE_BUFFER_SHIM,
  url: NODE_URL_SHIM,
  'node:url': NODE_URL_SHIM,
  util: NODE_UTIL_SHIM,
  'node:util': NODE_UTIL_SHIM,
  assert: NODE_ASSERT_SHIM,
  'node:assert': NODE_ASSERT_SHIM,
  'assert/strict': NODE_ASSERT_SHIM,
  'node:assert/strict': NODE_ASSERT_SHIM,
  querystring: NODE_QUERYSTRING_SHIM,
  'node:querystring': NODE_QUERYSTRING_SHIM,
  string_decoder: 'export class StringDecoder { write(b) { return String(b || ""); } end(b) { return String(b || ""); } } export default { StringDecoder };',
  'node:string_decoder': 'export class StringDecoder { write(b) { return String(b || ""); } end(b) { return String(b || ""); } } export default { StringDecoder };',
  stream: NODE_STREAM_SHIM,
  'node:stream': NODE_STREAM_SHIM,
  'stream/web': NODE_STREAM_SHIM,
  'node:stream/web': NODE_STREAM_SHIM,
  'stream/promises': NODE_STREAM_SHIM,
  'node:stream/promises': NODE_STREAM_SHIM,
  os: NODE_OS_SHIM,
  'node:os': NODE_OS_SHIM,
  fs: NODE_FS_SHIM,
  'node:fs': NODE_FS_SHIM,
  'fs/promises': 'export const readFile = async () => ""; export const writeFile = async () => {}; export const readdir = async () => []; export const stat = async () => ({ isFile: () => false, isDirectory: () => false, size: 0 }); export const mkdir = async () => {}; export default { readFile, writeFile, readdir, stat, mkdir };',
  'node:fs/promises': 'export const readFile = async () => ""; export const writeFile = async () => {}; export const readdir = async () => []; export const stat = async () => ({ isFile: () => false, isDirectory: () => false, size: 0 }); export const mkdir = async () => {}; export default { readFile, writeFile, readdir, stat, mkdir };',
  http: EMPTY_BROWSER_SHIM,
  'node:http': EMPTY_BROWSER_SHIM,
  https: EMPTY_BROWSER_SHIM,
  'node:https': EMPTY_BROWSER_SHIM,
  http2: EMPTY_BROWSER_SHIM,
  'node:http2': EMPTY_BROWSER_SHIM,
  zlib: EMPTY_BROWSER_SHIM,
  'node:zlib': EMPTY_BROWSER_SHIM,
  tty: 'export function isatty() { return false; } export default { isatty };',
  'node:tty': 'export function isatty() { return false; } export default { isatty };',
  net: EMPTY_BROWSER_SHIM,
  'node:net': EMPTY_BROWSER_SHIM,
  tls: EMPTY_BROWSER_SHIM,
  'node:tls': EMPTY_BROWSER_SHIM,
  dns: EMPTY_BROWSER_SHIM,
  'node:dns': EMPTY_BROWSER_SHIM,
  dgram: EMPTY_BROWSER_SHIM,
  'node:dgram': EMPTY_BROWSER_SHIM,
  child_process: EMPTY_BROWSER_SHIM,
  'node:child_process': EMPTY_BROWSER_SHIM,
  cluster: EMPTY_BROWSER_SHIM,
  'node:cluster': EMPTY_BROWSER_SHIM,
  module: 'export function createRequire() { return () => ({}); } export default { createRequire };',
  'node:module': 'export function createRequire() { return () => ({}); } export default { createRequire };',
  vm: EMPTY_BROWSER_SHIM,
  'node:vm': EMPTY_BROWSER_SHIM,
  readline: EMPTY_BROWSER_SHIM,
  'node:readline': EMPTY_BROWSER_SHIM,
  perf_hooks: 'export const performance = globalThis.performance; export default { performance };',
  'node:perf_hooks': 'export const performance = globalThis.performance; export default { performance };',
  async_hooks: EMPTY_BROWSER_SHIM,
  'node:async_hooks': EMPTY_BROWSER_SHIM,
  diagnostics_channel: EMPTY_BROWSER_SHIM,
  'node:diagnostics_channel': EMPTY_BROWSER_SHIM,
  inspector: EMPTY_BROWSER_SHIM,
  'node:inspector': EMPTY_BROWSER_SHIM,
  worker_threads: EMPTY_BROWSER_SHIM,
  'node:worker_threads': EMPTY_BROWSER_SHIM,
  v8: EMPTY_BROWSER_SHIM,
  'node:v8': EMPTY_BROWSER_SHIM,
  constants: EMPTY_BROWSER_SHIM,
  'node:constants': EMPTY_BROWSER_SHIM,
  punycode: EMPTY_BROWSER_SHIM,
  'node:punycode': EMPTY_BROWSER_SHIM,
  timers: 'export const setTimeout = globalThis.setTimeout; export const clearTimeout = globalThis.clearTimeout; export const setInterval = globalThis.setInterval; export const clearInterval = globalThis.clearInterval; export default { setTimeout, clearTimeout, setInterval, clearInterval };',
  'node:timers': 'export const setTimeout = globalThis.setTimeout; export const clearTimeout = globalThis.clearTimeout; export const setInterval = globalThis.setInterval; export const clearInterval = globalThis.clearInterval; export default { setTimeout, clearTimeout, setInterval, clearInterval };',
  'timers/promises': EMPTY_BROWSER_SHIM,
  'node:timers/promises': EMPTY_BROWSER_SHIM,
  'vite/client': VITE_CLIENT_SHIM,
  '@vite/env': VITE_CLIENT_SHIM,
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

  const { aliases, baseUrls } = parsePathAliases(rawFileMap, entryDir);
  const pkgDeps = parsePkgDependencies(rawFileMap, entryDir);
  const workspaceEntries = parseWorkspaceEntries(rawFileMap, runtimeFileMap);

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
      candidateBases.push(`public/${rootRel}`);
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
      for (const baseDir of baseUrls) {
        const joined = normalizeRelativePath(baseDir ? `${baseDir}/${cleanSpec}` : cleanSpec);
        candidateBases.push(joined);
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
  const externalCssUrls = new Set<string>();
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
        if (!trimmed.startsWith('.') && !trimmed.startsWith('/')) {
          externalCssUrls.add(buildEsmShCssUrl(trimmed, pkgDeps));
          return '';
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
        const isWorkerQuery = queryParams.has('worker') || queryParams.has('sharedworker');

        if (!hasQuery && (NODE_SHIMS[spec] || spec.startsWith('node:') || spec.startsWith('virtual:'))) {
          return { path: spec, namespace: 've-node-shim' };
        }

        if (isWorkerQuery) {
          return { path: cleanSpec, namespace: 've-worker-stub' };
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

        // 3b. Workspace package imports inside monorepos (e.g. @acme/ui)
        if (workspaceEntries.has(cleanSpec)) {
          return { path: workspaceEntries.get(cleanSpec)!, namespace: 've-vfs' };
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

        // 4. Bare npm package CSS imports (e.g. @mantine/core/styles.css, swiper/css) -> inject as <link rel="stylesheet">
        if (cleanSpec === 'tailwindcss') {
          tailwindDetected = true;
          return { path: cleanSpec, namespace: 've-noop-stub' };
        }
        if (isExternalCssSpecifier(cleanSpec)) {
          externalCssUrls.add(buildEsmShCssUrl(cleanSpec, pkgDeps));
          return { path: cleanSpec, namespace: 've-noop-stub' };
        }

        // 5. Bare npm package specifier -> map via <script type="importmap"> to https://esm.sh/
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
        if (/\.svg$/i.test(args.path)) {
          const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
          return {
            contents: `export default ${JSON.stringify(svgUrl)};`,
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
          contents: NODE_SHIMS[args.path] ?? EMPTY_BROWSER_SHIM,
          loader: 'js',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 've-worker-stub' }, () => {
        return {
          contents: `export default class MockWorker { postMessage() {} terminate() {} addEventListener() {} removeEventListener() {} }`,
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

        if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.sass') || lower.endsWith('.less')) {
          if (!processedCssPaths.has(args.path)) {
            processedCssPaths.add(args.path);
            const expandedCss = collectCssRecursive(args.path, new Set<string>());
            if (expandedCss.trim()) {
              collectedCssChunks.push(expandedCss);
            }
          }
          if (/\.module\.(css|scss|sass|less)$/i.test(lower)) {
            const classNames = new Set<string>();
            const strippedCss = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/gi, '');
            const clsRegex = /\.([A-Za-z_-][A-Za-z0-9_-]*)/g;
            let clsMatch: RegExpExecArray | null;
            while ((clsMatch = clsRegex.exec(strippedCss)) !== null) {
              classNames.add(clsMatch[1]);
            }
            const mapObj: Record<string, string> = {};
            const namedExports: string[] = [];
            const reserved = new Set([
              'default', 'class', 'function', 'return', 'const', 'let', 'var', 'if', 'else',
              'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'delete',
              'typeof', 'void', 'in', 'of', 'with', 'try', 'catch', 'finally', 'throw',
              'import', 'export', 'extends', 'super', 'this', 'true', 'false', 'null',
            ]);
            for (const cls of classNames) {
              mapObj[cls] = cls;
              if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cls) && !reserved.has(cls)) {
                namedExports.push(`export const ${cls} = ${JSON.stringify(cls)};`);
              }
            }
            const moduleJs = `${namedExports.join('\n')}
const __stylesMap = ${JSON.stringify(mapObj)};
export default new Proxy(__stylesMap, { get(t, p) { return typeof p === 'string' ? (p in t ? t[p] : p) : undefined; } });`;
            return { contents: moduleJs, loader: 'js', resolveDir: virtualResolveDir };
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
      ...(externalCssUrls.size > 0 ? { externalCssUrls: Array.from(externalCssUrls) } : {}),
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

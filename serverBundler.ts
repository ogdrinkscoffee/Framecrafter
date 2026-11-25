import { createRequire } from 'node:module';
import path from 'node:path';
import type * as esbuild from 'esbuild';
import type { CompiledProjectBundle } from './src/utils/projectBundler.ts';

let cachedEsbuild: typeof esbuild | null = null;
async function getEsbuild(): Promise<typeof esbuild> {
  if (cachedEsbuild) return cachedEsbuild;
  try {
    const mod = await import('esbuild');
    cachedEsbuild = (mod.default ?? mod) as typeof esbuild;
    return cachedEsbuild;
  } catch {
    const wasmMod = await import('esbuild-wasm');
    cachedEsbuild = ((wasmMod as { default?: unknown }).default ?? wasmMod) as unknown as typeof esbuild;
    return cachedEsbuild;
  }
}

export interface BundleInputFile {
  path: string;
  content: string;
  type?: string;
}

const require = createRequire(import.meta.url);

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

const BINARY_ASSET_RE = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|eot|otf|mp4|webm|mp3|wav)$/i;

function normalizePosix(raw: string): string {
  const cleaned = raw.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
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

function getDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '' : filePath.slice(0, idx);
}

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function parsePathAliases(fileMap: Map<string, string>): {
  aliases: Array<{ prefix: string; targets: string[] }>;
  baseUrls: string[];
} {
  const aliases: Array<{ prefix: string; targets: string[] }> = [];
  const baseUrls: string[] = [];
  for (const cfgName of ['tsconfig.app.json', 'tsconfig.json', 'tsconfig.base.json', 'jsconfig.json']) {
    const cfgRaw = fileMap.get(cfgName);
    if (!cfgRaw) continue;
    try {
      const parsed = JSON.parse(stripJsonComments(cfgRaw)) as {
        compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
      };
      const rawBaseUrl = parsed.compilerOptions?.baseUrl;
      const base =
        typeof rawBaseUrl === 'string'
          ? normalizePosix(rawBaseUrl === '.' ? '' : rawBaseUrl)
          : '';
      if (typeof rawBaseUrl === 'string' && !baseUrls.includes(base)) {
        baseUrls.push(base);
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
              return normalizePosix(base ? `${base}/${stripped}` : stripped);
            }),
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
  return { aliases, baseUrls };
}

function parseReactVersionFromPkg(fileMap: Map<string, string>): string {
  const pkgRaw = fileMap.get('package.json');
  if (!pkgRaw) return '19.0.1';
  try {
    const parsed = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> };
    const rawVer = parsed.dependencies?.react;
    if (typeof rawVer === 'string') {
      const cleaned = rawVer.replace(/^[^0-9]*/, '').split(/\s+/)[0];
      if (/^\d+\.\d+\.\d+/.test(cleaned)) return cleaned;
    }
  } catch {
    // Fallback
  }
  return '19.0.1';
}

function collectEntryScripts(
  fileMap: Map<string, string>,
  entryPath: string
): {
  entryModules: string[];
  inlineModules: Array<{ virtualPath: string; content: string }>;
  replacedScriptSrcs: string[];
  hasInlineModuleReplacement: boolean;
  usesTailwind: boolean;
} {
  const entryHtml = fileMap.get(entryPath) ?? '';
  const entryDir = getDirname(entryPath);
  const entryModules: string[] = [];
  const inlineModules: Array<{ virtualPath: string; content: string }> = [];
  const replacedScriptSrcs: string[] = [];
  let hasInlineModuleReplacement = false;
  let usesTailwind = false;

  for (const [p, content] of fileMap.entries()) {
    if (
      p.toLowerCase().endsWith('.css') &&
      (/@import\s+["']tailwindcss["']/.test(content) ||
        /@tailwind\s+(base|components|utilities)/.test(content))
    ) {
      usesTailwind = true;
    }
  }

  const resolveFromEntry = (rawSrc: string): string | null => {
    const clean = rawSrc.split('?')[0].split('#')[0].replace(/%PUBLIC_URL%/g, '');
    const candidates = clean.startsWith('/')
      ? [normalizePosix(clean), normalizePosix((entryDir ? `${entryDir}/` : '') + clean.slice(1))]
      : [normalizePosix((entryDir ? `${entryDir}/` : '') + clean), normalizePosix(clean)];

    for (const c of candidates) {
      if (fileMap.has(c)) return c;
    }
    return null;
  };

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let inlineCount = 0;

  while ((match = scriptRegex.exec(entryHtml)) !== null) {
    const attrs = match[1] || '';
    const body = match[2] || '';
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(attrs);
    const isModule = /\btype=["']module["']/i.test(attrs);

    if (srcMatch) {
      const rawSrc = srcMatch[1];
      if (/^(https?:)?\/\//i.test(rawSrc) || rawSrc.startsWith('data:')) continue;
      const resolved = resolveFromEntry(rawSrc);
      if (!resolved) continue;
      const fileContent = fileMap.get(resolved) ?? '';
      const needsCompile =
        isModule ||
        /\.(tsx?|jsx|mjs|mts|cts)$/i.test(resolved) ||
        /\b(import|export)\b/.test(fileContent);
      if (needsCompile) {
        entryModules.push(resolved);
        replacedScriptSrcs.push(rawSrc);
      }
    } else if (isModule && /\b(import|export)\b/.test(body)) {
      const vPath = `__ve_inline_${inlineCount++}.tsx`;
      inlineModules.push({ virtualPath: vPath, content: body });
      entryModules.push(vPath);
      hasInlineModuleReplacement = true;
    }
  }

  // Fallback for CRA / SPA templates without explicit <script src="..."> in HTML
  if (entryModules.length === 0) {
    const baseCandidates = [
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
    for (const candidate of baseCandidates) {
      const inEntryDir = entryDir ? `${entryDir}/${candidate}` : candidate;
      if (fileMap.has(inEntryDir)) {
        entryModules.push(inEntryDir);
        break;
      }
      if (fileMap.has(candidate)) {
        entryModules.push(candidate);
        break;
      }
    }
  }

  return {
    entryModules,
    inlineModules,
    replacedScriptSrcs,
    hasInlineModuleReplacement,
    usesTailwind,
  };
}

function getLoaderForPath(filePath: string): esbuild.Loader {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tsx')) return 'tsx';
  if (lower.endsWith('.ts') || lower.endsWith('.mts') || lower.endsWith('.cts')) return 'ts';
  if (lower.endsWith('.jsx')) return 'jsx';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.css') || lower.endsWith('.scss')) return 'css';
  return 'js';
}

function buildImportMapForExternalSpecs(
  externalSpecs: Set<string>,
  reactVersion: string
): Record<string, string> {
  const map: Record<string, string> = {
    react: `https://esm.sh/react@${reactVersion}`,
    'react/': `https://esm.sh/react@${reactVersion}/`,
    'react-dom': `https://esm.sh/react-dom@${reactVersion}`,
    'react-dom/': `https://esm.sh/react-dom@${reactVersion}/`,
  };

  for (const spec of externalSpecs) {
    if (
      spec === 'react' ||
      spec === 'react-dom' ||
      spec.startsWith('react/') ||
      spec.startsWith('react-dom/')
    ) {
      continue;
    }
    map[spec] = `https://esm.sh/${spec}?deps=react@${reactVersion},react-dom@${reactVersion}`;
  }

  return map;
}

export async function bundleProjectFiles(
  files: BundleInputFile[],
  entryPath: string
): Promise<CompiledProjectBundle> {
  const fileMap = new Map<string, string>();
  for (const f of files) {
    fileMap.set(normalizePosix(f.path), f.content);
  }

  const normalizedEntryPath = normalizePosix(entryPath);
  const {
    entryModules,
    inlineModules,
    replacedScriptSrcs,
    hasInlineModuleReplacement,
    usesTailwind: initialTailwindFlag,
  } = collectEntryScripts(fileMap, normalizedEntryPath);

  for (const inlineMod of inlineModules) {
    fileMap.set(inlineMod.virtualPath, inlineMod.content);
  }

  if (entryModules.length === 0) {
    return {
      usesTailwind: initialTailwindFlag,
      replacedScriptSrcs,
      hasInlineModuleReplacement,
    };
  }

  const { aliases, baseUrls } = parsePathAliases(fileMap);
  const reactVersion = parseReactVersionFromPkg(fileMap);
  const rootEntryCode = entryModules
    .map((m) => `import ${JSON.stringify('./' + m)};`)
    .join('\n');

  const resolveVirtualPath = (spec: string, importerVirtualPath: string): string | null => {
    const cleanSpec = spec.split('?')[0].split('#')[0];
    const fromDir = getDirname(importerVirtualPath);

    const candidateBases: string[] = [];
    if (cleanSpec.startsWith('/')) {
      candidateBases.push(normalizePosix(cleanSpec.slice(1)));
    } else if (cleanSpec.startsWith('.')) {
      candidateBases.push(normalizePosix(path.posix.join(fromDir || '.', cleanSpec)));
    } else {
      for (const alias of aliases) {
        if (cleanSpec.startsWith(alias.prefix)) {
          const rest = cleanSpec.slice(alias.prefix.length);
          for (const target of alias.targets) {
            candidateBases.push(normalizePosix(target ? `${target}/${rest}` : rest));
          }
        }
      }
      for (const baseDir of baseUrls) {
        candidateBases.push(normalizePosix(baseDir ? `${baseDir}/${cleanSpec}` : cleanSpec));
      }
    }

    for (const base of candidateBases) {
      for (const ext of CODE_EXTENSIONS) {
        const candidate = normalizePosix(base + ext);
        if (fileMap.has(candidate)) {
          return candidate;
        }
      }
    }
    return null;
  };

  const runEsbuildPass = async (externalBareMode: boolean) => {
    let tailwindDetected = initialTailwindFlag;
    const missingLocalPackages: string[] = [];
    const externalSpecs = new Set<string>();
    const externalCssUrls = new Set<string>();

    const plugin: esbuild.Plugin = {
      name: 've-vfs',
      setup(build) {
        build.onResolve({ filter: /.*/ }, (args) => {
          const spec = args.path;
          if (/^(https?:)?\/\//i.test(spec) || spec.startsWith('data:')) {
            return { path: spec, external: true };
          }

          if (args.kind === 'entry-point' && spec === '__ve_root_entry__.tsx') {
            return { path: '__ve_root_entry__.tsx', namespace: 've-vfs' };
          }

          // Only run virtual resolution when importing from virtual project files
          if (args.importer && args.namespace === 've-vfs') {
            if (spec === 'vite/client' || spec === '@vite/env' || spec.startsWith('virtual:')) {
              return { path: spec, namespace: 've-noop-stub' };
            }

            const importerPath = args.importer === '__ve_root_entry__.tsx' ? '' : args.importer;
            const resolvedVfs = resolveVirtualPath(spec, importerPath);
            if (resolvedVfs) {
              return { path: resolvedVfs, namespace: 've-vfs' };
            }

            if (spec.startsWith('.') || spec.startsWith('/')) {
              if (BINARY_ASSET_RE.test(spec.split('?')[0]) || spec.split('?')[0].endsWith('.svg')) {
                return { path: spec, namespace: 've-missing-asset' };
              }
              return undefined;
            }

            const cleanBare = spec.split('?')[0].split('#')[0];
            if (cleanBare === 'tailwindcss') {
              tailwindDetected = true;
              return { path: cleanBare, namespace: 've-noop-stub' };
            }
            if (/\.(css|scss|sass|less|styl)$/i.test(cleanBare) || cleanBare === 'swiper/css' || cleanBare.startsWith('swiper/css/')) {
              externalCssUrls.add(`https://esm.sh/${cleanBare}`);
              return { path: cleanBare, namespace: 've-noop-stub' };
            }

            // Bare npm package specifier (e.g. react, lucide-react, etc.)
            if (externalBareMode) {
              externalSpecs.add(spec);
              return { path: spec, external: true };
            }

            try {
              const resolvedLocal = require.resolve(spec, { paths: [process.cwd()] });
              return { path: resolvedLocal };
            } catch {
              missingLocalPackages.push(spec);
              externalSpecs.add(spec);
              return { path: spec, external: true };
            }
          }

          return undefined;
        });

        build.onLoad({ filter: /.*/, namespace: 've-noop-stub' }, (args) => {
          if (args.path === 'virtual:pwa-register') {
            return {
              contents:
                'export function registerSW(_options = {}) { return async function updateSW(_reloadPage) {}; } export default { registerSW };',
              loader: 'js',
            };
          }
          if (args.path.startsWith('virtual:pwa-register/')) {
            return {
              contents:
                'export function useRegisterSW(_options = {}) { const noop = () => {}; const updateServiceWorker = async () => {}; return { offlineReady: [false, noop], needRefresh: [false, noop], updateServiceWorker }; } export function registerSW(_options = {}) { return async function updateSW(_reloadPage) {}; } export default { useRegisterSW, registerSW };',
              loader: 'js',
            };
          }
          if (args.path === 'virtual:pwa-info') {
            return {
              contents: 'export const pwaInfo = undefined; export default pwaInfo;',
              loader: 'js',
            };
          }
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
            return { contents: rootEntryCode, loader: 'tsx', resolveDir: process.cwd() };
          }

          const content = fileMap.get(args.path) ?? '';
          const lower = args.path.toLowerCase();

          if (lower.endsWith('.svg')) {
            const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`;
            return { contents: `export default ${JSON.stringify(svgDataUrl)};`, loader: 'js' };
          }

          if (lower.endsWith('.html') || lower.endsWith('.txt') || lower.endsWith('.md')) {
            return { contents: `export default ${JSON.stringify(content)};`, loader: 'js' };
          }

          if (lower.endsWith('.css') || lower.endsWith('.scss')) {
            if (
              /@import\s+["']tailwindcss["']/.test(content) ||
              /@tailwind\s+(base|components|utilities)/.test(content)
            ) {
              tailwindDetected = true;
            }
            const cleanedCss = content
              .replace(/@import\s+["']tailwindcss["']\s*;?/gi, '')
              .replace(/@tailwind\s+(base|components|utilities)\s*;?/gi, '');
            return { contents: cleanedCss, loader: 'css', resolveDir: process.cwd() };
          }

          return {
            contents: content,
            loader: getLoaderForPath(args.path),
            resolveDir: process.cwd(),
          };
        });
      },
    };

    const esbuildImpl = await getEsbuild();
    const result = await esbuildImpl.build({
      entryPoints: ['__ve_root_entry__.tsx'],
      bundle: true,
      write: false,
      outdir: 'out',
      format: externalBareMode ? 'esm' : 'iife',
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

    return { result, tailwindDetected, missingLocalPackages, externalSpecs, externalCssUrls };
  };

  try {
    let pass = await runEsbuildPass(false);
    // If any npm dependency is missing locally, rebuild in clean ESM + importmap mode
    // so React & all third-party libraries share a single consistent copy via esm.sh.
    if (pass.missingLocalPackages.length > 0) {
      pass = await runEsbuildPass(true);
    }

    let js = '';
    let css = '';
    for (const outFile of pass.result.outputFiles ?? []) {
      if (outFile.path.endsWith('.js')) {
        js += outFile.text + '\n';
      } else if (outFile.path.endsWith('.css')) {
        css += outFile.text + '\n';
      }
    }

    const importMap =
      pass.externalSpecs.size > 0
        ? buildImportMapForExternalSpecs(pass.externalSpecs, reactVersion)
        : undefined;

    return {
      js: js.trim(),
      css: css.trim(),
      ...(pass.externalCssUrls.size > 0 ? { externalCssUrls: Array.from(pass.externalCssUrls) } : {}),
      replacedScriptSrcs,
      hasInlineModuleReplacement,
      usesTailwind: pass.tailwindDetected,
      importMap,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      usesTailwind: initialTailwindFlag,
      replacedScriptSrcs,
      hasInlineModuleReplacement,
      error: msg,
    };
  }
}

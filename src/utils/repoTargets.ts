import type { ProjectFile } from '../types/editor';

export type RepoTargetKind = 'web' | 'desktop' | 'mobile';

/** How the detected targets relate to each other inside one repository. */
export type RepoLayoutMode = 'single' | 'shared-ui' | 'monorepo';

export interface RepoTarget {
  id: string;
  kind: RepoTargetKind;
  /** Short badge label, e.g. "Desktop .exe". */
  label: string;
  framework: string;
  /** Repository-relative folder for this target ('' = repository root). */
  rootPath: string;
  /** Repository-relative HTML entry used to preview this target, when one exists. */
  entryFile: string | null;
  /** Repository-relative platform config file backing the config inspector. */
  configPath: string | null;
  /** True when this target shares one frontend with another target. */
  sharedUi: boolean;
}

export interface RepoScanResult {
  targets: RepoTarget[];
  layout: RepoLayoutMode;
  isSharedUi: boolean;
  isMonorepo: boolean;
  warnings: string[];
}

export const TARGET_KIND_LABELS: Record<RepoTargetKind, string> = {
  web: 'Web',
  desktop: 'Desktop .exe',
  mobile: 'Mobile .apk',
};

const TARGET_KIND_ORDER: Record<RepoTargetKind, number> = {
  web: 0,
  desktop: 1,
  mobile: 2,
};

const IGNORED_RE = /(^|\/)(node_modules|\.git|\.hg|\.svn|Pods|dist|build|out|\.next|\.nuxt)\//i;

const WEB_FRAMEWORK_DEPS: Array<{ dep: string; framework: string }> = [
  { dep: 'next', framework: 'next' },
  { dep: '@angular/core', framework: 'angular' },
  { dep: '@sveltejs/kit', framework: 'svelte' },
  { dep: 'svelte', framework: 'svelte' },
  { dep: 'nuxt', framework: 'nuxt' },
  { dep: 'vue', framework: 'vue' },
  { dep: 'vite', framework: 'vite' },
  { dep: 'react', framework: 'react' },
];

const ELECTRON_MAIN_CANDIDATES = [
  'electron/main.cjs',
  'electron/main.js',
  'electron/main.mjs',
  'electron/main.ts',
  'electron/index.js',
  'main.cjs',
  'main.js',
];

const ELECTRON_BUILDER_CANDIDATES = [
  'electron-builder.json',
  'electron-builder.yml',
  'electron-builder.yaml',
  'electron-builder.js',
  'electron-builder.cjs',
  'electron-builder.ts',
];

const WEB_ENTRY_CANDIDATES = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'site/index.html',
];

const WEB_CONFIG_CANDIDATES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
  'svelte.config.js',
  'nuxt.config.ts',
  'angular.json',
];

const CAPACITOR_CONFIG_CANDIDATES = [
  'capacitor.config.ts',
  'capacitor.config.json',
  'capacitor.config.js',
  'capacitor.config.cjs',
  'capacitor.config.mjs',
];

const ANDROID_GRADLE_CANDIDATES = ['android/app/build.gradle', 'android/app/build.gradle.kts'];

const EXPO_ENTRY_CANDIDATES = [
  'app/_layout.tsx',
  'app/_layout.jsx',
  'app/index.tsx',
  'app/index.jsx',
  'App.tsx',
  'App.jsx',
  'App.js',
  'index.js',
];

const MAX_ROOT_DEPTH = 2;

interface PackageManifest {
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function basename(path: string): string {
  const clean = normalizePath(path);
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? clean : clean.slice(idx + 1);
}

function dirname(path: string): string {
  const clean = normalizePath(path);
  const idx = clean.lastIndexOf('/');
  return idx === -1 ? '' : clean.slice(0, idx);
}

function joinPath(root: string, child: string): string {
  const cleanChild = normalizePath(child);
  if (!root) return cleanChild;
  return cleanChild ? `${root}/${cleanChild}` : root;
}

function pathDepth(path: string): number {
  return path ? path.split('/').filter(Boolean).length : 0;
}

function isFileInRoot(filePath: string, rootPath: string): boolean {
  if (!rootPath) return true;
  return filePath === rootPath || filePath.startsWith(`${rootPath}/`);
}

function makeTarget(
  kind: RepoTargetKind,
  framework: string,
  rootPath: string,
  entryFile: string | null,
  configPath: string | null
): RepoTarget {
  const root = normalizePath(rootPath);
  return {
    id: `${kind}:${root || 'root'}:${framework}`,
    kind,
    label: TARGET_KIND_LABELS[kind],
    framework,
    rootPath: root,
    entryFile: entryFile ? normalizePath(entryFile) : null,
    configPath: configPath ? normalizePath(configPath) : null,
    sharedUi: false,
  };
}

class FileIndex {
  private byPath = new Map<string, ProjectFile>();

  constructor(files: ProjectFile[]) {
    for (const file of files) {
      const key = normalizePath(file.path);
      if (!key || IGNORED_RE.test(key)) continue;
      this.byPath.set(key.toLowerCase(), file);
    }
  }

  has(path: string): boolean {
    if (!path) return false;
    return this.byPath.has(normalizePath(path).toLowerCase());
  }

  read(path: string): string {
    return this.byPath.get(normalizePath(path).toLowerCase())?.content ?? '';
  }

  readJson<T>(path: string): T | null {
    const content = this.read(path);
    if (!content) return null;
    try {
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  first(root: string, candidates: string[]): string | null {
    for (const candidate of candidates) {
      const joined = joinPath(root, candidate);
      if (this.has(joined)) return joined;
    }
    return null;
  }

  keys(): string[] {
    return Array.from(this.byPath.keys());
  }
}

function manifestDeps(manifest: PackageManifest | null): Record<string, string> {
  if (!manifest) return {};
  return {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
}

function detectWebFramework(
  index: FileIndex,
  root: string,
  deps: Record<string, string>
): string {
  for (const entry of WEB_FRAMEWORK_DEPS) {
    if (deps[entry.dep]) {
      if (entry.framework === 'vite' && deps.react) return 'react';
      return entry.framework;
    }
  }
  if (index.first(root, ['next.config.js', 'next.config.ts', 'next.config.mjs'])) return 'next';
  if (index.first(root, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'])) return 'vite';
  return 'static';
}

function isExpoProject(
  index: FileIndex,
  root: string,
  deps: Record<string, string>
): boolean {
  if (deps.expo || deps['expo-router']) return true;
  const appJson = index.readJson<{ expo?: unknown }>(joinPath(root, 'app.json'));
  if (appJson && appJson.expo) return true;
  return Boolean(index.first(root, ['app.config.js', 'app.config.ts']));
}

function classifyRoot(
  index: FileIndex,
  root: string
): RepoTarget[] {
  const manifestPath = joinPath(root, 'package.json');
  const manifest = index.readJson<PackageManifest>(manifestPath);
  const deps = manifestDeps(manifest);
  const targets: RepoTarget[] = [];

  const webConfig = index.first(root, WEB_CONFIG_CANDIDATES);
  const webEntry = index.first(root, WEB_ENTRY_CANDIDATES);
  const framework = detectWebFramework(index, root, deps);
  const hasWebFrameworkDep = webConfig !== null || framework !== 'static';

  const expo = isExpoProject(index, root, deps);
  const reactNative = Boolean(deps['react-native']) || index.has(joinPath(root, 'react-native.config.js'));
  const flutter = index.has(joinPath(root, 'pubspec.yaml'));
  const capacitorConfig = index.first(root, CAPACITOR_CONFIG_CANDIDATES);
  const capacitor =
    capacitorConfig !== null || Boolean(deps['@capacitor/core'] || deps['@capacitor/android']);
  const androidGradle = index.first(root, ANDROID_GRADLE_CANDIDATES);

  const electronMain = index.first(root, ELECTRON_MAIN_CANDIDATES);
  const electronBuilder = index.first(root, ELECTRON_BUILDER_CANDIDATES);
  const tauriConfig = index.first(root, ['src-tauri/tauri.conf.json']);
  const electronDep = Boolean(deps.electron);

  // Native-first roots (Flutter / Expo / bare RN / native Android) have no browser entry.
  const isNativeOnlyRoot = flutter || expo || reactNative || (!capacitor && Boolean(androidGradle));

  if (!isNativeOnlyRoot && (webEntry || (hasWebFrameworkDep && (manifest !== null || webConfig)))) {
    targets.push(
      makeTarget('web', framework, root, webEntry ?? null, webConfig ?? joinPath(root, 'package.json'))
    );
  }

  if (electronMain || electronBuilder || electronDep || tauriConfig || deps['@tauri-apps/cli']) {
    const desktopFramework = tauriConfig ? 'tauri' : 'electron';
    let configPath: string | null = electronBuilder ?? tauriConfig;
    if (!configPath && manifestPath) configPath = manifestPath;
    if (!configPath) configPath = electronMain;
    targets.push(makeTarget('desktop', desktopFramework, root, webEntry ?? null, configPath));
  }

  if (flutter) {
    targets.push(makeTarget('mobile', 'flutter', root, null, joinPath(root, 'pubspec.yaml')));
  } else if (capacitor) {
    targets.push(
      makeTarget('mobile', 'capacitor', root, webEntry ?? null, capacitorConfig ?? manifestPath)
    );
  } else if (expo) {
    targets.push(
      makeTarget('mobile', 'expo', root, index.first(root, EXPO_ENTRY_CANDIDATES), joinPath(root, 'app.json'))
    );
  } else if (reactNative) {
    targets.push(
      makeTarget('mobile', 'react-native', root, index.first(root, EXPO_ENTRY_CANDIDATES), joinPath(root, 'app.json'))
    );
  } else if (androidGradle) {
    targets.push(makeTarget('mobile', 'android-native', root, null, androidGradle));
  }

  return targets;
}

function collectCandidateRoots(index: FileIndex): string[] {
  const roots = new Set<string>(['']);
  const markerRe =
    /^(package\.json|pubspec\.yaml|app\.json|capacitor\.config\.[a-z]+|electron-builder\.[a-z]+|tauri\.conf\.json|index\.html|vite\.config\.[a-z]+|next\.config\.[a-z]+|build\.gradle(\.kts)?)$/i;

  for (const key of index.keys()) {
    const base = basename(key);
    if (!markerRe.test(base)) continue;
    const dir = dirname(key);
    if (pathDepth(dir) > MAX_ROOT_DEPTH) continue;
    // Build outputs are not independent targets.
    if (/^(dist|build|out|www|\.next)$/i.test(base)) continue;
    roots.add(dir);
  }

  return Array.from(roots).sort((a, b) => pathDepth(a) - pathDepth(b) || a.localeCompare(b));
}

function sortTargets(targets: RepoTarget[]): RepoTarget[] {
  return [...targets].sort((a, b) => {
    if (a.kind !== b.kind) return TARGET_KIND_ORDER[a.kind] - TARGET_KIND_ORDER[b.kind];
    return a.rootPath.localeCompare(b.rootPath) || a.framework.localeCompare(b.framework);
  });
}

/**
 * Scans an imported file tree (repository root plus depth-1/depth-2 folders) and
 * classifies every runnable surface: Web, Desktop (.exe), and Mobile (.apk).
 *
 * The returned layout distinguishes:
 * - `single`: one runnable surface.
 * - `shared-ui`: several platforms wrapping the same root frontend (Electron/Capacitor).
 * - `monorepo`: targets live in separate folders with their own rootPath/entryFile.
 */
export function scanRepoTargets(files: ProjectFile[]): RepoScanResult {
  if (!files || files.length === 0) {
    return { targets: [], layout: 'single', isSharedUi: false, isMonorepo: false, warnings: [] };
  }

  const index = new FileIndex(files);
  const seen = new Set<string>();
  const targets: RepoTarget[] = [];

  for (const root of collectCandidateRoots(index)) {
    for (const target of classifyRoot(index, root)) {
      if (seen.has(target.id)) continue;
      seen.add(target.id);
      targets.push(target);
    }
  }

  // Workspace-wide marker: a root package.json declaring workspaces or an apps/* layout.
  const rootManifest = index.readJson<PackageManifest>('package.json');
  const workspaces = rootManifest?.workspaces;
  const declaresWorkspaces = Array.isArray(workspaces)
    ? workspaces.length > 0
    : Boolean(workspaces?.packages?.length);

  const distinctRoots = Array.from(new Set(targets.map((target) => target.rootPath)));
  const hasNestedTargets = distinctRoots.some((root) => root !== '');
  const hasRootTarget = distinctRoots.includes('');

  let layout: RepoLayoutMode = 'single';
  if (targets.length > 1) {
    const monorepo =
      distinctRoots.length >= 2 || (declaresWorkspaces && hasNestedTargets) || (hasNestedTargets && hasRootTarget);
    layout = monorepo ? 'monorepo' : 'shared-ui';
  }

  const isSharedUi = layout === 'shared-ui';
  if (isSharedUi) {
    for (const target of targets) target.sharedUi = true;
  }

  const warnings: string[] = [];
  if (layout === 'monorepo') {
    warnings.push(
      `Monorepo detected — ${targets.length} targets across ${distinctRoots.length} folders. Switching targets re-roots the canvas and file tree.`
    );
  } else if (isSharedUi) {
    warnings.push(
      'Shared UI detected — every platform reuses the same frontend, so canvas edits apply to all targets.'
    );
  }

  return {
    targets: sortTargets(targets),
    layout,
    isSharedUi,
    isMonorepo: layout === 'monorepo',
    warnings,
  };
}

export function getDefaultRepoTarget(targets: RepoTarget[]): RepoTarget | null {
  const wrappedRoots = new Set(
    targets.filter((target) => target.kind !== 'web').map((target) => target.rootPath)
  );
  // Prefer a plain web target: a web entry that also carries a desktop/mobile
  // wrapper is the shared-UI case, where the app shell is the better default.
  const standaloneWeb = targets.find(
    (target) => target.kind === 'web' && !wrappedRoots.has(target.rootPath)
  );
  return standaloneWeb ?? targets.find((target) => target.kind === 'web') ?? targets[0] ?? null;
}

export function getRepoTargetById(targets: RepoTarget[], id: string | null): RepoTarget | null {
  if (!id) return null;
  return targets.find((target) => target.id === id) ?? null;
}

/** Short toolbar label: "Web", "Desktop", "Mobile". */
export function shortTargetLabel(kind: RepoTargetKind): string {
  return TARGET_KIND_LABELS[kind].replace(' .exe', '').replace(' .apk', '');
}

/**
 * Files that belong to a target, with paths re-rooted to that target's `rootPath`
 * so the bundler and file tree see `index.html` instead of `apps/web/index.html`.
 * The full workspace map is never mutated — callers keep it for history and pushes.
 */
export function resolveRepoTargetFiles(
  files: ProjectFile[],
  target: RepoTarget | null
): ProjectFile[] {
  if (!target || !target.rootPath) return files;
  const prefix = `${target.rootPath.replace(/\/+$/, '')}/`;
  return files
    .filter((file) => file.path.startsWith(prefix))
    .map((file) => ({ ...file, path: file.path.slice(prefix.length) }));
}

/** Resolves the HTML entry for a target inside the full workspace map. */
export function resolveRepoTargetEntryPath(
  files: ProjectFile[],
  target: RepoTarget | null
): string | null {
  if (!target) return null;
  const scoped = resolveRepoTargetFiles(files, target);
  const entry = findEntryInFiles(scoped);
  if (!entry) return null;
  return target.rootPath ? `${target.rootPath}/${entry}` : entry;
}

function findEntryInFiles(files: ProjectFile[]): string | null {
  const htmlFiles = files.filter((file) => file.type === 'html');
  if (htmlFiles.length === 0) return null;
  const normalized = htmlFiles.map((file) => file.path);
  const rank = (path: string): number => {
    const lower = path.toLowerCase();
    if (lower === 'index.html') return 0;
    if (lower === 'public/index.html') return 1;
    if (lower === 'src/index.html') return 2;
    if (/(^|\/)dist\//i.test(lower) || /(^|\/)build\//i.test(lower)) return 9;
    return 5;
  };
  return [...normalized].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))[0] ?? null;
}

/** Canvas chrome to render for a target. */
export function targetPreviewPlatform(kind: RepoTargetKind): 'browser' | 'desktop-window' | 'android-device' {
  if (kind === 'desktop') return 'desktop-window';
  if (kind === 'mobile') return 'android-device';
  return 'browser';
}

/** True when the path lives inside the target's root folder. */
export function isPathInTarget(path: string, target: RepoTarget | null): boolean {
  if (!target || !target.rootPath) return true;
  return isFileInRoot(normalizePath(path), target.rootPath);
}

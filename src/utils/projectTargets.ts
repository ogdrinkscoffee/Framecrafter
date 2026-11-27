import type { ProjectFile } from '../types/editor';

export type ProjectTargetType = 'web' | 'mobile';

export type ProjectTargetFramework =
  | 'static'
  | 'vite'
  | 'react'
  | 'next'
  | 'vue'
  | 'svelte'
  | 'angular'
  | 'capacitor'
  | 'android-native'
  | 'react-native'
  | 'expo'
  | 'flutter';

/**
 * A runnable surface inside an imported workspace.
 * A repository may expose several: a web app, a Capacitor Android wrap,
 * an Expo app, a Flutter module, and so on.
 */
export interface ProjectTarget {
  id: string;
  type: ProjectTargetType;
  framework: ProjectTargetFramework;
  /** Repository-relative folder for this target ('' = repository root). */
  rootPath: string;
  /** Repository-relative entry file used to preview / edit this target. */
  entryFile: string | null;
}

export interface MonorepoLayout {
  isMonorepo: boolean;
  webRootPath: string | null;
  mobileRootPath: string | null;
  /** package.json files under packages/* (shared libraries, not run targets). */
  packagePaths: string[];
}

interface ProjectIndex {
  byPath: Map<string, ProjectFile>;
}

interface PackageManifest {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

const MARKER_FILE_RE =
  /^(package\.json|pubspec\.yaml|app\.json|app\.config\.(js|ts|mjs|cjs)|react-native\.config\.js|capacitor\.config\.(json|ts|js|cjs|mjs)|vite\.config\.(ts|js|mts|cts)|next\.config\.(js|ts|mjs))$/i;

const NATIVE_MANIFEST_RE = /^(.+?)\/android\/app\/src\/main\/AndroidManifest\.xml$/i;

const EXPO_ENTRY_CANDIDATES = [
  'app/_layout.tsx',
  'app/_layout.jsx',
  'app/index.tsx',
  'app/index.jsx',
  'app/page.tsx',
  'App.tsx',
  'App.jsx',
  'App.js',
  'index.js',
];

const REACT_NATIVE_ENTRY_CANDIDATES = ['App.tsx', 'App.ts', 'App.jsx', 'App.js', 'src/App.tsx', 'index.js'];

const ANDROID_MANIFEST_PATH = 'android/app/src/main/AndroidManifest.xml';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? '' : normalized.slice(0, idx);
}

function basename(path: string): string {
  const normalized = normalizePath(path);
  const idx = normalized.lastIndexOf('/');
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

function joinPath(root: string, child: string): string {
  const cleanChild = normalizePath(child);
  if (!root) return cleanChild;
  return cleanChild ? `${root}/${cleanChild}` : root;
}

function pathDepth(path: string): number {
  return path ? path.split('/').filter(Boolean).length : 0;
}

function isIgnoredPath(path: string): boolean {
  return /(^|\/)(node_modules|\.git|Pods)\//i.test(path);
}

function buildIndex(files: ProjectFile[]): ProjectIndex {
  const byPath = new Map<string, ProjectFile>();
  for (const file of files) {
    const key = normalizePath(file.path);
    if (!key || isIgnoredPath(key)) continue;
    byPath.set(key.toLowerCase(), file);
  }
  return { byPath };
}

function hasFile(index: ProjectIndex, path: string): boolean {
  if (!path) return false;
  return index.byPath.has(normalizePath(path).toLowerCase());
}

function readFile(index: ProjectIndex, path: string): string {
  return index.byPath.get(normalizePath(path).toLowerCase())?.content ?? '';
}

function readJson<T>(index: ProjectIndex, path: string): T | null {
  const content = readFile(index, path);
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function findFirstFile(index: ProjectIndex, root: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    const joined = joinPath(root, candidate);
    if (hasFile(index, joined)) return joined;
  }
  return null;
}

function readManifest(index: ProjectIndex, root: string): PackageManifest | null {
  return readJson<PackageManifest>(index, joinPath(root, 'package.json'));
}

function collectDependencies(manifest: PackageManifest | null): Record<string, string> {
  if (!manifest) return {};
  return {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
  };
}

function findCapacitorConfig(index: ProjectIndex, root: string): string | null {
  return findFirstFile(index, root, [
    'capacitor.config.ts',
    'capacitor.config.json',
    'capacitor.config.js',
    'capacitor.config.cjs',
    'capacitor.config.mjs',
  ]);
}

function readCapacitorWebDir(index: ProjectIndex, configPath: string | null): string | null {
  if (!configPath) return null;
  const content = readFile(index, configPath);
  const match = content.match(/webDir\s*[:=]\s*['"]([^'"]+)['"]/);
  if (!match) return null;
  return normalizePath(match[1]);
}

function detectWebFramework(
  index: ProjectIndex,
  root: string,
  deps: Record<string, string>
): ProjectTargetFramework {
  if (deps.next || findFirstFile(index, root, ['next.config.js', 'next.config.ts', 'next.config.mjs'])) {
    return 'next';
  }
  if (deps['@angular/core']) return 'angular';
  if (deps.svelte || deps['@sveltejs/kit']) return 'svelte';
  if (deps.nuxt || deps.vue) return 'vue';
  if (
    deps.vite ||
    findFirstFile(index, root, ['vite.config.ts', 'vite.config.js', 'vite.config.mts', 'vite.config.cts'])
  ) {
    return deps.react ? 'react' : 'vite';
  }
  if (deps.react) return 'react';
  return 'static';
}

function resolveWebEntry(index: ProjectIndex, root: string): string | null {
  return findFirstFile(index, root, [
    'index.html',
    'public/index.html',
    'src/index.html',
    'site/index.html',
  ]);
}

function resolveCapacitorEntry(index: ProjectIndex, root: string, webDir: string | null): string | null {
  const candidates: string[] = [];
  if (webDir) candidates.push(joinPath(webDir, 'index.html'));
  candidates.push('index.html', 'www/index.html', 'dist/index.html', 'build/index.html', 'public/index.html');
  return findFirstFile(index, root, candidates);
}

function isExpoProject(index: ProjectIndex, root: string, deps: Record<string, string>): boolean {
  if (deps.expo || deps['expo-router']) return true;
  const appJson = readJson<{ expo?: unknown }>(index, joinPath(root, 'app.json'));
  if (appJson && appJson.expo) return true;
  return Boolean(findFirstFile(index, root, ['app.config.js', 'app.config.ts']));
}

function createTarget(
  type: ProjectTargetType,
  framework: ProjectTargetFramework,
  rootPath: string,
  entryFile: string | null
): ProjectTarget {
  const root = normalizePath(rootPath);
  return {
    id: `${type}:${root || 'root'}`,
    type,
    framework,
    rootPath: root,
    entryFile: entryFile ? normalizePath(entryFile) : null,
  };
}

function collectCandidateRoots(index: ProjectIndex): string[] {
  const roots = new Set<string>();
  for (const key of index.byPath.keys()) {
    const file = basename(key);
    if (MARKER_FILE_RE.test(file)) {
      const dir = dirname(key);
      if (pathDepth(dir) <= 4) roots.add(dir);
      continue;
    }
    if (file === 'index.html') {
      const dir = dirname(key);
      // Build outputs are not independent targets; their project root is.
      if (/^(dist|build|www|out|public|\.next)$/i.test(basename(dir))) continue;
      if (pathDepth(dir) <= 2) roots.add(dir);
      continue;
    }
    const nativeMatch = key.match(NATIVE_MANIFEST_RE);
    if (nativeMatch) {
      roots.add(normalizePath(nativeMatch[1]));
    }
  }
  roots.add('');
  return Array.from(roots).sort((a, b) => pathDepth(a) - pathDepth(b) || a.localeCompare(b));
}

function classifyRoot(index: ProjectIndex, root: string): ProjectTarget[] {
  const manifest = readManifest(index, root);
  const deps = collectDependencies(manifest);
  const targets: ProjectTarget[] = [];

  // Flutter module — pubspec.yaml is authoritative and has no web preview.
  if (hasFile(index, joinPath(root, 'pubspec.yaml'))) {
    const entry = findFirstFile(index, root, ['lib/main.dart']);
    targets.push(createTarget('mobile', 'flutter', root, entry));
    return targets;
  }

  const capacitorConfig = findCapacitorConfig(index, root);
  const isCapacitor = Boolean(capacitorConfig) || Boolean(deps['@capacitor/core'] || deps['@capacitor/android']);
  if (isCapacitor) {
    const webDir = readCapacitorWebDir(index, capacitorConfig);
    const nativeEntry = resolveCapacitorEntry(index, root, webDir);
    // The APK wraps the web surface, so the same root exposes both targets and
    // both preview the same web build entry.
    targets.push(createTarget('mobile', 'capacitor', root, nativeEntry));
    targets.push(
      createTarget('web', detectWebFramework(index, root, deps), root, resolveWebEntry(index, root) ?? nativeEntry)
    );
    return targets;
  }

  if (isExpoProject(index, root, deps)) {
    targets.push(createTarget('mobile', 'expo', root, findFirstFile(index, root, EXPO_ENTRY_CANDIDATES)));
    return targets;
  }

  if (deps['react-native'] || findFirstFile(index, root, ['react-native.config.js'])) {
    targets.push(
      createTarget('mobile', 'react-native', root, findFirstFile(index, root, REACT_NATIVE_ENTRY_CANDIDATES))
    );
    return targets;
  }

  if (
    hasFile(index, joinPath(root, ANDROID_MANIFEST_PATH)) ||
    hasFile(index, joinPath(root, 'android/build.gradle')) ||
    hasFile(index, joinPath(root, 'android/build.gradle.kts'))
  ) {
    targets.push(createTarget('mobile', 'android-native', root, joinPath(root, ANDROID_MANIFEST_PATH)));
    return targets;
  }

  // Shared libraries under packages/* are not runnable surfaces.
  if (/^packages\/[^/]+$/.test(root)) {
    return targets;
  }

  const webEntry = resolveWebEntry(index, root);
  const hasNextApp =
    hasFile(index, joinPath(root, 'app/page.tsx')) ||
    hasFile(index, joinPath(root, 'app/page.jsx')) ||
    hasFile(index, joinPath(root, 'pages/index.tsx')) ||
    hasFile(index, joinPath(root, 'pages/index.js'));
  const hasWebConfig = Boolean(
    findFirstFile(index, root, [
      'vite.config.ts',
      'vite.config.js',
      'next.config.js',
      'next.config.ts',
      'svelte.config.js',
      'nuxt.config.ts',
    ])
  );
  const hasWebFrameworkDep = Boolean(
    deps.vite ||
      deps.next ||
      deps.react ||
      deps.vue ||
      deps.nuxt ||
      deps.svelte ||
      deps['@sveltejs/kit'] ||
      deps['@angular/core']
  );
  const hasFrameworkEntry = Boolean(
    findFirstFile(index, root, [
      'src/main.tsx',
      'src/main.jsx',
      'src/main.ts',
      'src/index.tsx',
      'src/index.jsx',
      'src/app.tsx',
    ])
  );
  const looksLikeWebApp =
    Boolean(webEntry) || hasNextApp || hasWebConfig || (hasWebFrameworkDep && hasFrameworkEntry);

  if (looksLikeWebApp) {
    targets.push(createTarget('web', detectWebFramework(index, root, deps), root, webEntry));
    return targets;
  }

  // A folder with only an index.html (e.g. apps/landing) is still a web target.
  if (hasFile(index, joinPath(root, 'index.html'))) {
    targets.push(createTarget('web', 'static', root, joinPath(root, 'index.html')));
  }

  return targets;
}

function sortTargets(targets: ProjectTarget[]): ProjectTarget[] {
  return [...targets].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'web' ? -1 : 1;
    return a.rootPath.localeCompare(b.rootPath) || a.framework.localeCompare(b.framework);
  });
}

/**
 * Inspects an imported workspace (template, folder, ZIP, GitHub pull) and returns
 * every runnable target: web apps, Capacitor Android wraps, Expo / React Native
 * apps, native Android projects and Flutter modules.
 */
export function detectProjectTargets(files: ProjectFile[]): ProjectTarget[] {
  if (!files || files.length === 0) return [];
  const index = buildIndex(files);
  const seen = new Set<string>();
  const targets: ProjectTarget[] = [];

  for (const root of collectCandidateRoots(index)) {
    for (const target of classifyRoot(index, root)) {
      if (seen.has(target.id)) continue;
      seen.add(target.id);
      targets.push(target);
    }
  }

  return sortTargets(targets);
}

/** Detects monorepo layout (apps/*, packages/*, workspaces) around the targets. */
export function detectMonorepoLayout(files: ProjectFile[]): MonorepoLayout {
  const index = buildIndex(files);
  const roots = collectCandidateRoots(index);
  const targets = detectProjectTargets(files);

  const appRoots = roots.filter((root) => /^apps\/[^/]+$/.test(root));
  const packagePaths = roots
    .filter((root) => /^packages\/[^/]+$/.test(root))
    .map((root) => joinPath(root, 'package.json'))
    .filter((path) => hasFile(index, path));

  const rootManifest = readManifest(index, '');
  const workspaces = rootManifest?.workspaces;
  const declaredWorkspaces = Array.isArray(workspaces)
    ? workspaces.length > 0
    : Boolean(workspaces?.packages?.length);

  const webRoot = targets.find((target) => target.type === 'web')?.rootPath ?? null;
  const mobileRoot = targets.find((target) => target.type === 'mobile')?.rootPath ?? null;

  const isMonorepo =
    declaredWorkspaces ||
    packagePaths.length > 0 ||
    appRoots.length > 1 ||
    (webRoot !== null && mobileRoot !== null && webRoot !== mobileRoot);

  return {
    isMonorepo,
    webRootPath: webRoot,
    mobileRootPath: mobileRoot,
    packagePaths,
  };
}

export function getTargetsByType(targets: ProjectTarget[], type: ProjectTargetType): ProjectTarget[] {
  return targets.filter((target) => target.type === type);
}

export function getDefaultTarget(targets: ProjectTarget[]): ProjectTarget | null {
  return targets.find((target) => target.type === 'web') ?? targets[0] ?? null;
}

export function getTargetById(targets: ProjectTarget[], id: string | null): ProjectTarget | null {
  if (!id) return null;
  return targets.find((target) => target.id === id) ?? null;
}

import React, { useMemo } from 'react';
import { FileCode2, Monitor, Smartphone } from 'lucide-react';
import type { ProjectFile } from '../types/editor';
import type { RepoTarget } from '../utils/repoTargets';

interface PlatformConfigPanelProps {
  target: RepoTarget;
  files: ProjectFile[];
}

interface ConfigRow {
  label: string;
  value: string;
}

function readFile(files: ProjectFile[], path: string | null): string {
  if (!path) return '';
  return files.find((file) => file.path === path)?.content ?? '';
}

function readJson(files: ProjectFile[], path: string | null): Record<string, unknown> | null {
  const content = readFile(files, path);
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pick(rows: ConfigRow[], label: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  rows.push({ label, value: String(value) });
}

function fromNested(source: unknown, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function parseElectronConfig(target: RepoTarget, files: ProjectFile[]): ConfigRow[] {
  const rows: ConfigRow[] = [];
  const manifest = readJson(files, target.configPath?.endsWith('package.json') ? target.configPath : 'package.json');

  pick(rows, 'App name', fromNested(manifest, ['build', 'productName']) ?? manifest?.name);
  pick(rows, 'App ID', fromNested(manifest, ['build', 'appId']));
  pick(rows, 'Windows target', fromNested(manifest, ['build', 'win', 'target']));
  pick(rows, 'Output dir', fromNested(manifest, ['build', 'directories', 'output']));
  pick(rows, 'Main process', manifest?.main);

  const builderConfig = target.configPath && !target.configPath.endsWith('package.json')
    ? readFile(files, target.configPath)
    : '';
  const builderMatch = /"?appId"?\s*[:=]\s*['"]?([\w.-]+)['"]?/.exec(builderConfig);
  if (builderMatch) pick(rows, 'Builder appId', builderMatch[1]);

  const mainSource = readFile(
    files,
    target.configPath?.startsWith('electron/')
      ? target.configPath
      : 'electron/main.cjs'
  );
  const widthMatch = /width\s*:\s*(\d+)/.exec(mainSource);
  const heightMatch = /height\s*:\s*(\d+)/.exec(mainSource);
  if (widthMatch || heightMatch) {
    const width = widthMatch?.[1] ?? '1024';
    const height = heightMatch?.[1] ?? '768';
    pick(rows, 'Window size', `${width} × ${height}`);
  }
  if (/fullscreen\s*:\s*true/.test(mainSource)) pick(rows, 'Fullscreen', 'enabled');
  if (/frame\s*:\s*false/.test(mainSource)) pick(rows, 'Window frame', 'frameless');

  return rows;
}

function parseTauriConfig(target: RepoTarget, files: ProjectFile[]): ConfigRow[] {
  const rows: ConfigRow[] = [];
  const config = readJson(files, target.configPath);
  pick(rows, 'Product name', fromNested(config, ['productName']));
  pick(rows, 'Identifier', fromNested(config, ['identifier']));
  pick(rows, 'Window title', fromNested(config, ['app', 'windows', '0', 'title']));
  pick(rows, 'Window width', fromNested(config, ['app', 'windows', '0', 'width']));
  pick(rows, 'Window height', fromNested(config, ['app', 'windows', '0', 'height']));
  return rows;
}

function parseCapacitorConfig(target: RepoTarget, files: ProjectFile[]): ConfigRow[] {
  const rows: ConfigRow[] = [];
  const raw = readFile(files, target.configPath);
  const appId = /appId\s*[:=]\s*['"]([^'"]+)['"]/.exec(raw);
  const appName = /appName\s*[:=]\s*['"]([^'"]+)['"]/.exec(raw);
  const webDir = /webDir\s*[:=]\s*['"]([^'"]+)['"]/.exec(raw);
  if (appId) pick(rows, 'Android package', appId[1]);
  if (appName) pick(rows, 'App name', appName[1]);
  if (webDir) pick(rows, 'Web directory', webDir[1]);
  const manifest = readJson(files, 'package.json');
  pick(rows, 'Capacitor core', fromNested(manifest, ['dependencies', '@capacitor/core']));
  pick(rows, 'Capacitor Android', fromNested(manifest, ['devDependencies', '@capacitor/android']));
  return rows;
}

function parseExpoOrNativeConfig(target: RepoTarget, files: ProjectFile[]): ConfigRow[] {
  const rows: ConfigRow[] = [];
  const appJson = readJson(files, target.configPath ?? 'app.json');
  const expo = fromNested(appJson, ['expo']) as Record<string, unknown> | undefined;
  pick(rows, 'App name', expo?.name ?? appJson?.name);
  pick(rows, 'Slug', expo?.slug);
  pick(rows, 'Android package', fromNested(expo, ['android', 'package']));
  pick(rows, 'Version', expo?.version);

  const gradle = readFile(files, 'android/app/build.gradle') || readFile(files, 'android/app/build.gradle.kts');
  const applicationId = /applicationId\s*=?\s*["']([^"']+)["']/.exec(gradle);
  const versionName = /versionName\s*=?\s*["']([^"']+)["']/.exec(gradle);
  if (applicationId) pick(rows, 'Gradle applicationId', applicationId[1]);
  if (versionName) pick(rows, 'Gradle versionName', versionName[1]);
  return rows;
}

function parseFlutterConfig(target: RepoTarget, files: ProjectFile[]): ConfigRow[] {
  const rows: ConfigRow[] = [];
  const pubspec = readFile(files, target.configPath ?? 'pubspec.yaml');
  const name = /^name:\s*(.+)$/m.exec(pubspec);
  const version = /^version:\s*(.+)$/m.exec(pubspec);
  const description = /^description:\s*(.+)$/m.exec(pubspec);
  if (name) pick(rows, 'Package name', name[1].trim());
  if (version) pick(rows, 'Version', version[1].trim());
  if (description) pick(rows, 'Description', description[1].trim());
  return rows;
}

export const PlatformConfigPanel: React.FC<PlatformConfigPanelProps> = ({ target, files }) => {
  const rows = useMemo(() => {
    switch (target.framework) {
      case 'electron':
        return parseElectronConfig(target, files);
      case 'tauri':
        return parseTauriConfig(target, files);
      case 'capacitor':
        return parseCapacitorConfig(target, files);
      case 'expo':
      case 'react-native':
      case 'android-native':
        return parseExpoOrNativeConfig(target, files);
      case 'flutter':
        return parseFlutterConfig(target, files);
      default:
        return [];
    }
  }, [target, files]);

  const Icon = target.kind === 'mobile' ? Smartphone : Monitor;
  const title =
    target.kind === 'mobile'
      ? target.framework === 'capacitor'
        ? 'APK / Capacitor Config'
        : `${target.framework} App Config`
      : 'Electron Window Config';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--studio-surface)] overflow-y-auto builder-scroll">
      <div className="px-3 py-3 border-b border-[var(--studio-border)] space-y-1">
        <div className="inline-flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" strokeWidth={1.5} />
          <h2 className="text-[12.5px] font-semibold text-[var(--studio-text-strong)]">{title}</h2>
        </div>
        <p className="text-[11px] text-[var(--studio-muted)] leading-relaxed">
          Parsed from this target&apos;s repository config files. Edit the config file in the code
          editor to change packaging behavior.
        </p>
      </div>

      <div className="p-3 space-y-3">
        <div className="rounded-lg border border-[var(--studio-border)] bg-[var(--studio-bg)] p-2.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--studio-muted)]">
            <FileCode2 className="w-3 h-3" strokeWidth={1.6} />
            Target
          </div>
          <dl className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <dt className="text-[var(--studio-muted)]">Platform</dt>
              <dd className="font-mono-tabular text-[var(--studio-text-strong)]">{target.label}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <dt className="text-[var(--studio-muted)]">Framework</dt>
              <dd className="font-mono-tabular text-[var(--studio-text-strong)]">{target.framework}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <dt className="text-[var(--studio-muted)]">Root</dt>
              <dd className="font-mono-tabular text-[var(--studio-text-strong)] truncate max-w-[60%]">
                {target.rootPath || 'root'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <dt className="text-[var(--studio-muted)]">Config</dt>
              <dd
                className="font-mono-tabular text-[var(--studio-text-strong)] truncate max-w-[60%]"
                title={target.configPath ?? ''}
              >
                {target.configPath ?? 'not found'}
              </dd>
            </div>
          </dl>
        </div>

        {rows.length > 0 ? (
          <div className="rounded-lg border border-[var(--studio-border)] p-2.5 space-y-1.5">
            <div className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--studio-muted)]">
              Packaging values
            </div>
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-2 text-[11.5px]">
                <span className="text-[var(--studio-muted)] shrink-0">{row.label}</span>
                <span className="font-mono-tabular text-[var(--studio-text-strong)] text-right break-all">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-[var(--studio-muted-soft)] leading-relaxed">
            No packaging values were found in the config file yet. Add one in{' '}
            <span className="font-mono-tabular">{target.configPath ?? 'the platform config'}</span>.
          </p>
        )}
      </div>
    </div>
  );
};

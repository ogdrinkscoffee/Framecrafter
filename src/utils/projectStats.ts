import type { ProjectFile, ProjectFileType } from '../types/editor';

export type StatsDistributionKey = 'html' | 'css' | 'js' | 'json' | 'other';

export interface FileTypeDistributionItem {
  key: StatsDistributionKey;
  label: string;
  shortLabel: string;
  color: string;
  fileCount: number;
  lineCount: number;
  byteCount: number;
  filePercent: number;
  linePercent: number;
}

export interface FileStatSummary {
  path: string;
  name: string;
  type: ProjectFileType;
  extension: string;
  lineCount: number;
  byteCount: number;
  isAsset: boolean;
}

export interface ExtensionStat {
  extension: string;
  fileCount: number;
  lineCount: number;
}

export interface ProjectStatistics {
  totalFiles: number;
  codeFileCount: number;
  assetFileCount: number;
  totalLinesOfCode: number;
  totalBytes: number;
  formattedSize: string;
  avgLinesPerCodeFile: number;
  distribution: FileTypeDistributionItem[];
  largestFiles: FileStatSummary[];
  extensionBreakdown: ExtensionStat[];
}

const DISTRIBUTION_META: Record<
  StatsDistributionKey,
  { label: string; shortLabel: string; color: string }
> = {
  html: { label: 'HTML', shortLabel: 'HTML', color: '#f97316' },
  css: { label: 'CSS / Styles', shortLabel: 'CSS', color: '#0ea5e9' },
  js: { label: 'JavaScript / TS', shortLabel: 'JS', color: '#6366f1' },
  json: { label: 'JSON / Config', shortLabel: 'JSON', color: '#10b981' },
  other: { label: 'Other / Assets', shortLabel: 'Other', color: '#94a3b8' },
};

export function isBinaryDataUrl(content: string): boolean {
  return content.startsWith('data:') && !content.startsWith('data:image/svg+xml');
}

export function countCodeLines(content: string): number {
  if (!content || isBinaryDataUrl(content)) return 0;
  const normalized = content.replace(/\r\n/g, '\n');
  if (normalized.length === 0) return 0;
  return normalized.split('\n').length;
}

export function estimateByteSize(content: string): number {
  if (!content) return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(content).length;
  }
  return content.length;
}

export function formatBytesCompact(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

function getFileExtension(path: string): string {
  const filename = path.split('/').pop() ?? path;
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return 'file';
  return `.${filename.slice(dot + 1).toLowerCase()}`;
}

export function computeProjectStatistics(files: ProjectFile[]): ProjectStatistics {
  const buckets: Record<
    StatsDistributionKey,
    { fileCount: number; lineCount: number; byteCount: number }
  > = {
    html: { fileCount: 0, lineCount: 0, byteCount: 0 },
    css: { fileCount: 0, lineCount: 0, byteCount: 0 },
    js: { fileCount: 0, lineCount: 0, byteCount: 0 },
    json: { fileCount: 0, lineCount: 0, byteCount: 0 },
    other: { fileCount: 0, lineCount: 0, byteCount: 0 },
  };

  const extMap = new Map<string, { fileCount: number; lineCount: number }>();
  const fileSummaries: FileStatSummary[] = [];

  let totalLinesOfCode = 0;
  let totalBytes = 0;
  let codeFileCount = 0;
  let assetFileCount = 0;

  for (const file of files) {
    const isAsset = isBinaryDataUrl(file.content);
    const lineCount = countCodeLines(file.content);
    const byteCount = estimateByteSize(file.content);
    const extension = getFileExtension(file.path);

    if (isAsset) {
      assetFileCount += 1;
    } else {
      codeFileCount += 1;
    }

    totalLinesOfCode += lineCount;
    totalBytes += byteCount;

    const bucketKey: StatsDistributionKey =
      file.type === 'html' ||
      file.type === 'css' ||
      file.type === 'js' ||
      file.type === 'json'
        ? file.type
        : 'other';

    buckets[bucketKey].fileCount += 1;
    buckets[bucketKey].lineCount += lineCount;
    buckets[bucketKey].byteCount += byteCount;

    const prevExt = extMap.get(extension) ?? { fileCount: 0, lineCount: 0 };
    extMap.set(extension, {
      fileCount: prevExt.fileCount + 1,
      lineCount: prevExt.lineCount + lineCount,
    });

    fileSummaries.push({
      path: file.path,
      name: file.name,
      type: file.type,
      extension,
      lineCount,
      byteCount,
      isAsset,
    });
  }

  const totalFiles = files.length;
  const keysToInclude: StatsDistributionKey[] = ['html', 'css', 'js'];
  if (buckets.json.fileCount > 0) keysToInclude.push('json');
  if (buckets.other.fileCount > 0) keysToInclude.push('other');

  const distribution: FileTypeDistributionItem[] = keysToInclude.map((key) => {
    const stats = buckets[key];
    const meta = DISTRIBUTION_META[key];
    return {
      key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      color: meta.color,
      fileCount: stats.fileCount,
      lineCount: stats.lineCount,
      byteCount: stats.byteCount,
      filePercent: totalFiles > 0 ? Math.round((stats.fileCount / totalFiles) * 1000) / 10 : 0,
      linePercent:
        totalLinesOfCode > 0
          ? Math.round((stats.lineCount / totalLinesOfCode) * 1000) / 10
          : 0,
    };
  });

  const largestFiles = fileSummaries
    .filter((f) => !f.isAsset)
    .sort((a, b) => b.lineCount - a.lineCount || b.byteCount - a.byteCount)
    .slice(0, 6);

  const extensionBreakdown = Array.from(extMap.entries())
    .map(([extension, data]) => ({
      extension,
      fileCount: data.fileCount,
      lineCount: data.lineCount,
    }))
    .sort((a, b) => b.lineCount - a.lineCount || b.fileCount - a.fileCount);

  return {
    totalFiles,
    codeFileCount,
    assetFileCount,
    totalLinesOfCode,
    totalBytes,
    formattedSize: formatBytesCompact(totalBytes),
    avgLinesPerCodeFile: codeFileCount > 0 ? Math.round(totalLinesOfCode / codeFileCount) : 0,
    distribution,
    largestFiles,
    extensionBreakdown,
  };
}

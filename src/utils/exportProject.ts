import JSZip from 'jszip';
import type { ProjectFile, ViewportPreset } from '../types/editor';
import { computeProjectStatistics } from './projectStats';

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BINARY_ZIP_EXT_RE =
  /\.(png|jpe?g|gif|webp|avif|bmp|ico|woff2?|ttf|eot|otf|apk|aab|jar|keystore|jks|mp4|webm|mp3|wav|pdf|zip)$/i;

export async function exportProjectAsZip(
  files: ProjectFile[],
  archiveName = 'framecraft-project.zip'
): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    const dataUrlMatch = /^data:[^;]+;base64,(.+)$/s.exec(file.content);
    if (dataUrlMatch && BINARY_ZIP_EXT_RE.test(file.path)) {
      zip.file(file.path, dataUrlMatch[1], { base64: true });
    } else {
      zip.file(file.path, file.content);
    }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(blob, archiveName);
}

export function exportSingleFile(file: ProjectFile): void {
  const mime =
    file.type === 'html'
      ? 'text/html;charset=utf-8'
      : file.type === 'css'
        ? 'text/css;charset=utf-8'
        : file.type === 'js'
          ? 'application/javascript;charset=utf-8'
          : file.type === 'json'
            ? 'application/json;charset=utf-8'
            : 'text/plain;charset=utf-8';
  const blob = new Blob([file.content], { type: mime });
  triggerBlobDownload(blob, file.name);
}

export interface ProjectJsonExportPayload {
  format: 'framecraft-project-v1';
  exportedAt: string;
  projectName: string;
  entryHtmlPath: string | null;
  viewport: ViewportPreset;
  summary: {
    totalFiles: number;
    codeFileCount: number;
    assetFileCount: number;
    totalLinesOfCode: number;
    totalBytes: number;
  };
  files: Array<{
    path: string;
    name: string;
    type: ProjectFile['type'];
    content: string;
  }>;
}

export function buildProjectExportJson(params: {
  projectName: string;
  entryHtmlPath: string | null;
  viewport: ViewportPreset;
  files: ProjectFile[];
}): ProjectJsonExportPayload {
  const stats = computeProjectStatistics(params.files);
  return {
    format: 'framecraft-project-v1',
    exportedAt: new Date().toISOString(),
    projectName: params.projectName,
    entryHtmlPath: params.entryHtmlPath,
    viewport: params.viewport,
    summary: {
      totalFiles: stats.totalFiles,
      codeFileCount: stats.codeFileCount,
      assetFileCount: stats.assetFileCount,
      totalLinesOfCode: stats.totalLinesOfCode,
      totalBytes: stats.totalBytes,
    },
    files: params.files.map((file) => ({
      path: file.path,
      name: file.name,
      type: file.type,
      content: file.content,
    })),
  };
}

export function exportProjectAsJson(params: {
  projectName: string;
  entryHtmlPath: string | null;
  viewport: ViewportPreset;
  files: ProjectFile[];
  filename?: string;
}): void {
  const payload = buildProjectExportJson(params);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerBlobDownload(blob, params.filename || 'framecraft-project.json');
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeHtmlForXhtmlForeignObject(rawHtml: string): string {
  const stripped = rawHtml
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '');

  if (typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${stripped}</body>`, 'text/html');
      const serializer = new XMLSerializer();
      const bodyChildren = Array.from(doc.body.childNodes)
        .map((node) => serializer.serializeToString(node))
        .join('');
      return bodyChildren;
    } catch {
      // Fallback to void-tag normalization below
    }
  }

  return stripped
    .replace(/<(area|base|br|col|embed|hr|img|input|meta|param|source|track|wbr)(\b[^>]*?)?\/?>/gi, '<$1$2 />')
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

export function extractBodyAndStylesFromHtml(html: string): {
  cssText: string;
  bodyHtml: string;
} {
  const styleChunks: string[] = [];
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRe.exec(html)) !== null) {
    if (match[1]) {
      styleChunks.push(match[1]);
    }
  }
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  const bodyHtml = bodyMatch ? bodyMatch[1] : html;
  return {
    cssText: styleChunks.join('\n'),
    bodyHtml,
  };
}

export function buildSvgSnapshotDocument(params: {
  cssText: string;
  bodyHtml: string;
  width: number;
  height: number;
  bodyBg?: string;
  title?: string;
}): string {
  const width = Math.max(320, Math.min(2800, Math.round(params.width || 1280)));
  const height = Math.max(240, Math.min(4000, Math.round(params.height || 720)));
  const bg = params.bodyBg && params.bodyBg !== 'rgba(0, 0, 0, 0)' ? params.bodyBg : '#ffffff';
  const safeCss = params.cssText.replace(/<\/style>/gi, '');
  const safeTitle = escapeXmlText(params.title || 'Framecraft Snapshot');
  const xhtmlBody = sanitizeHtmlForXhtmlForeignObject(params.bodyHtml);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${safeTitle}</title>
  <rect width="100%" height="100%" fill="${bg.replace(/"/g, '&quot;')}" />
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${width}px;min-height:${height}px;background:${bg.replace(/"/g, '')};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <style type="text/css">/*<![CDATA[*/\n${safeCss}\n/*]]>*/</style>
      ${xhtmlBody}
    </div>
  </foreignObject>
</svg>`;
}

export function exportSvgSnapshot(params: {
  cssText: string;
  bodyHtml: string;
  width: number;
  height: number;
  bodyBg?: string;
  title?: string;
  filename?: string;
}): void {
  const svgMarkup = buildSvgSnapshotDocument(params);
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  triggerBlobDownload(blob, params.filename || 'framecraft-snapshot.svg');
}

export async function exportPngSnapshot(params: {
  cssText: string;
  bodyHtml: string;
  width: number;
  height: number;
  bodyBg?: string;
  title?: string;
  filename?: string;
}): Promise<void> {
  const width = Math.max(320, Math.min(2800, Math.round(params.width || 1280)));
  const height = Math.max(240, Math.min(4000, Math.round(params.height || 720)));
  const svgMarkup = buildSvgSnapshotDocument({ ...params, width, height });
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to rasterize visual snapshot'));
      image.src = svgUrl;
    });

    const scale = width <= 1440 ? 2 : 1;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    ctx.scale(scale, scale);
    ctx.fillStyle =
      params.bodyBg && params.bodyBg !== 'rgba(0, 0, 0, 0)' ? params.bodyBg : '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PNG export blocked by browser canvas security'));
      }, 'image/png');
    });

    triggerBlobDownload(pngBlob, params.filename || 'framecraft-snapshot.png');
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

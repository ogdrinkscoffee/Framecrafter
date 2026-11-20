import JSZip from 'jszip';
import type { ProjectFile } from '../types/editor';

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

export async function exportProjectAsZip(
  files: ProjectFile[],
  archiveName = 'framecraft-project.zip'
): Promise<void> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.path, file.content);
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

import type { ProjectFile } from '../types/editor';

export type FileExtensionCategory =
  | 'react'
  | 'script'
  | 'style'
  | 'json'
  | 'html'
  | 'image'
  | 'native'
  | 'other';

export interface FileBadgeStyle {
  category: FileExtensionCategory;
  shortLabel: string;
  textColorClass: string;
  badgeClass: string;
}

export interface FileTreeFolderNode {
  kind: 'folder';
  name: string;
  path: string;
  children: FileTreeNode[];
}

export interface FileTreeFileNode {
  kind: 'file';
  name: string;
  path: string;
  file: ProjectFile;
}

export type FileTreeNode = FileTreeFolderNode | FileTreeFileNode;

export function getFileExtension(pathOrName: string): string {
  const clean = pathOrName.split('?')[0].toLowerCase();
  const base = clean.split('/').pop() || clean;
  const dotIdx = base.lastIndexOf('.');
  if (dotIdx <= 0) return '';
  return base.slice(dotIdx);
}

export function getFileBadgeStyle(pathOrName: string, fallbackType?: ProjectFile['type']): FileBadgeStyle {
  const ext = getFileExtension(pathOrName);

  if (ext === '.tsx' || ext === '.jsx') {
    return {
      category: 'react',
      shortLabel: ext === '.tsx' ? 'TSX' : 'JSX',
      textColorClass: 'text-cyan-500 dark:text-cyan-400',
      badgeClass: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 border-cyan-500/25',
    };
  }

  if (ext === '.ts' || ext === '.mts' || ext === '.cts' || ext === '.js' || ext === '.mjs' || ext === '.cjs' || fallbackType === 'js') {
    return {
      category: 'script',
      shortLabel: ext.startsWith('.t') || ext.endsWith('ts') ? 'TS' : 'JS',
      textColorClass: 'text-sky-600 dark:text-sky-400',
      badgeClass: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25',
    };
  }

  if (ext === '.css' || ext === '.scss' || ext === '.sass' || fallbackType === 'css') {
    return {
      category: 'style',
      shortLabel: ext === '.scss' ? 'SCSS' : 'CSS',
      textColorClass: 'text-violet-600 dark:text-violet-400',
      badgeClass: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25',
    };
  }

  if (ext === '.json' || fallbackType === 'json') {
    return {
      category: 'json',
      shortLabel: 'JSON',
      textColorClass: 'text-amber-600 dark:text-amber-400',
      badgeClass: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
    };
  }

  if (ext === '.html' || ext === '.htm' || fallbackType === 'html') {
    return {
      category: 'html',
      shortLabel: 'HTML',
      textColorClass: 'text-orange-600 dark:text-orange-400',
      badgeClass: 'bg-orange-500/12 text-orange-700 dark:text-orange-300 border-orange-500/25',
    };
  }

  if (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.gif' ||
    ext === '.webp' ||
    ext === '.svg' ||
    ext === '.ico' ||
    ext === '.avif' ||
    ext === '.bmp'
  ) {
    return {
      category: 'image',
      shortLabel: ext.slice(1).toUpperCase().slice(0, 4),
      textColorClass: 'text-pink-600 dark:text-pink-400',
      badgeClass: 'bg-pink-500/12 text-pink-700 dark:text-pink-300 border-pink-500/25',
    };
  }

  if (
    ext === '.kt' ||
    ext === '.kts' ||
    ext === '.xml' ||
    ext === '.gradle' ||
    ext === '.pro'
  ) {
    return {
      category: 'native',
      shortLabel: ext === '.xml' ? 'XML' : ext === '.kts' || ext === '.gradle' ? 'GRD' : 'KT',
      textColorClass: 'text-emerald-600 dark:text-emerald-400',
      badgeClass: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    };
  }

  return {
    category: 'other',
    shortLabel: ext ? ext.slice(1).toUpperCase().slice(0, 4) : 'FILE',
    textColorClass: 'text-[var(--studio-muted)]',
    badgeClass: 'bg-zinc-500/10 text-[var(--studio-muted)] border-[var(--studio-border)]',
  };
}

export function buildProjectFileTree(files: ProjectFile[]): FileTreeNode[] {
  interface MutableFolder {
    name: string;
    path: string;
    folders: Map<string, MutableFolder>;
    files: FileTreeFileNode[];
  }

  const root: MutableFolder = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const cleanPath = file.path.replace(/^\/+/, '');
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const segment = parts[i];
      const folderPath = current.path ? `${current.path}/${segment}` : segment;
      let nextFolder = current.folders.get(segment);
      if (!nextFolder) {
        nextFolder = {
          name: segment,
          path: folderPath,
          folders: new Map(),
          files: [],
        };
        current.folders.set(segment, nextFolder);
      }
      current = nextFolder;
    }

    const fileName = parts[parts.length - 1];
    current.files.push({
      kind: 'file',
      name: fileName,
      path: file.path,
      file,
    });
  }

  function finalize(folder: MutableFolder): FileTreeNode[] {
    const childFolders: FileTreeFolderNode[] = Array.from(folder.folders.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((sub) => ({
        kind: 'folder',
        name: sub.name,
        path: sub.path,
        children: finalize(sub),
      }));

    const childFiles = [...folder.files].sort((a, b) => a.name.localeCompare(b.name));
    return [...childFolders, ...childFiles];
  }

  return finalize(root);
}

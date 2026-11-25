import type { EditorMode, ProjectFile, StudioThemeId } from '../types/editor';

const WORKSPACE_STORAGE_KEY = 'framecraft_autosave_workspace_v1';
const DEFAULT_MODE_STORAGE_KEY = 'framecraft_default_mode_v1';
const STUDIO_THEME_STORAGE_KEY = 'framecraft_studio_theme_v1';

export interface SavedWorkspacePayload {
  projectName: string;
  activeTemplateId: string | null;
  files: ProjectFile[];
  savedAt: number;
}

export function saveWorkspaceToStorage(payload: SavedWorkspacePayload): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const serializablePayload: SavedWorkspacePayload = {
      ...payload,
      files: payload.files.map(({ blobUrl: _blobUrl, ...rest }) => rest),
    };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(serializablePayload));
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspaceFromStorage(): SavedWorkspacePayload | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedWorkspacePayload;
    if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearWorkspaceStorage(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
}

export function loadDefaultModePreference(): EditorMode {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'edit';
    const raw = window.localStorage.getItem(DEFAULT_MODE_STORAGE_KEY);
    return raw === 'interact' ? 'interact' : 'edit';
  } catch {
    return 'edit';
  }
}

export function saveDefaultModePreference(mode: EditorMode): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEFAULT_MODE_STORAGE_KEY, mode);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadStudioThemePreference(): StudioThemeId {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'obsidian';
    const raw = window.localStorage.getItem(STUDIO_THEME_STORAGE_KEY);
    if (raw === 'daylight' || raw === 'paper' || raw === 'slate' || raw === 'obsidian') {
      return raw;
    }
    return 'obsidian';
  } catch {
    return 'obsidian';
  }
}

export function saveStudioThemePreference(theme: StudioThemeId): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STUDIO_THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage errors
  }
}

export interface FileSystemDirectoryHandleLike {
  name: string;
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<FileSystemDirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean }
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: string | Uint8Array | Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
      'function'
  );
}

export async function requestWritableDirectoryHandle(): Promise<{
  handle: FileSystemDirectoryHandleLike | null;
  permission: 'granted' | 'denied' | 'unsupported';
  errorMessage?: string;
}> {
  if (!isFileSystemAccessSupported()) {
    return {
      handle: null,
      permission: 'unsupported',
      errorMessage:
        'Browser File System Access is unavailable in this environment; auto-saving to workspace storage instead.',
    };
  }

  try {
    const picker = (
      window as unknown as {
        showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandleLike>;
      }
    ).showDirectoryPicker;

    const handle = await picker({ mode: 'readwrite' });
    if (handle.queryPermission && handle.requestPermission) {
      let state = await handle.queryPermission({ mode: 'readwrite' });
      if (state !== 'granted') {
        state = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (state !== 'granted') {
        return {
          handle: null,
          permission: 'denied',
          errorMessage: 'Write permission was declined for the selected folder.',
        };
      }
    }
    return { handle, permission: 'granted' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to access local directory';
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { handle: null, permission: 'denied' };
    }
    return {
      handle: null,
      permission: 'unsupported',
      errorMessage: message,
    };
  }
}

export async function writeProjectFilesToDirectory(
  rootHandle: FileSystemDirectoryHandleLike,
  files: ProjectFile[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (rootHandle.queryPermission) {
      const state = await rootHandle.queryPermission({ mode: 'readwrite' });
      if (state !== 'granted' && rootHandle.requestPermission) {
        const next = await rootHandle.requestPermission({ mode: 'readwrite' });
        if (next !== 'granted') {
          return { ok: false, error: 'Folder write permission denied' };
        }
      }
    }

    for (const file of files) {
      const segments = file.path.split('/').filter(Boolean);
      if (segments.length === 0) continue;

      let dirHandle = rootHandle;
      for (let i = 0; i < segments.length - 1; i++) {
        dirHandle = await dirHandle.getDirectoryHandle(segments[i], { create: true });
      }
      const fileHandle = await dirHandle.getFileHandle(segments[segments.length - 1], {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      const dataUrlMatch = /^data:[^;]+;base64,(.+)$/s.exec(file.content);
      if (dataUrlMatch && typeof atob === 'function') {
        const binaryStr = atob(dataUrlMatch[1]);
        const bytes = new Uint8Array(binaryStr.length);
        for (let idx = 0; idx < binaryStr.length; idx++) {
          bytes[idx] = binaryStr.charCodeAt(idx);
        }
        await writable.write(bytes);
      } else {
        await writable.write(file.content);
      }
      await writable.close();
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed writing files to disk',
    };
  }
}

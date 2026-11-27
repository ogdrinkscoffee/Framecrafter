import type { HistorySnapshot, HistoryState, ProjectFile } from '../types/editor';

const MAX_HISTORY_ENTRIES = 50;

export function cloneProjectFiles(files: ProjectFile[]): ProjectFile[] {
  return files.map((file) => ({ ...file }));
}

export function areFilesEqual(a: ProjectFile[], b: ProjectFile[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].path !== b[i].path ||
      a[i].name !== b[i].name ||
      a[i].content !== b[i].content ||
      a[i].type !== b[i].type
    ) {
      return false;
    }
  }
  return true;
}

export function createHistoryState(
  initialFiles: ProjectFile[],
  label = 'Initial project'
): HistoryState {
  return {
    past: [],
    present: {
      files: cloneProjectFiles(initialFiles),
      label,
      timestamp: Date.now(),
    },
    future: [],
  };
}

export function pushHistoryState(
  state: HistoryState,
  nextFiles: ProjectFile[],
  label: string
): HistoryState {
  if (areFilesEqual(state.present.files, nextFiles)) {
    return state;
  }

  const nextPast = [...state.past, state.present];
  const trimmedPast =
    nextPast.length > MAX_HISTORY_ENTRIES
      ? nextPast.slice(nextPast.length - MAX_HISTORY_ENTRIES)
      : nextPast;

  const snapshot: HistorySnapshot = {
    files: cloneProjectFiles(nextFiles),
    label,
    timestamp: Date.now(),
  };

  return {
    past: trimmedPast,
    present: snapshot,
    future: [],
  };
}

export function undoHistoryState(state: HistoryState): HistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const nextPast = state.past.slice(0, -1);

  return {
    past: nextPast,
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoHistoryState(state: HistoryState): HistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const nextFuture = state.future.slice(1);

  return {
    past: [...state.past, state.present],
    present: next,
    future: nextFuture,
  };
}

export type HistoryTimelineStatus = 'past' | 'present' | 'future';

export interface HistoryTimelineEntry {
  index: number;
  snapshot: HistorySnapshot;
  status: HistoryTimelineStatus;
  fileCount: number;
  changedFileCount: number;
}

function countChangedFiles(prevFiles: ProjectFile[], nextFiles: ProjectFile[]): number {
  const prevMap = new Map(prevFiles.map((f) => [f.path, f.content]));
  const nextMap = new Map(nextFiles.map((f) => [f.path, f.content]));
  let changed = 0;

  for (const [path, content] of nextMap) {
    if (prevMap.get(path) !== content) changed += 1;
  }
  for (const path of prevMap.keys()) {
    if (!nextMap.has(path)) changed += 1;
  }
  return changed;
}

export function getHistoryTimeline(state: HistoryState): HistoryTimelineEntry[] {
  const combined: Array<{ snapshot: HistorySnapshot; status: HistoryTimelineStatus }> = [
    ...state.past.map((snapshot) => ({ snapshot, status: 'past' as const })),
    { snapshot: state.present, status: 'present' as const },
    ...state.future.map((snapshot) => ({ snapshot, status: 'future' as const })),
  ];

  return combined.map((entry, index) => ({
    index,
    snapshot: entry.snapshot,
    status: entry.status,
    fileCount: entry.snapshot.files.length,
    changedFileCount:
      index === 0
        ? entry.snapshot.files.length
        : countChangedFiles(combined[index - 1].snapshot.files, entry.snapshot.files),
  }));
}

export function jumpToHistoryIndex(
  state: HistoryState,
  targetIndex: number
): HistoryState {
  const timeline = [...state.past, state.present, ...state.future];
  if (
    !Number.isInteger(targetIndex) ||
    targetIndex < 0 ||
    targetIndex >= timeline.length ||
    targetIndex === state.past.length
  ) {
    return state;
  }

  return {
    past: timeline.slice(0, targetIndex),
    present: timeline[targetIndex],
    future: timeline.slice(targetIndex + 1),
  };
}

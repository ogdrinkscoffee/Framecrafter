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

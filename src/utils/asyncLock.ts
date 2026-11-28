import { useCallback, useRef } from 'react';

export interface ActionLock {
  /** Returns false when `key` already has a request in flight. */
  begin: (key: string) => boolean;
  end: (key: string) => void;
  isBusy: (key: string) => boolean;
}

/**
 * Ref-based re-entry guard for mutations.
 *
 * React state updates are asynchronous, so two clicks dispatched inside the
 * same tick both observe `loading === false` and both fire. A ref closes that
 * window without forcing an extra render, which is what "disable the button"
 * alone cannot do (a disabled attribute also only reaches the DOM after the
 * commit).
 */
export function useActionLock(): ActionLock {
  const inFlight = useRef<Set<string>>(new Set());

  const begin = useCallback((key: string) => {
    if (inFlight.current.has(key)) return false;
    inFlight.current.add(key);
    return true;
  }, []);

  const end = useCallback((key: string) => {
    inFlight.current.delete(key);
  }, []);

  const isBusy = useCallback((key: string) => inFlight.current.has(key), []);

  return { begin, end, isBusy };
}

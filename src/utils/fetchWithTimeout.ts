/**
 * fetch() with a hard deadline.
 *
 * Every network call in the studio goes through this wrapper so a hung
 * upstream (GitHub, Gemini, the local Express server) can never leave the UI
 * spinning forever: the request is aborted and the caller receives a typed
 * timeout error it can render to the user.
 *
 * The caller's own AbortSignal is still honoured (the editor uses one to
 * cancel superseded AI requests); a caller abort is re-thrown as-is so callers
 * can tell "the user cancelled" apart from "the server never answered".
 */

export const FETCH_TIMEOUT_MS = {
  /** Cheap read-only probes: auth status, logout, feature flags. */
  probe: 10_000,
  /** GitHub list/read endpoints. */
  read: 15_000,
  /** Mutations: pull, push, OAuth code exchange. */
  mutation: 30_000,
  /**
   * Model calls. Sits just above the server's own 30s Gemini deadline so the
   * server's typed 504 ("the model timed out") wins the race and the user gets
   * an accurate message instead of a generic client abort.
   */
  llm: 35_000,
} as const;

export class FetchTimeoutError extends Error {
  readonly isTimeout = true;
  readonly timeoutMs: number;

  constructor(timeoutMs: number, label = 'Request') {
    super(`${label} timed out after ${Math.round(timeoutMs / 1000)}s.`);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function isTimeoutError(error: unknown): error is FetchTimeoutError {
  return error instanceof FetchTimeoutError;
}

/**
 * Runs `fetch` with a timeout, composing the caller's signal if one is given.
 * Throws {@link FetchTimeoutError} when the deadline elapses.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS.read,
  label?: string
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const upstream = init.signal;
  const forwardAbort = () => controller.abort();
  if (upstream) {
    if (upstream.aborted) {
      controller.abort();
    } else {
      upstream.addEventListener('abort', forwardAbort, { once: true });
    }
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new FetchTimeoutError(timeoutMs, label);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener?.('abort', forwardAbort);
  }
}

/**
 * Turns any thrown fetch error into copy that is safe and useful to show a
 * user: timeouts, offline/blocked requests, and server messages all read
 * differently, and nothing leaks a raw stack or "Failed to fetch".
 */
export function describeFetchError(error: unknown, fallback: string): string {
  if (error instanceof FetchTimeoutError) {
    const seconds = Math.max(1, Math.round(error.timeoutMs / 1000));
    return `The server took longer than ${seconds}s to respond. Check your connection and try again.`;
  }
  if (isAbortError(error)) {
    return 'Request cancelled.';
  }
  if (error instanceof TypeError) {
    // Browsers throw a bare TypeError("Failed to fetch") when the request never
    // reached the server (offline, DNS, blocked by an extension or the CSP).
    return 'Network error — the server could not be reached. Check your connection and try again.';
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

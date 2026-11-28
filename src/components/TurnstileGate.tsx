import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { FETCH_TIMEOUT_MS, fetchWithTimeout } from '../utils/fetchWithTimeout';

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: 'auto' | 'light' | 'dark';
  size?: 'normal' | 'compact' | 'flexible';
  appearance?: 'always' | 'execute' | 'interaction-only';
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileWidgetApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWidgetApi;
  }
}

interface SecurityStatus {
  enabled: boolean;
  siteKey: string;
}

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<boolean> | null = null;
let statusPromise: Promise<SecurityStatus> | null = null;

function loadTurnstileScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.turnstile) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-framecraft-turnstile]'
    );
    const finish = (ok: boolean) => resolve(ok);

    if (existing) {
      existing.addEventListener('load', () => finish(Boolean(window.turnstile)), { once: true });
      existing.addEventListener('error', () => finish(false), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.framecraftTurnstile = 'true';
    script.addEventListener('load', () => finish(Boolean(window.turnstile)), { once: true });
    script.addEventListener('error', () => finish(false), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}

async function loadSecurityStatus(): Promise<SecurityStatus> {
  if (statusPromise) return statusPromise;
  statusPromise = fetchWithTimeout(
    '/api/security/status',
    { headers: { Accept: 'application/json' } },
    FETCH_TIMEOUT_MS.probe,
    'Bot protection check'
  )
    .then(async (response) => {
      if (!response.ok) return { enabled: false, siteKey: '' };
      const data = (await response.json()) as {
        turnstile?: { enabled?: unknown; siteKey?: unknown };
      };
      return {
        enabled: Boolean(data?.turnstile?.enabled),
        siteKey: typeof data?.turnstile?.siteKey === 'string' ? data.turnstile.siteKey : '',
      };
    })
    .catch(() => ({ enabled: false, siteKey: '' }));
  return statusPromise;
}

export interface BotProof {
  captchaToken?: string;
  honeypot?: string;
}

interface TurnstileGateProps {
  /** Receives the Turnstile token (null while unsolved / when protection is off). */
  onTokenChange: (token: string | null) => void;
  /** Reports the honeypot field value so the caller can include it in the payload. */
  onHoneypotChange?: (value: string) => void;
  /** Reports whether protection is active, so forms can disable submit until solved. */
  onStatusChange?: (enabled: boolean) => void;
  /** Increment to discard the current token (e.g. after a failed submission). */
  resetSignal?: number;
  className?: string;
}

/**
 * Cloudflare Turnstile widget plus an off-screen honeypot field.
 * Renders nothing when the server has no Turnstile keys configured, so local
 * development and self-hosted builds keep working unchanged.
 */
export const TurnstileGate: React.FC<TurnstileGateProps> = ({
  onTokenChange,
  onHoneypotChange,
  onStatusChange,
  resetSignal = 0,
  className = '',
}) => {
  const [status, setStatus] = useState<SecurityStatus>({ enabled: false, siteKey: '' });
  const [scriptReady, setScriptReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const callbacksRef = useRef({ onTokenChange, onHoneypotChange, onStatusChange });
  callbacksRef.current = { onTokenChange, onHoneypotChange, onStatusChange };

  const [honeypot, setHoneypot] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadSecurityStatus().then((next) => {
      if (cancelled) return;
      setStatus(next);
      callbacksRef.current.onStatusChange?.(next.enabled && Boolean(next.siteKey));
      if (!next.enabled) callbacksRef.current.onTokenChange(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!status.enabled || !status.siteKey) return;
    let cancelled = false;
    setLoadFailed(false);
    void loadTurnstileScript().then((ok) => {
      if (cancelled) return;
      setScriptReady(ok);
      if (!ok) setLoadFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [status.enabled, status.siteKey, attempt]);

  useEffect(() => {
    if (!scriptReady || !status.siteKey || !containerRef.current || !window.turnstile) return;
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }

    widgetIdRef.current =
      window.turnstile.render(containerRef.current, {
        sitekey: status.siteKey,
        theme: 'auto',
        size: 'flexible',
        callback: (token: string) => callbacksRef.current.onTokenChange(token),
        'expired-callback': () => callbacksRef.current.onTokenChange(null),
        'error-callback': () => {
          callbacksRef.current.onTokenChange(null);
          setLoadFailed(true);
        },
      }) ?? null;

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptReady, status.siteKey, attempt]);

  const resetWidget = useCallback(() => {
    callbacksRef.current.onTokenChange(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (resetSignal === 0) return;
    resetWidget();
  }, [resetSignal, resetWidget]);

  const handleHoneypot = (value: string) => {
    setHoneypot(value);
    callbacksRef.current.onHoneypotChange?.(value);
  };

  if (!status.enabled) return null;

  return (
    <div className={`space-y-1.5 ${className}`} data-testid="turnstile-gate">
      <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-[var(--studio-muted)]">
        <ShieldCheck className="w-3 h-3 shrink-0" strokeWidth={1.5} />
        <span>Human verification</span>
      </div>

      <div ref={containerRef} className="min-h-[65px] w-full" />

      {loadFailed && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1.5 text-[10.5px] text-amber-800 dark:text-amber-200">
          <span>Verification could not load.</span>
          <button
            type="button"
            onClick={() => {
              setScriptReady(false);
              setAttempt((prev) => prev + 1);
            }}
            className="underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hidden honeypot: real users never fill this; bots that autofill it are rejected server-side. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="fc-bot-field">Leave this field empty</label>
        <input
          id="fc-bot-field"
          name="website_url"
          type="text"
          value={honeypot}
          onChange={(event) => handleHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

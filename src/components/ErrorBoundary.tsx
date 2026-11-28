import React from 'react';

interface ErrorBoundaryProps {
  /** Name of the region this boundary guards, used in logs and the fallback UI. */
  label: string;
  children: React.ReactNode;
  /**
   * `root` fills the viewport (the whole app failed); `panel` renders a compact
   * card inside a pane so the rest of the editor keeps working.
   */
  variant?: 'root' | 'panel';
  /** Called after the user clicks "Try again", before the subtree re-renders. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: string | null;
}

/**
 * Catches render/lifecycle errors in a subtree so a single broken panel or a
 * bad element can never turn the editor into a blank white screen. Recovery is
 * in place ("Try again" resets the boundary); the root variant also offers a
 * full reload, which restores the last auto-saved workspace.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.label}] error boundary caught:`, error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error === null) {
      return this.props.children;
    }

    const isRoot = (this.props.variant ?? 'panel') === 'root';
    const { label } = this.props;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className={
          isRoot
            ? 'min-h-dvh w-full overflow-y-auto flex items-center justify-center bg-neutral-950 p-6 text-center'
            : 'h-full min-h-0 w-full overflow-auto flex items-center justify-center bg-[var(--studio-surface)] p-4 text-center'
        }
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <div className={isRoot ? 'max-w-md w-full' : 'max-w-sm w-full'}>
          <h2
            style={{
              fontSize: isRoot ? '18px' : '14px',
              fontWeight: 600,
              color: '#e4e4e7',
              margin: '0 0 10px',
            }}
          >
            {isRoot ? 'Something went wrong' : `${label} hit a problem`}
          </h2>
          <p
            style={{
              fontSize: isRoot ? '14px' : '12.5px',
              color: '#a1a1aa',
              lineHeight: 1.6,
              margin: '0 0 14px',
            }}
          >
            {isRoot
              ? 'The editor hit an unexpected error and could not continue safely. Your work is auto-saved — try again, or reload to restore the last auto-save.'
              : 'This panel crashed, but the rest of the editor is still working. Your work is auto-saved.'}
          </p>
          <pre
            style={{
              fontSize: '11.5px',
              color: '#f87171',
              backgroundColor: '#1f1111',
              padding: '8px 10px',
              borderRadius: 8,
              overflow: 'auto',
              maxHeight: '110px',
              margin: '0 0 14px',
              textAlign: 'left',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
            }}
          >
            {this.state.error}
          </pre>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                backgroundColor: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            {isRoot && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: 'transparent',
                  color: '#d4d4d8',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Reload app
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

import { Component, type ErrorInfo, type ReactNode } from "react";

const CHUNK_RELOAD_KEY = "sa_chunk_reload_at";

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

/** Lazy chunks 404 after a redeploy — a hard reload fetches the new bundle. */
function isChunkError(message: string): boolean {
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch|error loading dynamically/i.test(message);
}

export function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? "0");
    // Never loop: at most one automatic reload per 30 seconds.
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {}
  window.location.reload();
  return true;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors and failed lazy imports so the app shows a readable
 * card with a reload button instead of an empty black/white screen.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const message = messageOf(error);
    if (isChunkError(message)) reloadOnce();
    // Keep a breadcrumb for debugging without spamming the user.
    console.error("[Scholars Abroad] render error:", message, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = messageOf(error);
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/70 bg-white/90 p-6 text-center shadow-sm backdrop-blur">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6">
              <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900">Something broke on this screen</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your data is safe. This is usually a stale cached bundle after an update — a reload fixes it.
          </p>
          <p className="mt-3 max-h-24 overflow-auto rounded-xl bg-slate-50 p-3 text-left font-mono text-[11px] leading-relaxed text-slate-500">
            {message.slice(0, 400)}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-sm font-semibold text-white shadow-[0_12px_26px_-12px_rgba(16,185,129,0.75)] transition hover:from-emerald-500 hover:to-teal-500"
            >
              Reload the app
            </button>
            <a href="/" className="text-xs font-semibold text-emerald-700 hover:underline">
              Back to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

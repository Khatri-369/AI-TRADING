import { Sparkles, RefreshCw, X } from 'lucide-react';
import { usePwaUpdate } from '../hooks/usePwaUpdate';

export default function UpdatePrompt() {
  const { hasUpdate, isUpdating, applyUpdate, dismissUpdate } = usePwaUpdate();

  if (!hasUpdate) return null;

  return (
    <aside
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-3 right-3 z-50 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 sm:bottom-6 sm:right-6 sm:left-auto"
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-emerald-500/30 bg-[#090d16]/95 p-4 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 sm:p-4.5">
        <div className="flex items-start gap-3">
          <img
            src="/icons/tradexa-192.png"
            alt="Tradexa Logo"
            className="h-11 w-11 shrink-0 rounded-xl border border-emerald-500/40 object-cover shadow-md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                New Update Available
              </h4>
              <button
                type="button"
                onClick={dismissUpdate}
                className="text-gray-400 hover:text-white transition p-1 -mr-1"
                aria-label="Dismiss update alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-gray-300 leading-relaxed">
              A new version of Tradexa is ready. Update now to load the latest charts, news, and enhancements.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={dismissUpdate}
            disabled={isUpdating}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="button"
            onClick={applyUpdate}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 hover:border-emerald-500 transition shadow-sm active:scale-95 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
            <span>{isUpdating ? 'Updating…' : 'Update & Restart'}</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

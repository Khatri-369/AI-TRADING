import { AlertCircle, LoaderCircle } from 'lucide-react';
export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
    <AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 break-words">{message}</span>
    {onRetry && <button className="button-secondary" onClick={onRetry}>Try again</button>}
  </div>;
}
export function Loading({ label = 'Loading market data…' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-400"><LoaderCircle className="h-5 w-5 animate-spin text-indigo-400" />{label}</div>;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return <div className="rounded-xl border border-dashed border-slate-700/60 px-5 py-10 text-center"><p className="font-medium text-slate-300">{title}</p>{detail && <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-slate-400">{detail}</p>}</div>;
}

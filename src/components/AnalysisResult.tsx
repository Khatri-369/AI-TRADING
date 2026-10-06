import type { AIAnalysis } from '../types/market';
import { formatTime } from '../utils/format';

export default function AnalysisResult({ result }: { result: AIAnalysis }) {
  return <div className="space-y-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-indigo-200">{result.engine}{result.cached ? ' · cached' : ''}</span><span className={`rounded-md border px-2 py-1 text-xs font-semibold ${result.sentiment === 'Positive' ? 'border-emerald-500/20 text-emerald-300' : result.sentiment === 'Negative' ? 'border-rose-500/20 text-rose-300' : 'border-slate-600 text-slate-300'}`}>{result.sentiment} · {result.confidence.toFixed(0)}% confidence</span></div>
    <p className="text-sm leading-relaxed text-slate-300">{result.rationale}</p>
    <p className="text-xs text-slate-400">Analytical label: <strong className="text-slate-200">{result.signal}</strong> · Model confidence is not a probability of profit.</p>
    {result.risks.length > 0 && <div><h4 className="text-xs font-semibold text-amber-200">Risks & limitations</h4><ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-slate-400">{result.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul></div>}
    {result.affectedAssets.length > 0 && <p className="text-xs text-slate-400">Affected assets: {result.affectedAssets.join(', ')}</p>}
    <p className="text-[11px] text-slate-400">Generated {formatTime(result.generatedAt)} · Informational, not financial advice.</p>
  </div>;
}

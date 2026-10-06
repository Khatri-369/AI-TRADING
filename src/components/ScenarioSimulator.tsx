import { useEffect, useRef, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { simulate, errorMessage } from '../services/api';
import type { ScenarioResult } from '../types/market';
import { ErrorNotice, Loading } from './Feedback';
import { formatTime } from '../utils/format';

export default function ScenarioSimulator() {
  const [text, setText] = useState(''); const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  const run = async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setResult(null); setError('');
    try { const value = await simulate(text, controller.signal); if (!controller.signal.aborted) setResult(value); }
    catch (cause) { if (!controller.signal.aborted) setError(errorMessage(cause)); }
    finally { if (!controller.signal.aborted) setLoading(false); active.current = null; }
  };
  return <section className="panel"><h2 className="section-heading"><FlaskConical className="h-5 w-5 text-indigo-400" />Hypothetical scenario laboratory</h2><p className="my-3 text-sm text-amber-200">HYPOTHETICAL SIMULATION · Results are separate from observed market quotes.</p><form onSubmit={event => { event.preventDefault(); void run(); }}><label className="block text-sm text-slate-300" htmlFor="scenario">Describe a hypothetical market event</label><textarea id="scenario" className="field my-3 min-h-24" value={text} onChange={event => setText(event.target.value)} minLength={10} maxLength={2000} required placeholder="Federal Reserve cuts rates by 100 bps" /><button className="button-primary" disabled={loading || text.trim().length < 10}>Explore with Gemini</button></form>{loading && <Loading label="Exploring conditional impacts…" />}{error && <div className="mt-4"><ErrorNotice message={error} /></div>}{result && <div className="mt-6 space-y-4"><p className="text-xs text-slate-400">{result.engine} · {formatTime(result.generatedAt)} · {result.cached ? 'Cached analysis' : 'Generated analysis'}</p><h3 className="font-semibold">{result.scenario}</h3><p className="text-sm leading-relaxed text-slate-300">{result.summary}</p><div className="grid gap-3 sm:grid-cols-2">{result.impacts.map((impact,index) => <article key={`${impact.symbol}-${index}`} className="rounded-xl border border-slate-700 p-4"><h4 className="font-mono text-indigo-200">{impact.symbol} · {impact.direction.toUpperCase()}</h4>{impact.estimatedChangePercent !== null && <p className="mt-2 text-xs text-amber-200">Illustrative estimate: {impact.estimatedChangePercent}%</p>}<p className="mt-2 text-sm text-slate-400">{impact.rationale}</p></article>)}</div><ul className="list-disc space-y-2 pl-5 text-sm text-amber-200">{result.risks.map((risk,index) => <li key={index}>{risk}</li>)}</ul></div>}</section>;
}

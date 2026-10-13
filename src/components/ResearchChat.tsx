import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Square, Trash2, X } from 'lucide-react';
import { askResearch, errorMessage, safeArticleUrl } from '../services/api';
import type { ChatInput, ChatResult } from '../../shared/chat';

type Turn = { question: string; result: ChatResult };
const starters = ['Summarize the available Indian market data and its limitations.', 'Explain how interest rates can affect equities and gold.', 'Compare the available data for NIFTY 50 and BANK NIFTY.'];

export default function ResearchChat({ open, onOpenChange, symbol = '', onClearFocus }: { open: boolean; onOpenChange: (open: boolean) => void; symbol?: string; onClearFocus: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onOpenChange(false); launcher.current?.focus(); }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);
  const close = () => { onOpenChange(false); launcher.current?.focus(); };
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { latest.current?.scrollIntoView({ block: 'nearest' }); }, [turns, pending, error]);

  async function send(question = draft) {
    if (controller.current || question.trim().length < 3) return;
    const request = new AbortController();
    controller.current = request;
    setPending(question.trim()); setError(''); setDraft(question);
    // Keep complete recent exchanges within the backend's conversation budget.
    const history: ChatInput['history'] = [];
    let size = question.length;
    for (const turn of turns.slice(-3).reverse()) {
      if (size + turn.question.length + turn.result.answer.length > 9500) break;
      history.unshift({ role: 'user', text: turn.question }, { role: 'assistant', text: turn.result.answer });
      size += turn.question.length + turn.result.answer.length;
    }
    try {
      const result = await askResearch({ message: question.trim(), history, symbols: symbol ? [symbol] : [] }, request.signal);
      if (!request.signal.aborted) { setTurns(previous => [...previous.slice(-19), { question, result }]); setDraft(''); }
    } catch (cause) {
      if (!request.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (controller.current === request) { controller.current = null; setPending(''); }
    }
  }

  return <>
    <button ref={launcher} type="button" aria-label="Open market assistant" aria-expanded={open} aria-controls="market-chat" onClick={() => onOpenChange(!open)} className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-primary)] text-white shadow-lg hover:opacity-90"><Bot size={27} /></button>
    <section hidden={!open} id="market-chat" role="dialog" aria-modal="false" aria-labelledby="research-heading" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }} className="fixed bottom-24 right-3 sm:right-5 z-50 flex h-[min(660px,calc(100dvh-112px))] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl" style={!open ? { display: 'none' } : undefined}>
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] p-4">
        <Bot size={24} className="text-[var(--accent-text)]" /><div className="flex-1 min-w-0"><h2 id="research-heading" className="font-semibold">Market assistant</h2><p className="text-xs text-[var(--text-muted)]">{symbol ? `Researching ${symbol}` : 'Ask, understand, compare'} · Gemini</p></div>
        <button aria-label="New conversation" title="New conversation" className="icon-button" disabled={Boolean(pending) || !turns.length} onClick={() => { setTurns([]); setError(''); setDraft(''); input.current?.focus(); }}><Trash2 size={16} /></button>
        <button aria-label="Close market assistant" className="icon-button" onClick={close}><X size={19} /></button>
      </header>
      {symbol && <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-2 text-xs"><span>Evidence focused on {symbol}</span><button disabled={Boolean(pending)} className="text-[var(--accent-text)] underline" onClick={onClearFocus}>Use all markets</button></div>}
      <div className="min-h-0 flex-1 overflow-y-auto space-y-6 p-4" aria-label="Research conversation" role="log" aria-live="polite" aria-relevant="additions text">
      {!turns.length && !pending && <div className="py-4 space-y-4"><h3 className="text-lg font-medium">What would you like to understand?</h3><p className="text-sm text-[var(--text-secondary)]">Check the evidence behind a move, compare assets or learn what to research before a trade.</p><div className="grid gap-2">{(symbol ? [`Explain the available data for ${symbol}.`, `What evidence is missing before evaluating ${symbol}?`] : starters).map(question => <button key={question} className="rounded-lg border border-[var(--border-default)] p-3 text-left text-sm hover:bg-[var(--bg-surface-hover)]" onClick={() => void send(question)}>{question}</button>)}</div></div>}
        {turns.map((turn, index) => <article key={index} className="space-y-3">
          <p className="ml-auto max-w-[90%] rounded-lg bg-[var(--accent-subtle)] p-3 text-sm whitespace-pre-wrap break-words"><span className="sr-only">You: </span>{turn.question}</p>
          <div className="space-y-3 text-sm"><p className="text-xs font-semibold text-[var(--text-muted)]">ASSISTANT · {new Date(turn.result.generatedAt).toLocaleTimeString()}{turn.result.cached ? ' · Cached answer' : ''}</p><p className="whitespace-pre-wrap break-words leading-7">{turn.result.answer}</p>
            {turn.result.limitations.length > 0 && <div className="rounded-lg bg-[var(--bg-subtle)] p-3"><p className="font-medium">Evidence limitations</p><ul className="mt-1 list-disc pl-5 text-[var(--text-secondary)]">{turn.result.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
            {turn.result.sources.length > 0 && <details><summary className="cursor-pointer font-medium text-[var(--accent-text)]">Sources used ({turn.result.sources.length})</summary><ul className="mt-2 grid gap-2 sm:grid-cols-2">{turn.result.sources.map(source => {
              const url = source.url?.startsWith('/asset/') ? source.url : source.url ? safeArticleUrl(source.url) : null;
              return <li key={source.id} className="rounded-lg border border-[var(--border-subtle)] p-3 text-xs"><p className="font-medium">[{source.id}] {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="underline">{source.label}</a> : source.label}</p><p className="mt-1 text-[var(--text-secondary)]">{source.provider} · {source.status} · {source.asOf ? new Date(source.asOf).toLocaleString() : 'Observation time unavailable'}</p></li>;
            })}</ul></details>}
            {index === turns.length - 1 && <div className="flex flex-wrap gap-2">{turn.result.followUps.map(question => <button key={question} disabled={Boolean(pending)} className="button-secondary text-xs text-left" onClick={() => void send(question)}>{question}</button>)}</div>}
          </div>
        </article>)}
        {pending && <div className="text-sm" role="status"><p className="whitespace-pre-wrap break-words">{pending}</p><p className="mt-2 text-[var(--text-muted)]">Reviewing available market evidence…</p></div>}
        {error && <p role="alert" className="rounded-lg border border-[var(--border-default)] p-3 text-sm">{error} Your question is preserved below so you can retry.</p>}
        <div ref={latest} />
      </div>
      <form onSubmit={e => { e.preventDefault(); void send(); }} className="shrink-0 border-t border-[var(--border-subtle)] p-3 space-y-2">
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-2">
        <label htmlFor="research-question" className="sr-only">Your question</label>
        <textarea ref={input} id="research-question" rows={2} className="min-w-0 flex-1 resize-none bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-[var(--accent-primary)] rounded-lg" placeholder="Ask about the markets…" maxLength={1600} value={draft} disabled={Boolean(pending)} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        {pending ? <button type="button" aria-label="Stop waiting" className="button-secondary h-10 w-10" onClick={() => controller.current?.abort()}><Square size={16} /></button> : <button type="submit" aria-label="Send message" className="button-primary h-10 w-10" disabled={draft.trim().length < 3}><Send size={18} /></button>}
        </div>
        <p className="text-[10px] leading-4 text-[var(--text-muted)]">AI can be wrong; verify sources. No trading execution. Messages are sent to Gemini. Shift+Enter adds a line.</p>
      </form>
    </section>
  </>;
}

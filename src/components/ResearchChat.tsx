import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Square, Trash2, X, Sparkles, MessageSquare } from 'lucide-react';
import { askResearch, errorMessage, safeArticleUrl } from '../services/api';
import type { ChatInput, ChatResult, ChatFocus } from '../../shared/chat';

type Turn = { question: string; result: ChatResult };
const starters = [
  'Summarize the available Indian market data and its limitations.',
  'Explain how interest rates can affect equities and gold.',
  'Compare the available data for NIFTY 50 and BANK NIFTY.',
];

export default function ResearchChat({
  open,
  onOpenChange,
  symbol = '',
  focus,
  onClearFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol?: string;
  focus?: ChatFocus;
  onClearFocus: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Defer focus slightly for mobile virtual keyboard comfort
      const t = setTimeout(() => input.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
        launcher.current?.focus();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  const close = () => {
    onOpenChange(false);
    launcher.current?.focus();
  };

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    latest.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, pending, error]);

  async function send(question = draft) {
    if (controller.current || question.trim().length < 3) return;
    const request = new AbortController();
    controller.current = request;
    setPending(question.trim());
    setError('');
    setDraft(question);

    const history: ChatInput['history'] = [];
    let size = question.length;
    for (const turn of turns.slice(-3).reverse()) {
      if (size + turn.question.length + turn.result.answer.length > 9500) break;
      history.unshift(
        { role: 'user', text: turn.question },
        { role: 'assistant', text: turn.result.answer }
      );
      size += turn.question.length + turn.result.answer.length;
    }

    try {
      const result = await askResearch(
        {
          message: question.trim(),
          history,
          symbols: symbol ? [symbol] : [],
          language,
          focus,
        },
        request.signal
      );
      if (!request.signal.aborted) {
        setTurns((previous) => [...previous.slice(-19), { question, result }]);
        setDraft('');
      }
    } catch (cause) {
      if (!request.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setPending('');
      }
    }
  }

  return (
    <>
      {/* Floating Action Button Launcher - Hidden when chat dialog is open */}
      <button
        ref={launcher}
        type="button"
        aria-label="Open market assistant"
        aria-expanded={open}
        aria-controls="market-chat"
        onClick={() => onOpenChange(true)}
        className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-xl shadow-cyan-500/25 hover:scale-105 active:scale-95 transition cursor-pointer ${
          open ? 'hidden' : 'flex'
        }`}
        title="Ask AI Market Assistant"
      >
        <Bot size={22} />
      </button>

      {/* Mobile Dimmed Backdrop Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 sm:hidden transition-opacity"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Responsive Chat Sheet / Floating Window */}
      {open && (
        <section
          id="market-chat"
          role="dialog"
          aria-modal="true"
          aria-labelledby="research-heading"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
          className="fixed inset-x-0 bottom-0 top-[8dvh] sm:top-auto sm:inset-x-auto sm:bottom-20 sm:right-6 z-50 flex sm:h-[min(640px,calc(100dvh-100px))] sm:w-[440px] flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border-t sm:border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-2xl animate-in slide-in-from-bottom duration-250"
        >
          {/* Mobile Drag Indicator Bar */}
          <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-[var(--border-strong)] opacity-60" />
          </div>

          {/* Assistant Header Bar */}
          <header className="flex shrink-0 items-center justify-between gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-sm">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <h2 id="research-heading" className="text-sm sm:text-base font-bold text-[var(--text-primary)] leading-tight truncate">
                  Market assistant
                </h2>
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {symbol ? `Researching ${symbol}` : 'Gemini 2.5 Flash'} · Verified Telemetry
                </p>
              </div>
            </div>

            {/* Language Segmented Pill & Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <select
                aria-label="Assistant language"
                className="field text-xs h-7 px-2 py-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] font-medium text-[var(--text-secondary)]"
                disabled={Boolean(pending)}
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
              >
                <option value="en">EN</option>
                <option value="hi">हिन्दी</option>
              </select>

              <button
                type="button"
                aria-label="New conversation"
                title="Clear conversation"
                className="icon-button h-8 w-8 rounded-lg p-0"
                disabled={Boolean(pending) || !turns.length}
                onClick={() => {
                  setTurns([]);
                  setError('');
                  setDraft('');
                  input.current?.focus();
                }}
              >
                <Trash2 size={15} />
              </button>

              <button
                type="button"
                aria-label="Close market assistant"
                title="Close"
                className="icon-button h-8 w-8 rounded-lg p-0"
                onClick={close}
              >
                <X size={17} />
              </button>
            </div>
          </header>

          {/* Context Sub-banners */}
          {symbol && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-2 text-xs">
              <span className="font-medium text-[var(--text-secondary)] truncate">
                Evidence focused on {symbol}
              </span>
              <button
                type="button"
                disabled={Boolean(pending)}
                className="text-[var(--accent-text)] hover:underline whitespace-nowrap text-xs font-medium"
                onClick={onClearFocus}
              >
                Use all markets
              </button>
            </div>
          )}

          {focus && (
            <div className="border-b border-[var(--border-subtle)] bg-cyan-500/5 px-4 py-2 text-xs text-[var(--text-secondary)]">
              Attached snapshot: {focus.interval} · {focus.range} · {focus.drawings.length} annotations
              {focus.plan ? ' · active plan' : ''}.
            </div>
          )}

          {/* Message Thread Area */}
          <div
            className="min-h-0 flex-1 overflow-y-auto space-y-4 p-4 scrollbar-thin"
            aria-label="Research conversation"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {!turns.length && !pending && (
              <div className="py-2 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    What would you like to explore?
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Ask for multi-market evidence, macro correlations, or technical levels before planning a trade.
                  </p>
                </div>

                <div className="grid gap-2">
                  {(symbol
                    ? [
                        `Explain current price action and drivers for ${symbol}.`,
                        `What evidence is missing before evaluating ${symbol}?`,
                      ]
                    : starters
                  ).map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="group flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-left text-xs text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition cursor-pointer shadow-xs"
                      onClick={() => void send(question)}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {turns.map((turn, index) => (
              <article key={index} className="space-y-3">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-2.5 text-xs sm:text-sm text-white shadow-sm whitespace-pre-wrap break-words">
                    <span className="sr-only">You: </span>
                    {turn.question}
                  </p>
                </div>

                <div className="space-y-2.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                    <span>MARKET ASSISTANT · {new Date(turn.result.generatedAt).toLocaleTimeString()}</span>
                    {turn.result.cached && <span className="text-[var(--text-muted)]">(Cached)</span>}
                  </div>

                  <div className="rounded-2xl rounded-tl-xs border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words shadow-xs">
                    {turn.result.answer}
                  </div>

                  {turn.result.limitations.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                      <p className="font-semibold text-amber-400">Telemetry Limitations</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[var(--text-secondary)]">
                        {turn.result.limitations.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {turn.result.sources.length > 0 && (
                    <details className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-xs">
                      <summary className="cursor-pointer font-medium text-[var(--accent-text)] select-none">
                        Sources used ({turn.result.sources.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
                        {turn.result.sources.map((source) => {
                          const url = source.url?.startsWith('/asset/')
                            ? source.url
                            : source.url
                            ? safeArticleUrl(source.url)
                            : null;
                          return (
                            <li key={source.id} className="rounded-lg bg-[var(--bg-subtle)] p-2 text-[11px]">
                              <p className="font-semibold text-[var(--text-primary)]">
                                [{source.id}]{' '}
                                {url ? (
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent-text)]">
                                    {source.label}
                                  </a>
                                ) : (
                                  source.label
                                )}
                              </p>
                              <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                                {source.provider} · {source.status} · {source.asOf ? new Date(source.asOf).toLocaleTimeString() : 'Recent'}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}

                  {index === turns.length - 1 && turn.result.followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {turn.result.followUps.map((question) => (
                        <button
                          key={question}
                          type="button"
                          disabled={Boolean(pending)}
                          className="flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition text-left"
                          onClick={() => void send(question)}
                        >
                          <MessageSquare className="h-3 w-3 shrink-0 text-cyan-400" />
                          <span>{question}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}

            {pending && (
              <div className="space-y-2 text-xs" role="status">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-xs bg-gradient-to-r from-cyan-600 to-blue-600 px-3.5 py-2.5 text-xs text-white opacity-80 whitespace-pre-wrap break-words">
                    {pending}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-xs border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3 text-[var(--text-secondary)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                  </span>
                  <span>Synthesizing verified market evidence with Gemini…</span>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                {error} Your question is saved below to retry.
              </div>
            )}

            <div ref={latest} />
          </div>

          {/* Prompt Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] space-y-1.5"
          >
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-canvas)] p-2 focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition">
              <label htmlFor="research-question" className="sr-only">
                Your question
              </label>
              <textarea
                ref={input}
                id="research-question"
                rows={2}
                className="min-w-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                placeholder="Ask about markets, trends, levels…"
                maxLength={1600}
                value={draft}
                disabled={Boolean(pending)}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />

              {/* Crisp Send / Cancel Button */}
              {pending ? (
                <button
                  type="button"
                  aria-label="Stop waiting"
                  title="Cancel request"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] active:scale-95 transition cursor-pointer p-0"
                  onClick={() => controller.current?.abort()}
                >
                  <Square className="h-4 w-4 fill-current text-rose-500" />
                </button>
              ) : (
                <button
                  type="submit"
                  aria-label="Send message"
                  title="Send message"
                  disabled={draft.trim().length < 3}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md hover:brightness-110 active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer p-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="text-[10px] text-[var(--text-muted)] text-center leading-tight">
              AI assistant · Evidence-backed · Press Enter to send
            </p>
          </form>
        </section>
      )}
    </>
  );
}

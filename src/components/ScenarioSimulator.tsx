import { useEffect, useRef, useState } from 'react';
import { FlaskConical, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { simulate, errorMessage } from '../services/api';
import type { ScenarioResult } from '../types/market';
import { ErrorNotice, Loading } from './Feedback';
import { formatTime } from '../utils/format';

const PRESET_SCENARIOS = [
  'Federal Reserve cuts benchmark interest rate by 50 bps in response to cooling labor market',
  'Middle East crude oil supply disruption leading to +20% surge in global Brent prices',
  'Global semiconductor supply chain bottleneck tightens export restrictions on advanced AI hardware',
  'RBI unexpectedly raises repo rate by 25 bps to counteract domestic food inflation',
];

export default function ScenarioSimulator() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [loading]);

  const run = async (promptText?: string) => {
    const target = promptText ?? text;
    if (!target.trim() || target.trim().length < 10) return;
    if (active.current) return;

    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const value = await simulate(target, controller.signal);
      if (!controller.signal.aborted) setResult(value);
    } catch (cause) {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      active.current = null;
    }
  };

  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <ArrowUpRight className="h-4 w-4 text-[var(--gain-text)]" />;
      case 'down':
        return <ArrowDownRight className="h-4 w-4 text-[var(--loss-text)]" />;
      default:
        return <Minus className="h-4 w-4 text-[var(--delayed-text)]" />;
    }
  };

  return (
    <section className="panel" aria-label="Hypothetical Scenario Simulation">
      <div className="mb-4 border-b border-[var(--border-subtle)] pb-3.5">
        <h2 className="section-heading text-base">
          <FlaskConical className="h-4 w-4 text-[var(--accent-primary)]" />
          <span>Macro Scenario Laboratory</span>
        </h2>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
          Hypothetical macro shock analysis modeled with Gemini.
        </p>
      </div>

      {/* Prominent Mandatory Disclaimer Banner */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-[var(--delayed-border)] bg-[var(--delayed-bg)] p-3 text-xs text-[var(--delayed-text)]">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold uppercase tracking-wider">
            Hypothetical Simulation Notice
          </p>
          <p className="opacity-90">
            Simulated impacts are analytical models based purely on theoretical economic conditions. They are completely decoupled from observed real-time quotes and do not constitute financial advice.
          </p>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="mb-4">
        <span className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          Quick test scenarios:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_SCENARIOS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => {
                setText(preset);
                void run(preset);
              }}
              className="rounded border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] transition text-left"
            >
              {preset.length > 55 ? `${preset.slice(0, 52)}…` : preset}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Form */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1" htmlFor="scenario">
          Custom hypothetical market event or shock
        </label>
        <textarea
          id="scenario"
          className="field min-h-24 py-2 text-xs"
          value={text}
          onChange={(event) => setText(event.target.value)}
          minLength={10}
          maxLength={2000}
          required
          placeholder="e.g. Federal Reserve announces 100 bps emergency rate cut following banking liquidity tightening…"
        />
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-muted)]">
            {text.length} / 2000 characters (min. 10)
          </span>
          <button
            type="submit"
            className="button-primary text-xs"
            disabled={loading || text.trim().length < 10}
          >
            {loading ? `Modeling shock… (${elapsed.toFixed(1)}s)` : 'Simulate Scenario with Gemini'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-4">
          <Loading
            showTimer
            label="Evaluating macroeconomic conditional impacts with Gemini LLM…"
            sublabel="Prompting Gemini 2.5 Flash and parsing structured sensitivity coefficients across equities, crypto, commodities and currencies…"
          />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorNotice message={error} onRetry={() => void run()} />
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-4 text-[var(--text-primary)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5 text-xs text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--accent-text)]">{result.engine}</span>
            <span>
              Generated: {formatTime(result.generatedAt)} · {result.cached ? 'Cached result' : 'Fresh model inference'}
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{result.scenario}</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {result.summary}
            </p>
          </div>

          {/* Impact Cards Grid */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Modeled Instrument Impacts
            </h4>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {result.impacts.map((impact, index) => (
                <article
                  key={`${impact.symbol}-${index}`}
                  className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                      {impact.symbol}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide">
                      {getDirectionIcon(impact.direction)}
                      <span>{impact.direction}</span>
                    </span>
                  </div>
                  {impact.estimatedChangePercent !== null && (
                    <p className="mt-1 text-[11px] font-medium text-[var(--delayed-text)]">
                      Illustrative modeled shift: {impact.estimatedChangePercent > 0 ? '+' : ''}
                      {impact.estimatedChangePercent}%
                    </p>
                  )}
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {impact.rationale}
                  </p>
                </article>
              ))}
            </div>
          </div>

          {/* Identified Systemic Risks */}
          {result.risks.length > 0 && (
            <div className="rounded border border-[var(--delayed-border)] bg-[var(--delayed-bg)] p-3">
              <h4 className="text-xs font-semibold text-[var(--delayed-text)]">
                Identified Systemic & Model Risks
              </h4>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                {result.risks.map((risk, index) => (
                  <li key={index}>{risk}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

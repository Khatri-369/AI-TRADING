import type { AIAnalysis } from '../types/market';
import { formatTime } from '../utils/format';

export default function AnalysisResult({ result }: { result: AIAnalysis }) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-elevated)] p-4 text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent-text)]">
          {result.engine}
          {result.cached ? ' · cached' : ''}
        </span>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-semibold ${
            result.sentiment === 'Positive'
              ? 'border-[var(--gain-border)] bg-[var(--gain-bg)] text-[var(--gain-text)]'
              : result.sentiment === 'Negative'
              ? 'border-[var(--loss-border)] bg-[var(--loss-bg)] text-[var(--loss-text)]'
              : 'border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]'
          }`}
        >
          {result.sentiment} · {result.confidence.toFixed(0)}% confidence
        </span>
      </div>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{result.rationale}</p>
      <p className="text-xs text-[var(--text-muted)]">
        Analytical label:{' '}
        <strong className="text-[var(--text-primary)] font-semibold">{result.signal}</strong> · Model confidence is not a probability of profit.
      </p>
      {result.risks.length > 0 && (
        <div className="rounded border border-[var(--delayed-border)] bg-[var(--delayed-bg)] p-3">
          <h4 className="text-xs font-semibold text-[var(--delayed-text)]">Risks & limitations</h4>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
            {result.risks.map((risk, index) => (
              <li key={index}>{risk}</li>
            ))}
          </ul>
        </div>
      )}
      {result.affectedAssets.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Affected instruments: <span className="font-mono text-[var(--text-primary)]">{result.affectedAssets.join(', ')}</span>
        </p>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">
        Generated {formatTime(result.generatedAt)} · Informational, not financial advice.
      </p>
    </div>
  );
}

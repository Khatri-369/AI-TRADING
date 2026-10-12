import { useEffect, useRef } from 'react';
import { X, ShieldAlert, Database, Info, Lock, Mail, ExternalLink } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ProductDisclosuresModal({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 z-50 m-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-6 py-4">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-[var(--accent-primary)]" />
          <h2 className="text-base font-bold tracking-tight">Data Sources, Legal Disclaimers & Methodology</h2>
        </div>
        <button
          onClick={onClose}
          className="icon-button h-8 w-8 p-1.5"
          aria-label="Close disclosures"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-6 p-6 text-xs leading-relaxed text-[var(--text-secondary)]">
        {/* Educational Research & Regulatory Scope */}
        <section className="rounded-lg border border-[var(--delayed-border)] bg-[var(--delayed-bg)] p-4 text-[var(--delayed-text)]">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h3 className="font-bold uppercase tracking-wider">Educational & Research Prototype Only</h3>
              <p className="mt-1">
                Global Markets Research is an analytical software research demonstration. It is <strong>NOT</strong> a registered investment advisor, broker-dealer, financial intermediary, or depository participant under SEBI, SEC, FCA, or any regulatory jurisdiction.
              </p>
              <p className="mt-1 font-semibold">
                No automated trade execution, buy/sell recommendations, or order placement capabilities are implemented or supported.
              </p>
            </div>
          </div>
        </section>

        {/* Data Providers & Exchange Attributions Table */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Database className="h-4 w-4 text-[var(--accent-primary)]" />
            <h3>Market Data Sources & Attribution</h3>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
                <tr>
                  <th className="px-3.5 py-2.5">Market / Asset Class</th>
                  <th className="px-3.5 py-2.5">Provider Source</th>
                  <th className="px-3.5 py-2.5">Exchange Delay / Policy</th>
                  <th className="px-3.5 py-2.5">Attribution Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                <tr>
                  <td className="px-3.5 py-2 font-medium text-[var(--text-primary)]">Indian Equities & Indices (NSE / BSE)</td>
                  <td className="px-3.5 py-2 font-mono">Upstox Analytics V3</td>
                  <td className="px-3.5 py-2">Read-only snapshots; EOD or closing prices when session is closed.</td>
                  <td className="px-3.5 py-2">
                    <a href="https://upstox.com/developer/api-documentation" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1">
                      Upstox API <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-medium text-[var(--text-primary)]">US Equities, ETFs & News</td>
                  <td className="px-3.5 py-2 font-mono">Finnhub Stock API</td>
                  <td className="px-3.5 py-2">Real-time / Cboe one-minute delayed quotes; financial news feed.</td>
                  <td className="px-3.5 py-2">
                    <a href="https://finnhub.io" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1">
                      Finnhub.io <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-medium text-[var(--text-primary)]">Digital Assets (Cryptocurrency)</td>
                  <td className="px-3.5 py-2 font-mono">CoinGecko API</td>
                  <td className="px-3.5 py-2">24/7 global volume-weighted spot pricing (cache cadence: 60s).</td>
                  <td className="px-3.5 py-2">
                    <a href="https://www.coingecko.com" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1">
                      Powered by CoinGecko <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-medium text-[var(--text-primary)]">Precious Metals (Gold / Silver)</td>
                  <td className="px-3.5 py-2 font-mono">Gold-API.com</td>
                  <td className="px-3.5 py-2">Indicative spot quotes in USD per troy ounce (XAU/XAG).</td>
                  <td className="px-3.5 py-2">
                    <a href="https://gold-api.com" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1">
                      Gold-API.com <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-3.5 py-2 font-medium text-[var(--text-primary)]">Foreign Exchange (USD / INR)</td>
                  <td className="px-3.5 py-2 font-mono">Frankfurter / ECB</td>
                  <td className="px-3.5 py-2">Daily European Central Bank reference exchange rates.</td>
                  <td className="px-3.5 py-2">
                    <a href="https://frankfurter.dev" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-1">
                      Frankfurter.dev <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Commercial Redistribution Notice */}
        <section className="space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
          <h4 className="font-semibold text-[var(--text-primary)]">Market Data Redistribution Boundaries</h4>
          <p>
            Under official exchange terms (NSE India, BSE India, NYSE, and NASDAQ), broadcasting real-time tick-by-tick prices to the general public on commercial platforms requires direct Market Data Vendor / Redistribution Licensing.
          </p>
          <p>
            In this demonstration build, data is retrieved strictly via authorized developer and analytics tokens for personal non-commercial software evaluation. Commercial public deployment remains subject to formal exchange agreements and provider commercial subscriptions.
          </p>
        </section>

        {/* AI Engine Transparency */}
        <section className="space-y-1.5">
          <h4 className="font-semibold text-[var(--text-primary)]">AI Model Transparency & Spending Controls</h4>
          <p>
            Market assessments and hypothetical shock simulations are processed on the backend using <strong>Google Gemini 2.5 Flash</strong> and <strong>ProsusAI/FinBERT NLP</strong>.
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[11px] text-[var(--text-secondary)]">
            <li>Signals (Buy/Sell/Hold) represent algorithmic sentiment classifications only, not investment advice.</li>
            <li>In-flight inferences are concurrency-controlled (max 2 concurrent server-wide).</li>
            <li>Anonymous sessions are allocated a daily research allowance (5 queries/24 hours) with strict IP/session rate limits.</li>
          </ul>
        </section>

        {/* Privacy Notice */}
        <section className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
            <Lock className="h-4 w-4 text-[var(--accent-primary)]" />
            <h4>Privacy & Cookie Policy</h4>
          </div>
          <p>
            This application does not collect personal names, email addresses, phone numbers, or payment data. An anonymous, cryptographically signed HTTP cookie (<code className="font-mono">market_session</code>) is used solely to maintain daily AI request allowances and prevent API exhaustion. Zero third-party advertising or cross-site tracking trackers are embedded.
          </p>
        </section>

        {/* Contact & Technical Inquiries */}
        <section className="border-t border-[var(--border-subtle)] pt-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Technical inquiries: Open an issue on repository tracking
            </span>
            <span>Version: 1.0.0 (Production Architecture)</span>
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-6 py-3">
        <button onClick={onClose} className="button-primary text-xs">
          Acknowledge & Close
        </button>
      </div>
    </dialog>
  );
}

import NewsPreferences from './NewsPreferences';
import JournalAnalytics from './JournalAnalytics';
import PracticeSummary from './PracticeSummary';
import type { Quote } from '../../shared/types';
import type { ChatFocus } from '../../shared/chat';
import { useEffect, useState, useRef } from 'react';
import { ASSET_BY_SYMBOL } from '../../shared/assets';
import {
  alertSchema,
  calculateQuantityFromBudget,
  estimatePlanCosts,
  journalPnl,
  journalSchema,
  planMetrics,
  planSchema,
  type PlanStatus,
  type ResearchRecord,
} from '../../shared/research';
import { useResearchStore, workspaceRequest } from '../hooks/useResearchStore';
import CandleWorkspace from './CandleWorkspace';
import type { ThemeType } from '../types/market';

function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const initialPlan = {
  direction: 'long' as 'long' | 'short',
  entry: '',
  stop: '',
  target: '',
  quantity: '1',
  costs: '0',
  feeBps: '10',
  slippageBps: '5',
  thesis: '',
  evidence: '',
  invalidation: '',
  newsLinks: [] as { title: string; url: string }[],
  chartSnapshot: '',
  status: 'draft' as PlanStatus,
};

type Paper = {
  id: string;
  symbol: string;
  currency: string;
  quantity: number;
  entry: number;
  exit: number | null;
  fees: number;
  openedAt: string;
  closedAt: string | null;
};
type Event = {
  id: number;
  symbol: string;
  price: number;
  asOf: string;
  status: string;
  delivery: string;
};

export default function ResearchDesk({
  theme,
  initialSymbol = 'RELIANCE',
  onAsk,
  onNotifications,
  quotes,
}: {
  theme: ThemeType;
  onNotifications: () => void;
  quotes: Quote[];
  initialSymbol?: string;
  onAsk?: (focus: ChatFocus) => void;
}) {
  const store = useResearchStore();
  const [symbol, setSymbol] = useState(
    ASSET_BY_SYMBOL.has(initialSymbol) ? initialSymbol : 'RELIANCE'
  );
  const [tab, setTab] = useState('Chart');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(initialPlan);
  const [editing, setEditing] = useState<ResearchRecord | null>(null);
  const [budget, setBudget] = useState('');
  const [newsTitle, setNewsTitle] = useState('');
  const [newsUrl, setNewsUrl] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | PlanStatus>('all');
  const [showChartSync, setShowChartSync] = useState(true);

  const [level, setLevel] = useState('');
  const [cooldown, setCooldown] = useState(15);
  const [journalFilter, setJournalFilter] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(8);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [expiry, setExpiry] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  );

  const [journal, setJournal] = useState({
    entry: '',
    exit: '',
    quantity: '1',
    costs: '0',
    direction: 'long' as 'long' | 'short',
    openedAt: new Date().toISOString().slice(0, 10),
    closedAt: new Date().toISOString().slice(0, 10),
    notes: '',
    followedPlan: false,
    tags: '',
    planId: '',
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [feeBps, setFeeBps] = useState('10');
  const [slippageBps, setSlippageBps] = useState('5');
  const [paper, setPaper] = useState<Paper[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [orderId, setOrderId] = useState(() => crypto.randomUUID());

  const asset = ASSET_BY_SYMBOL.get(symbol)!;
  const plans = store.records.filter((r) => r.kind === 'plan');
  const journals = store.records.filter(r => r.kind === 'journal' && [journalSchema.parse(r.data).symbol, journalSchema.parse(r.data).tags].some(value => value.toLowerCase().includes(journalFilter.toLowerCase())));
  const alerts = store.records.filter((r) => r.kind === 'alert');

  const candidate = planSchema.safeParse({
    ...plan,
    symbol,
    exchange: symbol.endsWith('.BSE') || symbol === 'SENSEX' ? 'BSE' : asset.category === 'india' ? 'NSE' : asset.category === 'us' ? 'US' : asset.category,
    currency: asset.currency,
    createdAt: editing
      ? ((editing.data as Record<string, unknown>).createdAt as string) ?? new Date().toISOString()
      : new Date().toISOString(),
    entry: Number(plan.entry),
    stop: Number(plan.stop),
    target: Number(plan.target),
    quantity: Number(plan.quantity),
    costs: Number(plan.costs),
    feeBps: Number(plan.feeBps),
    slippageBps: Number(plan.slippageBps),
    budget: budget ? Number(budget) : undefined,
    chartSnapshot: plan.chartSnapshot || `chart-${symbol}-default`,
  });

  const metrics = candidate.success ? planMetrics(candidate.data) : null;

  const activeUser = useRef(store.user?.id);
  activeUser.current = store.user?.id;
  async function loadExtra() {
    const owner = store.user?.id;
    if (!store.user) {
      setPaper([]);
      setEvents([]);
      return;
    }
    const response = await workspaceRequest<{ paper: Paper[]; events: Event[] }>('/records');
    if (activeUser.current !== owner) return;
    setPaper(response.paper);
    setEvents(response.events);
  }

  useEffect(() => {
    void loadExtra().catch(() => undefined);
  }, [store.user?.id, tab]);

  const acting = useRef(false);
  async function act(fn: () => Promise<unknown>) {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      acting.current = false;
      setBusy(false);
    }
  }

  const numericField = (
    label: string,
    value: string,
    set: (v: string) => void,
    step = 'any',
    placeholder = ''
  ) => (
    <label className="text-xs">
      {label}
      <input
        className="field mt-1 block w-full"
        aria-label={label}
        type="number"
        step={step}
        min="0"
        placeholder={placeholder}
        value={value}
        onChange={(e) => set(e.target.value)}
        required
      />
    </label>
  );

  const tabButton = (name: string) => {
    const isActive = tab === name;
    return (
      <button
        key={name}
        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 min-h-[36px] ${
          isActive
            ? 'bg-[var(--accent-primary)] text-white shadow-sm'
            : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
        }`}
        aria-pressed={isActive}
        onClick={() => {
          setTab(name);
          setError('');
          setEditing(null);
        }}
      >
        <span>{name}</span>
      </button>
    );
  };

  function handleDeriveFromBudget() {
    try {
      const entryNum = Number(plan.entry);
      const stopNum = Number(plan.stop);
      const budgetNum = Number(budget);
      const feeBpsNum = Number(plan.feeBps);
      const slippageBpsNum = Number(plan.slippageBps);

      const result = calculateQuantityFromBudget({
        symbol,
        entry: entryNum,
        stop: stopNum,
        budget: budgetNum,
        feeBps: feeBpsNum,
        slippageBps: slippageBpsNum,
      });

      if (!result.supported || result.limitation) {
        setError(result.limitation ?? 'Constraint limitation encountered.');
        if (result.quantity > 0) {
          setPlan((prev) => ({ ...prev, quantity: String(result.quantity) }));
        }
        return;
      }

      setPlan((prev) => ({
        ...prev,
        quantity: String(result.quantity),
        costs: String((result.quantity * result.costPerUnit).toFixed(2)),
      }));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid budget calculation inputs.');
    }
  }

  function handleAddNewsLink() {
    if (!newsUrl.trim() || !newsTitle.trim()) {
      setError('Please provide both a headline and a valid URL for the news link.');
      return;
    }
    try {
      new URL(newsUrl.trim());
      setPlan((prev) => ({
        ...prev,
        newsLinks: [...prev.newsLinks, { title: newsTitle.trim(), url: newsUrl.trim() }],
      }));
      setNewsTitle('');
      setNewsUrl('');
      setError('');
    } catch {
      setError('Please enter a valid HTTP/HTTPS URL.');
    }
  }

  const filteredPlans = plans.filter((r) => {
    if (planFilter === 'all') return true;
    const p = planSchema.safeParse(r.data);
    return p.success && p.data.status === planFilter;
  });

  return (
    <section id="panel-desk" className="space-y-4">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Research desk
            </h1>
            <span
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {store.user ? `@${store.user.username} · Synced` : 'Guest · Saved on device'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Chart, plan, set alerts & review performance. Practice trades are simulated.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="desk-instrument-select" className="text-xs font-medium text-[var(--text-secondary)] shrink-0">
            Instrument:
          </label>
          <select
            id="desk-instrument-select"
            className="field text-xs font-semibold py-1.5 px-2.5 rounded-lg bg-[var(--bg-surface-elevated)] border-[var(--border-default)] min-w-[200px] max-w-full cursor-pointer"
            value={symbol}
            onChange={(e) => {
              setSymbol(e.target.value);
              setEditing(null);
              setPlan(initialPlan);
              setJournal((previous) => ({ ...previous, planId: '' }));
            }}
          >
            {[...ASSET_BY_SYMBOL.values()].map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol} · {a.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <nav
        aria-label="Research desk tools"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap"
      >
        {['Chart', 'Plan', 'Alerts', 'Journal', 'Practice', 'Account'].map(tabButton)}
      </nav>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {tab === 'Chart' && (
        <CandleWorkspace
          onAsk={onAsk}
          key={symbol}
          symbol={symbol}
          theme={theme}
          onPlan={(levels) => {
            const currentQuote = quotes.find((q) => q.symbol === symbol);
            setPlan({
              ...initialPlan,
              direction: levels?.direction ?? 'long',
              entry: levels?.entry ? String(levels.entry) : currentQuote?.price ? String(currentQuote.price) : '',
              stop: levels?.stop ? String(levels.stop) : '',
              target: levels?.target ? String(levels.target) : '',
            });
            setEditing(null);
            setTab('Plan');
          }}
          onAlert={(price) => {
            setLevel(price.toFixed(4));
            setTab('Alerts');
          }}
        />
      )}

      {tab === 'Plan' && (
        <div className="space-y-4">
          {/* Synchronized Candlestick Chart Workspace */}
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="font-semibold text-sm">
                  Interactive Chart Workspace · {symbol} ({asset.currency})
                </h2>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Levels set here synchronize bidirectionally with the plan inputs below. Drag line handles directly on chart.
                </p>
              </div>
              <button
                type="button"
                className="button-secondary text-xs"
                onClick={() => setShowChartSync((v) => !v)}
              >
                {showChartSync ? 'Minimize chart' : 'Show chart'}
              </button>
            </div>
            {showChartSync && (
              <div className="mt-3">
                <CandleWorkspace
          onAsk={focus => onAsk?.({ ...focus, ...(tab === 'Plan' && candidate.success ? { plan: candidate.data } : {}) })}
                  key={`plan-chart-${symbol}`}
                  symbol={symbol}
                  theme={theme}
                  planLevels={{
                    entry: Number(plan.entry) || undefined,
                    stop: Number(plan.stop) || undefined,
                    target: Number(plan.target) || undefined,
                    direction: plan.direction,
                  }}
                  onPlanLevelChange={(key, price) => {
                    setPlan((prev) => ({ ...prev, [key]: String(price) }));
                  }}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Trade Plan Entry Form */}
            <form
              className="research-card space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  if (!candidate.success) throw new Error(candidate.error.issues[0].message);
                  await store.save(
                    editing?.id ?? crypto.randomUUID(),
                    'plan',
                    candidate.data,
                    editing?.version ?? 0
                  );
                  setEditing(null);
                  setPlan(initialPlan);
                  setBudget('');
                });
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold text-base">
                  {editing ? 'Edit Trade Plan' : 'New Trade Plan'} · {symbol}
                </h2>
                <span className="rounded bg-[var(--bg-surface-elevated)] px-2 py-0.5 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border-subtle)]">
                  {asset.category === 'india' ? 'NSE' : 'US'} · {asset.currency}
                </span>
              </div>

              {/* Scenario Direction */}
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)]">Scenario Direction</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      plan.direction === 'long'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                    }`}
                    onClick={() => setPlan({ ...plan, direction: 'long' })}
                  >
                    📈 Long Scenario
                  </button>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border ${
                      plan.direction === 'short'
                        ? 'border-rose-500 bg-rose-500/10 text-rose-400'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]'
                    }`}
                    onClick={() => setPlan({ ...plan, direction: 'short' })}
                  >
                    📉 Short Scenario
                  </button>
                </div>
              </div>

              {/* Numerical Plan Levels */}
              <div className="grid grid-cols-3 gap-2">
                {numericField('Intended entry', plan.entry, (v) => setPlan({ ...plan, entry: v }))}
                {numericField(
                  plan.direction === 'long' ? 'Stop level (< entry)' : 'Stop level (> entry)',
                  plan.stop,
                  (v) => setPlan({ ...plan, stop: v })
                )}
                {numericField(
                  plan.direction === 'long' ? 'Target (> entry)' : 'Target (< entry)',
                  plan.target,
                  (v) => setPlan({ ...plan, target: v })
                )}
              </div>

              {/* Ordering and Validation Visual Indicator */}
              <div className="rounded-lg bg-[var(--bg-surface-elevated)] p-2.5 border border-[var(--border-subtle)] text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-medium text-[var(--text-secondary)]">Level Ordering Validation:</span>
                  {Number(plan.entry) > 0 && Number(plan.stop) > 0 && Number(plan.target) > 0 ? (
                    plan.direction === 'long' ? (
                      Number(plan.stop) < Number(plan.entry) && Number(plan.target) > Number(plan.entry) ? (
                        <span className="text-emerald-400 font-semibold">✓ Valid Long (Stop &lt; Entry &lt; Target)</span>
                      ) : (
                        <span className="text-rose-400 font-semibold">⚠ Inverted: Long requires Stop &lt; Entry &lt; Target</span>
                      )
                    ) : Number(plan.stop) > Number(plan.entry) && Number(plan.target) < Number(plan.entry) ? (
                      <span className="text-emerald-400 font-semibold">✓ Valid Short (Target &lt; Entry &lt; Stop)</span>
                    ) : (
                      <span className="text-rose-400 font-semibold">⚠ Inverted: Short requires Target &lt; Entry &lt; Stop</span>
                    )
                  ) : (
                    <span className="text-[var(--text-muted)]">Enter positive entry, stop & target</span>
                  )}
                </div>
                {Number(plan.entry) > 0 && Number(plan.stop) > 0 && Number(plan.entry) === Number(plan.stop) && (
                  <p className="text-rose-400">Zero distance between entry and stop is not permitted.</p>
                )}
              </div>

              {/* Position Sizing and Hypothetical Loss Budget */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-3 space-y-2.5">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  Position Sizing & Loss Budget Calculation
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {numericField('Quantity (whole units)', plan.quantity, (v) => setPlan({ ...plan, quantity: v }))}
                  {numericField(
                    `Loss budget (${asset.currency})`,
                    budget,
                    setBudget,
                    'any',
                    'e.g. 5000'
                  )}
                </div>

                {/* Explicit Friction Assumptions */}
                <div className="grid grid-cols-2 gap-2">
                  {numericField('Estimated fee (bps/side)', plan.feeBps, (v) =>
                    setPlan({ ...plan, feeBps: v })
                  )}
                  {numericField('Estimated slippage (bps/side)', plan.slippageBps, (v) =>
                    setPlan({ ...plan, slippageBps: v })
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    className="button-secondary text-xs"
                    onClick={handleDeriveFromBudget}
                  >
                    Derive whole units from budget
                  </button>
                  <button
                    type="button"
                    className="button-secondary text-xs"
                    onClick={() => {
                      const est = estimatePlanCosts(
                        Number(plan.entry) || 0,
                        Number(plan.quantity) || 1,
                        Number(plan.feeBps),
                        Number(plan.slippageBps)
                      );
                      setPlan({ ...plan, costs: String(est) });
                    }}
                  >
                    Update costs assumption
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Whole units only (1 share minimum lot size for cash equities). Broad indices (NIFTY50, BANKNIFTY) do not have cash shares and require index derivatives or ETF equivalents.
                </p>
              </div>

              {/* Thesis, Evidence, and Invalidation */}
              <label className="block text-xs">
                Written Thesis & Trade Rationale
                <textarea
                  className="field mt-1 w-full"
                  rows={2}
                  maxLength={2000}
                  placeholder="Why this trade? Technical pattern, macro setup, or catalyst…"
                  value={plan.thesis}
                  onChange={(e) => setPlan({ ...plan, thesis: e.target.value })}
                />
              </label>

              <label className="block text-xs">
                Supporting Evidence (Indicators, Levels, Volume)
                <textarea
                  className="field mt-1 w-full"
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g., 200 EMA support, 3x relative volume, RSI divergence…"
                  value={plan.evidence}
                  onChange={(e) => setPlan({ ...plan, evidence: e.target.value })}
                />
              </label>

              <label className="block text-xs">
                What Would Invalidate This Setup?
                <textarea
                  className="field mt-1 w-full"
                  rows={2}
                  maxLength={2000}
                  placeholder="Specific price action or events that prove the thesis wrong…"
                  value={plan.invalidation}
                  onChange={(e) => setPlan({ ...plan, invalidation: e.target.value })}
                />
              </label>

              {/* News Links Attachment */}
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] p-2.5 space-y-2">
                <h4 className="text-xs font-semibold">Links to Relevant News & Catalysts</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    className="field text-xs"
                    placeholder="Article title / headline"
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                  />
                  <div className="flex gap-1.5">
                    <input
                      className="field text-xs flex-1"
                      placeholder="https://example.com/news"
                      value={newsUrl}
                      onChange={(e) => setNewsUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="button-secondary text-xs shrink-0"
                      onClick={handleAddNewsLink}
                    >
                      Attach
                    </button>
                  </div>
                </div>
                {plan.newsLinks.length > 0 && (
                  <ul className="space-y-1 text-xs">
                    {plan.newsLinks.map((link, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between gap-2 rounded bg-[var(--bg-surface)] px-2 py-1 border border-[var(--border-subtle)]"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate underline text-blue-400 hover:text-blue-300"
                        >
                          {link.title}
                        </a>
                        <button
                          type="button"
                          className="text-red-400 hover:text-red-300 text-[11px]"
                          onClick={() =>
                            setPlan((prev) => ({
                              ...prev,
                              newsLinks: prev.newsLinks.filter((_, i) => i !== idx),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Plan Status */}
              <label className="block text-xs">
                Plan Status
                <select
                  className="field block mt-1"
                  value={plan.status}
                  onChange={(e) => setPlan({ ...plan, status: e.target.value as PlanStatus })}
                >
                  {['draft', 'watching', 'archived', 'reviewed'].map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>

              {/* Transparent Calculation Results Card */}
              {metrics ? (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs space-y-1.5 text-[var(--text-primary)]">
                  <h4 className="font-semibold text-blue-300 text-sm">Transparent Calculation Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      Entry-to-Stop Distance:{' '}
                      <strong className="text-[var(--text-primary)] font-mono">
                        {metrics.distance.toFixed(2)} {asset.currency}
                      </strong>
                    </div>
                    <div>
                      Potential Loss:{' '}
                      <strong className="text-rose-400 font-mono">
                        {metrics.loss.toFixed(2)} {asset.currency}
                      </strong>
                    </div>
                    <div>
                      Potential Reward:{' '}
                      <strong className="text-emerald-400 font-mono">
                        {metrics.reward.toFixed(2)} {asset.currency}
                      </strong>
                    </div>
                    <div>
                      Reward / Risk Ratio:{' '}
                      <strong className="text-sky-400 font-mono">
                        {metrics.ratio.toFixed(2)} : 1
                      </strong>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
                    Estimated round-trip friction: {metrics.effectiveCosts.toFixed(2)} {asset.currency} (
                    {(metrics.costAssumptionRate * 100).toFixed(0)} bps round-trip).
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Enter valid numeric entry, stop and target prices to inspect calculated metrics.
                </p>
              )}

              {/* Disclaimers & Ethics */}
              <div className="rounded-lg bg-[var(--bg-surface-elevated)] p-2.5 text-[11px] text-[var(--text-muted)] space-y-1 border border-[var(--border-subtle)]">
                <p>
                  ⚠ <strong>Execution realities:</strong> Gaps and slippage during volatile sessions can make actual losses exceed the calculated stop amount.
                </p>
                <p>
                  ⚖ <strong>Research only:</strong> This tool performs mathematical calculations from your explicit inputs; it does not place broker orders or recommend personalized risk limits.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button className="button-primary" disabled={busy}>
                  {editing ? 'Update saved plan' : 'Save trade plan'}
                </button>
                {editing && (
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setEditing(null);
                      setPlan(initialPlan);
                    }}
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </form>

            {/* Saved Trade Plans List */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
                <h3 className="font-semibold text-sm">Saved Trade Plans ({filteredPlans.length})</h3>
                <div className="flex flex-wrap gap-1 text-xs">
                  {(['all', 'draft', 'watching', 'reviewed', 'archived'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`px-2 py-0.5 rounded text-[11px] capitalize ${
                        planFilter === st
                          ? 'bg-[var(--accent-primary)] text-white font-semibold'
                          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      onClick={() => setPlanFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPlans.map((r) => {
                const p = planSchema.parse(r.data);
                const pMetrics = planMetrics(p);
                const pCurrency = p.currency ?? ASSET_BY_SYMBOL.get(p.symbol)?.currency ?? 'INR';
                return (
                  <article key={r.id} className="research-card space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[var(--text-primary)]">{p.symbol}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            p.direction === 'long'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {p.direction}
                        </span>
                        <span className="rounded bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] border border-[var(--border-subtle)]">
                          {p.status.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Active'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 font-mono text-xs rounded bg-[var(--bg-surface-elevated)] p-2 border border-[var(--border-subtle)]">
                      <div>
                        Entry: <strong className="text-[var(--text-primary)]">{p.entry}</strong>
                      </div>
                      <div>
                        Stop: <strong className="text-rose-400">{p.stop}</strong>
                      </div>
                      <div>
                        Target: <strong className="text-emerald-400">{p.target}</strong>
                      </div>
                      <div>
                        Qty: <strong>{p.quantity}</strong>
                      </div>
                      <div>
                        Max Loss: <strong className="text-rose-400">{pMetrics.loss.toFixed(2)} {pCurrency}</strong>
                      </div>
                      <div>
                        R:R: <strong className="text-sky-400">{pMetrics.ratio.toFixed(2)}:1</strong>
                      </div>
                    </div>

                    {p.thesis && (
                      <p className="text-xs text-[var(--text-secondary)]">
                        <strong>Thesis:</strong> {p.thesis}
                      </p>
                    )}
                    {p.evidence && (
                      <p className="text-xs text-[var(--text-muted)]">
                        <strong>Evidence:</strong> {p.evidence}
                      </p>
                    )}
                    {p.invalidation && (
                      <p className="text-xs text-rose-400/90">
                        <strong>Invalidation:</strong> {p.invalidation}
                      </p>
                    )}

                    {p.newsLinks && p.newsLinks.length > 0 && (
                      <div className="text-[11px] space-y-0.5">
                        <span className="text-[var(--text-muted)]">News links:</span>
                        {p.newsLinks.map((nl, i) => (
                          <div key={i} className="truncate">
                            <a
                              href={nl.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline text-blue-400 hover:text-blue-300"
                            >
                              • {nl.title}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        type="button"
                        className="button-secondary text-xs"
                        onClick={() => {
                          setSymbol(p.symbol);
                          setEditing(r);
                          setPlan({
                            ...p,
                            entry: String(p.entry),
                            stop: String(p.stop),
                            target: String(p.target),
                            quantity: String(p.quantity),
                            costs: String(p.costs),
                            feeBps: String(p.feeBps ?? 10),
                            slippageBps: String(p.slippageBps ?? 5),
                            evidence: p.evidence ?? '',
                            newsLinks: p.newsLinks ?? [],
                            chartSnapshot: p.chartSnapshot ?? '',
                          });
                          setBudget(p.budget ? String(p.budget) : '');
                        }}
                      >
                        Edit plan
                      </button>
                      <button
                        type="button"
                        className="button-secondary text-xs"
                        onClick={() => {
                          setSymbol(p.symbol);
                          setJournal({
                            ...journal,
                            entry: String(p.entry),
                            quantity: String(p.quantity),
                            costs: String(p.costs),
                            direction: p.direction,
                            notes: p.thesis,
                            planId: r.id,
                          });
                          setTab('Journal');
                          setEditing(null);
                        }}
                      >
                        Review in journal
                      </button>
                      {p.stop && (
                        <button
                          type="button"
                          className="button-secondary text-xs"
                          onClick={() => {
                            setSymbol(p.symbol);
                            setLevel(String(p.stop));
                            setDirection(p.direction === 'long' ? 'below' : 'above');
                            setTab('Alerts');
                          }}
                        >
                          Alert on Stop ({p.stop})
                        </button>
                      )}
                      <select
                        aria-label="Change plan status"
                        className="field text-xs py-1"
                        value={p.status}
                        onChange={(e) => {
                          const nextStatus = e.target.value as PlanStatus;
                          void act(async () => {
                            await store.save(r.id, 'plan', { ...p, status: nextStatus }, r.version);
                          });
                        }}
                      >
                        {['draft', 'watching', 'archived', 'reviewed'].map((s) => (
                          <option key={s} value={s}>
                            Status: {s}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="button-secondary text-xs"
                        onClick={() => void act(() => store.remove(r))}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}

              {!plans.length && (
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">
                    No trade plans recorded yet. Define your setup levels and risk thesis before committing to a decision.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    {tab === 'Alerts' && <div className="grid gap-4 lg:grid-cols-2"><div className="lg:col-span-2"><NewsPreferences key={store.user?.id ?? 'guest'} onNotifications={onNotifications} /></div><form className="research-card space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { const data = alertSchema.parse({ symbol, direction, level: Number(level), paused: false, expiresAt: new Date(`${expiry}T23:59:59Z`).toISOString(), timezone, quietStart, quietEnd, cooldownMinutes: cooldown }); if (Date.parse(data.expiresAt) <= Date.now()) throw new Error('Choose a future expiration.'); await store.save(editing?.id ?? crypto.randomUUID(), 'alert', data, editing?.version ?? 0); setEditing(null); }); }}><h2 className="font-semibold">Price crossing alert · {symbol}</h2>{numericField('Alert level', level, setLevel)}{numericField('Cooldown minutes', String(cooldown), v => setCooldown(Number(v)))}<select aria-label="Crossing direction" className="field" value={direction} onChange={e => setDirection(e.target.value as typeof direction)}><option value="above">Crosses above</option><option value="below">Crosses below</option></select><label className="block text-xs">Expiration (UTC date)<input className="field block" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} required /></label><label className="block text-xs">Quiet-hours timezone<input className="field w-full" value={timezone} onChange={e => setTimezone(e.target.value)} /></label><div className="flex gap-2">{numericField('Quiet start hour', String(quietStart), v => setQuietStart(Number(v)))}{numericField('Quiet end hour', String(quietEnd), v => setQuietEnd(Number(v)))}</div><p className="text-xs text-[var(--text-muted)]">Equal hours disable quiet time. A fresh baseline is established first; delayed, stale and out-of-order observations never trigger. Quiet-time crossings appear in history without a push. Checks run once a minute on the persistent backend. Cooldowns suppress repeated crossings; gaps over five minutes establish a new baseline.</p>{!store.user && <p className="text-sm">Guest rules are saved drafts. Sign in and import them to activate server evaluation.</p>}<button className="button-primary" disabled={busy}>Save alert</button><button type="button" className="button-secondary" onClick={() => void act(loadExtra)}>Refresh alert history</button></form><div className="space-y-3">{alerts.map(r => { const a = alertSchema.parse(r.data); return <article key={r.id} className="research-card"><p>{a.symbol} crosses {a.direction} {a.level} · {Date.parse(a.expiresAt) <= Date.now() ? 'Expired' : a.paused ? 'Paused' : store.user ? 'Enabled' : 'Guest draft'}</p><div className="mt-2 flex gap-2"><button className="button-secondary" onClick={() => void act(() => store.save(r.id, 'alert', { ...a, paused: !a.paused }, r.version))}>{a.paused ? 'Resume' : 'Pause'}</button><button className="button-secondary" onClick={() => { setEditing(r); setSymbol(a.symbol); setDirection(a.direction); setLevel(String(a.level)); setExpiry(a.expiresAt.slice(0, 10)); setTimezone(a.timezone); setQuietStart(a.quietStart); setQuietEnd(a.quietEnd); setCooldown(a.cooldownMinutes ?? 15); }}>Edit</button><button className="button-secondary" onClick={() => void act(() => store.remove(r))}>Delete</button></div></article>; })}<h3 className="font-semibold">Detection & delivery history</h3>{events.map(event => <p key={event.id} className="research-card text-xs">{event.symbol} · {event.price} · {event.asOf} · {event.status} · {event.delivery}. Push accepted means accepted by the push service, not confirmed on the device.</p>)}</div></div>}
    {tab === 'Journal' && <div className="space-y-4"><label className="block text-xs">Filter journal by symbol or tag<input className="field block w-full" value={journalFilter} onChange={e => setJournalFilter(e.target.value)} /></label><form className="research-card space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { const value = journalSchema.parse({ ...journal, symbol, entry: Number(journal.entry), exit: Number(journal.exit), quantity: Number(journal.quantity), costs: Number(journal.costs), openedAt: new Date(journal.openedAt).toISOString(), closedAt: new Date(journal.closedAt).toISOString() }); await store.save(editing?.id ?? crypto.randomUUID(), 'journal', value, editing?.version ?? 0); setEditing(null); }); }}><h2 className="font-semibold">Record a completed trade · manual entry</h2>{journal.planId && <p className="text-xs">Linked plan: {journal.planId}</p>}<select aria-label="Journal direction" className="field" value={journal.direction} onChange={e => setJournal({ ...journal, direction: e.target.value as 'long' | 'short' })}><option value="long">Long</option><option value="short">Short</option></select><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{(['entry', 'exit', 'quantity', 'costs'] as const).map(key => <div key={key}>{numericField(`Journal ${key}`, journal[key], value => setJournal({ ...journal, [key]: value }))}</div>)}</div><div className="flex flex-wrap gap-3">{(['openedAt', 'closedAt'] as const).map(key => <label key={key} className="text-xs">{key === 'openedAt' ? 'Entry date (UTC)' : 'Exit date (UTC)'}<input className="field block" type="date" value={journal[key]} onChange={e => setJournal({ ...journal, [key]: e.target.value })} required /></label>)}</div><label className="block text-xs">Lessons and original thesis<textarea className="field block w-full" maxLength={2000} value={journal.notes} onChange={e => setJournal({ ...journal, notes: e.target.value })} /></label><label className="block text-xs">Tags<input className="field block" maxLength={160} value={journal.tags} onChange={e => setJournal({ ...journal, tags: e.target.value })} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={journal.followedPlan} onChange={e => setJournal({ ...journal, followedPlan: e.target.checked })} />I followed my plan</label><button className="button-primary" disabled={busy}>Save journal entry</button></form><JournalAnalytics records={journals} /><div className="research-card space-y-3"><button className="button-secondary" onClick={() => { const rows = journals.map(r => journalSchema.parse(r.data)); const cell = (value: unknown) => `"${String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`; download('trading-journal.csv', ['symbol,currency,direction,openedAt,closedAt,entry,exit,quantity,costs,net,followedPlan,tags,planId,notes', ...rows.map(j => [j.symbol, ASSET_BY_SYMBOL.get(j.symbol)?.currency, j.direction, j.openedAt, j.closedAt, j.entry, j.exit, j.quantity, j.costs, journalPnl(j), j.followedPlan, j.tags, j.planId ?? '', j.notes].map(cell).join(','))].join('\n'), 'text/csv'); }}>Export CSV</button></div>{journals.map(r => { const j = journalSchema.parse(r.data); return <article key={r.id} className="research-card"><h3>{j.symbol} · Net {journalPnl(j).toFixed(2)} {ASSET_BY_SYMBOL.get(j.symbol)?.currency}</h3><p className="text-sm whitespace-pre-wrap">{j.notes}</p><div className="flex gap-2 mt-2"><button className="button-secondary" onClick={() => { setEditing(r); setSymbol(j.symbol); setJournal({ ...j, planId: j.planId ?? '', entry: String(j.entry), exit: String(j.exit), quantity: String(j.quantity), costs: String(j.costs), openedAt: j.openedAt.slice(0, 10), closedAt: j.closedAt.slice(0, 10) }); }}>Correct entry</button><button className="button-secondary" onClick={() => void act(() => store.remove(r))}>Delete</button></div></article>; })}</div>}
    {tab === 'Practice' && <div className="space-y-4"><PracticeSummary paper={paper} quotes={quotes} /><button className="button-secondary" disabled={busy || !store.user} onClick={() => void act(async () => { await loadExtra(); setOrderId(crypto.randomUUID()); })}>Refresh practice ledger</button><form className="research-card space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { await workspaceRequest('/paper', { id: orderId, symbol, quantity: Number(quantity), feeBps: Number(feeBps), slippageBps: Number(slippageBps) }); setOrderId(crypto.randomUUID()); await loadExtra(); }); }}><h2 className="font-semibold">SIMULATED practice account</h2><p className="text-sm">100,000 virtual units per currency, independently funded. Whole-unit equity/ETF long positions only. Fills use the backend’s latest fresh open-session quote, plus your slippage and fees. No limit orders, shorting or real execution.</p><div className="grid grid-cols-3 gap-2">{numericField('Practice quantity', quantity, setQuantity)}{numericField('Fees (basis points per side)', feeBps, setFeeBps)}{numericField('Slippage (basis points per side)', slippageBps, setSlippageBps)}</div><button className="button-primary" disabled={busy || !store.user}>Simulate market buy</button>{!store.user && <p className="text-sm">Sign in to use the durable practice ledger.</p>}<p className="text-xs text-[var(--text-muted)]">Simulations exclude liquidity and queue position. Results do not establish expected real-world performance.</p></form>{paper.map(p => <article className="research-card" key={p.id}><h3>SIMULATED · {p.symbol} · {p.exit === null ? 'Open' : 'Closed'}</h3><p className="text-sm">{p.quantity} units · entry {p.entry.toFixed(4)} {p.currency} · fees {p.fees.toFixed(4)} · {p.openedAt}</p>{p.exit === null ? <button className="button-secondary mt-2" disabled={busy} onClick={() => void act(async () => { await workspaceRequest(`/paper/${p.id}/close`, {}); await loadExtra(); })}>Simulate closing position</button> : <p>Net realized {((p.exit - p.entry) * p.quantity - p.fees).toFixed(2)} {p.currency}</p>}</article>)}</div>}
    {tab === 'Account' && <div className="research-card max-w-xl space-y-4"><h2 className="font-semibold">Phone & desktop workspace</h2>{!store.user ? <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { await store.auth('login', username, password); setPassword(''); }); }}><p className="text-sm">Use the same account on each device. Guest records remain local until you choose to import them.</p><label className="block text-xs">Username<input className="field block w-full" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required pattern="[a-zA-Z0-9_-]{3,40}" /></label><label className="block text-xs">Password (12+ characters)<input className="field block w-full" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={128} required /></label><div className="flex gap-2"><button className="button-primary" disabled={busy}>Sign in</button><button className="button-secondary" disabled={busy || password.length < 12} type="button" onClick={() => void act(async () => { await store.auth('register', username, password); setPassword(''); })}>Create account</button></div><p className="text-xs">Use a password manager. Automated password recovery is not available in this initial account implementation.</p></form> : <><p>Signed in as {store.user.username}</p><div className="flex flex-wrap gap-2"><button className="button-secondary" disabled={busy} onClick={() => void act(store.refresh)}>Refresh synced data</button><button className="button-secondary" disabled={busy} onClick={() => void act(store.importLocal)}>Import this browser’s guest records</button><button className="button-secondary" disabled={busy} onClick={() => void act(async () => download('research-export.json', JSON.stringify(await workspaceRequest('/export'), null, 2)))}>Export account data</button><button className="button-secondary" disabled={busy} onClick={() => void act(store.logout)}>Sign out</button></div><form className="space-y-2" onSubmit={e => { e.preventDefault(); void act(async () => { await workspaceRequest('/change-password', { current: password, next: newPassword }); setPassword(''); setNewPassword(''); await store.refresh(); }); }}><h3 className="font-medium">Change password</h3><input aria-label="Current password" className="field block w-full" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /><input aria-label="New password" className="field block w-full" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /><button disabled={busy} className="button-secondary">Update password and revoke other sessions</button></form><p className="text-xs">Signing out also removes this account’s background push subscriptions on all devices. Re-enable alerts on a device after signing in.</p><details><summary className="cursor-pointer">Delete account and all synced data</summary><p className="mt-2 text-sm">This permanently deletes plans, drawings, alerts, journal and practice records. Export first. Local guest copies remain on this browser.</p><input aria-label="Password to delete account" className="field mt-2" type="password" value={password} onChange={e => setPassword(e.target.value)} /><button className="button-secondary mt-2" disabled={busy || !password} onClick={() => void act(async () => { await workspaceRequest('/delete-account', { password }); setPassword(''); await store.refresh(); })}>Permanently delete my account</button></details></>}<p className="text-xs text-[var(--text-muted)]">Cloud sync needs a persistent backend database. Vercel-only deployments retain guest research but cannot store these account records on ephemeral function disks.</p></div>}
    </section>
  );
}

import type { Quote } from '../../shared/types';

export type PaperPosition = { id: string; symbol: string; currency: string; quantity: number; entry: number; exit: number | null; fees: number; openedAt: string; closedAt: string | null };
export default function PracticeSummary({ paper, quotes }: { paper: PaperPosition[]; quotes: Quote[] }) {
  const currencies = [...new Set(['INR', 'USD', ...paper.map(p => p.currency)])];
  return <div className="research-card space-y-3"><h3 className="font-semibold">Virtual cash & observed valuation</h3>{currencies.map(currency => {
    const positions = paper.filter(p => p.currency === currency);
    const realized = positions.filter(p => p.exit !== null).reduce((sum, p) => sum + (p.exit! - p.entry) * p.quantity - p.fees, 0);
    const open = positions.filter(p => p.exit === null);
    const cash = 100000 + realized - open.reduce((sum, p) => sum + p.entry * p.quantity + p.fees, 0);
    return <p key={currency} className="text-sm">{currency} · Available virtual cash {cash.toFixed(2)} · Realized {realized.toFixed(2)} · Open positions {open.length}</p>;
  })}{paper.filter(p => p.exit === null).map(p => {
    const quote = quotes.find(q => q.symbol === p.symbol);
    return <p key={p.id} className="text-xs text-[var(--text-secondary)]">{p.symbol}: {quote?.price != null ? `Observed unrealized ${((quote.price - p.entry) * p.quantity - p.fees).toFixed(2)} ${p.currency}, before exit costs · ${quote.status} · ${quote.asOf ?? 'time unavailable'}` : 'Valuation unavailable'}</p>;
  })}<p className="text-xs">Indicative valuation may be delayed. It does not qualify a quote for a simulated fill.</p></div>;
}

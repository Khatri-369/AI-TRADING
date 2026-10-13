import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { journalSchema, journalStatistics, type ResearchRecord } from '../../shared/research';

export default function JournalAnalytics({ records }: { records: ResearchRecord[] }) {
  const journals = records.map(r => journalSchema.parse(r.data));
  const currencies = [...new Set(journals.map(j => ASSET_BY_SYMBOL.get(j.symbol)?.currency))];
  return <div className="research-card space-y-4"><h3 className="font-semibold">Review by currency · closed entries only</h3>
    {!journals.length && <p className="text-sm">Record a completed trade to start reviewing your process.</p>}
    {currencies.map(currency => {
      const stats = journalStatistics(journals.filter(j => ASSET_BY_SYMBOL.get(j.symbol)?.currency === currency));
      const metrics = [['Net result', stats.net], ['Average win', stats.averageWin], ['Average loss', stats.averageLoss], ['Realized drawdown', stats.drawdown]] as const;
      return <section key={currency} className="space-y-2"><h4 className="font-medium">{currency} · {stats.count} entries</h4><dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">{metrics.map(([label, amount]) => <div key={label}><dt className="text-xs text-[var(--text-secondary)]">{label}</dt><dd className="font-mono text-sm">{amount === null ? '—' : amount.toFixed(2)}</dd></div>)}</dl><p className="text-sm">Win rate {stats.winRate?.toFixed(1)}% · Plan adherence {stats.adherence?.toFixed(1)}%</p><p className="text-xs text-[var(--text-muted)]">{stats.count < 10 ? 'Small sample; avoid performance conclusions.' : 'Based only on the filtered manual entries.'} Drawdown measures declines in cumulative realized results, not intratrade losses.</p></section>;
    })}
  </div>;
}

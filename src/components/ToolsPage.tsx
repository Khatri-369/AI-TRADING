import { Bell, BookOpen, ChartCandlestick, ChevronRight, ClipboardList, GraduationCap, UserRound } from 'lucide-react';

const tools = [
  { tab: 'Chart', title: 'Charts', detail: 'Study candles, draw levels and compare indicators.', icon: ChartCandlestick },
  { tab: 'Plan', title: 'Trade planner', detail: 'Define an entry, a stop and a risk budget.', icon: ClipboardList },
  { tab: 'Alerts', title: 'Price alerts', detail: 'Keep track of the levels that matter to you.', icon: Bell },
  { tab: 'Journal', title: 'Trading journal', detail: 'Review your decisions and learn from past trades.', icon: BookOpen },
  { tab: 'Practice', title: 'Paper trading', detail: 'Practice with simulated trades, without real money.', icon: GraduationCap },
  { tab: 'Account', title: 'Account & sync', detail: 'Save your watchlist and research across devices.', icon: UserRound },
];

export default function ToolsPage({ onOpen, onNotifications }: { onOpen: (path: string) => void; onNotifications: () => void }) {
  return <section className="space-y-6" aria-labelledby="tools-heading">
    <header><h1 id="tools-heading" className="text-[28px] font-semibold tracking-tight">Tools</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">Plan a trade, study a chart or review your progress.</p></header>
    <div className="grid gap-3 md:grid-cols-2">
      {tools.map(({ tab, title, detail, icon: Icon }) => <button key={tab} onClick={() => onOpen(`/desk?tab=${tab}`)} className="flex items-center gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-left hover:bg-[var(--bg-surface-hover)]">
        <Icon size={22} className="shrink-0 text-[var(--text-secondary)]" /><span className="flex-1 min-w-0"><span className="block text-base font-semibold">{title}</span><span className="block mt-1 text-sm leading-5 text-[var(--text-secondary)]">{detail}</span></span><ChevronRight size={18} className="shrink-0 text-[var(--text-muted)]" />
      </button>)}
    </div>
    <button className="button-secondary min-h-11" onClick={onNotifications}>Install app & news notifications</button>
  </section>;
}

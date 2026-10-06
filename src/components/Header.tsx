import { useEffect, useState } from 'react';
import { Globe2, Settings, Search, LayoutDashboard, TrendingUp, Coins, Cpu, Newspaper } from 'lucide-react';
import type { Tab, ThemeType } from '../types/market';
import { THEMES } from '../utils/themes';

const tabs = [
  { id: 'overview', label: 'Command Cockpit', icon: LayoutDashboard },
  { id: 'equities', label: 'Global Equities', icon: TrendingUp },
  { id: 'commodities', label: 'Metals & Forex', icon: Coins },
  { id: 'crypto', label: 'Digital Assets', icon: Cpu },
  { id: 'news', label: 'AI Signals & News', icon: Newspaper },
] as const;
interface Props { theme: ThemeType; onTheme: (theme: ThemeType) => void; search: string; onSearch: (value: string) => void; tab: Tab; onTab: (tab: Tab) => void; settingsOpen: boolean; onSettings: () => void }
export default function Header({ theme, onTheme, search, onSearch, tab, onTab, settingsOpen, onSettings }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, []);
  return <header className="border-b border-slate-800/80 bg-slate-950/95">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/20 to-purple-500/15 p-3"><Globe2 className="h-6 w-6 text-indigo-400" /></div>
        <div className="min-w-0"><h1 className="text-sm font-extrabold tracking-wide text-slate-100 sm:text-lg">GLOBAL MARKETS <span className="text-indigo-300">COMMAND CENTER</span></h1><p className="mt-1 text-xs text-slate-400">Market intelligence · source transparency · AI research</p></div>
      </div>
      <div className="hidden items-center gap-5 text-xs xl:flex">
        {[['New York', 'America/New_York'], ['Mumbai', 'Asia/Kolkata']].map(([city, timezone]) => <div key={city}><span className="block text-[10px] uppercase tracking-widest text-slate-400">{city}</span><span className="font-mono text-slate-300">{now.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'short', hour12: false })}</span></div>)}
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto">
        <label className="relative min-w-0 flex-1 lg:w-52"><span className="sr-only">Search assets and news</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={event => onSearch(event.target.value)} type="search" placeholder="Search assets or news…" className="field pl-9" /></label>
        <button className={`icon-button ${settingsOpen ? 'border-indigo-400 text-indigo-300' : ''}`} onClick={onSettings} aria-label="Provider settings" aria-expanded={settingsOpen} aria-controls="provider-settings"><Settings className="h-5 w-5" /></button>
        <label className="hidden sm:block"><span className="sr-only">Color theme</span><select className="field max-w-40" value={theme} onChange={event => onTheme(event.target.value as ThemeType)}>{Object.entries(THEMES).map(([value, item]) => <option key={value} value={value}>{item.name}</option>)}</select></label>
      </div>
    </div>
    <nav className="mx-auto max-w-[1440px] overflow-x-auto px-4 sm:px-6 lg:px-8" aria-label="Dashboard sections">
      <div role="tablist" aria-label="Market categories" className="flex w-max gap-2 pb-3 sm:gap-3">
        {tabs.map(({ id, label, icon: Icon }, index) => <button key={id} id={`tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1} onClick={() => onTab(id)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next !== null) { event.preventDefault(); onTab(tabs[next].id); document.getElementById(`tab-${tabs[next].id}`)?.focus(); }
        }} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition sm:text-sm ${tab === id ? 'border-indigo-500/40 bg-gradient-to-r from-indigo-500/20 to-purple-500/15 text-indigo-200' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
    </nav>
  </header>;
}

import { useEffect, useRef, useState } from 'react';
import { BarChart3, ChartNoAxesColumn, Star, Newspaper, Grid2X2, Sun, Moon, Menu, X, Search, Download, Settings, Info, LayoutDashboard, FlaskConical } from 'lucide-react';
import type { Tab, ThemeType } from '../types/market';

interface Props {
  theme: ThemeType; onTheme: (theme: ThemeType) => void;
  search: string; onSearch: (value: string) => void;
  tab: Tab; onNavigate: (tab: Tab) => void;
  settingsOpen: boolean; onSettings: () => void;
  loading?: boolean; secondsUntilRefresh?: number; connected?: boolean; onRefresh?: () => void;
  onOpenDisclosures?: () => void; onDesktop: () => void;
}
export const navItems = [
  { id: 'watchlist' as Tab, label: 'Watchlist', icon: Star },
  { id: 'markets' as Tab, label: 'Markets', icon: BarChart3 },
  { id: 'news' as Tab, label: 'News', icon: Newspaper },
  { id: 'tools' as Tab, label: 'Tools', icon: Grid2X2 },
];
export default function Header({ theme, onTheme, search, onSearch, tab, onNavigate, onSettings, onOpenDisclosures, onDesktop }: Props) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const go = (destination: Tab) => { setOpen(false); onNavigate(destination); };
  return <header className="app-header border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div className="mx-auto max-w-[1440px] flex items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
      <button className="flex min-h-11 items-center gap-2.5" aria-label="Tradexa home" onClick={() => go('watchlist')}>
        <ChartNoAxesColumn className="h-7 w-7 text-[var(--accent-primary)]" strokeWidth={2.5} />
        <span className="text-xl font-semibold tracking-tight">Tradexa</span>
      </button>
      <nav className="hidden md:flex gap-1" role="tablist" aria-label="Main sections">
        {navItems.map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id || id === 'tools' && tab === 'desk'} onClick={() => go(id)} className={`flex items-center gap-2 min-h-11 px-4 rounded-lg text-sm font-medium ${tab === id || id === 'tools' && tab === 'desk' ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'}`}><Icon size={17} />{label}</button>)}
      </nav>
      <div className="flex gap-1 items-center">
        <button className="icon-button !border-transparent !bg-transparent min-h-11 min-w-11" aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
        <div ref={menu} className="relative">
          <button ref={trigger} className="icon-button !border-transparent !bg-transparent min-h-11 min-w-11" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="more-navigation" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
          {open && <nav id="more-navigation" aria-label="More navigation" className="absolute right-0 top-full z-50 w-64 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-2 shadow-lg">
            <p className="px-3 py-2 text-xs text-[var(--text-muted)]">More from Tradexa</p>
            <button className="menu-item" onClick={() => go('overview')}><LayoutDashboard size={18} />Market overview</button>
            <button className="menu-item" onClick={() => go('scenarios')}><FlaskConical size={18} />Scenarios</button>
            <button className="menu-item" onClick={() => { setOpen(false); onDesktop(); }} aria-label="Desktop app and news alerts"><Download size={18} />Install app & notifications</button>
            <button className="menu-item" onClick={() => { setOpen(false); onSettings(); }} aria-label="Provider settings"><Settings size={18} />Data & settings</button>
            <button className="menu-item" onClick={() => { setOpen(false); onOpenDisclosures?.(); }} aria-label="Data sources and legal disclosures"><Info size={18} />About the data</button>
          </nav>}
        </div>
      </div>
    </div>
    {(tab === 'markets' || tab === 'news') && <div className="mx-auto max-w-[1440px] px-4 pb-3 sm:px-6 lg:px-8"><label className="relative block max-w-xl"><Search size={18} className="absolute left-3 top-3.5 text-[var(--text-muted)]" /><input aria-label={tab === 'news' ? 'Search news' : 'Search markets'} type="search" className="field min-h-11 w-full !pl-10" value={search} onChange={e => onSearch(e.target.value)} placeholder={tab === 'news' ? 'Search headlines or companies' : 'Search stocks, indices and more'} /></label></div>}
  </header>;
}

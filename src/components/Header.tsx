import { useEffect, useRef, useState } from 'react';
import { ChartNoAxesCombined, Settings, Search, LayoutDashboard, BarChart3, Newspaper, FlaskConical, Sun, Moon, Menu, X, RefreshCw, Info, Download, Star } from 'lucide-react';
import type { NewsArticle, Quote, Tab, ThemeType } from '../types/market';
import NewsAlerts from './NewsAlerts';
import { ASSET_BY_SYMBOL } from '../../shared/assets';

interface Props {
  theme: ThemeType; onTheme: (theme: ThemeType) => void;
  search: string; onSearch: (value: string) => void;
  tab: Tab; onNavigate: (tab: Tab) => void;
  settingsOpen: boolean; onSettings: () => void;
  loading?: boolean; secondsUntilRefresh?: number; connected?: boolean; onRefresh?: () => void;
  onOpenDisclosures?: () => void; onDesktop: () => void;
  newsArticles?: NewsArticle[]; quotes?: Quote[]; onSelectAsset?: (quote: Quote) => void;
}
export const navItems = [
  { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
  { id: 'markets' as Tab, label: 'Markets', icon: BarChart3 },
  { id: 'watchlist' as Tab, label: 'Watchlist', icon: Star },
  { id: 'desk' as Tab, label: 'Research Desk', icon: ChartNoAxesCombined },
  { id: 'news' as Tab, label: 'News & Sentiment', icon: Newspaper },
  { id: 'scenarios' as Tab, label: 'Scenarios', icon: FlaskConical },
  { id: 'diagnostics' as Tab, label: 'Diagnostics', icon: Settings },
];
export default function Header({ theme, onTheme, search, onSearch, tab, onNavigate, settingsOpen, onSettings, loading = false, secondsUntilRefresh = 60, connected = false, onRefresh, onOpenDisclosures, onDesktop, newsArticles = [], quotes = [], onSelectAsset }: Props) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault(); searchInput.current?.focus();
    };
    document.addEventListener('keydown', focusSearch);
    return () => document.removeEventListener('keydown', focusSearch);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  const go = (page: Tab) => { setOpen(false); onNavigate(page); };
  return <header className="studio-header">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div className="studio-topbar">
      <button className="studio-brand" aria-label="Tradexa Global Markets Research" onClick={() => go('overview')}><span className="studio-mark"><ChartNoAxesCombined size={23} strokeWidth={2} /></span><span>tradexa<span className="studio-brand-dot">.</span></span></button>
      <label className="studio-search"><Search size={18} /><input ref={searchInput} type="search" aria-label="Search instruments and news" value={search} onChange={e => onSearch(e.target.value)} placeholder={tab === 'news' ? 'Search market headlines' : `Search ${ASSET_BY_SYMBOL.size} instruments`} /><kbd>/</kbd></label>
      <div className="studio-actions">
        <button className="studio-sync" disabled={loading} onClick={onRefresh} aria-label={`Telemetry auto-syncs every minute (${secondsUntilRefresh}s left). Click to refresh.`}><span className={`studio-dot ${connected ? 'is-connected' : ''}`} /><span>{loading ? 'Updating' : connected ? 'Connected' : 'Auto refresh'}</span><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        <NewsAlerts newsArticles={newsArticles} quotes={quotes} onSelectAsset={onSelectAsset} onOpenNews={() => go('news')} onOpenBackgroundSetup={onDesktop} />
        <button className="icon-button studio-icon" aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`} onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
        <button className="icon-button studio-desktop-action" aria-label="Desktop app and news alerts" onClick={onDesktop}><Download size={18} /></button>
        <button className="icon-button studio-desktop-action" aria-label="Data sources and legal disclosures" onClick={onOpenDisclosures}><Info size={18} /></button>
        <button className="icon-button studio-desktop-action" aria-label="Provider settings" aria-pressed={settingsOpen} onClick={onSettings}><Settings size={18} /></button>
        <div ref={menu} className="relative studio-more"><button ref={trigger} className="icon-button studio-icon" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
          {open && <nav className="studio-menu" aria-label="Mobile primary navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)}><Icon size={18} />{label}</button>)}<button onClick={() => { setOpen(false); onDesktop(); }}><Download size={18} />Install app & alerts</button><button onClick={() => { setOpen(false); onOpenDisclosures?.(); }}><Info size={18} />About the data</button><button onClick={() => { setOpen(false); onSettings(); }}><Settings size={18} />Provider settings</button></nav>}
        </div>
      </div>
    </div>
    <nav className="studio-navigation" aria-label="Primary navigation"><div role="tablist" aria-label="Main sections">{navItems.map(({ id, label, icon: Icon }) => <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} onClick={() => go(id)}><Icon size={17} />{label}</button>)}</div><span className="studio-workspace-label">YOUR RESEARCH WORKSPACE</span></nav>
  </header>;
}

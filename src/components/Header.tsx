import { useEffect, useState } from 'react';
import {
  Settings,
  Search,
  LayoutDashboard,
  BarChart3,
  Newspaper,
  FlaskConical,
  Sun,
  Moon,
  Menu,
  X,
  ShieldCheck,
  Loader2,
  RefreshCw,
  Info,
  Download,
  Star,
} from 'lucide-react';
import type { Tab, ThemeType } from '../types/market';
import { THEMES } from '../utils/themes';
import { usePwaInstall } from '../hooks/usePwaInstall';

interface Props {
  theme: ThemeType;
  onTheme: (theme: ThemeType) => void;
  search: string;
  onSearch: (value: string) => void;
  tab: Tab;
  onNavigate: (tab: Tab) => void;
  settingsOpen: boolean;
  onSettings: () => void;
  loading?: boolean;
  secondsUntilRefresh?: number;
  connected?: boolean;
  onRefresh?: () => void;
  onOpenDisclosures?: () => void;
  onDesktop: () => void;
}

export const navItems = [
  { id: 'overview' as Tab, label: 'Overview', path: '/', icon: LayoutDashboard },
  { id: 'markets' as Tab, label: 'Markets', path: '/markets', icon: BarChart3 },
  { id: 'watchlist' as Tab, label: 'Watchlist', path: '/watchlist', icon: Star },
  { id: 'desk' as Tab, label: 'Research Desk', path: '/desk', icon: BarChart3 },
  { id: 'news' as Tab, label: 'News & AI', path: '/news', icon: Newspaper },
  { id: 'scenarios' as Tab, label: 'Scenarios', path: '/scenarios', icon: FlaskConical },
];

export default function Header({
  theme,
  onTheme,
  search,
  onSearch,
  tab,
  onNavigate,
  settingsOpen,
  onSettings,
  loading = false,
  secondsUntilRefresh = 60,
  connected = false,
  onRefresh,
  onOpenDisclosures,
  onDesktop,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clocksOpen, setClocksOpen] = useState(false);
  const { canInstall, isInstalled, triggerInstall } = usePwaInstall();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    onTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const timeZones = [
    { name: 'Mumbai (NSE/BSE)', tz: 'Asia/Kolkata', flag: '🇮🇳' },
    { name: 'New York (NYSE)', tz: 'America/New_York', flag: '🇺🇸' },
    { name: 'London (LSE)', tz: 'Europe/London', flag: '🇬🇧' },
  ];

  return (
    <header className="relative border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] select-none">
      {/* Top Global Active Progress Bar */}
      {loading && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] animate-pulse z-50"
          role="progressbar"
          aria-label="Updating market telemetry"
        />
      )}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Main Top Bar */}
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-8">
        {/* Brand / Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              onNavigate('overview');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2.5 text-left transition hover:opacity-90"
            aria-label="Tradexa Global Markets Research"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20 text-white font-bold text-sm">
              T
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-surface)]" />
            </div>
            <div>
              <span className="block text-sm sm:text-base font-bold tracking-tight text-[var(--text-primary)]">
                Tradexa
              </span>
              <span className="hidden sm:block text-[10px] text-[var(--text-muted)] font-medium -mt-0.5">
                AI Trading & Market Intelligence
              </span>
            </div>
          </button>
        </div>

        {/* Search Bar - Center / Expanded */}
        <div className="hidden sm:block flex-1 max-w-md mx-2">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              type="search"
              role="searchbox"
              placeholder="Search 42 instruments (NIFTY, BTC, AAPL, Gold)..."
              className="field h-9 pl-9 pr-3 text-xs w-full rounded-xl bg-[var(--bg-subtle)] border-[var(--border-subtle)] focus:border-[var(--accent-primary)] transition"
            />
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Collapsible Market Clocks Dropdown */}
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setClocksOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition"
              title="View global market trading hours"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[11px] font-medium">
                {now.toLocaleTimeString('en-US', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}{' '}
                IST
              </span>
            </button>

            {clocksOpen && (
              <div
                className="absolute right-0 mt-1.5 w-60 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
                onMouseLeave={() => setClocksOpen(false)}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Global Trading Clocks
                </div>
                <div className="space-y-2">
                  {timeZones.map((tz) => (
                    <div key={tz.name} className="flex items-center justify-between text-xs py-0.5">
                      <span className="text-[var(--text-secondary)] flex items-center gap-1.5">
                        <span>{tz.flag}</span>
                        <span>{tz.name}</span>
                      </span>
                      <span className="font-mono font-semibold text-[var(--text-primary)]">
                        {now.toLocaleTimeString('en-US', {
                          timeZone: tz.tz,
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Sync Status & Manual Refresh Pill */}
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)] transition"
            title={`Telemetry auto-syncs every minute (${secondsUntilRefresh}s left). Click to refresh.`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--accent-primary)]'
              }`}
            />
            <span className="font-mono text-[11px] font-medium hidden xs:inline">
              {loading ? 'Syncing...' : `Live ${secondsUntilRefresh}s`}
            </span>
            <RefreshCw className={`h-3 w-3 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Theme Switcher Toggle */}
          <button
            type="button"
            className="icon-button h-8 w-8 sm:h-9 sm:w-9 rounded-lg"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Settings / Diagnostics Button */}
          <button
            type="button"
            className={`icon-button h-8 w-8 sm:h-9 sm:w-9 rounded-lg ${
              settingsOpen || tab === 'diagnostics'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : ''
            }`}
            onClick={onSettings}
            aria-label="Settings"
            title="API Keys, Diagnostics & Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="icon-button h-8 w-8 sm:h-9 sm:w-9 rounded-lg md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Search Row (visible on small mobile screens) */}
      <div className="block sm:hidden px-3 pb-2.5">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            type="search"
            role="searchbox"
            placeholder="Search assets (NIFTY, BTC, Apple)..."
            className="field h-8 pl-8 pr-3 text-xs w-full rounded-lg bg-[var(--bg-subtle)] border-[var(--border-subtle)]"
          />
        </div>
      </div>

      {/* Desktop Navigation Shell */}
      <nav
        className="hidden border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 sm:px-6 lg:px-8 md:block"
        aria-label="Primary navigation"
      >
        <div className="mx-auto flex flex-wrap max-w-[1440px] items-center gap-1 py-1.5" role="tablist" aria-label="Main sections">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={active}
                aria-controls={`panel-${id}`}
                tabIndex={0}
                onClick={() => onNavigate(id)}
                className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] shadow-sm border border-[var(--border-default)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] border border-transparent'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 md:hidden"
          aria-label="Mobile primary navigation"
        >
          <div className="flex flex-col gap-1">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onNavigate(id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-xs font-semibold text-left transition ${
                    active
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-bold'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {canInstall && !isInstalled && (
            <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void triggerInstall();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <Download className="h-4 w-4" />
                <span>Install Tradexa on Android</span>
              </button>
            </div>
          )}

          <div className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-muted)]">
            <div className="flex justify-between py-1">
              <span>New York (NYSE)</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {now.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Mumbai (NSE/BSE)</span>
              <span className="font-mono text-[var(--text-secondary)]">
                {now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

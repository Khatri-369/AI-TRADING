import { useEffect, useState } from 'react';
import {
  TrendingUp,
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
  { id: 'desk' as Tab, label: 'Research desk', path: '/desk', icon: BarChart3 },
  { id: 'news' as Tab, label: 'News & Sentiment', path: '/news', icon: Newspaper },
  { id: 'scenarios' as Tab, label: 'Scenarios', path: '/scenarios', icon: FlaskConical },
  { id: 'diagnostics' as Tab, label: 'Diagnostics', path: '/diagnostics', icon: ShieldCheck },
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

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    onTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="relative border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
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
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 sm:px-6 lg:px-8">
        {/* Brand / Title */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => {
              onNavigate('overview');
              setMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 text-left transition hover:opacity-85"
            aria-label="Financial Market Research Overview"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-subtle)] text-[var(--accent-primary)]">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold tracking-tight text-[var(--text-primary)] sm:text-base max-w-[145px] sm:max-w-none">
                Global Markets Research
              </span>
              <span className="hidden text-[11px] text-[var(--text-muted)] sm:block">
                Verified multi-asset data · source transparency
              </span>
            </div>
          </button>
        </div>

        {/* Global Financial Clocks */}
        <div className="hidden items-center gap-5 text-xs lg:flex" aria-label="Global market time zones">
          {[
            ['New York (NYSE)', 'America/New_York'],
            ['Mumbai (NSE/BSE)', 'Asia/Kolkata'],
            ['London (GMT)', 'Europe/London'],
          ].map(([city, timezone]) => (
            <div key={city} className="border-l border-[var(--border-subtle)] pl-4">
              <span className="block text-[10px] font-medium tracking-wide text-[var(--text-muted)]">
                {city}
              </span>
              <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">
                {now.toLocaleTimeString('en-US', {
                  timeZone: timezone,
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                  hour12: false,
                })}
              </span>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button className="icon-button h-8 w-8" onClick={onDesktop} aria-label="Desktop app and news alerts" title="Install app & news alerts"><Download size={17} /></button>
          {/* Live Sync Status & Countdown Timer Pill */}
          <div className="flex items-center">
            {loading ? (
              <div
                className="flex items-center gap-1.5 rounded-full border border-[var(--accent-border)] bg-[var(--accent-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-text)]"
                title="Telemetry refresh in flight…"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-primary)]" />
                <span className="text-[11px] font-semibold">Updating…</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onRefresh}
                className="group flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-border)] hover:text-[var(--text-primary)] transition"
                title={`Next market sync in ${secondsUntilRefresh}s. Click to refresh now.`}
                aria-label={`Next sync in ${secondsUntilRefresh} seconds. Click to refresh.`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--accent-primary)]'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums text-[11px] font-medium">
                  Sync: {secondsUntilRefresh}s
                </span>
                <RefreshCw className="h-3 w-3 text-[var(--text-muted)] group-hover:rotate-180 transition duration-300" />
              </button>
            )}
          </div>

          {/* Theme Switcher Toggle */}
          <button
            type="button"
            className="icon-button h-8 w-8 sm:h-9 sm:w-9 p-1.5"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
            title={`Current: ${THEMES[theme].name}. Click to switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Data Sources, Methodology & Legal Disclosures Button */}
          {onOpenDisclosures && (
            <button
              type="button"
              className="icon-button h-8 w-8 sm:h-9 sm:w-9 p-1.5"
              onClick={onOpenDisclosures}
              aria-label="Data sources and legal disclosures"
              title="Data sources, exchange attribution, delay explanation & legal disclosures"
            >
              <Info className="h-4 w-4" />
            </button>
          )}

          {/* Provider Settings / Diagnostics Button */}
          <button
            type="button"
            className={`icon-button h-8 w-8 sm:h-9 sm:w-9 p-1.5 ${
              settingsOpen || tab === 'diagnostics'
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : ''
            }`}
            onClick={onSettings}
            aria-label="Provider settings"
            aria-expanded={settingsOpen || tab === 'diagnostics'}
            aria-controls="provider-settings"
            title="System health, access quota and operator diagnostics"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="icon-button h-8 w-8 sm:h-9 sm:w-9 p-1.5 md:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Honest Search Input (wrapped on mobile, regular width on desktop) */}
        <div className="w-full sm:w-48 lg:w-64 order-last sm:order-none">
          <div className="relative w-full">
            <span className="sr-only">Search 42 tracked instruments and news</span>
            <Search className="pointer-events-none absolute left-3 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              type="search"
              role="searchbox"
              placeholder="Search 42 assets or news…"
              className="field h-8 sm:h-9 pl-8 sm:pl-9 pr-3 text-xs w-full"
              title="Search across 42 tracked instruments (US, India, Crypto, Metals, FX) and news"
            />
          </div>
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

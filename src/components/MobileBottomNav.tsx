import {
  LayoutDashboard,
  BarChart3,
  Star,
  Newspaper,
  FlaskConical,
} from 'lucide-react';
import type { Tab } from '../types/market';

interface Props {
  currentTab: Tab;
  onNavigate: (tab: Tab) => void;
}

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: BarChart3 },
  { id: 'watchlist', label: 'Watchlist', icon: Star },
  { id: 'news', label: 'News', icon: Newspaper },
  { id: 'desk', label: 'Desk', icon: FlaskConical },
];

export default function MobileBottomNav({ currentTab, onNavigate }: Props) {
  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-1.5 py-1 backdrop-blur-xl md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.35)]"
    >
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = currentTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-selected={isActive}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-1 transition active:scale-95 min-h-[44px] ${
              isActive
                ? 'text-[var(--accent-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                isActive
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)] shadow-sm'
                  : ''
              }`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[10px] leading-tight tracking-tight">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

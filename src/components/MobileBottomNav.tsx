import { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  Star,
  Newspaper,
  MoreHorizontal,
  Layers,
  Settings,
  Info,
  X,
} from 'lucide-react';
import type { Tab } from '../types/market';

interface Props {
  currentTab: Tab;
  onNavigate: (tab: Tab) => void;
  onOpenDisclosures?: () => void;
}

export default function MobileBottomNav({ currentTab, onNavigate, onOpenDisclosures }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [moreOpen]);

  const primaryTabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'watchlist', label: 'Watchlist', icon: Star },
    { id: 'desk', label: 'Chart', icon: BarChart3 },
    { id: 'news', label: 'News', icon: Newspaper },
  ];

  const isMoreActive = ['markets', 'diagnostics'].includes(currentTab);

  return (
    <>
      {/* Secondary Bottom Sheet for 'More' */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden flex flex-col justify-end">
          <div
            ref={sheetRef}
            className="rounded-t-2xl border-t border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-2xl space-y-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                More Features & Tools
              </span>
              <button
                type="button"
                className="icon-button min-h-[44px] min-w-[44px]"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onNavigate('markets');
                }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition min-h-[44px] ${
                  currentTab === 'markets'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Layers className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Markets Directory</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  onNavigate('diagnostics');
                }}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left text-xs font-semibold transition min-h-[44px] ${
                  currentTab === 'diagnostics'
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <Settings className="h-4 w-4 text-[var(--accent-primary)]" />
                <span>Settings & Diagnostics</span>
              </button>

              {onOpenDisclosures && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenDisclosures();
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition min-h-[44px]"
                >
                  <Info className="h-4 w-4 text-[var(--accent-primary)]" />
                  <span>Data Attribution</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main 5-Item Bottom Bar */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1 py-1 md:hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-lg"
      >
        {primaryTabs.map(({ id, label, icon: Icon }) => {
          const isActive = currentTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onNavigate(id);
              }}
              aria-selected={isActive}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-1 transition min-h-[44px] ${
                isActive
                  ? 'text-[var(--accent-primary)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${
                  isActive ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' : ''
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-[10px] leading-tight tracking-tight">{label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-label="More options"
          className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 px-1 transition min-h-[44px] ${
            isMoreActive || moreOpen
              ? 'text-[var(--accent-primary)] font-semibold'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-lg transition ${
              isMoreActive || moreOpen ? 'bg-[var(--accent-subtle)] text-[var(--accent-primary)]' : ''
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </div>
          <span className="text-[10px] leading-tight tracking-tight">More</span>
        </button>
      </nav>
    </>
  );
}

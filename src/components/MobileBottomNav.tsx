import type { Tab } from '../types/market';
import { navItems } from './Header';
export default function MobileBottomNav({ currentTab, onNavigate }: { currentTab: Tab; onNavigate: (tab: Tab) => void }) {
  return <nav aria-label="Mobile bottom navigation" className="mobile-bottom-nav fixed bottom-0 inset-x-0 z-40 grid grid-cols-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] md:hidden">
    {navItems.map(({ id, label, icon: Icon }) => {
      const active = currentTab === id || id === 'tools' && ['desk', 'overview', 'scenarios', 'diagnostics'].includes(currentTab);
      return <button key={id} type="button" aria-current={active ? 'page' : undefined} onClick={() => onNavigate(id)} className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}><Icon size={21} strokeWidth={active ? 2.3 : 1.7} /><span>{label}</span></button>;
    })}
  </nav>;
}

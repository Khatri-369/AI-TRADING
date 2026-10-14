import { useEffect, useState } from 'react';
import type { Tab } from '../types/market';

export interface RouteState {
  page: Tab;
  symbol: string | null;
  path: string;
}

export function parseRoute(pathname: string): RouteState {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/watchlist') return { page: 'watchlist', symbol: null, path: clean };
  if (clean === '/tools') return { page: 'tools', symbol: null, path: clean };
  if (clean === '/desk') return { page: 'desk', symbol: null, path: clean };
  if (clean.startsWith('/asset/')) {
    const raw = clean.slice('/asset/'.length);
    const symbol = decodeURIComponent(raw).trim();
    return { page: 'markets', symbol: symbol || null, path: clean };
  }
  if (clean === '/markets') {
    return { page: 'markets', symbol: null, path: clean };
  }
  if (clean === '/news') {
    return { page: 'news', symbol: null, path: clean };
  }
  if (clean === '/scenarios') {
    return { page: 'scenarios', symbol: null, path: clean };
  }
  if (clean === '/diagnostics') {
    return { page: 'diagnostics', symbol: null, path: clean };
  }
  // Keep the overview as a secondary destination; unknown paths return home.
  return { page: clean === '/overview' ? 'overview' : 'watchlist', symbol: null, path: clean === '/overview' ? '/overview' : '/' };
}

export function navigate(to: string, { replace = false }: { replace?: boolean } = {}) {
  if (replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}

export function useRouter(): [RouteState, (to: string, options?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<RouteState>(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => {
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [route, navigate];
}

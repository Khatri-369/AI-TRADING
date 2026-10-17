export function isIndexInstrument(symbol?: string, sector?: string, currency?: string): boolean {
  if (currency === 'POINTS') return true;
  if (sector?.toLowerCase() === 'index') return true;
  if (symbol && ['NIFTY50', 'BANKNIFTY', 'SENSEX'].includes(symbol.toUpperCase())) return true;
  return false;
}

export function formatPrice(value: number | null, currency: string, isIndex = false) {
  if (value === null || !Number.isFinite(value)) return 'Unavailable';
  if (isIndex || currency === 'POINTS') {
    return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)} pts`;
  }
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
}

export const formatPercent = (value: number | null, fallback = '0.00%') =>
  value === null ? fallback : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

export const formatChange = (value: number | null, currency = 'USD', isIndex = false) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  const abs = Math.abs(value);
  const formatted = abs >= 1 ? abs.toFixed(2) : abs.toFixed(4);
  if (isIndex || currency === 'POINTS') {
    return `${prefix}${value < 0 ? '-' : ''}${formatted} pts`;
  }
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '';
  return `${prefix}${value < 0 ? '-' : ''}${symbol}${formatted}`;
};

export const changeClass = (value: number | null) =>
  value === null || value === 0
    ? 'text-slate-500 dark:text-slate-400'
    : value > 0
    ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
    : 'text-rose-700 dark:text-rose-400 font-semibold';

export function formatTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Not reported';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

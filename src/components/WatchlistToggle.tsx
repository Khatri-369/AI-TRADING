import { useState } from 'react';
import { Star } from 'lucide-react';
import { useWatchlist } from '../hooks/useWatchlist';

interface Props {
  symbol: string;
  size?: number;
  className?: string;
  compact?: boolean;
}

export default function WatchlistToggle({
  symbol,
  size = 18,
  className = '',
  compact = false,
}: Props) {
  const { isSaved, toggle, saving, error } = useWatchlist();
  const saved = isSaved(symbol);
  const [localError, setLocalError] = useState('');

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalError('');
    try {
      await toggle(symbol);
    } catch {
      setLocalError('Could not save.');
    }
  };

  return (
    <div className={`inline-flex items-center shrink-0 ${className}`}>
      <button
        type="button"
        aria-label={`${saved ? 'Remove' : 'Save'} ${symbol} ${saved ? 'from' : 'to'} watchlist`}
        aria-pressed={saved}
        disabled={saving}
        onClick={handleToggle}
        className={`inline-flex items-center justify-center rounded-lg border transition cursor-pointer ${
          compact
            ? 'p-1.5 border-transparent text-[var(--text-muted)] hover:text-amber-400'
            : 'min-h-[44px] min-w-[44px] p-2 border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
        }`}
      >
        <Star
          size={size}
          className={`transition ${
            saved
              ? 'fill-amber-400 text-amber-400'
              : 'text-[var(--text-muted)] hover:text-amber-400'
          }`}
        />
      </button>
      {(localError || error) && (
        <span role="alert" className="sr-only">
          {localError || error}
        </span>
      )}
    </div>
  );
}

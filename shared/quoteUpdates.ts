import { ASSET_BY_SYMBOL } from './assets';
import type { Quote } from './types';

function observationTime(quote: Quote): number {
  return Date.parse(quote.asOf ?? '');
}

/** Reject malformed, unknown and out-of-order stream observations before storing them. */
export function acceptQuoteUpdate(next: Quote, previous?: Quote, now = Date.now()): boolean {
  const asset = ASSET_BY_SYMBOL.get(next.symbol);
  const observed = observationTime(next);
  const received = Date.parse(next.fetchedAt ?? '');
  if (!asset || asset.category !== next.category || asset.currency !== next.currency ||
      next.price === null || !Number.isFinite(next.price) || next.price <= 0 ||
      !Number.isFinite(observed) || !Number.isFinite(received) ||
      observed > now + 60_000 || received > now + 60_000 || next.status === 'unavailable') return false;
  if (!previous) return true;
  const prior = observationTime(previous);
  return !Number.isFinite(prior) || observed > prior ||
    (observed === prior && received > Date.parse(previous.fetchedAt ?? ''));
}

/** Observation time determines freshness; a later HTTP receipt must not hide a newer tick. */
export function mergeQuoteUpdate(rest: Quote, tick: Quote | undefined, now = Date.now()): Quote {
  if (!tick || tick.symbol !== rest.symbol || !acceptQuoteUpdate(tick, undefined, now) ||
      now - Date.parse(tick.fetchedAt!) > 60_000) return rest;
  const observed = observationTime(tick);
  const prior = observationTime(rest);
  if (Number.isFinite(prior) && (observed < prior ||
      (observed === prior && Date.parse(tick.fetchedAt!) <= Date.parse(rest.fetchedAt ?? '')))) return rest;
  return {
    ...tick,
    // Different providers can report different volume units (base units vs quote currency).
    volume: tick.volume ?? (tick.provider === rest.provider ? rest.volume : null),
    session: rest.session.state === 'UNKNOWN' ? tick.session : rest.session,
  };
}

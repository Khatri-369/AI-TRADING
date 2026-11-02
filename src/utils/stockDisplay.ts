import { ASSET_BY_SYMBOL } from '../../shared/assets';
import { EXPANDED_STOCK_ALIASES } from '../../shared/newsSentiment';
import type { Quote } from '../types/market';
import { formatPrice, formatPercent } from './format';

export interface StockBadgeData {
  symbol: string;
  name: string;
  priceFormatted: string | null;
  changePercentFormatted: string | null;
  isGain: boolean;
  hasChange: boolean;
  hasPrice: boolean;
  currency: string;
}

export function getStockDisplayName(symbol: string): string {
  if (!symbol) return '';
  const clean = symbol.trim().toUpperCase();
  const asset = ASSET_BY_SYMBOL.get(clean);
  if (asset?.name) return asset.name;
  const aliases = EXPANDED_STOCK_ALIASES[clean];
  if (aliases && aliases.length > 0) return aliases[0];
  const base = clean.replace(/\.(BSE|NSE)$/, '');
  const baseAsset = ASSET_BY_SYMBOL.get(base);
  if (baseAsset?.name) return baseAsset.name;
  if (EXPANDED_STOCK_ALIASES[base]?.[0]) return EXPANDED_STOCK_ALIASES[base][0];
  return clean;
}

export function getStockBadgeData(symbol: string, quote?: Quote | null): StockBadgeData {
  const cleanSymbol = symbol.trim().toUpperCase();
  const name = getStockDisplayName(cleanSymbol);
  const isIndian =
    cleanSymbol.endsWith('.BSE') ||
    cleanSymbol === 'NIFTY50' ||
    cleanSymbol === 'SENSEX' ||
    cleanSymbol === 'BANKNIFTY' ||
    Boolean(ASSET_BY_SYMBOL.get(cleanSymbol)?.category === 'india') ||
    Boolean(EXPANDED_STOCK_ALIASES[cleanSymbol]);

  const currency = quote?.currency || (isIndian ? 'INR' : 'USD');
  const isIndex = cleanSymbol === 'NIFTY50' || cleanSymbol === 'SENSEX' || cleanSymbol === 'BANKNIFTY';

  const hasPrice = typeof quote?.price === 'number' && Number.isFinite(quote.price) && quote.price > 0;
  const priceFormatted = hasPrice ? formatPrice(quote!.price, currency, isIndex) : null;

  const hasChange = typeof quote?.changePercent === 'number' && Number.isFinite(quote.changePercent);
  const isGain = (quote?.changePercent ?? 0) >= 0;
  const changePercentFormatted = hasChange ? formatPercent(quote!.changePercent) : null;

  return {
    symbol: cleanSymbol,
    name,
    priceFormatted,
    changePercentFormatted,
    isGain,
    hasChange,
    hasPrice,
    currency,
  };
}


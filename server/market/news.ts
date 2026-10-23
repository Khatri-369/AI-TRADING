import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { ASSETS, ASSET_BY_SYMBOL } from '../../shared/assets';
import type { NewsArticle } from '../../shared/types';
import { fetchBytes, validTime, type Fetcher } from './http';
import { extractStockEntities, analyzeHeadlineSentiment } from '../../shared/newsSentiment';
import { ipoHeadlineContext } from '../../shared/newsNotification';

const aliases: Record<string, string[]> = {
  // Indian Equities & Benchmarks
  RELIANCE: ['Reliance Industries', 'Reliance Jio', 'Reliance Retail'],
  TCS: ['Tata Consultancy Services', 'TCS'],
  HDFCBANK: ['HDFC Bank'],
  INFY: ['Infosys'],
  ICICIBANK: ['ICICI Bank'],
  SBIN: ['State Bank of India', 'SBI'],
  BHARTIARTL: ['Bharti Airtel', 'Airtel'],
  LT: ['Larsen & Toubro', 'Larsen and Toubro', 'L&T'],
  'M&M': ['Mahindra & Mahindra', 'Mahindra and Mahindra', 'Mahindra Motors'],
  HCLTECH: ['HCL Technologies', 'HCLTech'],
  SUNPHARMA: ['Sun Pharma', 'Sun Pharmaceutical'],
  BANKNIFTY: ['Bank Nifty', 'Nifty Bank'],
  NIFTY50: ['Nifty 50', 'Nifty'],
  SENSEX: ['Sensex', 'BSE Sensex', 'BSE 30'],
  TATAMOTORS: ['Tata Motors'],
  HINDUNILVR: ['Hindustan Unilever', 'HUL'],
  ITC: ['ITC Ltd'],
  BAJFINANCE: ['Bajaj Finance', 'Bajaj Finserv'],
  LICI: ['Life Insurance Corporation', 'LIC of India'],
  TITAN: ['Titan Company', 'Titan'],
  ULTRACEMCO: ['UltraTech Cement', 'UltraTech'],
  POWERGRID: ['Power Grid Corporation', 'Power Grid', 'PowerGrid'],
  NTPC: ['NTPC Ltd'],

  // US Equities & Benchmarks
  SPY: ['S&P 500', 'S&P500', 'SP500', 'Wall Street', 'S&P index'],
  QQQ: ['Nasdaq', 'Nasdaq 100', 'Invesco QQQ'],
  AAPL: ['Apple', 'Apple Inc', 'iPhone', 'iPad'],
  MSFT: ['Microsoft', 'Windows', 'Azure'],
  NVDA: ['Nvidia', 'NVIDIA', 'GeForce', 'Blackwell'],
  TSLA: ['Tesla', 'Elon Musk', 'Tesla Motors'],
  AMZN: ['Amazon', 'Amazon.com', 'AWS'],
  GOOGL: ['Alphabet', 'Google'],
  META: ['Meta Platforms', 'Facebook', 'Instagram'],

  // Digital Assets & Crypto
  BTC: ['Bitcoin', 'BTC'],
  ETH: ['Ethereum', 'Ether'],
  SOL: ['Solana'],
  BNB: ['Binance Coin', 'Binance'],
  XRP: ['Ripple', 'XRP'],

  // Commodities & Precious Metals
  XAU: ['Gold', 'Spot Gold', 'Gold prices', 'Gold price', 'Bullion'],
  XAG: ['Silver', 'Spot Silver', 'Silver prices', 'Silver price'],

  // Forex & Currency
  'USD/INR': ['USD/INR', 'USD-INR', 'USDINR', 'Indian Rupee', 'Rupee', 'Dollar-Rupee'],
};
const escaped = (value: string) => [...value].map(character => '\\^$.*+?()[]{}|'.includes(character) ? `\\${character}` : character).join('');
function mentions(text: string, value: string, insensitive = true) {
  return new RegExp(`(^|[^a-zA-Z0-9])${escaped(value)}(?=$|[^a-zA-Z0-9])`, insensitive ? 'i' : '').test(text);
}
export function enrichNews(article: NewsArticle, region: 'india' | 'global'): NewsArticle {
  const text = `${article.headline} ${article.summary}`;
  const links: NonNullable<NewsArticle['stockLinks']> = [];
  for (const supplied of article.relatedAssets) {
    const symbol = supplied.trim().toUpperCase();
    if (ASSET_BY_SYMBOL.has(symbol)) links.push({ symbol, basis: 'provider', evidence: 'Linked by the news provider' });
  }
  for (const asset of ASSETS) {
    if (asset.symbol.endsWith('.BSE') || links.some(link => link.symbol === asset.symbol)) continue;
    const names = aliases[asset.symbol] ?? (asset.name.length > 3 ? [asset.name] : []);
    const matched = names.find(name => mentions(text, name));
    // Short symbols (IT, LT, SOL, META, etc.) must not match ordinary words.
    const tickerMatch = mentions(text, `$${asset.symbol}`, false) ||
      (asset.symbol.length >= 3 && !['META', 'SOL', 'XAU', 'XAG', 'BNB'].includes(asset.symbol) && mentions(text, asset.symbol, false));
    if (matched || tickerMatch) links.push({ symbol: asset.symbol, basis: 'mention', evidence: `Mentioned in headline or summary: ${matched ?? asset.symbol}` });
  }

  // Stock identification for companies/IPOs beyond core ASSETS (e.g. Zomato, Swiggy, etc.)
  // When an IPO headline has listing metrics, ipoHeadlineContext preserves the named company directly without inventing unverified tickers.
  if (!ipoHeadlineContext(article.headline)) {
    const additionalEntities = extractStockEntities(text, links.map(link => link.symbol));
    for (const entity of additionalEntities) {
      if (!links.some(link => link.symbol.toLowerCase() === entity.symbolOrName.toLowerCase())) {
        links.push({
          symbol: entity.symbolOrName,
          basis: 'mention',
          evidence: entity.evidence,
        });
      }
    }
  }

  const sentiment = article.sentiment ?? analyzeHeadlineSentiment(article.headline, article.summary);

  return { ...article, region, relatedAssets: [...new Set(links.map(link => link.symbol))], stockLinks: links, sentiment };
}

export async function indianMarketNews(fetcher: Fetcher): Promise<NewsArticle[]> {
  const bytes = await fetchBytes(fetcher, 'https://www.business-standard.com/rss/markets-106.rss', { Accept: 'application/rss+xml, application/xml, text/xml' }, 500_000);
  return parseIndianNews(new TextDecoder().decode(bytes));
}
export function parseIndianNews(xml: string): NewsArticle[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Provider returned unsupported XML declarations');
  const parsed = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true }).parse(xml);
  const items = parsed?.rss?.channel?.item;
  if (!items) throw new Error('Provider returned no Indian market headlines');
  const rows: unknown[] = Array.isArray(items) ? items : [items];
  const articles: NewsArticle[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    if (typeof item.title !== 'string' || typeof item.link !== 'string' || typeof item.pubDate !== 'string') continue;
    try {
      const url = new URL(item.link);
      if (url.protocol !== 'https:' || !['www.business-standard.com', 'business-standard.com'].includes(url.hostname) || url.username || url.password) continue;
      const headline = item.title.replace(/<[^>]*>/g, '').trim().slice(0, 300);
      if (!headline) continue;
      articles.push(enrichNews({ id: `bs-${createHash('sha256').update(url.href).digest('hex').slice(0, 24)}`,
        headline, source: 'Business Standard', url: url.href, publishedAt: validTime(item.pubDate),
        // Publisher headline + attribution + original link; do not copy full article bodies.
        summary: '', relatedAssets: [],
      }, 'india'));
    } catch { /* Skip malformed dates/links; retain other validated headlines. */ }
  }
  if (!articles.length) throw new Error('Provider returned no valid Indian market headlines');
  return [...new Map(articles.map(article => [article.url, article])).values()];
}

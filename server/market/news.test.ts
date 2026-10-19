import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichNews, parseIndianNews } from './news';
import { MarketService } from './index';

const article = { id: 'test', headline: '', summary: '', source: 'Fixture', publishedAt: new Date().toISOString(), url: 'https://example.com', relatedAssets: [] };
const xml = `<rss><channel><item><title>TCS and HDFC Bank report earnings</title><link>https://www.business-standard.com/markets/news/test</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;
test('Indian and global company mentions link known stocks with evidence, without substring guesses', () => {
  const india = enrichNews({ ...article, headline: 'TCS and HDFC Bank sign deal with Microsoft' }, 'india');
  assert.deepEqual(new Set(india.relatedAssets), new Set(['TCS', 'HDFCBANK', 'MSFT']));
  assert.equal(india.stockLinks?.every(link => link.basis === 'mention'), true);
  const global = enrichNews({ ...article, headline: 'NVIDIA and $AAPL in focus', relatedAssets: ['TSLA', 'UNKNOWN'] }, 'global');
  assert.deepEqual(new Set(global.relatedAssets), new Set(['TSLA', 'NVDA', 'AAPL']));
  assert.equal(global.stockLinks?.find(link => link.symbol === 'TSLA')?.basis, 'provider');
  assert.deepEqual(enrichNews({ ...article, headline: 'Metaverse solutions show reliance on credit; salt demand rises' }, 'global').relatedAssets, []);
  assert.ok(enrichNews({ ...article, headline: 'L&T wins contract' }, 'india').relatedAssets.includes('LT'));
});
test('Indian RSS validates origin and dates, rejects entities, deduplicates and preserves attribution', () => {
  const parsed = parseIndianNews(xml);
  assert.equal(parsed[0].region, 'india'); assert.equal(parsed[0].source, 'Business Standard');
  assert.deepEqual(new Set(parsed[0].relatedAssets), new Set(['TCS', 'HDFCBANK']));
  assert.throws(() => parseIndianNews('<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///test">]>' + xml));
  assert.throws(() => parseIndianNews(xml.replace('https://www.business-standard.com/markets/news/test', 'javascript:alert(1)')));
  assert.throws(() => parseIndianNews('<html>blocked</html>'));
});
test('combined feed retains Indian news during global provider failure and reports partial coverage', async () => {
  const service = new MarketService({}, async url => {
    assert.match(String(url), /business-standard\.com/);
    return new Response(xml);
  });
  const news = await service.news();
  assert.equal(news.status, 'live'); assert.equal(news.articles[0].region, 'india');
  assert.match(news.error ?? '', /Finnhub global temporarily unavailable/);
});
test('combined feed retains both regions and linked stocks', async () => {
  const service = new MarketService({ FINNHUB_API_KEY: 'test-only' }, async url => String(url).includes('business-standard')
    ? new Response(xml) : new Response(JSON.stringify([{ id: 1, headline: 'NVIDIA reports earnings', source: 'Fixture', url: 'https://example.com/news', datetime: Math.floor(Date.now() / 1000) }])));
  const news = await service.news();
  assert.deepEqual(new Set(news.articles.map(item => item.region)), new Set(['india', 'global']));
  assert.ok(news.articles.some(item => item.relatedAssets.includes('NVDA')));
});

test('combined feed does not truncate available headlines at forty per source', async () => {
  const items = Array.from({ length: 85 }, (_, i) => `<item><title>Market headline ${i}</title><link>https://www.business-standard.com/markets/news/${i}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`).join('');
  const global = Array.from({ length: 55 }, (_, i) => ({ id: i, headline: `Global headline ${i}`, source: 'Fixture', url: `https://example.com/${i}`, datetime: Math.floor(Date.now() / 1000) }));
  const service = new MarketService({ FINNHUB_API_KEY: 'fixture' }, async url => String(url).includes('business-standard.com')
    ? new Response(`<rss><channel>${items}</channel></rss>`) : new Response(JSON.stringify(global)));
  const news = await service.news(true);
  assert.equal(news.articles.length, 140);
});

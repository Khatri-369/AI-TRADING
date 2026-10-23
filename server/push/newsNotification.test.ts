import test from 'node:test';
import assert from 'node:assert/strict';
import { newsNotificationBody, newsNotificationTitle } from '../../shared/newsNotification';
import { queueHeadline } from './newsQueue';
import { sendSystemNotification } from '../../src/utils/notifications';

test('stock relevance is article-specific and never falls back to market leaders', () => {
  assert.equal(newsNotificationBody('TCS wins contract', ['TCS', 'TCS']), 'TCS wins contract\nRelated stocks (quote snapshot): Tata Consultancy Services (TCS) — change unavailable');
  assert.equal(newsNotificationBody('Central bank announces policy'), 'Central bank announces policy\nNo verified stock ticker linked');
  assert.equal(newsNotificationBody('Microsoft earnings', ['MSFT']), 'Microsoft earnings\nRelated stocks (quote snapshot): Microsoft (MSFT) — change unavailable');
});

test('new queue records freeze stock relevance for idempotent notification retries', () => {
  const article = { id: 'tcs', headline: 'TCS wins contract', relatedAssets: ['TCS'], summary: '', source: 'Publisher', url: 'https://example.com/tcs', publishedAt: '2026-10-19T10:00:00Z' };
  const record = queueHeadline(article);
  article.relatedAssets.push('AAPL');
  assert.equal(record.notificationBody, 'TCS wins contract\nRelated stocks (quote snapshot): Tata Consultancy Services (TCS) — change unavailable');
});

test('device notification keeps publisher, headline and linked symbols without loaded quotes', async () => {
  const savedWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const savedNotification = Object.getOwnPropertyDescriptor(globalThis, 'Notification');
  const captured: Array<{ title: string; options: NotificationOptions }> = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'Notification', { configurable: true, value: class {
    static permission = 'granted';
    constructor(title: string, options: NotificationOptions) { captured.push({ title, options }); }
  } });
  try {
    assert.equal(await sendSystemNotification('TCS wins contract', 'Publisher', [], 'tcs', ['TCS'], 'https://example.com/tcs'), true);
    assert.equal(captured[0].title, 'TRADEXA · TCS · Publisher');
    assert.equal(captured[0].options.body, 'TCS wins contract\nRelated stocks (quote snapshot): Tata Consultancy Services (TCS) — change unavailable');
    assert.equal(captured[0].options.data.url, 'https://example.com/tcs');
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (savedNotification) Object.defineProperty(globalThis, 'Notification', savedNotification); else Reflect.deleteProperty(globalThis, 'Notification');
  }
});

test('collapsed notification shows only relevant symbols, with bounded ticker count', () => {
  assert.equal(newsNotificationTitle('Reuters', ['TCS', ' tcs ', 'HDFCBANK']), 'TRADEXA · TCS, HDFCBANK · Reuters');
  assert.equal(newsNotificationTitle('Reuters', ['TCS', 'INFY', 'MSFT', 'NVDA']), 'TRADEXA · TCS, INFY, MSFT +1 · Reuters');
  assert.equal(newsNotificationTitle('Reuters'), 'TRADEXA · Reuters');
});

test('queue infers named companies even without provider tickers and excludes unrelated quotes', () => {
  const record = queueHeadline({ id: 'deal', headline: 'Infosys signs deal with Microsoft', summary: '', source: 'Reuters', url: 'https://example.com/deal', publishedAt: new Date().toISOString(), relatedAssets: [] }, [{ symbol: 'AAPL', price: 200, changePercent: 1 }]);
  assert.deepEqual(new Set(record.article.relatedAssets), new Set(['INFY', 'MSFT']));
  assert.match(record.notificationTitle!, /INFY/);
  assert.match(record.notificationTitle!, /MSFT/);
  assert.doesNotMatch(record.notificationBody!, /AAPL/);
});

test('notification body formats related stock changes with prices and percentages when quotes are provided', () => {
  const quotes = [
    { symbol: 'RELIANCE', price: 2950.5, changePercent: 1.42, currency: 'INR' },
    { symbol: 'TCS', price: 4120, changePercent: -0.75, currency: 'INR' },
    { symbol: 'AAPL', price: 228.5, changePercent: 0.85, currency: 'USD' },
  ];
  assert.equal(
    newsNotificationBody('Reliance expands renewable investments', ['RELIANCE'], quotes),
    'Reliance expands renewable investments\nRelated stocks (quote snapshot): Reliance Industries (RELIANCE) ₹2,950.5 (+1.42%)'
  );
  assert.equal(
    newsNotificationBody('Tech leaders report quarterly numbers', ['RELIANCE', 'TCS', 'AAPL'], quotes),
    'Tech leaders report quarterly numbers\nRelated stocks (quote snapshot): Reliance Industries (RELIANCE) ₹2,950.5 (+1.42%), Tata Consultancy Services (TCS) ₹4,120 (-0.75%), Apple (AAPL) $228.5 (+0.85%)'
  );
});

test('Indian broad-market headlines show index context, not unrelated companies', () => {
  const record = queueHeadline({ id: 'macro', headline: 'Mkt re-rating unlikely amid global uncertainty', summary: '', source: 'Business Standard', region: 'india', url: 'https://example.com/macro', publishedAt: new Date().toISOString(), relatedAssets: [] }, [
    { symbol: 'NIFTY50', changePercent: 0.42 }, { symbol: 'SENSEX', changePercent: -0.31 },
    { symbol: 'AAPL', changePercent: 2 },
  ]);
  assert.match(record.notificationBody!, /Market context \(quote snapshot\): NIFTY 50 \(NIFTY50\) \(\+0.42%\), BSE SENSEX \(SENSEX\) \(-0.31%\)/);
  assert.doesNotMatch(record.notificationBody!, /Apple|AAPL|Related stocks/);
  assert.deepEqual(record.article.relatedAssets, []);
});

test('missing and stale changes are explicit, while real zero is preserved', () => {
  const body = newsNotificationBody('Company updates', ['INFY', 'TCS', 'MSFT', 'AAPL'], [
    { symbol: 'INFY', changePercent: 0 }, { symbol: 'TCS', changePercent: 3, status: 'stale' },
    { symbol: 'MSFT', changePercent: Number.NaN },
  ]);
  assert.match(body, /Infosys \(INFY\) \(0.00%\)/);
  assert.match(body, /Tata Consultancy Services \(TCS\) — change unavailable/);
  assert.match(body, /Microsoft \(MSFT\) — change unavailable/);
  assert.match(body, /Apple \(AAPL\) — change unavailable/);
  assert.doesNotMatch(body, /3.00%|NaN/);
});

test('unmapped IPO companies retain their explicit name and listing basis without invented quotes', () => {
  const headline = 'Fusion CX lists at 5% premium over IPO price after 3.3x subscription';
  const record = queueHeadline({ id: 'fusion', headline, summary: '', region: 'india', source: 'Business Standard', url: 'https://example.com/fusion', publishedAt: new Date().toISOString(), relatedAssets: [] }, [{ symbol: 'AAPL', changePercent: 2 }]);
  assert.equal(record.notificationBody, `${headline}\nCompany in headline: Fusion CX — 5% listing premium vs IPO price (reported); live change unavailable`);
  assert.deepEqual(record.article.relatedAssets, []);
  assert.doesNotMatch(record.notificationBody!, /AAPL|NIFTY|No specific/);
  assert.match(newsNotificationBody('Example Ltd debuts at 2.5% discount to issue price'), /Example Ltd — 2.5% listing discount/);
  assert.equal(newsNotificationBody('Could Example Ltd list at 5% premium over IPO price?'), 'Could Example Ltd list at 5% premium over IPO price?\nNo verified stock ticker linked');
});

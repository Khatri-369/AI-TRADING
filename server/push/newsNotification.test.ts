import test from 'node:test';
import assert from 'node:assert/strict';
import { newsNotificationBody } from '../../shared/newsNotification';
import { queueHeadline } from './newsQueue';
import { sendSystemNotification } from '../../src/utils/notifications';

test('stock relevance is article-specific and never falls back to market leaders', () => {
  assert.equal(newsNotificationBody('TCS wins contract', ['TCS', 'TCS']), 'TCS wins contract\nRelated stocks: TCS');
  assert.equal(newsNotificationBody('Central bank announces policy'), 'Central bank announces policy\nNo specific stock identified');
  assert.equal(newsNotificationBody('Microsoft earnings', ['MSFT']), 'Microsoft earnings\nRelated stocks: MSFT');
});

test('new queue records freeze stock relevance for idempotent notification retries', () => {
  const article = { id: 'tcs', headline: 'TCS wins contract', relatedAssets: ['TCS'], summary: '', source: 'Publisher', url: 'https://example.com/tcs', publishedAt: '2026-10-19T10:00:00Z' };
  const record = queueHeadline(article);
  article.relatedAssets.push('AAPL');
  assert.equal(record.notificationBody, 'TCS wins contract\nRelated stocks: TCS');
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
    assert.equal(captured[0].title, 'Tradexa · Publisher');
    assert.equal(captured[0].options.body, 'TCS wins contract\nRelated stocks: TCS');
    assert.equal(captured[0].options.data.url, 'https://example.com/tcs');
  } finally {
    if (savedWindow) Object.defineProperty(globalThis, 'window', savedWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (savedNotification) Object.defineProperty(globalThis, 'Notification', savedNotification); else Reflect.deleteProperty(globalThis, 'Notification');
  }
});

test('notification body formats related stock changes with prices and percentages when quotes are provided', () => {
  const quotes = [
    { symbol: 'RELIANCE', price: 2950.5, changePercent: 1.42, currency: 'INR' },
    { symbol: 'TCS', price: 4120, changePercent: -0.75, currency: 'INR' },
    { symbol: 'AAPL', price: 228.5, changePercent: 0.85, currency: 'USD' },
  ];
  assert.equal(
    newsNotificationBody('Reliance expands renewable investments', ['RELIANCE'], quotes),
    'Reliance expands renewable investments\nRelated stocks: RELIANCE ₹2,950.5 (+1.42%)'
  );
  assert.equal(
    newsNotificationBody('Tech leaders report quarterly numbers', ['RELIANCE', 'TCS', 'AAPL'], quotes),
    'Tech leaders report quarterly numbers\nRelated stocks: RELIANCE ₹2,950.5 (+1.42%), TCS ₹4,120 (-0.75%), AAPL $228.5 (+0.85%)'
  );
});

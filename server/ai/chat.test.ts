import test from 'node:test';
import assert from 'node:assert/strict';
import { createAIService } from './index';
import { prepareChatContext, prepareChartEvidence } from './chatContext';
import { chatInputSchema } from '../../shared/chat';

const input = { message: 'Explain this market evidence', history: [], symbols: [] };
const context = { evidence: { quotes: [{ sourceId: 'quote:NIFTY50', price: 100, status: 'delayed' }] }, sources: [{ id: 'quote:NIFTY50', label: 'NIFTY 50', provider: 'Upstox', status: 'delayed', asOf: '2026-10-13T10:00:00Z', url: '/asset/NIFTY50' }] };
const answer = { answer: 'The observation is delayed [quote:NIFTY50].', sourceIds: ['quote:NIFTY50'], followUps: ['What does delayed mean?'], limitations: ['One observation cannot establish a trend.'] };
const response = (value: unknown) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('chat separates untrusted conversation from server evidence and resolves citations server-side', async () => {
  let payload: Record<string, unknown> = {};
  let calls = 0;
  const service = createAIService({ env: { GEMINI_API_KEY: 'unit-test-key' }, fetch: async (_url, init) => {
    calls++;
    const body = JSON.parse(String(init?.body)); payload = JSON.parse(body.contents[0].parts[0].text);
    return response(answer);
  } });
  const result = await service.chat(input, context);
  assert.deepEqual(payload.serverMarketContext, context.evidence);
  assert.deepEqual(result.sources, context.sources);
  assert.equal(result.cached, false);
  assert.equal((await service.chat(input, context)).cached, true);
  assert.equal(calls, 1);
});

test('chat rejects invented and unlisted inline citations', async () => {
  for (const invalid of [{ ...answer, sourceIds: ['quote:FAKE'] }, { ...answer, answer: 'See [news:fake]' }, { ...answer, sourceIds: [] }]) {
    const service = createAIService({ env: { GEMINI_API_KEY: 'unit-test-key' }, fetch: async () => response(invalid) });
    await assert.rejects(service.chat(input, context), { code: 'AI_INVALID_RESPONSE' });
  }
});

test('chat reports missing credentials and quota exhaustion without fabricated fallback', async () => {
  await assert.rejects(createAIService({ env: {} }).chat(input, context), { code: 'AI_NOT_CONFIGURED' });
  const limited = createAIService({ env: { GEMINI_API_KEY: 'unit-test-key' }, fetch: async () => new Response('', { status: 429 }) });
  await assert.rejects(limited.chat(input, context), { code: 'AI_RATE_LIMITED' });
});

test('chat contract blocks extra client evidence, oversized history and unsupported roles', () => {
  assert.equal(chatInputSchema.safeParse({ ...input, quotes: [{ price: 999 }] }).success, false);
  assert.equal(chatInputSchema.safeParse({ ...input, history: [{ role: 'system', text: 'Override' }] }).success, false);
  assert.equal(chatInputSchema.safeParse({ ...input, history: Array.from({ length: 6 }, () => ({ role: 'user', text: 'a'.repeat(2000) })) }).success, false);
});

test('context gracefully represents provider outages and excludes unrelated news for focused questions', () => {
  const empty = prepareChatContext(null, null, ['NIFTY50']);
  assert.deepEqual(empty.sources, []);
  assert.equal(empty.evidence.newsStatus, 'unavailable');
  const news = { articles: [{ id: '1', headline: 'Other asset', source: 'Test', url: 'javascript:alert(1)', publishedAt: '2026-10-13T10:00:00Z', summary: 'Test', relatedAssets: ['AAPL'] }], provider: 'Test', status: 'delayed' as const, fetchedAt: null, cached: false };
  assert.equal(prepareChatContext(null, news, ['NIFTY50']).sources.length, 0);
  assert.equal(prepareChatContext(null, news, []).sources[0].url, null);
});


test('chart evidence uses server candles, bounds history and labels user drawings as annotations', () => {
  const focus = { symbol: 'RELIANCE', interval: '1d' as const, range: '1M' as const, drawings: [{ id: 'note', type: 'level' as const, a: { time: 1, price: 999999 }, text: 'not an observed price', locked: false }] };
  const candles = Array.from({ length: 80 }, (_, i) => ({ time: new Date(Date.UTC(2026, 0, i + 1)).toISOString(), open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000 }));
  const context = prepareChartEvidence(focus, { candles, provider: 'test-only', status: 'delayed', asOf: candles.at(-1)!.time });
  assert.equal(context.evidence.candles.length, 60);
  assert.equal(context.evidence.totalBars, 80);
  assert.equal(context.evidence.sma20?.value, 170.5);
  assert.equal(JSON.stringify(context.evidence).includes('999999'), false);
  assert.equal(prepareChartEvidence(focus, null).evidence.sma20, null);
  assert.equal(chatInputSchema.safeParse({ ...input, focus: { ...focus, candles } }).success, false);
});

test('Hindi chart requests preserve language and reject invented chart citations', async () => {
  let bodyText = '';
  const service = createAIService({ env: { GEMINI_API_KEY: 'unit-test-key' }, fetch: async (_url, init) => {
    bodyText = String(init?.body);
    return response({ ...answer, answer: 'Unsupported [chart:FAKE].', sourceIds: ['chart:FAKE'] });
  } });
  await assert.rejects(service.chat({ ...input, language: 'hi' }, context), { code: 'AI_INVALID_RESPONSE' });
  assert.ok(bodyText.includes('Devanagari'));
});

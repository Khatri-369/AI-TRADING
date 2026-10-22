import test from 'node:test';
import assert from 'node:assert/strict';
import { AIServiceError, createAIService, DEFAULT_GEMINI_MODEL } from './index.js';

// These fixtures exercise provider contracts and are never imported by production.
const analysisFixture = {
  sentiment: 'Positive', signal: 'Buy', confidence: 71,
  rationale: 'Improved earnings can support sentiment; price reaction is uncertain.',
  risks: ['The headline alone does not establish investment value.'], affectedAssets: ['AAPL'],
};

const inferenceResponse = (value: unknown) => Response.json({
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }],
});
const headline = { headline: 'Apple reports stronger quarterly earnings', engine: 'gemini' as const };
const keys = { GEMINI_API_KEY: 'test-only-gemini-key', HUGGINGFACE_API_KEY: 'test-only-hf-key' };

test('missing credentials return unavailable without any request or local fallback', async () => {
  let calls = 0;
  const service = createAIService({ env: {}, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  for (const engine of ['gemini', 'finbert'] as const) {
    await assert.rejects(service.analyze({ ...headline, engine }), (error: unknown) => {
      assert.ok(error instanceof AIServiceError);
      assert.equal(error.status, 503);
      assert.equal(error.engine, engine);
      assert.equal(error.engineStatus, 'unavailable');
      assert.equal(error.code, 'AI_NOT_CONFIGURED');
      return true;
    });
  }
  assert.equal(calls, 0);
  assert.ok(service.aiProviderStatuses().every(provider => provider.status === 'missing-key'));
});

test('Gemini uses a private header and separate system instructions and server context', async () => {
  let requestUrl = '';
  let requestOptions: RequestInit | undefined;
  const service = createAIService({ env: keys, fetch: async (url, init) => {
    requestUrl = String(url); requestOptions = init;
    return inferenceResponse(analysisFixture);
  } });
  const context = { symbol: 'AAPL', price: 200, status: 'delayed' };
  const result = await service.analyze(headline, context);
  assert.ok(requestUrl.endsWith(`${DEFAULT_GEMINI_MODEL}:generateContent`));
  assert.ok(!requestUrl.includes(keys.GEMINI_API_KEY));
  assert.equal(new Headers(requestOptions?.headers).get('x-goog-api-key'), keys.GEMINI_API_KEY);
  const payload = JSON.parse(String(requestOptions?.body));
  assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text).serverMarketContext, context);
  assert.match(payload.systemInstruction.parts[0].text, /untrusted data/);
  assert.equal(payload.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON');
  assert.equal(result.engine, 'gemini');
  assert.equal(result.cached, false);
  assert.equal(result.engineStatus, 'available');
  assert.equal(service.aiProviderStatuses()[0].status, 'available');
});

test('identical requests share one inference and cached responses cannot mutate cache', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  const [first, second] = await Promise.all([service.analyze(headline), service.analyze(headline)]);
  assert.equal(calls, 1);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  first.risks[0] = 'mutated';
  second.affectedAssets.push('mutated');
  const third = await service.analyze(headline);
  assert.equal(third.cached, true);
  assert.deepEqual(third.risks, analysisFixture.risks);
  assert.deepEqual(third.affectedAssets, ['AAPL']);
});

test('changed market evidence invalidates cached Gemini analysis', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  await service.analyze(headline, { price: 100 });
  await service.analyze(headline, { price: 101 });
  assert.equal(calls, 2);
});

test('receipt timestamps do not defeat caching, but observation age and stale status do', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  const evidence = { price: 100, asOf: '2026-10-06T10:00:00Z', status: 'delayed' };
  await service.analyze(headline, { generatedAt: 'first', quotes: [{ ...evidence, fetchedAt: 'first', cached: false }] });
  assert.equal((await service.analyze(headline, { quotes: [{ ...evidence, fetchedAt: 'second', cached: true }], generatedAt: 'second' })).cached, true);
  await service.analyze(headline, { quotes: [{ ...evidence, status: 'stale' }] });
  await service.analyze(headline, { quotes: [{ ...evidence, asOf: '2026-10-06T11:00:00Z' }] });
  assert.equal(calls, 3);
});

test('cache expires after ten minutes and has a bounded LRU capacity', async () => {
  let timestamp = Date.parse('2026-10-06T10:00:00Z');
  let calls = 0;
  const service = createAIService({ env: keys, now: () => timestamp, cacheCapacity: 1, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  await service.analyze(headline);
  await service.analyze({ ...headline, headline: 'Different quarterly earnings headline' });
  await service.analyze(headline);
  assert.equal(calls, 3);
  timestamp += 10 * 60_000 + 1;
  assert.equal((await service.analyze(headline)).cached, false);
  assert.equal(calls, 4);
});

test('invalid client input and forged context fields are rejected before inference', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => { calls++; return inferenceResponse(analysisFixture); } });
  await assert.rejects(service.analyze({ ...headline, headline: '' }), { code: 'AI_INPUT_INVALID', status: 400 });
  await assert.rejects(service.analyze({ ...headline, symbol: '<script>' }), { code: 'AI_INPUT_INVALID' });
  await assert.rejects(service.analyze({ ...headline, priceContext: { price: 999 } } as unknown as typeof headline), { code: 'AI_INPUT_INVALID' });
  assert.equal(calls, 0);
});

test('malformed outputs, out-of-range confidence, and contradictory signals are unavailable', async () => {
  for (const fixture of [{}, { ...analysisFixture, confidence: 101 }, { ...analysisFixture, signal: 'Sell' }]) {
    const service = createAIService({ env: keys, fetch: async () => inferenceResponse(fixture) });
    await assert.rejects(service.analyze(headline), { code: 'AI_INVALID_RESPONSE', engineStatus: 'unavailable' });
    assert.equal(service.aiProviderStatuses()[0].status, 'unavailable');
  }
});

test('truncated or blocked Gemini output is never served as analysis', async () => {
  const service = createAIService({ env: keys, fetch: async () => Response.json({ candidates: [{
    finishReason: 'MAX_TOKENS', content: { parts: [{ text: JSON.stringify(analysisFixture) }] },
  }] }) });
  await assert.rejects(service.analyze(headline), { code: 'AI_INVALID_RESPONSE' });
});

test('FinBERT uses only genuine HF inference and derives confidence from normalized model scores', async () => {
  let calls = 0;
  const service = createAIService({ env: { HUGGINGFACE_API_KEY: keys.HUGGINGFACE_API_KEY }, fetch: async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://router.huggingface.co/hf-inference/models/ProsusAI/finbert');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${keys.HUGGINGFACE_API_KEY}`);
    return Response.json([[{ label: 'positive', score: 0.08 }, { label: 'negative', score: 0.82 }, { label: 'neutral', score: 0.1 }]]);
  } });
  const result = await service.analyze({ ...headline, engine: 'finbert', symbol: 'aapl' });
  assert.equal(calls, 1);
  assert.equal(result.engine, 'finbert');
  assert.equal(result.signal, 'Sell');
  assert.equal(result.confidence, 82);
  assert.deepEqual(result.affectedAssets, ['AAPL']);
  assert.match(result.rationale, /not the likelihood of a price move/);
});

test('invalid FinBERT scores cannot produce a confident synthetic result', async () => {
  for (const rows of [
    [{ label: 'positive', score: 0.9 }],
    [{ label: 'positive', score: 0.9 }, { label: 'positive', score: 0.05 }, { label: 'neutral', score: 0.05 }],
    [{ label: 'positive', score: 0.9 }, { label: 'negative', score: 0.9 }, { label: 'neutral', score: 0.9 }],
  ]) {
    const service = createAIService({ env: keys, fetch: async () => Response.json(rows) });
    await assert.rejects(service.analyze({ ...headline, engine: 'finbert' }), { code: 'AI_INVALID_RESPONSE', engine: 'finbert' });
  }
});

test('provider failures expose sanitized errors and never fall back to another engine', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => { calls++; return new Response('private-provider-details', { status: 429 }); } });
  await assert.rejects(service.analyze({ ...headline, engine: 'finbert' }), (error: unknown) => {
    assert.ok(error instanceof AIServiceError);
    assert.equal(error.engine, 'finbert');
    assert.equal(error.code, 'AI_RATE_LIMITED');
    assert.ok(!error.message.includes('private-provider-details'));
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(service.aiProviderStatuses()[1].status, 'rate-limited');
});

test('failed requests are not cached and can recover', async () => {
  let calls = 0;
  const service = createAIService({ env: keys, fetch: async () => ++calls === 1 ? new Response('', { status: 503 }) : inferenceResponse(analysisFixture) });
  await assert.rejects(service.analyze(headline), { code: 'AI_PROVIDER_UNAVAILABLE' });
  assert.equal((await service.analyze(headline)).engineStatus, 'available');
  assert.equal(calls, 2);
});

test('hanging providers are aborted with a controlled timeout', async () => {
  const service = createAIService({ env: keys, timeoutMs: 10, fetch: async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('private network error')), { once: true });
  }) });
  await assert.rejects(service.analyze(headline), { code: 'AI_TIMEOUT', status: 504 });
});

test('oversized upstream responses are rejected before parsing', async () => {
  const service = createAIService({ env: keys, fetch: async () => new Response('x'.repeat(130 * 1024)) });
  await assert.rejects(service.analyze(headline), { code: 'AI_INVALID_RESPONSE' });
});

test('unique concurrent requests have a hard cap while identical requests share work', async () => {
  let release: ((value: Response) => void) | undefined;
  const service = createAIService({ env: keys, maxConcurrent: 1, fetch: () => new Promise(resolve => { release = resolve; }) });
  const first = service.analyze(headline);
  const duplicate = service.analyze(headline);
  await assert.rejects(service.analyze({ ...headline, headline: 'Another company reports an earnings decline' }), { code: 'AI_BUSY' });
  assert.ok(release);
  release(inferenceResponse(analysisFixture));
  assert.equal((await first).cached, false);
  assert.equal((await duplicate).cached, true);
});

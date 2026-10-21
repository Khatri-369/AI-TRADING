import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
test('shared worker leaves OneSignal push and click events to the SDK', () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  let displayed = 0;
  let closed = 0;
  runInNewContext(source, {
    importScripts: () => {},
    self: {
      addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
      registration: { showNotification: () => { displayed++; } },
    },
  });
  handlers.push({ data: { json: () => ({ custom: { i: 'article-id' }, title: 'Publisher', alert: 'Headline' }) } });
  handlers.notificationclick({ notification: { data: { notificationId: 'article-id', launchURL: 'https://example.com/article' }, close: () => { closed++; } } });
  assert.equal(displayed, 0);
  assert.equal(closed, 0);
});

test('shared worker does not install silently without the OneSignal SDK', () => {
  let listenerAdded = false;
  assert.throws(() => runInNewContext(source, {
    importScripts: () => { throw new Error('offline'); },
    self: { addEventListener: () => { listenerAdded = true; } },
  }), /offline/);
  assert.equal(listenerAdded, false);
});

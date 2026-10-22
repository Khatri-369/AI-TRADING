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

test('PWA worker does not import OneSignal (push uses /onesignal/ scope)', () => {
  assert.doesNotMatch(source, /importScripts\s*\(\s*['"]https:\/\/cdn\.onesignal\.com/);
});

test('PWA worker activates even when offline precache fails', () => {
  let skipWaitingCalled = false;
  const handlers: Record<string, (event: { waitUntil: (p: Promise<unknown>) => void }) => void> = {};
  runInNewContext(source, {
    caches: {
      open: async () => ({
        addAll: async () => {
          throw new Error('offline');
        },
      }),
      keys: async () => [],
    },
    self: {
      skipWaiting: () => {
        skipWaitingCalled = true;
      },
      addEventListener: (name: string, handler: (event: { waitUntil: (p: Promise<unknown>) => void }) => void) => {
        handlers[name] = handler;
      },
      clients: { claim: async () => undefined },
    },
    fetch: () => Promise.reject(new Error('offline')),
    URL,
    Response: class {},
  });
  assert.equal(typeof handlers.install, 'function');
  handlers.install({ waitUntil: promise => void promise });
  assert.equal(skipWaitingCalled, true);
});

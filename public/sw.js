/* global self, caches, fetch, URL, Response */
// PWA caching only. OneSignal push uses /onesignal/OneSignalSDKWorker.js at scope /onesignal/.
const CACHE_NAME = 'tradexa-static-v6';
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/tradexa-32.png',
  '/icons/tradexa-192.png',
  '/icons/tradexa-512.png',
  '/icons/tradexa-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      await self.skipWaiting();
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
      } catch {
        /* Precache is best-effort; do not block push or app updates on slow networks. */
      }
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key.startsWith('tradexa-') && key !== CACHE_NAME).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // STRICT SECURITY & FRESHNESS GUARDS:
  // NEVER cache API responses, live prices, SSE streams, authenticated requests, or non-GET requests.
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/api/') ||
    event.request.headers.get('accept')?.includes('text/event-stream') ||
    event.request.headers.get('cookie') ||
    event.request.headers.get('authorization')
  ) {
    return; // Pass directly to network
  }

  // Navigation requests: network-first with graceful offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return (await caches.match('/offline.html')) || Response.error();
      })
    );
    return;
  }

  // Safe static assets (JS, CSS, fonts, icons, manifest)
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname.endsWith('.webmanifest') ||
      url.pathname === '/offline.html')
  ) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});

// Web Push event listener for mobile breaking news notifications
self.addEventListener('push', event => {
  let message = {};
  try {
    message = event.data?.json() ?? {};
  } catch {
    /* Fallback generic payload */
  }
  // Ignore OneSignal push payloads so OneSignalSDK.sw.js handles them without duplicate notifications
  if (message.custom || message.onesignal || !message.title) {
    return;
  }
  const title = typeof message.title === 'string' && message.title ? message.title : 'Tradexa · Breaking News';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof message.body === 'string' ? message.body.slice(0, 180) : 'New verified market intelligence is available.',
      icon: '/icons/tradexa-192.png',
      badge: '/icons/tradexa-192.png',
      tag: typeof message.tag === 'string' ? message.tag : 'tradexa-news',
      vibrate: [200, 100, 200],
      data: { url: typeof message.url === 'string' ? message.url : '/news' },
    })
  );
});

// Notification click navigation handler
self.addEventListener('notificationclick', event => {
  // If notification was created by OneSignal, OneSignal's SDK handler manages it
  if (event.notification.data?.notificationId || event.notification.data?.custom || event.notification.data?.onesignal) {
    return;
  }
  event.notification.close();
  const targetUrl = event.notification.data?.url === '/desk' ? '/desk' : '/news';
  const destination = new URL(targetUrl, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(destination);
          return client.focus();
        }
      }
      return self.clients.openWindow(destination);
    })
  );
});

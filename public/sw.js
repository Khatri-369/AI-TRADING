/* global self, caches, fetch, URL */
const CACHE = 'markets-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('markets-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  // Never cache prices, AI answers, authenticated requests or API responses.
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
  }
});
self.addEventListener('push', event => {
  let message = {};
  try { message = event.data?.json() ?? {}; } catch { /* Use a safe generic notification. */ }
  const title = typeof message.title === 'string' ? message.title : 'Market news';
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof message.body === 'string' ? message.body.slice(0, 180) : 'New market news is available.',
    icon: '/icons/markets-192.png', badge: '/icons/markets-192.png',
    tag: typeof message.tag === 'string' ? message.tag : 'market-news',
    vibrate: [200, 100, 200],
    data: { url: typeof message.url === 'string' ? message.url : '/news' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/news';
  const destination = new URL(targetUrl, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin) { await client.navigate(destination); return client.focus(); }
    }
    return self.clients.openWindow(destination);
  }));
});

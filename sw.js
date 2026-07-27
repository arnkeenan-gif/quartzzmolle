// Quartz Mølle service worker — push notifications for new orders.
// Registered by the admin page; iOS shows these when the site is installed on
// the Home Screen (iOS 16.4+).

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Quartz Mølle', {
    body: d.body || 'Ny ordre',
    icon: '/images/qm-icon-192.png',
    badge: '/images/qm-icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/admin' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
      return clients.openWindow(url);
    })
  );
});

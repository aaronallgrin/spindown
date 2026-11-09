// Loaded into the app's service worker (see vite.config.ts importScripts).
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Spindown', {
      body: d.body || '',
      icon: 'icon-192.png',
      data: { url: d.url || './' },
    }),
  );
});

// tap a notification: bring the app forward (or open it) on the right page
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list[0];
      if (!open) return self.clients.openWindow(url);
      return open.focus().then((c) => c.navigate && c.navigate(url));
    }),
  );
});

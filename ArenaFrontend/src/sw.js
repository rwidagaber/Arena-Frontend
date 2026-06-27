self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // فيه تاب مفتوح ومركّز عليه دلوقتي؟
        const isAppFocused = clientList.some(
          (client) => client.focused === true || client.visibilityState === 'visible'
        );

        if (isAppFocused) {
          // اليوزر جوه الموقع — السيجنال آر هيتولى الإشعار، متعرضش Chrome notification
          return;
        }

        return self.registration.showNotification(data.title ?? 'Arena Gym', {
          body: data.message ?? '',
          icon: '/assets/logo.png',
          badge: '/assets/badge.png',
          vibrate: [200, 100, 200],
          silent: false, // ✅ المتصفح يشغل الـ default sound
          data: { url: data.url ?? '/' }
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(event.notification.data.url);
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});
// Seiketsu staff alerts. Only shows new-order notifications and opens the orders screen when one is tapped.
// No caching: pages always load fresh from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const w = wins.find((c) => /\/(admin|kitchen)/.test(new URL(c.url).pathname));
      return w ? w.focus() : self.clients.openWindow("/admin/orders");
    }),
  );
});

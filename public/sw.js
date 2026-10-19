// Service worker de Serena: solo avisos (push) y número sobre el ícono.
// No guarda páginas ni archivos en caché a propósito: la tienda siempre muestra lo último.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title || "Serena", {
        body: d.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: d.url || undefined,
        data: { url: d.url || "/" },
      });
      try {
        if (typeof d.badge === "number" && self.navigator.setAppBadge) {
          await (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
        }
      } catch {
        /* el sistema no lo permite: el aviso igual salió */
      }
      const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      abiertas.forEach((c) => c.postMessage({ type: "push" }));
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const abiertas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of abiertas) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

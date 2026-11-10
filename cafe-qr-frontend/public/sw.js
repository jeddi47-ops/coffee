// Service worker : installation de l'écran de service (PWA) + alertes push du personnel.
// Aucun cache : les commandes et données du café ne sont jamais stockées hors ligne.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pas d'interception : le navigateur gère toutes les requêtes normalement.
});

// Alerte reçue du serveur (nouvelle commande ou appel serveur), même écran éteint.
// Chaque push DOIT afficher une notification (obligatoire sur iPhone).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const isCall = data.kind === "call";
  event.waitUntil(
    self.registration.showNotification(data.title || "Café QR", {
      body: data.body || "",
      tag: data.tag || (isCall ? "call" : "order"),
      renotify: true, // une nouvelle alerte re-sonne même si la précédente est encore affichée
      requireInteraction: true, // reste affichée jusqu'au toucher (Android)
      vibrate: isCall ? [500, 200, 500, 200, 500, 200, 900] : [400, 150, 400, 150, 400],
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/staff" },
    }),
  );
});

// Toucher l'alerte : ramène l'écran de service au premier plan (ou l'ouvre).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/staff";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).pathname.startsWith("/staff") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});

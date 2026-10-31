// Service worker minimal : permet l'installation de l'écran de service (PWA).
// Aucun cache : les commandes et données du café ne sont jamais stockées hors ligne.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // Pas d'interception : le navigateur gère toutes les requêtes normalement.
});

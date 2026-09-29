/* Retire the root v1.3 worker when v2 becomes the main page.
   Keep the archived /v1/ worker in its own scope for legacy offline use. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await caches.delete('so-tra-no-v1.3.0-preview2');
  await self.clients.claim();
  await self.registration.unregister();
})()));
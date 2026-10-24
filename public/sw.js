// Only cache the offline notice: private invitations and guest credentials never enter a shared cache.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

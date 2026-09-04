self.addEventListener('install',event=>event.waitUntil(caches.open('onomo-shell-v3').then(cache=>cache.addAll(['./','./index.html','./assets/css/app.css','./assets/css/responsive.css','./assets/css/interactions.css','./assets/js/ui.js','./assets/js/app.js']))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!=='onomo-shell-v3').map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request))));

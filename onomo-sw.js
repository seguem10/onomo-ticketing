const VERSION='onomo-support-it-v5';
const SHELL=['./onomo-support-modern.html','./assets/pwa/manifest.webmanifest','./assets/js/i18n.js','./assets/js/modern-features.js','./assets/js/runtime-sync.js','./locales/fr.json','./locales/en.json','./locales/ar.json','./assets/pwa/icons/icon-192.png','./assets/pwa/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const request=event.request;
  // Pages and JavaScript must be network-first so a deployed security or
  // functionality fix reaches installed PWAs immediately. The cache remains
  // the offline fallback when the device has no connection.
  if(request.mode==='navigate'||request.destination==='script'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok&&new URL(request.url).origin===self.location.origin)caches.open(VERSION).then(cache=>cache.put(request,response.clone()));
      return response;
    }).catch(()=>caches.match(request).then(hit=>hit||caches.match('./onomo-support-modern.html'))));
    return;
  }
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{const copy=response.clone();if(new URL(request.url).origin===self.location.origin)caches.open(VERSION).then(cache=>cache.put(request,copy));return response;})));
});

const CACHE_NAME='onomo-shell-v28';
const SHELL=['./','./index.html','./manifest.webmanifest','./assets/css/app.css','./assets/css/responsive.css','./assets/css/interactions.css','./assets/css/onomo-design.css','./assets/js/ui.js','./assets/js/ui-polish.js','./assets/js/dashboard-polish.js','./assets/js/app.js','./assets/js/runtime-sync.js','./assets/js/i18n.js','./assets/js/locales-data.js','./assets/js/modern-features.js','./assets/js/corrections.js','./assets/js/pwa-update.js','./assets/pwa/onomo-hotels.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  /* Third-party images, fonts and CDNs must be fetched by the browser itself.
     Handling opaque cross-origin responses in the app cache can turn a valid
     remote login photo into an empty/black background. */
  if(new URL(event.request.url).origin!==self.location.origin)return;
  const request=event.request,isNavigation=request.mode==='navigate',isScript=request.destination==='script',isStyle=request.destination==='style';
  // HTML, JavaScript and CSS are network-first so a deployed UI/security fix
  // reaches installed PWAs immediately. Cache remains the offline fallback.
  if(isNavigation||isScript||isStyle){event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok&&new URL(request.url).origin===self.location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request).then(cached=>{if(cached)return cached;return caches.match(new URL(request.url).pathname).then(hit=>hit||(isNavigation?caches.match('./index.html'):undefined));})));return;}
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&new URL(request.url).origin===self.location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;})));
});

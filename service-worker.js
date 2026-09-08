const CACHE_NAME='onomo-shell-v4';
const SHELL=['./','./index.html','./assets/css/app.css','./assets/css/responsive.css','./assets/css/interactions.css','./assets/js/ui.js','./assets/js/app.js'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE_NAME)
    .then(cache=>cache.addAll(SHELL))
    .then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const request=event.request;
  const isNavigation=request.mode==='navigate';
  const isScript=request.destination==='script';

  if(isNavigation||isScript){
    event.respondWith(
      fetch(request,{cache:'no-store'})
        .then(response=>{
          if(response.ok && new URL(request.url).origin===self.location.origin){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(request).then(cached=>cached||caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok && new URL(request.url).origin===self.location.origin){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));
      }
      return response;
    }))
  );
});

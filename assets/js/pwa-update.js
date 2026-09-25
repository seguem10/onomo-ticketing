/* PWA update coordinator: one root worker, immediate activation and one safe reload per build. */
(function(){
  'use strict';
  const BUILD='20260925-7';
  const RELOAD_KEY='onomo_pwa_reloaded_build';

  const hideInstallPrompt=()=>{
    const installed=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
    if(installed)document.getElementById('pwaInstallBar')?.classList.remove('show');
  };

  async function refreshWorker(){
    if(!('serviceWorker' in navigator))return;
    try{
      const registrations=await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration=>{
        const scriptUrl=registration.active?.scriptURL||registration.waiting?.scriptURL||registration.installing?.scriptURL||'';
        /* Old releases used onomo-sw.js. It has the same scope and can retain
           obsolete assets, so retire it explicitly before installing the sole
           canonical worker. */
        if(scriptUrl.includes('/onomo-sw.js'))return registration.unregister();
        return registration.update();
      }));

      const registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'});
      const activateWaiting=()=>registration.waiting?.postMessage({type:'SKIP_WAITING'});
      activateWaiting();
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed')activateWaiting();});
      });
    }catch(error){console.warn('Mise à jour PWA indisponible',error);}
  }

  function reloadAfterWorkerChange(){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      try{
        if(sessionStorage.getItem(RELOAD_KEY)===BUILD)return;
        sessionStorage.setItem(RELOAD_KEY,BUILD);
        window.location.reload();
      }catch(_){window.location.reload();}
    });
  }

  function start(){
    hideInstallPrompt();
    if(!('serviceWorker' in navigator))return;
    reloadAfterWorkerChange();
    refreshWorker();
    window.addEventListener('appinstalled',hideInstallPrompt);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshWorker();});
  }

  window.OnomoPwaUpdate={refresh:refreshWorker,build:BUILD};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

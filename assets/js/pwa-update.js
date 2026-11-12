/* PWA update coordinator: one root worker, immediate activation and one safe reload per build. */
(function(){
  'use strict';
  const BUILD='20261112-login-fixes-1';
  const RELOAD_KEY='onomo_pwa_reloaded_build';

  const hideInstallPrompt=()=>{
    const installed=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
    if(installed)document.getElementById('pwaInstallBar')?.classList.remove('show');
  };

  let refreshing=null;
  function refreshWorker(){
    if(!('serviceWorker' in navigator))return Promise.resolve();
    /* Overlapping refreshes (load + visibilitychange) made update() run while
       another registration step was in progress, which throws InvalidStateError. */
    if(!refreshing)refreshing=doRefreshWorker().finally(()=>{refreshing=null;});
    return refreshing;
  }

  async function doRefreshWorker(){
    try{
      const registrations=await navigator.serviceWorker.getRegistrations();
      /* Old releases used onomo-sw.js. It has the same scope and can retain
         obsolete assets, so retire it explicitly before installing the sole
         canonical worker. */
      await Promise.all(registrations.map(registration=>{
        const scriptUrl=registration.active?.scriptURL||registration.waiting?.scriptURL||registration.installing?.scriptURL||'';
        return scriptUrl.includes('/onomo-sw.js')?registration.unregister().catch(()=>false):null;
      }));

      // register() already checks for a new worker version; only call update()
      // on an idle, active registration to avoid InvalidStateError.
      const registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'});
      if(registration.active&&!registration.installing)await registration.update().catch(()=>{});
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

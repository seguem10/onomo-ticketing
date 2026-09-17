/* ONOMO Support IT - profil fiable
   Le menu Mon profil doit toujours appeler le profil natif de l'application.
   On bypass les anciens wrappers de navigation qui peuvent bloquer les Demandeurs. */
(function(){
  'use strict';

  function openNativeProfile(event){
    const item=event.target?.closest?.('[data-view="profile"]');
    if(!item) return;
    if(typeof window.renderMyProfile!=='function') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    item.classList.add('active');

    const title=document.getElementById('topbarTitle');
    if(title) title.textContent='Mon profil';

    try{
      window.renderMyProfile();
    }catch(err){
      console.error('[ONOMO] renderMyProfile error',err);
      if(typeof window.showToast==='function') window.showToast('Impossible d\'ouvrir Mon profil.','err');
    }
  }

  function boot(){
    if(document.documentElement.__onomoProfileFixInstalled) return;
    document.documentElement.__onomoProfileFixInstalled=true;
    document.addEventListener('click',openNativeProfile,true);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

/* Onomo Support IT: role-based UI guard + voice recognition disabled. */
(function(){
  'use strict';

  const FULL_ACCESS = new Set(['admin','administrateur','it_regional','it_hotel','directeur']);
  const NORMALIZE = value => String(value || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const roleNames = user => {
    const values=[];
    if(user?.role) values.push(user.role);
    if(Array.isArray(user?.roles)) values.push(...user.roles);
    return values.map(NORMALIZE);
  };
  const isAdmin = user => roleNames(user).some(r=>r==='admin'||r==='administrateur');
  const isFullAccess = user => roleNames(user).some(r=>FULL_ACCESS.has(r));

  function removeVoice(){
    try{
      document.getElementById('voiceDictationBtn')?.remove();
      document.getElementById('voiceStatus')?.remove();
      document.querySelectorAll('[data-voice], [data-action="voice"], [aria-label*="voice" i], [aria-label*="vocal" i]').forEach(el=>el.remove());
    }catch(_){}
  }

  function textOf(el){return NORMALIZE(el?.textContent||el?.getAttribute?.('aria-label')||el?.title||'');}

  function hideElement(el){
    if(!el) return;
    el.dataset.onomoRoleHidden='1';
    el.setAttribute('aria-hidden','true');
    el.style.display='none';
  }

  function applyRoleGuard(){
    removeVoice();
    const user=window.currentUser;
    if(!user) return;

    const full=isFullAccess(user);
    const admin=isAdmin(user);

    /* Administration/settings are Administrateur-only. */
    document.querySelectorAll('a,button,[role="button"],nav li,[data-view],[data-section]').forEach(el=>{
      const t=textOf(el);
      const id=NORMALIZE(el.id||el.dataset?.view||el.dataset?.section||'');
      const adminTarget=/\b(settings|parametres|administration|administrateur|gestion des utilisateurs|roles et permissions|users|utilisateurs)\b/.test(t+' '+id);
      const reportTarget=/\b(mon rapport|my report|my reports|mon reporting)\b/.test(t);
      if(reportTarget) hideElement(el);
      if(adminTarget && !admin) hideElement(el);
    });

    /* Non-full-access users only need their own ticket area and ticket creation. */
    if(!full){
      document.querySelectorAll('a,button,[role="button"],nav li,[data-view],[data-section]').forEach(el=>{
        const t=textOf(el), id=NORMALIZE(el.id||el.dataset?.view||el.dataset?.section||'');
        const restricted=/\b(dashboard|tableau de bord|statistiques|statistics|rapports|reports|urgents|urgent|all tickets|tous les tickets|tickets de l'hotel|hotel tickets|utilisateurs|users|settings|parametres|administration)\b/.test(t+' '+id);
        if(restricted) hideElement(el);
      });
    }

    /* Only Administrateur may access Settings by direct view switching. */
    if(!admin && typeof window.switchView==='function' && !window.__onomoRoleGuardWrapped){
      const original=window.switchView;
      window.switchView=function(view,element){
        const v=NORMALIZE(view);
        if(/settings|parametres|administration|users|utilisateurs/.test(v)) return false;
        if(!isFullAccess(window.currentUser) && /dashboard|urgents|reports|report|statistics|statistiques/.test(v)) return false;
        return original.apply(this,arguments);
      };
      window.__onomoRoleGuardWrapped=true;
    }

    document.documentElement.dataset.onomoRole=roleNames(user).join(',');
    document.documentElement.dataset.onomoAdmin=admin?'1':'0';
  }

  function init(){
    removeVoice();
    applyRoleGuard();
    const observer=new MutationObserver(()=>{
      removeVoice();
      if(window.currentUser) applyRoleGuard();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    setTimeout(applyRoleGuard,300);
    setTimeout(applyRoleGuard,1000);
    setTimeout(applyRoleGuard,2500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

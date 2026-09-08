/* Onomo Support IT: role guard, voice recognition disabled, ONOMO branding, robust admin navigation. */
(function(){
  'use strict';

  const FULL_ACCESS = new Set(['admin','administrateur','it_regional','it_hotel','directeur','direction']);
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

  function applyBranding(){
    const logo='assets/pwa/onomo-logo.svg';
    document.title='Onomo Support IT — Service Desk';
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(el=>el.href=logo);
    document.querySelectorAll('img').forEach(img=>{
      const meta=NORMALIZE((img.alt||'')+' '+(img.title||'')+' '+(img.className||'')+' '+(img.id||'')+' '+(img.src||''));
      if(/logo|brand|onomo-icon|icon-192/.test(meta)){
        if(img.getAttribute('src')!==logo) img.src=logo;
        img.alt='ONOMO';
        img.removeAttribute('srcset');
      }
    });
    document.querySelectorAll('[data-logo],.logo,.brand-logo,.app-logo,#logo,#appLogo,#loginLogo').forEach(el=>{
      if(el.tagName==='IMG'){
        if(el.getAttribute('src')!==logo) el.src=logo;
      }else if(!el.querySelector('img')){
        const img=document.createElement('img');
        img.src=logo; img.alt='ONOMO'; img.className='onomo-brand-logo';
        img.style.maxWidth='180px'; img.style.maxHeight='64px'; img.style.objectFit='contain';
        el.prepend(img);
      }
    });
  }

  function textOf(el){return NORMALIZE(el?.textContent||el?.getAttribute?.('aria-label')||el?.title||'');}
  function hideElement(el){if(!el)return;el.dataset.onomoRoleHidden='1';el.setAttribute('aria-hidden','true');el.style.display='none';}
  function showElement(el){if(!el)return;delete el.dataset.onomoRoleHidden;el.removeAttribute('aria-hidden');el.style.removeProperty('display');}

  function applyRoleGuard(){
    removeVoice();
    applyBranding();
    const user=window.currentUser;
    if(!user) return;
    const full=isFullAccess(user), admin=isAdmin(user);

    const adminSection=document.getElementById('sbAdminSec');
    if(adminSection) admin ? showElement(adminSection) : hideElement(adminSection);

    document.querySelectorAll('a,button,[role="button"],nav li,[data-view],[data-section]').forEach(el=>{
      const t=textOf(el), id=NORMALIZE(el.id||el.dataset?.view||el.dataset?.section||'');
      const adminTarget=/\b(settings|parametres|administration|administrateur|gestion des utilisateurs|roles et permissions|users|utilisateurs|hotels-admin)\b/.test(t+' '+id);
      const reportTarget=/\b(mon rapport|my report|my reports|my reporting)\b/.test(t);
      if(reportTarget) hideElement(el);
      if(adminTarget && !admin) hideElement(el);
      if(adminTarget && admin) showElement(el);
    });

    if(!full) document.querySelectorAll('a,button,[role="button"],nav li,[data-view],[data-section]').forEach(el=>{
      const t=textOf(el), id=NORMALIZE(el.id||el.dataset?.view||el.dataset?.section||'');
      if(/\b(dashboard|tableau de bord|statistiques|statistics|rapports|reports|urgents|urgent|all tickets|tous les tickets|tickets de l'hotel|hotel tickets)\b/.test(t+' '+id)) hideElement(el);
    });

    if(!admin && typeof window.switchView==='function' && !window.__onomoRoleGuardWrapped){
      const original=window.switchView;
      window.switchView=function(view,element){
        const v=NORMALIZE(view);
        if(/settings|parametres|administration|users|utilisateurs|hotels-admin/.test(v)) return false;
        if(!isFullAccess(window.currentUser) && /dashboard|urgents|reports|report|statistics|statistiques/.test(v)) return false;
        return original.apply(this,arguments);
      };
      window.__onomoRoleGuardWrapped=true;
    }

    if(admin && typeof window.renderUsers==='function' && !window.__onomoUsersNavReady){
      const usersItems=document.querySelectorAll('[data-view="users"]');
      usersItems.forEach(item=>{
        item.style.display='flex';
        item.onclick=function(e){
          e?.preventDefault?.();
          try{
            if(typeof window.switchView==='function') window.switchView('users',item);
            else window.renderUsers();
          }catch(error){
            const mc=document.getElementById('mainContent');
            if(mc) mc.innerHTML='<div class="alert alert-warn" style="margin:20px">Impossible d\'afficher la gestion des utilisateurs. Rechargez la page. Détail: '+String(error?.message||error)+'</div>';
            console.error('Onomo users navigation:',error);
          }
        };
      });
      window.__onomoUsersNavReady=true;
    }

    document.documentElement.dataset.onomoRole=roleNames(user).join(',');
    document.documentElement.dataset.onomoAdmin=admin?'1':'0';
  }

  function clearUnexpectedLoginOverlays(){
    try{
      if(window.currentUser) return;
      document.querySelectorAll('#mfaLoginOverlay').forEach(el=>el.remove());
      document.querySelectorAll('.overlay.open').forEach(el=>el.classList.remove('open'));
      const login=document.getElementById('loginScreen');
      if(login){login.style.pointerEvents='auto';login.style.zIndex='1';}
      document.querySelectorAll('#loginEmail,#loginPwd,#loginBtn').forEach(el=>{
        el.style.pointerEvents='auto';
        el.removeAttribute('disabled');
      });
    }catch(_){}
  }

  function init(){
    removeVoice();
    applyBranding();
    applyRoleGuard();
    clearUnexpectedLoginOverlays();
    setTimeout(()=>{applyRoleGuard();clearUnexpectedLoginOverlays();},300);
    setTimeout(()=>{applyRoleGuard();clearUnexpectedLoginOverlays();},1000);
    setTimeout(()=>{applyRoleGuard();clearUnexpectedLoginOverlays();},2500);
    setTimeout(()=>{applyRoleGuard();},5000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

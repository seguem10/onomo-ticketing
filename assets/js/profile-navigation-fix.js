/* ONOMO Support IT - profil robuste
   Le profil doit fonctionner pour Administrateur, IT Regional, IT Hotel et Demandeur. */
(function(){
  'use strict';
  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function getUser(){
    try{if(window.currentUser&&typeof window.currentUser==='object')return window.currentUser;}catch(e){}
    try{const raw=localStorage.getItem('currentUser')||localStorage.getItem('dh_current_user')||localStorage.getItem('dh_user');if(raw){const u=JSON.parse(raw);if(u&&typeof u==='object')return u;}}catch(e){}
    return null;
  }
  function fallbackProfile(){
    const u=getUser()||{}; const main=document.getElementById('mainContent'); if(!main)return;
    const name=`${u.prenom||''} ${u.nom||''}`.trim()||u.email||'Utilisateur';
    const role=String(u.role||'').replace(/_/g,' ');
    const hotel=u.hotel||((Array.isArray(u.hotels)&&u.hotels.length)?u.hotels.join(', '):'Non défini');
    main.innerHTML=`<div style="max-width:560px">
      <div class="page-head" style="margin-bottom:18px"><div><h2>Mon profil</h2><p>Informations de votre compte et changement de mot de passe.</p></div></div>
      <div class="card" style="margin-bottom:16px"><div style="font-weight:600;margin-bottom:14px">Informations du compte</div><div style="display:grid;gap:10px">
        <div><div class="form-lbl">Nom</div><div>${esc(name)}</div></div>
        <div><div class="form-lbl">Email</div><div>${esc(u.email||'')}</div></div>
        <div><div class="form-lbl">Rôle</div><div style="text-transform:capitalize">${esc(role)}</div></div>
        <div><div class="form-lbl">Hôtel</div><div>${esc(hotel)}</div></div>
      </div></div>
      <div class="card"><div style="font-weight:600;margin-bottom:14px">Changer mon mot de passe</div>
        <div class="form-g"><label class="form-lbl">Mot de passe actuel</label><input id="pOld" type="password" class="form-ctrl" autocomplete="current-password"></div>
        <div class="form-g"><label class="form-lbl">Nouveau mot de passe</label><input id="pNew" type="password" class="form-ctrl" autocomplete="new-password"></div>
        <div class="form-g"><label class="form-lbl">Confirmer le nouveau mot de passe</label><input id="pConfirm" type="password" class="form-ctrl" autocomplete="new-password"></div>
        <button class="btn-primary" type="button" onclick="typeof window.changeMyPassword==='function' ? window.changeMyPassword() : (typeof window.showToast==='function' ? window.showToast('Fonction indisponible.','err') : null)">Enregistrer le nouveau mot de passe</button>
      </div></div>`;
  }
  function openProfile(event){
    const item=event.target?.closest?.('[data-view="profile"]'); if(!item)return;
    event.preventDefault(); event.stopImmediatePropagation();
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active')); item.classList.add('active');
    const title=document.getElementById('topbarTitle'); if(title)title.textContent='Mon profil';
    try{if(typeof window.renderMyProfile==='function'){window.renderMyProfile();return;}}catch(err){console.warn('[ONOMO] profil natif indisponible, fallback',err);}
    fallbackProfile();
  }
  function boot(){if(document.documentElement.__onomoProfileFixInstalled)return;document.documentElement.__onomoProfileFixInstalled=true;document.addEventListener('click',openProfile,true);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

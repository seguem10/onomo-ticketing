/* ONOMO Support IT - profil robuste
   Fonctionne pour Administrateur, IT Regional, IT Hotel et Demandeur. */
(function(){
  'use strict';

  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

  function localUser(){
    const keys=['onomo_active_session_v1','currentUser','dh_current_user','dh_user'];
    for(const key of keys){
      try{
        const raw=localStorage.getItem(key);
        if(!raw)continue;
        const parsed=JSON.parse(raw);
        const user=parsed?.user||parsed;
        if(user&&typeof user==='object'&&(user.email||user.id))return user;
      }catch(_){ }
    }
    return null;
  }

  async function resolveUser(){
    const local=localUser();
    try{
      const session=await window.OnomoAuth?.getSession?.();
      const authId=session?.user?.id;
      if(authId&&typeof window.sbFetch==='function'){
        const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(authId)}&limit=1`);
        if(Array.isArray(rows)&&rows[0]){
          return {...(local||{}),...rows[0],auth_user_id:authId};
        }
      }
    }catch(error){console.warn('[ONOMO] profil Supabase non chargé',error);}
    return local;
  }

  function roleLabel(role){
    const r=String(role||'').toLowerCase();
    if(r==='it_hotel'||r==='it hotel')return 'IT Hôtel';
    if(r==='it_regional'||r==='it regional')return 'IT Régional';
    if(r==='demandeur'||r==='requester')return 'Demandeur';
    if(r==='admin'||r==='administrateur')return 'Administrateur';
    return role||'Utilisateur';
  }

  function hotelLabel(u){
    if(u.hotel)return u.hotel;
    if(Array.isArray(u.hotels)&&u.hotels.length)return u.hotels.join(', ');
    if(typeof u.hotels==='string'){
      try{const a=JSON.parse(u.hotels);if(Array.isArray(a)&&a.length)return a.join(', ');}catch(_){ }
      return u.hotels;
    }
    return 'Non défini';
  }

  function renderProfile(u){
    const main=document.getElementById('mainContent');
    if(!main)return;
    const name=`${u?.prenom||''} ${u?.nom||''}`.trim()||u?.email||'Utilisateur';
    const email=u?.email||'';
    const role=roleLabel(u?.role);
    const hotel=hotelLabel(u||{});
    main.innerHTML=`
      <div style="max-width:700px">
        <div class="page-head" style="margin-bottom:18px">
          <div><h2>Mon profil</h2><p>Informations de votre compte et changement de mot de passe.</p></div>
        </div>
        <div class="card" style="margin-bottom:16px;padding:18px">
          <div style="font-weight:600;font-size:15px;margin-bottom:16px;color:var(--tx)">Informations du compte</div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px">
            <div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Nom</div><div style="color:var(--tx);font-weight:500">${esc(name)}</div></div>
            <div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Email</div><div style="color:var(--tx);font-weight:500">${esc(email)}</div></div>
            <div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Rôle</div><div style="color:var(--tx);font-weight:500">${esc(role)}</div></div>
            <div><div style="font-size:11px;color:var(--tx2);margin-bottom:4px">Hôtel</div><div style="color:var(--tx);font-weight:500">${esc(hotel)}</div></div>
          </div>
        </div>
        <div class="card" style="padding:18px">
          <div style="font-weight:600;font-size:15px;margin-bottom:16px;color:var(--tx)">Changer mon mot de passe</div>
          <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:var(--tx2);margin-bottom:5px">Mot de passe actuel</label><input id="pOld" type="password" autocomplete="current-password" style="width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);color:var(--tx);outline:none"></div>
          <div style="margin-bottom:14px"><label style="display:block;font-size:11px;color:var(--tx2);margin-bottom:5px">Nouveau mot de passe</label><input id="pNew" type="password" autocomplete="new-password" style="width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);color:var(--tx);outline:none"></div>
          <div style="margin-bottom:16px"><label style="display:block;font-size:11px;color:var(--tx2);margin-bottom:5px">Confirmer le nouveau mot de passe</label><input id="pConfirm" type="password" autocomplete="new-password" style="width:100%;padding:11px 12px;border:1px solid var(--border);border-radius:var(--r);background:var(--surface);color:var(--tx);outline:none"></div>
          <button class="btn-primary" type="button" onclick="if(typeof window.changeMyPassword==='function'){window.changeMyPassword()}else if(typeof window.showToast==='function'){window.showToast('Fonction indisponible.','err')}">Enregistrer le nouveau mot de passe</button>
        </div>
      </div>`;
  }

  async function openProfile(event){
    const item=event.target?.closest?.('[data-view="profile"]');
    if(!item)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    /* Keep the application state on the profile view. The runtime sync runs every 10s and
       uses currentView to decide which screen to redraw. Without this assignment it
       still thinks we are on dashboard and sends the user back there. */
    try{ currentView='profile'; }catch(_){ }
    document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));
    item.classList.add('active');
    const title=document.getElementById('topbarTitle');
    if(title)title.textContent='Mon profil';
    try{
      const user=await resolveUser();
      if(!user)throw new Error('Utilisateur introuvable');
      renderProfile(user);
    }catch(error){
      console.error('[ONOMO] profil robuste impossible',error);
      const main=document.getElementById('mainContent');
      if(main)main.innerHTML='<div class="card" style="padding:20px"><h3 style="margin-bottom:8px">Mon profil</h3><p style="color:var(--tx2)">Impossible de charger les informations du profil. Veuillez actualiser la page.</p></div>';
    }
  }

  function boot(){
    if(document.documentElement.__onomoProfileFixInstalled)return;
    document.documentElement.__onomoProfileFixInstalled=true;
    document.addEventListener('click',openProfile,true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

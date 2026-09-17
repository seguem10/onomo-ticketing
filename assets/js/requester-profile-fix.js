/* ONOMO Support IT - profil Demandeur */
(function(){
  'use strict';
  const roleNorm=r=>({demandeur:'demandeur',requester:'demandeur'}[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function render(){
    const u=window.currentUser||{};
    if(roleNorm(u.role)!=='demandeur')return false;
    const main=document.getElementById('mainContent');
    if(!main)return false;
    const name=`${u.prenom||''} ${u.nom||''}`.trim()||u.email||'Utilisateur';
    const hotel=u.hotel||((Array.isArray(u.hotels)?u.hotels:[]).join(', '))||'Aucun hôtel assigné';
    main.innerHTML=`<div style="max-width:560px"><div class="page-head"><div><h2>Mon profil</h2><p>Informations de votre compte</p></div></div><div class="card" style="padding:20px;margin-top:14px"><div style="display:flex;align-items:center;gap:14px;margin-bottom:20px"><div class="sb-av" style="width:48px;height:48px;font-size:15px">${esc((name.split(/\\s+/).map(x=>x[0]).join('').slice(0,2)||'U').toUpperCase())}</div><div><div style="font-size:16px;font-weight:600">${esc(name)}</div><div style="font-size:11px;color:var(--tx3)">Demandeur</div></div></div><div style="display:grid;gap:14px"><div><div class="form-lbl" style="color:var(--tx2)">Prénom</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${esc(u.prenom)||'—'}</div></div><div><div class="form-lbl" style="color:var(--tx2)">Nom</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${esc(u.nom)||'—'}</div></div><div><div class="form-lbl" style="color:var(--tx2)">Adresse email</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${esc(u.email)||'—'}</div></div><div><div class="form-lbl" style="color:var(--tx2)">Rôle</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">Demandeur</div></div><div><div class="form-lbl" style="color:var(--tx2)">Hôtel assigné</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${esc(hotel)}</div></div></div></div></div>`;
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view==='profile'));
    const title=document.querySelector('.topbar-title');if(title)title.textContent='Mon profil';
    return true;
  }
  function intercept(){
    if(document.documentElement.__onomoRequesterProfile)return;
    document.documentElement.__onomoRequesterProfile=true;
    document.addEventListener('click',event=>{
      const el=event.target.closest('[data-view="profile"]');
      if(!el||roleNorm(window.currentUser?.role)!=='demandeur')return;
      event.preventDefault();event.stopImmediatePropagation();render();
    },true);
  }
  window.renderRequesterProfile=render;
  function boot(){intercept();setTimeout(render,500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

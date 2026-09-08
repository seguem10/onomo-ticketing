/* ONOMO Support IT - UI fixes and role guard */
(function(){
  'use strict';
  const N=v=>String(v||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const roles=u=>{const a=[];if(u?.role)a.push(u.role);if(Array.isArray(u?.roles))a.push(...u.roles);return a.map(N);};
  const admin=u=>roles(u).some(r=>r==='admin'||r==='administrateur');
  const full=u=>roles(u).some(r=>['admin','administrateur','it_regional','it_hotel','directeur','direction'].includes(r));

  function removeVoice(){
    document.getElementById('voiceDictationBtn')?.remove();
    document.getElementById('voiceStatus')?.remove();
    document.querySelectorAll('[data-voice],[data-action="voice"],[aria-label*="voice" i],[aria-label*="vocal" i]').forEach(e=>e.remove());
  }

  function branding(){
    document.title='Onomo Support IT — Service Desk';
    const logo='assets/pwa/onomo-logo.svg';
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(e=>e.href=logo);
  }

  /* Remplace la fonction de rendu utilisateurs par une version robuste.
     L'ancienne version supposait que ROLE_STYLES.it existait et pouvait donc
     planter si Supabase renvoyait "Administrateur" au lieu de "admin". */
  function installUsersView(){
    if(typeof window.renderUsers!=='function' || window.__onomoSafeUsersView)return;
    const safeRenderUsers=function(){
      const mc=document.getElementById('mainContent');
      if(!mc)return;
      const users=Array.isArray(window.DEMO_USERS)?window.DEMO_USERS:[];
      const me=window.currentUser;
      const roleLabel=r=>({admin:'Admin',administrateur:'Administrateur',direction:'Direction',it_regional:'IT Régional',it_hotel:'IT Hôtel'}[N(r)]||String(r||'—'));
      const roleStyle=r=>({
        admin:{bg:'rgba(201,151,42,.12)',color:'#C9972A'},administrateur:{bg:'rgba(201,151,42,.12)',color:'#C9972A'},
        direction:{bg:'rgba(5,150,105,.12)',color:'#059669'},it_regional:{bg:'rgba(124,58,237,.12)',color:'#7C3AED'},
        it_hotel:{bg:'rgba(37,99,235,.12)',color:'#2563EB'}
      }[N(r)]||{bg:'rgba(100,116,139,.12)',color:'#64748B'});
      const desc=r=>({admin:'Accès total au système',administrateur:'Accès total au système',direction:'Consultation et rapports',it_regional:'Gestion de plusieurs hôtels',it_hotel:'Gestion de son hôtel'}[N(r)]||'');
      const initialsSafe=s=>String(s||'?').split(' ').map(x=>x[0]||'').join('').slice(0,2).toUpperCase();
      const escSafe=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      mc.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
          <div><div style="font-size:15px;font-weight:700;color:var(--tx)">Gestion des comptes</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">${users.length} utilisateur(s)</div></div>
          <button class="btn btn-gold" onclick="openModalUser()"><i class="ti ti-user-plus"></i>Ajouter un compte</button>
        </div>
        <div class="card"><div class="card-hdr"><div class="card-title"><i class="ti ti-users"></i>Comptes enregistrés</div></div>
        ${users.length?users.map(u=>{
          const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email||'Utilisateur';
          const rs=roleStyle(u.role); const isMe=me&&u.id===me.id;
          const hotels=Array.isArray(u.hotels)?u.hotels:(typeof u.hotels==='string'?(()=>{try{return JSON.parse(u.hotels||'[]')}catch(_){return[]}})():[]);
          return `<div class="user-row"><div class="user-av" style="background:${rs.bg};color:${rs.color}">${initialsSafe(name)}</div>
            <div class="user-info" style="flex:1"><div class="user-name">${escSafe(name)}${isMe?'<span style="font-size:9px;background:var(--brand-l);color:var(--brand-text);padding:1px 7px;border-radius:10px;margin-left:6px;font-weight:700">VOUS</span>':''}</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:2px">${escSafe(u.email)} · ${u.lastLogin?'Dernière connexion : '+escSafe(window.timeAgo?window.timeAgo(u.lastLogin):u.lastLogin):'Jamais connecté'}</div>
            <div style="font-size:9px;color:var(--tx3);margin-top:2px;font-style:italic">${escSafe(desc(u.role))}</div></div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="role-tag" style="background:${rs.bg};color:${rs.color}">${roleLabel(u.role)}</span>
            ${N(u.role)==='it_hotel'&&u.hotel?`<span style="font-size:10px;color:var(--tx3);background:var(--surface2);padding:2px 8px;border-radius:10px;border:1px solid var(--border)">${escSafe(String(u.hotel).replace('Onomo ','R'))}</span>`:''}
            ${N(u.role)==='it_regional'&&hotels.length?`<span style="font-size:10px;color:var(--purple-t);background:var(--purple-l);padding:2px 8px;border-radius:10px;border:1px solid rgba(124,58,237,.2)">${hotels.length} hôtel(s)</span>`:''}
            <button class="btn btn-outline btn-sm" onclick="openEditUser('${escSafe(u.id)}')"><i class="ti ti-edit"></i></button>
            ${!isMe?`<button class="btn btn-danger btn-sm" onclick="askDeleteUser('${escSafe(u.id)}')"><i class="ti ti-trash"></i></button>`:''}
            </div></div>`;
        }).join(''):'<div class="empty-state"><i class="ti ti-users"></i><p>Aucun utilisateur</p></div>'}
        </div>`;
    };
    window.renderUsers=safeRenderUsers;
    window.__onomoSafeUsersView=true;
  }

  function guard(){
    removeVoice();branding();
    const u=window.currentUser;if(!u)return;
    const a=admin(u);
    const sec=document.getElementById('sbAdminSec');
    if(sec)sec.style.display=a?'block':'none';
    document.querySelectorAll('[data-view="users"],[data-view="hotels-admin"]').forEach(e=>{e.style.display=a?'flex':'none';});
    if(!a){
      document.querySelectorAll('[data-view="settings"]').forEach(e=>e.style.display='none');
    }
    installUsersView();
  }

  function init(){
    removeVoice();branding();guard();
    [300,1000,2500,5000].forEach(ms=>setTimeout(guard,ms));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

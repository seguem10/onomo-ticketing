/* ONOMO Support IT - UI fixes, role guard and user synchronization */
(function(){
  'use strict';
  const N=v=>String(v||'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const adminRole=r=>['admin','administrateur'].includes(N(r));
  function removeVoice(){document.getElementById('voiceDictationBtn')?.remove();document.getElementById('voiceStatus')?.remove();document.querySelectorAll('[data-voice],[data-action="voice"],[aria-label*="voice" i],[aria-label*="vocal" i]').forEach(e=>e.remove());}
  function branding(){document.title='Onomo Support IT — Service Desk';const logo='assets/pwa/onomo-logo.svg';document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(e=>e.href=logo);}
  function readUsers(){try{const raw=localStorage.getItem('dh_users');const users=raw?JSON.parse(raw):[];return Array.isArray(users)?users:[];}catch(_){return[];}}
  function installUsersView(){
    if(window.__onomoSafeUsersView||typeof window.renderUsers!=='function')return;
    window.renderUsers=function(){
      const mc=document.getElementById('mainContent');if(!mc)return;
      const users=readUsers();
      const roleLabel=r=>({admin:'Admin',administrateur:'Administrateur',direction:'Direction',it_regional:'IT Régional',it_hotel:'IT Hôtel'}[N(r)]||String(r||'—'));
      const roleStyle=r=>({admin:{bg:'rgba(201,151,42,.12)',color:'#C9972A'},administrateur:{bg:'rgba(201,151,42,.12)',color:'#C9972A'},direction:{bg:'rgba(5,150,105,.12)',color:'#059669'},it_regional:{bg:'rgba(124,58,237,.12)',color:'#7C3AED'},it_hotel:{bg:'rgba(37,99,235,.12)',color:'#2563EB'}}[N(r)]||{bg:'rgba(100,116,139,.12)',color:'#64748B'});
      const ini=s=>String(s||'?').split(' ').map(x=>x[0]||'').join('').slice(0,2).toUpperCase();
      const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      const hs=u=>Array.isArray(u.hotels)?u.hotels:(typeof u.hotels==='string'?(()=>{try{return JSON.parse(u.hotels||'[]')}catch(_){return[]}})():[]);
      mc.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px"><div><div style="font-size:15px;font-weight:700;color:var(--tx)">Gestion des comptes</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">${users.length} utilisateur(s)</div></div><button class="btn btn-gold" onclick="openModalUser()"><i class="ti ti-user-plus"></i>Ajouter un compte</button></div><div class="card"><div class="card-hdr"><div class="card-title"><i class="ti ti-users"></i>Comptes enregistrés</div></div>${users.length?users.map(u=>{const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email||'Utilisateur';const rs=roleStyle(u.role);const hotels=hs(u);const id=esc(u.id);return `<div class="user-row"><div class="user-av" style="background:${rs.bg};color:${rs.color}">${ini(name)}</div><div class="user-info" style="flex:1"><div class="user-name">${esc(name)}</div><div style="font-size:10px;color:var(--tx3);margin-top:2px">${esc(u.email)} · ${u.lastLogin?'Dernière connexion : '+esc(u.lastLogin):'Jamais connecté'}</div></div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="role-tag" style="background:${rs.bg};color:${rs.color}">${roleLabel(u.role)}</span>${N(u.role)==='it_hotel'&&u.hotel?`<span style="font-size:10px;color:var(--tx3);background:var(--surface2);padding:2px 8px;border-radius:10px;border:1px solid var(--border)">${esc(String(u.hotel).replace('Onomo ',''))}</span>`:''}${N(u.role)==='it_regional'&&hotels.length?`<span style="font-size:10px;color:var(--purple-t);background:var(--purple-l);padding:2px 8px;border-radius:10px;border:1px solid rgba(124,58,237,.2)">${hotels.length} hôtel(s)</span>`:''}<button class="btn btn-outline btn-sm" title="Modifier" onclick="openEditUser('${id}')"><i class="ti ti-edit"></i></button><button class="btn btn-outline btn-sm" title="Supprimer" onclick="window.__onomoDeleteUser('${id}')"><i class="ti ti-trash"></i></button></div></div>`;}).join(''):'<div class="empty-state"><i class="ti ti-users"></i><p>Aucun utilisateur</p></div>'}</div>`;
    };
    window.__onomoSafeUsersView=true;
  }
  async function deleteUser(id){
    const users=readUsers();
    const target=users.find(u=>String(u.id)===String(id));
    if(!target)return;
    if(confirm(`Supprimer l'utilisateur ${target.email||target.nom||''} ?`)!==true)return;
    try{
      if(typeof window.deleteUser==='function' && window.deleteUser!==deleteUser){await window.deleteUser(id);return;}
      const next=users.filter(u=>String(u.id)!==String(id));
      localStorage.setItem('dh_users',JSON.stringify(next));
      renderUsers();
      alert('Utilisateur supprimé de la liste locale. Le compte Auth doit être supprimé côté administration si nécessaire.');
    }catch(e){console.error(e);alert('Impossible de supprimer cet utilisateur.');}
  }
  window.__onomoDeleteUser=deleteUser;
  function syncTicketAssignees(){
    const users=readUsers().filter(u=>u && u.email);
    if(!users.length)return;
    const selects=document.querySelectorAll('select');
    selects.forEach(sel=>{
      const meta=N((sel.id||'')+' '+(sel.name||'')+' '+(sel.getAttribute('aria-label')||'')+' '+(sel.getAttribute('data-field')||'')+' '+(sel.getAttribute('data-name')||''));
      if(!/(assign|assignee|assigned|responsable|technicien|agent|assigne)/.test(meta))return;
      const current=sel.value;
      const marker='__onomo_users_synced';
      if(sel.dataset[marker]==='1'){
        Array.from(sel.options).forEach(o=>{if(o.dataset.onomoUser==='1')o.remove();});
      }
      users.forEach(u=>{
        const value=String(u.id||u.auth_user_id||u.email);
        if(Array.from(sel.options).some(o=>String(o.value)===value||N(o.textContent).includes(N(u.email))))return;
        const opt=document.createElement('option');opt.value=value;opt.textContent=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email;opt.dataset.onomoUser='1';sel.appendChild(opt);
      });
      if(current)sel.value=current;
      sel.dataset[marker]='1';
    });
  }
  function guard(){
    removeVoice();branding();installUsersView();
    const users=readUsers();
    if(users.some(u=>adminRole(u.role))){const sec=document.getElementById('sbAdminSec');if(sec)sec.style.display='block';document.querySelectorAll('[data-view="users"],[data-view="hotels-admin"]').forEach(e=>e.style.display='flex');}
    syncTicketAssignees();
  }
  function init(){guard();[300,1000,2500,5000].forEach(ms=>setTimeout(guard,ms));setInterval(syncTicketAssignees,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

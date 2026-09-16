/* ONOMO Support IT - Gestion utilisateurs admin */
(function(){
  function getUsers(){
    try{if(Array.isArray(window.DEMO_USERS))return window.DEMO_USERS;}catch(_){ }
    try{if(typeof DEMO_USERS!=='undefined'&&Array.isArray(DEMO_USERS))return DEMO_USERS;}catch(_){ }
    return [];
  }
  function roleValues(u){
    const raw=[u?.role,u?.role_name,u?.user_role].concat(Array.isArray(u?.roles)?u.roles:[]).filter(Boolean);
    return raw.flatMap(v=>v&&typeof v==='object'?[v.name,v.role,v.value].filter(Boolean):[v]).map(v=>String(v).toLowerCase().trim());
  }
  function isAdmin(){
    const users=[];
    try{if(window.currentUser)users.push(window.currentUser);}catch(_){ }
    try{if(typeof currentUser!=='undefined'&&currentUser)users.push(currentUser);}catch(_){ }
    try{const e=(document.getElementById('loginEmail')?.value||'').trim().toLowerCase();const u=getUsers().find(x=>String(x.email||'').toLowerCase()===e);if(u)users.push(u);}catch(_){ }
    try{const u=getUsers().find(x=>x?.is_admin===true||x?.isAdmin===true||roleValues(x).some(r=>['admin','administrateur','administrator','admin système'].includes(r)));if(u)users.push(u);}catch(_){ }
    return users.some(u=>u?.is_admin===true||u?.isAdmin===true||roleValues(u).some(r=>['admin','administrateur','administrator','admin système'].includes(r)));
  }
  function setUsersView(active){
    window.__onomoUsersView=!!active;
    try{window.currentView=active?'users':window.currentView;}catch(_){ }
    if(active){try{window.eval('currentView="users"');}catch(_){}}
  }
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  async function loadUsers(){
    let rows=getUsers().slice();
    try{
      if(typeof window.sbOK==='function'&&window.sbOK()&&typeof window.sbFetch==='function'){
        const remote=await window.sbFetch('utilisateurs?select=id,email,prenom,nom,role,hotel,hotels,must_change_password,mfa_enabled,created_at&order=created_at.desc&limit=500');
        if(Array.isArray(remote)&&remote.length)rows=remote;
      }
    }catch(_){ }
    return rows;
  }
  function renderRows(rows){
    const q=(window.searchQ||'').toLowerCase().trim();
    const filtered=q?rows.filter(u=>[u.prenom,u.nom,u.email,u.role,u.hotel].join(' ').toLowerCase().includes(q)):rows;
    if(!filtered.length)return '<div style="padding:35px;text-align:center;color:var(--tx3)">Aucun utilisateur trouvé.</div>';
    return '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">Utilisateur</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">Rôle</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">Hôtel</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">Sécurité</th><th style="text-align:right;padding:10px;border-bottom:1px solid var(--border)">Actions</th></tr></thead><tbody>'+filtered.map(u=>{const id=esc(u.id||'');const name=[u.prenom,u.nom].filter(Boolean).join(' ')||u.email||'Utilisateur';const role=roleValues(u)[0]||u.role||'—';const security=u.mfa_enabled?'MFA':'Standard';let actions='';try{if(typeof openEditUser==='function'||typeof window.openEditUser==='function')actions+='<button class="btn btn-outline btn-sm" onclick="openEditUser(\''+id+'\')"><i class="ti ti-edit"></i>Modifier</button> ';}catch(_){ }try{if(typeof deleteUser==='function'||typeof window.deleteUser==='function')actions+='<button class="btn btn-danger btn-sm" onclick="deleteUser(\''+id+'\')"><i class="ti ti-trash"></i></button>';}catch(_){ }return '<tr><td style="padding:11px 10px;border-bottom:1px solid var(--border)"><strong>'+esc(name)+'</strong><div style="font-size:11px;color:var(--tx3)">'+esc(u.email||'')+'</div></td><td style="padding:11px 10px;border-bottom:1px solid var(--border)"><span class="role-tag">'+esc(role)+'</span></td><td style="padding:11px 10px;border-bottom:1px solid var(--border)">'+esc(u.hotel||'Tous les hôtels')+'</td><td style="padding:11px 10px;border-bottom:1px solid var(--border)">'+security+(u.must_change_password?' · Mot de passe à changer':'')+'</td><td style="padding:11px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap">'+actions+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  async function render(){
    if(!isAdmin()){window.showToast?.('Accès non autorisé.','err');return;}
    setUsersView(true);
    const main=document.getElementById('mainContent');if(!main)return;
    main.innerHTML='<div class="card"><div class="card-hdr"><div><div class="card-title">Utilisateurs</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">Gestion des comptes, rôles et hôtels assignés</div></div><div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" id="usersRefreshBtn"><i class="ti ti-refresh"></i>Actualiser</button><button class="btn btn-gold btn-sm" id="usersCreateBtn"><i class="ti ti-user-plus"></i>Nouvel utilisateur</button></div></div><div id="usersPageList" style="padding:0 18px 18px"><div style="padding:30px;text-align:center;color:var(--tx3)">Chargement...</div></div></div>';
    const list=document.getElementById('usersPageList');
    const rows=await loadUsers();
    if(list)list.innerHTML=renderRows(rows);
    document.getElementById('usersRefreshBtn')?.addEventListener('click',render);
    document.getElementById('usersCreateBtn')?.addEventListener('click',()=>{if(typeof window.openModalUser==='function')window.openModalUser();else window.showToast?.('Formulaire utilisateur indisponible.','err');});
    const search=document.getElementById('searchInput');if(search){search.oninput=()=>{window.searchQ=search.value;loadUsers().then(r=>{const box=document.getElementById('usersPageList');if(box)box.innerHTML=renderRows(r);});};}
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.getAttribute('data-view')==='users'));
    const title=document.querySelector('.topbar-title');if(title)title.textContent='Utilisateurs';
  }
  window.onomoOpenUsers=render;
  window.renderUsers=render;
  function wrapUserActions(){
    if(typeof window.submitUser==='function'&&!window.submitUser.__usersRefreshWrapped){
      const original=window.submitUser;
      const wrapped=async function(){const result=await original.apply(this,arguments);setTimeout(()=>render(),250);return result;};
      wrapped.__usersRefreshWrapped=true;window.submitUser=wrapped;
    }
    if(typeof window.deleteUser==='function'&&!window.deleteUser.__usersRefreshWrapped){
      const original=window.deleteUser;
      const wrapped=async function(){const result=await original.apply(this,arguments);setTimeout(()=>render(),250);return result;};
      wrapped.__usersRefreshWrapped=true;window.deleteUser=wrapped;
    }
  }
  function bind(){
    const item=document.querySelector('[data-view="users"]');if(!item)return;
    item.style.display=isAdmin()?'flex':'';
    if(item.dataset.usersFixBound==='1'){wrapUserActions();return;}
    item.dataset.usersFixBound='1';
    item.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();render();},true);
    wrapUserActions();
  }
  function forceSwitch(){
    if(typeof window.switchView!=='function'||window.switchView.__usersPageFix)return;
    const original=window.switchView;
    const wrapped=function(view,el){if(view==='users'){render();return;}setUsersView(false);return original.apply(this,arguments);};
    wrapped.__usersPageFix=true;window.switchView=wrapped;
  }
  function init(){bind();forceSwitch();setTimeout(()=>{bind();forceSwitch();},100);setTimeout(()=>{bind();forceSwitch();},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

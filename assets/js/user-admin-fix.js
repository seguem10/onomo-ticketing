/* ONOMO Support IT - Gestion utilisateurs admin */
(function(){
  const t=(key,fallback)=>{const value=window.OnomoI18n?.t(key);return value&&value!==key?value:fallback;};
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
    const u=window.currentUser||null;
    return !!(u&&(u.is_admin===true||u.isAdmin===true||roleValues(u).some(r=>['admin','administrateur','administrator','admin système'].includes(r))));
  }
  function isSupport(){
    const u=window.currentUser||{};
    return isAdmin()||roleValues(u).some(r=>['it_regional','it regional','it_hotel','it hotel'].includes(r));
  }
  function setUsersView(active){
    window.__onomoUsersView=!!active;
  }
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  async function loadUsers(){
    let rows=getUsers().slice();
    try{
      if(typeof window.sbOK==='function'&&window.sbOK()&&typeof window.sbFetch==='function'){
        const remote=isAdmin()
          ?await window.sbFetch('utilisateurs?select=id,auth_user_id,email,prenom,nom,role,hotel,hotels,must_change_password,mfa_enabled,created_at&order=created_at.desc&limit=500')
          :await window.sbFetch('rpc/get_support_directory',{method:'POST',body:'{}',prefer:'return=representation'});
        if(Array.isArray(remote)&&remote.length)rows=remote;
      }
    }catch(_){ }
    return rows;
  }
  function renderRows(rows){
    const q=(window.searchQ||'').toLowerCase().trim();
    const filtered=q?rows.filter(u=>[u.prenom,u.nom,u.email,u.role,u.hotel].join(' ').toLowerCase().includes(q)):rows;
    if(!filtered.length)return '<div style="padding:35px;text-align:center;color:var(--tx3)">'+t('no_user_found','Aucun utilisateur trouvé.')+'</div>';
    const admin=isAdmin();
    const cell='padding:11px 10px;border-bottom:1px solid var(--border)';
    const headings='<thead><tr><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">'+t('user','Utilisateur')+'</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">'+t('role','Rôle')+'</th><th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">'+t('hotel','Hôtel')+'</th>'+(admin?'<th style="text-align:left;padding:10px;border-bottom:1px solid var(--border)">'+t('account_security','Sécurité')+'</th><th style="text-align:right;padding:10px;border-bottom:1px solid var(--border)">'+t('actions','Actions')+'</th>':'')+'</tr></thead>';
    const body=filtered.map(u=>{
      const id=esc(u.id||''),target=esc(u.auth_user_id||u.id||'');
      const name=[u.prenom,u.nom].filter(Boolean).join(' ')||u.email||t('user','Utilisateur');
      const role=roleValues(u)[0]||u.role||'—';
      const security=u.mfa_enabled?'MFA obligatoire':t('standard','Standard');
      let actions='';
      if(admin){
        if(typeof window.openEditUser==='function')actions+='<button class="btn btn-outline btn-sm" onclick="openEditUser(\''+id+'\')"><i class="ti ti-edit"></i>'+t('edit','Modifier')+'</button> ';
        actions+='<button class="btn btn-outline btn-sm" onclick="window.OnomoMfa?.setRequired(\''+target+'\','+(u.mfa_enabled?'false':'true')+')"><i class="ti ti-shield-'+(u.mfa_enabled?'off':'check')+'"></i>'+ (u.mfa_enabled?'Retirer MFA':'Exiger MFA')+'</button> ';
        if(typeof window.deleteUser==='function')actions+='<button class="btn btn-danger btn-sm" onclick="deleteUser(\''+id+'\')"><i class="ti ti-trash"></i></button>';
      }
      return '<tr><td style="'+cell+'"><strong>'+esc(name)+'</strong><div style="font-size:11px;color:var(--tx3)">'+esc(u.email||'')+'</div></td><td style="'+cell+'"><span class="role-tag">'+esc(role)+'</span></td><td style="'+cell+'">'+esc(u.hotel||t('all_hotels','Tous les hôtels'))+'</td>'+(admin?'<td style="'+cell+'">'+security+(u.must_change_password?' · '+t('password_change_required','Mot de passe à changer'):'')+'</td><td style="'+cell+';text-align:right;white-space:nowrap">'+actions+'</td>':'')+'</tr>';
    }).join('');
    return '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse">'+headings+'<tbody>'+body+'</tbody></table></div>';
  }
  async function render(){
    if(!isSupport()){window.showToast?.(t('access_denied','Accès non autorisé.'),'err');return;}
    setUsersView(true);
    const main=document.getElementById('mainContent');if(!main)return;
    main.innerHTML='<div class="card"><div class="card-hdr"><div><div class="card-title">'+t('users','Utilisateurs')+'</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">'+(isAdmin()?t('user_management_description','Gestion des comptes, rôles et hôtels assignés'):'Annuaire des équipes IT, IT régional et administrateurs')+'</div></div><div style="display:flex;gap:8px"><button class="btn btn-outline btn-sm" id="usersRefreshBtn"><i class="ti ti-refresh"></i>'+t('refresh','Actualiser')+'</button>'+(isAdmin()?'<button class="btn btn-gold btn-sm" id="usersCreateBtn"><i class="ti ti-user-plus"></i>'+t('new_user','Nouvel utilisateur')+'</button>':'')+'</div></div><div id="usersPageList" style="padding:0 18px 18px"><div style="padding:30px;text-align:center;color:var(--tx3)">'+t('loading','Chargement...')+'</div></div></div>';
    const list=document.getElementById('usersPageList');
    const rows=await loadUsers();
    if(list)list.innerHTML=renderRows(rows);
    document.getElementById('usersRefreshBtn')?.addEventListener('click',render);
    document.getElementById('usersCreateBtn')?.addEventListener('click',()=>{if(typeof window.openModalUser==='function')window.openModalUser();else window.showToast?.(t('user_form_unavailable','Formulaire utilisateur indisponible.'),'err');});
    const search=document.getElementById('searchInput');if(search){search.oninput=()=>{window.searchQ=search.value;loadUsers().then(r=>{const box=document.getElementById('usersPageList');if(box)box.innerHTML=renderRows(r);});};}
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active',i.getAttribute('data-view')==='users'));
    const title=document.querySelector('.topbar-title');if(title)title.textContent=t('users','Utilisateurs');
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
    item.style.display=isSupport()?'flex':'none';
    if(item.dataset.usersFixBound==='1'){wrapUserActions();return;}
    item.dataset.usersFixBound='1';
    /* The static menu calls openUsersView() directly.  Do not attach a second
       click handler: legacy wrappers may run in a different order and undo a
       successful route change during a background ticket refresh. */
    wrapUserActions();
  }
  function forceSwitch(){
    if(typeof window.switchView!=='function'||window.switchView.__usersPageFix)return;
    const original=window.switchView;
    const wrapped=function(view,el){
      if(view==='users'){
        setUsersView(true);
        return window.openUsersView?.(el);
      }
      setUsersView(false);
      return original.apply(this,arguments);
    };
    wrapped.__usersPageFix=true;window.switchView=wrapped;
  }
  function init(){bind();forceSwitch();setTimeout(()=>{bind();forceSwitch();},100);setTimeout(()=>{bind();forceSwitch();},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

/* ONOMO Support IT - Correctif gestion des utilisateurs */
(function(){
  function getUser(){
    if(window.currentUser)return window.currentUser;
    try{const email=(document.getElementById('loginEmail')?.value||'').trim().toLowerCase();if(email&&Array.isArray(window.DEMO_USERS))return window.DEMO_USERS.find(u=>String(u.email||'').toLowerCase()===email)||null;}catch(_){ }
    return null;
  }
  function roleValues(u){
    const raw=[u?.role,u?.role_name,u?.user_role].concat(Array.isArray(u?.roles)?u.roles:[]).filter(Boolean);
    return raw.flatMap(v=>v&&typeof v==='object'?[v.name,v.role,v.value].filter(Boolean):[v]).map(v=>String(v).toLowerCase().trim());
  }
  function isAdmin(){const u=getUser()||{};return !!(u.is_admin===true||u.isAdmin===true||roleValues(u).some(v=>['admin','administrateur','administrator','admin système'].includes(v)));}
  function openUsers(el){
    if(!isAdmin()){setTimeout(()=>{if(isAdmin())openUsers(el);else window.showToast?.('Accès non autorisé.','err');},250);return false;}
    window.currentView='users';window.filterStat='tous';window.searchQ='';
    const search=document.getElementById('searchInput');if(search)search.value='';
    document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));
    const target=el||document.querySelector('[data-view="users"]');if(target)target.classList.add('active');
    const title=document.querySelector('.topbar-title');if(title)title.textContent='Utilisateurs';
    if(typeof window.renderUsers==='function'){window.renderUsers();return true;}
    window.showToast?.('La gestion des utilisateurs n’est pas disponible.','err');return false;
  }
  window.onomoOpenUsers=openUsers;
  function bind(){
    const item=document.querySelector('[data-view="users"]');if(!item||item.dataset.usersFixBound==='1')return;
    item.dataset.usersFixBound='1';
    item.addEventListener('click',function(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openUsers(item);},true);
    item.style.display=isAdmin()?'flex':'';
  }
  function wrapSwitch(){
    if(typeof window.switchView!=='function'||window.switchView.__usersFixWrapped)return;
    const original=window.switchView;const wrapped=function(view,el){if(view==='users')return openUsers(el);return original.apply(this,arguments);};
    wrapped.__usersFixWrapped=true;window.switchView=wrapped;
  }
  function init(){bind();wrapSwitch();setTimeout(()=>{bind();wrapSwitch();},100);setTimeout(()=>{bind();wrapSwitch();},500);setInterval(()=>{bind();wrapSwitch();},2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
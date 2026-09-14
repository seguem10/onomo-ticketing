(function(){
  'use strict';
  const role=()=>String(typeof currentUser!=='undefined'?currentUser?.role:window.currentUser?.role||'').toLowerCase();
  function add(){
    if(!['admin','administrateur'].includes(role()))return;
    const sec=document.getElementById('sbAdminSec');
    if(!sec||document.getElementById('onomoCreateRequesterNav'))return;
    const item=document.createElement('div');
    item.id='onomoCreateRequesterNav';item.className='nav-item';item.innerHTML='<i class="ti ti-user-plus"></i><span>Créer un demandeur</span>';
    item.onclick=()=>window.OnomoAutomation?.requesterModal?.();
    sec.appendChild(item);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{add();new MutationObserver(add).observe(document.body,{childList:true,subtree:true})},{once:true});
  else {add();new MutationObserver(add).observe(document.body,{childList:true,subtree:true});}
})();
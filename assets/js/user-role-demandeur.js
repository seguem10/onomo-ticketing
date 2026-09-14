/* ONOMO Support IT - Demandeur is a normal role in Utilisateurs */
(function(){
  'use strict';

  const norm=value=>String(value??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const roleIds=['urole','userrole','role','u-role'];
  const roleHints=['role','roles','profil','profile'];

  function isRoleSelect(select){
    if(!select || select.tagName!=='SELECT') return false;
    const id=norm(`${select.id||''} ${select.name||''} ${select.getAttribute('aria-label')||''}`);
    if(roleIds.includes(norm(select.id)) || roleHints.some(h=>id.includes(h))) return true;
    const values=Array.from(select.options||[]).map(o=>norm(`${o.value} ${o.textContent}`));
    return values.some(v=>v.includes('admin')) && values.some(v=>v.includes('it'));
  }

  function addRequesterRole(){
    document.querySelectorAll('select').forEach(select=>{
      if(!isRoleSelect(select)) return;
      const exists=Array.from(select.options||[]).some(option=>norm(option.value)==='demandeur'||norm(option.textContent)==='demandeur');
      if(exists) return;
      const option=document.createElement('option');
      option.value='demandeur';
      option.textContent='Demandeur';
      select.appendChild(option);
    });
  }

  function removeSeparateRequesterUi(){
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      const text=norm(el.textContent);
      if(!text) return;
      if(text.includes('creer un demandeur')||text.includes('creer le demandeur')||text.includes('ajouter un demandeur')){
        const wrapper=el.closest('.nav-item,.card,.toolbar,.actions,.form-actions')||el;
        if(wrapper!==document.body) wrapper.remove();
      }
    });
    document.getElementById('onomoRequesterModal')?.remove();
  }

  function apply(){
    addRequesterRole();
    removeSeparateRequesterUi();
  }

  function observe(){
    apply();
    new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();
})();

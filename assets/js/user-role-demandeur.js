/* ONOMO Support IT - Demandeur is a normal role in Utilisateurs */
(function(){
  'use strict';

  const normalize=value=>String(value??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const roleLabels=['administrateur','admin','directeur','it regional','it hotel','demandeur','requester'];

  function isRoleSelect(select){
    if(!select || select.tagName!=='SELECT') return false;
    const text=Array.from(select.options||[]).map(o=>normalize(`${o.value} ${o.textContent}`)).join(' | ');
    const id=normalize(`${select.id||''} ${select.name||''} ${select.getAttribute('aria-label')||''}`);
    const matches=roleLabels.filter(r=>text.includes(r)).length;
    return matches>=2 || /role|roles|profil/.test(id);
  }

  function addRequesterRole(){
    document.querySelectorAll('select').forEach(select=>{
      if(!isRoleSelect(select)) return;
      if(Array.from(select.options).some(o=>normalize(o.value)==='demandeur'||normalize(o.textContent)==='demandeur')) return;
      const option=document.createElement('option');
      option.value='demandeur';
      option.textContent='Demandeur';
      select.appendChild(option);
      select.dispatchEvent(new Event('change',{bubbles:true}));
    });
  }

  function removeSeparateRequesterUi(){
    document.querySelectorAll('button,a,[role="button"]').forEach(el=>{
      const text=normalize(el.textContent);
      if(!text) return;
      if(text.includes('creer un demandeur')||text.includes('creer le demandeur')||text.includes('ajouter un demandeur')){
        const wrapper=el.closest('.nav-item,.card,.toolbar,.actions,.form-actions')||el;
        if(wrapper!==document.body) wrapper.remove();
      }
    });
    const modal=document.getElementById('onomoRequesterModal');
    if(modal) modal.remove();
  }

  function apply(){
    addRequesterRole();
    removeSeparateRequesterUi();
  }

  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  });

  if(document.readyState!=='loading'){
    apply();
    new MutationObserver(apply).observe(document.body,{childList:true,subtree:true});
  }
})();

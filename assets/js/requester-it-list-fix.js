/* ONOMO Support IT - Demandeur: liste IT */
(function(){
  'use strict';
  const roleNorm=r=>({demandeur:'demandeur',requester:'demandeur'}[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());
  async function fillRequesterAgent(){
    if(window.OnomoRequesterScope?.refresh){await window.OnomoRequesterScope.refresh();return;}
    const u=window.currentUser;
    if(roleNorm(u?.role)!=='demandeur')return;
    const select=document.getElementById('ntAgent');
    if(!select)return;
    let its=[];
    try{
      if(typeof window.sbFetch==='function'){
        const rows=await window.sbFetch('rpc/requester_available_it',{method:'POST',body:'{}',prefer:'return=representation'});
        its=Array.isArray(rows)?rows:[];
      }
    }catch(e){console.warn('ONOMO liste IT:',e);}
    select.innerHTML='<option value="">— Sélectionner un IT —</option>';
    its.forEach(x=>{
      const name=`${x.prenom||''} ${x.nom||''}`.trim();
      if(!name)return;
      const option=document.createElement('option');
      option.value=x.assigned_to||'';
      option.dataset.assignedTo=x.assigned_to||'';
      option.dataset.assigneeName=name;
      option.textContent=name;
      select.appendChild(option);
    });
    if(its[0])select.value=its[0].assigned_to||'';
  }
  function loadProfileFix(){
    if(document.querySelector('script[data-onomo-requester-profile-fix]'))return;
    const s=document.createElement('script');
    s.src='assets/js/requester-profile-fix.js?v=20260917b';
    s.dataset.onomoRequesterProfileFix='1';
    document.body.appendChild(s);
  }
  function boot(){
    loadProfileFix();
    setTimeout(fillRequesterAgent,500);
    setTimeout(fillRequesterAgent,1500);
    setTimeout(fillRequesterAgent,3000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

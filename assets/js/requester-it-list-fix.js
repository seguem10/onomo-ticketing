/* ONOMO Support IT - Demandeur: liste IT */
(function(){
  'use strict';
  const roleNorm=r=>({demandeur:'demandeur',requester:'demandeur'}[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());
  async function fillRequesterAgent(){
    const u=window.currentUser;
    if(roleNorm(u?.role)!=='demandeur')return;
    const select=document.getElementById('ntAgent');
    if(!select)return;
    let its=[];
    try{
      if(typeof window.sbFetch==='function'){
        const rows=await window.sbFetch('rpc/requester_it_users',{method:'POST',body:'{}',prefer:'return=representation'});
        its=Array.isArray(rows)?rows:[];
      }
    }catch(e){console.warn('ONOMO liste IT:',e);}
    select.innerHTML='<option value="">— Sélectionner un IT —</option>';
    its.forEach(x=>{
      const name=`${x.prenom||''} ${x.nom||''}`.trim();
      if(!name)return;
      const scope=x.role==='it_hotel'?x.hotel:(Array.isArray(x.hotels)?x.hotels:[]).join(', ');
      const option=document.createElement('option');
      option.value=name;
      option.textContent=name+(scope?` (${scope})`:'');
      select.appendChild(option);
    });
    if(its[0])select.value=`${its[0].prenom||''} ${its[0].nom||''}`.trim();
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

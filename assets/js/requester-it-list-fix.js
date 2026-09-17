/* ONOMO Support IT - liste des IT pour les Demandeurs */
(function(){
  'use strict';

  const roleNorm=r=>({
    admin:'admin', administrateur:'admin',
    'it régional':'it_regional', it_regional:'it_regional',
    'it hotel':'it_hotel', it_hotel:'it_hotel',
    demandeur:'demandeur', requester:'demandeur'
  }[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());

  const hotelsOf=u=>{
    if(Array.isArray(u?.hotels)) return u.hotels.filter(Boolean);
    if(typeof u?.hotels==='string'){
      try{const v=JSON.parse(u.hotels);return Array.isArray(v)?v.filter(Boolean):[];}catch(_){return u.hotels?[u.hotels]:[];}
    }
    return [];
  };

  async function loadUsers(){
    if(typeof window.sbFetch!=='function') return [];
    try{
      const rows=await window.sbFetch('utilisateurs?order=prenom.asc,nom.asc&limit=500');
      return Array.isArray(rows)?rows:[];
    }catch(e){console.warn('ONOMO IT users load:',e);return [];}
  }

  async function fillRequesterAgent(){
    const u=window.currentUser;
    if(roleNorm(u?.role)!=='demandeur') return;
    const hotel=String(u.hotel||'').trim();
    const select=document.getElementById('ntAgent');
    if(!select) return;

    const users=await loadUsers();
    const its=users.filter(x=>{
      const r=roleNorm(x.role);
      if(r==='it_hotel') return String(x.hotel||'').trim()===hotel;
      if(r==='it_regional') return hotelsOf(x).includes(hotel);
      return false;
    });

    select.innerHTML='<option value="">— Sélectionner un IT —</option>';
    its.forEach(x=>{
      const name=`${x.prenom||''} ${x.nom||''}`.trim();
      if(!name)return;
      const r=roleNorm(x.role);
      const scope=r==='it_hotel'?x.hotel:hotelsOf(x).join(', ');
      const option=document.createElement('option');
      option.value=name;
      option.textContent=name+(scope?` (${scope})`:'');
      select.appendChild(option);
    });
    if(its[0]){
      const first=`${its[0].prenom||''} ${its[0].nom||''}`.trim();
      select.value=first;
    }
  }

  function boot(){
    setTimeout(fillRequesterAgent,300);
    setTimeout(fillRequesterAgent,1200);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

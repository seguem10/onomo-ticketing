/* ONOMO Support IT - correctifs Demandeur et Mon profil */
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
    if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function') return [];
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

  function renderProfile(){
    const u=window.currentUser||{};
    const role=roleNorm(u.role);
    const name=`${u.prenom||''} ${u.nom||''}`.trim()||u.email||'Utilisateur';
    const hotel=u.hotel||hotelsOf(u).join(', ')||'Aucun hôtel assigné';
    const main=document.getElementById('mainContent');
    if(!main)return;

    main.innerHTML=`
      <div style="max-width:620px">
        <div class="page-head" style="margin-bottom:16px">
          <div><h2>Mon profil</h2><p>Informations de votre compte</p></div>
        </div>
        <div class="card" style="padding:20px">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            <div class="sb-av" style="width:48px;height:48px;font-size:15px">${String(name).split(/\s+/).map(x=>x[0]||'').slice(0,2).join('').toUpperCase()}</div>
            <div>
              <div style="font-size:16px;font-weight:600">${name}</div>
              <div style="font-size:12px;color:var(--tx2)">${u.email||''}</div>
            </div>
          </div>
          <div style="display:grid;gap:12px">
            <div><div class="form-lbl" style="color:var(--tx2)">Prénom</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${u.prenom||'—'}</div></div>
            <div><div class="form-lbl" style="color:var(--tx2)">Nom</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${u.nom||'—'}</div></div>
            <div><div class="form-lbl" style="color:var(--tx2)">Email</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${u.email||'—'}</div></div>
            <div><div class="form-lbl" style="color:var(--tx2)">Rôle</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${role==='demandeur'?'Demandeur':u.role||'—'}</div></div>
            <div><div class="form-lbl" style="color:var(--tx2)">Hôtel</div><div class="form-ctrl" style="color:var(--tx);background:var(--surface2)">${hotel}</div></div>
          </div>
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px">Sécurité</div>
            <div style="font-size:12px;color:var(--tx2)">La modification du mot de passe reste disponible depuis votre profil.</div>
          </div>
        </div>
      </div>`;
  }

  function installProfile(){
    const original=window.switchView;
    if(typeof original!=='function'||original.__requesterProfileFix)return false;
    const wrapped=function(view,el){
      if(view==='profile'){
        try{
          window.currentView='profile';
          document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
          if(el)el.classList.add('active');
          const title=document.querySelector('.topbar-title');
          if(title)title.textContent='Mon profil';
          renderProfile();
          return;
        }catch(e){console.error('ONOMO profil:',e);}
      }
      return original.apply(this,arguments);
    };
    wrapped.__requesterProfileFix=true;
    window.switchView=wrapped;
    try{window.eval('switchView=window.switchView');}catch(_){ }
    return true;
  }

  async function boot(){
    installProfile();
    const u=window.currentUser;
    if(roleNorm(u?.role)==='demandeur'){
      setTimeout(fillRequesterAgent,300);
      setTimeout(fillRequesterAgent,1200);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

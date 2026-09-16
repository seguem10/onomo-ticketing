/* ONOMO Support IT - synchronisation utilisateurs + ticket Demandeur */
(function(){
  'use strict';
  const normRole=r=>({admin:'admin',administrateur:'admin','administrateur système':'admin',it_regional:'it_regional','it régional':'it_regional','it hotel':'it_hotel',it_hotel:'it_hotel',demandeur:'demandeur',requester:'demandeur'}[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());
  function normHotels(v){if(Array.isArray(v))return v.filter(Boolean);if(typeof v==='string'){try{const p=JSON.parse(v);return Array.isArray(p)?p.filter(Boolean):[];}catch(_){return v?[v]:[];}}return []}
  function norm(u){if(!u)return u;return {...u,role:normRole(u.role),hotels:normHotels(u.hotels)}}
  function allUsers(){try{return Array.isArray(window.DEMO_USERS)?window.DEMO_USERS.map(norm):[]}catch(_){return []}}
  async function refreshProfile(){
    const u=norm(window.currentUser);if(!u||typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function')return u;
    try{
      const field=u.auth_user_id?'auth_user_id':'id',value=u.auth_user_id||u.id;
      const rows=await window.sbFetch(`utilisateurs?${field}=eq.${encodeURIComponent(value)}&limit=1`);
      if(rows?.[0]){
        const fresh=norm(typeof window.dbRowToUser==='function'?window.dbRowToUser(rows[0]):rows[0]);
        window.currentUser={...u,...fresh,auth_user_id:rows[0].auth_user_id||u.auth_user_id};
        if(Array.isArray(window.DEMO_USERS)){const i=window.DEMO_USERS.findIndex(x=>x.id===fresh.id);if(i>=0)window.DEMO_USERS[i]=fresh;else window.DEMO_USERS.push(fresh);window.saveUsers?.(window.DEMO_USERS)}
      }
    }catch(e){console.warn('ONOMO profil non synchronisé',e)}
    return norm(window.currentUser);
  }
  function fillRequesterTicket(){
    const u=norm(window.currentUser);if(!u||u.role!=='demandeur')return;
    const hotel=u.hotel||'';
    const hs=document.getElementById('ntHotel');
    if(hs){hs.innerHTML='';const o=document.createElement('option');o.value=hotel;o.textContent=hotel||'— Aucun hôtel assigné —';o.disabled=!hotel;hs.appendChild(o);hs.value=hotel}
    const a=document.getElementById('ntAgent');
    if(a){
      a.innerHTML="<option value=''>— Sélectionner un IT —</option>";
      const us=allUsers();
      const matching=us.filter(x=>(x.role==='it_hotel'&&x.hotel===hotel)||(x.role==='it_regional'&&normHotels(x.hotels).includes(hotel)));
      const pool=matching.length?matching:us.filter(x=>x.role==='it_hotel'||x.role==='it_regional');
      pool.forEach(x=>{const name=`${x.prenom||''} ${x.nom||''}`.trim();if(!name)return;const scope=x.role==='it_hotel'?x.hotel:normHotels(x.hotels).join(', ');const o=document.createElement('option');o.value=name;o.textContent=name+(scope?` (${scope})`:'');a.appendChild(o)});
      if(matching[0])a.value=`${matching[0].prenom||''} ${matching[0].nom||''}`.trim();
    }
  }
  async function prepareRequester(){await refreshProfile();fillRequesterTicket()}
  const oldOpen=window.openNewTicket;
  if(typeof oldOpen==='function')window.openNewTicket=async function(){await prepareRequester();return oldOpen.apply(this,arguments)};
  const oldPopulate=window.populateSelects;
  if(typeof oldPopulate==='function')window.populateSelects=function(){const r=oldPopulate.apply(this,arguments);if(norm(window.currentUser)?.role==='demandeur')fillRequesterTicket();return r};
  const oldSubmitTicket=window.submitNewTicket;
  if(typeof oldSubmitTicket==='function')window.submitNewTicket=async function(){if(norm(window.currentUser)?.role==='demandeur'){await prepareRequester();if(!document.getElementById('ntHotel')?.value){window.showToast?.('Votre compte Demandeur n’a aucun hôtel assigné.','err');return}if(!document.getElementById('ntAgent')?.value){window.showToast?.('Aucun IT disponible pour cet hôtel.','err');return}}return oldSubmitTicket.apply(this,arguments)};
  const oldInit=window.initSession;
  if(typeof oldInit==='function')window.initSession=function(){const r=oldInit.apply(this,arguments);setTimeout(()=>refreshProfile().then(u=>{if(u?.role==='demandeur')fillRequesterTicket()}),100);return r};
  const oldSubmitUser=window.submitUser;
  if(typeof oldSubmitUser==='function')window.submitUser=async function(){
    const editId=document.getElementById('uEditId')?.value||'';
    if(!editId)return oldSubmitUser.apply(this,arguments);
    const role=normRole(document.getElementById('uRole')?.value);
    const prenom=document.getElementById('uPrenom')?.value.trim()||'';
    const nom=document.getElementById('uNom')?.value.trim()||'';
    const email=document.getElementById('uEmail')?.value.trim().toLowerCase()||'';
    const hotel=(role==='demandeur'||role==='it_hotel')?(document.getElementById('uHotel')?.value||null):null;
    const hotels=role==='it_regional'?(typeof window.getSelectedHotels==='function'?window.getSelectedHotels():[]):[];
    if(role==='demandeur'&&!hotel){window.showToast?.('Sélectionnez un hôtel pour le Demandeur','err');return}
    const local=(Array.isArray(window.DEMO_USERS)?window.DEMO_USERS:[]).find(x=>x.id===editId);if(!local)return;
    const updated={...local,prenom,nom,email,role,hotel,hotels};
    const pwd=document.getElementById('uPwd')?.value||'';if(pwd.trim()&&typeof window.hashPwd==='function')updated.pwd=window.hashPwd(pwd);
    window.DEMO_USERS=window.DEMO_USERS.map(x=>x.id===editId?updated:x);window.saveUsers?.(window.DEMO_USERS);
    if(typeof window.sbOK==='function'&&window.sbOK()&&typeof window.sbUpdateUser==='function'){
      const payload={prenom,nom,email,role,hotel,hotels:JSON.stringify(hotels)};if(pwd.trim())payload.pwd=updated.pwd;
      const ok=await window.sbUpdateUser(editId,payload);if(!ok){window.showToast?.('Erreur Supabase: modification non enregistrée','err');return}
      const rows=await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(editId)}&limit=1`);if(rows?.[0]&&typeof window.dbRowToUser==='function'){const fresh=window.dbRowToUser(rows[0]);window.DEMO_USERS=window.DEMO_USERS.map(x=>x.id===editId?fresh:x);window.saveUsers?.(window.DEMO_USERS);if(norm(window.currentUser)?.id===editId)window.currentUser={...window.currentUser,...fresh}}
    }
    window.populateSelects?.();window.closeModal?.('modalUser');window.showToast?.('Compte mis à jour','ok');window.renderUsers?.();
  };
  function boot(){setTimeout(()=>refreshProfile().then(u=>{if(u?.role==='demandeur')fillRequesterTicket()}),250)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

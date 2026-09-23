/* ONOMO Support IT - synchronisation utilisateurs + ticket Demandeur */
(function(){
  'use strict';
  const t=(key,fallback)=>{const value=window.OnomoI18n?.t(key);return value&&value!==key?value:fallback;};
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
  async function requesterIT(){
    if(typeof window.sbFetch!=='function'||typeof window.sbOK!=='function'||!window.sbOK())return [];
    try{const rows=await window.sbFetch('rpc/requester_available_it',{method:'POST',body:'{}',prefer:'return=representation'});return Array.isArray(rows)?rows:[];}
    catch(error){console.warn('ONOMO IT autorisés indisponibles',error);return []}
  }
  function assignmentNotice(select,message,kind='info'){
    let note=document.getElementById('ntAgentScopeNotice');
    if(!note){note=document.createElement('div');note.id='ntAgentScopeNotice';note.style.cssText='font-size:11px;margin-top:6px;line-height:1.45';select.parentElement?.appendChild(note)}
    note.style.color=kind==='err'?'var(--red-t,#b42318)':'var(--tx3)';note.textContent=message||'';
  }
  async function fillRequesterTicket(){
    const u=norm(window.currentUser);if(!u||u.role!=='demandeur')return;
    const hotel=u.hotel||'';
    const hs=document.getElementById('ntHotel');
    if(hs){hs.innerHTML='';const o=document.createElement('option');o.value=hotel;o.textContent=hotel||t('no_hotel_option','— Aucun hôtel assigné —');o.disabled=!hotel;hs.appendChild(o);hs.value=hotel}
    const a=document.getElementById('ntAgent');
    if(a){
      a.innerHTML="<option value=''>"+t('select_it_option','— Sélectionner un IT —')+"</option>";
      const available=await requesterIT();
      const groups={local:[],regional:[]};available.forEach(x=>groups[x.scope_type==='regional'?'regional':'local'].push(x));
      [['local',t('it_your_hotel','IT de votre hôtel')],['regional',t('regional_it','IT régional')]].forEach(([scope,label])=>{
        if(!groups[scope].length)return;const group=document.createElement('optgroup');group.label=label;
        groups[scope].forEach(x=>{const name=`${x.prenom||''} ${x.nom||''}`.trim();if(!name||!x.assigned_to)return;const o=document.createElement('option');o.value=x.assigned_to;o.dataset.assignedTo=x.assigned_to;o.dataset.assigneeName=name;o.textContent=name;group.appendChild(o)});a.appendChild(group);
      });
      a.disabled=available.length===0;
      if(available[0]){a.value=available[0].assigned_to;assignmentNotice(a,'');}
      else assignmentNotice(a,t('no_it_available','Aucun responsable IT n’est actuellement configuré pour votre hôtel.'),'err');
    }
  }
  async function prepareRequester(){await refreshProfile();await fillRequesterTicket()}
  window.OnomoRequesterScope={refresh:fillRequesterTicket};
  function showRequesterAgentLoading(){
    const a=document.getElementById('ntAgent');
    if(!a)return;
    a.innerHTML=`<option value="">${t('loading','Chargement…')}</option>`;
    a.disabled=true;
    assignmentNotice(a,'');
  }
  const oldOpen=window.openNewTicket;
  if(typeof oldOpen==='function')window.openNewTicket=async function(){
    // The legacy opener rebuilds every select.  It must run first; otherwise it
    // overwrites the scoped IT list with its broad local fallback.
    const result=oldOpen.apply(this,arguments);
    if(norm(window.currentUser)?.role==='demandeur'){
      showRequesterAgentLoading();
      await prepareRequester();
    }
    return result;
  };
  const oldPopulate=window.populateSelects;
  if(typeof oldPopulate==='function')window.populateSelects=function(){const r=oldPopulate.apply(this,arguments);if(norm(window.currentUser)?.role==='demandeur')void fillRequesterTicket();return r};
  const oldSubmitTicket=window.submitNewTicket;
  if(typeof oldSubmitTicket==='function')window.submitNewTicket=async function(){if(norm(window.currentUser)?.role==='demandeur'){await prepareRequester();if(!document.getElementById('ntHotel')?.value){window.showToast?.(t('no_hotel_assigned','Votre compte Demandeur n’a aucun hôtel assigné.'),'err');return}if(!document.getElementById('ntAgent')?.value){window.showToast?.(t('no_it_available','Aucun IT disponible pour cet hôtel.'),'err');return}}return oldSubmitTicket.apply(this,arguments)};
  const oldCreateTicket=window.createTicket;
  if(typeof oldCreateTicket==='function')window.createTicket=async function(data){
    if(norm(window.currentUser)?.role!=='demandeur')return oldCreateTicket.apply(this,arguments);
    const option=document.getElementById('ntAgent')?.selectedOptions?.[0];const assignedTo=option?.dataset?.assignedTo||option?.value||'';const assigneeName=option?.dataset?.assigneeName||'';
    if(!assignedTo||!assigneeName){window.showToast?.(t('no_it_available','Aucun responsable IT n’est actuellement configuré pour votre hôtel.'),'err');return null;}
    return oldCreateTicket.call(this,{...data,assigned_to:assignedTo,assigne_a:assigneeName});
  };
  const oldInit=window.initSession;
  if(typeof oldInit==='function')window.initSession=function(){const r=oldInit.apply(this,arguments);setTimeout(()=>refreshProfile().then(u=>{if(u?.role==='demandeur')fillRequesterTicket()}),100);return r};
  window.addEventListener('onomo:languagechange',()=>{
    if(norm(window.currentUser)?.role==='demandeur'&&document.getElementById('ntAgent'))void fillRequesterTicket();
  });
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
    if(role==='demandeur'&&!hotel){window.showToast?.(t('select_requester_hotel','Sélectionnez un hôtel pour le Demandeur'),'err');return}
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

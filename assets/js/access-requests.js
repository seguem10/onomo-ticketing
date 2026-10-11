/* Approval UI. Supabase RLS and decision RPCs are the authority; no local
   success fallback, credentials, or approval state stored in browser storage. */
(function(){
 'use strict';
 const labels={it:'En attente IT',director:'En attente Directeur',hr:'En attente RH',approved:'Accords obtenus',rejected:'Refusée'};
 const roleNames={it_hotel:'IT Hotel',it_regional:'IT Regional',directeur_hotel:'Directeur Hôtel',rh_regional:'RH Régional'};
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=value=>{const parsed=new Date(value);return Number.isNaN(parsed.valueOf())?'—':parsed.toLocaleString('fr-FR');};
 let epoch=0,selected=null,page=0,busy=false;
 const host=()=>document.getElementById('mainContent');
 const active=()=>typeof currentView!=='undefined'&&currentView==='access-requests';
 const profile=()=>typeof currentUser!=='undefined'?currentUser:null;
 const identity=()=>profile()?.auth_user_id||profile()?.id;
 function client(){const value=window.OnomoAuth?.getClient?.();if(!value)throw new Error('Service sécurisé indisponible. Reconnectez-vous.');return value;}
 function valid(run,user){return active()&&epoch===run&&identity()===user;}
 function errorText(error){
  if(error?.code==='42501')return 'Accès refusé : vérifiez votre rôle, votre hôtel et votre session MFA.';
  if(error?.code==='40001')return 'Cette étape a déjà été traitée. Actualisez la demande.';
  return error?.message||'Impossible de charger les demandes. Réessayez.';
 }
 function header(){return `<div class="page-head"><div><h1>Demandes d’accès</h1><p>OPERA et Microsoft 365 · IT → Directeur de l’hôtel → RH Régional</p></div></div>
 <div class="alert alert-warning" role="note">Circuit en cours de vérification : tests multi-comptes et notifications encore à réaliser. Aucun accès n’est créé automatiquement.</div>`;}
 function hotels(){const u=profile();if(!u)return [];
  const values=u.role==='admin'?(typeof HOTELS!=='undefined'?HOTELS.map(h=>h.nom):[]):[u.hotel,...(Array.isArray(u.hotels)?u.hotels:[])];
  return [...new Set(values.filter(Boolean))];
 }
 function canDecide(request){
  const u=profile();if(!u||request.requester_id===identity())return false;
  const roles=[u.role,...(Array.isArray(u.roles)?u.roles:[])].map(r=>roleNames[r]||r);
  const multi=Array.isArray(u.hotels)&&u.hotels.includes(request.hotel);
  if(request.stage==='it')return (roles.includes('IT Hotel')&&u.hotel===request.hotel)||(roles.includes('IT Regional')&&multi);
  if(request.stage==='director')return roles.includes('Directeur Hôtel')&&u.hotel===request.hotel;
  return request.stage==='hr'&&roles.includes('RH Régional')&&multi;
 }
 async function render(){
  if(!active()||!profile())return;
  const run=++epoch,user=identity();busy=false;
  const target=host();if(!target)return;
  document.getElementById('viewToggle')?.style.setProperty('display','none');
  const title=document.getElementById('topbarTitle');if(title)title.textContent='Demandes d’accès';
  target.innerHTML=header()+'<div role="status">Chargement des demandes…</div>';
  try{
   const db=client();
   if(selected){
    const [requestResult,historyResult]=await Promise.all([
     db.from('access_requests').select('*').eq('id',selected).single(),
     db.from('access_request_decisions').select('*').eq('request_id',selected).order('created_at',{ascending:true})
    ]);
    if(requestResult.error)throw requestResult.error;if(historyResult.error)throw historyResult.error;
    if(!valid(run,user))return;
    const request=requestResult.data;
    target.innerHTML=header()+`<button type="button" class="btn btn-outline" data-access-action="back">Retour aux demandes</button>
    <section class="card" style="padding:20px;margin-top:15px"><h2>${escape(request.subject)}</h2>
     <p>${escape(request.system_name)} · ${escape(request.hotel)} · ${escape(labels[request.stage]||request.stage)}</p>
     <p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(request.description)}</p>
     <p>Créée le ${escape(date(request.created_at))}</p>
     ${request.stage==='rejected'?'<div class="alert alert-danger">Demande bloquée. Une nouvelle soumission est nécessaire ; les accords précédents ne sont pas réutilisés.</div>':''}
     ${request.stage==='approved'?'<div class="alert alert-success">Les trois accords sont obtenus. La réalisation reste manuelle par l’équipe IT autorisée.</div>':''}
     ${canDecide(request)?`<form data-access-form="decision"><label class="field-lbl" for="accessReason">Justification de la décision</label>
       <textarea class="field-ctrl" id="accessReason" name="reason" required minlength="3" maxlength="2000" rows="3"></textarea>
       <div data-access-error role="alert"></div><div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap"><button class="btn btn-gold" type="submit" name="answer" value="approve">Approuver cette étape</button>
       <button class="btn btn-danger" type="submit" name="answer" value="reject">Refuser la demande</button></div></form>`:'<p>Votre compte ne peut pas décider à cette étape. Les décisions nécessitent une session MFA et un rôle couvrant cet hôtel.</p>'}
    </section><section class="card" style="padding:20px;margin-top:15px"><h3>Historique des décisions</h3>
     ${historyResult.data.length?historyResult.data.map(d=>`<div style="border-top:1px solid var(--border);padding:12px 0"><strong>${escape(labels[d.step])} · ${d.decision==='approve'?'Accord':'Refus'}</strong>
      <div>${escape(date(d.created_at))} · Compte ${escape(d.actor_id)}</div><p style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(d.reason)}</p></div>`).join(''):'<p>Aucune décision enregistrée.</p>'}</section>`;
    target.querySelector('[data-access-form="decision"]')?.addEventListener('submit',event=>decide(event,request,run,user));
   }else{
    const result=await db.from('access_requests').select('*').order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);
    if(result.error)throw result.error;if(!valid(run,user))return;
    const inbox=await db.from('access_request_notifications').select('id,request_id,event_stage,created_at').eq('recipient_id',user).is('read_at',null).order('created_at',{ascending:false}).limit(20);
    if(inbox.error)throw inbox.error;if(!valid(run,user))return;
    const alerts=(inbox.data||[]).map(n=>`<div style="padding:10px;border-top:1px solid var(--border)"><button type="button" class="btn btn-outline" data-access-id="${escape(n.request_id)}" data-access-notification="${escape(n.id)}">${escape(window.OnomoAccessNotifications?.message(n)||labels[n.event_stage]||'Mise à jour')}</button> <span>${escape(date(n.created_at))}</span></div>`).join('');
    target.innerHTML=header()+`<section class="card" style="padding:15px;margin-bottom:15px"><h3>Vos alertes de demandes d’accès</h3>${alerts||'<p>Aucune alerte non lue.</p>'}</section><div style="display:flex;gap:10px;margin-bottom:15px"><button class="btn btn-gold" type="button" data-access-action="new">Nouvelle demande</button><button class="btn btn-outline" type="button" data-access-action="refresh">Actualiser</button></div>
     <section class="card" style="padding:15px;overflow:auto">${result.data.length?`<table style="width:100%;text-align:left"><thead><tr><th>Demande</th><th>Hôtel</th><th>Étape</th><th>Date</th></tr></thead><tbody>${result.data.map(r=>`<tr><td style="padding:12px"><button class="btn btn-outline" type="button" data-access-id="${escape(r.id)}">${escape(r.subject)}</button><div>${escape(r.system_name)}</div></td><td>${escape(r.hotel)}</td><td>${escape(labels[r.stage]||r.stage)}</td><td>${escape(date(r.created_at))}</td></tr>`).join('')}</tbody></table>`:'<p>Aucune demande visible dans votre périmètre.</p>'}</section>
     <div style="display:flex;gap:10px;margin-top:15px"><button type="button" class="btn btn-outline" data-access-action="previous" ${page===0?'disabled':''}>Précédent</button><span>Page ${page+1}</span><button type="button" class="btn btn-outline" data-access-action="next" ${result.data.length<50?'disabled':''}>Suivant</button></div>`;
   }
  }catch(error){if(valid(run,user))target.innerHTML=header()+`<div class="alert alert-danger" role="alert">${escape(errorText(error))}</div><button type="button" class="btn btn-outline" data-access-action="back">Réessayer</button>`;}
 }
 function newForm(){
  const run=++epoch,user=identity();busy=false;const allowed=hotels();
  host().innerHTML=header()+`<section class="card" style="padding:20px"><h2>Nouvelle demande</h2><p>Ne saisissez aucun mot de passe ni donnée client. Après soumission, les détails ne sont plus modifiables.</p>
   <form data-access-form="new"><div class="form-g"><label for="accessHotel" class="field-lbl">Hôtel</label><select name="hotel" id="accessHotel" class="field-ctrl" required><option value="">Sélectionner</option>${allowed.map(h=>`<option value="${escape(h)}">${escape(h)}</option>`).join('')}</select></div>
   <div class="form-g"><label for="accessSystem" class="field-lbl">Système</label><select name="system" id="accessSystem" class="field-ctrl"><option>OPERA</option><option>Microsoft 365</option></select></div>
   <div class="form-g"><label for="accessTitle" class="field-lbl">Objet</label><input name="title" id="accessTitle" class="field-ctrl" required minlength="3" maxlength="160"></div>
   <div class="form-g"><label for="accessDetails" class="field-lbl">Besoin et droits demandés</label><textarea name="details" id="accessDetails" class="field-ctrl" required minlength="10" maxlength="4000" rows="5"></textarea></div>
   <div data-access-error role="alert"></div><div style="display:flex;gap:10px"><button type="submit" class="btn btn-gold" ${allowed.length?'':'disabled'}>Soumettre à l’IT</button><button type="button" class="btn btn-outline" data-access-action="back">Annuler</button></div></form></section>`;
  host().querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!valid(run,user))return;
   const form=event.currentTarget,fields=new FormData(form);busy=true;toggle(form,true);
   try{const result=await client().rpc('submit_access_request',{hotel_name:fields.get('hotel'),target_system:fields.get('system'),title:fields.get('title'),details:fields.get('details')});
    if(result.error)throw result.error;if(!valid(run,user))return;selected=result.data;page=0;void handoffEmail(result.data,user);await render();
   }catch(error){if(valid(run,user)){form.querySelector('[data-access-error]').textContent=errorText(error);busy=false;toggle(form,false);}}
  });
 }
 function toggle(form,value){form.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=value);}
 async function handoffEmail(requestId,user){
  try{
   const result=await client().functions.invoke('access-request-email',{body:{request_id:requestId}});
   if(identity()!==user)return;
   if(result.error||result.data?.configured===false||result.data?.failed>0){window.showToast?.('Demande enregistrée. Envoi email non confirmé ; les alertes restent disponibles.','err');}
  }catch(_){if(identity()===user)window.showToast?.('Demande enregistrée, mais le service email est indisponible.','err');}
 }
 async function decide(event,request,run,user){
  event.preventDefault();if(busy||!valid(run,user))return;
  const answer=event.submitter?.value;if(!['approve','reject'].includes(answer))return;
  if(!window.confirm(answer==='reject'?'Le refus bloque définitivement cette demande. Confirmer ?':'Confirmer votre accord pour cette étape ?'))return;
  const form=event.currentTarget,reason=new FormData(form).get('reason');busy=true;toggle(form,true);
  try{const result=await client().rpc('decide_access_request',{target_id:request.id,expected_step:request.stage,answer,explanation:reason});
   if(result.error)throw result.error;if(valid(run,user)){void handoffEmail(request.id,user);await render();}
  }catch(error){if(valid(run,user)){form.querySelector('[data-access-error]').textContent=errorText(error);busy=false;toggle(form,false);}}
 }
 document.addEventListener('click',event=>{
  if(!active())return;const button=event.target.closest('[data-access-action],[data-access-id]');if(!button||!host()?.contains(button)||button.disabled||busy)return;
  if(button.dataset.accessId){selected=button.dataset.accessId;
   if(button.dataset.accessNotification){void client().from('access_request_notifications').update({read_at:new Date().toISOString()}).eq('id',button.dataset.accessNotification).eq('recipient_id',identity()).then(()=>{},()=>{});}
   void render();return;}
  const action=button.dataset.accessAction;
  if(action==='new'){newForm();return;}
  if(action==='back'){selected=null;page=0;}
  if(action==='previous')page=Math.max(0,page-1);if(action==='next')page++;
  void render();
 });
 const previous=window.renderView;
 window.renderView=function(){if(active()){void render();return;}epoch++;busy=false;return previous.apply(this,arguments);};
 window.OnomoAccessRequests={render,canDecide,escape};
})();

/* ONOMO Support IT - AI voice tickets, email notifications and requester creation */
(function(){
  'use strict';

  const norm=v=>String(v??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const powerRoles=['admin','administrateur','it_regional','it regional','it_hotel','it hotel','directeur','direction'];
  const users=()=>{try{const u=JSON.parse(localStorage.getItem('dh_users')||'[]');return Array.isArray(u)?u:[]}catch(_){return[]}};
  const userRole=u=>norm(u?.role);
  const nameOf=u=>(`${u?.prenom||''} ${u?.nom||''}`).trim()||u?.email||'Utilisateur';
  const settingsOf=()=>typeof settings!=='undefined'?settings:window.settings||{};
  const current=()=>typeof currentUser!=='undefined'?currentUser:window.currentUser;

  function emailCfg(){
    let serviceId='',templateId='',publicKey='';
    try{serviceId=typeof EMAILJS_SERVICE_ID!=='undefined'?EMAILJS_SERVICE_ID:''}catch(_){}
    try{templateId=typeof EMAILJS_TEMPLATE_ID!=='undefined'?EMAILJS_TEMPLATE_ID:''}catch(_){}
    try{publicKey=typeof EMAILJS_PUBLIC_KEY!=='undefined'?EMAILJS_PUBLIC_KEY:''}catch(_){}
    serviceId=serviceId||window.EMAILJS_SERVICE_ID||'';
    templateId=templateId||window.EMAILJS_TEMPLATE_ID||'';
    publicKey=publicKey||window.EMAILJS_PUBLIC_KEY||'';
    return{serviceId,templateId,publicKey};
  }

  async function sendEmail(to,recipient,ticket,event){
    const c=emailCfg();
    if(!to||!window.emailjs||!c.serviceId||!c.templateId||!c.publicKey){
      console.warn('[ONOMO EMAIL] configuration missing', {to,hasSdk:!!window.emailjs,service:!!c.serviceId,template:!!c.templateId,key:!!c.publicKey});
      return false;
    }
    try{
      const params={
        to_email:to,recipient_email:to,agent_email:to,email:to,
        agent_prenom:nameOf(recipient),recipient_name:nameOf(recipient),
        ticket_numero:ticket?.numero||ticket?.id||'',ticket_titre:ticket?.titre||'',
        ticket_hotel:ticket?.hotel||'',ticket_priorite:ticket?.priorite||'',
        ticket_categorie:ticket?.categorie||'',ticket_statut:(typeof STAT_L!=='undefined'&&STAT_L[ticket?.statut])||ticket?.statut||'',
        ticket_description:ticket?.description||'',
        app_url:(typeof APP_URL!=='undefined'&&APP_URL)||window.location.href,
        name:(settingsOf().brandName)||'ONOMO Support IT',event,
        message:event+'\n\nTicket: '+(ticket?.numero||ticket?.id||'')+'\nTitre: '+(ticket?.titre||'')+'\nHôtel: '+(ticket?.hotel||'')+'\nPriorité: '+(ticket?.priorite||'')+'\nCatégorie: '+(ticket?.categorie||'')+'\nStatut: '+((typeof STAT_L!=='undefined'&&STAT_L[ticket?.statut])||ticket?.statut||'')+'\n\n'+(ticket?.description||'')
      };
      await window.emailjs.send(c.serviceId,c.templateId,params,{publicKey:c.publicKey,limitRate:{throttle:0}});
      console.log('[ONOMO EMAIL] sent',event,to);
      return true;
    }catch(e){
      console.error('[ONOMO EMAIL] failed',event,to,e);
      return false;
    }
  }

  function uniqueRecipients(list){
    const out=[],seen=new Set();
    list.forEach(u=>{if(!u?.email)return;const k=norm(u.email);if(seen.has(k))return;seen.add(k);out.push(u)});
    return out;
  }

  async function notifyCreated(ticket){
    const us=users();
    let target=null;
    if(ticket?.assigned_to)target=us.find(u=>String(u.auth_user_id||u.id)===String(ticket.assigned_to));
    if(!target&&ticket?.assigne_a)target=us.find(u=>norm(u.email)===norm(ticket.assigne_a)||norm(nameOf(u))===norm(ticket.assigne_a));
    if(!target&&ticket?.assigne_a&&String(ticket.assigne_a).includes('@'))target={email:ticket.assigne_a,prenom:'IT',nom:''};
    if(target?.email)await sendEmail(target.email,target,ticket,'Nouveau ticket assigné');
    else console.warn('[ONOMO EMAIL] no assigned recipient',ticket);
  }

  async function notifyChanged(before,after){
    if(!after)return;
    const changedStatus=norm(before?.statut)!==norm(after?.statut);
    const changedAssignment=String(before?.assigned_to||'')!==String(after?.assigned_to||'')||norm(before?.assigne_a)!==norm(after?.assigne_a);
    if(!changedStatus&&!changedAssignment)return;
    const us=users(),recipients=[];
    const requester=us.find(u=>String(u.auth_user_id||u.id)===String(after.created_by||'')||norm(u.email)===norm(after.created_by_email));
    if(requester?.email)recipients.push(requester);
    us.filter(u=>powerRoles.includes(userRole(u))).forEach(u=>{if(['admin','administrateur','it_regional','it regional'].includes(userRole(u)))recipients.push(u)});
    const event=changedStatus?'Ticket mis à jour — statut : '+((typeof STAT_L!=='undefined'&&STAT_L[after.statut])||after.statut||''):'Ticket mis à jour — assignation';
    for(const r of uniqueRecipients(recipients))await sendEmail(r.email,r,after,event);
  }

  function authClient(){return window.OnomoAuth?.getClient?.()||null}

  async function callAiVoice(blob){
    const client=authClient();
    if(!client)throw new Error('Supabase Auth indisponible. Reconnectez-vous.');
    const form=new FormData();
    const fileName=blob.type.includes('mp4')?'voice.mp4':'voice.webm';
    form.append('audio',blob,fileName);
    const hotel=document.getElementById('ntHotel')?.value||'';
    const u=current();
    const allowedHotels=Array.isArray(u?.hotels)?u.hotels:(hotel?[hotel]:[]);
    form.append('hotel',hotel);
    form.append('hotels',JSON.stringify(allowedHotels));
    form.append('categories',JSON.stringify(['IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre']));
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)throw new Error('Session Supabase absente.');
    const s=settingsOf();
    const url=`${s.sbUrl}/functions/v1/ai-ticket-analysis`;
    const res=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`},body:form});
    const text=await res.text();
    let data={};try{data=text?JSON.parse(text):{}}catch(_){data={error:text}}
    if(!res.ok)throw new Error(data.error||`Analyse vocale impossible (${res.status})`);
    return data;
  }

  let recorder=null,chunks=[],recording=false;
  function voiceButtonState(state){
    const b=document.getElementById('onomoVoiceTicketBtn');if(!b)return;
    if(state==='recording'){b.innerHTML='<i class="ti ti-player-stop"></i> Arrêter';b.classList.add('btn-danger');b.disabled=false}
    else if(state==='processing'){b.innerHTML='<i class="ti ti-loader-2 spin"></i> Analyse IA…';b.classList.remove('btn-danger');b.disabled=true}
    else{b.innerHTML='<i class="ti ti-microphone"></i> Créer par la voix';b.classList.remove('btn-danger');b.disabled=false}
  }

  async function startVoice(){
    if(recording){recorder?.stop();return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){showToast('La création vocale n’est pas disponible dans ce navigateur.','err');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      chunks=[];recording=true;voiceButtonState('recording');
      const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'';
      recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=async()=>{
        stream.getTracks().forEach(t=>t.stop());recording=false;voiceButtonState('processing');
        try{
          const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});
          const result=await callAiVoice(blob);
          const desc=document.getElementById('ntDesc'),title=document.getElementById('ntTitre'),cat=document.getElementById('ntCat'),prio=document.getElementById('ntPrio'),hotel=document.getElementById('ntHotel');
          if(desc)desc.value=result.description||result.transcript||'';
          if(title)title.value=result.titre||'';
          if(cat&&result.categorie)cat.value=result.categorie;
          if(prio&&result.priorite)prio.value=result.priorite;
          if(hotel&&result.hotel&&[...hotel.options].some(o=>o.value===result.hotel))hotel.value=result.hotel;
          showToast((result.summary||'Analyse IA terminée.')+' Création du ticket…','ok');
          if(typeof submitNewTicket==='function')setTimeout(()=>submitNewTicket(),300);
        }catch(e){console.error('[ONOMO VOICE]',e);showToast(e.message||'Analyse vocale impossible.','err')}
        finally{voiceButtonState('idle')}
      };
      recorder.start(250);
      showToast('Parlez clairement. Vous pouvez parler en français, anglais ou darija. Cliquez sur Arrêter à la fin.','ok');
    }catch(e){recording=false;voiceButtonState('idle');console.error('[ONOMO VOICE]',e);showToast('Accès au microphone refusé ou indisponible.','err')}
  }

  function addVoiceButton(){
    const r=norm(current()?.role);
    if(!['demandeur','requester'].includes(r))return;
    const desc=document.getElementById('ntDesc');
    if(!desc||document.getElementById('onomoVoiceTicketBtn'))return;
    const wrap=document.createElement('div');wrap.style.cssText='display:flex;justify-content:flex-end;margin-top:7px';
    wrap.innerHTML='<button type="button" id="onomoVoiceTicketBtn" class="btn btn-outline btn-sm"><i class="ti ti-microphone"></i> Créer par la voix</button><small id="onomoVoiceHint" style="margin-left:8px;color:var(--tx3);align-self:center">FR / EN / Darija</small>';
    desc.parentElement?.appendChild(wrap);document.getElementById('onomoVoiceTicketBtn').onclick=startVoice;
  }

  function wrapCrud(){
    if(window.__onomoAutomationCrud)return;
    const oldCreate=window.createTicket;
    if(typeof oldCreate==='function')window.createTicket=async function(data){const result=await oldCreate.apply(this,arguments);try{await notifyCreated(result||data)}catch(e){console.warn('[ONOMO EMAIL] creation notification',e)}return result};
    const oldUpdate=window.updateTicket;
    if(typeof oldUpdate==='function')window.updateTicket=async function(id,updates){const before=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{};const result=await oldUpdate.apply(this,arguments);const after=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{...before,...updates};try{await notifyChanged(before,after)}catch(e){console.warn('[ONOMO EMAIL] change notification',e)}return result};
    window.__onomoAutomationCrud=true;
  }

  function hotelsForForm(){
    const options=[];
    document.querySelectorAll('#uHotel option,select option').forEach(o=>{const v=String(o.value||'').trim();if(v&&!options.includes(v)&&!/^(aucun|all|tous|toutes)$/i.test(v))options.push(v)});
    users().forEach(u=>(Array.isArray(u?.hotels)?u.hotels:[u?.hotel]).forEach(v=>{if(v&&!options.includes(v))options.push(v)}));
    return options;
  }

  function requesterModal(){
    if(document.getElementById('onomoRequesterModal'))return;
    const hotels=hotelsForForm();
    const options=hotels.map(h=>`<option value="${String(h).replace(/"/g,'&quot;')}">${String(h).replace(/</g,'&lt;')}</option>`).join('');
    const wrap=document.createElement('div');wrap.id='onomoRequesterModal';wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML=`<div style="width:min(520px,100%);background:var(--surface,#fff);border:1px solid var(--border,#ddd);border-radius:14px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-size:16px;font-weight:700">Créer un demandeur</div><div style="font-size:11px;color:var(--tx3)">Le compte sera créé dans Supabase Auth et dans le profil utilisateur.</div></div><button type="button" id="onomoRequesterClose" class="btn btn-outline btn-sm">Fermer</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-g"><label class="field-lbl">Prénom</label><input id="orPrenom" class="form-ctrl" autocomplete="given-name"></div><div class="form-g"><label class="field-lbl">Nom</label><input id="orNom" class="form-ctrl" autocomplete="family-name"></div><div class="form-g" style="grid-column:1/-1"><label class="field-lbl">Email</label><input id="orEmail" type="email" class="form-ctrl" autocomplete="email"></div><div class="form-g"><label class="field-lbl">Mot de passe</label><input id="orPassword" type="password" class="form-ctrl" autocomplete="new-password" minlength="8"></div><div class="form-g"><label class="field-lbl">Hôtel</label><select id="orHotel" class="form-ctrl"><option value="">Sélectionner</option>${options}</select></div></div><div id="orError" style="display:none;margin:8px 0;color:var(--red,#dc2626);font-size:12px"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button type="button" id="orCancel" class="btn btn-outline">Annuler</button><button type="button" id="orCreate" class="btn btn-gold"><i class="ti ti-user-plus"></i> Créer le demandeur</button></div></div>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.querySelector('#onomoRequesterClose').onclick=close;wrap.querySelector('#orCancel').onclick=close;
    wrap.querySelector('#orCreate').onclick=async()=>{
      const btn=wrap.querySelector('#orCreate'),err=wrap.querySelector('#orError');
      err.style.display='none';
      const prenom=wrap.querySelector('#orPrenom').value.trim(),nom=wrap.querySelector('#orNom').value.trim(),email=wrap.querySelector('#orEmail').value.trim().toLowerCase(),password=wrap.querySelector('#orPassword').value,hotel=wrap.querySelector('#orHotel').value;
      if(!prenom||!nom||!email||password.length<8||!hotel){err.textContent='Prénom, nom, email, mot de passe de 8 caractères minimum et hôtel sont obligatoires.';err.style.display='block';return}
      try{
        const client=authClient();if(!client)throw new Error('Session Supabase indisponible. Reconnectez-vous.');
        const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Session Supabase absente.');
        const s=settingsOf();
        btn.disabled=true;btn.innerHTML='<i class="ti ti-loader-2 spin"></i> Création…';
        const res=await fetch(`${s.sbUrl}/functions/v1/admin-create-user`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,prenom,nom,role:'Demandeur',roles:['Demandeur'],hotel,hotels:[hotel]})});
        const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={error:text}}
        if(!res.ok)throw new Error(data.error||`Création impossible (${res.status})`);
        const local={...(data.user||{}),auth_user_id:data.user?.id,id:data.user?.id,role:'demandeur',roles:['Demandeur'],hotel,hotels:[hotel],prenom,nom,email};
        const list=users();if(!list.some(u=>norm(u.email)===norm(email))){list.push(local);localStorage.setItem('dh_users',JSON.stringify(list))}
        showToast('Demandeur créé avec succès.','ok');close();setTimeout(()=>location.reload(),700);
      }catch(e){console.error('[ONOMO USER]',e);err.textContent=e.message||'Création impossible.';err.style.display='block';btn.disabled=false;btn.innerHTML='<i class="ti ti-user-plus"></i> Créer le demandeur'}
    };
  }

  function addRequesterButton(){
    const u=current();
    if(!u||!['admin','administrateur'].includes(userRole(u)))return;
    const usersView=document.querySelector('[data-view="users"]');
    if(!usersView||document.getElementById('onomoCreateRequesterBtn'))return;
    const b=document.createElement('button');b.id='onomoCreateRequesterBtn';b.type='button';b.className='btn btn-gold btn-sm';b.style.cssText='margin:8px 0 12px';b.innerHTML='<i class="ti ti-user-plus"></i> Créer un demandeur';b.onclick=requesterModal;
    const content=document.getElementById('mainContent');
    if(content)content.insertAdjacentElement('afterbegin',b);
  }

  function init(){
    addVoiceButton();wrapCrud();addRequesterButton();
    const mo=new MutationObserver(()=>{addVoiceButton();wrapCrud();addRequesterButton()});
    mo.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>{addVoiceButton();addRequesterButton()},700);
  }

  window.OnomoAutomation={startVoice,notifyCreated,notifyChanged,requesterModal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
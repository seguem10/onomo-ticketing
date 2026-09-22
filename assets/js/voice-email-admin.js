/* ONOMO Support IT - AI voice tickets and email notifications */
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
    return{serviceId:serviceId||window.EMAILJS_SERVICE_ID||'',templateId:templateId||window.EMAILJS_TEMPLATE_ID||'',publicKey:publicKey||window.EMAILJS_PUBLIC_KEY||''};
  }
  async function sendEmail(to,recipient,ticket,event){
    const c=emailCfg();
    if(!to||!window.emailjs||!c.serviceId||!c.templateId||!c.publicKey)return false;
    try{
      const params={to_email:to,recipient_email:to,agent_email:to,email:to,agent_prenom:nameOf(recipient),recipient_name:nameOf(recipient),ticket_numero:ticket?.numero||ticket?.id||'',ticket_titre:ticket?.titre||'',ticket_hotel:ticket?.hotel||'',ticket_priorite:ticket?.priorite||'',ticket_categorie:ticket?.categorie||'',ticket_statut:(typeof STAT_L!=='undefined'&&STAT_L[ticket?.statut])||ticket?.statut||'',ticket_description:ticket?.description||'',app_url:(typeof APP_URL!=='undefined'&&APP_URL)||window.location.href,name:(settingsOf().brandName)||'ONOMO Support IT',event,message:event+'\n\nTicket: '+(ticket?.numero||ticket?.id||'')+'\nTitre: '+(ticket?.titre||'')+'\nHôtel: '+(ticket?.hotel||'')+'\nPriorité: '+(ticket?.priorite||'')+'\nCatégorie: '+(ticket?.categorie||'')+'\nStatut: '+((typeof STAT_L!=='undefined'&&STAT_L[ticket?.statut])||ticket?.statut||'')+'\n\n'+(ticket?.description||'')};
      await window.emailjs.send(c.serviceId,c.templateId,params,{publicKey:c.publicKey,limitRate:{throttle:0}});
      return true;
    }catch(e){console.error('[ONOMO EMAIL] failed',event,to,e);return false;}
  }
  function uniqueRecipients(list){const out=[],seen=new Set();list.forEach(u=>{if(!u?.email)return;const k=norm(u.email);if(seen.has(k))return;seen.add(k);out.push(u)});return out;}
  async function notifyCreated(ticket){
    const us=users();let target=null;
    if(ticket?.assigned_to)target=us.find(u=>String(u.auth_user_id||u.id)===String(ticket.assigned_to));
    if(!target&&ticket?.assigne_a)target=us.find(u=>norm(u.email)===norm(ticket.assigne_a)||norm(nameOf(u))===norm(ticket.assigne_a));
    if(!target&&ticket?.assigne_a&&String(ticket.assigne_a).includes('@'))target={email:ticket.assigne_a,prenom:'IT',nom:''};
    if(target?.email)await sendEmail(target.email,target,ticket,'Nouveau ticket assigné');
  }
  async function notifyChanged(before,after){
    if(!after)return;
    const changedStatus=norm(before?.statut)!==norm(after?.statut);
    const changedAssignment=String(before?.assigned_to||'')!==String(after?.assigned_to||'')||norm(before?.assigne_a)!==norm(after?.assigne_a);
    if(!changedStatus&&!changedAssignment)return;
    const us=users(),recipients=[];
    const requester=us.find(u=>String(u.auth_user_id||u.id)===String(after.created_by||'')||norm(u.email)===norm(after.created_by_email));
    if(requester?.email)recipients.push(requester);
    us.filter(u=>['admin','administrateur','it_regional','it regional'].includes(userRole(u))).forEach(u=>recipients.push(u));
    const event=changedStatus?'Ticket mis à jour — statut : '+((typeof STAT_L!=='undefined'&&STAT_L[after.statut])||after.statut||''):'Ticket mis à jour — assignation';
    for(const r of uniqueRecipients(recipients))await sendEmail(r.email,r,after,event);
  }
  function authClient(){return window.OnomoAuth?.getClient?.()||null}
  async function callAiVoice(blob){
    const client=authClient();if(!client)throw new Error('Supabase Auth indisponible. Reconnectez-vous.');
    const form=new FormData();form.append('audio',blob,blob.type.includes('mp4')?'voice.mp4':'voice.webm');
    const hotel=document.getElementById('ntHotel')?.value||'';const u=current();const allowedHotels=Array.isArray(u?.hotels)?u.hotels:(hotel?[hotel]:[]);
    form.append('hotel',hotel);form.append('hotels',JSON.stringify(allowedHotels));form.append('categories',JSON.stringify(['IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre']));
    const {data:{session}}=await client.auth.getSession();if(!session?.access_token)throw new Error('Session Supabase absente.');
    const s=settingsOf(),res=await fetch(`${s.sbUrl}/functions/v1/ai-ticket-analysis`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:s.sbKey},body:form});
    const text=await res.text();let data={};try{data=text?JSON.parse(text):{}}catch(_){data={error:text}}if(!res.ok)throw new Error(data.error||`Analyse vocale impossible (${res.status})`);return data;
  }
  let recorder=null,chunks=[],recording=false;
  function voiceButtonState(state){const b=document.getElementById('onomoVoiceTicketBtn');if(!b)return;if(state==='recording'){b.innerHTML='<i class="ti ti-player-stop"></i> Arrêter';b.classList.add('btn-danger');b.disabled=false}else if(state==='processing'){b.innerHTML='<i class="ti ti-loader-2 spin"></i> Analyse IA…';b.classList.remove('btn-danger');b.disabled=true}else{b.innerHTML='<i class="ti ti-microphone"></i> Créer par la voix';b.classList.remove('btn-danger');b.disabled=false}}
  async function startVoice(){
    if(recording){recorder?.stop();return}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){showToast('La création vocale n’est pas disponible dans ce navigateur.','err');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      chunks=[];recording=true;voiceButtonState('recording');const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':MediaRecorder.isTypeSupported('audio/mp4')?'audio/mp4':'';recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};
      recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());recording=false;voiceButtonState('processing');try{const blob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'}),result=await callAiVoice(blob);const desc=document.getElementById('ntDesc'),title=document.getElementById('ntTitre'),cat=document.getElementById('ntCat'),prio=document.getElementById('ntPrio'),hotel=document.getElementById('ntHotel');if(desc)desc.value=result.description||result.transcript||'';if(title)title.value=result.titre||'';if(cat&&result.categorie)cat.value=result.categorie;if(prio&&result.priorite)prio.value=result.priorite;if(hotel&&result.hotel&&[...hotel.options].some(o=>o.value===result.hotel))hotel.value=result.hotel;showToast((result.summary||'Analyse IA terminée.')+' Création du ticket…','ok');if(typeof submitNewTicket==='function')setTimeout(()=>submitNewTicket(),300)}catch(e){console.error('[ONOMO VOICE]',e);showToast(e.message||'Analyse vocale impossible.','err')}finally{voiceButtonState('idle')}};
      recorder.start(250);showToast('Parlez clairement. Vous pouvez parler en français, anglais ou darija. Cliquez sur Arrêter à la fin.','ok');
    }catch(e){recording=false;voiceButtonState('idle');console.error('[ONOMO VOICE]',e);showToast('Accès au microphone refusé ou indisponible.','err')}
  }
  // The browser SpeechRecognition control in modern-features.js is the single
  // supported dictation entry point.  Keeping this legacy recorder hidden
  // avoids a duplicate button and a call to an optional Edge Function.
  function addVoiceButton(){return;}
  function wrapCrud(){if(window.__onomoAutomationCrud)return;const oldCreate=window.createTicket;if(typeof oldCreate==='function')window.createTicket=async function(data){const result=await oldCreate.apply(this,arguments);try{await notifyCreated(result||data)}catch(e){console.warn('[ONOMO EMAIL] creation notification',e)}return result};const oldUpdate=window.updateTicket;if(typeof oldUpdate==='function')window.updateTicket=async function(id,updates){const before=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{};const result=await oldUpdate.apply(this,arguments);const after=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{...before,...updates};try{await notifyChanged(before,after)}catch(e){console.warn('[ONOMO EMAIL] change notification',e)}return result};window.__onomoAutomationCrud=true}
  function init(){addVoiceButton();wrapCrud();const mo=new MutationObserver(()=>{addVoiceButton();wrapCrud()});mo.observe(document.body,{childList:true,subtree:true});setTimeout(addVoiceButton,700)}
  window.OnomoAutomation={startVoice,notifyCreated,notifyChanged};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

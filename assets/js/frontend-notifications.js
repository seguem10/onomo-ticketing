/* Frontend notification bridge for Onomo Support IT. */
(function(){
  'use strict';
  const S=()=>{try{return typeof settings!=='undefined'?settings:(window.settings||{})}catch(_){return window.settings||{}}};
  const U=()=>{try{return JSON.parse(localStorage.getItem('dh_users')||'[]')}catch(_){return[]}};
  const norm=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const users=()=>U().filter(u=>u&&u.email&&['it_regional','it_hotel','it regional','it hotel'].includes(norm(u.role)));
  const find=value=>{const n=norm(value);return users().find(u=>[u.auth_user_id,u.id,u.email,`${u.prenom||''} ${u.nom||''}`].filter(Boolean).some(x=>norm(x)===n))||null};
  function emailConfig(){const s=S();const g=k=>s[k]||window[k]||localStorage.getItem(k)||'';return {publicKey:g('emailjsPublicKey')||g('emailjs_public_key')||g('emailPublicKey'),serviceId:g('emailjsServiceId')||g('emailjs_service_id')||g('emailServiceId'),templateId:g('emailjsTemplateId')||g('emailjs_template_id')||g('emailTemplateId')}}
  async function send(to,ticket,event){
    const c=emailConfig();
    if(!to||!window.emailjs||!c.publicKey||!c.serviceId||!c.templateId){console.warn('[ONOMO EMAIL] configuration EmailJS incomplète', {to,event,hasEmailJS:!!window.emailjs,hasPublicKey:!!c.publicKey,hasServiceId:!!c.serviceId,hasTemplateId:!!c.templateId});return false}
    try{
      if(!window.__onomoEmailJsInitialized){window.emailjs.init({publicKey:c.publicKey});window.__onomoEmailJsInitialized=true}
      await window.emailjs.send(c.serviceId,c.templateId,{to_email:to,email:to,recipient:to,ticket_number:ticket.numero||ticket.id,ticket_title:ticket.titre||'',ticket_hotel:ticket.hotel||'',ticket_status:ticket.statut||'',ticket_priority:ticket.priorite||'',ticket_assignee:ticket.assigne_a||'',event:event,subject:`ONOMO IT - ${ticket.numero||'Ticket'} - ${event}`});
      console.info('[ONOMO EMAIL] envoyé',event,to,ticket.numero||ticket.id);return true;
    }catch(e){console.error('[ONOMO EMAIL] échec',event,to,e);return false}
  }
  function install(){
    if(window.__onomoFrontendNotifications)return;
    window.__onomoFrontendNotifications=true;
    const oldCreate=window.createTicket;
    if(typeof oldCreate==='function')window.createTicket=async function(data){const result=await oldCreate.apply(this,arguments);const t=result||data||{};const u=find(t.assigned_to||t.assigne_a);if(u)send(u.email,t,'ticket créé / assigné');return result};
    const oldUpdate=window.updateTicket;
    if(typeof oldUpdate==='function')window.updateTicket=async function(id,updates){const before=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{};const result=await oldUpdate.apply(this,arguments);const after=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||{...before,...updates};if(norm(after.statut)==='ferme'&&norm(before.statut)!=='ferme'){const email=after.created_by_email||(window.currentUser?.email||'');if(email)send(email,after,'ticket fermé')}const u=find(after.assigned_to||after.assigne_a);if(u&&String(before.assigned_to||before.assigne_a)!==String(after.assigned_to||after.assigne_a))send(u.email,after,'ticket assigné');return result};
  }
  window.OnomoEmail={send,install,emailConfig};
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,500);setTimeout(install,1500);setTimeout(install,3000)});
})();

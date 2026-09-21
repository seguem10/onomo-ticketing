/* Frontend notification bridge for Onomo Support IT. */
(function(){
  'use strict';

  function emailConfig(){
    let publicKey='',serviceId='',templateId='';
    try{ publicKey = typeof EMAILJS_PUBLIC_KEY !== 'undefined' ? EMAILJS_PUBLIC_KEY : ''; }catch(_){ }
    try{ serviceId = typeof EMAILJS_SERVICE_ID !== 'undefined' ? EMAILJS_SERVICE_ID : ''; }catch(_){ }
    try{ templateId = typeof EMAILJS_TEMPLATE_ID !== 'undefined' ? EMAILJS_TEMPLATE_ID : ''; }catch(_){ }
    return {publicKey,serviceId,templateId};
  }

  async function send(to,ticket,event){
    const c=emailConfig();
    if(!to || !window.emailjs || !c.publicKey || !c.serviceId || !c.templateId){
      console.warn('[ONOMO EMAIL] configuration EmailJS incomplète',{to,event,hasEmailJS:!!window.emailjs,hasPublicKey:!!c.publicKey,hasServiceId:!!c.serviceId,hasTemplateId:!!c.templateId});
      return false;
    }
    try{
      if(!window.__onomoEmailJsInitialized){
        window.emailjs.init({publicKey:c.publicKey});
        window.__onomoEmailJsInitialized=true;
      }
      const params={
        agent_email:to,
        agent_prenom:ticket.assigne_a || 'Agent',
        ticket_numero:ticket.numero || ticket.id || '',
        ticket_titre:ticket.titre || '',
        ticket_hotel:ticket.hotel || '',
        ticket_categorie:ticket.categorie || '',
        ticket_statut:(typeof STAT_L!=='undefined' && STAT_L[ticket.statut]) || ticket.statut || '',
        app_url:(typeof APP_URL!=='undefined' && APP_URL) || window.location.href,
        name:(typeof settings!=='undefined' && settings.brandName ? `${settings.brandName} Support IT` : 'ONOMO Support IT'),
        event:event
      };
      const res=await window.emailjs.send(c.serviceId,c.templateId,params);
      console.info('[ONOMO EMAIL] envoyé',event,to,ticket.numero||ticket.id,res.status,res.text);
      return true;
    }catch(e){
      console.error('[ONOMO EMAIL] échec',event,to,e);
      return false;
    }
  }

  function install(){
    if(window.__onomoFrontendNotifications)return;
    window.__onomoFrontendNotifications=true;

    /* Creation and assignment emails are already handled by the main app.
       This bridge adds the missing creator notification when a ticket is closed. */
    const oldUpdate=window.updateTicket;
    if(typeof oldUpdate==='function'){
      window.updateTicket=async function(id,updates){
        const before=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id)) || {};
        const result=await oldUpdate.apply(this,arguments);
        const after=(Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id)) || {...before,...updates};
        if(String(after.statut||'').toLowerCase()==='ferme' && String(before.statut||'').toLowerCase()!=='ferme'){
          const email=after.created_by_email || '';
          if(email) await send(email,after,'ticket fermé');
        }
        return result;
      };
    }
  }

  window.OnomoEmail={send,install,emailConfig};
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,500);setTimeout(install,1500);setTimeout(install,3000)});
})();

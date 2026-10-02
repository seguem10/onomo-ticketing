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

    // Notification delivery is centralised in notification-delivery.js.
  }

  window.OnomoEmail={send,install,emailConfig};
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(install,500);setTimeout(install,1500);setTimeout(install,3000)});
})();

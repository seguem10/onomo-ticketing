/* Central ticket notification delivery: persistent alerts, realtime pop-ups,
   browser notifications and a server-side email handoff. */
(function(){
  'use strict';
  const SEEN_KEY='onomo-notifications-seen-v1';
  let hydrated=false;
  const textOf=row=>{
    const body=row?.body&&typeof row.body==='object'?row.body:{};
    const template=body.key&&window.OnomoI18n?.t(body.key);
    return template&&template!==body.key
      ?template.replace(/\{(ticket|status|file_name)\}/g,(_m,key)=>String(body[key]||''))
      :String(body.message||body.title||'Mise à jour de ticket');
  };
  const readSeen=()=>{try{return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY)||'[]'));}catch(_){return new Set();}};
  const saveSeen=seen=>{try{sessionStorage.setItem(SEEN_KEY,JSON.stringify([...seen].slice(-150)));}catch(_){}};
  function announce(rows){
    if(!Array.isArray(rows))return;
    const seen=readSeen();
    if(!hydrated){rows.forEach(row=>seen.add(String(row.id)));saveSeen(seen);hydrated=true;return;}
    rows.slice().reverse().forEach(row=>{
      const id=String(row.id||'');
      if(!id||row.read_at||seen.has(id))return;
      seen.add(id);
      const message=textOf(row);
      window.showToast?.(message,'ok');
      if('Notification' in window&&Notification.permission==='granted'){
        try{new Notification('ONOMO Support IT',{body:message,icon:window.settings?.logoUrl||'assets/pwa/onomo-hotels.png',badge:window.settings?.logoUrl||'assets/pwa/onomo-hotels.png',tag:`onomo-${id}`});}catch(_){ }
      }
    });
    saveSeen(seen);
  }
  async function deliver(event,ticket){
    const client=window.OnomoAuth?.getClient?.();
    const config=window.OnomoAuth?.getConfig?.()||window.settings||{};
    if(!client||!config.sbUrl||!ticket?.id)return false;
    try{
      const {data:{session}}=await client.auth.getSession();
      if(!session?.access_token)return false;
      const response=await fetch(`${config.sbUrl}/functions/v1/ticket-notification-delivery`,{
        method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:config.sbKey||'', 'Content-Type':'application/json'},body:JSON.stringify({ticket_id:ticket.id,event})
      });
      if(!response.ok)throw new Error(`notification email ${response.status}`);
      const result=await response.json();
      if(result.email_configured===false)console.info('[ONOMO NOTIFICATIONS] Email provider is not configured; persistent and popup alerts remain active.');
      return true;
    }catch(error){console.warn('[ONOMO NOTIFICATIONS] Email handoff unavailable',error);return false;}
  }
  function ticketFor(id){return (Array.isArray(window.tickets)?window.tickets:[]).find(ticket=>String(ticket.id)===String(id))||window.currentTicket||null;}
  function install(){
    if(window.__onomoCentralNotificationDelivery)return;
    window.__onomoCentralNotificationDelivery=true;
    // CRUD functions are wrapped by several independent modules. Hooking one
    // here can be overwritten later, silently dropping an e-mail handoff.
    // The definitive persistence points invoke `deliver()` explicitly instead.
  }
  window.OnomoNotificationDelivery={announce,deliver,install};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

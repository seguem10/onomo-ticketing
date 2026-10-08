/* Localised SLA escalation labels. The server only stores a key and ticket
   number; each recipient's browser renders the alert in its chosen language. */
(function(){
  'use strict';
  const copy={
    fr:{ticket_sla_warning:'Attention SLA : le ticket {ticket} approche de son échéance.',ticket_sla_breach:'SLA dépassé : le ticket {ticket} nécessite une prise en charge régionale.',ticket_sla_critical:'Escalade critique : le ticket {ticket} dépasse fortement son SLA.'},
    en:{ticket_sla_warning:'SLA warning: ticket {ticket} is approaching its deadline.',ticket_sla_breach:'SLA breached: ticket {ticket} requires regional attention.',ticket_sla_critical:'Critical escalation: ticket {ticket} is significantly overdue.'},
    ar:{ticket_sla_warning:'تنبيه SLA: التذكرة {ticket} تقترب من موعدها النهائي.',ticket_sla_breach:'تم تجاوز SLA: التذكرة {ticket} تتطلب تدخل الفريق الإقليمي.',ticket_sla_critical:'تصعيد حرج: التذكرة {ticket} متأخرة بشكل كبير عن SLA.'}
  };
  const install=()=>{
    const api=window.OnomoI18n;
    if(!api||api.__slaEscalationCopy)return;
    const previous=api.t.bind(api);
    api.t=(key,variables={})=>{
      const template=copy[api.language]?.[key]||copy.fr[key];
      if(!template)return previous(key,variables);
      return template.replace(/\{(\w+)\}/g,(_match,name)=>variables[name]??`{${name}}`);
    };
    api.__slaEscalationCopy=true;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

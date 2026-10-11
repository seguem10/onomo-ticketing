/* Inferred from loaded public messages; never changes a ticket's actual status. */
(function(){
 'use strict';
 const normalize=value=>String(value||'').trim().toLowerCase();
 function state(ticket,messages,profiles=[]){
  if(['résolu','fermé'].includes(ticket.statut))return '';
  const publicMessages=messages.filter(row=>String(row.ticket_id)===String(ticket.id)&&row.visibility!=='internal').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)||String(b.id).localeCompare(String(a.id)));
  if(!publicMessages.length)return 'waiting_it';
  const last=publicMessages[0];
  const requester=[ticket.created_by,ticket.created_by_email,ticket.created_by_name,ticket.demandeur].map(normalize).filter(Boolean);
  if([last.author_id,last.auteur].map(normalize).some(value=>value&&requester.includes(value)))return 'waiting_it';
  const profile=profiles.find(user=>normalize(user.auth_user_id)===normalize(last.author_id)&&last.author_id||normalize(`${user.prenom||''} ${user.nom||''}`)===normalize(last.auteur)&&last.auteur);
  if(['admin','it_hotel','it_regional'].includes(profile?.role)||normalize(ticket.assigne_a)&&normalize(ticket.assigne_a)===normalize(last.auteur))return 'waiting_requester';
  return '';
 }
 function labels(){return ({fr:{waiting_it:'En attente IT',waiting_requester:'En attente demandeur',hint:'Suivi estimé selon la dernière réponse publique chargée, sans modifier le statut du ticket.'},en:{waiting_it:'Waiting for IT',waiting_requester:'Waiting for requester',hint:'Follow-up inferred from the latest loaded public reply, without changing ticket status.'},ar:{waiting_it:'بانتظار تقنية المعلومات',waiting_requester:'بانتظار مقدم الطلب',hint:'المتابعة مستنتجة من آخر رد عام تم تحميله دون تغيير حالة التذكرة.'}})[document.getElementById('languageSelector-app')?.value||'fr'];}
 window.TicketFollowUp={state,labels};
})();

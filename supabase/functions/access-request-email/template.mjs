// EmailJS template contract. No passwords, request free text, refusal reasons,
// or user-provided URLs are included in notification emails.
const stages={
 it:'En attente de validation IT',
 director:'En attente du Directeur de l’hôtel',
 hr:'En attente du RH Régional',
 approved:'Les trois accords sont obtenus ; réalisation manuelle par l’IT',
 rejected:'Demande refusée ; une nouvelle soumission est nécessaire'
};
export function accessEmailParameters(notification,request,recipient){
 if(notification.request_id!==request.id||notification.event_stage!==request.stage)throw new Error('stale_notification');
 if(!stages[notification.event_stage])throw new Error('invalid_stage');
 if(notification.recipient_id!==recipient.auth_user_id)throw new Error('wrong_recipient');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email||''))throw new Error('invalid_email');
 return {
  name:'ONOMO Desk',
  to_email:recipient.email,
  to_name:[recipient.prenom,recipient.nom].filter(Boolean).join(' ')||'Utilisateur',
  subject:'[ONOMO Desk] Demande d’accès — '+stages[request.stage],
  request_number:request.id,
  request_system:request.system_name,
  request_hotel:request.hotel,
  request_status:stages[request.stage],
  app_url:'https://onomo-ticketing.vercel.app/',
 };
}

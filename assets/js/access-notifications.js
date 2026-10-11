/* Persistent access-request inbox. Polls only for the current account while
   the page is visible; never navigates automatically or emails from a client. */
(function(){
 'use strict';
 const messages={it:'Une demande d’accès attend une validation IT.',director:'Une demande d’accès attend le Directeur de l’hôtel.',hr:'Une demande d’accès attend le RH Régional.',approved:'Une demande d’accès a obtenu les trois accords.',rejected:'Une demande d’accès a été refusée.'};
 let account=null,seen=new Set(),pending=false,generation=0;
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const id=()=>user()?.auth_user_id||null;
 function message(row){return messages[row.event_stage]||'Mise à jour d’une demande d’accès.';}
 function observe(rows,initial){
  for(const row of rows){if(seen.has(row.id))continue;seen.add(row.id);
   if(initial||row.read_at)continue;
   window.showToast?.(message(row),'ok');
   if('Notification' in window&&Notification.permission==='granted'){
    try{new Notification('ONOMO — Demandes d’accès',{body:message(row),tag:'access-'+row.id});}catch(_){}
   }
  }
  if(seen.size>500)seen=new Set(Array.from(seen).slice(-250));
 }
 async function poll(){
  if(document.hidden||pending)return;
  const current=id();if(!current){account=null;seen.clear();generation++;return;}
  const initial=account!==current;
  if(initial){account=current;seen.clear();generation++;}
  const run=generation,db=window.OnomoAuth?.getClient?.();if(!db)return;
  pending=true;
  try{const result=await db.from('access_request_notifications').select('id,request_id,event_stage,read_at,created_at').eq('recipient_id',current).order('created_at',{ascending:false}).limit(100);
   if(result.error||id()!==current||run!==generation)return;
   observe(result.data||[],initial);
  }finally{pending=false;}
 }
 window.OnomoAccessNotifications={message,poll};
 window.addEventListener('onomo:profile-ready',()=>{void poll().catch(()=>{});});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void poll().catch(()=>{});});
 setInterval(()=>{void poll().catch(()=>{});},30000);
})();

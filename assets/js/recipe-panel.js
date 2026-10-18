/* Temporary authenticated recipe launcher. Server checks remain authoritative. */
(function(){
 let checkedKey=null,pendingKey=null;
 const key=()=>window.currentUser?.auth_user_id||window.currentUser?.id||window.currentUser?.email||null;
 async function refresh(){
  const actor=key();
  const old=document.getElementById('onomoRecipePanel');
  if(!actor){old?.remove();checkedKey=null;return;}
  if(old&&old.dataset.actor!==String(actor))old.remove();
  if(checkedKey===actor||pendingKey===actor)return;
  const client=window.OnomoAuth?.getClient?.();if(!client)return;
  pendingKey=actor;
  let eligibility;
  try{eligibility=await client.functions.invoke('recipe-create-ticket',{method:'GET'});}
  catch{eligibility={error:true};}
  finally{if(pendingKey===actor)pendingKey=null;}
  if(key()!==actor)return;
  checkedKey=actor;
  if(eligibility.error||eligibility.data?.can_create!==true)return;
  const sidebar=document.getElementById('sidebar');if(!sidebar||document.getElementById('onomoRecipePanel'))return;
  const panel=document.createElement('div');panel.id='onomoRecipePanel';panel.dataset.actor=String(actor);
  const button=document.createElement('button');button.type='button';button.className='btn btn-outline';button.textContent='Créer le ticket TEST Microsoft 365';
  const status=document.createElement('p');status.setAttribute('role','status');
  button.addEventListener('click',async()=>{
   if(button.disabled||key()!==actor)return;
   if(!confirm('Créer le ticket de recette réservé, assigné à Sabir, avec notifications limitées à Sabir Test MFA et Sabir ? Aucune escalade SLA ne sera envoyée.'))return;
   button.disabled=true;status.textContent='Création en cours…';
   try{
    const client=window.OnomoAuth?.getClient?.();if(!client)throw Error('Session requise');
    const result=await client.functions.invoke('recipe-create-ticket',{body:{}});
    if(result.error||!result.data?.ok)throw Error('Création non confirmée. Vérifiez les tickets avant de réessayer.');
    const data=result.data;
    if(!data.created){status.textContent='Le ticket TEST existe déjà. Aucun nouvel email déclenché.';return;}
    status.textContent='Ticket TEST créé. Notification en cours…';
    const delivery=await client.functions.invoke('ticket-notification-delivery',{body:{ticket_id:data.ticket.id,event:'created'}});
    status.textContent=delivery.error?'Ticket créé, notification non confirmée. Vérifiez les boîtes sans recréer le ticket.':
     'Ticket TEST créé. Emails acceptés par le fournisseur : '+Number(delivery.data?.accepted||0)+'. Réception à confirmer.';
   }catch(error){status.textContent=error.message;}
   finally{button.disabled=false;}
  });
  panel.append(button,status);sidebar.append(panel);
 }
 const observer=new MutationObserver(refresh);observer.observe(document.body,{childList:true,subtree:true});refresh();
})();


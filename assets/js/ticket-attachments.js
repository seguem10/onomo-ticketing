/* Private ticket attachment uploads. Files are stored only in the secured
   Supabase bucket and linked to the ticket after the upload succeeds. */
(function(){
  'use strict';
  const MAX_BYTES=10*1024*1024;
  const TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  let pending=[];
  const status=message=>{const el=document.getElementById('ntAttachmentStatus');if(el)el.textContent=message;};
  const safeName=name=>String(name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-160);
  window.queueTicketAttachments=function(files){
    const selected=Array.from(files||[]);
    const invalid=selected.find(file=>file.size>MAX_BYTES||!TYPES.has(file.type));
    if(invalid){pending=[];const input=document.getElementById('ntAttachments');if(input)input.value='';status('Fichier refusé : format non autorisé ou taille supérieure à 10 Mo.');window.showToast?.('Fichier refusé : format non autorisé ou taille supérieure à 10 Mo.','err');return;}
    pending=selected;
    status(pending.length?`${pending.length} fichier(s) prêt(s) à être envoyé(s) après création du ticket.`:'');
  };
  window.uploadPendingTicketAttachments=async function(ticketId){
    if(!pending.length)return true;
    const client=window.OnomoAuth?.getClient?.();
    const session=await window.OnomoAuth?.getSession?.();
    if(!client||!session?.user){status('Pièces jointes non envoyées : session Supabase indisponible.');window.showToast?.('Ticket créé, mais les pièces jointes n’ont pas été envoyées.','err');return false;}
    const files=pending;pending=[];let uploaded=0;
    for(const file of files){
      const token=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const path=`${ticketId}/${token}-${safeName(file.name)}`;
      try{
        const {error:uploadError}=await client.storage.from('ticket-attachments').upload(path,file,{contentType:file.type,upsert:false});
        if(uploadError)throw uploadError;
        try{
          await window.sbFetch('ticket_attachments',{method:'POST',body:JSON.stringify({ticket_id:ticketId,uploaded_by:session.user.id,file_name:file.name,storage_path:path,content_type:file.type,file_size:file.size})});
          uploaded++;
        }catch(error){await client.storage.from('ticket-attachments').remove([path]);throw error;}
      }catch(error){console.error('Ticket attachment upload failed',error);window.showToast?.(`Pièce jointe non envoyée : ${file.name}`,'err');}
    }
    status(uploaded===files.length?'':`${uploaded}/${files.length} pièce(s) jointe(s) envoyée(s).`);
    if(uploaded)window.showToast?.(`${uploaded} pièce(s) jointe(s) envoyée(s).`,'ok');
    return uploaded===files.length;
  };
})();

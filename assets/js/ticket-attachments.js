/* Private ticket attachment uploads. Files are stored only in the secured
   Supabase bucket and linked to the ticket after the upload succeeds. */
(function(){
  'use strict';
  const MAX_BYTES=10*1024*1024;
  const TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
  let pending=[];
  const copy={
    fr:{attachments:'Pièces jointes',help:'(PDF, image, TXT, DOCX ou XLSX — 10 Mo maximum par fichier)',rejected:'Fichier refusé : format non autorisé ou taille supérieure à 10 Mo.',ready:'{count} fichier(s) prêt(s) à être envoyé(s) après création du ticket.',session:'Pièces jointes non envoyées : session Supabase indisponible.',createdWithout:'Ticket créé, mais les pièces jointes n’ont pas été envoyées.',uploadFailed:'Pièce jointe non envoyée : {name}',sent:'{count} pièce(s) jointe(s) envoyée(s).',none:'Aucune pièce jointe.',loading:'Chargement des pièces jointes…',loadFailed:'Impossible de charger les pièces jointes.',downloadFailed:'Téléchargement impossible.',confirmDelete:'Supprimer cette pièce jointe ?',deleteFailed:'Suppression de la pièce jointe impossible.',bytes:'o'},
    en:{attachments:'Attachments',help:'(PDF, image, TXT, DOCX or XLSX — 10 MB maximum per file)',rejected:'File rejected: unsupported format or size above 10 MB.',ready:'{count} file(s) ready to upload after the ticket is created.',session:'Attachments were not uploaded: Supabase session unavailable.',createdWithout:'Ticket created, but the attachments were not uploaded.',uploadFailed:'Attachment was not uploaded: {name}',sent:'{count} attachment(s) uploaded.',none:'No attachments.',loading:'Loading attachments…',loadFailed:'Unable to load attachments.',downloadFailed:'Download unavailable.',confirmDelete:'Delete this attachment?',deleteFailed:'Unable to delete the attachment.',bytes:'B'},
    ar:{attachments:'المرفقات',help:'(PDF أو صورة أو TXT أو DOCX أو XLSX — الحد الأقصى 10 ميغابايت لكل ملف)',rejected:'تم رفض الملف: تنسيق غير مسموح أو حجم أكبر من 10 ميغابايت.',ready:'{count} ملف/ملفات جاهزة للرفع بعد إنشاء التذكرة.',session:'لم تُرفع المرفقات: جلسة Supabase غير متاحة.',createdWithout:'تم إنشاء التذكرة، لكن لم تُرفع المرفقات.',uploadFailed:'لم يُرفع المرفق: {name}',sent:'تم رفع {count} مرفق/مرفقات.',none:'لا توجد مرفقات.',loading:'جارٍ تحميل المرفقات…',loadFailed:'تعذر تحميل المرفقات.',downloadFailed:'تعذر التنزيل.',confirmDelete:'هل تريد حذف هذا المرفق؟',deleteFailed:'تعذر حذف المرفق.',bytes:'بايت'}
  };
  const tr=(key,values={})=>{const language=window.OnomoI18n?.language||localStorage.getItem('onomo_language')||'fr';let text=(copy[language]||copy.fr)[key]||copy.fr[key]||key;return Object.entries(values).reduce((value,[name,replacement])=>value.replaceAll(`{${name}}`,replacement),text);};
  const refreshStaticCopy=()=>{const label=document.getElementById('attachmentFieldLabel'),help=document.getElementById('attachmentFieldHelp'),title=document.getElementById('attachmentPanelTitle');if(label){const icon=label.querySelector('i');label.childNodes[0].nodeValue=tr('attachments')+' ';}if(help)help.textContent=tr('help');if(title){const icon=title.querySelector('i');title.innerHTML=`${icon?.outerHTML||'<i class="ti ti-paperclip"></i>'}${tr('attachments')}`;}};
  const status=message=>{const el=document.getElementById('ntAttachmentStatus');if(el)el.textContent=message;};
  const safeName=name=>String(name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-160);
  window.queueTicketAttachments=function(files){
    const selected=Array.from(files||[]);
    const invalid=selected.find(file=>file.size>MAX_BYTES||!TYPES.has(file.type));
    if(invalid){pending=[];const input=document.getElementById('ntAttachments');if(input)input.value='';status(tr('rejected'));window.showToast?.(tr('rejected'),'err');return;}
    pending=selected;
    status(pending.length?tr('ready',{count:pending.length}):'');
  };
  window.uploadPendingTicketAttachments=async function(ticketId){
    if(!pending.length)return true;
    const client=window.OnomoAuth?.getClient?.();
    const session=await window.OnomoAuth?.getSession?.();
    if(!client||!session?.user){status(tr('session'));window.showToast?.(tr('createdWithout'),'err');return false;}
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
      }catch(error){console.error('Ticket attachment upload failed',error);window.showToast?.(tr('uploadFailed',{name:file.name}),'err');}
    }
    status(uploaded===files.length?'':tr('sent',{count:`${uploaded}/${files.length}`}));
    if(uploaded)window.showToast?.(tr('sent',{count:uploaded}),'ok');
    return uploaded===files.length;
  };
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatSize=bytes=>bytes<1024?`${bytes} ${tr('bytes')}`:bytes<1048576?`${(bytes/1024).toFixed(1)} ${tr('bytes')==='بايت'?'ك.ب':'KB'}`:`${(bytes/1048576).toFixed(1)} ${tr('bytes')==='بايت'?'م.ب':'MB'}`;
  window.loadTicketAttachments=async function(ticketId){
    const target=document.getElementById('ticketAttachmentList');if(!target||!ticketId)return;
    target.dataset.ticketId=String(ticketId);
    try{
      const rows=await window.sbFetch(`ticket_attachments?ticket_id=eq.${encodeURIComponent(ticketId)}&order=created_at.asc`);
      if(!Array.isArray(rows)||!rows.length){target.textContent=tr('none');return;}
      const me=String(window.currentUser?.auth_user_id||window.currentUser?.id||'');
      target.innerHTML=rows.map(row=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)"><i class="ti ti-file" style="color:var(--brand)"></i><div style="min-width:0;flex:1"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(row.file_name)}</div><div style="font-size:10px;color:var(--tx3)">${formatSize(Number(row.file_size)||0)}</div></div><button class="btn btn-outline btn-sm" onclick="window.downloadTicketAttachment('${row.id}')"><i class="ti ti-download"></i></button>${String(row.uploaded_by)===me||window.currentUser?.role==='admin'?`<button class="btn btn-danger btn-sm" onclick="window.deleteTicketAttachment('${row.id}')"><i class="ti ti-trash"></i></button>`:''}</div>`).join('');
      window.__onomoAttachments=rows;
    }catch(error){console.error('Attachment list failed',error);target.textContent=tr('loadFailed');}
  };
  window.downloadTicketAttachment=async function(id){
    const row=(window.__onomoAttachments||[]).find(item=>String(item.id)===String(id));const client=window.OnomoAuth?.getClient?.();if(!row||!client)return;
    const {data,error}=await client.storage.from('ticket-attachments').createSignedUrl(row.storage_path,60);if(error||!data?.signedUrl){window.showToast?.(tr('downloadFailed'),'err');return;}window.open(data.signedUrl,'_blank','noopener');
  };
  window.deleteTicketAttachment=async function(id){
    const row=(window.__onomoAttachments||[]).find(item=>String(item.id)===String(id));const client=window.OnomoAuth?.getClient?.();if(!row||!client)return;
    if(!window.confirm(tr('confirmDelete')))return;
    try{await window.sbFetch(`ticket_attachments?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',prefer:'return=minimal'});const {error}=await client.storage.from('ticket-attachments').remove([row.storage_path]);if(error)throw error;await window.loadTicketAttachments(row.ticket_id);}
    catch(error){console.error('Attachment deletion failed',error);window.showToast?.(tr('deleteFailed'),'err');}
  };
  window.addEventListener('onomo:languagechange',()=>{refreshStaticCopy();const ticketId=document.getElementById('ticketAttachmentList')?.dataset.ticketId;if(ticketId)window.loadTicketAttachments?.(ticketId);});
  document.addEventListener('DOMContentLoaded',refreshStaticCopy);
})();

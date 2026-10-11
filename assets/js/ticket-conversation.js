/* Message files inherit the parent comment's RLS, including internal notes. */
(function(){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=()=>({fr:{attach:'Joindre des fichiers',participants:'Participants à la conversation',failed:'Le message est envoyé, mais certains fichiers restent à joindre. Réessayez avec un nouveau message.',invalid:'Formats : PNG, JPG, WebP, PDF ou TXT ; 10 Mo par fichier, 5 fichiers maximum.',download:'Télécharger'},en:{attach:'Attach files',participants:'Conversation participants',failed:'The message was sent, but some files could not be attached. Retry with a new message.',invalid:'PNG, JPG, WebP, PDF or TXT; 10 MB per file, up to 5 files.',download:'Download'},ar:{attach:'إرفاق ملفات',participants:'المشاركون في المحادثة',failed:'تم إرسال الرسالة ولكن تعذر إرفاق بعض الملفات. أعد المحاولة برسالة جديدة.',invalid:'PNG، JPG، WebP، PDF أو TXT؛ 10 ميغابايت لكل ملف، خمسة ملفات كحد أقصى.',download:'تنزيل'}}[document.getElementById('languageSelector-app')?.value||'fr']);
 let pending=[],ticketId=null;
 let validation=Promise.resolve();
 const files=new Map();
 function renderPending(){
  const target=document.getElementById('conversationFilesPending');
  if(target)target.innerHTML=pending.map(file=>`<span style="display:inline-block;padding:5px 8px;border:1px solid var(--border);border-radius:6px;margin:3px" data-user-content="true">${escape(file.name)} · ${(file.size/1024).toFixed(0)} KB</span>`).join('');
 }
 async function queue(selected){
  const list=Array.from(selected||[]);
  validation=(async()=>{
   if(list.length>5){window.showToast?.(text().invalid,'err');return false;}
   const valid=await Promise.all(list.map(file=>['image/png','image/jpeg','image/webp','application/pdf','text/plain'].includes(file.type)&&window.validateTicketAttachment?.(file)));
   if(valid.some(value=>!value)){window.showToast?.(text().invalid,'err');return false;}
   pending=list;renderPending();return true;
  })();
  return validation;
 }
 async function load(comment){
  if(!/^[0-9a-f-]{36}$/i.test(comment.id))return;
  const target=document.querySelector(`[data-message-files="${comment.id}"]`);
  if(!target)return;
  try{
   const rows=await window.sbFetch(`ticket_message_files?comment_id=eq.${encodeURIComponent(comment.id)}&order=created_at.asc`);
   const client=window.OnomoAuth?.getClient?.();
   if(!Array.isArray(rows)||!client||!target.isConnected)return;
   const cards=await Promise.all(rows.map(async row=>{
    files.set(row.id,row);
    let preview='';
    if(row.content_type.startsWith('image/')){
     const {data,error}=await client.storage.from('ticket-message-files').createSignedUrl(row.storage_path,60);
     if(!error&&data?.signedUrl)preview=`<img src="${escape(data.signedUrl)}" alt="" style="width:56px;height:44px;object-fit:cover;border-radius:5px">`;
    }
    return `<div style="display:flex;align-items:center;gap:9px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;padding:8px;margin-top:8px">${preview||'<i class="ti ti-file"></i>'}<span style="min-width:0;flex:1;overflow-wrap:anywhere" data-user-content="true">${escape(row.file_name)}<small style="display:block;color:var(--tx3)">${(row.file_size/1024).toFixed(0)} KB</small></span><button class="btn btn-outline btn-sm" aria-label="${escape(text().download)}" onclick="TicketConversation.download('${row.id}')"><i class="ti ti-download"></i></button></div>`;
   }));
   if(target.isConnected)target.innerHTML=cards.join('');
  }catch(error){console.warn('Message file list unavailable',error);}
 }
 async function upload(comment){
  await validation;
  if(!pending.length)return true;
  const selected=pending.slice();
  const client=window.OnomoAuth?.getClient?.();
  const session=await window.OnomoAuth?.getSession?.();
  let failed=false;
  if(!client||!session?.user||!comment.author_id){window.showToast?.(text().failed,'err');return false;}
  for(const file of selected){
   const path=`${comment.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-160)}`;
   try{
    const {error}=await client.storage.from('ticket-message-files').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    try{await window.sbFetch('ticket_message_files',{method:'POST',body:JSON.stringify({comment_id:comment.id,uploaded_by:session.user.id,file_name:file.name,storage_path:path,content_type:file.type,file_size:file.size})});}
    catch(error){await client.storage.from('ticket-message-files').remove([path]);throw error;}
   }catch(error){failed=true;console.warn('Message attachment failed',error);}
  }
  pending=[];renderPending();
  if(failed)window.showToast?.(text().failed,'err');
  return !failed;
 }
 function mount(ticket,comments){
  if(ticketId!==ticket.id){pending=[];ticketId=ticket.id;}
  const composer=document.querySelector('.conversation-composer');
  if(composer&&!document.getElementById('conversationFilesInput')){
   const area=document.createElement('div');area.style.cssText='padding:8px 12px;border-top:1px solid var(--border)';
   area.innerHTML=`<label class="btn btn-outline btn-sm" for="conversationFilesInput"><i class="ti ti-paperclip"></i>${escape(text().attach)}</label><input id="conversationFilesInput" type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" style="display:none"><div id="conversationFilesPending" aria-live="polite"></div>`;
   composer.querySelector('.conversation-composer-foot')?.before(area);
   area.querySelector('input').addEventListener('change',event=>void queue(event.target.files));
   renderPending();
  }
  // Only names already visible in this ticket are shown. This does not grant access.
  const panel=document.querySelector('.conversation-panel');
  if(panel&&!document.getElementById('conversationParticipants')){
   const names=[ticket.created_by_name||ticket.demandeur||ticket.created_by_email,ticket.assigne_a,...comments.map(c=>c.auteur)].filter(Boolean);
   const people=[...new Set(names)];
   const node=document.createElement('aside');node.id='conversationParticipants';node.style.cssText='padding:10px 0;font-size:11px;color:var(--tx3)';
   node.innerHTML=`<strong>${escape(text().participants)}</strong><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${people.map(name=>`<span data-user-content="true" style="border:1px solid var(--border);border-radius:6px;padding:5px 8px">${escape(name)}</span>`).join('')}</div>`;
   panel.querySelector('.conversation-heading')?.after(node);
  }
  comments.forEach(comment=>void load(comment));
 }
 window.TicketConversation={mount,upload,async download(id){
  const row=files.get(id),client=window.OnomoAuth?.getClient?.();if(!row||!client)return;
  const {data,error}=await client.storage.from('ticket-message-files').createSignedUrl(row.storage_path,60);
  if(!error&&data?.signedUrl)window.open(data.signedUrl,'_blank','noopener');
 }};
})();

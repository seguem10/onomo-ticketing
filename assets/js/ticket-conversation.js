/* Message files inherit the parent comment's RLS, including internal notes. */
(function(){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=()=>({fr:{attach:'Joindre des fichiers',participants:'Participants à la conversation',failed:'Le message est envoyé, mais certains fichiers restent à joindre. Réessayez avec un nouveau message.',invalid:'Formats : PNG, JPG, WebP, PDF ou TXT ; 10 Mo par fichier, 5 fichiers maximum.',download:'Télécharger'},en:{attach:'Attach files',participants:'Conversation participants',failed:'The message was sent, but some files could not be attached. Retry with a new message.',invalid:'PNG, JPG, WebP, PDF or TXT; 10 MB per file, up to 5 files.',download:'Download'},ar:{attach:'إرفاق ملفات',participants:'المشاركون في المحادثة',failed:'تم إرسال الرسالة ولكن تعذر إرفاق بعض الملفات. أعد المحاولة برسالة جديدة.',invalid:'PNG، JPG، WebP، PDF أو TXT؛ 10 ميغابايت لكل ملف، خمسة ملفات كحد أقصى.',download:'تنزيل'}}[document.getElementById('languageSelector-app')?.value||'fr']);
 let pending=[],ticketId=null;
 const drafts=new Map(),activeTabs=new Map();
 const draftKey=id=>`${window.currentUser?.auth_user_id||'anonymous'}:${id}`;
 const labels=()=>({fr:{details:'Détails',conversation:'Conversation',attachments:'Pièces jointes',history:'Historique',stats:'Statistiques',messages:'Messages',internal:'Notes internes',first:'Premier message',last:'Dernier message',noMessage:'Aucun message',draft:'Brouillon conservé pendant cette session'},en:{details:'Details',conversation:'Conversation',attachments:'Attachments',history:'History',stats:'Statistics',messages:'Messages',internal:'Internal notes',first:'First message',last:'Last message',noMessage:'No messages',draft:'Draft kept during this session'},ar:{details:'التفاصيل',conversation:'المحادثة',attachments:'المرفقات',history:'السجل',stats:'الإحصائيات',messages:'الرسائل',internal:'ملاحظات داخلية',first:'أول رسالة',last:'آخر رسالة',noMessage:'لا توجد رسائل',draft:'تُحفظ المسودة خلال هذه الجلسة'}}[document.getElementById('languageSelector-app')?.value||'fr']);
 let validation=Promise.resolve();
 const files=new Map();
 function renderPending(){
  const target=document.getElementById('conversationFilesPending');
  if(target)target.innerHTML=pending.map(file=>`<span style="display:inline-block;padding:5px 8px;border:1px solid var(--border);border-radius:6px;margin:3px" data-user-content="true">${escape(file.name)} · ${(file.size/1024).toFixed(0)} KB</span>`).join('');
 }
 async function queue(selected){
  const list=Array.from(selected||[]);
  validation=(async()=>{
   pending=[];renderPending();
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
  const editor=document.getElementById('conversationInput');
  if(editor){
   editor.value=drafts.get(draftKey(ticket.id))||'';
   editor.addEventListener('input',()=>drafts.set(draftKey(ticket.id),editor.value));
  }
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
   void manageParticipants(ticket,node);
  }
  comments.forEach(comment=>void load(comment));
  mountTabs(ticket,comments);
 }
 function mountTabs(ticket,comments){
  const card=document.querySelector('.detail-reference-card');
  if(!card||card.querySelector('.ticket-conversation-tabs'))return;
  const columns=card.querySelector('.detail-reference-columns');
  const conversation=card.querySelector('.conversation-panel');
  const history=document.querySelector('.detail-history-reference');
  if(!columns||!conversation||!history)return;
  const attachments=document.createElement('section');attachments.className='conversation-attachment-tab';
  const attachmentList=document.getElementById('ticketAttachmentList');
  if(attachmentList){
   const heading=attachmentList.previousElementSibling;
   if(heading?.tagName==='H3')attachments.appendChild(heading);
   attachments.appendChild(attachmentList);
  }
  // Message attachments remain in their parent cards, including internal notes.
  card.appendChild(attachments);card.appendChild(history);
  const stats=document.createElement('section');stats.className='conversation-statistics-tab';
  const l=labels(),dates=comments.map(c=>new Date(c.created_at)).filter(date=>!Number.isNaN(date.getTime())).sort((a,b)=>a-b);
  const dateText=date=>date?date.toLocaleString(document.documentElement.lang||'fr'):l.noMessage;
  stats.innerHTML=`<div class="conversation-stats-grid">${[[l.messages,comments.length],[l.internal,comments.filter(c=>c.visibility==='internal').length],[l.first,dateText(dates[0])],[l.last,dateText(dates.at(-1))]].map(([name,value])=>`<div class="conversation-stat"><span>${escape(name)}</span><strong>${escape(value)}</strong></div>`).join('')}</div>`;
  card.appendChild(stats);
  const sections={details:columns,conversation,attachments,history,stats};
  const tabs=document.createElement('div');tabs.className='ticket-conversation-tabs';tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label',l.conversation);
  function activate(name){
   activeTabs.set(String(ticket.id),name);
   Object.entries(sections).forEach(([key,section])=>{section.hidden=key!==name;});
   tabs.querySelectorAll('button').forEach(button=>{const selected=button.dataset.tab===name;button.classList.toggle('active',selected);button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  }
  Object.keys(sections).forEach((key,index)=>{
   const button=document.createElement('button');button.type='button';button.dataset.tab=key;button.id=`ticket-tab-${key}`;button.setAttribute('role','tab');button.setAttribute('aria-controls',`ticket-panel-${key}`);
   sections[key].id=`ticket-panel-${key}`;sections[key].setAttribute('role','tabpanel');sections[key].setAttribute('aria-labelledby',button.id);
   button.textContent=l[key]+(key==='conversation'?` (${comments.length})`:'');
   button.addEventListener('click',()=>activate(key));
   button.addEventListener('keydown',event=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(event.key)){event.preventDefault();const buttons=Array.from(tabs.children);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();}});
   tabs.appendChild(button);
  });
  columns.before(tabs);activate(activeTabs.get(String(ticket.id))||'conversation');
 }
 async function manageParticipants(ticket,node){
  const lang=document.getElementById('languageSelector-app')?.value||'fr';
  const words=({fr:{add:'Ajouter un participant',remove:'Retirer',failed:'Impossible de modifier les participants.'},en:{add:'Add participant',remove:'Remove',failed:'Unable to update participants.'},ar:{add:'إضافة مشارك',remove:'إزالة',failed:'تعذر تعديل المشاركين.'}})[lang];
  const editable=typeof canManageTickets==='function'&&canManageTickets(window.currentUser);
  try{
   const rows=await window.sbFetch(`ticket_conversation_participants?ticket_id=eq.${encodeURIComponent(ticket.id)}&order=created_at.asc`);
   if(!node.isConnected)return;
   const list=document.createElement('div');node.appendChild(list);
   (Array.isArray(rows)?rows:[]).forEach(row=>{
    const item=document.createElement('div');item.style.cssText='display:flex;gap:8px;align-items:center;margin-top:6px';
    const name=document.createElement('span');name.dataset.userContent='true';name.textContent=`${row.display_name} · ${row.role_label}`;item.appendChild(name);
    if(editable){const button=document.createElement('button');button.type='button';button.className='btn btn-outline btn-sm';button.textContent=words.remove;button.onclick=async()=>{button.disabled=true;try{await window.sbFetch(`ticket_conversation_participants?ticket_id=eq.${encodeURIComponent(ticket.id)}&user_id=eq.${encodeURIComponent(row.user_id)}`,{method:'DELETE'});item.remove();}catch(error){window.showToast?.(words.failed,'err');button.disabled=false;}};item.appendChild(button);}
    list.appendChild(item);
   });
   if(!editable)return;
   const candidates=await window.sbFetch('rpc/ticket_assignment_candidates',{method:'POST',body:JSON.stringify({ticket_hotel:ticket.hotel})});
   if(!node.isConnected)return;
   const select=document.createElement('select');select.setAttribute('aria-label',words.add);
   (Array.isArray(candidates)?candidates:[]).filter(c=>!rows.some(r=>r.user_id===c.assigned_to)).forEach(c=>{const option=document.createElement('option');option.value=c.assigned_to;option.textContent=`${c.prenom||''} ${c.nom||''} · ${c.role}`;select.appendChild(option);});
   const add=document.createElement('button');add.type='button';add.className='btn btn-outline btn-sm';add.textContent=words.add;add.disabled=!select.options.length;
   add.onclick=async()=>{add.disabled=true;try{await window.sbFetch('ticket_conversation_participants',{method:'POST',body:JSON.stringify({ticket_id:ticket.id,user_id:select.value,display_name:'',role_label:''})});if(node.isConnected){list.remove();select.remove();add.remove();void manageParticipants(ticket,node);}}catch(error){window.showToast?.(words.failed,'err');add.disabled=false;}};
   node.append(select,add);
  }catch(error){console.warn('Participants unavailable',error);}
 }
 window.TicketConversation={mount,upload,clearDraft(id){drafts.delete(draftKey(id));},async download(id){
  const row=files.get(id),client=window.OnomoAuth?.getClient?.();if(!row||!client)return;
  const {data,error}=await client.storage.from('ticket-message-files').createSignedUrl(row.storage_path,60);
  if(!error&&data?.signedUrl)window.open(data.signedUrl,'_blank','noopener');
 }};
})();

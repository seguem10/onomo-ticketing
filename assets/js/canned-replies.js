/* Canned replies (table public.canned_replies).
   A library of ready-made answers shared by the technicians. From the reply
   box of a ticket, a technician opens the list, searches it and inserts a
   reply at the cursor; {demandeur}, {ticket}, {titre}, {hotel} and {agent}
   are filled in from the ticket. Anyone allowed to handle tickets can add a
   reply; its author or an administrator can change or delete it. RLS
   enforces those rules; this file only decides what to show. */
(function(){
 'use strict';
 const L={
  fr:{button:'Réponses types',search:'Rechercher une réponse…',none:'Aucune réponse type. Créez la première.',noMatch:'Aucune réponse ne correspond.',add:'Nouvelle réponse',title:'Titre',body:'Texte de la réponse',hint:'Variables : {demandeur} {ticket} {titre} {hotel} {agent}',save:'Enregistrer',cancel:'Annuler',edit:'Modifier',remove:'Supprimer',confirm:'Supprimer cette réponse type ?',saved:'Réponse type enregistrée',removed:'Réponse type supprimée',failed:'Action impossible',required:'Le titre et le texte sont obligatoires',close:'Fermer',loading:'Chargement…'},
  en:{button:'Canned replies',search:'Search a reply…',none:'No canned reply yet. Create the first one.',noMatch:'No reply matches.',add:'New reply',title:'Title',body:'Reply text',hint:'Variables: {demandeur} {ticket} {titre} {hotel} {agent}',save:'Save',cancel:'Cancel',edit:'Edit',remove:'Delete',confirm:'Delete this canned reply?',saved:'Canned reply saved',removed:'Canned reply deleted',failed:'Action failed',required:'Title and text are required',close:'Close',loading:'Loading…'},
  ar:{button:'ردود جاهزة',search:'ابحث عن رد…',none:'لا توجد ردود جاهزة بعد. أنشئ الأول.',noMatch:'لا يوجد رد مطابق.',add:'رد جديد',title:'العنوان',body:'نص الرد',hint:'المتغيرات: {demandeur} {ticket} {titre} {hotel} {agent}',save:'حفظ',cancel:'إلغاء',edit:'تعديل',remove:'حذف',confirm:'حذف هذا الرد الجاهز؟',saved:'تم حفظ الرد الجاهز',removed:'تم حذف الرد الجاهز',failed:'تعذر تنفيذ الإجراء',required:'العنوان والنص مطلوبان',close:'إغلاق',loading:'جارٍ التحميل…'}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const ticket=()=>typeof currentTicket!=='undefined'?currentTicket:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);
 const ask=message=>typeof window.confirm==='function'?window.confirm(message):true;

 let rows=[],loaded=false,loading=null,open=false,query='',editing=null;

 function load(force){
  if(loading&&!force)return loading;
  if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function')return Promise.resolve(rows);
  loading=window.sbFetch('canned_replies?select=id,title,body,created_by,updated_at&order=title.asc&limit=500')
   .then(result=>{rows=Array.isArray(result)?result:[];loaded=true;return rows;})
   .catch(error=>{console.warn('Réponses types indisponibles',error);loaded=true;return rows;})
   .finally(()=>{loading=null;});
  return loading;
 }
 function isAdmin(who=user()){
  const roles=Array.isArray(who?.roles)?who.roles:[];
  return who?.role==='admin'||roles.includes('Administrateur')||roles.includes('admin');
 }
 function canChange(row,who=user()){
  return isAdmin(who)||(!!row?.created_by&&String(row.created_by)===String(who?.auth_user_id||''));
 }
 function fill(body,item=ticket(),who=user()){
  const values={
   demandeur:item?.created_by_name||item?.demandeur||item?.created_by_email||'',
   ticket:item?.numero||'',titre:item?.titre||'',hotel:item?.hotel||'',
   agent:[who?.prenom,who?.nom].filter(Boolean).join(' ')||who?.email||''
  };
  return String(body||'').replace(/\{(demandeur|ticket|titre|hotel|agent)\}/g,(_,key)=>values[key]);
 }
 function filtered(){
  const q=query.trim().toLowerCase();
  return q?rows.filter(row=>`${row.title} ${row.body}`.toLowerCase().includes(q)):rows;
 }

 function button(){
  const t=text();
  return `<button type="button" class="canned-toggle" title="${escape(t.button)}" aria-label="${escape(t.button)}" aria-expanded="${open}" aria-controls="cannedRepliesPanel" onclick="CannedReplies.toggle()"><i class="ti ti-message-bolt"></i><span>${escape(t.button)}</span></button>`;
 }
 function form(row){
  const t=text();
  return `<div class="canned-form">
   <input id="cannedTitle" class="field-ctrl" maxlength="120" placeholder="${escape(t.title)}" value="${escape(row?.title||'')}">
   <textarea id="cannedBody" class="field-ctrl" rows="4" maxlength="4000" placeholder="${escape(t.body)}">${escape(row?.body||'')}</textarea>
   <small>${escape(t.hint)}</small>
   <div class="canned-actions"><button type="button" class="btn btn-outline btn-sm" onclick="CannedReplies.cancel()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="CannedReplies.save()"><i class="ti ti-device-floppy"></i>${escape(t.save)}</button></div>
  </div>`;
 }
 function panelHtml(){
  const t=text();
  if(editing)return form(editing==='new'?null:rows.find(row=>String(row.id)===String(editing)));
  const list=filtered();
  const items=!loaded?`<p class="canned-empty">${escape(t.loading)}</p>`
   :!rows.length?`<p class="canned-empty">${escape(t.none)}</p>`
   :!list.length?`<p class="canned-empty">${escape(t.noMatch)}</p>`
   :`<ul class="canned-list">${list.map(row=>`<li><button type="button" class="canned-use" data-canned-id="${escape(row.id)}" onclick="CannedReplies.insert(this.dataset.cannedId)"><strong>${escape(row.title)}</strong><span>${escape(String(row.body).slice(0,140))}</span></button>${canChange(row)?`<span class="canned-row-actions"><button type="button" title="${escape(t.edit)}" aria-label="${escape(t.edit)}" data-canned-id="${escape(row.id)}" onclick="CannedReplies.edit(this.dataset.cannedId)"><i class="ti ti-edit"></i></button><button type="button" title="${escape(t.remove)}" aria-label="${escape(t.remove)}" data-canned-id="${escape(row.id)}" onclick="CannedReplies.remove(this.dataset.cannedId)"><i class="ti ti-trash"></i></button></span>`:''}</li>`).join('')}</ul>`;
  return `<div class="canned-head"><input id="cannedSearch" class="field-ctrl" type="search" placeholder="${escape(t.search)}" value="${escape(query)}" oninput="CannedReplies.search(this.value)"><button type="button" class="btn btn-outline btn-sm" onclick="CannedReplies.edit('new')"><i class="ti ti-plus"></i>${escape(t.add)}</button><button type="button" class="canned-close" aria-label="${escape(t.close)}" onclick="CannedReplies.toggle(false)">×</button></div>${items}`;
 }
 function render(){
  const panel=document.getElementById('cannedRepliesPanel');
  if(panel){panel.hidden=!open;panel.innerHTML=open?panelHtml():'';}
  document.querySelectorAll('.canned-toggle').forEach(node=>node.setAttribute('aria-expanded',String(open)));
 }
 function toggle(force){
  open=typeof force==='boolean'?force:!open;
  if(!open){editing=null;}
  render();
  if(open&&!loaded)load().then(render);
  if(open)document.getElementById('cannedSearch')?.focus?.();
 }
 function search(value){
  query=String(value||'');
  render();
  // The panel is redrawn: put the cursor back at the end of the search box.
  const box=document.getElementById('cannedSearch');if(box){box.focus?.();box.setSelectionRange?.(query.length,query.length);}
 }
 function insert(id){
  const row=rows.find(item=>String(item.id)===String(id));if(!row)return false;
  const input=document.getElementById('conversationInput');if(!input)return false;
  const value=fill(row.body),start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
  input.value=input.value.slice(0,start)+value+input.value.slice(end);
  input.focus?.();input.setSelectionRange?.(start+value.length,start+value.length);
  if(typeof Event==='function')input.dispatchEvent?.(new Event('input',{bubbles:true}));
  open=false;editing=null;render();
  return true;
 }
 function edit(id){editing=id||'new';render();document.getElementById('cannedTitle')?.focus?.();}
 function cancel(){editing=null;render();}
 async function save(){
  const t=text();
  const title=(document.getElementById('cannedTitle')?.value||'').trim().slice(0,120);
  const body=(document.getElementById('cannedBody')?.value||'').trim().slice(0,4000);
  if(!title||!body){toast(t.required,'err');return false;}
  const id=editing==='new'?null:editing;
  try{
   const saved=id
    ?await window.sbFetch(`canned_replies?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({title,body})})
    :await window.sbFetch('canned_replies',{method:'POST',body:JSON.stringify({title,body})});
   const row=Array.isArray(saved)&&saved[0];
   if(!row)throw new Error('Aucune ligne enregistrée');
   rows=[...rows.filter(item=>String(item.id)!==String(row.id)),row].sort((a,b)=>String(a.title).localeCompare(String(b.title)));
   editing=null;render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Réponses types',error);toast(t.failed,'err');return false;}
 }
 async function remove(id){
  const t=text();if(!ask(t.confirm))return false;
  try{
   // RLS silently skips rows the user may not delete: an empty answer is a refusal.
   const gone=await window.sbFetch(`canned_replies?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
   if(!Array.isArray(gone)||!gone.length)throw new Error('Suppression refusée');
   rows=rows.filter(item=>String(item.id)!==String(id));render();toast(t.removed,'ok');return true;
  }catch(error){console.error('Réponses types',error);toast(t.failed,'err');return false;}
 }
 // A new ticket page starts with the list closed.
 function mount(){open=false;editing=null;query='';render();}

 window.CannedReplies={load,fill,button,mount,toggle,search,insert,edit,cancel,save,remove,canChange,_setRows:value=>{rows=value;loaded=true;}};
})();

(function(){
 'use strict';
 const copy=()=>({fr:{signature:'Ajouter ma signature',edit:'Modifier la signature',saved:'Signature enregistrée sur cet appareil',save:'Enregistrer',cancel:'Annuler'},en:{signature:'Add my signature',edit:'Edit signature',saved:'Signature saved on this device',save:'Save',cancel:'Cancel'},ar:{signature:'إضافة توقيعي',edit:'تعديل التوقيع',saved:'تم حفظ التوقيع على هذا الجهاز',save:'حفظ',cancel:'إلغاء'}}[document.getElementById('languageSelector-app')?.value||'fr']);
 const key=()=>`onomo.signature.${window.currentUser?.auth_user_id||''}`;
 function signature(){try{return localStorage.getItem(key())||'';}catch{return '';}}
 function mount(){
  const page=document.querySelector('.detail-page-reference'),info=document.querySelector('.detail-info-section'),participants=document.getElementById('conversationParticipants');
  if(page&&info&&!page.querySelector('.ticket-context-sidebar')){
   page.classList.add('ticket-professional-workspace');
   const sidebar=document.createElement('aside');sidebar.className='ticket-context-sidebar';
   sidebar.appendChild(info);if(participants)sidebar.appendChild(participants);page.appendChild(sidebar);
  }
  const foot=document.querySelector('.conversation-composer-foot');if(!foot)return;
  const editor=document.getElementById('conversationInput'),toolbar=document.querySelector('.conversation-toolbar');
  const language=document.getElementById('languageSelector-app')?.value||'fr';
  const editorLabels=({fr:{numbered:'Liste numérotée',code:'Code',preview:'Aperçu du message'},en:{numbered:'Numbered list',code:'Code',preview:'Message preview'},ar:{numbered:'قائمة مرقمة',code:'رمز',preview:'معاينة الرسالة'}})[language];
  if(toolbar&&!toolbar.querySelector('[data-extra-format]')){
   [[editorLabels.numbered,'1. ','','ti-list-numbers'],[editorLabels.code,'`','`','ti-code']].forEach(([title,before,after,icon])=>{
    const button=document.createElement('button');button.type='button';button.dataset.extraFormat='true';button.title=title;button.setAttribute('aria-label',title);button.innerHTML=`<i class="ti ${icon}"></i>`;
    button.onclick=()=>window.insertConversationFormat(before,after);toolbar.appendChild(button);
   });
  }
  if(editor&&!document.getElementById('conversationPreview')){
   const preview=document.createElement('details');preview.className='conversation-preview';preview.id='conversationPreview';
   const heading=document.createElement('summary');heading.textContent=editorLabels.preview;
   const content=document.createElement('div');content.className='conversation-content';content.dataset.userContent='true';
   const update=()=>{content.innerHTML=format(editor.value);};preview.addEventListener('toggle',update);editor.addEventListener('input',()=>{if(preview.open)update();});preview.append(heading,content);editor.after(preview);
  }
  if(document.querySelector('.conversation-signature'))return;
  const labels=copy(),box=document.createElement('div');box.className='conversation-signature';
  const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='conversationUseSignature';label.append(check,document.createTextNode(` ${labels.signature}`));
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=labels.edit;details.appendChild(summary);
  const input=document.createElement('textarea');input.maxLength=500;input.value=signature();input.setAttribute('aria-label',labels.edit);
  const save=document.createElement('button');save.type='button';save.className='btn btn-outline btn-sm';save.textContent=labels.save;
  save.onclick=()=>{try{localStorage.setItem(key(),input.value.trim());details.open=false;window.showToast?.(labels.saved,'ok');}catch{details.open=true;}};
  details.append(input,save);box.append(label,details);foot.before(box);
 }
 function withSignature(message){const value=signature();return document.getElementById('conversationUseSignature')?.checked&&value?`${message}\n\n${value}`:message;}
 function quote(comment,ticket,comments,canSeeInternal,escape){
  const parent=comments.find(row=>String(row.id)===String(comment.reply_to)&&String(row.ticket_id)===String(ticket.id));
  if(!parent||parent.visibility==='internal'&&(!canSeeInternal||comment.visibility!=='internal'))return '';
  return `<blockquote class="conversation-quote" data-user-content="true"><strong>${escape(parent.auteur||'')}</strong><div>${escape(String(parent.message||'').slice(0,240))}</div></blockquote>`;
 }
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function inline(value){
  const pattern=/\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|_([^_\n]+)_|`([^`\n]+)`/g;
  let result='',last=0;
  for(const match of value.matchAll(pattern)){
   result+=escape(value.slice(last,match.index));last=match.index+match[0].length;
   if(match[1]){
    let url;try{url=new URL(match[2]);}catch{}
    result+=url&&['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?`<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(match[1])}</a>`:escape(match[0]);
   }else{const index=[3,4,5,6].find(i=>match[i]!==undefined),tag={3:'strong',4:'u',5:'em',6:'code'}[index];result+=`<${tag}>${escape(match[index])}</${tag}>`;}
  }
  return result+escape(value.slice(last));
 }
 function format(message){
  let html='',list='';
  for(const line of String(message??'').split(/\r?\n/)){
   const bullet=line.match(/^\s*[-•]\s+(.+)$/),number=line.match(/^\s*\d+[.)]\s+(.+)$/),next=bullet?'ul':number?'ol':'';
   if(next!==list){if(list)html+=`</${list}>`;if(next)html+=`<${next}>`;list=next;}
   html+=list?`<li>${inline((bullet||number)[1])}</li>`:`<div>${inline(line)||'<br>'}</div>`;
  }
  if(list)html+=`</${list}>`;return html;
 }
 window.ConversationExtras={mount,withSignature,quote,format};
})();

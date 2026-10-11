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
 window.ConversationExtras={mount,withSignature,quote};
})();

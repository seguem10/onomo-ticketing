/* Requester satisfaction (table public.ticket_feedback).
   On a resolved or closed ticket, its creator rates it from 1 to 5 with an
   optional comment, and can change it later. Staff, directors and HR who can
   read the ticket see the rating there and in the reports. RLS enforces who
   may write; this file only decides what to show. */
(function(){
 'use strict';
 const CLOSED=['résolu','fermé'];
 const L={
  fr:{title:'Votre avis',ask:'Ce ticket est résolu. Êtes-vous satisfait de l’intervention ?',comment:'Commentaire (facultatif)',send:'Envoyer mon avis',change:'Modifier mon avis',cancel:'Annuler',yours:'Votre note',requester:'Satisfaction du demandeur',saved:'Merci, votre avis est enregistré',failed:'Avis non enregistré',choose:'Choisissez une note de 1 à 5',outOf:'sur 5',section:'Satisfaction des demandeurs',reviews:n=>n===1?'1 avis':n+' avis',none:'Aucun avis pour le moment',column:'Satisfaction'},
  en:{title:'Your feedback',ask:'This ticket is resolved. Are you satisfied with the support?',comment:'Comment (optional)',send:'Send my feedback',change:'Change my feedback',cancel:'Cancel',yours:'Your rating',requester:'Requester satisfaction',saved:'Thank you, your feedback is saved',failed:'Feedback not saved',choose:'Choose a rating from 1 to 5',outOf:'out of 5',section:'Requester satisfaction',reviews:n=>n===1?'1 review':n+' reviews',none:'No feedback yet',column:'Satisfaction'},
  ar:{title:'رأيك',ask:'تم حل هذه التذكرة. هل أنت راضٍ عن الدعم؟',comment:'تعليق (اختياري)',send:'إرسال رأيي',change:'تعديل رأيي',cancel:'إلغاء',yours:'تقييمك',requester:'رضا مقدم الطلب',saved:'شكرًا، تم حفظ رأيك',failed:'لم يتم حفظ الرأي',choose:'اختر تقييمًا من 1 إلى 5',outOf:'من 5',section:'رضا مقدمي الطلبات',reviews:n=>n+' تقييم',none:'لا توجد تقييمات بعد',column:'الرضا'}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);

 let rows=[],loaded=false,loading=null,picked=0,editing=false,ticket=null;

 function load(force){
  if(loading&&!force)return loading;
  if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function')return Promise.resolve(rows);
  loading=window.sbFetch('ticket_feedback?select=ticket_id,rating,comment,created_by,updated_at&limit=5000')
   .then(result=>{rows=Array.isArray(result)?result:[];loaded=true;return rows;})
   .catch(error=>{console.warn('Satisfaction indisponible',error);return rows;})
   .finally(()=>{loading=null;});
  return loading;
 }
 const forTicket=id=>rows.find(row=>String(row.ticket_id)===String(id));
 function summary(list){
  const ids=new Set((list||[]).map(item=>String(item.id)));
  const rated=rows.filter(row=>ids.has(String(row.ticket_id)));
  const counts=[0,0,0,0,0];rated.forEach(row=>{const n=Number(row.rating);if(n>=1&&n<=5)counts[n-1]++;});
  const count=rated.length;
  return {count,avg:count?Math.round(rated.reduce((sum,row)=>sum+Number(row.rating),0)/count*10)/10:0,counts};
 }
 const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
 function isCreator(item,who=user()){
  const identity=[who?.auth_user_id,who?.id,who?.email].filter(Boolean).map(value=>String(value).toLowerCase());
  return [item?.created_by,item?.created_by_email].filter(Boolean).some(value=>identity.includes(String(value).toLowerCase()));
 }

 function html(item,who=user()){
  if(!item||!CLOSED.includes(item.statut))return '';
  const t=text(),feedback=forTicket(item.id);
  if(isCreator(item,who)){
   if(feedback&&!editing)return `<section class="satisfaction-card"><h3><i class="ti ti-star"></i> ${escape(t.yours)}</h3><div class="satisfaction-stars" aria-label="${feedback.rating} ${escape(t.outOf)}">${stars(Number(feedback.rating))}</div>${feedback.comment?`<p class="satisfaction-comment">${escape(feedback.comment)}</p>`:''}<button type="button" class="btn btn-outline btn-sm" onclick="TicketSatisfaction.edit()"><i class="ti ti-edit"></i>${escape(t.change)}</button></section>`;
   const current=picked||Number(feedback?.rating)||0;
   return `<section class="satisfaction-card"><h3><i class="ti ti-star"></i> ${escape(t.title)}</h3><p>${escape(t.ask)}</p>
    <div class="satisfaction-picker" role="radiogroup" aria-label="${escape(t.choose)}">${[1,2,3,4,5].map(n=>`<button type="button" role="radio" aria-checked="${n===current}" aria-label="${n} ${escape(t.outOf)}" class="${n<=current?'on':''}" onclick="TicketSatisfaction.pick(${n})">★</button>`).join('')}</div>
    <textarea id="satisfactionComment" class="field-ctrl" rows="2" maxlength="1000" placeholder="${escape(t.comment)}">${escape(feedback?.comment||'')}</textarea>
    <div class="satisfaction-actions">${feedback?`<button type="button" class="btn btn-outline btn-sm" onclick="TicketSatisfaction.cancel()">${escape(t.cancel)}</button>`:''}<button type="button" class="btn btn-gold btn-sm" onclick="TicketSatisfaction.submit()"><i class="ti ti-send"></i>${escape(t.send)}</button></div></section>`;
  }
  if(!feedback)return '';
  return `<section class="satisfaction-card"><h3><i class="ti ti-star"></i> ${escape(t.requester)}</h3><div class="satisfaction-stars" aria-label="${feedback.rating} ${escape(t.outOf)}">${stars(Number(feedback.rating))}</div>${feedback.comment?`<p class="satisfaction-comment">${escape(feedback.comment)}</p>`:''}</section>`;
 }
 function render(){const host=document.getElementById('ticketSatisfaction');if(host&&ticket)host.innerHTML=html(ticket);}
 function mount(item){
  if(String(ticket?.id)!==String(item?.id)){picked=0;editing=false;}
  ticket=item;render();
  if(!loaded&&item&&CLOSED.includes(item.statut))load().then(()=>{if(String(ticket?.id)===String(item.id))render();});
 }
 function pick(n){
  // Keep a comment being typed when the stars are redrawn.
  const draft=document.getElementById('satisfactionComment')?.value;
  picked=n;render();
  const box=document.getElementById('satisfactionComment');if(box&&draft!==undefined)box.value=draft;
 }
 function edit(){editing=true;picked=Number(forTicket(ticket?.id)?.rating)||0;render();}
 function cancel(){editing=false;picked=0;render();}
 async function submit(){
  const t=text();if(!ticket)return false;
  const rating=picked||Number(forTicket(ticket.id)?.rating)||0;
  if(rating<1||rating>5){toast(t.choose,'err');return false;}
  const comment=(document.getElementById('satisfactionComment')?.value||'').trim().slice(0,1000)||null;
  const existing=forTicket(ticket.id);
  try{
   const saved=existing
    ?await window.sbFetch(`ticket_feedback?ticket_id=eq.${encodeURIComponent(ticket.id)}`,{method:'PATCH',body:JSON.stringify({rating,comment})})
    :await window.sbFetch('ticket_feedback',{method:'POST',body:JSON.stringify({ticket_id:ticket.id,rating,comment})});
   const row=Array.isArray(saved)&&saved[0]?saved[0]:{ticket_id:ticket.id,rating,comment};
   rows=[...rows.filter(item=>String(item.ticket_id)!==String(ticket.id)),row];
   editing=false;picked=0;render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Satisfaction',error);toast(t.failed,'err');return false;}
 }

 // Report block: average, number of reviews and the 5→1 distribution.
 function reportHtml(list){
  if(!loaded){load().then(rerenderReport);}
  const t=text(),s=summary(list),max=Math.max(...s.counts,1);
  const body=s.count?`<div class="satisfaction-report"><div class="satisfaction-score"><strong>${s.avg.toLocaleString()}</strong><span>/5</span><div class="satisfaction-stars">${stars(Math.round(s.avg))}</div><small>${escape(t.reviews(s.count))}</small></div><div class="chart-wrap satisfaction-bars">${[5,4,3,2,1].map(n=>`<div class="bar-row"><div class="bar-lbl">${n} ★</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(s.counts[n-1]/max*100)}%;background:var(--amber)"></div></div><div class="bar-cnt">${s.counts[n-1]}</div></div>`).join('')}</div></div>`:`<div class="empty-state" style="padding:16px"><p>${escape(t.none)}</p></div>`;
  return `<div class="report-section" style="margin-bottom:12px"><div class="section-title"><i class="ti ti-star"></i>${escape(t.section)}</div>${body}</div>`;
 }
 function agentCell(list){const s=summary(list);return s.count?`${s.avg.toLocaleString()} ★ <span style="font-size:10px;color:var(--tx3)">(${s.count})</span>`:'—';}
 let rerendered=false;
 function rerenderReport(){
  if(rerendered)return;rerendered=true;
  const view=typeof currentView!=='undefined'?currentView:'';
  const renderers={'report-global':'renderReportGlobal','report-hotel':'renderReportHotel','report-agents':'renderReportAgents','report-my':'renderReportMy'};
  const fn=window[renderers[view]];if(typeof fn==='function')fn();
 }

 window.TicketSatisfaction={load,summary,html,mount,pick,edit,cancel,submit,reportHtml,agentCell,column:()=>text().column,_setRows:value=>{rows=value;loaded=true;}};
})();

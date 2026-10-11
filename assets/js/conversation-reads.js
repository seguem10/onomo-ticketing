/* Read receipts are recorded only for visible messages, never hidden IT notes. */
(function(){
 'use strict';
 let observer,actor='',busy=false;
 const recorded=new Set();
 const labels=()=>({fr:{read:'Lu',messages:'Messages',unread:'non lus'},en:{read:'Read',messages:'Messages',unread:'unread'},ar:{read:'مقروء',messages:'الرسائل',unread:'غير مقروءة'}}[document.getElementById('languageSelector-app')?.value||'fr']);
 async function refresh(){
  if(busy||!window.currentUser?.auth_user_id||typeof window.sbFetch!=='function')return;
  busy=true;const user=window.currentUser.auth_user_id;
  try{
   if(actor!==user){recorded.clear();actor=user;}
   const rows=await window.sbFetch('ticket_message_counts?select=ticket_id,message_count,unread_count');
   if(window.currentUser?.auth_user_id!==user)return;
   const counts=new Map(rows.map(row=>[String(row.ticket_id),row]));
   document.querySelectorAll('[data-ticket-message-count]').forEach(node=>{
    const row=counts.get(node.dataset.ticketMessageCount),l=labels();
    node.textContent=row?`${l.messages}: ${row.message_count}${Number(row.unread_count)?` · ${row.unread_count} ${l.unread}`:''}`:`${l.messages}: 0`;
    node.style.color=Number(row?.unread_count)?'var(--blue)':'var(--tx3)';
   });
   const cards=Array.from(document.querySelectorAll('.conversation-message[data-comment-id]'));
   observer?.disconnect();
   observer=new IntersectionObserver(entries=>{
    if(document.visibilityState!=='visible')return;
    entries.filter(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.5).forEach(entry=>{
     const id=entry.target.dataset.commentId;
     if(!/^[0-9a-f-]{36}$/i.test(id)||recorded.has(id))return;
     recorded.add(id);
     window.sbFetch('ticket_message_reads?on_conflict=comment_id,user_id',{method:'POST',body:JSON.stringify({comment_id:id,user_id:user}),prefer:'resolution=ignore-duplicates,return=minimal'}).catch(()=>recorded.delete(id));
    });
   },{threshold:0.5});
   cards.forEach(card=>observer.observe(card));
   const mine=cards.filter(card=>card.classList.contains('is-mine'));
   if(mine.length){
    const ids=mine.map(card=>card.dataset.commentId).filter(id=>/^[0-9a-f-]{36}$/i.test(id));
    if(ids.length){
     const reads=await window.sbFetch(`ticket_message_reads?comment_id=in.(${ids.join(',')})&user_id=neq.${encodeURIComponent(user)}&select=comment_id`);
     if(window.currentUser?.auth_user_id!==user)return;
     const seen=new Set(reads.map(row=>row.comment_id));
     mine.forEach(card=>{const status=card.querySelector('[data-read-status]');if(status&&seen.has(card.dataset.commentId)){status.textContent=`✓✓ ${labels().read}`;status.style.color='var(--blue)';}});
    }
   }
  }catch(error){console.warn('Conversation read state unavailable',error);}
  finally{busy=false;}
 }
 let timer;
 new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(refresh,400);}).observe(document.getElementById('mainContent'),{childList:true});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh();});
 setInterval(()=>{if(document.visibilityState==='visible')void refresh();},30000);
 void refresh();
})();

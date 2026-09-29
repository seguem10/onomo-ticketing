/* ONOMO Support IT — advisory assistant UI.
   No provider secret lives in this file: every model request goes through the
   authenticated Supabase Edge Function. */
(function(){
  'use strict';
  const state={conversationId:null,domain:'general',messages:[],lastAnswer:null,conversations:[]};
  const domainKeys=['microsoft365','sage1000','citrix','opera','pos','network','maintenance','general'];
  const domainLabels={microsoft365:'Microsoft 365',sage1000:'Sage 1000',citrix:'Citrix',opera:'OPERA PMS',pos:'POS',network:'IT / Réseau',maintenance:'Maintenance',general:'Support IT'};
  const esc=value=>window.esc?window.esc(value):String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const tr=(key,fallback,values={})=>{
    const translate=window.OnomoI18n?.translate;
    const text=translate?translate(key,window.OnomoI18n?.language,values):(window.OnomoI18n?.t?.(key)||fallback);
    return text===key?fallback:text;
  };
  const language=()=>window.OnomoI18n?.language||localStorage.getItem('onomo_language')||'fr';
  const isTechnician=()=>Boolean(window.canManageTickets?.(window.currentUser));
  const request=async body=>{
    const session=await window.OnomoAuth?.getSession?.();
    const settings=window.settings||{};
    if(!session?.access_token||!settings.sbUrl||!settings.sbKey)throw new Error(tr('assistant_auth_unavailable','Session Supabase indisponible. Reconnectez-vous.'));
    const response=await fetch(`${settings.sbUrl}/functions/v1/ai-it-assistant`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,apikey:settings.sbKey},body:JSON.stringify({...body,language:language()})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.error)throw new Error(data.error||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'));
    return data;
  };
  const list=(title,items,cls='')=>items?.length?`<section class="assistant-block ${cls}"><h4>${esc(title)}</h4><ul>${items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></section>`:'';
  function answerCard(answer,sources=[]){
    if(!answer)return'';
    const sourceHtml=sources.length?`<section class="assistant-block assistant-sources"><h4>${esc(tr('assistant_sources','Procédures internes utilisées'))}</h4>${sources.map(source=>`<div><strong>${esc(source.title)}</strong><small>${esc(source.source)} · ${esc(source.date)}</small></div>`).join('')}</section>`:`<div class="assistant-disclaimer">${esc(tr('assistant_no_validated_source','Aucune procédure interne validée n’a été utilisée. Cette réponse doit être vérifiée par un humain.'))}</div>`;
    const similar=Array.isArray(answer.similar_tickets)&&answer.similar_tickets.length?`<section class="assistant-block"><h4>${esc(tr('assistant_similar_tickets','Incidents similaires trouvés'))}</h4>${answer.similar_tickets.map(ticket=>`<div class="assistant-similar-ticket"><strong>${esc(ticket.numero)} · ${esc(ticket.titre)}</strong><small>${esc(ticket.categorie||'')} · ${esc(ticket.statut||'')}</small></div>`).join('')}</section>`:'';
    return `<article class="assistant-answer"><div class="assistant-answer-title"><i class="ti ti-sparkles"></i>${esc(tr('assistant_response','Proposition de l’assistant'))}</div><p>${esc(answer.answer)}</p>${list(tr('assistant_causes','Causes possibles'),answer.causes)}${list(tr('assistant_questions','Questions à préciser'),answer.questions,'assistant-questions')}${list(tr('assistant_checks','Vérifications recommandées'),answer.checks)}${list(tr('assistant_solution','Solution proposée'),answer.solution)}${list(tr('assistant_validation','Critères de validation'),answer.validation)}${list(tr('assistant_assumptions','Hypothèses'),answer.assumptions,'assistant-assumptions')}${similar}${sourceHtml}<div class="assistant-disclaimer"><i class="ti ti-user-check"></i>${esc(tr('assistant_human_review','Conseil généré par IA : validez la procédure avant toute action en production.'))}</div></article>`;
  }
  async function loadConversations(){
    if(typeof window.sbFetch!=='function')return [];
    try{return await window.sbFetch('it_ai_conversations?select=id,domain,title,updated_at&order=updated_at.desc&limit=20');}catch(_){return [];}
  }
  async function loadConversation(id){
    if(typeof window.sbFetch!=='function')return;
    try{
      const [conversation,messages]=await Promise.all([
        window.sbFetch(`it_ai_conversations?id=eq.${encodeURIComponent(id)}&select=id,domain,title`),
        window.sbFetch(`it_ai_messages?conversation_id=eq.${encodeURIComponent(id)}&select=author,content,metadata,created_at&order=created_at.asc`)
      ]);
      if(!conversation?.[0])throw new Error('not-found');
      state.conversationId=id;state.domain=conversation[0].domain||'general';state.messages=messages||[];
      const last=[...state.messages].reverse().find(item=>item.author==='assistant');state.lastAnswer=last?.metadata||null;
      renderAssistantView();
    }catch(error){window.showToast?.(tr('assistant_conversation_unavailable','Conversation indisponible.'),'err');}
  }
  function conversationMessage(message){
    const isAssistant=message.author==='assistant';
    return `<div class="assistant-message ${isAssistant?'assistant-message-ai':'assistant-message-user'}"><div class="assistant-message-author">${esc(isAssistant?tr('assistant_name','Assistant IT'):tr('assistant_you','Vous'))}</div>${isAssistant&&message.metadata?answerCard(message.metadata,message.metadata.sources||[]):`<p>${esc(message.content)}</p>`}</div>`;
  }
  async function renderAssistantView(){
    const target=document.getElementById('mainContent');if(!target)return;
    // History is secondary. A slow or unavailable PostgREST request must never
    // leave the user on the dashboard after selecting Assistant IT.
    state.conversations=await Promise.race([
      loadConversations(),
      new Promise(resolve=>setTimeout(()=>resolve([]),1200))
    ]);
    const domainOptions=domainKeys.map(key=>`<option value="${key}" ${state.domain===key?'selected':''}>${esc(domainLabels[key])}</option>`).join('');
    const messages=state.messages.length?state.messages.map(conversationMessage).join(''):`<div class="assistant-empty"><i class="ti ti-message-chatbot"></i><h3>${esc(tr('assistant_start_title','Comment puis-je vous aider ?'))}</h3><p>${esc(tr('assistant_start_description','Choisissez un domaine, décrivez le problème et l’assistant vous guidera sans créer de ticket.'))}</p></div>`;
    target.innerHTML=`<div class="assistant-page"><header class="assistant-header"><div><span class="assistant-kicker"><i class="ti ti-sparkles"></i>${esc(tr('assistant_name','Assistant IT'))}</span><h1>${esc(tr('assistant_title','Diagnostic IT guidé'))}</h1><p>${esc(tr('assistant_subtitle','Conseils pour Microsoft 365, Sage 1000, Citrix, OPERA PMS, POS, réseau et maintenance.'))}</p></div><button class="btn btn-outline" onclick="ITAssistant.startConversation()"><i class="ti ti-plus"></i>${esc(tr('assistant_new_conversation','Nouvelle conversation'))}</button></header><div class="assistant-layout"><aside class="assistant-history"><div class="assistant-history-title">${esc(tr('assistant_conversations','Mes conversations'))}</div>${state.conversations.length?state.conversations.map(item=>`<button class="assistant-history-item ${item.id===state.conversationId?'active':''}" onclick="ITAssistant.openConversation('${item.id}')"><i class="ti ti-message"></i><span>${esc(item.title||domainLabels[item.domain]||tr('assistant_name','Assistant IT'))}</span></button>`).join(''):`<p>${esc(tr('assistant_no_conversations','Aucune conversation enregistrée.'))}</p>`}</aside><main class="assistant-chat"><div class="assistant-safety"><i class="ti ti-shield-lock"></i>${esc(tr('assistant_safety','Ne saisissez jamais de mot de passe, clé API, jeton ou donnée client.'))}</div><div id="assistantMessages" class="assistant-messages">${messages}</div>${state.lastAnswer?.suggested_ticket?.title?`<div class="assistant-ticket-cta"><div><strong>${esc(tr('assistant_ticket_offer','Le problème persiste ?'))}</strong><span>${esc(tr('assistant_ticket_offer_description','Créez un ticket prérempli avec le résumé des vérifications.'))}</span></div><button class="btn btn-gold" onclick="ITAssistant.createTicketFromConversation()"><i class="ti ti-ticket"></i>${esc(tr('assistant_create_ticket','Créer un ticket à partir de cette conversation'))}</button></div>`:''}<form class="assistant-composer" onsubmit="ITAssistant.sendMessage(event)"><select id="assistantDomain" aria-label="${esc(tr('assistant_domain','Domaine IT'))}" onchange="ITAssistant.changeDomain(this.value)">${domainOptions}</select><textarea id="assistantInput" rows="3" maxlength="6000" placeholder="${esc(tr('assistant_placeholder','Décrivez le symptôme, le poste concerné et ce qui a déjà été essayé…'))}" required></textarea><button class="btn btn-gold" id="assistantSendBtn" type="submit"><i class="ti ti-send"></i>${esc(tr('assistant_send','Envoyer'))}</button></form></main></div></div>`;
    const messagesNode=document.getElementById('assistantMessages');if(messagesNode)messagesNode.scrollTop=messagesNode.scrollHeight;
  }
  async function sendMessage(event){
    event?.preventDefault(); const input=document.getElementById('assistantInput');const button=document.getElementById('assistantSendBtn');const message=input?.value.trim();if(!message)return;
    if(button){button.disabled=true;button.innerHTML=`<i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_thinking','Analyse…'))}`;}
    try{
      const result=await request({action:'chat',conversation_id:state.conversationId,domain:state.domain,message});
      const metadata={...result.answer,sources:result.sources||[],similar_tickets:result.similar_tickets||[]};state.conversationId=result.conversation_id;state.messages.push({author:'user',content:message},{author:'assistant',content:result.answer.answer,metadata});state.lastAnswer=metadata;
      renderAssistantView();
    }catch(error){window.showToast?.(error.message||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'),'err');if(button){button.disabled=false;button.innerHTML=`<i class="ti ti-send"></i>${esc(tr('assistant_send','Envoyer'))}`;}}
  }
  function changeDomain(domain){state.domain=domainsSafe(domain);}
  function domainsSafe(domain){return domainKeys.includes(domain)?domain:'general';}
  function startConversation(){state.conversationId=null;state.domain='general';state.messages=[];state.lastAnswer=null;renderAssistantView();}
  function createTicketFromConversation(){
    const suggested=state.lastAnswer?.suggested_ticket;if(!suggested)return;
    const checks=(state.lastAnswer.checks||[]).map(item=>`- ${item}`).join('\n');
    const description=[suggested.description,checks?`${tr('assistant_checks_done','Vérifications déjà effectuées :')}\n${checks}`:'',`${tr('assistant_ai_note','Note IA : cette synthèse doit être vérifiée par un technicien.')}`].filter(Boolean).join('\n\n');
    const fallbackCategory=state.domain==='maintenance'?'Maintenance':'IT / Réseau';
    window.openNewTicket?.({titre:suggested.title,description,categorie:Array.isArray(window.CATS)&&window.CATS.includes(suggested.category)?suggested.category:fallbackCategory,priorite:suggested.priority});
  }
  async function openTicketAssistant(){
    const ticket=window.currentTicket;if(!ticket){window.showToast?.(tr('access_denied','Accès non autorisé.'),'err');return;}
    const modal=document.createElement('div');modal.id='ticketAssistantModal';modal.className='overlay open';modal.innerHTML=`<div class="modal assistant-ticket-modal"><div class="modal-hdr"><div class="modal-title"><i class="ti ti-sparkles"></i>${esc(tr('assistant_ticket_button','Proposer une solution avec l’IA'))}</div><button class="modal-close" onclick="ITAssistant.closeTicketAssistant()"><i class="ti ti-x"></i></button></div><div class="modal-body" id="ticketAssistantBody"><div class="assistant-loading"><i class="ti ti-loader-2 spin"></i>${esc(tr('assistant_thinking','Analyse…'))}</div></div></div>`;document.body.appendChild(modal);
    try{
      const result=await request({action:'ticket',ticket_id:ticket.id,domain:ticket.categorie==='Maintenance'?'maintenance':'general'});
      const existing=await loadTicketSolution(ticket.id);const draft=existing?.proposal||result.answer;
      renderTicketAssistant({...result.answer,similar_tickets:result.similar_tickets||[]},result.sources||[],existing);
      if(!existing)state.ticketProposal={ticketId:ticket.id,proposal:draft};
    }catch(error){const body=document.getElementById('ticketAssistantBody');if(body)body.innerHTML=`<div class="assistant-service-error"><i class="ti ti-alert-circle"></i><strong>${esc(tr('assistant_unavailable_title','Assistant IT indisponible'))}</strong><p>${esc(error.message||tr('assistant_unavailable','Le service Assistant IT est temporairement indisponible.'))}</p></div>`;}
  }
  async function loadTicketSolution(ticketId){try{const rows=await window.sbFetch?.(`ticket_ai_solutions?ticket_id=eq.${encodeURIComponent(ticketId)}&select=*&limit=1`);return rows?.[0]||null;}catch(_){return null;}}
  function renderTicketAssistant(answer,sources,existing){
    const body=document.getElementById('ticketAssistantBody');if(!body)return;
    const solution=(existing?.validated_solution)||(answer.solution||[]).join('\n');
    const editing=isTechnician();
    body.innerHTML=`${answerCard(answer,sources)}${editing?`<div class="form-g"><label class="field-lbl">${esc(tr('assistant_validated_solution','Solution validée par le technicien'))}</label><textarea id="ticketAssistantSolution" class="field-ctrl" rows="6" placeholder="${esc(tr('assistant_solution_placeholder','Corrigez puis enregistrez la solution validée…'))}">${esc(solution)}</textarea></div><div class="assistant-modal-actions"><button class="btn btn-outline" onclick="ITAssistant.saveTicketSolution('draft')">${esc(tr('assistant_save_draft','Enregistrer comme proposition'))}</button><button class="btn btn-gold" onclick="ITAssistant.saveTicketSolution('validated')"><i class="ti ti-check"></i>${esc(tr('assistant_validate_solution','Enregistrer la solution validée'))}</button></div>`:''}`;
    state.ticketProposal={ticketId:window.currentTicket?.id,proposal:answer,existingId:existing?.id||null};
  }
  async function saveTicketSolution(status){
    const current=state.ticketProposal;if(!current?.ticketId)return;
    const validated_solution=document.getElementById('ticketAssistantSolution')?.value.trim()||null;
    const userId=window.currentUser?.auth_user_id||window.currentUser?.id;
    const payload={ticket_id:current.ticketId,generated_by:userId,proposal:current.proposal,status,validated_solution,validated_by:status==='validated'?userId:null,validated_at:status==='validated'?new Date().toISOString():null};
    try{
      if(current.existingId)await window.sbFetch(`ticket_ai_solutions?id=eq.${encodeURIComponent(current.existingId)}`,{method:'PATCH',body:JSON.stringify(payload),prefer:'return=representation'});
      else {const rows=await window.sbFetch('ticket_ai_solutions',{method:'POST',body:JSON.stringify(payload),prefer:'return=representation'});current.existingId=rows?.[0]?.id||null;}
      window.showToast?.(status==='validated'?tr('assistant_solution_saved','Solution validée enregistrée.'):tr('assistant_draft_saved','Proposition enregistrée.'),'ok');closeTicketAssistant();
    }catch(error){window.showToast?.(tr('assistant_save_failed','Impossible d’enregistrer la solution.'),'err');}
  }
  function closeTicketAssistant(){document.getElementById('ticketAssistantModal')?.remove();}
  window.ITAssistant={renderAssistantView,sendMessage,startConversation,openConversation:loadConversation,changeDomain,createTicketFromConversation,openTicketAssistant,saveTicketSolution,closeTicketAssistant};
})();

/* Onomo Support IT - corrections complémentaires */
(function(){
  'use strict';
  const POWER=['Administrateur','IT Regional','IT Hotel','Directeur'];
  const roleName=u=>{const a={admin:'Administrateur',it_regional:'IT Regional',it_hotel:'IT Hotel',direction:'Directeur'};return (u?.roles?.length?u.roles:[u?.role||'Demandeur']).map(r=>a[r]||r)};
  const isPower=u=>roleName(u).some(r=>POWER.includes(r));
  const isAdmin=u=>roleName(u).includes('Administrateur');
  const N=v=>String(v??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const readUsers=()=>{try{const a=JSON.parse(localStorage.getItem('dh_users')||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}};
  const ticketUsers=()=>readUsers().filter(u=>u&&u.email&&['it_regional','it_hotel','it regional','it hotel'].includes(N(u.role)));
  const resolveTicketUser=value=>{const s=N(value);if(!s)return null;return ticketUsers().find(u=>{const ids=[u.auth_user_id,u.id,u.email].filter(Boolean).map(String);const name=(`${u.prenom||''} ${u.nom||''}`).trim();return ids.some(x=>N(x)===s)||N(name)===s})||null};
  const normalizeAssignment=updates=>{const out={...(updates||{})};const raw=out.assigned_to??out.assignee_id??out.assigne_a??'';if(raw===''){out.assigned_to=null;out.assigne_a=null;delete out.assignee_id;return out}const u=resolveTicketUser(raw);if(u){out.assigned_to=u.auth_user_id||u.id||null;out.assigne_a=u.email||(`${u.prenom||''} ${u.nom||''}`).trim()}else if(out.assigne_a)out.assigne_a=String(out.assigne_a).trim();delete out.assignee_id;return out};
  function assignmentSelect(sel){
    if(!sel)return;
    const users=ticketUsers();if(!users.length)return;
    const oldValue=sel.value;
    const oldText=sel.selectedOptions?.[0]?.textContent||'';
    const previous=resolveTicketUser(oldValue)||resolveTicketUser(oldText)||resolveTicketUser(sel.dataset.onomoSelected||'');
    sel.innerHTML="<option value=''>— Non assigné —</option>";
    users.forEach(u=>{const id=String(u.auth_user_id||u.id||u.email);const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email;const o=document.createElement('option');o.value=id;o.textContent=name;o.dataset.onomoUser='1';if(previous&&id===String(previous.auth_user_id||previous.id||previous.email))o.selected=true;sel.appendChild(o)});
    sel.dataset.onomoSelected=sel.value;
  }
  function assignmentSelects(){document.querySelectorAll('select').forEach(sel=>{const meta=N(`${sel.id||''} ${sel.name||''} ${sel.getAttribute('aria-label')||''} ${sel.getAttribute('data-field')||''} ${sel.getAttribute('data-name')||''}`);if(/(assign|assignee|assigned|responsable|technicien|agent|assigne)/.test(meta))assignmentSelect(sel)})}
  function installAssignment(){
    const oldPopulate=window.populateAgentSelect;
    if(typeof oldPopulate==='function'&&!oldPopulate.__onomoCorrectionWrapped){
      const wrapped=function(id,selectedVal=''){const result=oldPopulate.apply(this,arguments);const el=document.getElementById(id);if(el){const u=resolveTicketUser(selectedVal);if(u)el.dataset.onomoSelected=String(u.auth_user_id||u.id||u.email);assignmentSelect(el)}return result};
      wrapped.__onomoCorrectionWrapped=true;window.populateAgentSelect=wrapped;
    }
    const oldUpdate=window.updateTicket;
    if(typeof oldUpdate==='function'&&!oldUpdate.__onomoCorrectionWrapped){
      const wrapped=async function(id,updates){return oldUpdate.call(this,id,normalizeAssignment(updates))};
      wrapped.__onomoCorrectionWrapped=true;window.updateTicket=wrapped;
    }
    const oldSb=window.sbUpdateTicket;
    if(typeof oldSb==='function'&&!oldSb.__onomoCorrectionWrapped){
      const wrapped=async function(id,updates){return oldSb.call(this,id,normalizeAssignment(updates))};
      wrapped.__onomoCorrectionWrapped=true;window.sbUpdateTicket=wrapped;
    }
    assignmentSelects();
    return typeof window.updateTicket==='function'&&typeof window.sbUpdateTicket==='function';
  }

  /* Prevent background Supabase synchronization from rebuilding the ticket
     detail page. Explicit navigation through switchView still renders. */
  function protectDetailView(){
    if(window.__onomoDetailViewGuard)return;
    const originalRender=window.renderView;
    if(typeof originalRender!=='function')return;
    let explicitRender=false;
    window.renderView=function(){
      try{
        const view=typeof currentView!=='undefined'?currentView:'';
        const ticket=typeof currentTicket!=='undefined'?currentTicket:null;
        if(String(view)==='detail'&&ticket?.id&&!explicitRender){
          if(Array.isArray(window.tickets)){
            const fresh=window.tickets.find(t=>String(t.id)===String(ticket.id));
            if(fresh)currentTicket={...ticket,...fresh};
          }
          return;
        }
      }catch(e){console.warn('[ONOMO] detail view guard:',e);}
      return originalRender.apply(this,arguments);
    };
    const originalSwitch=window.switchView;
    if(typeof originalSwitch==='function'){
      window.switchView=function(){
        explicitRender=true;
        try{return originalSwitch.apply(this,arguments)}
        finally{setTimeout(()=>{explicitRender=false},0)}
      };
    }
    window.__onomoDetailViewGuard=true;
  }

  function disableVoice(){
    document.querySelectorAll('#voiceDictationBtn,[id*=voice],[class*=voice]').forEach(el=>el.remove());
    document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').toLowerCase();if(t.includes('dicter automatiquement')||t.includes('dictée vocale'))b.remove();});
  }
  function fixLabels(){
    document.querySelectorAll('*').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType===3)n.nodeValue=n.nodeValue.replace(/principatenece/gi,'Maintenance').replace(/urgents+/gi,m=>m.startsWith('U')?'Urgent':'urgent');});});
    document.querySelectorAll('option').forEach(o=>{if(/principatenece/i.test(o.textContent))o.textContent=o.textContent.replace(/principatenece/gi,'Maintenance');});
  }
  function hideAdminReport(){
    if(!currentUser||!isAdmin(currentUser))return;
    document.querySelectorAll('[data-view="report-my"],#sbMySec').forEach(el=>el.style.display='none');
    document.querySelectorAll('.nav-item').forEach(el=>{if(/mon rapport/i.test(el.textContent||''))el.style.display='none';});
  }
  function protectNavigation(){
    if(!currentUser)return;
    const power=isPower(currentUser),admin=isAdmin(currentUser);
    document.querySelectorAll('[data-view="settings"]').forEach(el=>el.style.display=admin?'':'none');
    document.querySelectorAll('[data-view="dashboard"],[data-view="urgents"]').forEach(el=>el.style.display=power?'':'none');
    if(!power)document.querySelectorAll('[data-view="report-global"],[data-view="report-hotel"],[data-view="report-agents"],[data-view="report-anomalies"],[data-view="report-my"],[data-view="users"],[data-view="hotels-admin"]').forEach(el=>el.style.display='none');
  }
  function refresh(){disableVoice();fixLabels();hideAdminReport();protectNavigation();installAssignment();protectDetailView();}
  document.addEventListener('DOMContentLoaded',()=>{
    refresh();
    new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true});
    setTimeout(refresh,500);setTimeout(refresh,1500);setTimeout(refresh,3000);setTimeout(refresh,5000);
  });
  window.OnomoCorrections={refresh,disableVoice,fixLabels,installAssignment};
})();

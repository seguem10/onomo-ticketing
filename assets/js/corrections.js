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
  const resolveTicketUser=value=>{const s=N(value);if(!s)return null;return ticketUsers().find(u=>[u.auth_user_id,u.id,u.email,`${u.prenom||''} ${u.nom||''}`].filter(Boolean).some(x=>N(x)===s))||null};
  const userId=u=>String(u?.auth_user_id||u?.id||u?.email||'');
  const userName=u=>`${u?.prenom||''} ${u?.nom||''}`.trim()||u?.email||'';
  const defaultIT=hotel=>{const users=ticketUsers(),h=N(hotel);return users.find(u=>N(u.role)==='it hotel'&&N(u.hotel)===h)||users.find(u=>N(u.role)==='it regional')||users[0]||null};
  const findTicket=id=>{try{return (Array.isArray(window.tickets)?window.tickets:[]).find(t=>String(t.id)===String(id))||null}catch(_){return null}};
  const assignmentMeta=sel=>N(`${sel?.id||''} ${sel?.name||''} ${sel?.getAttribute?.('aria-label')||''} ${sel?.getAttribute?.('data-field')||''} ${sel?.getAttribute?.('data-name')||''}`);
  const isAssignmentSelect=sel=>sel&&/(assign|assignee|assigned|responsable|technicien|agent|assigne)/.test(assignmentMeta(sel));
  const selectedITFromSelect=sel=>{if(!sel)return null;const value=sel.value||sel.dataset.onomoSelected||'';const text=sel.selectedOptions?.[0]?.textContent||'';return resolveTicketUser(value)||resolveTicketUser(text)||resolveTicketUser(sel.dataset.onomoSelected||'')};
  const getSelectedAssignee=()=>{for(const sel of [...document.querySelectorAll('select')].filter(isAssignmentSelect)){const u=selectedITFromSelect(sel);if(u)return u}return null};
  const rememberSelection=sel=>{const u=selectedITFromSelect(sel);if(u)sel.dataset.onomoSelected=userId(u);else if(!sel.value)sel.dataset.onomoSelected=''};
  const assignmentSelect=sel=>{
    if(!sel)return;
    const users=ticketUsers();if(!users.length)return;
    const previous=selectedITFromSelect(sel);
    sel.innerHTML="<option value=''>— Non assigné —</option>";
    users.forEach(u=>{const id=userId(u),name=userName(u),o=document.createElement('option');o.value=id;o.textContent=name;o.dataset.onomoUser='1';if(previous&&id===userId(previous))o.selected=true;sel.appendChild(o)});
    if(previous){sel.value=userId(previous);sel.dataset.onomoSelected=userId(previous)}else sel.dataset.onomoSelected=sel.value||'';
    if(!sel.__onomoChangeBound){sel.addEventListener('change',()=>rememberSelection(sel));sel.__onomoChangeBound=true;}
  };
  const assignmentSelects=()=>document.querySelectorAll('select').forEach(sel=>{if(isAssignmentSelect(sel))assignmentSelect(sel)});
  const getFormAssignment=form=>{
    if(!form)return null;
    for(const sel of [...form.querySelectorAll('select')].filter(isAssignmentSelect)){const u=selectedITFromSelect(sel);if(u)return u}
    const marked=[...form.querySelectorAll('option[data-onomo-user="1"]')].find(o=>o.selected);
    return marked?resolveTicketUser(marked.value)||resolveTicketUser(marked.textContent):null;
  };
  const injectAssignmentIntoForm=(form,u)=>{
    if(!form||!u)return;
    const assignedTo=userId(u),assigneA=userName(u);
    ['assigned_to','assigne_a'].forEach(name=>{let input=form.querySelector(`input[type="hidden"][name="${name}"]`);if(!input){input=document.createElement('input');input.type='hidden';input.name=name;form.appendChild(input)}input.value=name==='assigned_to'?assignedTo:assigneA;});
  };
  const capturePendingAssignment=form=>{
    const u=getFormAssignment(form)||getSelectedAssignee();
    if(u){window.__onomoPendingAssignment={assigned_to:userId(u),assigne_a:userName(u)};injectAssignmentIntoForm(form,u);return u}
    return null;
  };
  const normalizeAssignment=(updates,id)=>{
    const out={...(updates||{})};let raw=out.assigned_to??out.assignee_id??out.assigne_a??'';
    if(!raw){const pending=window.__onomoPendingAssignment;if(pending?.assigned_to||pending?.assigne_a)raw=pending.assigned_to||pending.assigne_a}
    if(!raw){const t=findTicket(id);raw=t?.assigned_to||t?.assigne_a||'';if(!raw&&N(out.statut)==='ferme'){const d=defaultIT(t?.hotel);raw=userId(d)}}
    const u=resolveTicketUser(raw);if(u){out.assigned_to=u.auth_user_id||u.id||null;out.assigne_a=userName(u)}else if(raw)out.assigne_a=String(raw).trim();delete out.assignee_id;return out;
  };
  function installAssignment(){
    const p=window.populateAgentSelect;
    if(typeof p==='function'&&!p.__onomoCorrectionWrapped){const w=function(id,selectedVal=''){const r=p.apply(this,arguments),el=document.getElementById(id);if(el){const u=resolveTicketUser(selectedVal);if(u)el.dataset.onomoSelected=userId(u);assignmentSelect(el)}return r};w.__onomoCorrectionWrapped=true;window.populateAgentSelect=w}
    const u=window.updateTicket;if(typeof u==='function'&&!u.__onomoCorrectionWrapped){const w=async function(id,updates){return u.call(this,id,normalizeAssignment(updates,id))};w.__onomoCorrectionWrapped=true;window.updateTicket=w}
    const s=window.sbUpdateTicket;if(typeof s==='function'&&!s.__onomoCorrectionWrapped){const w=async function(id,updates){return s.call(this,id,normalizeAssignment(updates,id))};w.__onomoCorrectionWrapped=true;window.sbUpdateTicket=w}
    const c=window.createTicket;if(typeof c==='function'&&!c.__onomoCorrectionWrapped){const w=async function(data){const p={...(data||{})};const selected=getSelectedAssignee()||window.__onomoPendingAssignment;if(selected){p.assigned_to=selected.auth_user_id||selected.id||selected.email||selected.assigned_to||null;p.assigne_a=userName(selected)}else if(!p.assigned_to&&!p.assignee_id&&!p.assigne_a){const d=defaultIT(p.hotel);if(d){p.assigned_to=userId(d);p.assigne_a=userName(d)}}else Object.assign(p,normalizeAssignment(p));const result=await c.call(this,p);window.__onomoPendingAssignment=null;return result};w.__onomoCorrectionWrapped=true;window.createTicket=w}
    const sn=window.submitNewTicket;
    if(typeof sn==='function'&&!sn.__onomoAssignmentWrapped){
      const w=async function(){
        const sel=document.getElementById('ntAgent');
        let u=selectedITFromSelect(sel);
        if(!u&&sel?.dataset.onomoSelected)u=resolveTicketUser(sel.dataset.onomoSelected);
        if(!u){const hotel=document.getElementById('ntHotel')?.value||'';u=defaultIT(hotel)}
        if(u){
          const id=userId(u);
          const name=userName(u);
          if(sel){let opt=[...sel.options].find(o=>String(o.value)===id);if(!opt){opt=document.createElement('option');opt.value=id;opt.textContent=name;sel.appendChild(opt)}sel.value=id;sel.dataset.onomoSelected=id}
          window.__onomoPendingAssignment={assigned_to:id,assigne_a:name};
        }
        return sn.apply(this,arguments);
      };
      w.__onomoAssignmentWrapped=true;window.submitNewTicket=w;
    }
    assignmentSelects();return true;
  }
  function captureCreateForm(){
    document.addEventListener('change',e=>{const sel=e.target;if(isAssignmentSelect(sel)){rememberSelection(sel);const form=sel.closest('form');if(form)capturePendingAssignment(form)}},true);
    document.addEventListener('submit',e=>capturePendingAssignment(e.target),true);
    document.addEventListener('click',e=>{const btn=e.target.closest?.('button,[type="submit"]');if(!btn)return;const text=N(btn.textContent||btn.value||'');if(!/(creer|créer|enregistrer|ouvrir|submit|nouveau ticket)/.test(text))return;const form=btn.form||btn.closest('form');const u=capturePendingAssignment(form);if(u)window.__onomoPendingAssignment={assigned_to:userId(u),assigne_a:userName(u)};},true);
  }
  function protectDetailView(){if(window.__onomoDetailViewGuard)return;const original=window.renderView;if(typeof original!=='function')return;let explicit=false;window.renderView=function(){try{const view=typeof currentView!=='undefined'?currentView:'',t=typeof currentTicket!=='undefined'?currentTicket:null;if(String(view)==='detail'&&t?.id&&!explicit){const fresh=findTicket(t.id);if(fresh)currentTicket={...t,...fresh};return}}catch(e){console.warn('[ONOMO] detail view guard:',e)}return original.apply(this,arguments)};const sw=window.switchView;if(typeof sw==='function')window.switchView=function(){explicit=true;try{return sw.apply(this,arguments)}finally{setTimeout(()=>{explicit=false},0)}};window.__onomoDetailViewGuard=true}
  function loadFrontendAgent(){if(document.querySelector('script[data-onomo-frontend-agent]'))return;const s=document.createElement('script');s.src='assets/js/frontend-notifications.js?v=20260910';s.async=false;s.dataset.onomoFrontendAgent='1';s.onload=()=>console.info('[ONOMO] frontend notification agent loaded');s.onerror=e=>console.warn('[ONOMO] frontend notification agent unavailable',e);document.head.appendChild(s)}
  function disableVoice(){document.querySelectorAll('#voiceDictationBtn,[id*=voice],[class*=voice]').forEach(el=>el.remove());document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').toLowerCase();if(t.includes('dicter automatiquement')||t.includes('dictée vocale'))b.remove()})}
  function fixLabels(){document.querySelectorAll('*').forEach(el=>el.childNodes.forEach(n=>{if(n.nodeType===3)n.nodeValue=n.nodeValue.replace(/principatenece/gi,'Maintenance').replace(/urgents+/gi,m=>m.startsWith('U')?'Urgent':'urgent')}));document.querySelectorAll('option').forEach(o=>{if(/principatenece/i.test(o.textContent))o.textContent=o.textContent.replace(/principatenece/gi,'Maintenance')})}
  function hideAdminReport(){if(!currentUser||!isAdmin(currentUser))return;document.querySelectorAll('[data-view="report-my"],#sbMySec').forEach(el=>el.style.display='none');document.querySelectorAll('.nav-item').forEach(el=>{if(/mon rapport/i.test(el.textContent||''))el.style.display='none'})}
  function protectNavigation(){if(!currentUser)return;const power=isPower(currentUser),admin=isAdmin(currentUser);document.querySelectorAll('[data-view="settings"]').forEach(el=>el.style.display=admin?'':'none');document.querySelectorAll('[data-view="dashboard"],[data-view="urgents"]').forEach(el=>el.style.display=power?'':'none');if(!power)document.querySelectorAll('[data-view="report-global"],[data-view="report-hotel"],[data-view="report-agents"],[data-view="report-anomalies"],[data-view="report-my"],[data-view="users"],[data-view="hotels-admin"]').forEach(el=>el.style.display='none')}
  function refresh(){disableVoice();fixLabels();hideAdminReport();protectNavigation();installAssignment();protectDetailView();loadFrontendAgent()}
  document.addEventListener('DOMContentLoaded',()=>{captureCreateForm();refresh();new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true});setTimeout(refresh,500);setTimeout(refresh,1500);setTimeout(refresh,3000);setTimeout(refresh,5000)});
  window.OnomoCorrections={refresh,disableVoice,fixLabels,installAssignment,normalizeAssignment,defaultIT,getSelectedAssignee,capturePendingAssignment};
})();
/* ONOMO Support IT - production UI, authorization, ticket and MFA fixes */
(function(){
  'use strict';
  const N=v=>String(v??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const adminRole=r=>['admin','administrateur'].includes(N(r));
  const CATS=['IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre'];
  const PRIORITIES=['Haute','Normale','Basse','Critique'];
  const readUsers=()=>{try{const a=JSON.parse(localStorage.getItem('dh_users')||'[]');return Array.isArray(a)?a:[]}catch(_){return[]}};
  const currentIsAdmin=()=>{try{if(typeof currentUser!=='undefined'&&currentUser)return adminRole(currentUser.role)||((currentUser.roles||[]).some(adminRole));}catch(_){}return false};
  const currentAuthId=()=>{try{if(typeof currentUser!=='undefined'&&currentUser)return currentUser.auth_user_id||currentUser.id||null;}catch(_){}return null};

  function branding(){document.title='Onomo Support IT — Service Desk';const logo='assets/pwa/onomo-logo.svg';document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(e=>e.href=logo);document.querySelectorAll('img').forEach(e=>{if(/logo|brand/i.test(e.alt||e.className||''))e.src=logo});}
  function removeVoice(){document.getElementById('voiceDictationBtn')?.remove();document.getElementById('voiceStatus')?.remove();document.querySelectorAll('[data-voice],[data-action="voice"],[aria-label*="voice" i],[aria-label*="vocal" i]').forEach(e=>e.remove());}

  function fixLabels(){
    const textMap=[[/principatenece/gi,'Maintenance'],[/Normaleee/gi,'Normale'],[/uregentesse/gi,'Urgente'],[/\bUrgents\b/g,'Urgent'],[/\bSSS\b/g,'Urgent']];
    document.querySelectorAll('*').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType!==3)return;textMap.forEach(([re,to])=>{n.nodeValue=n.nodeValue.replace(re,to)});});});
    document.querySelectorAll('option').forEach(o=>{textMap.forEach(([re,to])=>{o.textContent=o.textContent.replace(re,to)});});
  }

  function normalizeCategoryOptions(){
    document.querySelectorAll('select').forEach(sel=>{
      const meta=N(`${sel.id||''} ${sel.name||''} ${sel.getAttribute('aria-label')||''} ${sel.getAttribute('data-field')||''} ${sel.getAttribute('data-name')||''}`);
      const looksCategory=/(categor|categorie|category|type)/.test(meta);
      if(!looksCategory)return;
      Array.from(sel.options).forEach(o=>{
        const t=N(o.textContent),v=N(o.value);
        const allowed=CATS.some(c=>N(c)===t||N(c)===v||N(c).replace(/\s*\/\s*/g,'/')===v);
        if(!allowed && !/(select|choisir|choose|all|tous|toutes)/.test(t))o.remove();
      });
    });
  }
  function normalizePriorityOptions(){
    document.querySelectorAll('select').forEach(sel=>{
      const meta=N(`${sel.id||''} ${sel.name||''} ${sel.getAttribute('aria-label')||''} ${sel.getAttribute('data-field')||''} ${sel.getAttribute('data-name')||''}`);
      if(!/(priorit|priority)/.test(meta))return;
      Array.from(sel.options).forEach(o=>{
        const t=N(o.textContent),v=N(o.value);
        const canonical={haute:'Haute',urgent:'Urgente',normale:'Normale',normal:'Normale',basse:'Basse',bas:'Basse',critique:'Critique'}[t]||null;
        if(canonical)o.textContent=canonical;
        else if(v==='normal')o.textContent='Normale';
      });
    });
  }

  function guardMenus(){
    const admin=currentIsAdmin();
    document.querySelectorAll('[data-view="settings"],[data-view="users"],[data-view="hotels-admin"],[data-view="administration"],#sbAdminSec').forEach(el=>{el.style.setProperty('display',admin?'':'none','important');});
    if(!admin)document.querySelectorAll('.nav-item').forEach(el=>{if(/administration|paramètres|settings|utilisateurs|roles et permissions|hôtels/i.test(el.textContent||''))el.style.setProperty('display','none','important');});
  }

  function installUsersView(){
    if(window.__onomoSafeUsersView||typeof window.renderUsers!=='function')return;
    window.renderUsers=function(){
      const mc=document.getElementById('mainContent');if(!mc)return;const users=readUsers();
      const roleLabel=r=>({admin:'Admin',administrateur:'Administrateur',direction:'Direction',directeur:'Directeur',it_regional:'IT Régional',it_hotel:'IT Hôtel',demandeur:'Demandeur'}[N(r)]||String(r||'—'));
      const ini=s=>String(s||'?').split(' ').map(x=>x[0]||'').join('').slice(0,2).toUpperCase();
      const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      mc.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap"><div><div style="font-size:15px;font-weight:700">Gestion des comptes</div><div style="font-size:11px;color:var(--tx3)">${users.length} utilisateur(s)</div></div><button class="btn btn-gold" onclick="openModalUser()">Ajouter un compte</button></div><div class="card"><div class="card-hdr"><div class="card-title"><i class="ti ti-users"></i>Comptes enregistrés</div></div>${users.length?users.map(u=>{const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email||'Utilisateur';const id=esc(u.id||u.auth_user_id||u.email);return `<div class="user-row"><div class="user-av">${ini(name)}</div><div class="user-info" style="flex:1"><div class="user-name">${esc(name)}</div><div style="font-size:10px;color:var(--tx3)">${esc(u.email)}</div></div><div style="display:flex;gap:8px;align-items:center"><span class="role-tag">${roleLabel(u.role)}</span><button class="btn btn-outline btn-sm" onclick="openEditUser('${id}')" title="Modifier"><i class="ti ti-edit"></i></button><button class="btn btn-outline btn-sm" onclick="window.__onomoDeleteUser('${id}')" title="Supprimer"><i class="ti ti-trash"></i></button></div></div>`}).join(''):'<div class="empty-state"><i class="ti ti-users"></i><p>Aucun utilisateur</p></div>'}</div>`;
    };
    window.__onomoSafeUsersView=true;
  }
  window.__onomoDeleteUser=async function(id){const users=readUsers(),u=users.find(x=>String(x.id||x.auth_user_id)===String(id));if(!u)return;if(!confirm(`Supprimer l'utilisateur ${u.email||u.nom||''} ?`))return;try{if(typeof window.deleteUser==='function'&&window.deleteUser!==window.__onomoDeleteUser){await window.deleteUser(id);return;}alert('La suppression du compte Auth nécessite l’Edge Function d’administration. Aucun compte Auth n’est supprimé par le navigateur.');}catch(e){console.error(e);alert(e.message||'Suppression impossible.')}};

  function ticketUsers(){
    return readUsers().filter(u=>u&&u.email&&['it_regional','it_hotel','it regional','it hotel'].includes(N(u.role)));
  }
  function resolveTicketUser(value){
    const s=N(value);if(!s)return null;
    return ticketUsers().find(u=>{
      const ids=[u.auth_user_id,u.id,u.email].filter(Boolean).map(String);
      const name=(`${u.prenom||''} ${u.nom||''}`).trim();
      return ids.some(x=>N(x)===s)||N(name)===s;
    })||null;
  }
  function normalizeAssignment(updates){
    const out={...(updates||{})};
    const raw=out.assigned_to??out.assignee_id??out.assigne_a??'';
    if(raw===''){out.assigned_to=null;out.assigne_a=null;delete out.assignee_id;return out;}
    const u=resolveTicketUser(raw);
    if(u){
      const authId=u.auth_user_id||u.id||null;
      const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email;
      out.assigned_to=authId;
      out.assigne_a=u.email||name;
    }else if(out.assigne_a){
      out.assigne_a=String(out.assigne_a).trim();
    }
    delete out.assignee_id;
    return out;
  }
  function rebuildAssignmentSelect(sel){
    const users=ticketUsers();if(!users.length)return;
    const current=resolveTicketUser(sel.value)||resolveTicketUser(sel.selectedOptions?.[0]?.textContent||'');
    const previous=current||resolveTicketUser(sel.dataset.onomoSelected||'');
    sel.innerHTML="<option value=''>— Non assigné —</option>";
    users.forEach(u=>{
      const id=String(u.auth_user_id||u.id||u.email);
      const name=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email;
      const o=document.createElement('option');o.value=id;o.textContent=name;o.dataset.onomoUser='1';
      if(previous && id===String(previous.auth_user_id||previous.id||previous.email))o.selected=true;
      sel.appendChild(o);
    });
    sel.dataset.onomoSelected=sel.value;
  }
  function installTicketAssignmentFix(){
    if(window.__onomoAssignmentFixInstalled)return;
    const oldPopulate=window.populateAgentSelect;
    if(typeof oldPopulate==='function'&&!oldPopulate.__onomoWrapped){
      const wrapped=function(id,selectedVal=''){
        const result=oldPopulate.apply(this,arguments);
        const el=document.getElementById(id);
        if(el){
          const u=resolveTicketUser(selectedVal);
          if(u)el.dataset.onomoSelected=String(u.auth_user_id||u.id||u.email);
          rebuildAssignmentSelect(el);
        }
        return result;
      };
      wrapped.__onomoWrapped=true;window.populateAgentSelect=wrapped;
    }
    const oldUpdate=window.updateTicket;
    if(typeof oldUpdate==='function'&&!oldUpdate.__onomoAssignmentWrapped){
      const wrapped=async function(id,updates){return oldUpdate.call(this,id,normalizeAssignment(updates));};
      wrapped.__onomoAssignmentWrapped=true;window.updateTicket=wrapped;
    }
    const oldSb=window.sbUpdateTicket;
    if(typeof oldSb==='function'&&!oldSb.__onomoAssignmentWrapped){
      const wrapped=async function(id,updates){return oldSb.call(this,id,normalizeAssignment(updates));};
      wrapped.__onomoAssignmentWrapped=true;window.sbUpdateTicket=wrapped;
    }
    window.__onomoAssignmentFixInstalled=true;
    document.querySelectorAll('select').forEach(sel=>{
      const meta=N(`${sel.id||''} ${sel.name||''} ${sel.getAttribute('aria-label')||''} ${sel.getAttribute('data-field')||''} ${sel.getAttribute('data-name')||''}`);
      if(/(assign|assignee|assigned|responsable|technicien|agent|assigne)/.test(meta))rebuildAssignmentSelect(sel);
    });
  }
  function syncTicketAssignees(){
    const users=ticketUsers();if(!users.length)return;
    document.querySelectorAll('select').forEach(sel=>{
      const meta=N(`${sel.id||''} ${sel.name||''} ${sel.getAttribute('aria-label')||''} ${sel.getAttribute('data-field')||''} ${sel.getAttribute('data-name')||''}`);
      if(!/(assign|assignee|assigned|responsable|technicien|agent|assigne)/.test(meta))return;
      Array.from(sel.options).forEach(o=>{if(o.dataset.onomoUser==='1')o.remove();});
      users.forEach(u=>{const id=String(u.auth_user_id||u.id||u.email);if(Array.from(sel.options).some(o=>String(o.value)===id))return;const o=document.createElement('option');o.value=id;o.textContent=(`${u.prenom||''} ${u.nom||''}`).trim()||u.email;o.dataset.onomoUser='1';sel.appendChild(o);});
    });
  }
  function normalizeTicketData(data){
    const out={...(data||{})};
    const users=readUsers();
    let assigned=out.assigned_to||out.assignee_id||null;
    if(!assigned&&out.assigne_a){const u=users.find(x=>String(x.auth_user_id||x.id)===String(out.assigne_a)||N(x.email)===N(out.assigne_a)||N(`${x.prenom||''} ${x.nom||''}`)===N(out.assigne_a));if(u)assigned=u.auth_user_id||u.id;}
    if(assigned){out.assigned_to=assigned;const u=users.find(x=>String(x.auth_user_id||x.id)===String(assigned));if(u)out.assigne_a=u.email||`${u.prenom||''} ${u.nom||''}`.trim();}
    const aliases={'maintenance':'Autre','it':'IT / Réseau','reseau':'IT / Réseau','réseau':'IT / Réseau','rooms':'Chambres','restaurant':'Restauration','guest relations':'Guest relations','security':'Sécurité','housekeeping':'Autre','other':'Autre'};
    const cat=String(out.categorie||out.category||'').trim();if(cat)out.categorie=CATS.includes(cat)?cat:(aliases[N(cat)]||'Autre');
    const p=N(out.priorite||out.priority||'');const pm={normal:'Normale',normale:'Normale',normalee:'Normale',urgente:'Urgente',urgent:'Urgente',uregentesse:'Urgente',bas:'Basse',basse:'Basse',haute:'Haute',critique:'Critique'};if(p)out.priorite=pm[p]||out.priorite;
    return out;
  }

  function installDirectTicketCreate(){
    if(window.__onomoDirectCreateInstalled)return;
    const s=(()=>{try{return typeof settings!=='undefined'?settings:window.settings}catch(_){return window.settings}})();
    if(!s?.sbUrl||!s?.sbKey||typeof window.fetch!=='function')return;
    const original=window.createTicket;
    if(typeof original!=='function')return;
    window.createTicket=async function(data){
      const client=window.supabase;
      if(!client||typeof client.createClient!=='function'){return original(data);}
      try{
        const sb=typeof window.OnomoAuth?.getClient==='function'?window.OnomoAuth.getClient():client.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'onomo-supabase-auth'}});
        const {data:sessionData,error:sessionError}=await sb.auth.getSession();if(sessionError||!sessionData?.session?.user)throw new Error('Session Supabase absente. Reconnectez-vous.');
        const payload=normalizeTicketData(data||{});payload.created_by=sessionData.session.user.id;
        if(!payload.titre&&payload.title)payload.titre=payload.title;if(!payload.description)payload.description='';
        const required=['titre','hotel','categorie','priorite'];const missing=required.filter(k=>!payload[k]);if(missing.length)throw new Error(`Champs ticket manquants: ${missing.join(', ')}`);
        delete payload.assignee_id;delete payload.category;delete payload.priority;
        const {data:rows,error}=await sb.from('tickets').insert(payload).select().single();
        if(error)throw new Error(`Supabase ${error.code||''}: ${error.message}`);
        try{if(Array.isArray(window.tickets)){window.tickets=[rows,...window.tickets];if(typeof saveTickets==='function')saveTickets(window.tickets);}}catch(_){}
        try{if(typeof renderView==='function')renderView();if(typeof updateCounts==='function')updateCounts();}catch(_){}
        console.info('[ONOMO] ticket created in Supabase',rows.id,rows.assigned_to||'unassigned');
        return rows;
      }catch(error){
        console.error('[ONOMO] ticket creation failed, no local fallback',error);throw error;
      }
    };
    window.__onomoDirectCreateInstalled=true;
  }

  let mfaOverlay=null,mfaFactorId=null,mfaChallengeId=null;
  function ensureMfaOverlay(){if(mfaOverlay)return mfaOverlay;mfaOverlay=document.createElement('div');mfaOverlay.id='onomoMfaOverlay';mfaOverlay.style.cssText='position:fixed;inset:0;background:rgba(20,28,46,.96);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px';mfaOverlay.innerHTML=`<div style="width:min(420px,100%);background:#fff;border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35)"><div style="font-size:20px;font-weight:700;margin-bottom:6px">Vérification MFA</div><div style="font-size:12px;color:#666;margin-bottom:18px">Saisissez le code à 6 chiffres de votre application Authenticator.</div><input id="onomoMfaCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font-size:20px;text-align:center;letter-spacing:5px"/><div id="onomoMfaErr" style="display:none;color:#b42318;font-size:12px;margin-top:8px"></div><div style="display:flex;gap:8px;margin-top:16px"><button id="onomoMfaVerify" class="btn btn-gold" style="flex:1">Vérifier</button><button id="onomoMfaLogout" class="btn btn-outline">Déconnexion</button></div></div>`;document.body.appendChild(mfaOverlay);mfaOverlay.querySelector('#onomoMfaVerify').onclick=verifyMfaCode;mfaOverlay.querySelector('#onomoMfaLogout').onclick=()=>{try{window.OnomoAuth?.getClient()?.auth.signOut({scope:'local'})}catch(_){}location.reload()};return mfaOverlay;}
  async function requireMfaAfterLogin(){
    const client=window.OnomoAuth?.getClient?.();if(!client?.auth?.mfa)return true;
    const {data,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;
    if(data?.currentLevel==='aal1'&&data?.nextLevel==='aal2'){
      const factors=await client.auth.mfa.listFactors();const factor=factors.data?.totp?.find(f=>f.status==='verified');if(!factor)return true;
      mfaFactorId=factor.id;const ch=await client.auth.mfa.challenge({factorId:mfaFactorId});if(ch.error)throw ch.error;mfaChallengeId=ch.data.id;ensureMfaOverlay().style.display='flex';setTimeout(()=>document.getElementById('onomoMfaCode')?.focus(),50);return false;
    }
    return true;
  }
  async function verifyMfaCode(){const client=window.OnomoAuth?.getClient?.();const code=document.getElementById('onomoMfaCode')?.value.trim()||'';const err=document.getElementById('onomoMfaErr');if(!/^\d{6}$/.test(code)){err.textContent='Code MFA invalide.';err.style.display='block';return;}try{const r=await client.auth.mfa.verify({factorId:mfaFactorId,challengeId:mfaChallengeId,code});if(r.error)throw r.error;await client.auth.refreshSession();mfaOverlay.style.display='none';if(typeof window.startSync==='function')window.startSync();if(typeof window.renderView==='function')window.renderView();}catch(e){err.textContent=e.message||'Code MFA incorrect.';err.style.display='block';}}
  function mfaApi(){return window.OnomoAuth?.getClient?.();}
  async function showMfaManager(){const client=mfaApi();if(!client)return alert('Supabase Auth indisponible.');const factors=await client.auth.mfa.listFactors();if(factors.error)return alert(factors.error.message);const verified=(factors.data?.totp||[]).filter(f=>f.status==='verified');if(verified.length){if(confirm('MFA TOTP est actif. Voulez-vous le désactiver sur ce compte ?')){const r=await client.auth.mfa.unenroll({factorId:verified[0].id});if(r.error)return alert(r.error.message);await client.auth.refreshSession();try{await client.from('utilisateurs').update({mfa_enabled:false}).eq('auth_user_id',currentAuthId());}catch(_){}alert('MFA désactivé.');}return;}
    const e=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Onomo Support IT'});if(e.error)return alert(e.error.message);const factor=e.data;const box=document.createElement('div');box.style.cssText='position:fixed;inset:0;z-index:9998;background:rgba(20,28,46,.96);display:flex;align-items:center;justify-content:center;padding:20px';box.innerHTML=`<div style="width:min(430px,100%);background:#fff;border-radius:14px;padding:24px;text-align:center"><h3>Activer la MFA</h3><p style="font-size:12px;color:#666">Scannez le QR code avec Google Authenticator, Microsoft Authenticator ou une autre application TOTP.</p><img style="width:220px;height:220px" src="data:image/svg+xml;utf8,${encodeURIComponent(factor.totp.qr_code)}"/><div style="font-size:11px;word-break:break-all;background:#f5f5f5;padding:8px;border-radius:6px">${factor.totp.secret}</div><input id="onomoEnrollCode" inputmode="numeric" maxlength="6" placeholder="Code à 6 chiffres" style="width:100%;margin-top:12px;padding:11px;text-align:center;font-size:18px"/><button id="onomoEnrollVerify" class="btn btn-gold" style="width:100%;margin-top:10px">Activer</button><button id="onomoEnrollCancel" class="btn btn-outline" style="width:100%;margin-top:8px">Annuler</button><div id="onomoEnrollErr" style="color:#b42318;font-size:12px;margin-top:8px"></div></div>`;document.body.appendChild(box);box.querySelector('#onomoEnrollCancel').onclick=async()=>{try{await client.auth.mfa.unenroll({factorId:factor.id})}catch(_){}box.remove()};box.querySelector('#onomoEnrollVerify').onclick=async()=>{const code=box.querySelector('#onomoEnrollCode').value.trim();const ch=await client.auth.mfa.challenge({factorId:factor.id});if(ch.error){box.querySelector('#onomoEnrollErr').textContent=ch.error.message;return;}const v=await client.auth.mfa.verify({factorId:factor.id,challengeId:ch.data.id,code});if(v.error){box.querySelector('#onomoEnrollErr').textContent=v.error.message;return;}await client.auth.refreshSession();try{await client.from('utilisateurs').update({mfa_enabled:true}).eq('auth_user_id',currentAuthId())}catch(_){}box.remove();alert('MFA activée. À la prochaine connexion, le code TOTP sera obligatoire.');};
  }
  function injectMfaButton(){if(document.getElementById('onomoMfaBtn')||!currentUser)return;const host=document.querySelector('.sb-foot')||document.querySelector('.sidebar');if(!host)return;const b=document.createElement('button');b.id='onomoMfaBtn';b.className='logout-btn';b.innerHTML='<i class="ti ti-shield-lock"></i> Sécurité MFA';b.onclick=showMfaManager;host.appendChild(b);}

  function installLoginMfa(){if(window.__onomoMfaLoginWrapped||typeof window.doLogin!=='function')return;const original=window.doLogin;window.doLogin=async function(){const result=await original.apply(this,arguments);if(result===false)return result;try{const ok=await requireMfaAfterLogin();return ok?result:false}catch(e){console.error('[ONOMO] MFA check failed',e);return false;}};window.__onomoMfaLoginWrapped=true;}
  function guard(){branding();removeVoice();fixLabels();normalizeCategoryOptions();normalizePriorityOptions();guardMenus();installUsersView();installTicketAssignmentFix();syncTicketAssignees();installDirectTicketCreate();installLoginMfa();injectMfaButton();}
  function init(){guard();[300,1000,2500,5000].forEach(ms=>setTimeout(guard,ms));setInterval(()=>{normalizeCategoryOptions();normalizePriorityOptions();guardMenus();installTicketAssignmentFix();syncTicketAssignees();injectMfaButton();},2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

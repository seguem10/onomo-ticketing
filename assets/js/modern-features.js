/* Extensions Onomo Support IT : rôles, accès restreint et dictée multilingue. */
(function(){
  const POWER=['Administrateur','IT Regional','IT Hotel','Directeur'];
  const DEFAULT=[...POWER,'Demandeur'];
  const roleStore='onomo_roles_v1';
  const roles=()=>JSON.parse(localStorage.getItem(roleStore)||JSON.stringify(DEFAULT.map(name=>({name,permissions:POWER.includes(name)?['*']:['ticket:create','ticket:read:own','comment:read:own']}))));
  const saveRoles=list=>localStorage.setItem(roleStore,JSON.stringify(list));
  const userRoles=user=>{const aliases={admin:'Administrateur',it_regional:'IT Regional',it_hotel:'IT Hotel',direction:'Directeur',demandeur:'Demandeur',requester:'Demandeur'};const assigned=user?.roles?.length?user.roles:[user?.role||'Demandeur'];return assigned.map(role=>aliases[role]||role);};
  const isPower=user=>userRoles(user).some(role=>POWER.includes(role));
  const permissions=user=>userRoles(user).flatMap(name=>roles().find(role=>role.name===name)?.permissions||[]);
  const can=(user,permission)=>isPower(user)||permissions(user).includes('*')||permissions(user).includes(permission);
  const owner=t=>t.created_by===currentUser?.id||t.created_by_email===currentUser?.email;
  function applyAccess(){
    const full=isPower(currentUser), admin=userRoles(currentUser).includes('Administrateur');
    document.querySelectorAll('[data-view="dashboard"],[data-view="urgents"],#sbReportSec,#sbMySec').forEach(el=>el.style.display=full?'':'none');
    document.querySelectorAll('#sbAdminSec').forEach(el=>el.style.display=admin?'':'none');
    document.querySelectorAll('[data-view="settings"]').forEach(el=>el.style.display=admin?'':'none');
    document.querySelectorAll('[data-view="tickets"]').forEach(el=>{const span=el.querySelector('span:not(.nav-badge)');if(span)span.textContent=full?'Tous les tickets':'Mes tickets';});
    const newBtn=document.querySelector('.btn-gold[onclick="openNewTicket()"]');if(newBtn)newBtn.style.display=(can(currentUser,'ticket:create')&&!(window.isReadOnly&&window.isReadOnly(currentUser)))?'':'none';
  }
  function ensureRequesterRoleOption(){
    const select=document.getElementById('uRole');
    if(!select)return;
    if(!Array.from(select.options).some(o=>o.value==='demandeur')){
      const option=document.createElement('option');option.value='demandeur';option.textContent='Demandeur';select.appendChild(option);
    }
    window.ROLE_L=window.ROLE_L||{};window.ROLE_L.demandeur='Demandeur';
    window.ROLE_DESC=window.ROLE_DESC||{};window.ROLE_DESC.demandeur='Crée et consulte ses propres tickets';
  }
  function ensureRequesterHotelField(){
    ensureRequesterRoleOption();
    const select=document.getElementById('uRole');
    const wrap=document.getElementById('uHotelWrap');
    const single=document.getElementById('uHotelSingle');
    const label=single?.querySelector('.field-lbl');
    if(label && !label.dataset.requesterLabel) {
      label.dataset.requesterLabel='1';
      label.innerHTML='Hôtel assigné <span style="color:var(--tx3);font-weight:400">(Demandeur)</span>';
    }
    if(select?.value==='demandeur'){
      if(wrap)wrap.style.display='block';
      if(single)single.style.display='block';
      document.getElementById('uHotelMulti')?.style.setProperty('display','none');
      const uh=document.getElementById('uHotel');
      if(uh && !uh.options.length) populateSelects();
    }
  }
  const originalInit=window.initSession;window.initSession=function(){originalInit();applyAccess();if(!isPower(currentUser))switchView('tickets',document.querySelector('[data-view="tickets"]'));};
  const loginGuard={key:'onomo_login_guard',maxAttempts:5,lockMinutes:15,read(){try{return JSON.parse(localStorage.getItem(this.key)||'{}')}catch(_){return{}}},write(value){localStorage.setItem(this.key,JSON.stringify(value))},locked(email){const entry=this.read()[email];return entry?.until&&Date.now()<entry.until},failure(email){const all=this.read(),entry=all[email]||{count:0};entry.count++;if(entry.count>=this.maxAttempts){entry.until=Date.now()+this.lockMinutes*60000;entry.count=0;}all[email]=entry;this.write(all);return entry.until},success(email){const all=this.read();delete all[email];this.write(all)}};
  const originalLogin=window.doLogin;window.doLogin=async function(){const email=document.getElementById('loginEmail')?.value.trim().toLowerCase();if(loginGuard.locked(email)){const err=document.getElementById('loginErr');document.getElementById('loginErrMsg').textContent=window.OnomoI18n?.t('login_locked')||'Trop de tentatives. Réessayez dans quelques minutes.';err?.classList.add('show');return;}await originalLogin();const failed=document.getElementById('loginErr')?.classList.contains('show');if(failed)loginGuard.failure(email);else if(currentUser){loginGuard.success(email);sessionStorage.setItem('onomo_session_started',String(Date.now()));}};
  const originalLogout=window.doLogout;window.doLogout=function(){sessionStorage.removeItem('onomo_session_started');return originalLogout();};
  // The authoritative 15-minute, user-activity-based timeout lives in
  // runtime-sync.js. Do not retain the legacy fixed eight-hour timer here.
  window.addEventListener('DOMContentLoaded',()=>{ensureRequesterRoleOption();});
  const originalSwitch=window.switchView;window.switchView=function(view,el){const restricted=['dashboard','urgents','report-global','report-hotel','report-agents','report-anomalies','report-my'];const adminOnly=['users','hotels-admin','settings'];if((!isPower(currentUser)&&restricted.includes(view))||(!userRoles(currentUser).includes('Administrateur')&&adminOnly.includes(view))){showToast('Accès non autorisé.','err');return;}return originalSwitch(view,el);};
  const originalSettings=window.renderSettings;window.renderSettings=function(){if(!userRoles(currentUser).includes('Administrateur')){showToast(window.OnomoI18n?.t('access_denied')||'Accès non autorisé.','err');switchView('tickets',document.querySelector('[data-view="tickets"]'));return;}return originalSettings();};
  window.visibleTickets=function(){return isPower(currentUser)?tickets:tickets.filter(owner);};
  const originalCreate=window.createTicket;window.createTicket=async function(data){return originalCreate({...data,created_by:currentUser?.id||null,created_by_email:currentUser?.email||null});};
  const originalUserHotels=window.userHotels;window.userHotels=function(u){u=u||currentUser;if(u?.role==='demandeur'||u?.role==='requester')return u.hotel?[u.hotel]:[];return originalUserHotels?originalUserHotels(u):[];};
  const originalPopulateSelects=window.populateSelects;window.populateSelects=function(){originalPopulateSelects();if(currentUser?.role==='demandeur'||currentUser?.role==='requester'){const hs=document.getElementById('ntHotel');if(hs){hs.innerHTML='';const o=document.createElement('option');o.value=currentUser.hotel||'';o.textContent=currentUser.hotel||'— Hôtel non assigné —';hs.appendChild(o);}}ensureRequesterHotelField();};
  window.renderRoleManager=function(){if(!userRoles(currentUser).includes('Administrateur'))return;const list=roles();document.getElementById('mainContent').innerHTML=`<div class="card"><div class="card-hdr"><div class="card-title">Rôles et permissions</div><button class="btn btn-gold" onclick="addCustomRole()"><i class="ti ti-plus"></i>Nouveau rôle</button></div><div class="user-list">${list.map((role,index)=>`<div class="user-row"><div class="user-info"><div class="user-name">${esc(role.name)}</div><div class="user-email">${esc(role.permissions.join(', ')||'Aucune permission')}</div></div>${role.is_system?'<span class="role-tag">Système</span>':`<button class="btn btn-danger btn-sm" onclick="removeCustomRole(${index})"><i class="ti ti-trash"></i></button>`}</div>`).join('')}</div></div>`;};
  window.addCustomRole=function(){const name=prompt('Nom du rôle :');if(!name)return;const permissionList=prompt('Permissions séparées par des virgules (ex. ticket:create,ticket:read:own) :','ticket:create,ticket:read:own,comment:read:own');if(permissionList===null)return;const list=roles();if(list.some(item=>item.name.toLowerCase()===name.trim().toLowerCase()))return showToast('Ce rôle existe déjà.','err');list.push({name:name.trim(),permissions:permissionList.split(',').map(item=>item.trim()).filter(Boolean)});saveRoles(list);renderRoleManager();};
  window.removeCustomRole=function(index){const list=roles();if(POWER.includes(list[index]?.name)||list[index]?.name==='Demandeur')return showToast('Les rôles système ne peuvent pas être supprimés.','err');list.splice(index,1);saveRoles(list);renderRoleManager();};
  function addRoleNav(){const admin=document.getElementById('sbAdminSec');if(!admin||document.querySelector('[data-view="roles"]'))return;admin.insertAdjacentHTML('beforeend','<div class="nav-item" data-view="roles" onclick="renderRoleManager();document.querySelectorAll(\'.nav-item\').forEach(i=>i.classList.remove(\'active\'));this.classList.add(\'active\')"><i class="ti ti-key"></i><span>Rôles et permissions</span></div>');}
  function addUserRolePicker(){ensureRequesterRoleOption();const select=document.getElementById('uRole');if(!select||document.getElementById('uRolesMulti'))return;select.closest('.form-g').insertAdjacentHTML('afterend',`<div class="form-g" id="uRolesMulti"><label class="field-lbl">Rôles additionnels</label><div id="uRoleChoices" style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;padding:9px;border:1px solid var(--border);border-radius:var(--r)">${roles().map(role=>`<label style="font-size:11px"><input type="checkbox" value="${esc(role.name)}"> ${esc(role.name)}</label>`).join('')}</div></div>`);}
  const originalOpenUser=window.openModalUser;window.openModalUser=function(){originalOpenUser();addUserRolePicker();ensureRequesterHotelField();document.querySelectorAll('#uRoleChoices input').forEach(input=>input.checked=input.value===document.getElementById('uRole').value);};
  const originalEditUser=window.openEditUser;window.openEditUser=function(id){originalEditUser(id);addUserRolePicker();ensureRequesterHotelField();const user=DEMO_USERS.find(item=>item.id===id);const assigned=userRoles(user);document.querySelectorAll('#uRoleChoices input').forEach(input=>input.checked=assigned.includes(input.value));};
  const originalSubmitUser=window.submitUser;window.submitUser=async function(){
    ensureRequesterHotelField();
    const role=document.getElementById('uRole')?.value;
    if(role==='demandeur'||role==='requester'){
      const hotel=document.getElementById('uHotel')?.value||'';
      if(!hotel){showToast('Sélectionnez un hôtel pour le Demandeur','err');return;}
      const editId=document.getElementById('uEditId')?.value||'';
      if(!editId){
        const prenom=document.getElementById('uPrenom')?.value.trim()||'';
        const nom=document.getElementById('uNom')?.value.trim()||'';
        const email=document.getElementById('uEmail')?.value.trim().toLowerCase()||'';
        const pwdRaw=document.getElementById('uPwd')?.value||'';
        if(!email){showToast("L'email est requis",'err');return;}
        if(!pwdRaw.trim()){showToast('Le mot de passe temporaire est requis','err');return;}
        if(DEMO_USERS.find(u=>u.email===email)){showToast('Email déjà utilisé','err');return;}
        if(sbOK()){try{const existing=await sbFetch(`utilisateurs?email=eq.${encodeURIComponent(email)}&limit=1`);if(existing&&existing.length>0){showToast('Email déjà utilisé (Supabase)','err');return;}}catch(e){}}
        const newUser={id:uid(),email,pwd:hashPwd(pwdRaw),prenom,nom,role:'demandeur',hotel,hotels:[],createdAt:new Date().toISOString(),mustChangePassword:true,mfaEnabled:false,mfaSecret:null};
        DEMO_USERS.push(newUser);saveUsers(DEMO_USERS);
        if(sbOK()){const ok=await sbSaveUser(newUser);if(!ok)showToast('Compte créé localement — erreur Supabase','err');}
        populateSelects();closeModal('modalUser');showToast(`Compte créé pour ${prenom} ${nom}`.trim(),'ok');addNotif(`Nouveau compte : ${prenom} ${nom} (Demandeur)`,'user-plus','var(--green)');showEmailNotification(prenom,nom,email,'demandeur',pwdRaw);renderUsers();return;
      }
    }
    const assigned=Array.from(document.querySelectorAll('#uRoleChoices input:checked')).map(input=>input.value);await originalSubmitUser();const email=document.getElementById('uEmail')?.value.trim().toLowerCase();const user=DEMO_USERS.find(item=>item.email===email);if(user&&assigned.length){user.roles=assigned;user.role=assigned[0];saveUsers(DEMO_USERS);if(sbOK())await sbUpdateUser(user.id,{roles:assigned,role:user.role});}
  };
  const originalRoleChange=window.onRoleChange;window.onRoleChange=function(v){if(originalRoleChange)originalRoleChange(v);if(v==='demandeur'||v==='requester'){const wrap=document.getElementById('uHotelWrap');const single=document.getElementById('uHotelSingle');const multi=document.getElementById('uHotelMulti');if(wrap)wrap.style.display='block';if(single)single.style.display='block';if(multi)multi.style.display='none';const label=single?.querySelector('.field-lbl');if(label)label.innerHTML='Hôtel assigné <span style="color:var(--tx3);font-weight:400">(Demandeur)</span>';const uh=document.getElementById('uHotel');if(uh&&!uh.options.length){const hotels=HOTELS||[];uh.innerHTML="<option value=''>— Sélectionner un hôtel —</option>";hotels.forEach(h=>{const o=document.createElement('option');o.value=h.nom;o.textContent=h.nom;uh.appendChild(o);});}}};
  function addVoice(){const description=document.getElementById('ntDesc');if(!description||document.getElementById('voiceDictationBtn'))return;description.insertAdjacentHTML('afterend','<button type="button" class="btn btn-outline btn-sm" id="voiceDictationBtn" style="margin-top:8px"><i class="ti ti-microphone"></i>Dicter automatiquement</button><small id="voiceStatus" style="display:block;margin-top:5px;color:var(--tx3)"></small>');const button=document.getElementById('voiceDictationBtn'),status=document.getElementById('voiceStatus');const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){button.disabled=true;status.textContent='La dictée vocale n’est pas disponible dans ce navigateur.';return;}let recognition,active=false,index=0;const languages=['fr-FR','en-US','ar-MA','es-ES'];function start(){recognition=new Speech();recognition.continuous=true;recognition.interimResults=true;recognition.lang=languages[index];recognition.onresult=event=>{let text='';for(let i=event.resultIndex;i<event.results.length;i++)text+=event.results[i][0].transcript;if(text)description.value=(description.value+' '+text).trim();};recognition.onerror=event=>{if(['no-speech','language-not-supported'].includes(event.error)&&active){index=(index+1)%languages.length;setTimeout(start,150);return;}status.textContent=`Dictée interrompue : ${event.error}`;active=false;button.innerHTML='<i class="ti ti-microphone"></i>Dicter automatiquement';};recognition.onend=()=>{if(active){index=(index+1)%languages.length;setTimeout(start,150);}};recognition.start();status.textContent='Écoute active — détection automatique en cours.';}button.addEventListener('click',()=>{active=!active;if(active){button.innerHTML='<i class="ti ti-player-stop"></i>Arrêter la dictée';start();}else{recognition?.stop();button.innerHTML='<i class="ti ti-microphone"></i>Dicter automatiquement';status.textContent='Dictée arrêtée.';}});}
  function rebrand(root=document.body){root.querySelectorAll('*').forEach(element=>element.childNodes.forEach(node=>{if(node.nodeType===Node.TEXT_NODE)node.nodeValue=node.nodeValue.replace(/Support hôtelière|Support hôtelier|Support Hotelier|Support Desk · Hôtellerie/gi,'Support IT');}));}
  document.addEventListener('DOMContentLoaded',()=>{ensureRequesterRoleOption();addRoleNav();addUserRolePicker();addVoice();rebrand();new MutationObserver(()=>rebrand()).observe(document.body,{childList:true,subtree:true});const manifest=document.getElementById('pwa-manifest');if(manifest)manifest.href='assets/pwa/manifest.webmanifest';document.title='Onomo Support IT';document.querySelectorAll('.sb-logo-sub').forEach(el=>el.textContent='Support IT');const installed=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone||localStorage.getItem('onomo_pwa_installed')==='1';if(installed){localStorage.setItem('onomo_pwa_installed','1');localStorage.setItem('pwa_installed','1');document.querySelector('.pwa-install-bar')?.classList.remove('show');}if('serviceWorker'in navigator)navigator.serviceWorker.register('onomo-sw.js').catch(()=>{});window.addEventListener('appinstalled',()=>{localStorage.setItem('onomo_pwa_installed','1');localStorage.setItem('pwa_installed','1');document.querySelector('.pwa-install-bar')?.classList.remove('show');});});
})();

/* Runtime reliability: Supabase Auth first, persistent session, authenticated REST and ticket synchronization. */
(function(){
  'use strict';
  const SESSION_KEY='onomo_active_session_v1', ACTIVITY_KEY='onomo_last_activity_v1', INACTIVITY=15*60*1000;
  let syncTimer=null, channel=null, realtimeChannel=null, realtimeClient=null, authClient=null, authSubscription=null, loading=false, restoring=false;
  const cfg=()=>{try{return typeof settings!=='undefined'?settings:window.settings;}catch(_){return window.settings;}};

  function getAuthClient(){
    if(authClient)return authClient;
    const s=cfg();
    if(!window.supabase||!s?.sbUrl||!s?.sbKey)return null;
    try{
      authClient=window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'onomo-supabase-auth'}});
      authSubscription=authClient.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT'){
          if(currentUser)return;
          clearSession();
          return;
        }
        if(session?.user&&(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED')){
          setTimeout(()=>restoreSupabaseProfile(session),0);
        }
      });
      return authClient;
    }catch(error){console.warn('Supabase Auth indisponible',error);return null;}
  }
  async function getAuthSession(){
    const client=getAuthClient();if(!client)return null;
    try{const {data,error}=await client.auth.getSession();if(error)throw error;return data?.session||null;}
    catch(error){console.warn('Lecture session Supabase impossible',error);return null;}
  }
  function installAuthenticatedSbFetch(){
    if(typeof window.sbFetch!=='function')return;
    window.sbFetch=async function(path,opts={}){
      const s=cfg();if(!s?.sbUrl||!s?.sbKey)throw new Error('Supabase non configuré');
      const session=await getAuthSession();
      const headers={'Content-Type':'application/json','Prefer':opts.prefer||'return=representation','apikey':s.sbKey};
      if(session?.access_token)headers.Authorization=`Bearer ${session.access_token}`;
      else headers.Authorization=`Bearer ${s.sbKey}`;
      const response=await fetch(`${s.sbUrl}/rest/v1/${path}`,{...opts,headers});
      if(!response.ok){const text=await response.text();throw new Error(`Supabase ${response.status}: ${text.slice(0,300)}`);}
      const text=await response.text();return text?JSON.parse(text):[];
    };
  }
  const writeSession=()=>{try{if(currentUser)localStorage.setItem(SESSION_KEY,JSON.stringify({id:currentUser.id,email:currentUser.email,user:currentUser,at:Date.now()}));}catch(_) {}};
  const clearSession=()=>{try{localStorage.removeItem(SESSION_KEY);localStorage.removeItem(ACTIVITY_KEY);}catch(_) {}};
  const touch=()=>{try{if(currentUser)localStorage.setItem(ACTIVITY_KEY,String(Date.now()));}catch(_) {}};
  function refreshBadge(){if(!currentUser)return;try{const all=visibleTickets();const badge=document.getElementById('sbOpen');if(badge)badge.textContent=all.length;}catch(_) {}}
  function refreshView(){if(!currentUser)return;try{updateCounts();refreshBadge();if(['dashboard','tickets','urgents','my-tickets','detail'].includes(currentView))renderView();}catch(error){console.warn('Rafraîchissement vue impossible',error);}}
  async function syncTickets(){
    if(loading||!currentUser||!sbOK())return;loading=true;
    try{
      const records=await sbLoadTickets();
      if(Array.isArray(records)){tickets=records;saveTickets(tickets);refreshView();}
    }catch(error){console.warn('Ticket sync unavailable',error);}finally{loading=false;}
  }
  function startRealtime(){
    if(realtimeChannel||!window.supabase||!sbOK())return;
    try{
      const s=cfg();realtimeClient=getAuthClient()||window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:true,autoRefreshToken:true,storageKey:'onomo-supabase-auth'}});
      realtimeChannel=realtimeClient.channel('onomo-ticket-events')
        .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},()=>syncTickets())
        .on('postgres_changes',{event:'*',schema:'public',table:'commentaires'},()=>syncTickets())
        .subscribe(status=>{if(status==='SUBSCRIBED')console.log('Supabase Realtime connecté');if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Supabase Realtime indisponible, polling actif');});
    }catch(error){console.warn('Supabase Realtime indisponible',error);}
  }
  function startSync(){installAuthenticatedSbFetch();if(syncTimer)clearInterval(syncTimer);syncTickets();startRealtime();syncTimer=setInterval(syncTickets,10000);}

  async function restoreSupabaseProfile(session){
    if(!session?.user||restoring)return false;
    restoring=true;
    try{
      installAuthenticatedSbFetch();
      const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
      if(rows?.[0]){
        currentUser=dbRowToUser(rows[0]);
        currentUser.auth_user_id=session.user.id;
        initSession();
        writeSession();
        touch();
        startSync();
        return true;
      }
      console.warn('Session Auth valide mais aucun profil utilisateurs lié à auth_user_id');
      return false;
    }catch(error){
      console.warn('Profil Supabase non disponible',error);
      return false;
    }finally{restoring=false;}
  }

  async function restoreSession(){
    if(currentUser)return;
    const session=await getAuthSession();
    if(session?.user){
      const restored=await restoreSupabaseProfile(session);
      if(restored)return;
    }
    let saved=null;
    try{saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch(_){}
    if(saved?.user?.email===saved.email){
      try{currentUser={...saved.user};initSession();touch();startSync();return;}catch(error){console.warn('Restauration locale impossible',error);}
    }
    try{
      if(saved&&Array.isArray(DEMO_USERS)){
        const user=DEMO_USERS.find(item=>item.id===saved.id&&item.email===saved.email);
        if(user){currentUser={...user};initSession();touch();startSync();}
      }
    }catch(error){console.warn('Restauration locale impossible',error);}
  }

  const previousLogin=window.doLogin;
  if(typeof previousLogin==='function'){
    window.doLogin=async function(){
      const email=document.getElementById('loginEmail')?.value.trim().toLowerCase(),pwd=document.getElementById('loginPwd')?.value||'';
      const client=getAuthClient();
      if(client&&email&&pwd){
        try{
          const {data,error}=await client.auth.signInWithPassword({email,password:pwd});
          if(error)throw error;
          if(data?.session?.user){
            installAuthenticatedSbFetch();
            const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(data.session.user.id)}&limit=1`);
            if(rows?.[0]){
              currentUser=dbRowToUser(rows[0]);
              currentUser.auth_user_id=data.session.user.id;
              initSession();
              writeSession();
              touch();
              return true;
            }
            throw new Error('Aucun profil utilisateurs lié à ce compte Supabase.');
          }
        }catch(error){
          console.warn('Supabase Auth login échoué:',error.message||error);
          const err=document.getElementById('loginErr'),msg=document.getElementById('loginErrMsg');
          if(err&&msg){msg.textContent=error.message||'Connexion Supabase impossible.';err.classList.add('show');}
          return false;
        }
      }
      installAuthenticatedSbFetch();
      const result=await previousLogin();
      if(currentUser){writeSession();touch();startSync();}
      return result;
    };
  }

  const previousInit=window.initSession;
  if(typeof previousInit==='function')window.initSession=function(){previousInit();writeSession();touch();startSync();hideMobileNavigationBeforeLogin();};
  const previousLogout=window.doLogout;
  if(typeof previousLogout==='function')window.doLogout=async function(){clearSession();if(syncTimer)clearInterval(syncTimer);if(realtimeChannel){try{await realtimeClient?.removeChannel(realtimeChannel);}catch(_){}realtimeChannel=null;}try{await getAuthClient()?.auth.signOut();}catch(error){console.warn('Supabase Auth logout impossible',error);}return previousLogout();};
  const previousUpdate=window.updateTicket;
  if(typeof previousUpdate==='function')window.updateTicket=async function(id,updates){installAuthenticatedSbFetch();const result=await previousUpdate(id,updates);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousCreate=window.createTicket;
  if(typeof previousCreate==='function')window.createTicket=async function(data){installAuthenticatedSbFetch();const session=await getAuthSession();const payload={...data};if(session?.user)payload.created_by=session.user.id;const result=await previousCreate(payload);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousComment=window.addComment;
  if(typeof previousComment==='function')window.addComment=async function(message){installAuthenticatedSbFetch();const result=await previousComment(message);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousSwitch=window.switchView;
  if(typeof previousSwitch==='function')window.switchView=function(view,element){touch();return previousSwitch(view,element);};

  async function createAuthUser(payload){
    const client=getAuthClient();if(!client)throw new Error('Supabase Auth indisponible');
    const {data,error}=await client.functions.invoke('admin-create-user',{body:payload});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }
  window.OnomoAuth={createUser:createAuthUser,getClient:getAuthClient,getSession:getAuthSession,restore:restoreSession};

  function hideMobileNavigationBeforeLogin(){
    try{
      const signedIn=!!window.currentUser;
      const el=document.getElementById('mobileBottomNav');
      if(el)el.style.display=signedIn&&window.innerWidth<=768?'block':'none';
      document.querySelectorAll('#fabBtn,#menuToggleBtn').forEach(node=>{if(!signedIn)node.style.display='none';});
    }catch(_){}
  }
  function hideInstallBannerIfInstalled(){
    try{
      const installed=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true||localStorage.getItem('onomo_pwa_installed')==='1'||localStorage.getItem('pwa_installed')==='1';
      if(!installed)return;
      const bar=document.getElementById('pwaInstallBar');if(bar)bar.classList.remove('show');
    }catch(_){}
  }
  function initMobileAndPwaUi(){
    hideMobileNavigationBeforeLogin();hideInstallBannerIfInstalled();
    window.addEventListener('appinstalled',()=>{try{localStorage.setItem('onomo_pwa_installed','1');localStorage.setItem('pwa_installed','1');}catch(_){}hideInstallBannerIfInstalled();});
    setTimeout(hideMobileNavigationBeforeLogin,300);setTimeout(hideMobileNavigationBeforeLogin,1200);setTimeout(hideInstallBannerIfInstalled,500);setTimeout(hideInstallBannerIfInstalled,1500);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    try{['click','pointermove','keydown','input','submit','touchstart'].forEach(type=>document.addEventListener(type,touch,{passive:type==='pointermove'||type==='touchstart'}));}catch(_){}
    try{channel=new BroadcastChannel('onomo-ticket-sync');channel.onmessage=event=>{if(event.data?.type==='tickets-updated')syncTickets();};}catch(_){}
    try{initMobileAndPwaUi();}catch(error){console.warn('UI mobile/PWA init failed',error);}
    try{restoreSession();}catch(error){console.warn('Session restore failed',error);}
    setInterval(()=>{try{const last=Number(localStorage.getItem(ACTIVITY_KEY)||0);if(currentUser&&last&&Date.now()-last>=INACTIVITY){clearSession();showToast('Votre session a expiré pour cause d’inactivité.','err');doLogout();}}catch(_){}},15000);
  });
  window.OnomoRuntime={syncTickets,touch,refreshBadge,getAuthSession,installAuthenticatedSbFetch,hideMobileNavigationBeforeLogin,hideInstallBannerIfInstalled,restoreSession};
})();

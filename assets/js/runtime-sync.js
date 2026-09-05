/* Runtime reliability: Supabase Auth bridge, authenticated REST, session restoration and synchronized ticket data. */
(function(){
  const SESSION_KEY='onomo_active_session_v1', ACTIVITY_KEY='onomo_last_activity_v1', INACTIVITY=15*60*1000;
  let syncTimer=null, channel=null, realtimeChannel=null, realtimeClient=null, authClient=null, loading=false;
  const cfg=()=>{try{return typeof settings!=='undefined'?settings:window.settings;}catch(_){return window.settings;}};

  function getAuthClient(){
    if(authClient)return authClient;
    const s=cfg();
    if(!window.supabase||!s?.sbUrl||!s?.sbKey)return null;
    try{authClient=window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return authClient;}
    catch(error){console.warn('Supabase Auth indisponible',error);return null;}
  }

  async function getAuthSession(){
    const client=getAuthClient();if(!client)return null;
    try{const {data,error}=await client.auth.getSession();if(error)throw error;return data?.session||null;}
    catch(error){console.warn('Lecture session Supabase impossible',error);return null;}
  }

  /* The legacy REST helper used the publishable key as Bearer token. That
     authenticates the API key but not the logged-in user, so RLS saw anon.
     This replacement sends the Supabase Auth access token. */
  function installAuthenticatedSbFetch(){
    if(window.__onomoAuthenticatedSbFetchInstalled||typeof window.sbFetch!=='function')return;
    window.__onomoAuthenticatedSbFetchInstalled=true;
    window.sbFetch=async function(path,opts={}){
      const s=cfg();if(!s?.sbUrl||!s?.sbKey)throw new Error('Supabase non configuré');
      const session=await getAuthSession();
      const headers={'Content-Type':'application/json','Prefer':opts.prefer||'return=representation','apikey':s.sbKey,'Authorization':`Bearer ${session?.access_token||s.sbKey}`};
      const response=await fetch(`${s.sbUrl}/rest/v1/${path}`,{...opts,headers});
      if(!response.ok){const text=await response.text();throw new Error(`Supabase ${response.status}: ${text.slice(0,300)}`);}
      const text=await response.text();return text?JSON.parse(text):[];
    };
  }

  const writeSession=()=>currentUser&&localStorage.setItem(SESSION_KEY,JSON.stringify({id:currentUser.id,email:currentUser.email,at:Date.now()}));
  const clearSession=()=>{localStorage.removeItem(SESSION_KEY);localStorage.removeItem(ACTIVITY_KEY);};
  const touch=()=>{if(currentUser)localStorage.setItem(ACTIVITY_KEY,String(Date.now()));};
  function refreshBadge(){if(!currentUser)return;const all=visibleTickets();const badge=document.getElementById('sbOpen');if(badge)badge.textContent=all.length;}
  function refreshView(){if(!currentUser)return;updateCounts();refreshBadge();if(['dashboard','tickets','urgents','my-tickets','detail'].includes(currentView))renderView();}

  async function syncTickets(){
    if(loading||!currentUser||!sbOK())return;loading=true;
    try{
      const previous=new Map((tickets||[]).map(ticket=>[String(ticket.id),ticket]));
      const records=await sbLoadTickets();
      if(Array.isArray(records)){
        tickets=records;saveTickets(tickets);
        records.forEach(ticket=>{
          const before=previous.get(String(ticket.id));const mine=ticket.assigne_a===`${currentUser.prenom} ${currentUser.nom}`.trim();
          if(before&&mine&&before.assigne_a!==ticket.assigne_a)window.addNotif?.(`Ticket ${ticket.numero} assigné à votre équipe.`,'ticket','var(--brand)');
          if(before&&mine&&before.statut!==ticket.statut&&ticket.statut==='fermé')window.addNotif?.(`Le ticket ${ticket.numero} a été fermé.`,'circle-check','var(--green)');
        });refreshView();
      }
    }catch(error){console.warn('Ticket sync unavailable',error);}finally{loading=false;}
  }

  function startRealtime(){
    if(realtimeChannel||!window.supabase||!sbOK())return;
    try{
      const s=cfg();realtimeClient=getAuthClient()||window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:true,autoRefreshToken:true}});
      realtimeChannel=realtimeClient.channel('onomo-ticket-events')
        .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},()=>syncTickets())
        .on('postgres_changes',{event:'*',schema:'public',table:'commentaires'},()=>syncTickets())
        .subscribe(status=>{if(status==='SUBSCRIBED')console.log('Supabase Realtime connecté');if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Supabase Realtime indisponible, polling actif');});
    }catch(error){console.warn('Supabase Realtime indisponible : recours à la synchronisation périodique.',error);}
  }
  function startSync(){installAuthenticatedSbFetch();if(syncTimer)clearInterval(syncTimer);syncTickets();startRealtime();syncTimer=setInterval(syncTickets,10000);}

  async function restoreSession(){
    try{
      installAuthenticatedSbFetch();const session=await getAuthSession();
      if(session?.user){
        const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${session.user.id}&limit=1`);
        if(rows?.[0]){currentUser=dbRowToUser(rows[0]);initSession();return;}
        console.warn('Session Supabase valide mais aucun utilisateur lié dans utilisateurs.auth_user_id');
      }
      const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');if(!saved||currentUser)return;
      const user=DEMO_USERS.find(item=>item.id===saved.id&&item.email===saved.email);if(user){currentUser=user;initSession();}
    }catch(error){console.warn('Restauration de session impossible',error);}
  }

  const previousLogin=window.doLogin;
  window.doLogin=async function(){
    const email=document.getElementById('loginEmail')?.value.trim().toLowerCase(),pwd=document.getElementById('loginPwd')?.value||'';const client=getAuthClient();
    if(client&&email&&pwd){try{const {data,error}=await client.auth.signInWithPassword({email,password:pwd});if(error)throw error;console.log('Supabase Auth connecté:',data?.user?.id);}catch(error){console.warn('Supabase Auth login échoué:',error.message||error);}}
    installAuthenticatedSbFetch();const result=await previousLogin();if(currentUser)startSync();return result;
  };
  const previousInit=window.initSession;window.initSession=function(){previousInit();writeSession();touch();startSync();};
  const previousLogout=window.doLogout;window.doLogout=async function(){clearSession();if(syncTimer)clearInterval(syncTimer);if(realtimeChannel){try{await realtimeClient?.removeChannel(realtimeChannel);}catch(_){}realtimeChannel=null;}try{await getAuthClient()?.auth.signOut();}catch(error){console.warn('Supabase Auth logout impossible',error);}return previousLogout();};
  const previousUpdate=window.updateTicket;window.updateTicket=async function(id,updates){installAuthenticatedSbFetch();const session=await getAuthSession();if(!session?.user)console.warn('Ticket update sans session Supabase Auth');const normalized={...updates};if(normalized.statut==='résolu')normalized.statut='fermé';const result=await previousUpdate(id,normalized);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousCreate=window.createTicket;window.createTicket=async function(data){installAuthenticatedSbFetch();const session=await getAuthSession();const payload={...data};if(session?.user)payload.created_by=session.user.id;else console.warn('Création ticket sans session Supabase Auth. La RLS peut refuser l\'écriture.');const result=await previousCreate(payload);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousComment=window.addComment;window.addComment=async function(message){installAuthenticatedSbFetch();if(currentTicket?.statut==='fermé'&&['admin','it_regional','it_hotel'].includes(currentUser?.role))await updateTicket(currentTicket.id,{statut:'nouveau'});const result=await previousComment(message);touch();channel?.postMessage({type:'tickets-updated'});await syncTickets();return result;};
  const previousSwitch=window.switchView;window.switchView=function(view,element){touch();return previousSwitch(view,element);};

  document.addEventListener('DOMContentLoaded',()=>{
    ['click','pointermove','keydown','input','submit','touchstart'].forEach(type=>document.addEventListener(type,touch,{passive:type==='pointermove'||type==='touchstart'}));
    try{channel=new BroadcastChannel('onomo-ticket-sync');channel.onmessage=event=>{if(event.data?.type==='tickets-updated')syncTickets();};}catch(_){}
    restoreSession();
    setInterval(()=>{const last=Number(localStorage.getItem(ACTIVITY_KEY)||0);if(currentUser&&last&&Date.now()-last>=INACTIVITY){clearSession();showToast('Votre session a expiré pour cause d’inactivité.','err');doLogout();}},15000);
  });
  window.OnomoRuntime={syncTickets,touch,refreshBadge,getAuthSession,installAuthenticatedSbFetch};
})();

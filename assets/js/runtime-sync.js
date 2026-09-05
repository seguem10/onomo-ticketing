/* Runtime reliability: Supabase Auth bridge, session restoration and synchronized ticket data. */
(function(){
  const SESSION_KEY='onomo_active_session_v1', ACTIVITY_KEY='onomo_last_activity_v1', INACTIVITY=15*60*1000;
  let syncTimer=null, channel=null, realtimeChannel=null, realtimeClient=null, authClient=null, loading=false;
  const t=key=>window.OnomoI18n?.t(key)||key;

  function getAuthClient(){
    if(authClient)return authClient;
    if(!window.supabase||!settings?.sbUrl||!settings?.sbKey)return null;
    try{
      authClient=window.supabase.createClient(settings.sbUrl,settings.sbKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      return authClient;
    }catch(error){
      console.warn('Supabase Auth indisponible',error);
      return null;
    }
  }

  async function getAuthSession(){
    const client=getAuthClient();
    if(!client)return null;
    try{
      const {data,error}=await client.auth.getSession();
      if(error)throw error;
      return data?.session||null;
    }catch(error){
      console.warn('Lecture session Supabase impossible',error);
      return null;
    }
  }

  const writeSession=()=>currentUser&&localStorage.setItem(SESSION_KEY,JSON.stringify({id:currentUser.id,email:currentUser.email,at:Date.now()}));
  const clearSession=()=>{localStorage.removeItem(SESSION_KEY);localStorage.removeItem(ACTIVITY_KEY);};
  const touch=()=>{if(currentUser)localStorage.setItem(ACTIVITY_KEY,String(Date.now()));};

  function refreshBadge(){
    if(!currentUser)return;
    const all=visibleTickets();
    const badge=document.getElementById('sbOpen');
    if(badge)badge.textContent=all.length;
  }

  function refreshView(){
    if(!currentUser)return;
    updateCounts();
    refreshBadge();
    if(['dashboard','tickets','urgents','my-tickets','detail'].includes(currentView))renderView();
  }

  async function syncTickets(){
    if(loading||!currentUser||!sbOK())return;
    loading=true;
    try{
      const previous=new Map((tickets||[]).map(ticket=>[String(ticket.id),ticket]));
      const records=await sbLoadTickets();
      if(Array.isArray(records)){
        tickets=records;
        saveTickets(tickets);
        records.forEach(ticket=>{
          const before=previous.get(String(ticket.id));
          const mine=(ticket.assigne_a===`${currentUser.prenom} ${currentUser.nom}`.trim());
          if(before&&mine&&before.assigne_a!==ticket.assigne_a)window.addNotif?.(`Ticket ${ticket.numero} assigné à votre équipe.`,'ticket','var(--brand)');
          if(before&&mine&&before.statut!==ticket.statut&&ticket.statut==='fermé')window.addNotif?.(`Le ticket ${ticket.numero} a été fermé.`,'circle-check','var(--green)');
        });
        refreshView();
      }
    }catch(error){
      console.warn('Ticket sync unavailable',error);
    }finally{
      loading=false;
    }
  }

  function startRealtime(){
    if(realtimeChannel||!window.supabase||!sbOK())return;
    try{
      realtimeClient=getAuthClient()||window.supabase.createClient(settings.sbUrl,settings.sbKey,{auth:{persistSession:true,autoRefreshToken:true}});
      realtimeChannel=realtimeClient.channel('onomo-ticket-events')
        .on('postgres_changes',{event:'*',schema:'public',table:'tickets'},()=>syncTickets())
        .on('postgres_changes',{event:'*',schema:'public',table:'commentaires'},()=>syncTickets())
        .subscribe((status)=>{
          if(status==='SUBSCRIBED')console.log('Supabase Realtime connecté');
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('Supabase Realtime indisponible, polling actif');
        });
    }catch(error){
      console.warn('Supabase Realtime indisponible : recours à la synchronisation périodique.',error);
    }
  }

  function startSync(){
    if(syncTimer)clearInterval(syncTimer);
    syncTickets();
    startRealtime();
    syncTimer=setInterval(syncTickets,10000);
  }

  async function restoreSession(){
    try{
      const session=await getAuthSession();
      if(session?.user){
        const rows=await sbFetch(`utilisateurs?auth_user_id=eq.${session.user.id}&limit=1`);
        if(rows?.[0]){
          currentUser=dbRowToUser(rows[0]);
          initSession();
          return;
        }
        console.warn('Session Supabase valide mais aucun utilisateur lié dans utilisateurs.auth_user_id');
      }
      const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      if(!saved||currentUser)return;
      const user=DEMO_USERS.find(item=>item.id===saved.id&&item.email===saved.email);
      if(user){
        currentUser=user;
        initSession();
      }
    }catch(error){
      console.warn('Restauration de session impossible',error);
    }
  }

  /*
   * Important: l'application avait son propre login local, alors que les RLS
   * Supabase utilisent auth.uid(). Le bridge ci-dessous connecte aussi le
   * compte à Supabase Auth avant de lancer le login historique.
   */
  const previousLogin=window.doLogin;
  window.doLogin=async function(){
    const email=document.getElementById('loginEmail')?.value.trim().toLowerCase();
    const pwd=document.getElementById('loginPwd')?.value||'';
    const client=getAuthClient();
    if(client&&email&&pwd){
      try{
        const {data,error}=await client.auth.signInWithPassword({email,password:pwd});
        if(error)throw error;
        console.log('Supabase Auth connecté:',data?.user?.id);
      }catch(error){
        /* Le login local historique reste disponible. Les opérations protégées
           par RLS resteront bloquées tant que le compte n'est pas lié à Auth. */
        console.warn('Supabase Auth login échoué:',error.message||error);
      }
    }
    const result=await previousLogin();
    if(currentUser)startSync();
    return result;
  };

  const previousInit=window.initSession;
  window.initSession=function(){
    previousInit();
    writeSession();
    touch();
    startSync();
  };

  const previousLogout=window.doLogout;
  window.doLogout=async function(){
    clearSession();
    if(syncTimer)clearInterval(syncTimer);
    if(realtimeChannel){try{await realtimeClient?.removeChannel(realtimeChannel);}catch(_){}realtimeChannel=null;}
    const client=getAuthClient();
    try{await client?.auth.signOut();}catch(error){console.warn('Supabase Auth logout impossible',error);}
    return previousLogout();
  };

  const previousUpdate=window.updateTicket;
  window.updateTicket=async function(id,updates){
    const session=await getAuthSession();
    if(!session?.user)console.warn('Ticket update sans session Supabase Auth');
    const normalized={...updates};
    if(normalized.statut==='résolu')normalized.statut='fermé';
    const result=await previousUpdate(id,normalized);
    touch();
    channel?.postMessage({type:'tickets-updated'});
    await syncTickets();
    return result;
  };

  const previousCreate=window.createTicket;
  window.createTicket=async function(data){
    const session=await getAuthSession();
    const payload={...data};
    if(session?.user){
      payload.created_by=session.user.id;
    }else{
      console.warn('Création ticket sans session Supabase Auth. La RLS peut refuser l\'écriture.');
    }
    const result=await previousCreate(payload);
    touch();
    channel?.postMessage({type:'tickets-updated'});
    await syncTickets();
    return result;
  };

  const previousComment=window.addComment;
  window.addComment=async function(message){
    if(currentTicket?.statut==='fermé'&&['admin','it_regional','it_hotel'].includes(currentUser?.role)){
      await updateTicket(currentTicket.id,{statut:'nouveau'});
    }
    const result=await previousComment(message);
    touch();
    channel?.postMessage({type:'tickets-updated'});
    await syncTickets();
    return result;
  };

  const previousSwitch=window.switchView;
  window.switchView=function(view,element){touch();return previousSwitch(view,element);};

  document.addEventListener('DOMContentLoaded',()=>{
    ['click','pointermove','keydown','input','submit','touchstart'].forEach(type=>document.addEventListener(type,touch,{passive:type==='pointermove'||type==='touchstart'}));
    try{
      channel=new BroadcastChannel('onomo-ticket-sync');
      channel.onmessage=event=>{if(event.data?.type==='tickets-updated')syncTickets();};
    }catch(_){/* polling continues when BroadcastChannel is unavailable */}
    restoreSession();
    setInterval(()=>{
      const last=Number(localStorage.getItem(ACTIVITY_KEY)||0);
      if(currentUser&&last&&Date.now()-last>=INACTIVITY){
        clearSession();
        showToast('Votre session a expiré pour cause d’inactivité.','err');
        doLogout();
      }
    },15000);
  });

  window.OnomoRuntime={syncTickets,touch,refreshBadge,getAuthSession};
})();

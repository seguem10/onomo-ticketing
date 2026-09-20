/* ONOMO Support IT - changement de mot de passe sans rechargement de la SPA. */
(function(){
  'use strict';
  function cfg(){try{return typeof settings!=='undefined'?settings:window.settings||{};}catch(_){return window.settings||{};}}
  function toast(message,type){try{window.showToast?.(message,type||'ok');}catch(_){}}
  function getButton(){
    return document.querySelector('#mainContent button[onclick*="changeMyPassword"]')
      || Array.from(document.querySelectorAll('#mainContent button')).find(b=>/mot de passe/i.test(String(b.textContent||'')));
  }
  async function changePassword(){
    const old=document.getElementById('pOld')?.value||'';
    const nw=document.getElementById('pNew')?.value||'';
    const confirm=document.getElementById('pConfirm')?.value||'';
    if(!old){toast('Saisissez votre mot de passe actuel','err');return;}
    if(nw.length<6){toast('Le nouveau mot de passe doit faire au moins 6 caractères','err');return;}
    if(nw!==confirm){toast('Les mots de passe ne correspondent pas','err');return;}
    const auth=window.OnomoAuth, session=await auth?.getSession?.(), s=cfg();
    if(!session?.access_token||!session.user?.id||!session.user?.email){toast('Session utilisateur introuvable','err');return;}
    if(!s?.sbUrl||!s?.sbKey){toast('Supabase non configuré','err');return;}
    const button=getButton(); if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    try{
      const verifier=window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'onomo-password-check-'+Date.now()}});
      const check=await verifier.auth.signInWithPassword({email:session.user.email,password:old});
      try{await verifier.auth.signOut();}catch(_){}
      if(check.error)throw new Error('Mot de passe actuel incorrect');
      const response=await fetch(`${s.sbUrl}/auth/v1/user`,{
        method:'PUT',
        headers:{'Content-Type':'application/json','apikey':s.sbKey,'Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({password:nw})
      });
      if(!response.ok){const text=await response.text();throw new Error(text||'Impossible de modifier le mot de passe');}
      try{
        if(typeof window.sbFetch==='function'){
          const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);
          const id=rows?.[0]?.id, hash=typeof window.hashPwd==='function'?window.hashPwd(nw):null;
          if(id&&hash) await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({pwd:hash,must_change_password:false}),prefer:'return=minimal'});
        }
      }catch(error){console.warn('[ONOMO] sync password profile',error);}
      ['pOld','pNew','pConfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      toast('Mot de passe mis à jour','ok');
    }catch(error){console.error('[ONOMO] password change',error);toast(error?.message||'Impossible de modifier le mot de passe','err');}
    finally{if(button){button.disabled=false;button.removeAttribute('aria-busy');}}
  }
  function boot(){
    if(document.documentElement.__onomoPasswordFixInstalled)return;
    document.documentElement.__onomoPasswordFixInstalled=true;
    window.changeMyPassword=changePassword;
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('#mainContent button'); if(!button)return;
      if(!document.getElementById('pOld')||!document.getElementById('pNew')||!document.getElementById('pConfirm'))return;
      if(button!==getButton()&&!/mot de passe/i.test(String(button.textContent||'')))return;
      event.preventDefault();event.stopImmediatePropagation();changePassword();
    },true);
    document.addEventListener('submit',event=>{
      if(!document.getElementById('pOld')||!document.getElementById('pNew')||!document.getElementById('pConfirm'))return;
      event.preventDefault();event.stopImmediatePropagation();changePassword();
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
/* ONOMO Support IT - changement de mot de passe sans rechargement de la SPA. */
(function(){
  'use strict';

  function cfg(){
    try{return typeof settings!=='undefined'?settings:window.settings||{};}catch(_){return window.settings||{};}
  }

  function toast(message,type){
    try{if(typeof window.showToast==='function')window.showToast(message,type||'ok');}catch(_){}
  }

  function getPasswordButton(){
    return document.querySelector('#mainContent button[onclick*="changeMyPassword"]')
      || Array.from(document.querySelectorAll('#mainContent button')).find(button=>{
        const label=String(button.textContent||'').toLowerCase();
        return label.includes('enregistrer')&&label.includes('mot de passe');
      });
  }

  async function changePassword(){
    const old=document.getElementById('pOld')?.value||'';
    const nw=document.getElementById('pNew')?.value||'';
    const confirm=document.getElementById('pConfirm')?.value||'';

    if(!old){toast('Saisissez votre mot de passe actuel','err');return;}
    if(!nw||nw.length<6){toast('Le nouveau mot de passe doit faire au moins 6 caractères','err');return;}
    if(nw!==confirm){toast('Les mots de passe ne correspondent pas','err');return;}

    const auth=window.OnomoAuth;
    const client=auth?.getClient?.();
    const session=await auth?.getSession?.();
    const authId=session?.user?.id;
    const email=session?.user?.email;

    if(!client||!session?.access_token||!authId||!email){
      toast('Session utilisateur introuvable','err');
      return;
    }

    const s=cfg();
    if(!s?.sbUrl||!s?.sbKey){
      toast('Supabase non configuré','err');
      return;
    }

    const button=getPasswordButton();
    if(button){
      button.disabled=true;
      button.setAttribute('aria-busy','true');
    }

    try{
      const verifier=window.supabase.createClient(s.sbUrl,s.sbKey,{
        auth:{
          persistSession:false,
          autoRefreshToken:false,
          storageKey:'onomo-password-verifier-'+Date.now()
        }
      });

      const check=await verifier.auth.signInWithPassword({email,password:old});
      try{await verifier.auth.signOut();}catch(_){}

      if(check.error)throw new Error('Mot de passe actuel incorrect');

      const result=await client.auth.updateUser({password:nw});
      if(result.error)throw result.error;

      try{
        if(typeof window.sbFetch==='function'){
          const rows=await window.sbFetch(
            `utilisateurs?auth_user_id=eq.${encodeURIComponent(authId)}&limit=1`
          );
          const id=rows?.[0]?.id;
          const hash=typeof window.hashPwd==='function'?window.hashPwd(nw):null;

          if(id&&hash){
            await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(id)}`,{
              method:'PATCH',
              body:JSON.stringify({
                pwd:hash,
                must_change_password:false
              }),
              prefer:'return=minimal'
            });
          }
        }
      }catch(error){
        console.warn('[ONOMO] synchronisation profil mot de passe',error);
      }

      ['pOld','pNew','pConfirm'].forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.value='';
      });

      toast('Mot de passe mis à jour','ok');
    }catch(error){
      console.error('[ONOMO] changement mot de passe',error);
      toast(error?.message||'Impossible de modifier le mot de passe','err');
    }finally{
      if(button){
        button.disabled=false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  function installFormProtection(){
    if(document.documentElement.__onomoPasswordFormProtection)return;
    document.documentElement.__onomoPasswordFormProtection=true;

    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('#mainContent button');
      if(!button)return;
      const hasPasswordFields=
        document.getElementById('pOld') &&
        document.getElementById('pNew') &&
        document.getElementById('pConfirm');
      if(!hasPasswordFields)return;

      const isPasswordButton=button===getPasswordButton()
        || /enregistrer.*mot de passe|sauvegarder.*mot de passe|change.*password|save.*password/i.test(String(button.textContent||''));
      if(!isPasswordButton)return;

      event.preventDefault();
      event.stopImmediatePropagation();
      changePassword();
    },true);

    document.addEventListener('submit',event=>{
      const hasPasswordFields=
        document.getElementById('pOld') &&
        document.getElementById('pNew') &&
        document.getElementById('pConfirm');
      if(!hasPasswordFields)return;

      event.preventDefault();
      event.stopImmediatePropagation();
      changePassword();
    },true);

    document.addEventListener('keydown',event=>{
      if(event.key!=='Enter')return;
      const active=event.target;
      if(!active?.closest?.('#mainContent'))return;
      const hasPasswordFields=
        document.getElementById('pOld') &&
        document.getElementById('pNew') &&
        document.getElementById('pConfirm');
      if(!hasPasswordFields)return;

      event.preventDefault();
      event.stopImmediatePropagation();
      changePassword();
    },true);
  }

  function boot(){
    installFormProtection();
    window.changeMyPassword=changePassword;
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
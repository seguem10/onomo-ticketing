/* ONOMO Support IT - changement de mot de passe sans retour automatique au dashboard. */
(function(){
  'use strict';

  function cfg(){
    try{return typeof settings!=='undefined'?settings:window.settings||{};}catch(_){return window.settings||{};}
  }

  function toast(message,type){
    try{if(typeof window.showToast==='function')window.showToast(message,type||'ok');}catch(_){ }
  }

  async function changePassword(){
    const old=document.getElementById('pOld')?.value||'';
    const nw=document.getElementById('pNew')?.value||'';
    const confirm=document.getElementById('pConfirm')?.value||'';
    if(!old){toast('Saisissez votre mot de passe actuel','err');return;}
    if(!nw||nw.length<6){toast('Le nouveau mot de passe doit faire au moins 6 caractères','err');return;}
    if(nw!==confirm){toast('Les mots de passe ne correspondent pas','err');return;}

    const session=await window.OnomoAuth?.getSession?.();
    const authId=session?.user?.id;
    const email=session?.user?.email;
    if(!authId||!email){toast('Session utilisateur introuvable','err');return;}

    const s=cfg();
    if(!s?.sbUrl||!s?.sbKey){toast('Supabase non configuré','err');return;}

    try{
      /* Client temporaire: vérifie l'ancien mot de passe sans toucher
         à la session principale de l'application. */
      const verifier=window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'onomo-password-verifier'}});
      const check=await verifier.auth.signInWithPassword({email,password:old});
      if(check.error)throw new Error('Mot de passe actuel incorrect');

      /* Mise à jour directe de GoTrue. Cela évite USER_UPDATED côté
         client principal et donc évite le retour automatique au dashboard. */
      const response=await fetch(`${s.sbUrl}/auth/v1/user`,{
        method:'PUT',
        headers:{'Content-Type':'application/json','apikey':s.sbKey,'Authorization':`Bearer ${session.access_token}`},
        body:JSON.stringify({password:nw})
      });
      if(!response.ok){
        const text=await response.text();
        throw new Error(text||'Impossible de modifier le mot de passe');
      }

      /* Garde la colonne legacy synchronisée pour les anciens contrôles. */
      if(typeof window.sbFetch==='function'){
        try{
          const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(authId)}&limit=1`);
          const id=rows?.[0]?.id;
          const hash=typeof window.hashPwd==='function'?window.hashPwd(nw):null;
          if(id&&hash){
            await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(id)}`,{
              method:'PATCH',
              body:JSON.stringify({pwd:hash,must_change_password:false}),
              prefer:'return=minimal'
            });
          }
        }catch(error){console.warn('[ONOMO] synchronisation profil mot de passe',error);}
      }

      document.getElementById('pOld').value='';
      document.getElementById('pNew').value='';
      document.getElementById('pConfirm').value='';
      toast('Mot de passe mis à jour','ok');
    }catch(error){
      console.error('[ONOMO] changement mot de passe',error);
      toast(error.message||'Impossible de modifier le mot de passe','err');
    }
  }

  window.changeMyPassword=changePassword;
})();

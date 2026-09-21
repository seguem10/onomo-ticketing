/* ONOMO Support IT - stable password change without navigation. */
(function(){
  'use strict';
  function cfg(){try{return typeof settings!=='undefined'?settings:window.settings||{};}catch(_){return window.settings||{};}}
  function toast(message,type){try{window.showToast?.(message,type||'ok');}catch(_){}
  }
  function getButton(){return document.querySelector('#mainContent button[onclick*="changeMyPassword"]')||Array.from(document.querySelectorAll('#mainContent button')).find(b=>/mot de passe/i.test(String(b.textContent||'')));}
  function lockForm(){const b=getButton();if(b){b.type='button';b.removeAttribute('onclick');b.setAttribute('data-onomo-password-button','1');}return b;}
  function keepProfile(){try{if(typeof window.renderMyProfile!=='function')return;const v=typeof currentView!=='undefined'?currentView:null;if(v!=='profile'){const item=document.querySelector('[data-view="profile"]');try{window.renderMyProfile();}catch(_){}document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));item?.classList.add('active');}}catch(_){} }
  async function changePassword(){
    const old=document.getElementById('pOld')?.value||'',nw=document.getElementById('pNew')?.value||'',confirm=document.getElementById('pConfirm')?.value||'';
    if(!old){toast('Saisissez votre mot de passe actuel','err');return;}
    if(nw.length<6){toast('Le nouveau mot de passe doit faire au moins 6 caractères','err');return;}
    if(nw!==confirm){toast('Les mots de passe ne correspondent pas','err');return;}
    const session=await window.OnomoAuth?.getSession?.(),s=cfg();
    if(!session?.access_token||!session.user?.id||!session.user?.email){toast('Session utilisateur introuvable','err');return;}
    if(!s?.sbUrl||!s?.sbKey){toast('Supabase non configuré','err');return;}
    const b=lockForm();if(b){b.disabled=true;b.setAttribute('aria-busy','true');}
    try{
      const verifier=window.supabase.createClient(s.sbUrl,s.sbKey,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'onomo-password-check-'+Date.now()}});
      const check=await verifier.auth.signInWithPassword({email:session.user.email,password:old});
      try{await verifier.auth.signOut();}catch(_){}
      if(check.error)throw new Error('Mot de passe actuel incorrect');
      const response=await fetch(`${s.sbUrl}/auth/v1/user`,{method:'PUT',headers:{'Content-Type':'application/json','apikey':s.sbKey,'Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({password:nw})});
      if(!response.ok){const text=await response.text();throw new Error(text||'Impossible de modifier le mot de passe');}
      try{if(typeof window.sbFetch==='function'){const rows=await window.sbFetch(`utilisateurs?auth_user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`);const id=rows?.[0]?.id,hash=typeof window.hashPwd==='function'?window.hashPwd(nw):null;if(id&&hash)await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({pwd:hash,must_change_password:false}),prefer:'return=minimal'});}}catch(error){console.warn('[ONOMO] sync password profile',error);}
      ['pOld','pNew','pConfirm'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
      toast('Mot de passe mis à jour','ok');
      setTimeout(keepProfile,50);setTimeout(keepProfile,300);setTimeout(keepProfile,1000);
    }catch(error){console.error('[ONOMO] password change',error);toast(error?.message||'Impossible de modifier le mot de passe','err');}
    finally{const x=getButton();if(x){x.type='button';x.disabled=false;x.removeAttribute('aria-busy');x.setAttribute('data-onomo-password-button','1');}}
  }
  function boot(){
    if(document.documentElement.__onomoPasswordFixInstalled)return;
    document.documentElement.__onomoPasswordFixInstalled=true;
    window.changeMyPassword=changePassword;
    document.addEventListener('click',event=>{const b=event.target?.closest?.('#mainContent button');if(!b)return;if(!document.getElementById('pOld')||!document.getElementById('pNew')||!document.getElementById('pConfirm'))return;if(b!==getButton()&&!/mot de passe/i.test(String(b.textContent||'')))return;event.preventDefault();event.stopImmediatePropagation();changePassword();},true);
    document.addEventListener('submit',event=>{if(!document.getElementById('pOld')||!document.getElementById('pNew')||!document.getElementById('pConfirm'))return;event.preventDefault();event.stopImmediatePropagation();changePassword();},true);
    document.addEventListener('keydown',event=>{if(event.key==='Enter'&&document.getElementById('pOld')&&document.getElementById('pNew')&&document.getElementById('pConfirm'))event.preventDefault();},true);
    lockForm();setInterval(lockForm,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
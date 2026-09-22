/* ONOMO Support IT - stable password change without navigation. */
(function(){
  'use strict';
  function toast(message,type){try{window.showToast?.(message,type||'ok');}catch(_){}
  }
  function getButton(){return document.querySelector('#mainContent button[onclick*="changeMyPassword"]')||Array.from(document.querySelectorAll('#mainContent button')).find(b=>/mot de passe/i.test(String(b.textContent||'')));}
  function lockForm(){const b=getButton();if(b){b.type='button';b.removeAttribute('onclick');b.setAttribute('data-onomo-password-button','1');}return b;}
  function keepProfile(){try{if(typeof window.renderMyProfile!=='function')return;const v=typeof currentView!=='undefined'?currentView:null;if(v!=='profile'){const item=document.querySelector('[data-view="profile"]');try{window.renderMyProfile();}catch(_){}document.querySelectorAll('.nav-item').forEach(el=>el.classList.remove('active'));item?.classList.add('active');}}catch(_){} }
  // runtime-sync.js owns the authoritative password flow: it enforces the
  // full policy, verifies the current password through Supabase Auth and never
  // writes a browser-generated password hash into public.utilisateurs.
  const secureChangePassword=typeof window.changeMyPassword==='function'
    ? window.changeMyPassword.bind(window)
    : null;
  async function changePassword(){
    if(!secureChangePassword){toast('Fonction de sécurité indisponible. Rechargez la page.','err');return false;}
    const b=lockForm();if(b){b.disabled=true;b.setAttribute('aria-busy','true');}
    try{
      const changed=await secureChangePassword();
      if(changed){setTimeout(keepProfile,50);setTimeout(keepProfile,300);setTimeout(keepProfile,1000);}
      return changed;
    }finally{const x=getButton();if(x){x.type='button';x.disabled=false;x.removeAttribute('aria-busy');x.setAttribute('data-onomo-password-button','1');}}
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

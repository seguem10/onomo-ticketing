/* ONOMO Support IT — native Supabase MFA. Never store a TOTP secret in the
   profile table, browser storage, or an administrator view. The enrollment
   screen only shows the user's own secret once, for manual entry in their
   authenticator app. */
(function(){
  'use strict';
  const tr=(key,fallback)=>{const value=window.OnomoI18n?.t(key);return value&&value!==key?value:fallback;};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={mode:null,factor:null,busy:false};
  const client=()=>window.OnomoAuth?.getClient?.()||null;
  const session=()=>window.OnomoAuth?.getSession?.();
  const required=user=>user?.app_metadata?.mfa_required===true;
  const close=()=>{document.getElementById('nativeMfaModal')?.remove();state.mode=null;state.factor=null;state.busy=false;};
  const showError=message=>{const node=document.getElementById('nativeMfaError');if(node){node.textContent=message;node.hidden=false;}};
  const hideError=()=>{const node=document.getElementById('nativeMfaError');if(node)node.hidden=true;};
  const digits=()=>[...document.querySelectorAll('#nativeMfaModal .mfa-digit')];
  const readCode=()=>digits().map(input=>input.value).join('');
  const clearCode=()=>{digits().forEach(input=>{input.value='';});digits()[0]?.focus();};
  const verifyError=error=>{
    const message=String(error?.message||'');
    if(/invalid|expired|incorrect|verification failed/i.test(message)||error?.code==='mfa_verification_failed')return tr('mfa_code_invalid','Code incorrect ou expiré. Saisissez le nouveau code affiché dans votre application.');
    return message||tr('mfa_code_invalid','Code incorrect ou expiré. Saisissez le nouveau code affiché dans votre application.');
  };
  const verified=async()=>{
    const auth=client();if(!auth)throw new Error('Supabase Auth indisponible.');
    const {data,error}=await auth.auth.mfa.listFactors();if(error)throw error;
    return [...(data?.totp||[]),...(data?.phone||[])].filter(factor=>factor.status==='verified');
  };
  const resume=async()=>{
    const active=await session();
    if(!active?.user)throw new Error(tr('mfa_session_lost','Session MFA indisponible. Reconnectez-vous.'));
    const restored=window.OnomoAuth?.resumeAfterMfa
      ? await window.OnomoAuth.resumeAfterMfa()
      : await window.OnomoAuth?.restore?.();
    if(restored===false)throw new Error(tr('mfa_resume_failed','Impossible de reprendre la session sécurisée. Reconnectez-vous.'));
    close();
  };
  function setBusy(busy){
    state.busy=busy;
    const button=document.getElementById('nativeMfaVerify');
    if(!button)return;
    button.disabled=busy;
    button.innerHTML=busy
      ?`<i class="ti ti-loader-2 mfa-spin"></i>${esc(tr('mfa_checking','Vérification…'))}`
      :button.dataset.label;
  }
  async function verify(){
    if(state.busy)return;
    const code=readCode();
    if(!/^\d{6}$/.test(code)){showError(tr('mfa_code_incomplete','Saisissez les 6 chiffres affichés dans votre application.'));digits().find(input=>!input.value)?.focus();return;}
    const auth=client();if(!auth||!state.factor){showError(tr('mfa_session_lost','Session MFA indisponible. Reconnectez-vous.'));return;}
    hideError();setBusy(true);
    try{
      const {error}=await auth.auth.mfa.challengeAndVerify({factorId:state.factor.id,code});
      if(error)throw error;
      await resume();
    }catch(error){
      setBusy(false);showError(verifyError(error));clearCode();
    }
  }
  function codeInputHtml(){
    const label=esc(tr('mfa_code_label','Code à 6 chiffres'));
    const boxes=Array.from({length:6},(_,index)=>`<input class="mfa-digit" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" ${index===0?'autocomplete="one-time-code"':'autocomplete="off"'} aria-label="${label} ${index+1}/6">`).join('');
    return `<div class="mfa-code" role="group" aria-label="${label}">${boxes}</div>`;
  }
  function bindCodeInput(){
    const inputs=digits();
    const fill=(start,text)=>{
      const chars=text.replace(/\D/g,'').slice(0,6-start).split('');
      chars.forEach((char,offset)=>{inputs[start+offset].value=char;});
      const next=Math.min(start+chars.length,5);
      inputs[next].focus();
      if(readCode().length===6)void verify();
    };
    inputs.forEach((input,index)=>{
      input.addEventListener('input',()=>{
        hideError();
        const value=input.value.replace(/\D/g,'');
        if(value.length>1){input.value='';fill(index,value);return;}
        input.value=value;
        if(value&&index<5)inputs[index+1].focus();
        if(readCode().length===6)void verify();
      });
      input.addEventListener('keydown',event=>{
        if(event.key==='Backspace'&&!input.value&&index>0){inputs[index-1].value='';inputs[index-1].focus();event.preventDefault();}
        else if(event.key==='ArrowLeft'&&index>0)inputs[index-1].focus();
        else if(event.key==='ArrowRight'&&index<5)inputs[index+1].focus();
        else if(event.key==='Enter')void verify();
      });
      input.addEventListener('paste',event=>{
        const text=event.clipboardData?.getData('text')||'';
        if(!text)return;
        event.preventDefault();fill(index,text);
      });
      input.addEventListener('focus',()=>input.select());
    });
  }
  function render({icon,title,intro,body,action}){
    document.getElementById('nativeMfaModal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='nativeMfaModal';overlay.className='overlay open mfa-overlay';
    overlay.innerHTML=`<div class="modal mfa-card" role="dialog" aria-modal="true" aria-labelledby="nativeMfaTitle">
      <div class="mfa-head"><div class="mfa-badge"><i class="ti ${icon}"></i></div><h2 id="nativeMfaTitle">${esc(title)}</h2><p>${esc(intro)}</p></div>
      <div class="mfa-body">${body}<div id="nativeMfaError" class="mfa-error" role="alert" hidden></div></div>
      <div class="mfa-foot"><button class="btn btn-outline" type="button" id="nativeMfaSignout"><i class="ti ti-logout"></i>${esc(tr('mfa_signout','Se déconnecter'))}</button><button class="btn btn-gold" type="button" id="nativeMfaVerify"><i class="ti ti-shield-check"></i>${esc(action)}</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const button=document.getElementById('nativeMfaVerify');
    button.dataset.label=button.innerHTML;
    button.addEventListener('click',()=>void verify());
    document.getElementById('nativeMfaSignout')?.addEventListener('click',()=>window.doLogout?.());
    document.getElementById('nativeMfaCopy')?.addEventListener('click',async()=>{
      const secret=document.getElementById('nativeMfaSecret')?.dataset.secret||'';
      try{await navigator.clipboard.writeText(secret);window.showToast?.(tr('mfa_key_copied','Clé copiée.'),'ok');}catch(_){window.showToast?.(tr('mfa_copy_failed','Copie impossible : recopiez la clé à la main.'),'err');}
    });
    bindCodeInput();
    setTimeout(()=>digits()[0]?.focus(),0);
  }
  function challenge(factor){
    close();state.mode='challenge';state.factor=factor;
    render({
      icon:'ti-shield-lock',
      title:tr('mfa_challenge_title','Vérification en deux étapes'),
      intro:tr('mfa_challenge_intro','Ouvrez votre application d’authentification et saisissez le code affiché pour ONOMO Support IT.'),
      body:`${codeInputHtml()}<p class="mfa-hint"><i class="ti ti-clock"></i>${esc(tr('mfa_code_hint','Le code change toutes les 30 secondes.'))}</p>`,
      action:tr('mfa_verify','Vérifier')
    });
  }
  async function enroll(){
    const auth=client();if(!auth)throw new Error('Supabase Auth indisponible.');
    // A previous enrollment left unfinished (window closed before the code was
    // entered) keeps an unverified factor with the same name, which makes
    // Supabase refuse a new enrollment. Remove it first.
    const {data:listed}=await auth.auth.mfa.listFactors();
    for(const factor of listed?.all||[]){
      if(factor.status!=='verified')await auth.auth.mfa.unenroll({factorId:factor.id});
    }
    let {data,error}=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'ONOMO Support IT'});
    // If an unverified factor could not be removed, the name is still taken:
    // enroll under a dated name rather than blocking the user.
    if(error&&/already exists|name_conflict/i.test(`${error.code||''} ${error.message||''}`)){
      ({data,error}=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:`ONOMO Support IT ${new Date().toISOString().slice(0,16).replace('T',' ')}`}));
    }
    if(error)throw error;
    close();state.mode='enroll';state.factor=data;
    const secret=String(data.totp?.secret||'');
    const grouped=secret.replace(/(.{4})/g,'$1 ').trim();
    const step=(number,title,content='')=>`<li class="mfa-step"><span class="mfa-step-num">${number}</span><div class="mfa-step-body"><strong>${esc(title)}</strong>${content}</div></li>`;
    render({
      icon:'ti-shield-plus',
      title:tr('mfa_enroll_title','Sécurisez votre compte'),
      intro:tr('mfa_enroll_intro','Votre administrateur a activé la vérification en deux étapes. Cette configuration ne prend qu’une minute.'),
      body:`<ol class="mfa-steps">
        ${step(1,tr('mfa_step_install','Installez une application d’authentification'),`<p>${esc(tr('mfa_step_install_apps','Microsoft Authenticator, Google Authenticator ou Authy.'))}</p>`)}
        ${step(2,tr('mfa_step_scan','Scannez ce QR code avec l’application'),`<div class="mfa-qr"><img src="${esc(data.totp?.qr_code||'')}" alt="${esc(tr('mfa_qr_alt','QR code de configuration MFA'))}"></div>${secret?`<details class="mfa-manual"><summary>${esc(tr('mfa_manual_toggle','Impossible de scanner ? Saisir la clé manuellement'))}</summary><div class="mfa-secret"><code id="nativeMfaSecret" data-secret="${esc(secret)}">${esc(grouped)}</code><button type="button" class="btn btn-outline btn-sm" id="nativeMfaCopy"><i class="ti ti-copy"></i>${esc(tr('mfa_copy','Copier'))}</button></div></details>`:''}`)}
        ${step(3,tr('mfa_step_code','Saisissez le code affiché'),codeInputHtml())}
      </ol>`,
      action:tr('mfa_activate','Activer')
    });
  }
  // Sign-in and session restore both call enforce() at the same moment. Run
  // only one check at a time, and never replace an MFA screen already shown:
  // a second enrollment would invalidate the QR code the user is scanning.
  let pendingEnforce=null;
  function enforce(activeSession){
    if(!pendingEnforce)pendingEnforce=enforceOnce(activeSession).finally(()=>{pendingEnforce=null;});
    return pendingEnforce;
  }
  async function enforceOnce(activeSession){
    if(!required(activeSession?.user))return true;
    const auth=client();if(!auth)return false;
    try{
      const {data:aal,error}=await auth.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;
      if(aal?.currentLevel==='aal2')return true;
      if(document.getElementById('nativeMfaModal')&&state.mode)return false;
      const factors=await verified();
      if(factors.length)challenge(factors[0]);else await enroll();
      return false;
    }catch(error){
      console.warn('MFA native indisponible',error);
      const message=tr('mfa_unavailable','La vérification MFA est temporairement indisponible. Réessayez ou contactez l’administrateur.');
      if(document.getElementById('nativeMfaError'))showError(message);else window.showToast?.(message,'err');
      return false;
    }
  }
  async function setRequired(targetUserId,enabled){
    if(!confirm(enabled?tr('mfa_require_confirm','Exiger la MFA pour ce compte ?'):tr('mfa_remove_confirm','Retirer l’obligation de la MFA pour ce compte ?')))return;
    const auth=client();if(!auth){window.showToast?.('Supabase Auth indisponible.','err');return;}
    try{
      const {data,error}=await auth.functions.invoke('admin-mfa-policy',{body:{target_user_id:targetUserId,required:enabled}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      window.showToast?.(enabled?tr('mfa_required_done','MFA obligatoire au prochain accès de l’utilisateur.'):tr('mfa_removed_done','Obligation MFA retirée.'),'ok');
      window.renderUsers?.();
    }catch(error){window.showToast?.(error?.message||tr('mfa_policy_failed','Impossible de mettre à jour la politique MFA.'),'err');}
  }
  async function reset(targetUserId){
    const reason=await requestResetReason();
    if(reason===null)return;
    if(reason.trim().length<10||reason.length>300)return window.showToast?.(tr('mfa_reason_length','Indiquez un motif de 10 à 300 caractères.'),'err');
    try{
      const auth=client();if(!auth)throw new Error('Session administrateur requise.');
      const {data,error}=await auth.functions.invoke('admin-mfa-policy',{body:{action:'reset',target_user_id:targetUserId,reason:reason.trim(),identity_confirmed:true}});
      if(error){let message;try{message=(await error.context?.json())?.error;}catch(_){}throw new Error(message||tr('mfa_reset_refused','Réinitialisation refusée. Vérifiez votre session MFA administrateur.'));}
      if(data?.error)throw new Error(data.error);
      window.showToast?.(tr('mfa_reset_done','MFA réinitialisé. Nouvelle configuration obligatoire à la connexion.'),'ok');
      void window.renderUsers?.();
    }catch(error){window.showToast?.(error.message,'err');}
  }
  function requestResetReason(){
    if(document.getElementById('mfaResetDialog'))return Promise.resolve(null);
    const previousFocus=document.activeElement;
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.id='mfaResetDialog';dialog.className='mfa-dialog';
      dialog.setAttribute('aria-labelledby','mfaResetTitle');
      dialog.innerHTML=`<form><div class="mfa-head"><div class="mfa-badge mfa-badge-warn"><i class="ti ti-shield-x"></i></div><h2 id="mfaResetTitle">${esc(tr('mfa_reset_title','Réinitialiser le MFA'))}</h2><p>${esc(tr('mfa_reset_intro','Les facteurs actuels seront supprimés et l’utilisateur devra configurer à nouveau la MFA à sa prochaine connexion. Ne saisissez aucun secret.'))}</p></div><div class="form-g"><label class="field-lbl" for="mfaResetReason">${esc(tr('mfa_reset_reason','Motif (10 à 300 caractères)'))}</label><textarea id="mfaResetReason" class="field-ctrl" minlength="10" maxlength="300" required rows="3"></textarea></div><label class="mfa-check"><input id="mfaResetIdentity" type="checkbox" required> <span>${esc(tr('mfa_reset_identity','J’ai vérifié l’identité de cet utilisateur par un canal indépendant.'))}</span></label><div class="mfa-foot"><button type="button" id="mfaResetCancel" class="btn btn-outline">${esc(tr('cancel','Annuler'))}</button><button type="submit" class="btn btn-gold">${esc(tr('mfa_reset_confirm','Confirmer la réinitialisation'))}</button></div></form>`;
      const finish=value=>{dialog.remove();previousFocus?.focus?.();resolve(value);};
      dialog.querySelector('#mfaResetCancel').addEventListener('click',()=>finish(null));
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
      dialog.querySelector('form').addEventListener('submit',event=>{
        event.preventDefault();
        const field=dialog.querySelector('#mfaResetReason');
        const reason=field.value.trim();
        field.setCustomValidity(reason.length<10?tr('mfa_reason_length','Indiquez un motif de 10 à 300 caractères.'):'');
        if(!dialog.querySelector('form').reportValidity())return;
        finish(reason);
      });
      dialog.querySelector('#mfaResetReason').addEventListener('input',event=>event.target.setCustomValidity(''));
      document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('textarea').focus();
    });
  }
  window.OnomoMfa={enforce,setRequired,reset};
})();

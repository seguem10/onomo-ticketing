/* ONOMO Support IT — native Supabase MFA. Never store a TOTP secret in the
   profile table, browser storage, or an administrator view. */
(function(){
  'use strict';
  const tr=(key,fallback)=>window.OnomoI18n?.t(key)||fallback;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const state={mode:null,factor:null};
  const client=()=>window.OnomoAuth?.getClient?.()||null;
  const session=()=>window.OnomoAuth?.getSession?.();
  const required=user=>user?.app_metadata?.mfa_required===true;
  const close=()=>{document.getElementById('nativeMfaModal')?.remove();state.mode=null;state.factor=null;};
  const showError=message=>{const node=document.getElementById('nativeMfaError');if(node){node.textContent=message;node.style.display='block';}};
  const verified=async()=>{
    const auth=client();if(!auth)throw new Error('Supabase Auth indisponible.');
    const {data,error}=await auth.auth.mfa.listFactors();if(error)throw error;
    return [...(data?.totp||[]),...(data?.phone||[])].filter(factor=>factor.status==='verified');
  };
  const resume=async()=>{
    const active=await session();
    if(!active?.user)throw new Error('Session MFA indisponible. Reconnectez-vous.');
    const restored=window.OnomoAuth?.resumeAfterMfa
      ? await window.OnomoAuth.resumeAfterMfa()
      : await window.OnomoAuth?.restore?.();
    if(restored===false)throw new Error('Impossible de reprendre la session sécurisée. Reconnectez-vous.');
    close();
  };
  async function verify(){
    const code=document.getElementById('nativeMfaCode')?.value.trim()||'';
    if(!/^\d{6}$/.test(code)){showError('Saisissez le code à 6 chiffres de votre application.');return;}
    const auth=client();if(!auth||!state.factor){showError('Session MFA indisponible. Reconnectez-vous.');return;}
    try{
      const {error}=await auth.auth.mfa.challengeAndVerify({factorId:state.factor.id,code});
      if(error)throw error;
      await resume();
    }catch(error){showError(error?.message||'Code MFA incorrect ou expiré.');}
  }
  function challenge(factor){
    state.mode='challenge';state.factor=factor;
    close();state.mode='challenge';state.factor=factor;
    const overlay=document.createElement('div');overlay.id='nativeMfaModal';overlay.className='overlay open';
    overlay.innerHTML=`<div class="modal" style="max-width:430px"><div class="modal-hdr"><div class="modal-title"><i class="ti ti-shield-lock"></i> Vérification MFA requise</div></div><div class="modal-body"><p style="margin-top:0;color:var(--tx2);line-height:1.55">Ouvrez votre application d’authentification et saisissez le code à six chiffres. L’accès au support IT reste protégé tant que cette vérification n’est pas terminée.</p><div class="form-g"><label class="field-lbl">Code de vérification</label><input id="nativeMfaCode" class="field-ctrl" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="letter-spacing:6px;text-align:center;font-family:monospace;font-size:18px"></div><div id="nativeMfaError" class="alert alert-danger" style="display:none"></div></div><div class="modal-foot"><button class="btn btn-outline" type="button" id="nativeMfaSignout">Déconnexion</button><button class="btn btn-gold" type="button" id="nativeMfaVerify"><i class="ti ti-shield-check"></i>Vérifier</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('nativeMfaVerify')?.addEventListener('click',verify);
    document.getElementById('nativeMfaCode')?.addEventListener('keydown',event=>{if(event.key==='Enter')void verify();});
    document.getElementById('nativeMfaSignout')?.addEventListener('click',()=>window.doLogout?.());
    setTimeout(()=>document.getElementById('nativeMfaCode')?.focus(),0);
  }
  async function enroll(){
    const auth=client();if(!auth)throw new Error('Supabase Auth indisponible.');
    const {data,error}=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'ONOMO Support IT'});
    if(error)throw error;
    state.mode='enroll';state.factor=data;
    const overlay=document.createElement('div');overlay.id='nativeMfaModal';overlay.className='overlay open';
    overlay.innerHTML=`<div class="modal" style="max-width:470px"><div class="modal-hdr"><div class="modal-title"><i class="ti ti-shield-plus"></i> Configurer l’authentification MFA</div></div><div class="modal-body"><p style="margin-top:0;color:var(--tx2);line-height:1.55">Votre administrateur a rendu la MFA obligatoire. Scannez ce QR code avec Microsoft Authenticator, Google Authenticator ou Authy. Ce secret reste uniquement dans Supabase et votre application d’authentification.</p><div style="text-align:center;margin:15px 0"><img src="${esc(data.totp?.qr_code||'')}" alt="QR code MFA" style="width:200px;height:200px;max-width:100%;border:1px solid var(--border);border-radius:10px;background:#fff"></div><div class="form-g"><label class="field-lbl">Code de vérification</label><input id="nativeMfaCode" class="field-ctrl" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" style="letter-spacing:6px;text-align:center;font-family:monospace;font-size:18px"></div><div id="nativeMfaError" class="alert alert-danger" style="display:none"></div></div><div class="modal-foot"><button class="btn btn-outline" type="button" id="nativeMfaSignout">Déconnexion</button><button class="btn btn-gold" type="button" id="nativeMfaVerify"><i class="ti ti-shield-check"></i>Activer MFA</button></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('nativeMfaVerify')?.addEventListener('click',verify);
    document.getElementById('nativeMfaCode')?.addEventListener('keydown',event=>{if(event.key==='Enter')void verify();});
    document.getElementById('nativeMfaSignout')?.addEventListener('click',()=>window.doLogout?.());
    setTimeout(()=>document.getElementById('nativeMfaCode')?.focus(),0);
  }
  async function enforce(activeSession){
    if(!required(activeSession?.user))return true;
    const auth=client();if(!auth)return false;
    try{
      const {data:aal,error}=await auth.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;
      if(aal?.currentLevel==='aal2')return true;
      const factors=await verified();
      if(factors.length)challenge(factors[0]);else await enroll();
      return false;
    }catch(error){console.warn('MFA native indisponible',error);showError('La vérification MFA est temporairement indisponible. Réessayez ou contactez l’administrateur.');return false;}
  }
  async function setRequired(targetUserId,enabled){
    if(!confirm(`${enabled?'Exiger':'Retirer l’obligation de'} la MFA pour ce compte ?`))return;
    const auth=client();if(!auth){window.showToast?.('Supabase Auth indisponible.','err');return;}
    try{
      const {data,error}=await auth.functions.invoke('admin-mfa-policy',{body:{target_user_id:targetUserId,required:enabled}});
      if(error)throw error;if(data?.error)throw new Error(data.error);
      window.showToast?.(enabled?'MFA obligatoire au prochain accès de l’utilisateur.':'Obligation MFA retirée.','ok');
      window.renderUsers?.();
    }catch(error){window.showToast?.(error?.message||'Impossible de mettre à jour la politique MFA.','err');}
  }
  async function reset(targetUserId){
    const reason=await requestResetReason();
    if(reason===null)return;
    if(reason.trim().length<10||reason.length>300)return window.showToast?.('Indiquez un motif de 10 à 300 caractères.','err');
    try{
      const auth=client();if(!auth)throw new Error('Session administrateur requise.');
      const {data,error}=await auth.functions.invoke('admin-mfa-policy',{body:{action:'reset',target_user_id:targetUserId,reason:reason.trim(),identity_confirmed:true}});
      if(error){let message;try{message=(await error.context?.json())?.error;}catch(_){}throw new Error(message||'Réinitialisation refusée. Vérifiez votre session MFA administrateur.');}
      if(data?.error)throw new Error(data.error);
      window.showToast?.('MFA réinitialisé. Nouvelle configuration obligatoire à la connexion.','ok');
      void window.renderUsers?.();
    }catch(error){window.showToast?.(error.message,'err');}
  }
  function requestResetReason(){
    if(document.getElementById('mfaResetDialog'))return Promise.resolve(null);
    const previousFocus=document.activeElement;
    return new Promise(resolve=>{
      const dialog=document.createElement('dialog');dialog.id='mfaResetDialog';
      dialog.setAttribute('aria-labelledby','mfaResetTitle');
      dialog.style.cssText='max-width:480px;width:calc(100% - 32px);border:1px solid var(--border);border-radius:12px;padding:24px;background:var(--surface,#fff);color:var(--tx,#111);margin:auto';
      dialog.innerHTML='<form><h2 id="mfaResetTitle">Réinitialiser le MFA</h2><p>Cette opération supprime les facteurs actuels et impose une nouvelle configuration. Ne saisissez aucun secret.</p><label for="mfaResetReason">Motif (10 à 300 caractères)</label><textarea id="mfaResetReason" minlength="10" maxlength="300" required style="display:block;width:100%;box-sizing:border-box;margin:12px 0" rows="3"></textarea><label><input id="mfaResetIdentity" type="checkbox" required> J’ai vérifié l’identité de cet utilisateur par un canal indépendant.</label><div style="display:flex;gap:12px;margin-top:20px"><button type="button" id="mfaResetCancel" class="btn btn-outline">Annuler</button><button type="submit" class="btn btn-gold">Confirmer la réinitialisation</button></div></form>';
      const finish=value=>{dialog.remove();previousFocus?.focus?.();resolve(value);};
      dialog.querySelector('#mfaResetCancel').addEventListener('click',()=>finish(null));
      dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
      dialog.querySelector('form').addEventListener('submit',event=>{
        event.preventDefault();
        const field=dialog.querySelector('#mfaResetReason');
        const reason=field.value.trim();
        field.setCustomValidity(reason.length<10?'Indiquez un motif de 10 à 300 caractères.':'');
        if(!dialog.querySelector('form').reportValidity())return;
        finish(reason);
      });
      dialog.querySelector('#mfaResetReason').addEventListener('input',event=>event.target.setCustomValidity(''));
      document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('textarea').focus();
    });
  }
  window.OnomoMfa={enforce,setRequired,reset};
})();

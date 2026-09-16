/* ONOMO Support IT - sauvegarde fiable des modifications utilisateurs */
(function(){
  'use strict';

  const roleNorm=r=>({
    admin:'admin',administrateur:'admin','administrateur système':'admin',
    it_regional:'it_regional','it régional':'it_regional',
    it_hotel:'it_hotel','it hotel':'it_hotel',
    demandeur:'demandeur',requester:'demandeur'
  }[String(r||'').toLowerCase().trim()]||String(r||'').toLowerCase().trim());

  function selectedHotels(){
    try{
      if(typeof window.getSelectedHotels==='function'){
        const v=window.getSelectedHotels();
        if(Array.isArray(v))return v.filter(Boolean);
      }
    }catch(_){ }
    const out=[];
    try{
      document.querySelectorAll('#uHotelMulti input:checked,#uHotelMulti select option:checked,[name="hotels"]:checked').forEach(x=>{
        const v=x.value||x.getAttribute('data-hotel');
        if(v&&!out.includes(v))out.push(v);
      });
    }catch(_){ }
    return out;
  }

  function formData(){
    const role=roleNorm(document.getElementById('uRole')?.value||'');
    const prenom=(document.getElementById('uPrenom')?.value||'').trim();
    const nom=(document.getElementById('uNom')?.value||'').trim();
    const email=(document.getElementById('uEmail')?.value||'').trim().toLowerCase();
    const selected=selectedHotels();
    let hotel=null, hotels=[];
    if(role==='it_hotel'||role==='demandeur'){
      hotel=(document.getElementById('uHotel')?.value||'').trim()||null;
      if(hotel)hotels=role==='demandeur'?[hotel]:[];
    }else if(role==='it_regional'){
      hotels=selected;
    }
    return {role,prenom,nom,email,hotel,hotels};
  }

  async function saveEdit(){
    const id=document.getElementById('uEditId')?.value||'';
    if(!id){window.showToast?.('Utilisateur introuvable.','err');return false;}
    const d=formData();
    if(!d.email){window.showToast?.("L'email est requis",'err');return false;}
    if(d.role==='it_hotel'&&!d.hotel){window.showToast?.("Sélectionnez un hôtel pour l'IT Hôtel",'err');return false;}
    if(d.role==='it_regional'&&!d.hotels.length){window.showToast?.("Sélectionnez au moins un hôtel pour l'IT Régional",'err');return false;}
    if(d.role==='demandeur'&&!d.hotel){window.showToast?.('Sélectionnez un hôtel pour le Demandeur','err');return false;}
    if(typeof window.sbFetch!=='function'){
      window.showToast?.('Supabase est indisponible. Modification non enregistrée.','err');
      return false;
    }

    try{
      const payload={prenom:d.prenom,nom:d.nom,email:d.email,role:d.role,hotel:d.hotel,hotels:d.hotels,roles:[d.role]};
      const rows=await window.sbFetch(`utilisateurs?id=eq.${encodeURIComponent(id)}`,{
        method:'PATCH',
        body:JSON.stringify(payload),
        prefer:'return=representation'
      });
      if(!Array.isArray(rows)||!rows[0])throw new Error('Aucune ligne utilisateur modifiée');

      const fresh=typeof window.dbRowToUser==='function'?window.dbRowToUser(rows[0]):rows[0];
      if(Array.isArray(window.DEMO_USERS)){
        const i=window.DEMO_USERS.findIndex(x=>String(x.id)===String(id));
        if(i>=0)window.DEMO_USERS[i]=fresh;else window.DEMO_USERS.push(fresh);
        window.saveUsers?.(window.DEMO_USERS);
      }
      if(window.currentUser&&String(window.currentUser.id)===String(id))window.currentUser={...window.currentUser,...fresh};
      window.populateSelects?.();
      window.closeModal?.('modalUser');
      window.showToast?.('Compte mis à jour dans Supabase','ok');
      window.renderUsers?.();
      return true;
    }catch(error){
      console.error('ONOMO sauvegarde utilisateur:',error);
      window.showToast?.(error?.message||'Modification non enregistrée dans Supabase','err');
      return false;
    }
  }

  function interceptSaveButton(){
    if(document.documentElement.__onomoUserSaveClick)return;
    document.documentElement.__onomoUserSaveClick=true;
    document.addEventListener('click',event=>{
      const modal=document.getElementById('modalUser');
      if(!modal||!modal.contains(event.target))return;
      const button=event.target.closest('button,input[type="button"],input[type="submit"]');
      if(!button)return;
      const label=String(button.textContent||button.value||'').toLowerCase().trim();
      if(!/(enregistrer|sauvegarder|save|modifier)/.test(label))return;
      if(!document.getElementById('uEditId')?.value)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      saveEdit();
    },true);
  }

  function wrap(){
    const fn=window.submitUser;
    if(typeof fn!=='function'||fn.__onomoDirectUserSave)return false;
    const wrapped=async function(){
      const id=document.getElementById('uEditId')?.value||'';
      if(id)return saveEdit();
      return fn.apply(this,arguments);
    };
    wrapped.__onomoDirectUserSave=true;
    window.submitUser=wrapped;
    try{window.eval('submitUser=window.submitUser');}catch(_){ }
    return true;
  }

  function boot(){
    interceptSaveButton();
    wrap();
    let n=0;
    const timer=setInterval(()=>{if(wrap()||++n>40)clearInterval(timer);},250);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

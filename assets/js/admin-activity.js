/* ONOMO Support IT - Journal d'activité administrateur + branding ONOMO */
(function(){
  const TABLE='activity_log';
  const isAdmin=()=>{
    const u=window.currentUser||{};
    const roles=[u.role,u.role_name,u.user_role,...(Array.isArray(u.roles)?u.roles:[])].filter(Boolean).map(v=>String(v).toLowerCase().trim());
    return !!(u.is_admin||u.isAdmin||roles.some(r=>['admin','administrateur','administrator'].includes(r)));
  };
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const actor=()=>({actor_id:window.currentUser?.auth_user_id||window.currentUser?.id||null,actor_name:[window.currentUser?.prenom,window.currentUser?.nom].filter(Boolean).join(' ')||window.currentUser?.email||'Utilisateur',actor_email:window.currentUser?.email||null});
  async function log(action,entity_type,entity_id,details){
    if(!window.sbOK?.()||!window.currentUser)return;
    try{await window.sbFetch(TABLE,{method:'POST',body:JSON.stringify({...actor(),action,entity_type:entity_type||null,entity_id:entity_id?String(entity_id):null,details:details||{}})});}catch(_){ }
  }
  window.onomoActivityLog=log;
  function brand(){
    const logo='assets/pwa/onomo-logo.svg';
    document.querySelectorAll('.login-logo,.sb-logo').forEach(el=>{
      if(el.querySelector('img[data-onomo-logo]'))return;
      el.innerHTML='<img data-onomo-logo src="'+logo+'" alt="ONOMO" style="display:block;width:auto;height:34px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1)">';
      if(el.classList.contains('login-logo'))el.querySelector('img').style.height='48px';
    });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l=>l.href=logo);
  }
  function addNav(){
    let item=document.querySelector('[data-view="activity-log"]');
    if(!item){
      const sec=document.querySelector('.sb-nav');
      if(!sec)return;
      item=document.createElement('div');
      item.className='nav-item';
      item.dataset.view='activity-log';
      item.innerHTML='<i class="ti ti-history"></i><span>Journal d’activité</span>';
      item.onclick=function(){if(!isAdmin())return;window.renderAdminActivity();document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));item.classList.add('active');};
      sec.appendChild(item);
    }
    item.style.display=isAdmin()?'flex':'none';
  }
  async function render(){
    if(!isAdmin()){window.showToast?.('Accès non autorisé.','err');return;}
    const main=document.getElementById('mainContent');if(!main)return;
    main.innerHTML='<div class="card"><div class="card-hdr"><div><div class="card-title">Journal d’activité</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">Actions des utilisateurs et événements du système</div></div><button class="btn btn-outline btn-sm" onclick="window.renderAdminActivity()"><i class="ti ti-refresh"></i>Actualiser</button></div><div id="activityList" style="padding:0 18px 18px"><div style="padding:25px;text-align:center;color:var(--tx3)">Chargement...</div></div></div>';
    try{
      const rows=await window.sbFetch(TABLE+'?select=id,actor_name,actor_email,action,entity_type,entity_id,details,created_at&order=created_at.desc&limit=200');
      const box=document.getElementById('activityList');
      if(!box)return;
      if(!Array.isArray(rows)||!rows.length){box.innerHTML='<div style="padding:30px;text-align:center;color:var(--tx3)">Aucune activité enregistrée.</div>';return;}
      box.innerHTML=rows.map(r=>{const d=r.details&&typeof r.details==='object'?r.details:{};const detail=d.message||d.title||d.description||[r.entity_type,r.entity_id].filter(Boolean).join(' · ');return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start"><div style="width:32px;height:32px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex:0 0 auto"><i class="ti ti-history" style="font-size:16px;color:var(--brand)"></i></div><div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:600">'+esc(r.action)+'</div><div style="font-size:11px;color:var(--tx2);margin-top:2px">'+esc(r.actor_name||r.actor_email||'Utilisateur')+(detail?' · '+esc(detail):'')+'</div></div><div style="font-size:10px;color:var(--tx3);white-space:nowrap">'+esc(new Date(r.created_at).toLocaleString('fr-FR'))+'</div></div>';}).join('');
    }catch(e){const box=document.getElementById('activityList');if(box)box.innerHTML='<div style="padding:25px;color:var(--red)">Impossible de charger le journal.</div>';}
  }
  window.renderAdminActivity=render;
  function wrapSbFetch(){
    if(!window.sbFetch||window.sbFetch.__activityWrapped)return;
    const original=window.sbFetch;
    const wrapped=async function(path,options){
      const result=await original.apply(this,arguments);
      try{
        const method=String(options?.method||'GET').toUpperCase();
        const clean=String(path||'').split('?')[0].replace(/^\//,'');
        if((clean==='tickets'||clean==='utilisateurs')&&['POST','PATCH','PUT','DELETE'].includes(method)&&!String(path).includes(TABLE)){
          let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):(options.body||{});}catch(_){ }
          const entity=clean==='tickets'?'ticket':'utilisateur';
          const id=body.id||body.ticket_id||null;
          const action=clean==='tickets'?(method==='POST'?'Création de ticket':method==='DELETE'?'Suppression de ticket':'Modification de ticket'):(method==='POST'?'Création utilisateur':method==='DELETE'?'Suppression utilisateur':'Modification utilisateur');
          log(action,entity,id,{message:body.numero||body.titre||body.email||body.prenom||entity,method});
        }
      }catch(_){ }
      return result;
    };
    wrapped.__activityWrapped=true;
    window.sbFetch=wrapped;
  }
  function init(){
    brand();addNav();wrapSbFetch();
    setInterval(()=>{brand();addNav();wrapSbFetch();},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  const oldInit=window.initSession;
  if(oldInit&&!oldInit.__activityWrapped){
    window.initSession=function(){const r=oldInit.apply(this,arguments);setTimeout(()=>{brand();addNav();},100);return r;};
    window.initSession.__activityWrapped=true;
  }
  const oldSwitch=window.switchView;
  if(oldSwitch&&!oldSwitch.__activityWrapped){
    window.switchView=function(view,el){const r=oldSwitch.apply(this,arguments);if(view==='activity-log')setTimeout(render,0);return r;};
    window.switchView.__activityWrapped=true;
  }
})();
/* ONOMO Support IT - Journal d'activité administrateur + branding ONOMO */
(function(){
  const TABLE='activity_log';
  const admin=()=>['admin','administrateur'].includes(String(window.currentUser?.role||'').toLowerCase())||Array.isArray(window.currentUser?.roles)&&window.currentUser.roles.some(r=>['admin','administrateur'].includes(String(r).toLowerCase()));
  const esc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const actor=()=>({actor_id:window.currentUser?.auth_user_id||window.currentUser?.id||null,actor_name:[window.currentUser?.prenom,window.currentUser?.nom].filter(Boolean).join(' ')||window.currentUser?.email||'Utilisateur',actor_email:window.currentUser?.email||null});
  async function log(action,entity_type,entity_id,details){
    if(!window.sbOK?.()||!window.currentUser)return;
    const a=actor();
    try{await window.sbFetch(TABLE,{method:'POST',body:JSON.stringify({...a,action,entity_type:entity_type||null,entity_id:entity_id?String(entity_id):null,details:details||{}})});}catch(_){ }
  }
  window.onomoActivityLog=log;
  function brand(){
    const logo='assets/pwa/onomo-logo.svg';
    document.querySelectorAll('.login-logo,.sb-logo').forEach(el=>{
      if(el.querySelector('img[data-onomo-logo]'))return;
      el.innerHTML='<img data-onomo-logo src="'+logo+'" alt="ONOMO" style="display:block;width:auto;height:34px;max-width:180px;object-fit:contain;filter:brightness(0) invert(1)">';
      if(el.classList.contains('login-logo'))el.querySelector('img').style.height='48px';
    });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(l=>{l.href=logo;});
    const manifest=document.querySelector('link[rel="manifest"]');
    if(manifest)manifest.href='manifest.webmanifest';
  }
  function addNav(){
    if(!admin()||document.querySelector('[data-view="activity-log"]'))return;
    let sec=document.getElementById('sbAdminSec');
    if(!sec){
      const candidates=[...document.querySelectorAll('.nav-section,.sidebar-section,.nav-group,.nav-items')];
      sec=candidates.find(el=>/Utilisateurs|Hôtels|Paramètres|Rôles et permissions/i.test(el.textContent||''));
    }
    if(!sec){
      const anchor=document.querySelector('[data-view="users"],[data-view="hotels-admin"],[data-view="settings"],[data-view="roles"]');
      sec=anchor?.parentElement;
    }
    if(!sec)return;
    const item=document.createElement('div');
    item.className='nav-item';
    item.dataset.view='activity-log';
    item.innerHTML='<i class="ti ti-history"></i><span>Journal d’activité</span>';
    item.onclick=function(){window.renderAdminActivity();document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));item.classList.add('active');};
    sec.appendChild(item);
  }
  async function render(){
    if(!admin()){window.showToast?.('Accès non autorisé.','err');return;}
    const main=document.getElementById('mainContent');if(!main)return;
    main.innerHTML='<div class="card"><div class="card-hdr"><div><div class="card-title">Journal d’activité</div><div style="font-size:11px;color:var(--tx3);margin-top:2px">Actions des utilisateurs et événements du système</div></div><button class="btn btn-outline btn-sm" onclick="window.renderAdminActivity()"><i class="ti ti-refresh"></i>Actualiser</button></div><div id="activityList" style="padding:0 18px 18px"><div style="padding:25px;text-align:center;color:var(--tx3)">Chargement...</div></div></div>';
    try{
      const rows=await window.sbFetch(TABLE+'?select=id,actor_name,actor_email,action,entity_type,entity_id,details,created_at&order=created_at.desc&limit=200');
      const list=Array.isArray(rows)?rows:[];
      const box=document.getElementById('activityList');
      if(!list.length){box.innerHTML='<div style="padding:30px;text-align:center;color:var(--tx3)">Aucune activité enregistrée.</div>';return;}
      box.innerHTML=list.map(r=>{const d=r.details&&typeof r.details==='object'?r.details:{};const detail=d.message||d.title||d.description||[r.entity_type,r.entity_id].filter(Boolean).join(' · ');return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);align-items:flex-start"><div style="width:32px;height:32px;border-radius:8px;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex:0 0 auto"><i class="ti ti-history" style="font-size:16px;color:var(--brand)"></i></div><div style="min-width:0;flex:1"><div style="font-size:12px;font-weight:600">'+esc(r.action)+'</div><div style="font-size:11px;color:var(--tx2);margin-top:2px">'+esc(r.actor_name||r.actor_email||'Utilisateur')+(detail?' · '+esc(detail):'')+'</div></div><div style="font-size:10px;color:var(--tx3);white-space:nowrap">'+esc(new Date(r.created_at).toLocaleString('fr-FR'))+'</div></div>';}).join('');
    }catch(e){document.getElementById('activityList').innerHTML='<div style="padding:25px;color:var(--red)">Impossible de charger le journal.</div>';}
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
        if(clean==='tickets'&&['POST','PATCH','PUT','DELETE'].includes(method)&&!String(path).includes(TABLE)){
          let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):(options.body||{});}catch(_){ }
          const id=body.id||body.ticket_id||null;
          const action=method==='POST'?'Création de ticket':method==='DELETE'?'Suppression de ticket':'Modification de ticket';
          log(action,'ticket',id,{message:body.numero||body.titre||'Ticket',method});
        }
        if(clean==='utilisateurs'&&['POST','PATCH','PUT','DELETE'].includes(method)&&!String(path).includes(TABLE)){
          let body={};try{body=typeof options.body==='string'?JSON.parse(options.body):(options.body||{});}catch(_){ }
          const id=body.id||null;
          const action=method==='POST'?'Création utilisateur':method==='DELETE'?'Suppression utilisateur':'Modification utilisateur';
          log(action,'utilisateur',id,{message:body.email||body.prenom||'Utilisateur',method});
        }
      }catch(_){ }
      return result;
    };
    wrapped.__activityWrapped=true;window.sbFetch=wrapped;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    brand();addNav();wrapSbFetch();
    setInterval(()=>{brand();addNav();wrapSbFetch();},1500);
  });
  const oldInit=window.initSession;
  if(oldInit){window.initSession=function(){const r=oldInit.apply(this,arguments);setTimeout(()=>{brand();addNav();},100);return r;};}
  const oldSwitch=window.switchView;
  if(oldSwitch){window.switchView=function(view,el){const r=oldSwitch.apply(this,arguments);if(view==='activity-log')setTimeout(render,0);return r;};}
})();
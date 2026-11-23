/* Error journal (table public.client_errors).
   1. Reporter: uncaught errors, unhandled promise rejections and
      console.error() calls in a signed-in user's browser are sent to the
      journal. Tokens, signatures and e-mail addresses are masked first; the
      same problem is sent once per page load and at most 20 per page load.
      Reporting never reports its own failures.
   2. Administrators get an "Erreurs" page: problems grouped by message, with
      how often, since when, for how many users, and the stack. */
(function(){
 'use strict';
 const L={
  fr:{title:'Journal des erreurs',intro:'Erreurs JavaScript rencontrées dans le navigateur des utilisateurs (30 derniers jours, 500 dernières).',refresh:'Actualiser',clear:'Vider le journal',confirm:'Supprimer toutes les erreurs du journal ?',cleared:'Journal vidé',failed:'Action impossible',none:'Aucune erreur enregistrée. Tout va bien.',loading:'Chargement…',denied:'Réservé aux administrateurs.',times:'fois',users:'utilisateur(s)',last:'Dernière',first:'Première',kinds:{error:'Erreur',rejection:'Promesse rejetée',console:'console.error'},occurrences:'Dernières occurrences',stack:'Pile d’appels'},
  en:{title:'Error journal',intro:'JavaScript errors seen in users’ browsers (last 30 days, latest 500).',refresh:'Refresh',clear:'Clear journal',confirm:'Delete every error in the journal?',cleared:'Journal cleared',failed:'Action failed',none:'No error recorded. All good.',loading:'Loading…',denied:'Administrators only.',times:'times',users:'user(s)',last:'Last',first:'First',kinds:{error:'Error',rejection:'Rejected promise',console:'console.error'},occurrences:'Latest occurrences',stack:'Stack'},
  ar:{title:'سجل الأخطاء',intro:'أخطاء JavaScript في متصفحات المستخدمين (آخر 30 يومًا، آخر 500).',refresh:'تحديث',clear:'إفراغ السجل',confirm:'حذف كل الأخطاء من السجل؟',cleared:'تم إفراغ السجل',failed:'تعذر تنفيذ الإجراء',none:'لا توجد أخطاء مسجلة.',loading:'جارٍ التحميل…',denied:'للمسؤولين فقط.',times:'مرة',users:'مستخدم',last:'آخر',first:'أول',kinds:{error:'خطأ',rejection:'وعد مرفوض',console:'console.error'},occurrences:'آخر الحالات',stack:'مكدس الاستدعاءات'}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);
 const ask=message=>typeof window.confirm==='function'?window.confirm(message):true;
 const clip=(value,max)=>{const s=String(value??'');return s.length>max?s.slice(0,max-1)+'…':s;};

 // Never send secrets or personal addresses.
 function scrub(value){
  return String(value??'')
   .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[jeton]')
   .replace(/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi,'$1 [masqué]')
   .replace(/\bsb_(publishable|secret)_[\w-]+/g,'[clé]')
   .replace(/([?&#](?:sig|token|access_token|refresh_token|apikey|api_key|key|code|password)=)[^&\s"'#]+/gi,'$1[masqué]')
   .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,'[email]');
 }
 const IGNORED=[/ResizeObserver loop/i,/^Script error\.?$/i,/(chrome|moz|safari)-extension:\/\//i,/Trop d.erreurs signalées/i];

 let sent=0,version='';
 const seen=new Set();
 const LIMIT=20;
 try{window.caches?.keys?.().then(keys=>{version=(keys||[]).find(key=>/^onomo-shell-v\d+$/.test(key))||'';}).catch(()=>{});}catch(_){}

 function build(kind,message,extra={}){
  const view=typeof currentView!=='undefined'?String(currentView||''):'';
  return {
   kind,message:clip(scrub(message),500)||'(vide)',
   source:extra.source?clip(scrub(String(extra.source).split('?')[0]),300):null,
   line:Number.isFinite(extra.line)?extra.line:null,col:Number.isFinite(extra.col)?extra.col:null,
   stack:extra.stack?clip(scrub(extra.stack),2000):null,
   page:clip(scrub(`${location.pathname}${location.hash||''}`),300),
   view:clip(view,60)||null,app_version:version||null,
   user_agent:clip(navigator.userAgent||'',300)||null
  };
 }
 function report(kind,message,extra){
  try{
   if(!user()||typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function')return false;
   const raw=String(message??'').trim();
   if(!raw||IGNORED.some(rule=>rule.test(raw)||rule.test(String(extra?.source||''))))return false;
   const key=`${kind}|${raw.slice(0,200)}|${extra?.source||''}|${extra?.line||''}`;
   if(seen.has(key)||sent>=LIMIT)return false;
   seen.add(key);sent++;
   window.sbFetch('client_errors',{method:'POST',prefer:'return=minimal',body:JSON.stringify(build(kind,raw,extra||{}))})
    .catch(()=>{}); // a failed report is dropped, never logged (no loop)
   return true;
  }catch(_){return false;}
 }
 const describe=value=>{
  if(value instanceof Error)return {message:`${value.name}: ${value.message}`,stack:value.stack};
  if(typeof value==='string')return {message:value};
  try{return {message:JSON.stringify(value)};}catch(_){return {message:String(value)};}
 };
 function install(){
  if(window.__onomoErrorJournal)return;window.__onomoErrorJournal=true;
  window.addEventListener('error',event=>{
   if(!event||event.target&&event.target!==window&&!event.message)return; // failed <img>/<script> loads
   report('error',event.message,{source:event.filename,line:event.lineno,col:event.colno,stack:event.error?.stack});
  });
  window.addEventListener('unhandledrejection',event=>{const d=describe(event?.reason);report('rejection',d.message,{stack:d.stack});});
  const original=console.error;
  console.error=function(...args){
   try{
    const error=args.find(arg=>arg instanceof Error);
    const message=args.map(arg=>arg instanceof Error?`${arg.name}: ${arg.message}`:typeof arg==='string'?arg:describe(arg).message).join(' ');
    report('console',message,{stack:error?.stack});
   }catch(_){}
   return original.apply(this,args);
  };
 }

 // ---- Administrator page ----
 let rows=[],loaded=false,openKey=null;
 function isAdmin(who=user()){
  const roles=Array.isArray(who?.roles)?who.roles:[];
  return who?.role==='admin'||roles.includes('Administrateur')||roles.includes('admin');
 }
 const since=()=>new Date(Date.now()-30*86400000).toISOString();
 async function load(){
  try{
   const result=await window.sbFetch(`client_errors?select=id,created_at,user_id,kind,message,source,line,col,stack,page,view,app_version,user_agent&created_at=gte.${encodeURIComponent(since())}&order=created_at.desc&limit=500`);
   rows=Array.isArray(result)?result:[];
  }catch(error){rows=[];toast(text().failed,'err');}
  loaded=true;return rows;
 }
 function groups(list=rows){
  const map=new Map();
  for(const row of list){
   const key=`${row.kind}|${row.message}|${row.source||''}|${row.line||''}`;
   const group=map.get(key)||{key,kind:row.kind,message:row.message,source:row.source,line:row.line,col:row.col,stack:row.stack,count:0,users:new Set(),first:row.created_at,last:row.created_at,items:[]};
   group.count++;group.users.add(row.user_id);
   if(row.created_at<group.first)group.first=row.created_at;
   if(row.created_at>group.last)group.last=row.created_at;
   if(!group.stack&&row.stack)group.stack=row.stack;
   if(group.items.length<5)group.items.push(row);
   map.set(key,group);
  }
  return [...map.values()].sort((a,b)=>String(b.last).localeCompare(String(a.last)));
 }
 const when=value=>{try{return new Date(value).toLocaleString();}catch(_){return String(value||'');}};
 function userName(id){
  const list=typeof DEMO_USERS!=='undefined'&&Array.isArray(DEMO_USERS)?DEMO_USERS:[];
  const found=list.find(item=>String(item.auth_user_id||'')===String(id));
  return found?[found.prenom,found.nom].filter(Boolean).join(' ')||found.email||id:String(id||'').slice(0,8);
 }
 const browser=agent=>{const s=String(agent||'');return /Edg\//.test(s)?'Edge':/Chrome\//.test(s)?'Chrome':/Firefox\//.test(s)?'Firefox':/Safari\//.test(s)?'Safari':'—';};
 function groupHtml(group){
  const t=text(),open=openKey===group.key;
  const where=group.source?`${group.source}${group.line?`:${group.line}`:''}`:'';
  return `<article class="ej-group${open?' open':''}"><button type="button" class="ej-head" aria-expanded="${open}" data-ej-key="${escape(group.key)}" onclick="ErrorJournal.toggle(this.dataset.ejKey)">
   <span class="ej-kind ej-${escape(group.kind)}">${escape(t.kinds[group.kind]||group.kind)}</span>
   <span class="ej-main"><strong>${escape(group.message)}</strong>${where?`<small>${escape(where)}</small>`:''}</span>
   <span class="ej-stats"><b>${group.count}</b> ${escape(t.times)} · ${group.users.size} ${escape(t.users)}<small>${escape(t.last)} : ${escape(when(group.last))}</small></span></button>
   ${open?`<div class="ej-body"><p><small>${escape(t.first)} : ${escape(when(group.first))}</small></p>${group.stack?`<p class="ej-label">${escape(t.stack)}</p><pre>${escape(group.stack)}</pre>`:''}<p class="ej-label">${escape(t.occurrences)}</p><table class="ej-table"><tbody>${group.items.map(row=>`<tr><td>${escape(when(row.created_at))}</td><td>${escape(userName(row.user_id))}</td><td>${escape(row.view||row.page||'')}</td><td>${escape(row.app_version||'')}</td><td>${escape(browser(row.user_agent))}</td></tr>`).join('')}</tbody></table></div>`:''}</article>`;
 }
 function pageHtml(){
  const t=text();
  if(!isAdmin())return `<div class="empty-state"><i class="ti ti-lock"></i><p>${escape(t.denied)}</p></div>`;
  const list=loaded?groups():[];
  const body=!loaded?`<div class="loading-state"><i class="ti ti-loader-2 spin"></i> ${escape(t.loading)}</div>`
   :!list.length?`<div class="empty-state"><i class="ti ti-circle-check"></i><p>${escape(t.none)}</p></div>`
   :list.map(groupHtml).join('');
  return `<div class="ej-page"><div class="ej-top"><p>${escape(t.intro)}</p><div class="ej-actions"><button type="button" class="btn btn-outline btn-sm" onclick="ErrorJournal.refresh()"><i class="ti ti-refresh"></i>${escape(t.refresh)}</button>${rows.length?`<button type="button" class="btn btn-outline btn-sm ej-danger" onclick="ErrorJournal.clear()"><i class="ti ti-trash"></i>${escape(t.clear)}</button>`:''}</div></div><div class="ej-list">${body}</div></div>`;
 }
 function render(){
  const host=document.getElementById('mainContent');if(!host)return;
  host.innerHTML=pageHtml();
  if(isAdmin()&&!loaded)load().then(()=>{if(typeof currentView==='undefined'||currentView==='client-errors')render();});
 }
 async function refresh(){loaded=false;render();}
 function toggle(key){openKey=openKey===key?null:key;render();}
 async function clear(){
  const t=text();if(!ask(t.confirm))return false;
  try{
   await window.sbFetch('client_errors?id=gt.0',{method:'DELETE',prefer:'return=minimal'});
   rows=[];openKey=null;render();toast(t.cleared,'ok');return true;
  }catch(error){toast(t.failed,'err');return false;}
 }

 window.ErrorJournal={install,report,scrub,build,render,refresh,toggle,clear,groups,title:()=>text().title,_setRows:value=>{rows=value;loaded=true;},_reset:()=>{sent=0;seen.clear();}};
 install();
})();

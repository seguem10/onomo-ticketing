/* Planned maintenance (table public.maintenance_plans and the function
   public.run_due_maintenance_plans).
   - "Maintenance planifiée" page for technicians and administrators: the
     recurring tasks of the hotels in their scope, with their next date.
   - When a technician opens the app, the due tasks become tickets created on
     their behalf (once per due date; the database prevents duplicates).
   RLS and the database function enforce the hotel scope. */
(function(){
 'use strict';
 const FREQUENCIES=['weekly','monthly','quarterly','semiannual','yearly'];
 const CATEGORIES=['Maintenance','IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Ménage','Autre'];
 const PRIORITIES=['Basse','Normale','Haute','Urgente','Critique'];
 const L={
  fr:{title:'Maintenance planifiée',intro:'Tâches récurrentes : à chaque échéance, un ticket est créé automatiquement quand un technicien de l’hôtel ouvre l’application.',add:'Nouveau plan',run:'Créer les tickets échus',hotel:'Hôtel',task:'Tâche',details:'Détails (facultatif)',category:'Catégorie',priority:'Priorité',frequency:'Fréquence',next:'Prochaine échéance',active:'Actif',lastTicket:'Dernier ticket',save:'Enregistrer',cancel:'Annuler',edit:'Modifier',remove:'Supprimer',pause:'Mettre en pause',resume:'Réactiver',paused:'En pause',overdue:'Échue',confirm:'Supprimer ce plan ? Les tickets déjà créés sont conservés.',saved:'Plan enregistré',removed:'Plan supprimé',failed:'Action impossible',required:'L’hôtel, la tâche (3 caractères minimum) et la date sont obligatoires',none:'Aucun plan de maintenance pour le moment.',loading:'Chargement…',denied:'Réservé à l’équipe IT.',created:n=>n===1?'1 ticket de maintenance créé':`${n} tickets de maintenance créés`,nothingDue:'Aucune tâche échue.',frequencies:{weekly:'Chaque semaine',monthly:'Chaque mois',quarterly:'Chaque trimestre',semiannual:'Tous les 6 mois',yearly:'Chaque année'}},
  en:{title:'Planned maintenance',intro:'Recurring tasks: on each due date, a ticket is created automatically when a technician of the hotel opens the app.',add:'New plan',run:'Create due tickets',hotel:'Hotel',task:'Task',details:'Details (optional)',category:'Category',priority:'Priority',frequency:'Frequency',next:'Next due date',active:'Active',lastTicket:'Last ticket',save:'Save',cancel:'Cancel',edit:'Edit',remove:'Delete',pause:'Pause',resume:'Resume',paused:'Paused',overdue:'Due',confirm:'Delete this plan? Tickets already created are kept.',saved:'Plan saved',removed:'Plan deleted',failed:'Action failed',required:'Hotel, task (at least 3 characters) and date are required',none:'No maintenance plan yet.',loading:'Loading…',denied:'IT team only.',created:n=>n===1?'1 maintenance ticket created':`${n} maintenance tickets created`,nothingDue:'Nothing is due.',frequencies:{weekly:'Every week',monthly:'Every month',quarterly:'Every quarter',semiannual:'Every 6 months',yearly:'Every year'}},
  ar:{title:'الصيانة المجدولة',intro:'مهام متكررة: عند كل موعد تُنشأ تذكرة تلقائيًا عندما يفتح فني الفندق التطبيق.',add:'خطة جديدة',run:'إنشاء التذاكر المستحقة',hotel:'الفندق',task:'المهمة',details:'تفاصيل (اختياري)',category:'الفئة',priority:'الأولوية',frequency:'التكرار',next:'الموعد القادم',active:'نشطة',lastTicket:'آخر تذكرة',save:'حفظ',cancel:'إلغاء',edit:'تعديل',remove:'حذف',pause:'إيقاف مؤقت',resume:'إعادة التفعيل',paused:'متوقفة',overdue:'مستحقة',confirm:'حذف هذه الخطة؟ تبقى التذاكر المنشأة.',saved:'تم حفظ الخطة',removed:'تم حذف الخطة',failed:'تعذر تنفيذ الإجراء',required:'الفندق والمهمة (3 أحرف على الأقل) والتاريخ مطلوبة',none:'لا توجد خطط صيانة بعد.',loading:'جارٍ التحميل…',denied:'لفريق تقنية المعلومات فقط.',created:n=>`تم إنشاء ${n} تذكرة صيانة`,nothingDue:'لا توجد مهام مستحقة.',frequencies:{weekly:'كل أسبوع',monthly:'كل شهر',quarterly:'كل ثلاثة أشهر',semiannual:'كل 6 أشهر',yearly:'كل سنة'}}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);
 const ask=message=>typeof window.confirm==='function'?window.confirm(message):true;
 const isStaff=(who=user())=>typeof canManageTickets==='function'?!!canManageTickets(who):['admin','it_regional','it_hotel'].includes(who?.role);
 const myHotels=()=>typeof userHotels==='function'?userHotels(user()):[];
 const value=id=>(document.getElementById(id)?.value||'').trim();
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const ticketNumber=id=>{const list=typeof tickets!=='undefined'&&Array.isArray(tickets)?tickets:[];return list.find(t=>String(t.id)===String(id))?.numero||'';};

 let plans=[],loaded=false,loading=null,editing=null,ran=false,templating=null;
 const catalogue=()=>window.MaintenanceTemplates||globalThis.MaintenanceTemplates;
 const TPL={
  fr:{button:'Modèles prêts à l’emploi',title:'Modèles de maintenance',intro:'Cochez les tâches qui concernent l’hôtel. Chacune devient un plan modifiable ; les premières échéances sont espacées d’un jour.',hotel:'Hôtel',start:'À partir du',already:'déjà en place',all:'Tout cocher',none:'Tout décocher',create:n=>`Créer ${n} plan(s)`,created:n=>`${n} plan(s) de maintenance créé(s)`,choose:'Choisissez l’hôtel'},
  en:{button:'Ready-made templates',title:'Maintenance templates',intro:'Tick the tasks that apply to the hotel. Each becomes an editable plan; the first due dates are spread one day apart.',hotel:'Hotel',start:'Starting on',already:'already in place',all:'Tick all',none:'Untick all',create:n=>`Create ${n} plan(s)`,created:n=>`${n} maintenance plan(s) created`,choose:'Choose the hotel'},
  ar:{button:'نماذج جاهزة',title:'نماذج الصيانة',intro:'اختر المهام التي تخص الفندق. تصبح كل مهمة خطة قابلة للتعديل.',hotel:'الفندق',start:'ابتداءً من',already:'موجودة',all:'تحديد الكل',none:'إلغاء التحديد',create:n=>`إنشاء ${n} خطة`,created:n=>`تم إنشاء ${n} خطة صيانة`,choose:'اختر الفندق'}
 };
 const tpl=()=>TPL[document.getElementById('languageSelector-app')?.value]||TPL.fr;

 function load(force){
  if(loading&&!force)return loading;
  if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function'){loaded=true;return Promise.resolve(plans);}
  loading=window.sbFetch('maintenance_plans?select=id,hotel,title,description,category,priority,frequency,next_due,active,last_run_at,last_ticket_id&order=hotel.asc,next_due.asc&limit=1000')
   .then(rows=>{plans=Array.isArray(rows)?rows:[];loaded=true;return plans;})
   .catch(error=>{console.warn('Maintenance planifiée indisponible',error);loaded=true;return plans;})
   .finally(()=>{loading=null;});
  return loading;
 }

 // Turn due plans into tickets, as the signed-in technician; add them to the list.
 async function runDue({quiet=false}={}){
  if(!isStaff()||typeof window.sbFetch!=='function')return [];
  try{
   const created=await window.sbFetch('rpc/run_due_maintenance_plans',{method:'POST',body:'{}'});
   const rows=Array.isArray(created)?created:[];
   if(rows.length){
    const ids=rows.map(row=>row.ticket_id).filter(Boolean);
    try{
     const fresh=await window.sbFetch(`tickets?id=in.(${ids.map(encodeURIComponent).join(',')})`);
     if(Array.isArray(fresh)&&typeof tickets!=='undefined'&&Array.isArray(tickets)){
      const known=new Set(tickets.map(t=>String(t.id)));
      tickets=[...fresh.filter(t=>!known.has(String(t.id))),...tickets];
     }
    }catch(_){}
    toast(text().created(rows.length),'ok');
    await load(true);
    if(typeof renderView==='function')renderView();
   }else if(!quiet)toast(text().nothingDue,'ok');
   return rows;
  }catch(error){console.error('Maintenance planifiée',error);if(!quiet)toast(text().failed,'err');return [];}
 }
 // Once per page load, shortly after sign-in (the authenticated fetch and the
 // ticket list are set up during the first seconds).
 function runOnce(delay=4000){
  if(ran||!isStaff())return Promise.resolve([]);
  ran=true;
  return new Promise(resolve=>setTimeout(()=>resolve(runDue({quiet:true})),delay));
 }

 const options=(list,labels,selected,first)=>`${first!==undefined?`<option value="">${escape(first)}</option>`:''}${list.map(v=>`<option value="${escape(v)}"${v===selected?' selected':''}>${escape(labels?labels[v]||v:v)}</option>`).join('')}`;
 function formHtml(plan){
  const t=text(),hotels=myHotels();
  const hotelList=plan?.hotel&&!hotels.includes(plan.hotel)?[plan.hotel,...hotels]:hotels;
  const field=(id,label,input)=>`<div class="form-g"><label class="field-lbl" for="${id}">${escape(label)}</label>${input}</div>`;
  return `<div class="card mp-form"><div class="mp-grid">
   ${field('mpTitle',t.task+' *',`<input id="mpTitle" class="field-ctrl" maxlength="150" value="${escape(plan?.title||'')}">`)}
   ${field('mpHotel',t.hotel+' *',`<select id="mpHotel" class="field-ctrl">${options(hotelList,null,plan?.hotel||(hotelList.length===1?hotelList[0]:''),hotelList.length===1?undefined:'—')}</select>`)}
   ${field('mpFrequency',t.frequency,`<select id="mpFrequency" class="field-ctrl">${options(FREQUENCIES,t.frequencies,plan?.frequency||'monthly')}</select>`)}
   ${field('mpNext',t.next+' *',`<input id="mpNext" class="field-ctrl" type="date" value="${escape(plan?.next_due||today())}">`)}
   ${field('mpCategory',t.category,`<select id="mpCategory" class="field-ctrl">${options(CATEGORIES,null,plan?.category||'IT / Réseau')}</select>`)}
   ${field('mpPriority',t.priority,`<select id="mpPriority" class="field-ctrl">${options(PRIORITIES,null,plan?.priority||'Normale')}</select>`)}
  </div>${field('mpDescription',t.details,`<textarea id="mpDescription" class="field-ctrl" rows="3" maxlength="2000">${escape(plan?.description||'')}</textarea>`)}
  <label class="mp-check"><input type="checkbox" id="mpActive"${plan?.active===false?'':' checked'}> ${escape(t.active)}</label>
  <div class="mp-actions"><button type="button" class="btn btn-outline btn-sm" onclick="MaintenancePlans.cancel()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="MaintenancePlans.save()"><i class="ti ti-device-floppy"></i>${escape(t.save)}</button></div></div>`;
 }
 function planHtml(plan){
  const t=text(),due=plan.active!==false&&plan.next_due<=today(),num=plan.last_ticket_id?ticketNumber(plan.last_ticket_id):'';
  return `<tr class="${plan.active===false?'mp-paused':''}"><td><strong>${escape(plan.title)}</strong><small>${escape(plan.category)} · ${escape(plan.priority)}</small></td><td>${escape(plan.hotel)}</td><td>${escape(t.frequencies[plan.frequency]||plan.frequency)}</td>
   <td>${plan.active===false?`<span class="mp-badge">${escape(t.paused)}</span>`:`${escape(plan.next_due)}${due?` <span class="mp-badge mp-due">${escape(t.overdue)}</span>`:''}`}</td>
   <td>${num?`<a href="#" data-ticket-id="${escape(plan.last_ticket_id)}" onclick="event.preventDefault();openDetail(this.dataset.ticketId)">${escape(num)}</a>`:'—'}</td>
   <td class="mp-row-actions"><button type="button" title="${escape(plan.active===false?t.resume:t.pause)}" aria-label="${escape(plan.active===false?t.resume:t.pause)}" data-plan-id="${escape(plan.id)}" onclick="MaintenancePlans.toggleActive(this.dataset.planId)"><i class="ti ti-player-${plan.active===false?'play':'pause'}"></i></button><button type="button" title="${escape(t.edit)}" aria-label="${escape(t.edit)}" data-plan-id="${escape(plan.id)}" onclick="MaintenancePlans.edit(this.dataset.planId)"><i class="ti ti-edit"></i></button><button type="button" title="${escape(t.remove)}" aria-label="${escape(t.remove)}" data-plan-id="${escape(plan.id)}" onclick="MaintenancePlans.remove(this.dataset.planId)"><i class="ti ti-trash"></i></button></td></tr>`;
 }
 function pageHtml(){
  const t=text();
  if(!isStaff())return `<div class="empty-state"><i class="ti ti-lock"></i><p>${escape(t.denied)}</p></div>`;
  if(editing)return `<div class="mp-page">${formHtml(editing==='new'?null:plans.find(p=>String(p.id)===String(editing)))}</div>`;
  if(templating)return `<div class="mp-page">${templatesHtml()}</div>`;
  const body=!loaded?`<div class="loading-state"><i class="ti ti-loader-2 spin"></i> ${escape(t.loading)}</div>`
   :!plans.length?`<div class="empty-state"><i class="ti ti-calendar-repeat"></i><p>${escape(t.none)}</p></div>`
   :`<div class="card mp-table-wrap"><table class="mp-table"><thead><tr><th>${escape(t.task)}</th><th>${escape(t.hotel)}</th><th>${escape(t.frequency)}</th><th>${escape(t.next)}</th><th>${escape(t.lastTicket)}</th><th></th></tr></thead><tbody>${plans.map(planHtml).join('')}</tbody></table></div>`;
  return `<div class="mp-page"><div class="mp-top"><p>${escape(t.intro)}</p><div class="mp-actions">${catalogue()?`<button type="button" class="btn btn-outline" onclick="MaintenancePlans.openTemplates()"><i class="ti ti-template"></i>${escape(tpl().button)}</button>`:''}<button type="button" class="btn btn-outline" onclick="MaintenancePlans.runDue()"><i class="ti ti-player-play"></i>${escape(t.run)}</button><button type="button" class="btn btn-gold" onclick="MaintenancePlans.edit('new')"><i class="ti ti-plus"></i>${escape(t.add)}</button></div></div>${body}</div>`;
 }
 function render(){
  const host=document.getElementById('mainContent');if(!host)return;
  host.innerHTML=pageHtml();
  if(isStaff()&&!loaded)load().then(()=>{if(typeof currentView==='undefined'||currentView==='maintenance')render();});
 }
 function edit(id){editing=id||'new';render();document.getElementById('mpTitle')?.focus?.();}
 function cancel(){editing=null;render();}
 const upsert=row=>{plans=[...plans.filter(p=>String(p.id)!==String(row.id)),row].sort((a,b)=>`${a.hotel}|${a.next_due}`.localeCompare(`${b.hotel}|${b.next_due}`));};
 async function save(){
  const t=text();
  const body={title:value('mpTitle').slice(0,150),hotel:value('mpHotel'),frequency:value('mpFrequency'),next_due:value('mpNext'),
   category:value('mpCategory'),priority:value('mpPriority'),description:value('mpDescription').slice(0,2000)||null,active:document.getElementById('mpActive')?.checked!==false};
  if(body.title.length<3||!body.hotel||!/^\d{4}-\d{2}-\d{2}$/.test(body.next_due)){toast(t.required,'err');return false;}
  if(!FREQUENCIES.includes(body.frequency))body.frequency='monthly';
  if(!CATEGORIES.includes(body.category))body.category='IT / Réseau';
  if(!PRIORITIES.includes(body.priority))body.priority='Normale';
  const id=editing==='new'?null:editing;
  try{
   const saved=id
    ?await window.sbFetch(`maintenance_plans?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)})
    :await window.sbFetch('maintenance_plans',{method:'POST',body:JSON.stringify(body)});
   const row=Array.isArray(saved)&&saved[0];if(!row)throw new Error('Aucune ligne enregistrée');
   upsert(row);editing=null;render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Maintenance planifiée',error);toast(t.failed,'err');return false;}
 }
 async function toggleActive(id){
  const t=text(),plan=plans.find(p=>String(p.id)===String(id));if(!plan)return false;
  try{
   const saved=await window.sbFetch(`maintenance_plans?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({active:plan.active===false})});
   const row=Array.isArray(saved)&&saved[0];if(!row)throw new Error('Modification refusée');
   upsert(row);render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Maintenance planifiée',error);toast(t.failed,'err');return false;}
 }
 async function remove(id){
  const t=text();if(!ask(t.confirm))return false;
  try{
   const gone=await window.sbFetch(`maintenance_plans?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
   if(!Array.isArray(gone)||!gone.length)throw new Error('Suppression refusée');
   plans=plans.filter(p=>String(p.id)!==String(id));render();toast(t.removed,'ok');return true;
  }catch(error){console.error('Maintenance planifiée',error);toast(t.failed,'err');return false;}
 }

 // ---- Ready-made templates ----
 const frequencyLabel=f=>text().frequencies[f]||f;
 function templatesHtml(){
  const t=text(),k=tpl(),cat=catalogue(),hotels=myHotels();
  const taken=new Set(plans.filter(p=>p.hotel===templating.hotel).map(p=>String(p.title).trim().toLowerCase()));
  const count=cat.build([...templating.selected],templating.hotel,templating.start,plans).length;
  const groups=Object.entries(cat.GROUPS).map(([group,label])=>{
   const items=cat.TEMPLATES.filter(x=>x.group===group);
   return `<fieldset class="mp-tpl-group"><legend>${escape(label)} <button type="button" class="mp-link" data-group="${escape(group)}" onclick="MaintenancePlans.selectGroup(this.dataset.group,true)">${escape(k.all)}</button> · <button type="button" class="mp-link" data-group="${escape(group)}" onclick="MaintenancePlans.selectGroup(this.dataset.group,false)">${escape(k.none)}</button></legend>
    ${items.map(x=>{const done=templating.hotel&&taken.has(x.title.toLowerCase());return `<label class="mp-tpl${done?' done':''}"><input type="checkbox" data-key="${escape(x.key)}" onchange="MaintenancePlans.toggleTemplate(this.dataset.key)"${templating.selected.has(x.key)&&!done?' checked':''}${done?' disabled':''}><span><strong>${escape(x.title)}</strong><small>${escape(frequencyLabel(x.frequency))} · ${escape(x.priority)}${done?` · ${escape(k.already)}`:''}</small><em>${escape(x.description)}</em></span></label>`;}).join('')}</fieldset>`;
  }).join('');
  return `<div class="card mp-form"><h3 class="mp-tpl-title"><i class="ti ti-template"></i> ${escape(k.title)}</h3><p class="mp-tpl-intro">${escape(k.intro)}</p>
   <div class="mp-grid"><div class="form-g"><label class="field-lbl" for="mpTplHotel">${escape(k.hotel)}</label><select id="mpTplHotel" class="field-ctrl" onchange="MaintenancePlans.setTemplateField('hotel',this.value)"><option value="">${escape(k.choose)}</option>${hotels.map(h=>`<option value="${escape(h)}"${h===templating.hotel?' selected':''}>${escape(h)}</option>`).join('')}</select></div>
   <div class="form-g"><label class="field-lbl" for="mpTplStart">${escape(k.start)}</label><input id="mpTplStart" type="date" class="field-ctrl" value="${escape(templating.start)}" onchange="MaintenancePlans.setTemplateField('start',this.value)"></div></div>
   ${groups}
   <div class="mp-actions"><button type="button" class="btn btn-outline btn-sm" onclick="MaintenancePlans.closeTemplates()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="MaintenancePlans.applyTemplates()"${!templating.hotel||!count||templating.busy?' disabled':''}><i class="ti ti-check"></i>${escape(k.create(count))}</button></div></div>`;
 }
 function openTemplates(){
  if(!catalogue())return;
  const hotels=myHotels();
  templating={hotel:hotels.length===1?hotels[0]:'',start:today(),selected:new Set(catalogue().TEMPLATES.filter(x=>x.group==='it').map(x=>x.key)),busy:false};
  render();
  if(!loaded)load().then(()=>{if(templating)render();});
 }
 function closeTemplates(){templating=null;render();}
 function setTemplateField(key,val){if(!templating)return;templating[key]=String(val||'');if(key==='start'&&!/^\d{4}-\d{2}-\d{2}$/.test(templating.start))templating.start=today();render();}
 function toggleTemplate(key){if(!templating)return;if(templating.selected.has(key))templating.selected.delete(key);else templating.selected.add(key);render();}
 function selectGroup(group,on){if(!templating)return;for(const x of catalogue().TEMPLATES.filter(x=>x.group===group)){if(on)templating.selected.add(x.key);else templating.selected.delete(x.key);}render();}
 async function applyTemplates(){
  const t=text();if(!templating?.hotel)return false;
  const rows=catalogue().build([...templating.selected],templating.hotel,templating.start,plans);
  if(!rows.length)return false;
  templating.busy=true;render();
  try{
   const saved=await window.sbFetch('maintenance_plans',{method:'POST',body:JSON.stringify(rows)});
   if(!Array.isArray(saved)||saved.length!==rows.length)throw new Error('Création refusée');
   saved.forEach(upsert);templating=null;render();toast(tpl().created(saved.length),'ok');return true;
  }catch(error){console.error('Maintenance planifiée',error);if(templating)templating.busy=false;render();toast(t.failed,'err');return false;}
 }

 window.MaintenancePlans={load,render,runDue,runOnce,edit,cancel,save,toggleActive,remove,openTemplates,closeTemplates,setTemplateField,toggleTemplate,selectGroup,applyTemplates,title:()=>text().title,_set:value=>{plans=value;loaded=true;},_templating:()=>templating};
})();

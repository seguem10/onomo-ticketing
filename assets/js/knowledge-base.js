/* Knowledge base (table public.kb_articles).
   - "Base de connaissances" page: everyone searches and reads published
     articles; technicians and administrators also write, publish, unpublish
     and delete them, and see drafts.
   - New ticket form: while the subject is typed, up to three matching
     articles are suggested so a requester can fix common problems alone.
   RLS enforces who may read drafts and who may write. */
(function(){
 'use strict';
 const L={
  fr:{title:'Base de connaissances',intro:'Solutions aux problèmes courants. Essayez-les avant de créer un ticket.',search:'Rechercher une solution…',all:'Toutes',add:'Nouvelle fiche',edit:'Modifier',remove:'Supprimer',publish:'Publier',unpublish:'Dépublier',draft:'Brouillon',fTitle:'Titre',fCategory:'Catégorie',fBody:'Contenu (une étape par ligne)',fPublished:'Publiée (visible par tous)',fTitleEn:'Titre en anglais (facultatif)',fBodyEn:'Contenu en anglais (facultatif)',related:'Fiches de la base de connaissances',save:'Enregistrer',cancel:'Annuler',none:'Aucune fiche pour le moment.',noMatch:'Aucune fiche ne correspond à votre recherche.',confirm:'Supprimer cette fiche ?',saved:'Fiche enregistrée',removed:'Fiche supprimée',failed:'Action impossible',required:'Le titre (3 caractères minimum) et le contenu sont obligatoires',loading:'Chargement…',suggest:'Ces fiches peuvent résoudre votre problème :',stillTicket:'Toujours bloqué ? Continuez la création du ticket.',updated:'Mise à jour'},
  en:{title:'Knowledge base',intro:'Solutions to common problems. Try them before creating a ticket.',search:'Search a solution…',all:'All',add:'New article',edit:'Edit',remove:'Delete',publish:'Publish',unpublish:'Unpublish',draft:'Draft',fTitle:'Title',fCategory:'Category',fBody:'Content (one step per line)',fPublished:'Published (visible to everyone)',fTitleEn:'English title (optional)',fBodyEn:'English content (optional)',related:'Knowledge base articles',save:'Save',cancel:'Cancel',none:'No article yet.',noMatch:'No article matches your search.',confirm:'Delete this article?',saved:'Article saved',removed:'Article deleted',failed:'Action failed',required:'Title (at least 3 characters) and content are required',loading:'Loading…',suggest:'These articles may solve your problem:',stillTicket:'Still stuck? Carry on creating the ticket.',updated:'Updated'},
  ar:{title:'قاعدة المعرفة',intro:'حلول للمشاكل الشائعة. جرّبها قبل إنشاء تذكرة.',search:'ابحث عن حل…',all:'الكل',add:'مقالة جديدة',edit:'تعديل',remove:'حذف',publish:'نشر',unpublish:'إلغاء النشر',draft:'مسودة',fTitle:'العنوان',fCategory:'الفئة',fBody:'المحتوى (خطوة في كل سطر)',fPublished:'منشورة (مرئية للجميع)',fTitleEn:'العنوان بالإنجليزية (اختياري)',fBodyEn:'المحتوى بالإنجليزية (اختياري)',related:'مقالات قاعدة المعرفة',save:'حفظ',cancel:'إلغاء',none:'لا توجد مقالات بعد.',noMatch:'لا توجد مقالة مطابقة لبحثك.',confirm:'حذف هذه المقالة؟',saved:'تم حفظ المقالة',removed:'تم حذف المقالة',failed:'تعذر تنفيذ الإجراء',required:'العنوان (3 أحرف على الأقل) والمحتوى مطلوبان',loading:'جارٍ التحميل…',suggest:'قد تحل هذه المقالات مشكلتك:',stillTicket:'ما زالت المشكلة قائمة؟ تابع إنشاء التذكرة.',updated:'تحديث'}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);
 const ask=message=>typeof window.confirm==='function'?window.confirm(message):true;
 function isStaff(who=user()){
  if(typeof canManageTickets==='function')return !!canManageTickets(who);
  return ['admin','it_regional','it_hotel'].includes(who?.role);
 }

 let rows=[],loaded=false,loading=null,query='',category='',openId=null,editing=null;

 function load(force){
  if(loading&&!force)return loading;
  if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function'){loaded=true;return Promise.resolve(rows);}
  loading=window.sbFetch('kb_articles?select=id,title,body,title_en,body_en,category,published,updated_at&order=title.asc&limit=1000')
   .then(result=>{rows=Array.isArray(result)?result:[];loaded=true;return rows;})
   .catch(error=>{console.warn('Base de connaissances indisponible',error);loaded=true;return rows;})
   .finally(()=>{loading=null;});
  return loading;
 }

 // French is the reference text; the English version is shown when the app is
 // in English and the article has one.
 const english=()=>document.getElementById('languageSelector-app')?.value==='en';
 const titleOf=row=>english()&&row.title_en?row.title_en:row.title;
 const bodyOf=row=>english()&&row.body_en?row.body_en:row.body;
 // Categories are stored in French (they are also the filter values) and
 // shown in the page's language; an unknown category is shown as typed.
 const CATEGORY_LABELS={
  en:{'accès':'Access','caisse':'POS','logiciels':'Software','matériel':'Hardware','messagerie':'E-mail','réseau':'Network','sécurité':'Security','serrures':'Door locks','téléphonie':'Telephony','général':'General','guide':'Guide','opera cloud':'Opera Cloud','sage 1000':'Sage 1000','citrix':'Citrix'},
  ar:{'accès':'الوصول','caisse':'نقطة البيع','logiciels':'البرمجيات','matériel':'العتاد','messagerie':'البريد الإلكتروني','réseau':'الشبكة','sécurité':'الأمان','serrures':'الأقفال','téléphonie':'الهاتف','général':'عام','guide':'دليل'}
 };
 const categoryLabel=value=>{const lang=document.getElementById('languageSelector-app')?.value;return CATEGORY_LABELS[lang]?.[String(value||'').trim().toLowerCase()]||value||'';};
 // Accent- and case-insensitive word search in both languages; the title weighs more.
 const STOP=new Set(['les','des','une','est','pas','sur','dans','pour','avec','que','qui','mon','mes','ma','plus','the','and','not','my','is','ne','je','il','elle','de','du','la','le','un','et']);
 // "Wi-Fi", "wi fi" and "wifi" must meet: hyphenated words are joined.
 const normalize=value=>String(value??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/([a-z0-9])-(?=[a-z0-9])/g,'$1').replace(/\bwi fi\b/g,'wifi');
 const words=value=>normalize(value).split(/[^a-z0-9]+/).filter(word=>word.length>=3&&!STOP.has(word));
 function score(row,terms){
  const title=normalize(`${row.title} ${row.title_en||''}`),body=normalize(`${row.category} ${row.body} ${row.body_en||''}`);
  return terms.reduce((sum,term)=>sum+(title.includes(term)?3:0)+(body.includes(term)?1:0),0);
 }
 // The shared problem search engine (synonyms, word roots, typos, coverage)
 // when it is loaded; the simple word search otherwise.
 const engine=()=>window.ProblemSearch||globalThis.ProblemSearch;
 const fieldsOf=row=>({title:`${row.title} ${row.title_en||''}`,body:`${row.category||''} ${row.body} ${row.body_en||''}`});
 const mark=(text,value)=>engine()&&String(value||'').trim()?engine().highlight(escape(text),value):escape(text);
 function search(value,list=rows){
  if(engine())return engine().rank(value,list,fieldsOf);
  const terms=words(value);
  if(!terms.length)return list.slice();
  return list.map(row=>({row,s:score(row,terms)})).filter(item=>item.s>0).sort((a,b)=>b.s-a.s||String(a.row.title).localeCompare(String(b.row.title))).map(item=>item.row);
 }
 const visible=()=>isStaff()?rows:rows.filter(row=>row.published!==false);
 const categories=()=>[...new Set(visible().map(row=>row.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));

 // Plain text with line breaks; https links become clickable.
 function bodyHtml(body){
  return escape(body).replace(/https:\/\/[^\s<]+/g,url=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`).replace(/\n/g,'<br>');
 }
 function articleHtml(row){
  const t=text(),open=String(openId)===String(row.id);
  const staffActions=isStaff()?`<div class="kb-actions"><button type="button" class="btn btn-outline btn-sm" data-kb-id="${escape(row.id)}" onclick="KnowledgeBase.edit(this.dataset.kbId)"><i class="ti ti-edit"></i>${escape(t.edit)}</button><button type="button" class="btn btn-outline btn-sm" data-kb-id="${escape(row.id)}" onclick="KnowledgeBase.togglePublished(this.dataset.kbId)"><i class="ti ti-${row.published===false?'eye':'eye-off'}"></i>${escape(row.published===false?t.publish:t.unpublish)}</button><button type="button" class="btn btn-outline btn-sm kb-danger" data-kb-id="${escape(row.id)}" onclick="KnowledgeBase.remove(this.dataset.kbId)"><i class="ti ti-trash"></i>${escape(t.remove)}</button></div>`:'';
  return `<article class="kb-article${open?' open':''}"><button type="button" class="kb-head" aria-expanded="${open}" data-kb-id="${escape(row.id)}" onclick="KnowledgeBase.toggle(this.dataset.kbId)"><span class="kb-cat">${escape(categoryLabel(row.category))}</span><strong>${mark(titleOf(row),query)}</strong>${row.published===false?`<span class="kb-draft">${escape(t.draft)}</span>`:''}<i class="ti ti-chevron-down"></i></button>${open?`<div class="kb-body">${bodyHtml(bodyOf(row))}${staffActions}</div>`:''}</article>`;
 }
 function formHtml(row){
  const t=text(),cats=categories();
  return `<div class="card kb-form"><div class="form-g"><label class="field-lbl" for="kbTitle">${escape(t.fTitle)}</label><input id="kbTitle" class="field-ctrl" maxlength="150" value="${escape(row?.title||'')}"></div>
   <div class="form-g"><label class="field-lbl" for="kbCategory">${escape(t.fCategory)}</label><input id="kbCategory" class="field-ctrl" maxlength="60" list="kbCategories" value="${escape(row?.category||'Général')}"><datalist id="kbCategories">${cats.map(c=>`<option value="${escape(c)}">`).join('')}</datalist></div>
   <div class="form-g"><label class="field-lbl" for="kbBody">${escape(t.fBody)}</label><textarea id="kbBody" class="field-ctrl" rows="8" maxlength="8000">${escape(row?.body||'')}</textarea></div>
   <div class="form-g"><label class="field-lbl" for="kbTitleEn">${escape(t.fTitleEn)}</label><input id="kbTitleEn" class="field-ctrl" maxlength="150" value="${escape(row?.title_en||'')}"></div>
   <div class="form-g"><label class="field-lbl" for="kbBodyEn">${escape(t.fBodyEn)}</label><textarea id="kbBodyEn" class="field-ctrl" rows="6" maxlength="8000">${escape(row?.body_en||'')}</textarea></div>
   <label class="kb-check"><input type="checkbox" id="kbPublished"${row?.published===false?'':' checked'}> ${escape(t.fPublished)}</label>
   <div class="kb-actions"><button type="button" class="btn btn-outline btn-sm" onclick="KnowledgeBase.cancel()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="KnowledgeBase.save()"><i class="ti ti-device-floppy"></i>${escape(t.save)}</button></div></div>`;
 }
 function listHtml(){
  const t=text();
  if(!loaded)return `<div class="loading-state"><i class="ti ti-loader-2 spin"></i> ${escape(t.loading)}</div>`;
  const base=visible();
  if(!base.length)return `<div class="empty-state"><i class="ti ti-book"></i><p>${escape(t.none)}</p></div>`;
  const list=search(query,category?base.filter(row=>row.category===category):base);
  if(!list.length)return `<div class="empty-state"><i class="ti ti-search"></i><p>${escape(t.noMatch)}</p></div>`;
  return list.map(articleHtml).join('');
 }
 function pageHtml(){
  const t=text(),cats=categories();
  const chips=[['',t.all],...cats.map(c=>[c,categoryLabel(c)])].map(([value,label])=>`<button type="button" class="kb-chip${category===value?' active':''}" data-kb-category="${escape(value)}" onclick="KnowledgeBase.filter(this.dataset.kbCategory)">${escape(label)}</button>`).join('');
  return `<div class="kb-page"><div class="kb-top"><div><p class="kb-intro">${escape(t.intro)}</p></div>${isStaff()&&!editing?`<button type="button" class="btn btn-gold" onclick="KnowledgeBase.edit('new')"><i class="ti ti-plus"></i>${escape(t.add)}</button>`:''}</div>
   ${editing?formHtml(editing==='new'?null:rows.find(row=>String(row.id)===String(editing))):`<div class="kb-search"><i class="ti ti-search"></i><input id="kbSearch" type="search" class="field-ctrl" placeholder="${escape(t.search)}" value="${escape(query)}" oninput="KnowledgeBase.search(this.value)"></div><div class="kb-chips">${chips}</div><div id="kbList" class="kb-list">${listHtml()}</div>`}</div>`;
 }
 function target(){return document.getElementById('mainContent');}
 function render(){
  const host=target();if(!host)return;
  host.innerHTML=pageHtml();
  if(!loaded)load().then(()=>{if(typeof currentView==='undefined'||currentView==='knowledge')render();});
 }
 function renderList(){const list=document.getElementById('kbList');if(list)list.innerHTML=listHtml();else render();}
 function setQuery(value){query=String(value||'');renderList();}
 function filter(value){category=String(value||'');render();}
 function toggle(id){openId=String(openId)===String(id)?null:id;renderList();}
 function edit(id){editing=id||'new';render();document.getElementById('kbTitle')?.focus?.();}
 function cancel(){editing=null;render();}
 function upsertRow(row){rows=[...rows.filter(item=>String(item.id)!==String(row.id)),row].sort((a,b)=>String(a.title).localeCompare(String(b.title)));}
 async function save(){
  const t=text();
  const title=(document.getElementById('kbTitle')?.value||'').trim().slice(0,150);
  const titleEn=(document.getElementById('kbTitleEn')?.value||'').trim().slice(0,150);
  const bodyEn=(document.getElementById('kbBodyEn')?.value||'').trim().slice(0,8000);
  const title_en=titleEn.length>=3?titleEn:null,body_en=bodyEn||null;
  const category=(document.getElementById('kbCategory')?.value||'').trim().slice(0,60)||'Général';
  const body=(document.getElementById('kbBody')?.value||'').trim().slice(0,8000);
  const published=document.getElementById('kbPublished')?.checked!==false;
  if(title.length<3||!body){toast(t.required,'err');return false;}
  const id=editing==='new'?null:editing;
  try{
   const saved=id
    ?await window.sbFetch(`kb_articles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({title,category,body,title_en,body_en,published})})
    :await window.sbFetch('kb_articles',{method:'POST',body:JSON.stringify({title,category,body,title_en,body_en,published})});
   const row=Array.isArray(saved)&&saved[0];
   if(!row)throw new Error('Aucune ligne enregistrée');
   upsertRow(row);editing=null;openId=row.id;render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Base de connaissances',error);toast(t.failed,'err');return false;}
 }
 async function togglePublished(id){
  const t=text(),row=rows.find(item=>String(item.id)===String(id));if(!row)return false;
  try{
   const saved=await window.sbFetch(`kb_articles?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({published:row.published===false})});
   const updated=Array.isArray(saved)&&saved[0];if(!updated)throw new Error('Modification refusée');
   upsertRow(updated);renderList();toast(t.saved,'ok');return true;
  }catch(error){console.error('Base de connaissances',error);toast(t.failed,'err');return false;}
 }
 async function remove(id){
  const t=text();if(!ask(t.confirm))return false;
  try{
   // RLS silently skips rows the user may not delete: an empty answer is a refusal.
   const gone=await window.sbFetch(`kb_articles?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
   if(!Array.isArray(gone)||!gone.length)throw new Error('Suppression refusée');
   rows=rows.filter(item=>String(item.id)!==String(id));if(String(openId)===String(id))openId=null;renderList();toast(t.removed,'ok');return true;
  }catch(error){console.error('Base de connaissances',error);toast(t.failed,'err');return false;}
 }

 // New ticket form: suggest published articles that match the subject.
 let suggestOpen=null;
 function suggestHtml(value){
  const t=text();
  const terms=words(value);if(!terms.length)return '';
  const matches=search(value,rows.filter(row=>row.published!==false)).slice(0,3);
  if(!matches.length)return '';
  return `<div class="kb-suggest"><p><i class="ti ti-bulb"></i> ${escape(t.suggest)}</p>${matches.map(row=>{const open=String(suggestOpen)===String(row.id);return `<div class="kb-suggest-item"><button type="button" aria-expanded="${open}" data-kb-id="${escape(row.id)}" onclick="KnowledgeBase.toggleSuggestion(this.dataset.kbId)"><i class="ti ti-book"></i> ${mark(titleOf(row),lastSubject)}</button>${open?`<div class="kb-body">${bodyHtml(bodyOf(row))}<small>${escape(t.stillTicket)}</small></div>`:''}</div>`;}).join('')}</div>`;
 }
 let lastSubject='';
 function suggest(value){
  lastSubject=String(value||'');
  const host=document.getElementById('kbSuggest');if(!host)return;
  if(!loaded){load().then(()=>{if(lastSubject===String(value||''))suggest(value);});return;}
  host.innerHTML=suggestHtml(lastSubject);
 }
 function toggleSuggestion(id){suggestOpen=String(suggestOpen)===String(id)?null:id;suggest(lastSubject);}
 function resetSuggestions(){suggestOpen=null;lastSubject='';const host=document.getElementById('kbSuggest');if(host)host.innerHTML='';}

 // For the IT assistant: published articles related to a question, in the
 // current language, and a way to open one in the knowledge base page.
 // categories: those of the IT assistant's domain; their articles come first.
 function related(value,limit=3,categories){
  if(!words(value).length)return [];
  const found=search(value,rows.filter(row=>row.published!==false));
  const wanted=new Set((categories||[]).map(c=>String(c).toLowerCase()));
  const ordered=wanted.size?[...found.filter(row=>wanted.has(String(row.category||'').toLowerCase())),...found.filter(row=>!wanted.has(String(row.category||'').toLowerCase()))]:found;
  return ordered.slice(0,limit).map(row=>({id:row.id,title:titleOf(row),category:categoryLabel(row.category)}));
 }
 function open(id){
  openId=id;query='';category='';editing=null;
  if(typeof switchView==='function')switchView('knowledge',document.querySelector('[data-view="knowledge"]'));else render();
 }

 window.KnowledgeBase={load,render,search:setQuery,find:search,related,open,filter,toggle,edit,cancel,save,togglePublished,remove,suggest,toggleSuggestion,resetSuggestions,title:()=>text().title,relatedTitle:()=>text().related,_setRows:value=>{rows=value;loaded=true;},_words:words};
})();

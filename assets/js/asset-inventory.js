/* Hardware inventory (tables public.assets and public.ticket_assets).
   - "Inventaire" page for technicians and administrators: equipment of the
     hotels in their scope, organised like the hotels' inventory workbook
     (IT, mechanical, electrical, plumbing, fire safety, elevators, kitchen,
     architecture), with filters, add/edit/delete, quantities, warranty
     dates, and how many tickets concerned each item (the 90-day count shows
     what breaks down often).
   - Import of the inventory workbook (.xlsx) with a preview; rows already in
     the inventory are skipped (see inventory-import.js).
   - Ticket page (technicians): link the ticket to the equipment concerned.
   RLS enforces the hotel scope; this file only decides what to show. */
(function(){
 'use strict';
 const TYPES=['pc','laptop','monitor','tablet','printer','network','wifi','server','ups','phone','camera','access','tv','pos','other'];
 const STATUSES=['in_service','repair','retired'];
 const DOMAINS=['it','mechanical','electrical','plumbing','fire','elevator','kitchen','architecture','other'];
 const L={
  fr:{title:'Inventaire',intro:'Équipements des hôtels de votre périmètre et tickets associés.',add:'Nouvel équipement',importBtn:'Importer un fichier Excel',search:'Rechercher (nom, modèle, n° de série, emplacement)…',allHotels:'Tous les hôtels',items:n=>n===1?'1 équipement':`${n} équipements`,repairCount:n=>`${n} en réparation`,expiredCount:n=>n===1?'1 garantie expirée':`${n} garanties expirées`,onlyHotel:'Voir uniquement cet hôtel',allDomains:'Tous les domaines',allTypes:'Tous les types',allStatuses:'Tous les statuts',name:'Nom',domain:'Domaine',type:'Type',subtype:'Type d’équipement (libre)',hotel:'Hôtel',location:'Emplacement',model:'Marque / modèle',serial:'N° de série',quantity:'Quantité',qty:'Qté',documents:'Documents fournis',status:'Statut',purchased:'Achat',warranty:'Garantie jusqu’au',notes:'Notes',incidents:'Tickets',incidents90:'sur 90 j',actions:'Actions',edit:'Modifier',remove:'Supprimer',save:'Enregistrer',cancel:'Annuler',confirm:'Supprimer cet équipement ? Ses liens avec les tickets seront retirés.',saved:'Équipement enregistré',removed:'Équipement supprimé',failed:'Action impossible',required:'Le nom et l’hôtel sont obligatoires',none:'Aucun équipement enregistré pour le moment. Importez le fichier d’inventaire de l’hôtel ou ajoutez un équipement.',noMatch:'Aucun équipement ne correspond aux filtres.',loading:'Chargement…',denied:'Réservé à l’équipe IT.',top:'Les plus souvent en panne (90 jours)',expired:'Garantie expirée',soon:'Garantie expire bientôt',ticketBlock:'Équipement concerné',link:'Lier',choose:'Choisir un équipement…',unlink:'Retirer',linked:'Équipement lié au ticket',unlinked:'Lien retiré',noAsset:'Aucun équipement enregistré pour cet hôtel.',
   impTitle:'Import du fichier d’inventaire',impReading:'Lecture du fichier…',impHotel:'Hôtel concerné',impChooseHotel:'Choisissez l’hôtel',impTabs:'Onglets à importer',impLines:'lignes',impUnits:'unités',impSummary:(n,s)=>`${n} équipement(s) à ajouter · ${s} déjà présent(s), ignoré(s)`,impPreview:'Aperçu (30 premiers)',impGo:n=>`Importer ${n} équipement(s)`,impDone:n=>`${n} équipement(s) importé(s)`,impNothing:'Rien de nouveau à importer.',impEmpty:'Aucun onglet reconnu dans ce fichier (modèle « Inventaire Materiels IT »).',impError:'Fichier illisible',
   types:{pc:'PC fixe',laptop:'Portable',monitor:'Écran',tablet:'Tablette',printer:'Imprimante / fax',network:'Réseau (switch, routeur, pare-feu)',wifi:'Borne Wi-Fi',server:'Serveur / NAS',ups:'Onduleur',phone:'Téléphonie / PABX',camera:'Caméra / NVR',access:'Contrôle d’accès / encodeur',tv:'TV / affichage',pos:'Caisse / TPE',other:'Autre'},
   domains:{it:'Informatique',mechanical:'Mécanique',electrical:'Électrique',plumbing:'Plomberie',fire:'Sécurité incendie',elevator:'Ascenseurs',kitchen:'Cuisine',architecture:'Architecture',other:'Autre'},
   statuses:{in_service:'En service',repair:'En réparation',retired:'Retiré'}},
  en:{title:'Inventory',intro:'Equipment of the hotels in your scope and related tickets.',add:'New equipment',importBtn:'Import an Excel file',search:'Search (name, model, serial, location)…',allHotels:'All hotels',items:n=>n===1?'1 item':`${n} items`,repairCount:n=>`${n} in repair`,expiredCount:n=>n===1?'1 warranty expired':`${n} warranties expired`,onlyHotel:'Show this hotel only',allDomains:'All domains',allTypes:'All types',allStatuses:'All statuses',name:'Name',domain:'Domain',type:'Type',subtype:'Equipment type (free text)',hotel:'Hotel',location:'Location',model:'Brand / model',serial:'Serial number',quantity:'Quantity',qty:'Qty',documents:'Documents provided',status:'Status',purchased:'Purchased',warranty:'Warranty until',notes:'Notes',incidents:'Tickets',incidents90:'in 90 d',actions:'Actions',edit:'Edit',remove:'Delete',save:'Save',cancel:'Cancel',confirm:'Delete this equipment? Its links to tickets will be removed.',saved:'Equipment saved',removed:'Equipment deleted',failed:'Action failed',required:'Name and hotel are required',none:'No equipment recorded yet. Import the hotel’s inventory file or add equipment.',noMatch:'No equipment matches the filters.',loading:'Loading…',denied:'IT team only.',top:'Most frequent breakdowns (90 days)',expired:'Warranty expired',soon:'Warranty ends soon',ticketBlock:'Equipment concerned',link:'Link',choose:'Choose equipment…',unlink:'Remove',linked:'Equipment linked to the ticket',unlinked:'Link removed',noAsset:'No equipment recorded for this hotel.',
   impTitle:'Inventory file import',impReading:'Reading the file…',impHotel:'Hotel',impChooseHotel:'Choose the hotel',impTabs:'Tabs to import',impLines:'rows',impUnits:'units',impSummary:(n,s)=>`${n} item(s) to add · ${s} already recorded, skipped`,impPreview:'Preview (first 30)',impGo:n=>`Import ${n} item(s)`,impDone:n=>`${n} item(s) imported`,impNothing:'Nothing new to import.',impEmpty:'No recognised tab in this file (“Inventaire Materiels IT” template).',impError:'Unreadable file',
   types:{pc:'Desktop PC',laptop:'Laptop',monitor:'Monitor',tablet:'Tablet',printer:'Printer / fax',network:'Network (switch, router, firewall)',wifi:'Wi-Fi access point',server:'Server / NAS',ups:'UPS',phone:'Telephony / PABX',camera:'Camera / NVR',access:'Access control / encoder',tv:'TV / display',pos:'Till / card terminal',other:'Other'},
   domains:{it:'IT',mechanical:'Mechanical',electrical:'Electrical',plumbing:'Plumbing',fire:'Fire safety',elevator:'Elevators',kitchen:'Kitchen',architecture:'Architecture',other:'Other'},
   statuses:{in_service:'In service',repair:'Under repair',retired:'Retired'}},
  ar:{title:'الجرد',intro:'معدات الفنادق ضمن نطاقك والتذاكر المرتبطة بها.',add:'معدة جديدة',importBtn:'استيراد ملف Excel',search:'بحث (الاسم، الطراز، الرقم التسلسلي، الموقع)…',allHotels:'كل الفنادق',items:n=>`${n} معدات`,repairCount:n=>`${n} قيد الإصلاح`,expiredCount:n=>`${n} ضمان منتهٍ`,onlyHotel:'عرض هذا الفندق فقط',allDomains:'كل المجالات',allTypes:'كل الأنواع',allStatuses:'كل الحالات',name:'الاسم',domain:'المجال',type:'النوع',subtype:'نوع المعدة (حر)',hotel:'الفندق',location:'الموقع',model:'العلامة / الطراز',serial:'الرقم التسلسلي',quantity:'الكمية',qty:'الكمية',documents:'الوثائق المقدمة',status:'الحالة',purchased:'الشراء',warranty:'الضمان حتى',notes:'ملاحظات',incidents:'التذاكر',incidents90:'خلال 90 يومًا',actions:'إجراءات',edit:'تعديل',remove:'حذف',save:'حفظ',cancel:'إلغاء',confirm:'حذف هذه المعدة؟ ستُزال روابطها بالتذاكر.',saved:'تم حفظ المعدة',removed:'تم حذف المعدة',failed:'تعذر تنفيذ الإجراء',required:'الاسم والفندق مطلوبان',none:'لا توجد معدات مسجلة بعد. استورد ملف جرد الفندق أو أضف معدة.',noMatch:'لا توجد معدات مطابقة.',loading:'جارٍ التحميل…',denied:'لفريق تقنية المعلومات فقط.',top:'الأكثر تعطلًا (90 يومًا)',expired:'انتهى الضمان',soon:'الضمان ينتهي قريبًا',ticketBlock:'المعدة المعنية',link:'ربط',choose:'اختر معدة…',unlink:'إزالة',linked:'تم ربط المعدة بالتذكرة',unlinked:'تمت إزالة الربط',noAsset:'لا توجد معدات مسجلة لهذا الفندق.',
   impTitle:'استيراد ملف الجرد',impReading:'جارٍ قراءة الملف…',impHotel:'الفندق',impChooseHotel:'اختر الفندق',impTabs:'الأوراق المراد استيرادها',impLines:'سطر',impUnits:'وحدة',impSummary:(n,s)=>`${n} معدة للإضافة · ${s} موجودة مسبقًا`,impPreview:'معاينة (أول 30)',impGo:n=>`استيراد ${n} معدة`,impDone:n=>`تم استيراد ${n} معدة`,impNothing:'لا جديد للاستيراد.',impEmpty:'لا توجد أوراق معروفة في هذا الملف.',impError:'ملف غير مقروء',
   types:{pc:'حاسوب مكتبي',laptop:'حاسوب محمول',monitor:'شاشة',tablet:'جهاز لوحي',printer:'طابعة / فاكس',network:'شبكة',wifi:'نقطة Wi-Fi',server:'خادم / NAS',ups:'مزود طاقة',phone:'هاتف / PABX',camera:'كاميرا / NVR',access:'التحكم في الدخول',tv:'تلفاز / شاشة',pos:'نقطة بيع',other:'أخرى'},
   domains:{it:'المعلوميات',mechanical:'الميكانيك',electrical:'الكهرباء',plumbing:'السباكة',fire:'السلامة من الحريق',elevator:'المصاعد',kitchen:'المطبخ',architecture:'البناء',other:'أخرى'},
   statuses:{in_service:'في الخدمة',repair:'قيد الإصلاح',retired:'خارج الخدمة'}}
 };
 const text=()=>L[document.getElementById('languageSelector-app')?.value]||L.fr;
 const escape=value=>typeof esc==='function'?esc(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
 const user=()=>typeof currentUser!=='undefined'?currentUser:null;
 const toast=(message,kind)=>typeof showToast==='function'&&showToast(message,kind);
 const ask=message=>typeof window.confirm==='function'?window.confirm(message):true;
 const isStaff=(who=user())=>typeof canManageTickets==='function'?!!canManageTickets(who):['admin','it_regional','it_hotel'].includes(who?.role);
 const myHotels=()=>typeof userHotels==='function'?userHotels(user()):[];
 const allTickets=()=>typeof tickets!=='undefined'&&Array.isArray(tickets)?tickets:[];
 const value=id=>(document.getElementById(id)?.value||'').trim();
 const importer=()=>window.InventoryImport||globalThis.InventoryImport;

 let assets=[],links=[],loaded=false,loading=null,editing=null,importing=null;
 const filters={q:'',hotel:(()=>{try{return localStorage.getItem('invHotelFilter')||'';}catch{return '';}})(),domain:'',type:'',status:''};
 let ticket=null;

 function load(force){
  if(loading&&!force)return loading;
  if(typeof window.sbOK!=='function'||!window.sbOK()||typeof window.sbFetch!=='function'){loaded=true;return Promise.resolve(assets);}
  loading=Promise.all([
   window.sbFetch('assets?select=id,hotel,domain,name,type,subtype,brand_model,serial,location,quantity,documents,status,purchased_on,warranty_until,notes,updated_at&order=hotel.asc,domain.asc,name.asc&limit=5000'),
   window.sbFetch('ticket_assets?select=ticket_id,asset_id&limit=10000')
  ]).then(([a,l])=>{assets=Array.isArray(a)?a:[];links=Array.isArray(l)?l:[];loaded=true;return assets;})
   .catch(error=>{console.warn('Inventaire indisponible',error);loaded=true;return assets;})
   .finally(()=>{loading=null;});
  return loading;
 }

 // Tickets per item: total, and over the last 90 days (from the loaded tickets).
 function incidents(assetId,now=Date.now()){
  const ids=links.filter(link=>String(link.asset_id)===String(assetId)).map(link=>String(link.ticket_id));
  const byId=new Map(allTickets().map(t=>[String(t.id),t]));
  const recent=ids.filter(id=>{const t=byId.get(id);const at=Date.parse(t?.created_at||'');return Number.isFinite(at)&&now-at<=90*86400000;}).length;
  return {total:ids.length,recent};
 }
 function warrantyState(row,now=new Date()){
  if(!row.warranty_until)return '';
  const end=new Date(`${row.warranty_until}T23:59:59`);
  if(end<now)return 'expired';
  return end-now<=60*86400000?'soon':'';
 }
 function filtered(){
  const q=filters.q.toLowerCase();
  return assets.filter(row=>(!filters.hotel||row.hotel===filters.hotel)&&(!filters.domain||(row.domain||'it')===filters.domain)&&(!filters.type||row.type===filters.type)&&(!filters.status||row.status===filters.status)
   &&(!q||[row.name,row.subtype,row.brand_model,row.serial,row.location,row.notes].some(v=>String(v||'').toLowerCase().includes(q))));
 }
 function topBreakdowns(limit=5){
  return assets.map(row=>({row,...incidents(row.id)})).filter(item=>item.recent>0).sort((a,b)=>b.recent-a.recent||b.total-a.total).slice(0,limit);
 }

 const options=(list,labels,selected,first)=>`${first!==undefined?`<option value="">${escape(first)}</option>`:''}${list.map(v=>`<option value="${escape(v)}"${v===selected?' selected':''}>${escape(labels?labels[v]||v:v)}</option>`).join('')}`;
 function formHtml(row){
  const t=text(),hotels=myHotels();
  const hotelList=row?.hotel&&!hotels.includes(row.hotel)?[row.hotel,...hotels]:hotels;
  const field=(id,label,input)=>`<div class="form-g"><label class="field-lbl" for="${id}">${escape(label)}</label>${input}</div>`;
  const inputHtml=(id,val,max,type='text')=>`<input id="${id}" class="field-ctrl" type="${type}"${max?` maxlength="${max}"`:''} value="${escape(val??'')}">`;
  return `<div class="card inv-form"><div class="inv-grid">
   ${field('invName',t.name+' *',inputHtml('invName',row?.name,120))}
   ${field('invHotel',t.hotel+' *',`<select id="invHotel" class="field-ctrl">${options(hotelList,null,row?.hotel||(hotelList.length===1?hotelList[0]:hotelList.includes(filters.hotel)?filters.hotel:''),hotelList.length===1?undefined:'—')}</select>`)}
   ${field('invDomain',t.domain,`<select id="invDomain" class="field-ctrl">${options(DOMAINS,t.domains,row?.domain||'it')}</select>`)}
   ${field('invType',t.type,`<select id="invType" class="field-ctrl">${options(TYPES,t.types,row?.type||'pc')}</select>`)}
   ${field('invSubtype',t.subtype,inputHtml('invSubtype',row?.subtype,120))}
   ${field('invStatus',t.status,`<select id="invStatus" class="field-ctrl">${options(STATUSES,t.statuses,row?.status||'in_service')}</select>`)}
   ${field('invLocation',t.location,inputHtml('invLocation',row?.location,120))}
   ${field('invModel',t.model,inputHtml('invModel',row?.brand_model,120))}
   ${field('invSerial',t.serial,inputHtml('invSerial',row?.serial,80))}
   ${field('invQuantity',t.quantity,inputHtml('invQuantity',row?.quantity||1,null,'number'))}
   ${field('invPurchased',t.purchased,inputHtml('invPurchased',row?.purchased_on,null,'date'))}
   ${field('invWarranty',t.warranty,inputHtml('invWarranty',row?.warranty_until,null,'date'))}
  </div>${field('invDocuments',t.documents,inputHtml('invDocuments',row?.documents,200))}
  ${field('invNotes',t.notes,`<textarea id="invNotes" class="field-ctrl" rows="3" maxlength="1000">${escape(row?.notes||'')}</textarea>`)}
  <div class="inv-actions"><button type="button" class="btn btn-outline btn-sm" onclick="AssetInventory.cancel()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="AssetInventory.save()"><i class="ti ti-device-floppy"></i>${escape(t.save)}</button></div></div>`;
 }
 function rowHtml(row,withHotel=true){
  const t=text(),inc=incidents(row.id),w=warrantyState(row);
  const kind=row.domain&&row.domain!=='it'?(row.subtype||t.domains[row.domain]):(t.types[row.type]||row.type);
  return `<tr><td><strong>${escape(row.name)}</strong>${row.location?`<small>${escape(row.location)}</small>`:''}</td><td>${escape(kind)}${row.domain&&row.domain!=='it'?`<small>${escape(t.domains[row.domain]||row.domain)}</small>`:''}</td>${withHotel?`<td>${escape(row.hotel)}</td>`:''}
   <td>${escape(row.brand_model||'')}${row.serial?`<small>${escape(row.serial)}</small>`:''}</td>
   <td class="inv-qty">${Number(row.quantity)>1?escape(row.quantity):'1'}</td>
   <td><span class="inv-status inv-${escape(row.status)}">${escape(t.statuses[row.status]||row.status)}</span></td>
   <td>${row.warranty_until?`<span class="inv-warranty ${w}" title="${escape(w==='expired'?t.expired:w==='soon'?t.soon:'')}">${escape(row.warranty_until)}</span>`:'—'}</td>
   <td><b class="${inc.recent>=3?'inv-hot':''}">${inc.total}</b>${inc.recent?` <small>(${inc.recent} ${escape(t.incidents90)})</small>`:''}</td>
   <td class="inv-row-actions"><button type="button" title="${escape(t.edit)}" aria-label="${escape(t.edit)}" data-asset-id="${escape(row.id)}" onclick="AssetInventory.edit(this.dataset.assetId)"><i class="ti ti-edit"></i></button><button type="button" title="${escape(t.remove)}" aria-label="${escape(t.remove)}" data-asset-id="${escape(row.id)}" onclick="AssetInventory.remove(this.dataset.assetId)"><i class="ti ti-trash"></i></button></td></tr>`;
 }
 // Header of a hotel: number of items, items in repair, expired warranties.
 function hotelSummary(hotel,rows){
  const t=text(),repair=rows.filter(row=>row.status==='repair').length,expired=rows.filter(row=>row.status!=='retired'&&warrantyState(row)==='expired').length;
  return `<span class="mp-hotel-name"><i class="ti ti-building"></i>${escape(hotel)}</span><span class="mp-hotel-meta"><span>${escape(t.items(rows.length))}</span>${repair?`<span class="mp-badge mp-due">${escape(t.repairCount(repair))}</span>`:''}${expired?`<span class="mp-badge">${escape(t.expiredCount(expired))}</span>`:''}</span>`;
 }
 function listHtml(){
  const t=text();
  if(!loaded)return `<div class="loading-state"><i class="ti ti-loader-2 spin"></i> ${escape(t.loading)}</div>`;
  if(!assets.length)return `<div class="empty-state"><i class="ti ti-device-desktop"></i><p>${escape(t.none)}</p></div>`;
  const list=filtered();
  if(!list.length)return `<div class="empty-state"><i class="ti ti-search"></i><p>${escape(t.noMatch)}</p></div>`;
  const table=(rows,withHotel)=>`<table class="inv-table"><thead><tr><th>${escape(t.name)}</th><th>${escape(t.type)}</th>${withHotel?`<th>${escape(t.hotel)}</th>`:''}<th>${escape(t.model)}</th><th>${escape(t.qty)}</th><th>${escape(t.status)}</th><th>${escape(t.warranty)}</th><th>${escape(t.incidents)}</th><th><span class="sr-only">${escape(t.actions)}</span></th></tr></thead><tbody>${rows.map(row=>rowHtml(row,withHotel)).join('')}</tbody></table>`;
  if(filters.hotel)return `<div class="card inv-table-wrap mp-hotel-one"><div class="mp-hotel-head">${hotelSummary(filters.hotel,list)}</div>${table(list,false)}</div>`;
  // All hotels: one folded section per hotel, opened when a search or filter narrows the list.
  const narrowed=!!(filters.q||filters.domain||filters.type||filters.status);
  const groups=[...new Set(list.map(row=>row.hotel))].sort((a,b)=>String(a).localeCompare(String(b)));
  return groups.map(hotel=>{const rows=list.filter(row=>row.hotel===hotel);return `<details class="card mp-hotel"${narrowed||groups.length===1?' open':''}><summary>${hotelSummary(hotel,rows)}<button type="button" class="mp-link" data-hotel="${escape(hotel)}" onclick="event.preventDefault();AssetInventory.setFilter('hotel',this.dataset.hotel)">${escape(t.onlyHotel)}</button></summary><div class="inv-table-wrap">${table(rows,false)}</div></details>`;}).join('');
 }

 // ---- Import ----
 function importSelection(){
  if(!importing?.parsed)return {fresh:[],skipped:[]};
  const rows=importing.parsed.filter(p=>importing.domains.has(p.domain)).flatMap(p=>p.rows);
  const existing=assets.filter(row=>row.hotel===importing.hotel);
  return importer().plan(rows,existing);
 }
 function importHtml(){
  const t=text();
  if(importing.busy&&!importing.parsed)return `<div class="loading-state"><i class="ti ti-loader-2 spin"></i> ${escape(t.impReading)}</div>`;
  if(!importing.parsed?.length)return `<div class="card inv-import"><h3>${escape(t.impTitle)}</h3><p>${escape(t.impEmpty)}</p><div class="inv-actions"><button type="button" class="btn btn-outline btn-sm" onclick="AssetInventory.cancelImport()">${escape(t.cancel)}</button></div></div>`;
  const hotels=myHotels(),sel=importSelection();
  return `<div class="card inv-import"><h3><i class="ti ti-file-spreadsheet"></i> ${escape(t.impTitle)} <small>${escape(importing.fileName||'')}</small></h3>
   <div class="form-g"><label class="field-lbl" for="invImportHotel">${escape(t.impHotel)}</label><select id="invImportHotel" class="field-ctrl" onchange="AssetInventory.setImportHotel(this.value)">${options(hotels,null,importing.hotel,t.impChooseHotel)}</select></div>
   <p class="field-lbl">${escape(t.impTabs)}</p><div class="inv-import-tabs">${importing.parsed.map(p=>`<label class="inv-check"><input type="checkbox" data-domain="${escape(p.domain)}" onchange="AssetInventory.toggleImportDomain(this.dataset.domain)"${importing.domains.has(p.domain)?' checked':''}> ${escape(t.domains[p.domain]||p.domain)} <small>${escape(p.sheet)} · ${p.rows.length} ${escape(t.impLines)} · ${p.rows.reduce((s,r)=>s+r.quantity,0)} ${escape(t.impUnits)}</small></label>`).join('')}</div>
   ${importing.hotel?`<p class="inv-import-summary">${escape(t.impSummary(sel.fresh.length,sel.skipped.length))}</p>
   ${sel.fresh.length?`<p class="field-lbl">${escape(t.impPreview)}</p><div class="inv-table-wrap"><table class="inv-table"><tbody>${sel.fresh.slice(0,30).map(r=>`<tr><td><strong>${escape(r.name)}</strong>${r.location?`<small>${escape(r.location)}</small>`:''}</td><td>${escape(r.domain==='it'?t.types[r.type]:(r.subtype||t.domains[r.domain]))}</td><td>${escape(r.brand_model||'')}${r.serial?`<small>${escape(r.serial)}</small>`:''}</td><td class="inv-qty">${r.quantity}</td></tr>`).join('')}</tbody></table></div>`:''}`:''}
   <div class="inv-actions"><button type="button" class="btn btn-outline btn-sm" onclick="AssetInventory.cancelImport()">${escape(t.cancel)}</button><button type="button" class="btn btn-gold btn-sm" onclick="AssetInventory.confirmImport()"${!importing.hotel||!sel.fresh.length||importing.busy?' disabled':''}><i class="ti ti-upload"></i>${escape(t.impGo(sel.fresh.length))}</button></div></div>`;
 }
 async function importFile(file){
  const t=text();if(!file||!importer())return false;
  importing={fileName:file.name,parsed:null,hotel:'',domains:new Set(),busy:true};render();
  try{
   if(!loaded)await load();
   const sheets=await importer().readXlsx(await file.arrayBuffer());
   const parsed=importer().parseWorkbook(sheets);
   const hotels=myHotels();
   importing={fileName:file.name,parsed,hotel:importer().guessHotel(file.name,hotels)||(hotels.length===1?hotels[0]:''),domains:new Set(parsed.map(p=>p.domain)),busy:false};
   render();return true;
  }catch(error){console.error('Import inventaire',error);importing=null;render();toast(`${t.impError} : ${error.message||error}`,'err');return false;}
 }
 function setImportHotel(hotel){if(importing){importing.hotel=String(hotel||'');render();}}
 function toggleImportDomain(domain){if(!importing)return;if(importing.domains.has(domain))importing.domains.delete(domain);else importing.domains.add(domain);render();}
 function cancelImport(){importing=null;render();}
 async function confirmImport(){
  const t=text();if(!importing?.hotel)return false;
  const {fresh}=importSelection();
  if(!fresh.length){toast(t.impNothing,'ok');return false;}
  importing.busy=true;render();
  let done=0;
  try{
   for(let i=0;i<fresh.length;i+=100){
    const chunk=fresh.slice(i,i+100).map(row=>({...row,hotel:importing.hotel}));
    const saved=await window.sbFetch('assets',{method:'POST',body:JSON.stringify(chunk)});
    if(!Array.isArray(saved)||saved.length!==chunk.length)throw new Error('Import refusé');
    assets=[...assets,...saved];done+=saved.length;
   }
   importing=null;render();toast(t.impDone(done),'ok');return true;
  }catch(error){
   console.error('Import inventaire',error);
   if(importing)importing.busy=false;render();
   toast(done?`${t.impDone(done)} — ${t.failed}`:t.failed,'err');return false;
  }
 }

 function pageHtml(){
  const t=text();
  if(!isStaff())return `<div class="empty-state"><i class="ti ti-lock"></i><p>${escape(t.denied)}</p></div>`;
  if(editing)return `<div class="inv-page">${formHtml(editing==='new'?null:assets.find(row=>String(row.id)===String(editing)))}</div>`;
  if(importing)return `<div class="inv-page">${importHtml()}</div>`;
  const hotels=[...new Set([...myHotels(),...assets.map(row=>row.hotel)])].sort((a,b)=>a.localeCompare(b));
  const top=loaded?topBreakdowns():[];
  return `<div class="inv-page"><div class="inv-top"><p>${escape(t.intro)}</p><div class="inv-actions"><label class="btn btn-outline"><i class="ti ti-file-spreadsheet"></i>${escape(t.importBtn)}<input type="file" accept=".xlsx" hidden onchange="AssetInventory.importFile(this.files[0]);this.value=''"></label><button type="button" class="btn btn-gold" onclick="AssetInventory.edit('new')"><i class="ti ti-plus"></i>${escape(t.add)}</button></div></div>
   ${top.length?`<div class="card inv-hotlist"><div class="section-title"><i class="ti ti-flame"></i>${escape(t.top)}</div>${top.map(item=>`<div class="inv-hot-item"><span>${escape(item.row.name)} <small>${escape(item.row.hotel)}</small></span><b>${item.recent}</b></div>`).join('')}</div>`:''}
   <div class="inv-filters"><input id="invSearch" type="search" class="field-ctrl" placeholder="${escape(t.search)}" value="${escape(filters.q)}" oninput="AssetInventory.setFilter('q',this.value)">
    <select id="invHotelFilter" class="field-ctrl" onchange="AssetInventory.setFilter('hotel',this.value)" aria-label="${escape(t.hotel)}"><option value="">${escape(t.allHotels)} (${assets.length})</option>${hotels.map(h=>`<option value="${escape(h)}"${h===filters.hotel?' selected':''}>${escape(h)} (${assets.filter(row=>row.hotel===h).length})</option>`).join('')}</select>
    <select class="field-ctrl" onchange="AssetInventory.setFilter('domain',this.value)">${options(DOMAINS,t.domains,filters.domain,t.allDomains)}</select>
    <select class="field-ctrl" onchange="AssetInventory.setFilter('type',this.value)">${options(TYPES,t.types,filters.type,t.allTypes)}</select>
    <select class="field-ctrl" onchange="AssetInventory.setFilter('status',this.value)">${options(STATUSES,t.statuses,filters.status,t.allStatuses)}</select></div>
   <div id="invList">${listHtml()}</div></div>`;
 }
 function render(){
  const host=document.getElementById('mainContent');if(!host)return;
  host.innerHTML=pageHtml();
  if(isStaff()&&!loaded&&!loading)load().then(()=>{if(typeof currentView==='undefined'||currentView==='assets')render();});
 }
 function setFilter(key,val){filters[key]=String(val||'');
  if(key==='hotel'){try{localStorage.setItem('invHotelFilter',filters.hotel);}catch{}const select=document.getElementById('invHotelFilter');if(select)select.value=filters.hotel;}
  const list=document.getElementById('invList');if(list)list.innerHTML=listHtml();else render();}
 function edit(id){editing=id||'new';render();document.getElementById('invName')?.focus?.();}
 function cancel(){editing=null;render();}
 const upsert=row=>{assets=[...assets.filter(item=>String(item.id)!==String(row.id)),row].sort((a,b)=>`${a.hotel}|${a.domain}|${a.name}`.localeCompare(`${b.hotel}|${b.domain}|${b.name}`));};
 async function save(){
  const t=text();
  const quantity=parseInt(value('invQuantity'),10);
  const body={name:value('invName').slice(0,120),hotel:value('invHotel'),domain:value('invDomain')||'it',type:value('invType')||'other',subtype:value('invSubtype').slice(0,120)||null,status:value('invStatus')||'in_service',
   location:value('invLocation').slice(0,120)||null,brand_model:value('invModel').slice(0,120)||null,serial:value('invSerial').slice(0,80)||null,
   quantity:Number.isFinite(quantity)&&quantity>0?Math.min(quantity,100000):1,documents:value('invDocuments').slice(0,200)||null,
   purchased_on:value('invPurchased')||null,warranty_until:value('invWarranty')||null,notes:value('invNotes').slice(0,1000)||null};
  if(!body.name||!body.hotel){toast(t.required,'err');return false;}
  if(!TYPES.includes(body.type))body.type='other';if(!STATUSES.includes(body.status))body.status='in_service';if(!DOMAINS.includes(body.domain))body.domain='it';
  const id=editing==='new'?null:editing;
  try{
   const saved=id
    ?await window.sbFetch(`assets?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(body)})
    :await window.sbFetch('assets',{method:'POST',body:JSON.stringify(body)});
   const row=Array.isArray(saved)&&saved[0];if(!row)throw new Error('Aucune ligne enregistrée');
   upsert(row);editing=null;render();toast(t.saved,'ok');return true;
  }catch(error){console.error('Inventaire',error);toast(t.failed,'err');return false;}
 }
 async function remove(id){
  const t=text();if(!ask(t.confirm))return false;
  try{
   // RLS silently skips rows the user may not delete: an empty answer is a refusal.
   const gone=await window.sbFetch(`assets?id=eq.${encodeURIComponent(id)}`,{method:'DELETE'});
   if(!Array.isArray(gone)||!gone.length)throw new Error('Suppression refusée');
   assets=assets.filter(row=>String(row.id)!==String(id));links=links.filter(link=>String(link.asset_id)!==String(id));render();toast(t.removed,'ok');return true;
  }catch(error){console.error('Inventaire',error);toast(t.failed,'err');return false;}
 }

 // ---- Ticket page ----
 function ticketHtml(item=ticket){
  if(!item||!isStaff())return '';
  const t=text();
  const linkedIds=new Set(links.filter(link=>String(link.ticket_id)===String(item.id)).map(link=>String(link.asset_id)));
  const linked=assets.filter(row=>linkedIds.has(String(row.id)));
  const choices=assets.filter(row=>row.hotel===item.hotel&&row.status!=='retired'&&!linkedIds.has(String(row.id)));
  return `<section class="inv-ticket"><h3><i class="ti ti-device-desktop"></i> ${escape(t.ticketBlock)}</h3>
   ${linked.length?`<div class="inv-chips">${linked.map(row=>`<span class="inv-chip">${escape(row.name)}${row.location?` · ${escape(row.location)}`:''}<button type="button" aria-label="${escape(t.unlink)}" title="${escape(t.unlink)}" data-asset-id="${escape(row.id)}" onclick="AssetInventory.unlink(this.dataset.assetId)">×</button></span>`).join('')}</div>`:''}
   ${choices.length?`<div class="inv-link"><select id="invTicketAsset" class="field-ctrl"><option value="">${escape(t.choose)}</option>${choices.map(row=>`<option value="${escape(row.id)}">${escape(row.name)}${row.location?` — ${escape(row.location)}`:''}</option>`).join('')}</select><button type="button" class="btn btn-outline btn-sm" onclick="AssetInventory.link()"><i class="ti ti-link"></i>${escape(t.link)}</button></div>`:(!linked.length?`<p>${escape(t.noAsset)}</p>`:'')}</section>`;
 }
 function renderTicket(){const host=document.getElementById('ticketAsset');if(host)host.innerHTML=ticketHtml();}
 function mountTicket(item){
  ticket=item;renderTicket();
  if(isStaff()&&!loaded)load().then(()=>{if(String(ticket?.id)===String(item?.id))renderTicket();});
 }
 async function link(){
  const t=text(),assetId=value('invTicketAsset');if(!assetId||!ticket)return false;
  try{
   const saved=await window.sbFetch('ticket_assets',{method:'POST',body:JSON.stringify({ticket_id:ticket.id,asset_id:assetId})});
   const row=Array.isArray(saved)&&saved[0]||{ticket_id:ticket.id,asset_id:assetId};
   links=[...links,{ticket_id:row.ticket_id,asset_id:row.asset_id}];renderTicket();toast(t.linked,'ok');return true;
  }catch(error){console.error('Inventaire',error);toast(t.failed,'err');return false;}
 }
 async function unlink(assetId){
  const t=text();if(!ticket)return false;
  try{
   const gone=await window.sbFetch(`ticket_assets?ticket_id=eq.${encodeURIComponent(ticket.id)}&asset_id=eq.${encodeURIComponent(assetId)}`,{method:'DELETE'});
   if(!Array.isArray(gone)||!gone.length)throw new Error('Suppression refusée');
   links=links.filter(l=>!(String(l.ticket_id)===String(ticket.id)&&String(l.asset_id)===String(assetId)));renderTicket();toast(t.unlinked,'ok');return true;
  }catch(error){console.error('Inventaire',error);toast(t.failed,'err');return false;}
 }

 window.AssetInventory={load,render,setFilter,edit,cancel,save,remove,mountTicket,link,unlink,incidents,warrantyState,topBreakdowns,importFile,setImportHotel,toggleImportDomain,cancelImport,confirmImport,title:()=>text().title,_set:(a,l)=>{assets=a;links=l||[];loaded=true;},_importState:()=>importing};
})();

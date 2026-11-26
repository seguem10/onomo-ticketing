/* Inventory import from the hotels' workbook "Inventaire Materiels IT".
   - readXlsx(): a small .xlsx reader (zip + XML) using the browser's native
     DecompressionStream, so no third-party spreadsheet library is loaded.
   - parseWorkbook(): turns the workbook's tabs into inventory rows:
     * technical tabs (Mécanique, Électrique, Plomberie, Incendie, Ascenseur,
       Cuisine, Architecture): columns Equipment Name, Type of Equipment,
       Manufacturer, Model, Location(s), Quantity, Docs Provided;
     * the IT tab, organised in sections (Ordinateurs with their screen,
       Laptop, Tablette, Serveur, Onduleur, Imprimantes, Caisses Micros,
       Encodeurs VingCard, Switching, PABX, NVR & Caméras, WiFi).
   - plan(): which rows are new compared with the hotel's current inventory
     (by serial number, otherwise by name + location + model, counting
     duplicates), so importing the same file twice adds nothing. */
(function(root){
 'use strict';

 // ---------- .xlsx reader ----------
 const u16=(b,o)=>b[o]|(b[o+1]<<8);
 const u32=(b,o)=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;
 async function inflateRaw(bytes){
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
 }
 async function unzip(buffer,wanted){
  const b=new Uint8Array(buffer);
  let eocd=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(u32(b,i)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw new Error('Fichier Excel illisible (archive invalide)');
  const count=u16(b,eocd+10);let p=u32(b,eocd+16);
  const files={},decoder=new TextDecoder();
  for(let n=0;n<count;n++){
   if(u32(b,p)!==0x02014b50)throw new Error('Fichier Excel illisible (répertoire)');
   const method=u16(b,p+10),size=u32(b,p+20),nameLen=u16(b,p+28),extraLen=u16(b,p+30),commentLen=u16(b,p+32),local=u32(b,p+42);
   const name=decoder.decode(b.subarray(p+46,p+46+nameLen));
   p+=46+nameLen+extraLen+commentLen;
   if(!wanted(name))continue;
   const start=local+30+u16(b,local+26)+u16(b,local+28);
   const data=b.subarray(start,start+size);
   files[name]=decoder.decode(method===0?data:method===8?await inflateRaw(data):(()=>{throw new Error('Compression non prise en charge');})());
  }
  return files;
 }
 const decodeXml=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(Number(d))).replace(/&amp;/g,'&');
 const colIndex=ref=>{let n=0;for(const ch of ref.replace(/\d+/g,''))n=n*26+ch.charCodeAt(0)-64;return n-1;};
 // Text of the <t> runs of a cell or shared string, decoded once. Values are
 // only ever shown through esc(), never inserted as HTML.
 const textOf=xml=>decodeXml([...String(xml).matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map(m=>m[1]).join(''));
 function sheetRows(xml,shared){
  const rows=[];
  for(const row of xml.match(/<row\b[\s\S]*?<\/row>/g)||[]){
   const cells=[];
   for(const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)||[]){
    const ref=(c.match(/\br="([A-Z]+\d+)"/)||[])[1];if(!ref)continue;
    const type=(c.match(/\bt="([^"]+)"/)||[])[1];
    const raw=(c.match(/<v>([^<]*)<\/v>/)||[])[1];
    const v=type==='s'?shared[Number(raw)]:(type==='inlineStr'||raw===undefined)?textOf(c):decodeXml(raw);
    cells[colIndex(ref)]=String(v??'').trim();
   }
   rows.push(Array.from(cells,v=>v??''));
  }
  return rows;
 }
 async function readXlsx(buffer){
  const files=await unzip(buffer,name=>/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name));
  if(!files['xl/workbook.xml'])throw new Error('Ce fichier n’est pas un classeur Excel (.xlsx)');
  const shared=(files['xl/sharedStrings.xml']?.match(/<si>[\s\S]*?<\/si>/g)||[]).map(textOf);
  const rels=Object.fromEntries([...(files['xl/_rels/workbook.xml.rels']||'').matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"/g)].map(m=>[m[1],m[2]]));
  const sheets=[];
  for(const m of files['xl/workbook.xml'].matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"/g)){
   const target=rels[m[2]];if(!target)continue;
   const xml=files['xl/'+target.replace(/^\/?xl\//,'')];if(!xml)continue;
   sheets.push({name:decodeXml(m[1]),rows:sheetRows(xml,shared)});
  }
  return sheets;
 }

 // ---------- workbook → inventory rows ----------
 const norm=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
 const clean=(v,max)=>{const s=String(v??'').replace(/\s+/g,' ').trim();return s?s.slice(0,max):null;};
 const isNo=v=>/^(non|no|n\/a|-|)$/i.test(String(v??'').trim());
 const qty=v=>{const n=parseInt(String(v??'').replace(/\s/g,''),10);return Number.isFinite(n)&&n>0?Math.min(n,100000):1;};
 const DOMAINS=[[/mecanique/,'mechanical'],[/electrique/,'electrical'],[/plomberie/,'plumbing'],[/incendie/,'fire'],[/ascenseur/,'elevator'],[/cuisine/,'kitchen'],[/architecture/,'architecture'],[/(^|[^a-z])it([^a-z]|$)/,'it']];
 function domainOf(sheetName){const n=norm(sheetName).replace(/^\d+\.?\s*/,'');for(const [re,d] of DOMAINS)if(re.test(n))return d;return null;}
 function item(fields){
  return {domain:fields.domain||'it',type:fields.type||'other',subtype:clean(fields.subtype,120),name:clean(fields.name,120),
   brand_model:clean(fields.brand_model,120),serial:isNo(fields.serial)?null:clean(fields.serial,80),location:clean(fields.location,120),
   quantity:fields.quantity||1,documents:clean(fields.documents,200),notes:clean(fields.notes,1000),status:'in_service'};
 }

 function parseTechnicalSheet(rows,domain){
  const headerIndex=rows.findIndex(r=>r.some(c=>norm(c)==='equipment name'));
  if(headerIndex<0)return [];
  const header=rows[headerIndex].map(norm);
  const at=label=>header.findIndex(h=>h===label||h.startsWith(label));
  const c={name:at('equipment name'),type:at('type of equipment'),maker:at('manufacturer'),model:at('model'),location:at('location'),quantity:at('quantity'),docs:at('docs provided')};
  const out=[];
  for(const r of rows.slice(headerIndex+1)){
   const name=r[c.name];if(!clean(name,120))continue;
   const model=clean(r[c.model],60),year=model&&/^(19|20)\d{2}$/.test(model)?model:null;
   out.push(item({domain,type:'other',name,subtype:r[c.type],
    brand_model:[r[c.maker],year?null:model].filter(v=>clean(v,60)).join(' '),
    location:r[c.location],quantity:qty(r[c.quantity]),documents:r[c.docs],notes:year?`Année : ${year}`:null}));
  }
  return out;
 }

 // IT tab (« 05. IT », « IT », « Feuil1 », « Sheet 1 »…): sections, each with
 // its own header row. The hotels' files share the template but not the exact
 // columns (French or English labels, a quantity in column A, the user in
 // column C, the screen and the purchase date in different places), so the
 // columns are read from each section's header.
 const SECTION_RULES=[
  [n=>/^(ordinateurs|computers?)$/.test(n),'pc'],
  [n=>/^laptops?$/.test(n),'laptop'],
  [n=>/^(tablettes?|tablets?)$/.test(n),'tablet'],
  [n=>/^(serveurs?|servers?)$/.test(n),'server'],
  [n=>/^(onduleurs?|inverters?|ups)\b/.test(n)&&!n.includes(' - '),'ups'],
  [n=>/^(imprimantes?|printers?)( -|$)/.test(n),'printer'],
  [n=>/^(caisses?|cash registers?)\b/.test(n),'pos'],
  [n=>/(encodeurs?|encoders?)\b/.test(n),'access'],
  [n=>/^swit/.test(n),'switch'],
  [n=>/^hard drives?$/.test(n),'skip'],
  [n=>/^(pabx|telephon)/.test(n),'pabx'],
  [n=>/^(nvr|dvr|cctv|cameras?|video)/.test(n),'camera'],
  [n=>/^wi-?fi$/.test(n),'wifi']
 ];
 const sectionOf=title=>{const n=norm(title);for(const [test,key] of SECTION_RULES)if(test(n))return key;return null;};
 const LABEL=/^(qty|qte|quantite|total|service|departments?|departement|position|location|username|user|name|nom|server|serveur|serial|num\.? ?serie|mar\.|marque|make|brand|models?|modele|screen|ecran|date|purchase|type|computer room|salle informatique|s\. repartiteur)/;
 const isHeader=r=>r.filter(c=>LABEL.test(norm(c))).length>=2;
 const numberOf=v=>{const s=String(v??'').trim();return /^\d{1,6}$/.test(s)?Number(s):null;};
 const looksSerial=v=>/^[a-z0-9][a-z0-9-]{5,}$/i.test(String(v??'').trim())&&/\d/.test(String(v));
 function columns(header){
  const h=header.map(norm),find=(re,from=0)=>h.findIndex((v,i)=>i>=from&&re.test(v));
  const screen=h.findIndex((v,i)=>i>=2&&/ecran|screen/.test(v));
  const serials=h.map((v,i)=>/(serial|num\.? ?serie)/.test(v)&&!/model/.test(v)?i:-1).filter(i=>i>=0);
  const device=serials.find(i=>screen<0||i<screen)??-1,screenSerial=screen>=0?(serials.find(i=>i>screen)??-1):-1;
  const dates=h.map((v,i)=>/(date|purchase|achat)/.test(v)?i:-1).filter(i=>i>=0);
  const date=dates.find(i=>screen<0||i<screen)??(screen<0?-1:dates[0]??-1);
  const person=find(/^(name of|username|user\b|utilisateur|nom)/,2);
  const total=find(/^(total|qty|qte|quantite)/,1);
  const last=h.reduce((m,v,i)=>v?i:m,1);
  return {screen,device,screenSerial,date,person,total,last,labelled:new Set(h.map((v,i)=>v?i:-1).filter(i=>i>=0))};
 }
 const KIND=/^(micros|imprimante|printer|tablette|tablet|caisse)/;
 function parseItSheet(input){
  // Some files start in column A instead of B: shift them back into place.
  const firstTitle=input.find(r=>{const f=r.filter(Boolean);return f.length===1&&sectionOf(f[0]);});
  const rows=firstTitle&&firstTitle[0]&&sectionOf(firstTitle[0])?input.map(r=>['',...r]):input;
  const out=[];let section=null,cols=null,place=null;
  for(const r of rows){
   const filled=r.map((v,i)=>v?i:-1).filter(i=>i>=0);
   if(!filled.length)continue;
   // A section title: a known section name, alone or followed only by column
   // labels (« Computers … Screen Make »). Other lone cells (« Cloud »,
   // « CCTV BRAND: DAHUA »…) are ignored.
   const next=sectionOf(r[filled[0]]);
   if(next&&!filled.some(i=>/(serial|num.? ?serie)/.test(norm(r[i])))&&filled.slice(1).every(i=>LABEL.test(norm(r[i]))||/screen make|ecran/.test(norm(r[i])))){section=next;cols=null;place=null;continue;}
   if(filled.length===1)continue;
   if(isHeader(r)){
    cols=columns(r);
    if(section==='switch'&&r[1]&&!/^(service|position|location|model)/.test(norm(r[1])))place=r[1];
    continue;
   }
   if(!section||section==='skip')continue;
   const c=cols||{screen:-1,device:-1,screenSerial:-1,date:-1,person:-1,total:-1,last:5,labelled:new Set()};
   // A label that is only a number (a quantity typed in the wrong column) is not a name.
   const label=numberOf(r[1])?'':(clean(r[1],120)||'');
   let person=c.person>=0?r[c.person]:(['pc','laptop','tablet'].includes(section)&&!c.labelled.has(2)?r[2]:'');
   if(isNo(person))person='';
   let serial=c.device>=0?r[c.device]:'';
   const used=new Set([0,1,c.person,c.device,c.screen,c.screenSerial,c.date,c.total].filter(i=>i>=0));
   if(!['pc','laptop','tablet'].includes(section)||c.labelled.has(2))used.delete(2);
   if(c.person>=0)used.add(c.person);else if(['pc','laptop','tablet'].includes(section)&&!c.labelled.has(2))used.add(2);
   // A serial typed one or two columns too far right (seen in several files).
   if(isNo(serial)&&c.device>=0)for(const i of [c.device+1,c.device+2]){if(!used.has(i)&&looksSerial(r[i])){serial=r[i];used.add(i);break;}}
   const parts=[];for(let i=2;i<=Math.max(c.last,section==='printer'?5:3);i++)if(!used.has(i)&&r[i]&&!isNo(r[i])&&!numberOf(r[i]))parts.push(r[i]);
   const make=parts.join(' ').trim();
   const quantity=numberOf(c.total>=0?r[c.total]:null)||numberOf(r[0])||(cols?null:r.slice(2,9).map(numberOf).find(n=>n))||1;
   const year=c.date>=0&&/^(19|20)\d{2}/.test(String(r[c.date]||''))?String(r[c.date]).slice(0,4):null;
   const notes=year?`Achat : ${year}`:null;
   const screenMake=c.screen>=0&&!isNo(r[c.screen])?r[c.screen]:'',screenSerial=c.screenSerial>=0?r[c.screenSerial]:'';
   if(!label&&!make&&isNo(serial)&&!screenMake)continue;
   const who=label&&person&&norm(person)!==norm(label)?`${label} – ${person}`:(label||person);
   switch(section){
    case 'pc':case 'laptop':case 'tablet':{
     const prefix={pc:'PC',laptop:'Laptop',tablet:'Tablette'}[section];
     if(make||!isNo(serial))out.push(item({type:section,name:`${prefix} ${who}`.trim(),location:label,brand_model:make,serial,quantity,notes}));
     if(screenMake&&!/all in one|aio/.test(norm(screenMake)))out.push(item({type:'monitor',name:`Écran ${who}`.trim(),location:label,brand_model:screenMake,serial:screenSerial,notes}));
     break;}
    case 'server':{
     out.push(item({type:'server',name:`Serveur ${label}`.trim(),brand_model:make,serial,location:'Salle informatique',notes}));
     if(screenMake)out.push(item({type:'monitor',name:`Écran serveur ${label}`.trim(),brand_model:screenMake,serial:screenSerial,location:'Salle informatique',notes}));
     break;}
    case 'ups':if(make||!isNo(serial))out.push(item({type:'ups',name:`Onduleur ${label}`.trim(),location:label,brand_model:make,serial,quantity,notes}));break;
    case 'printer':out.push(item({type:'printer',name:/^(fax|imprimante|printer)/.test(norm(parts[0]||''))?`${parts[0]} ${label}`:`Imprimante ${label}`,location:label,brand_model:make,serial,quantity,notes}));break;
    case 'pos':{
     const kind=norm(`${label} ${make}`);
     const type=/micros|eclipse|workstation|posiflex|caisse|610|9007/.test(kind)?'pos':/tablette|tablet/.test(kind)?'tablet':/imprimante|printer|epson|tm-?u?\d/.test(kind)?'printer':'pos';
     const isKind=KIND.test(norm(label));
     out.push(item({type,name:isKind?label:`${make||'Caisse'}`,location:isKind?null:label,brand_model:isKind?make:make,serial,quantity,subtype:'Micros',notes}));
     break;}
    case 'access':out.push(item({type:'access',name:label||make,location:/^encod/.test(norm(label))?null:label,brand_model:make,serial,quantity,subtype:'VingCard',notes}));break;
    case 'switch':{
     const n=norm(label);
     out.push(item({type:/nas|synology/.test(n)?'server':'network',name:label,brand_model:make,serial,quantity,location:(/^switch/.test(n)&&place)||'Salle informatique',notes}));
     break;}
    case 'pabx':out.push(item({type:'phone',name:label||make,brand_model:label?make:null,quantity,subtype:'PABX'}));break;
    case 'camera':out.push(item({type:'camera',name:label||make,brand_model:label?make:null,serial:null,quantity}));break;
    case 'wifi':out.push(item({type:/^ap|\bap\b|borne|access point|outdoor/.test(norm(label))?'wifi':'network',name:label||make,brand_model:label?make:null,quantity,subtype:'Wi-Fi'}));break;
    default:break;
   }
  }
  return out.filter(row=>row.name);
 }
 // A tab with an unrecognised name is the IT tab when it contains the IT sections.
 const looksLikeIt=rows=>rows.some(r=>{const f=r.filter(Boolean);return f.length>=1&&f.length<=2&&sectionOf(f[0])==='pc';});
 function parseWorkbook(sheets){
  const result=[];
  for(const sheet of sheets||[]){
   const domain=domainOf(sheet.name)||(looksLikeIt(sheet.rows)?'it':null);if(!domain)continue;
   const rows=domain==='it'?parseItSheet(sheet.rows):parseTechnicalSheet(sheet.rows,domain);
   if(rows.length)result.push({sheet:sheet.name,domain,rows});
  }
  return result;
 }

 // ---------- duplicates against the current inventory ----------
 const keyOf=row=>row.serial?`s|${norm(row.serial)}`:`n|${norm(row.name)}|${norm(row.location)}|${norm(row.brand_model)}`;
 function plan(rows,existing){
  const left=new Map();
  for(const row of existing||[]){const k=keyOf(row);left.set(k,(left.get(k)||0)+1);}
  const fresh=[],skipped=[];
  for(const row of rows||[]){
   const k=keyOf(row),n=left.get(k)||0;
   if(n>0){left.set(k,n-1);skipped.push(row);}else fresh.push(row);
  }
  return {fresh,skipped};
 }
 // "Inventaire Materiels IT - Terminus.xlsx" → the hotel whose name contains "Terminus".
 // The hotel matching the most words wins; a tie ("abidjan" alone fits two
 // hotels) gives no answer, so the user chooses. Short names used in the
 // files' titles are expanded first.
 const ALIASES={iots:'inn on the square',occc:'casa city center'};
 const aliasHotel=(base,hotels)=>{const words=base.split(/[^a-z0-9]+/);for(const [k,v] of Object.entries(ALIASES))if(words.includes(k))return (hotels||[]).find(h=>norm(h).includes(v))||'';return '';};
 function guessHotel(fileName,hotels){
  const base=norm(String(fileName||'').replace(/\.[a-z0-9]+$/i,'')).replace(/\bo'/g,' ');
  const alias=aliasHotel(base,hotels);if(alias)return alias;
  const words=base.split(/[^a-z0-9]+/).flatMap(w=>ALIASES[w]?ALIASES[w].split(' '):[w])
   .filter(w=>w.length>=4&&!['inventaire','inventory','materiels','materiel','hotel','onomo','town','cape'].includes(w));
  let best='',score=0,tie=false;
  for(const h of hotels||[]){
   const name=norm(h),s=words.filter(w=>new RegExp(`\\b${w}\\b`).test(name)).length;
   if(s>score){best=h;score=s;tie=false;}else if(s&&s===score)tie=true;
  }
  return score&&!tie?best:'';
 }

 root.InventoryImport={readXlsx,parseWorkbook,parseItSheet,parseTechnicalSheet,domainOf,plan,guessHotel};
})(typeof window!=='undefined'?window:globalThis);

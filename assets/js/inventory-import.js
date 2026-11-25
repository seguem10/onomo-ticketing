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

 // IT tab: B=1 … I=8.
 const SECTION_RULES=[
  [n=>n==='ordinateurs','pc'],[n=>n==='laptop'||n==='laptops','laptop'],[n=>n==='tablette'||n==='tablettes','tablet'],
  [n=>n==='serveur'||n==='serveurs','server'],[n=>n==='onduleur'||n==='onduleurs','ups'],[n=>n.startsWith('imprimante -')||n==='imprimantes','printer'],
  [n=>n.startsWith('caisses'),'pos'],[n=>n.startsWith('encodeur'),'access'],[n=>n.startsWith('switching'),'switch'],
  [n=>n==='pabx','pabx'],[n=>n.startsWith('nvr'),'camera'],[n=>n==='wifi'||n==='wi-fi','wifi']
 ];
 const sectionOf=title=>{const n=norm(title);for(const [test,key] of SECTION_RULES)if(test(n))return key;return null;};
 const isHeader=r=>r.some(c=>/^(num\.? ?serie|model|marque|mar\.)/i.test(String(c).trim()));
 function parseItSheet(rows){
  const out=[];let section=null,place=null;
  for(const r of rows){
   const filled=r.map((v,i)=>v?i:-1).filter(i=>i>=0);
   if(!filled.length)continue;
   // A line with only column B is a section title.
   if(filled.length===1&&filled[0]===1){section=sectionOf(r[1]);place=null;continue;}
   if(isHeader(r)){if(section==='switch'&&r[1]&&!/^(service|position)$/i.test(r[1]))place=r[1];continue;}
   const B=r[1],C=r[2],D=r[3],E=r[4],F=r[5],G=r[6],H=r[7],I=r[8];
   switch(section){
    case 'pc':{
     if(!(isNo(E)&&isNo(F)))out.push(item({type:'pc',name:`PC ${B}`,location:B,brand_model:isNo(E)?null:E,serial:F}));
     if(H&&!isNo(H))out.push(item({type:'monitor',name:`Écran ${B}`,location:B,brand_model:H,serial:I}));
     break;}
    case 'laptop':out.push(item({type:'laptop',name:`Laptop ${B}`,location:B,brand_model:E,serial:F}));break;
    case 'tablet':out.push(item({type:'tablet',name:`Tablette ${B}`,location:B,brand_model:E,serial:F}));break;
    case 'server':{
     out.push(item({type:'server',name:`Serveur ${B}`,brand_model:C,serial:F,location:'Salle informatique'}));
     if(H&&!isNo(H))out.push(item({type:'monitor',name:`Écran serveur ${B}`,brand_model:H,serial:I,location:'Salle informatique'}));
     break;}
    case 'ups':out.push(item({type:'ups',name:`Onduleur ${B}`,location:B,brand_model:C,serial:F}));break;
    case 'printer':out.push(item({type:'printer',name:`${C||'Imprimante'} ${B}`,location:B,brand_model:D,serial:F||E}));break;
    case 'pos':{
     const kind=norm(B);
     out.push(item({type:/micros/.test(kind)?'pos':/tablette/.test(kind)?'tablet':/imprimante/.test(kind)?'printer':'other',name:B,brand_model:C,serial:D,subtype:'Micros'}));
     break;}
    case 'access':out.push(item({type:'access',name:B,brand_model:C,serial:D,subtype:'VingCard'}));break;
    case 'switch':{
     const n=norm(B);
     // Switches are listed under their rack (Salle Informatique, S. Repartiteur…);
     // the other network devices (load balancer, NAS, firewall) sit in the server room.
     out.push(item({type:/nas/.test(n)?'server':'network',name:B,brand_model:C,serial:D||F,location:(/^switch/.test(n)&&place)||'Salle informatique'}));
     break;}
    case 'pabx':out.push(item({type:'phone',name:B,quantity:qty(G),subtype:'PABX'}));break;
    case 'camera':out.push(item({type:'camera',name:B,quantity:qty(G)}));break;
    case 'wifi':out.push(item({type:(/^ap\b/.test(norm(B))||/borne/.test(norm(B)))?'wifi':'network',name:B,quantity:qty(G),subtype:'Wi-Fi'}));break;
    default:break;
   }
  }
  return out.filter(row=>row.name);
 }
 function parseWorkbook(sheets){
  const result=[];
  for(const sheet of sheets||[]){
   const domain=domainOf(sheet.name);if(!domain)continue;
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
 function guessHotel(fileName,hotels){
  const words=norm(String(fileName||'').replace(/\.[a-z0-9]+$/i,'')).split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!['inventaire','materiels','materiel','hotel','onomo'].includes(w));
  return (hotels||[]).find(h=>words.some(w=>norm(h).includes(w)))||'';
 }

 root.InventoryImport={readXlsx,parseWorkbook,parseItSheet,parseTechnicalSheet,domainOf,plan,guessHotel};
})(typeof window!=='undefined'?window:globalThis);

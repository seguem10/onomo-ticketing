const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const zlib=require('node:zlib');

function loadImporter(){
  const ctx={TextDecoder,Blob,Response,DecompressionStream,Uint8Array,Number,String,Map,Set,Array,Promise,Error,Math,JSON};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/js/inventory-import.js','utf8'),ctx);
  return ctx.InventoryImport;
}
const plain=value=>JSON.parse(JSON.stringify(value));

// Minimal .xlsx (zip) writer for the tests: deflated entries + central directory.
function crc32(buf){let c,crc=0xFFFFFFFF;for(const b of buf){c=(crc^b)&0xFF;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xFFFFFFFF)>>>0;}
function zip(files){
  const locals=[],centrals=[];let offset=0;
  for(const [name,content] of Object.entries(files)){
    const raw=Buffer.from(content,'utf8'),data=zlib.deflateRawSync(raw),nameBuf=Buffer.from(name);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);
    local.writeUInt32LE(crc32(raw),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(nameBuf.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);
    central.writeUInt32LE(crc32(raw),16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(nameBuf.length,28);central.writeUInt32LE(offset,42);
    locals.push(local,nameBuf,data);centrals.push(central,nameBuf);offset+=30+nameBuf.length+data.length;
  }
  const cd=Buffer.concat(centrals),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
  const out=Buffer.concat([...locals,cd,end]);return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
const cellXml=(ref,v,shared)=>typeof v==='number'?`<c r="${ref}"><v>${v}</v></c>`:`<c r="${ref}" t="s"><v>${shared.indexOf(v)}</v></c>`;
function workbook(sheets){
  const shared=[...new Set(Object.values(sheets).flat(2).filter(v=>typeof v==='string'&&v))];
  const files={'xl/workbook.xml':`<workbook xmlns:r="r"><sheets>${Object.keys(sheets).map((n,i)=>`<sheet name="${n.replace(/&/g,'&amp;')}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<Relationships>${Object.keys(sheets).map((n,i)=>`<Relationship Id="rId${i+1}" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`,
    'xl/sharedStrings.xml':`<sst>${shared.map(s=>`<si><t>${s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</t></si>`).join('')}</sst>`};
  Object.values(sheets).forEach((rows,i)=>{
    files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet><sheetData>${rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>v===''?'':cellXml(String.fromCharCode(65+ci)+(ri+1),v,shared)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  });
  return zip(files);
}
const H=['','Equipment Name','Type of Equipment','Manufacturer','Model','Location(s)','Quantity','Docs Provided','','Examples of Types of Equipment'];
const itRows=[
  ['','Ordinateurs, Serveur , Laptop & Tab'],
  ['','Ordinateurs'],
  ['','Service','','','Mar. U. Central','Num. Serie','','Mar. Ecran','Num. Serie'],
  ['','Comptabilité','','','Dell','HKYYZS2','','HP','CNC512P496'],
  ['','D.G','','','NON','NON','','HP','3CM90113MM'],
  ['','Music ','','','Dell','NON','','Non',''],
  ['','Laptop'],
  ['','Service','','','Mar. Laptop','Num. Serie'],
  ['','IT Manager','','','Dell','7BWCBK3'],
  ['','SERVEUR'],
  ['','Serveur','Marque','','','Num. Serie','','Ecran','Num. Serie'],
  ['','simfony','Dell','','','CN-00HRHC','','Dell','CN01M2XX'],
  ['','Onduleur - Fax - Imprimante & Photo'],
  ['','Onduleur'],
  ['','Position','Marque Onduleur','','','Num. Serie'],
  ['','TGBT','Eaton ','','','G425L35070'],
  ['','Caisses & Imprimantes Micros'],
  ['','','Model','Num. Serie'],
  ['','Micros','610 5A','9024115794'],
  ['','Imprimante IP','Epson M244A','NKCF344595'],
  ['','Switching & Access Controller'],
  ['','S. Repartiteur 1','Model','Num. Serie'],
  ['','Switch HP','1410-16- J9662A','CN3BDY00G7'],
  ['','NAS','Synology','','','1650NLN422104'],
  ['','PABX'],
  ['','postes 4019','','','','',7],
  ['','NVR & Camera '],
  ['','Camera HIKVISION','','','','',81],
  ['','WiFi'],
  ['','AP Ruckus R320','','','','',40],
  ['','Controleur Ruckus ZD1200','','','','',1]
];

test('the .xlsx reader returns each tab with its rows and shared strings',async()=>{
  const api=loadImporter();
  const sheets=await api.readXlsx(workbook({'05. IT':itRows.slice(0,4),'Utilisateurs':[['NOM','Prénom']]}));
  assert.deepEqual(plain(sheets.map(s=>s.name)),['05. IT','Utilisateurs']);
  assert.deepEqual(plain(sheets[0].rows[3]),['','Comptabilité','','','Dell','HKYYZS2','','HP','CNC512P496']);
  await assert.rejects(api.readXlsx(new Uint8Array([1,2,3]).buffer),/archive invalide/);
});

test('the IT tab sections become typed rows: PCs with their screens, bulk quantities, racks as locations',()=>{
  const api=loadImporter();
  const rows=plain(api.parseItSheet(itRows));
  const pick=name=>rows.filter(r=>r.name===name);
  assert.deepEqual([pick('PC Comptabilité')[0].type,pick('PC Comptabilité')[0].serial,pick('Écran Comptabilité')[0].serial],['pc','HKYYZS2','CNC512P496']);
  assert.equal(pick('PC D.G').length,0);assert.equal(pick('Écran D.G')[0].brand_model,'HP');
  assert.equal(pick('PC Music')[0].serial,null);assert.equal(pick('Écran Music').length,0);
  assert.equal(pick('Laptop IT Manager')[0].type,'laptop');
  assert.equal(pick('Écran serveur simfony')[0].type,'monitor');
  assert.deepEqual([pick('Onduleur TGBT')[0].type,pick('Onduleur TGBT')[0].brand_model],['ups','Eaton']);
  assert.deepEqual([pick('Micros')[0].type,pick('Imprimante IP')[0].type],['pos','printer']);
  assert.deepEqual([pick('Switch HP')[0].location,pick('NAS')[0].type,pick('NAS')[0].serial],['S. Repartiteur 1','server','1650NLN422104']);
  assert.deepEqual([pick('postes 4019')[0].quantity,pick('Camera HIKVISION')[0].quantity,pick('AP Ruckus R320')[0].type,pick('Controleur Ruckus ZD1200')[0].type],[7,81,'wifi','network']);
  assert.ok(rows.every(r=>r.domain==='it'&&r.status==='in_service'));
});

test('technical tabs use their header; a year in "Model" goes to the notes',async()=>{
  const api=loadImporter();
  const sheets=await api.readXlsx(workbook({
    '01. Mecanique':[H,['','ventilo convecteur intr','VRV','mitsubishi',2015,'Chambres+',118,'Fiche Technique','','Air Conditioner'],['','','','','','','','','','Boiler']],
    'Systeme Incendie':[H,['','Central incendie','alarme','NUGELEC','X-200','PC',1,'']],
    'Espaces':[['','Catégorie/ Type','Etage'],['Ascenseur 1','Ascenseur','TOUT NIVEAU']],
    '05. IT':itRows
  }));
  const parsed=plain(api.parseWorkbook(sheets));
  assert.deepEqual(parsed.map(p=>[p.sheet,p.domain,p.rows.length]),[['01. Mecanique','mechanical',1],['Systeme Incendie','fire',1],['05. IT','it',16]]);
  const vrv=parsed[0].rows[0];
  assert.deepEqual([vrv.name,vrv.subtype,vrv.brand_model,vrv.quantity,vrv.documents,vrv.notes,vrv.type],['ventilo convecteur intr','VRV','mitsubishi',118,'Fiche Technique','Année : 2015','other']);
  assert.equal(parsed[1].rows[0].brand_model,'NUGELEC X-200');
});

test('importing twice adds nothing: serials first, otherwise name + location + model, duplicates counted',()=>{
  const api=loadImporter();
  const rows=[{name:'PC Music',location:'Music',brand_model:'Dell',serial:null},{name:'PC Music',location:'Music',brand_model:'Dell',serial:null},{name:'PC Compta',serial:'abc'},{name:'Nouveau',serial:'NEW1'}];
  const existing=[{name:'PC Music',location:'Music',brand_model:'Dell',serial:null},{name:'Autre nom',serial:'ABC'}];
  const {fresh,skipped}=api.plan(rows,existing);
  assert.deepEqual(plain(fresh.map(r=>r.name)),['PC Music','Nouveau']);assert.equal(skipped.length,2);
  assert.equal(api.guessHotel('Inventaire Materiels IT - Terminus.xlsx',['ONOMO Hotel Dakar','ONOMO Hotel Rabat Terminus']),'ONOMO Hotel Rabat Terminus');
  assert.equal(api.guessHotel('inventaire.xlsx',['ONOMO Hotel Dakar']),'');
});

test('the inventory page previews an import, then sends only the new rows for the chosen hotel',async()=>{
  const importer=loadImporter();
  const elements={mainContent:{innerHTML:''}};
  const calls=[],toasts=[];
  const ctx={console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Map,Date,Number,Math,encodeURIComponent,
    currentUser:{role:'it_hotel'},currentView:'assets',tickets:[],userHotels:()=>['ONOMO Hotel Rabat Terminus'],canManageTickets:()=>true,
    showToast:(m,k)=>toasts.push([m,k]),document:{getElementById:id=>elements[id]||null}};
  ctx.window={InventoryImport:importer,sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return options.method==='POST'?JSON.parse(options.body).map((r,i)=>({id:`n${i}`,...r})):[];}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/js/asset-inventory.js','utf8'),ctx);
  const api=ctx.window.AssetInventory;
  api._set([{id:'a1',hotel:'ONOMO Hotel Rabat Terminus',name:'PC Comptabilité',serial:'HKYYZS2',domain:'it'}],[]);
  const bytes=workbook({'05. IT':itRows,'01. Mecanique':[H,['','ventilo convecteur intr','VRV','mitsubishi',2015,'Chambres+',118,'']]});
  assert.equal(await api.importFile({name:'Inventaire Materiels IT - Terminus.xlsx',arrayBuffer:async()=>bytes}),true);
  let out=elements.mainContent.innerHTML;
  assert.ok(out.includes('16 équipement(s) à ajouter · 1 déjà présent(s)'));assert.ok(out.includes('Mécanique'));
  api.toggleImportDomain('mechanical');
  out=elements.mainContent.innerHTML;assert.ok(out.includes('15 équipement(s) à ajouter · 1 déjà présent(s)'));
  assert.equal(await api.confirmImport(),true);
  const post=calls.find(c=>c[1]==='POST');
  assert.equal(post[0],'assets');assert.equal(post[2].length,15);
  assert.ok(post[2].every(r=>r.hotel==='ONOMO Hotel Rabat Terminus'&&r.domain==='it'));
  assert.ok(!post[2].some(r=>r.serial==='HKYYZS2'));
  assert.match(toasts.at(-1)[0],/15 équipement\(s\) importé\(s\)/);
});

test('the database accepts the workbook fields and the new IT types',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261125090000_assets_domains.sql','utf8');
  for(const fragment of ["check (domain in ('it', 'mechanical', 'electrical', 'plumbing', 'fire', 'elevator', 'kitchen', 'architecture', 'other'))",
    "check (type in ('pc', 'laptop', 'monitor', 'tablet', 'printer', 'network', 'wifi', 'server', 'ups', 'phone', 'camera', 'access', 'tv', 'pos', 'other'))",
    'check (quantity between 1 and 100000)','grant insert (domain, subtype, quantity, documents) on public.assets to authenticated;'])assert.ok(sql.includes(fragment),fragment);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('assets/js/inventory-import.js')<html.indexOf('assets/js/asset-inventory.js'));
});

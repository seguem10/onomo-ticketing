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

test('rich text runs are joined and escaped characters are decoded once',async()=>{
  const api=loadImporter();
  const files={'xl/workbook.xml':'<workbook xmlns:r="r"><sheets><sheet name="05. IT" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml':'<sst><si><r><rPr><b/></rPr><t>Canon </t></r><r><t xml:space="preserve">&amp;lt;i-sensys&amp;gt; &amp; Co</t></r></si></sst>',
    'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row r="1"><c r="B1" t="s"><v>0</v></c><c r="C1" t="inlineStr"><is><t>A &amp; B</t></is></c><c r="D1"><v>42</v></c></row></sheetData></worksheet>'};
  const sheets=await api.readXlsx(zip(files));
  assert.deepEqual(plain(sheets[0].rows[0]),['','Canon &lt;i-sensys&gt; & Co','A & B','42']);
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

test('other hotels’ variants: English labels, a quantity column, users, purchase years and a file shifted to column A',async()=>{
  const api=loadImporter();
  const english=[
    ['','','"O\'Hotel" IT Equipment Inventory'],
    ['','Computers, Server, Laptop & Tablet'],
    ['','Computers','','','','','','','','Screen Make'],
    ['Qty','Username','Name of the person in charge','','Make','Serial No.','Purchase Date','','','Screen Make','Serial No.','','Date of purchase'],
    ['','hotela','Miskha','','LENOVO 10TX000LSA','YL009LRC',2019,'','','Lenovo','VKW41571','',2019],
    ['','maint','Franco','','HP ProOne 600 G2','CZC7097HQP',2017,'All in one'],
    ['1','','','','','',''],
    ['','SERVER'],
    ['','Server','Brand','','','Serial No.','','Screen','Serial No.','','Date of purchase'],
    ['1','Host 1','Dell PowerEdge R540','','','1MSM9W2','','LG','603NTBK4K573','',2019],
    ['','Inverter - Fax - Printer & Photocopier'],
    ['','INVERTER\\UPS'],
    ['','LOCATION','BRAND','','','SERIAL NUMBER'],
    ['','IT ROOM','RIELLO UPS MST 10 S2','','','MZ10UT220470002'],
    ['','SWITSCHES\\ROUTERS'],
    ['','SERVER ROOM','MODEL','SERIAL NUMBER'],
    ['1','Switch HP','HPE 1920-8G-PoE+','','CN73GP2194'],
    ['','PABX'],
    ['','Model','','Total'],
    ['','Yealink T41S','',16],
    ['','Cloud'],
    ['','DVR-NVR & Camera'],
    ['','Name','Serial number / Model','Total'],
    ['','CCTV BRAND: DAHUA'],
    ['','Dahua 2MP Dome','IPC-HDBW2231R-ZS',53],
    ['','WiFi'],
    ['','Model','','Total'],
    ['','Aruba 207 AP','',50],
    ['','APG Outdoor unifi','',4]
  ];
  const shifted=[
    ['Ordinateurs, Serveur , Laptop & Tab'],
    ['Ordinateurs'],
    ['Service','','','Mar. U. Central','Num. Serie','','Mar. Ecran','Num. Serie'],
    ['reception 1','','','delle','','','delle',''],
    ['Onduleur'],
    ['Position','Marque Onduleur','','','Num. Serie'],
    ['Bureaux','APC BV650I','','','']
  ];
  const parsed=plain(api.parseWorkbook(await api.readXlsx(workbook({' Sheet 1':english,'Feuil1':shifted}))));
  assert.deepEqual(parsed.map(p=>[p.sheet,p.domain]),[[' Sheet 1','it'],['Feuil1','it']]);
  const rows=parsed[0].rows,by=name=>rows.find(r=>r.name===name);
  assert.deepEqual([by('PC hotela – Miskha').serial,by('PC hotela – Miskha').notes,by('Écran hotela – Miskha').serial],['YL009LRC','Achat : 2019','VKW41571']);
  assert.equal(rows.filter(r=>r.name.startsWith('Écran maint')).length,0,'an all-in-one has no separate screen');
  assert.deepEqual([by('Serveur Host 1').serial,by('Écran serveur Host 1').serial],['1MSM9W2','603NTBK4K573']);
  assert.deepEqual([by('Onduleur IT ROOM').brand_model,by('Onduleur IT ROOM').serial],['RIELLO UPS MST 10 S2','MZ10UT220470002']);
  assert.deepEqual([by('Switch HP').serial,by('Switch HP').location],['CN73GP2194','SERVER ROOM'],'a serial typed one column too far right');
  assert.deepEqual([by('Yealink T41S').quantity,by('Dahua 2MP Dome').quantity,by('Dahua 2MP Dome').brand_model],[16,53,'IPC-HDBW2231R-ZS']);
  assert.deepEqual([by('Aruba 207 AP').type,by('Aruba 207 AP').quantity,by('APG Outdoor unifi').type],['wifi',50,'wifi']);
  assert.ok(!rows.some(r=>r.name==='Cloud'||/CCTV BRAND/.test(r.name)));
  const left=parsed[1].rows;
  assert.deepEqual(plain(left.map(r=>[r.name,r.brand_model])),[['PC reception 1','delle'],['Écran reception 1','delle'],['Onduleur Bureaux','APC BV650I']]);
});

test('file names map to hotels, with short names and ambiguous names left to the user',()=>{
  const api=loadImporter();
  const hotels=['ONOMO Allure Abidjan Baobab','ONOMO Hotel Abidjan Airport','ONOMO Hotel Cape Town - Inn On The Square','Le Square by ONOMO Collection','ONOMO Hotel CASA CITY CENTER','ONOMO Hotel Dar Es Salaam','ONOMO Hotel Cape Town Foreshore'];
  const cases=[['Inventaire Materiels IT -Abidjan Airport.xlsx','ONOMO Hotel Abidjan Airport'],['Inventaire Materiels IT -Abidjan Allure Baobab.xlsx','ONOMO Allure Abidjan Baobab'],
    ['Inventaire Materiels IT-abidjan.xlsx',''],['IT Inventory - IOTS.xlsx','ONOMO Hotel Cape Town - Inn On The Square'],['Inventaire Materiels IT- OCCC.xlsx','ONOMO Hotel CASA CITY CENTER'],
    ["Inventaire Materiels IT O'Dar es Salaam.xlsx",'ONOMO Hotel Dar Es Salaam'],['IT Inventory - Foreshore.xlsx','ONOMO Hotel Cape Town Foreshore'],['Inventaire Materiels IT -MIDP.xlsx','']];
  for(const [file,hotel] of cases)assert.equal(api.guessHotel(file,hotels),hotel,file);
});

test('the database accepts the workbook fields and the new IT types',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261125090000_assets_domains.sql','utf8');
  for(const fragment of ["check (domain in ('it', 'mechanical', 'electrical', 'plumbing', 'fire', 'elevator', 'kitchen', 'architecture', 'other'))",
    "check (type in ('pc', 'laptop', 'monitor', 'tablet', 'printer', 'network', 'wifi', 'server', 'ups', 'phone', 'camera', 'access', 'tv', 'pos', 'other'))",
    'check (quantity between 1 and 100000)','grant insert (domain, subtype, quantity, documents) on public.assets to authenticated;'])assert.ok(sql.includes(fragment),fragment);
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('assets/js/inventory-import.js')<html.indexOf('assets/js/asset-inventory.js'));
});

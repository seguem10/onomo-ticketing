const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function loadAll({existing=[]}={}){
  const elements={mainContent:{innerHTML:''}};
  const calls=[],toasts=[];
  const ctx={console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Date,Number,encodeURIComponent,setTimeout,Object,
    currentUser:{role:'it_hotel'},currentView:'maintenance',tickets:[],userHotels:()=>['ONOMO Hotel Rabat Terminus'],canManageTickets:()=>true,
    showToast:(m,k)=>toasts.push([m,k]),document:{getElementById:id=>elements[id]||null}};
  ctx.window={sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return options.method==='POST'?JSON.parse(options.body).map((r,i)=>({id:`p${i}`,...r})):existing;}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/js/maintenance-templates.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('assets/js/maintenance-plans.js','utf8'),ctx);
  return {cat:ctx.window.MaintenanceTemplates,api:ctx.window.MaintenancePlans,elements,calls,toasts};
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('the catalogue only uses values the database accepts, with unique keys and titles',()=>{
  const {cat}=loadAll();
  const sql=fs.readFileSync('supabase/migrations/20261123120000_maintenance_plans.sql','utf8');
  const keys=new Set(),titles=new Set();
  for(const t of cat.TEMPLATES){
    assert.ok(!keys.has(t.key)&&!titles.has(t.title),t.key);keys.add(t.key);titles.add(t.title);
    assert.ok(sql.includes(`'${t.frequency}'`),t.frequency);assert.ok(sql.includes(`'${t.priority}'`),t.priority);assert.ok(sql.includes(`'${t.category}'`),t.category);
    assert.ok(t.title.length>=3&&t.title.length<=150&&t.description.length<=2000,t.key);
    assert.ok(cat.GROUPS[t.group],t.group);
  }
  assert.ok(cat.TEMPLATES.filter(t=>t.group==='it').length>=10);
});

test('building plans skips titles already in place and spreads the first due dates',()=>{
  const {cat}=loadAll();
  const plans=plain(cat.build(['backup-check','os-updates','cold-rooms','wifi'],'H1','2026-12-01',[{hotel:'H1',title:'Mises à jour des postes et serveurs'},{hotel:'H2',title:'Vérifier les sauvegardes (NAS)'}]));
  assert.deepEqual(plans.map(p=>[p.title,p.next_due]),[['Vérifier les sauvegardes (NAS)','2026-12-01'],['Wi-Fi : contrôleur et bornes','2026-12-02'],['Chambres froides : relevé des températures','2026-12-01']]);
  assert.ok(plans.every(p=>p.hotel==='H1'&&p.active===true));
  assert.equal(plain(cat.build(['backup-check'],'H1','2026-12-31',[]))[0].next_due,'2026-12-31');
});

test('the page offers the templates, IT ticked by default, and creates the chosen plans in one request',async()=>{
  const {api,cat,elements,calls,toasts}=loadAll({existing:[{id:'x',hotel:'ONOMO Hotel Rabat Terminus',title:'Vérifier les sauvegardes (NAS)',next_due:'2026-12-01',frequency:'monthly',category:'IT / Réseau',priority:'Haute',active:true}]});
  await api.load();api.render();
  assert.ok(elements.mainContent.innerHTML.includes('Modèles prêts à l’emploi'));
  api.openTemplates();
  let out=elements.mainContent.innerHTML;
  const itCount=cat.TEMPLATES.filter(t=>t.group==='it').length;
  assert.ok(out.includes('déjà en place'));
  assert.ok(out.includes(`Créer ${itCount-1} plan(s)`));
  api.selectGroup('kitchen',true);api.toggleTemplate('wifi');
  out=elements.mainContent.innerHTML;assert.ok(out.includes(`Créer ${itCount-1-1+2} plan(s)`));
  assert.equal(await api.applyTemplates(),true);
  const post=calls.find(c=>c[1]==='POST');
  assert.equal(post[0],'maintenance_plans');assert.equal(post[2].length,itCount);
  assert.ok(!post[2].some(p=>p.title==='Vérifier les sauvegardes (NAS)'||p.title==='Wi-Fi : contrôleur et bornes'));
  assert.match(toasts.at(-1)[0],new RegExp(`${itCount} plan\\(s\\) de maintenance créé\\(s\\)`));
  assert.equal(api._templating(),null);
});

test('the templates script loads before the maintenance page',()=>{
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('assets/js/maintenance-templates.js')>0);
  assert.ok(html.indexOf('assets/js/maintenance-templates.js')<html.indexOf('assets/js/maintenance-plans.js'));
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/asset-inventory.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
const DAY=86400000;

function load({role='it_hotel',hotels=['Onomo Dakar'],fetch,confirm=true,ticketList=[]}={}){
  const elements={mainContent:{innerHTML:''},ticketAsset:{innerHTML:''}};
  const values={};
  const calls=[],toasts=[];
  const ctx={
    console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Map,Date,Number,Math,encodeURIComponent,
    currentUser:{auth_user_id:'u1',role},currentView:'assets',tickets:ticketList,
    userHotels:()=>hotels,canManageTickets:u=>['admin','it_regional','it_hotel'].includes(u?.role),
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>elements[id]||(id in values?{value:values[id]}:null)}
  };
  ctx.window={confirm:()=>confirm,sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return fetch?fetch(path,options):[];}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.AssetInventory,elements,values,calls,toasts};
}
const now=Date.now();
const assets=[
  {id:'a1',hotel:'Onomo Dakar',name:'PC Réception 1',type:'pc',status:'in_service',location:'Réception',warranty_until:'2020-01-01'},
  {id:'a2',hotel:'Onomo Dakar',name:'Imprimante <Back>',type:'printer',status:'repair',serial:'SN-42'},
  {id:'a3',hotel:'Onomo Lomé',name:'Borne Wi-Fi Lobby',type:'wifi',status:'retired'}
];
const ticketList=[
  {id:'t1',hotel:'Onomo Dakar',created_at:new Date(now-5*DAY).toISOString()},
  {id:'t2',hotel:'Onomo Dakar',created_at:new Date(now-20*DAY).toISOString()},
  {id:'t3',hotel:'Onomo Dakar',created_at:new Date(now-200*DAY).toISOString()},
  {id:'t4',hotel:'Onomo Dakar',created_at:new Date(now-1*DAY).toISOString()}
];
const links=[{ticket_id:'t1',asset_id:'a2'},{ticket_id:'t2',asset_id:'a2'},{ticket_id:'t3',asset_id:'a2'},{ticket_id:'t4',asset_id:'a2'},{ticket_id:'t3',asset_id:'a1'}];

test('ticket counts separate the last 90 days, and the most broken items come first',()=>{
  const {api}=load({ticketList});api._set(assets,links);
  assert.deepEqual({...api.incidents('a2',now)},{total:4,recent:3});
  assert.deepEqual({...api.incidents('a1',now)},{total:1,recent:0});
  const top=api.topBreakdowns();assert.equal(top.length,1);assert.equal(top[0].row.id,'a2');
});

test('warranty dates are flagged when expired or ending within 60 days',()=>{
  const {api}=load();
  const ref=new Date('2026-11-23T12:00:00');
  assert.equal(api.warrantyState({warranty_until:'2026-11-01'},ref),'expired');
  assert.equal(api.warrantyState({warranty_until:'2026-12-15'},ref),'soon');
  assert.equal(api.warrantyState({warranty_until:'2027-06-01'},ref),'');
  assert.equal(api.warrantyState({},ref),'');
});

test('the page lists escaped equipment, filters it, and is refused to non-IT users',()=>{
  const h=load({ticketList});h.api._set(assets,links);h.api.render();
  let out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('Imprimante &lt;Back&gt;'));assert.ok(!out.includes('<Back>'));
  assert.ok(out.includes('Les plus souvent en panne'));assert.ok(out.includes('class="inv-hot"'));
  assert.ok(out.includes('inv-warranty expired'));
  h.api.setFilter('q','sn-42');out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('Imprimante'));assert.ok(!out.includes('PC Réception 1</strong>'));
  h.api.setFilter('q','');h.api.setFilter('type','wifi');out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('Borne Wi-Fi Lobby'));assert.ok(!out.includes('PC Réception 1</strong>'));
  const requester=load({role:'demandeur'});requester.api.render();
  assert.match(requester.elements.mainContent.innerHTML,/Réservé à l’équipe IT/);assert.equal(requester.calls.length,0);
});

test('equipment is created and updated with clean values; name and hotel are required',async()=>{
  const h=load({fetch:(path,options)=>[{id:'n1',...JSON.parse(options.body)}]});h.api._set([],[]);
  h.api.edit('new');
  Object.assign(h.values,{invName:'',invHotel:'Onomo Dakar',invType:'pc',invStatus:'in_service',invLocation:'',invModel:'',invSerial:'',invPurchased:'',invWarranty:'',invNotes:''});
  assert.equal(await h.api.save(),false);assert.equal(h.calls.length,0);assert.equal(h.toasts[0][1],'err');
  Object.assign(h.values,{invName:'  PC Bar  ',invType:'hack',invLocation:' Bar ',invWarranty:'2027-01-31'});
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[0],['assets','POST',{name:'PC Bar',hotel:'Onomo Dakar',type:'other',status:'in_service',location:'Bar',brand_model:null,serial:null,purchased_on:null,warranty_until:'2027-01-31',notes:null}]);
  h.api.edit('n1');Object.assign(h.values,{invName:'PC Bar',invType:'pc',invStatus:'repair'});
  assert.equal(await h.api.save(),true);
  assert.equal(h.calls[1][0],'assets?id=eq.n1');assert.equal(h.calls[1][1],'PATCH');assert.equal(h.calls[1][2].status,'repair');
});

test('a refused delete is reported; a confirmed one also drops the links',async()=>{
  const refused=load({fetch:()=>[]});refused.api._set([...assets],[...links]);
  assert.equal(await refused.api.remove('a1'),false);assert.equal(refused.toasts.at(-1)[1],'err');
  const ok=load({fetch:()=>[{id:'a2'}],ticketList});ok.api._set([...assets],[...links]);
  assert.equal(await ok.api.remove('a2'),true);assert.deepEqual({...ok.api.incidents('a2')},{total:0,recent:0});
  const declined=load({confirm:false});declined.api._set([...assets],[]);
  assert.equal(await declined.api.remove('a1'),false);assert.equal(declined.calls.length,0);
});

test('a ticket offers equipment of its own hotel only, and links and unlinks it',async()=>{
  const h=load({fetch:(path,options)=>options.method==='DELETE'?[{ticket_id:'t9',asset_id:'a1'}]:[JSON.parse(options.body)]});
  h.api._set(assets,[]);
  h.api.mountTicket({id:'t9',hotel:'Onomo Dakar'});
  let out=h.elements.ticketAsset.innerHTML;
  assert.ok(out.includes('value="a1"'));assert.ok(out.includes('value="a2"'));assert.ok(!out.includes('value="a3"'));
  h.values.invTicketAsset='a1';
  assert.equal(await h.api.link(),true);
  assert.deepEqual(h.calls[0],['ticket_assets','POST',{ticket_id:'t9',asset_id:'a1'}]);
  out=h.elements.ticketAsset.innerHTML;assert.ok(out.includes('inv-chip'));assert.ok(!out.includes('value="a1"'));
  assert.equal(await h.api.unlink('a1'),true);
  assert.deepEqual(h.calls[1].slice(0,2),['ticket_assets?ticket_id=eq.t9&asset_id=eq.a1','DELETE']);
  const requester=load({role:'demandeur'});requester.api.mountTicket({id:'t9',hotel:'Onomo Dakar'});
  assert.equal(requester.elements.ticketAsset.innerHTML,'');
});

test('the database limits the inventory to technicians of the hotel',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261123090000_asset_inventory.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'revoke all on public.assets from anon, authenticated;',
    "using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));",
    'exists (select 1 from public.assets a join public.tickets t on t.hotel = a.hotel',
    'primary key (ticket_id, asset_id)',
    "check (type in ('pc', 'laptop', 'printer', 'network', 'wifi', 'server', 'phone', 'tv', 'pos', 'other'))"
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the menu entry, both renderView maps and the ticket page are wired',()=>{
  assert.ok(html.includes(`data-view="assets" onclick="switchView('assets',this)" style="display:none"`));
  assert.ok(html.includes(`if(assetsNav)assetsNav.style.display=navAccess.support?"flex":"none";`));
  assert.ok(html.includes('assets:()=>globalThis.AssetInventory?.render()'));
  const override=html.slice(html.indexOf('renderView = function(){'));
  assert.ok(override.slice(0,2800).includes('assets: () => globalThis.AssetInventory?.render()'));
  assert.ok(override.slice(0,500).includes("'client-errors','assets'];"));
  assert.ok(html.includes(`\${canEdit?'<div id="ticketAsset"></div>':''}`));
  assert.ok(html.includes('if(canEdit)globalThis.AssetInventory?.mountTicket(t);'));
});

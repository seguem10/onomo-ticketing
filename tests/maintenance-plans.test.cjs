const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/maintenance-plans.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');

function load({role='it_hotel',hotels=['Onomo Dakar'],fetch,confirm=true,ticketList=[]}={}){
  const elements={mainContent:{innerHTML:''}};
  const values={},checks={mpActive:true};
  const calls=[],toasts=[],renders=[];
  const ctx={
    console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Date,Number,encodeURIComponent,setTimeout,
    currentUser:{auth_user_id:'u1',role},currentView:'maintenance',tickets:ticketList,
    userHotels:()=>hotels,canManageTickets:u=>['admin','it_regional','it_hotel'].includes(u?.role),
    renderView:()=>renders.push('renderView'),
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>elements[id]||(id in checks?{checked:checks[id]}:id in values?{value:values[id]}:null)}
  };
  ctx.window={confirm:()=>confirm,sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return fetch?fetch(path,options):[];}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.MaintenancePlans,ctx,elements,values,checks,calls,toasts,renders};
}
const plans=[
  {id:'p1',hotel:'Onomo Dakar',title:'Vérifier les sauvegardes <NAS>',category:'IT / Réseau',priority:'Normale',frequency:'monthly',next_due:'2000-01-01',active:true,last_ticket_id:'t1'},
  {id:'p2',hotel:'Onomo Dakar',title:'Tester les onduleurs',category:'Maintenance',priority:'Haute',frequency:'quarterly',next_due:'2999-01-01',active:false}
];

test('the page lists plans escaped, flags due ones and paused ones, and links the last ticket',()=>{
  const h=load({ticketList:[{id:'t1',numero:'#000042'}]});h.api._set(plans);h.api.render();
  const out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('Vérifier les sauvegardes &lt;NAS&gt;'));assert.ok(!out.includes('<NAS>'));
  assert.ok(out.includes('mp-badge mp-due'));assert.ok(out.includes('En pause'));
  assert.ok(out.includes('#000042'));assert.ok(out.includes('Chaque trimestre'));
  const requester=load({role:'demandeur'});requester.api.render();
  assert.match(requester.elements.mainContent.innerHTML,/Réservé à l’équipe IT/);assert.equal(requester.calls.length,0);
});

test('a plan is created with checked values; missing fields are refused',async()=>{
  const h=load({fetch:(path,options)=>[{id:'n1',...JSON.parse(options.body)}]});h.api._set([]);
  h.api.edit('new');
  Object.assign(h.values,{mpTitle:'ab',mpHotel:'Onomo Dakar',mpFrequency:'monthly',mpNext:'2026-12-01',mpCategory:'IT / Réseau',mpPriority:'Normale',mpDescription:''});
  assert.equal(await h.api.save(),false);assert.equal(h.calls.length,0);
  Object.assign(h.values,{mpTitle:' Vérifier les sauvegardes ',mpFrequency:'daily',mpCategory:'x',mpPriority:'y'});
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[0],['maintenance_plans','POST',{title:'Vérifier les sauvegardes',hotel:'Onomo Dakar',frequency:'monthly',next_due:'2026-12-01',category:'IT / Réseau',priority:'Normale',description:null,active:true}]);
});

test('pausing, resuming and a refused delete',async()=>{
  const h=load({fetch:(path,options)=>options.method==='PATCH'?[{...plans[1],...JSON.parse(options.body)}]:[]});h.api._set([...plans]);
  assert.equal(await h.api.toggleActive('p2'),true);
  assert.deepEqual(h.calls[0],['maintenance_plans?id=eq.p2','PATCH',{active:true}]);
  assert.equal(await h.api.remove('p1'),false);assert.equal(h.toasts.at(-1)[1],'err');
  const declined=load({confirm:false});declined.api._set([...plans]);
  assert.equal(await declined.api.remove('p1'),false);assert.equal(declined.calls.length,0);
});

test('due plans become tickets added to the list; nothing runs for non-IT users or twice',async()=>{
  const h=load({ticketList:[{id:'old'}],fetch:path=>{
    if(path==='rpc/run_due_maintenance_plans')return [{plan_id:'p1',ticket_id:'t9',numero:'#000009'}];
    if(path.startsWith('tickets?id=in.'))return [{id:'t9',numero:'#000009'}];
    return [plans[0]];
  }});
  const rows=await h.api.runOnce(0);
  assert.equal(rows.length,1);
  assert.deepEqual(h.calls.map(c=>c[0]).slice(0,2),['rpc/run_due_maintenance_plans','tickets?id=in.(t9)']);
  assert.deepEqual([...h.ctx.tickets.map(t=>t.id)],['t9','old']);
  assert.match(h.toasts.at(-1)[0],/1 ticket de maintenance créé/);assert.deepEqual(h.renders,['renderView']);
  assert.equal((await h.api.runOnce(0)).length,0);assert.equal(h.calls.filter(c=>c[0].startsWith('rpc/')).length,1);
  const requester=load({role:'demandeur'});await requester.api.runOnce(0);assert.equal(requester.calls.length,0);
  const quiet=load({fetch:()=>[]});await quiet.api.runOnce(0);assert.equal(quiet.toasts.length,0);
});

test('the database creates one ticket per due date, as the caller, within the hotel scope',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261123120000_maintenance_plans.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'revoke all on public.maintenance_plans from anon, authenticated;',
    "where p.active and p.next_due <= current_date and public.user_has_hotel_scope(p.hotel)",
    'for update skip locked',
    'exit when next_date > current_date;',
    "if actor is null or not public.has_permission('ticket:update:all') then",
    'revoke all on function public.run_due_maintenance_plans() from public, anon;',
    "check (category in ('Maintenance', 'IT / Réseau', 'Chambres', 'Restauration', 'Guest relations', 'Sécurité', 'Ménage', 'Autre'))"
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the menu entry, the sign-in trigger and both renderView maps are wired',()=>{
  assert.ok(html.includes(`data-view="maintenance" onclick="switchView('maintenance',this)" style="display:none"`));
  assert.ok(html.includes('if(navAccess.support)globalThis.MaintenancePlans?.runOnce();'));
  assert.ok(html.includes('maintenance:()=>globalThis.MaintenancePlans?.render()'));
  const override=html.slice(html.indexOf('renderView = function(){'));
  assert.ok(override.slice(0,3000).includes('maintenance: () => globalThis.MaintenancePlans?.render()'));
  assert.ok(override.slice(0,520).includes("'assets','maintenance'];"));
});

test('plans are shown by hotel: a selector, one folded section per hotel, or one hotel only',()=>{
  const h=load({role:'it_regional',hotels:['Onomo Dakar','Onomo Abidjan']});
  const store={};h.ctx.localStorage={getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}};
  h.api._set([...plans,{id:'p3',hotel:'Onomo Abidjan',title:'Wi-Fi : bornes',category:'IT / Réseau',priority:'Normale',frequency:'monthly',next_due:'2999-02-01',active:true}]);
  h.api.render();
  let out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('id="mpHotelFilter"'));
  assert.ok(out.includes('Tous les hôtels (3)'));
  assert.ok(out.includes('Onomo Dakar (2)')&&out.includes('Onomo Abidjan (1)'));
  assert.equal((out.match(/<details class="card mp-hotel">/g)||[]).length,2,'one section per hotel');
  assert.ok(out.indexOf('Onomo Abidjan</span>')<out.indexOf('Onomo Dakar</span>'),'hotels in alphabetical order');
  assert.ok(out.includes('2 tâches')&&out.includes('1 échue'));
  assert.ok(!/<th>Hôtel<\/th>/.test(out),'no hotel column inside a hotel section');
  h.api.setHotel('Onomo Abidjan');
  out=h.elements.mainContent.innerHTML;
  assert.equal(store.mpHotelFilter,'Onomo Abidjan','the choice is remembered');
  assert.ok(out.includes('Wi-Fi : bornes')&&!out.includes('Tester les onduleurs'));
  assert.ok(!out.includes('<details'));
  h.api.edit('new');
  assert.match(h.elements.mainContent.innerHTML,/<option value="Onomo Abidjan" selected/,'a new plan starts on the chosen hotel');
});

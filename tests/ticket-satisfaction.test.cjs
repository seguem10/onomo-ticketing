const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/ticket-satisfaction.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');

function load({user={auth_user_id:'u1',email:'req@example.invalid'},fetch}={}){
  const elements={ticketSatisfaction:{innerHTML:''},satisfactionComment:{value:''}};
  const calls=[],toasts=[];
  const ctx={
    console,Promise,encodeURIComponent,JSON,Math,Number,String,Set,
    currentUser:user,
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>elements[id]||null},
    window:{sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return fetch?fetch(path,options):[];}}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.TicketSatisfaction,elements,calls,toasts,ctx};
}
const resolved={id:'t1',statut:'résolu',created_by:'u1'};

test('nothing is shown while a ticket is open',()=>{
  const {api}=load();
  assert.equal(api.html({...resolved,statut:'en_cours'}),'');
});

test('the creator of a resolved ticket is asked for a rating; others see nothing yet',()=>{
  const {api}=load();api._setRows([]);
  assert.match(api.html(resolved),/role="radiogroup"/);
  assert.equal(api.html(resolved,{auth_user_id:'staff'}),'');
});

test('staff see the rating, with the comment escaped',()=>{
  const {api}=load();api._setRows([{ticket_id:'t1',rating:4,comment:'<img src=x>'}]);
  const out=api.html(resolved,{auth_user_id:'staff'});
  assert.match(out,/★★★★☆/);assert.ok(out.includes('&lt;img src=x&gt;'));assert.ok(!out.includes('<img'));
});

test('a first rating is inserted, a later one is updated; no rating is refused',async()=>{
  const h=load({fetch:(path,options)=>[{ticket_id:'t1',...JSON.parse(options.body)}]});
  h.api._setRows([]);h.api.mount(resolved);
  assert.equal(await h.api.submit(),false);assert.equal(h.calls.length,0);assert.equal(h.toasts[0][1],'err');
  h.api.pick(5);h.elements.satisfactionComment.value='  Rapide  ';
  assert.equal(await h.api.submit(),true);
  assert.deepEqual(h.calls[0],['ticket_feedback','POST',{ticket_id:'t1',rating:5,comment:'Rapide'}]);
  h.api.edit();h.api.pick(3);h.elements.satisfactionComment.value='';
  assert.equal(await h.api.submit(),true);
  assert.deepEqual(h.calls[1],['ticket_feedback?ticket_id=eq.t1','PATCH',{rating:3,comment:null}]);
  assert.match(h.elements.ticketSatisfaction.innerHTML,/★★★☆☆/);
});

test('the summary averages only the listed tickets',()=>{
  const {api}=load();
  api._setRows([{ticket_id:'a',rating:5},{ticket_id:'b',rating:4},{ticket_id:'c',rating:1}]);
  const s=api.summary([{id:'a'},{id:'b'}]);
  assert.equal(s.count,2);assert.equal(s.avg,4.5);assert.deepEqual([...s.counts],[0,0,0,1,1]);
  assert.equal(api.agentCell([]),'—');
});

test('the database only lets the ticket creator rate a resolved or closed ticket',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261117110000_ticket_feedback.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'rating smallint not null check (rating between 1 and 5)',
    "revoke all on public.ticket_feedback from anon, authenticated;",
    'grant update (rating, comment) on public.ticket_feedback to authenticated;',
    "and t.created_by = (select auth.uid())\n                            and t.statut in ('résolu', 'fermé')",
    'exists (select 1 from public.tickets t where t.id = ticket_id)'
  ])assert.ok(sql.includes(fragment),fragment);
  assert.equal((sql.match(/private\.mfa_access_ok\(\)/g)||[]).length,4);
});

test('the ticket page and the reports show satisfaction',()=>{
  assert.ok(html.includes('<div id="ticketSatisfaction"></div>'));
  assert.ok(html.includes('globalThis.TicketSatisfaction?.mount(t);'));
  for(const list of ['all','ht'])assert.ok(html.includes(`\${globalThis.TicketSatisfaction?.reportHtml(${list})||''}`),list);
  assert.equal(html.split("globalThis.TicketSatisfaction?.reportHtml(").length-1,3);
  assert.ok(html.includes("${globalThis.TicketSatisfaction?.agentCell(at)||'—'}"));
  assert.ok(html.includes('<script src="assets/js/ticket-satisfaction.js?v='));
  assert.equal(html.includes("exportPDF('hotel','${esc(hotel)}')"),false);
});

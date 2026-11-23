const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/canned-replies.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');

function load({user={auth_user_id:'u1',prenom:'Awa',nom:'Diop',role:'it_hotel'},fetch,confirm=true}={}){
  const input={value:'Bonjour, ',selectionStart:9,selectionEnd:9,focus(){},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},dispatchEvent(){}};
  const elements={conversationInput:input,cannedRepliesPanel:{hidden:true,innerHTML:''},cannedTitle:{value:''},cannedBody:{value:''}};
  const calls=[],toasts=[];
  const ctx={
    console,Promise,encodeURIComponent,JSON,String,Array,
    currentUser:user,
    currentTicket:{id:'t1',numero:'TK-0042',titre:'Imprimante <bloquée>',hotel:'Onomo Dakar',created_by_name:'Moussa'},
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>elements[id]||null,querySelectorAll:()=>[]},
    window:{confirm:()=>confirm,sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return fetch?fetch(path,options):[];}}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.CannedReplies,elements,input,calls,toasts};
}
const rows=[
  {id:'r1',title:'Redémarrage',body:'Bonjour {demandeur}, merci de redémarrer le poste ({ticket}). — {agent}',created_by:'u1'},
  {id:'r2',title:'Mot de passe',body:'Votre mot de passe a été réinitialisé.',created_by:'u2'}
];

test('a reply is inserted at the cursor with the ticket details filled in',()=>{
  const h=load();h.api._setRows(rows);
  assert.equal(h.api.insert('r1'),true);
  assert.equal(h.input.value,'Bonjour, Bonjour Moussa, merci de redémarrer le poste (TK-0042). — Awa Diop');
  assert.equal(h.input.selectionStart,h.input.value.length);
  assert.equal(h.elements.cannedRepliesPanel.hidden,true);
  assert.equal(h.api.insert('missing'),false);
  assert.equal(h.api.fill('{Demandeur} {HÔTEL} {Ticket} {inconnu}'),'Moussa Onomo Dakar TK-0042 {inconnu}');
});

test('the list is searchable, escaped, and only the author or an admin can change a reply',()=>{
  const h=load();h.api._setRows([...rows,{id:'r3',title:'<b>x</b>',body:'y',created_by:'u1'}]);
  h.api.toggle(true);
  let out=h.elements.cannedRepliesPanel.innerHTML;
  assert.ok(out.includes('&lt;b&gt;x&lt;/b&gt;'));assert.ok(!out.includes('<b>x</b>'));
  assert.equal((out.match(/CannedReplies\.edit\(this/g)||[]).length,2);
  h.api.search('passe');out=h.elements.cannedRepliesPanel.innerHTML;
  assert.ok(out.includes('Mot de passe'));assert.ok(!out.includes('Redémarrage'));
  assert.equal(h.api.canChange(rows[1],{auth_user_id:'u1',role:'admin'}),true);
  assert.equal(h.api.canChange(rows[1],{auth_user_id:'u1',roles:['IT Hotel']}),false);
});

test('a reply is created, then updated; empty fields are refused',async()=>{
  const h=load({fetch:(path,options)=>[{id:'r9',created_by:'u1',...JSON.parse(options.body)}]});
  h.api._setRows([]);h.api.toggle(true);h.api.edit('new');
  assert.equal(await h.api.save(),false);assert.equal(h.calls.length,0);assert.equal(h.toasts[0][1],'err');
  h.elements.cannedTitle.value='  Accusé  ';h.elements.cannedBody.value=' Bien reçu. ';
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[0],['canned_replies','POST',{title:'Accusé',body:'Bien reçu.'}]);
  h.api.edit('r9');h.elements.cannedBody.value='Bien reçu, merci.';
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[1],['canned_replies?id=eq.r9','PATCH',{title:'Accusé',body:'Bien reçu, merci.'}]);
  assert.ok(h.elements.cannedRepliesPanel.innerHTML.includes('Bien reçu, merci.'));
});

test('a delete refused by the database is reported, not hidden',async()=>{
  const refused=load({fetch:()=>[]});refused.api._setRows([...rows]);
  assert.equal(await refused.api.remove('r2'),false);assert.equal(refused.toasts.at(-1)[1],'err');
  const ok=load({fetch:()=>[{id:'r1'}]});ok.api._setRows([...rows]);
  assert.equal(await ok.api.remove('r1'),true);
  assert.deepEqual(ok.calls[0].slice(0,2),['canned_replies?id=eq.r1','DELETE']);
  const declined=load({confirm:false});declined.api._setRows([...rows]);
  assert.equal(await declined.api.remove('r1'),false);assert.equal(declined.calls.length,0);
});

test('the database keeps the library to technicians',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261117150000_canned_replies.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'revoke all on public.canned_replies from anon, authenticated;',
    'grant update (title, body) on public.canned_replies to authenticated;',
    "using ((select public.has_permission('ticket:update:all')));",
    "with check ((select public.has_permission('ticket:update:all'))\n              and created_by = (select auth.uid()));",
    'create policy canned_replies_delete on public.canned_replies for delete to authenticated'
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the reply box offers canned replies to technicians only',()=>{
  assert.ok(html.includes("${canEdit?globalThis.CannedReplies?.button()||'':''}"));
  assert.ok(html.includes(`\${canEdit?'<div id="cannedRepliesPanel" class="canned-panel" hidden></div>':''}`));
  assert.ok(html.includes('globalThis.CannedReplies?.mount();'));
  assert.ok(html.includes('<script src="assets/js/canned-replies.js?v='));
});

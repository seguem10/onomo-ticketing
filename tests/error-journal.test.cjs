const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/error-journal.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');

function load({user={auth_user_id:'u1',role:'admin'},fetch,confirm=true,fail=false}={}){
  const listeners={},calls=[],toasts=[],logged=[];
  const elements={mainContent:{innerHTML:''}};
  const ctx={
    Promise,JSON,String,Array,Set,Map,Date,Number,Error,TypeError,encodeURIComponent,
    console:{error:(...args)=>logged.push(args),warn(){},log(){}},
    currentUser:user,currentView:'tickets',
    location:{pathname:'/',hash:'#detail?token=abc'},
    navigator:{userAgent:'Mozilla/5.0 Chrome/131.0'},
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>elements[id]||null}
  };
  ctx.window={
    addEventListener:(name,fn)=>{listeners[name]=fn;},
    confirm:()=>confirm,sbOK:()=>true,
    sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null,options.prefer]);if(fail)throw new Error('Supabase 500: down');return fetch?fetch(path,options):[];}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.ErrorJournal,ctx,listeners,calls,toasts,logged,elements};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('tokens, keys, signatures and e-mail addresses are masked',()=>{
  const {api}=load();
  const out=api.scrub('Bearer abc.def eyJhbGciOi.eyJzdWIi.sig123 https://x.powerplatform.com/a?api-version=1&sig=SECRET sb_publishable_ABC123 user@onomohotel.com');
  assert.ok(!out.includes('SECRET'));assert.ok(!out.includes('eyJhbGciOi'));assert.ok(!out.includes('abc.def'));
  assert.ok(!out.includes('sb_publishable_ABC123'));assert.ok(!out.includes('user@onomohotel.com'));
  assert.ok(out.includes('[email]'));assert.ok(out.includes('sig=[masqué]'));
});

test('uncaught errors, rejections and console.error are reported once each, then capped',async()=>{
  const h=load();
  h.listeners.error({message:'TypeError: x is undefined',filename:'https://onomo-ticketing.vercel.app/assets/js/a.js?v=1',lineno:12,colno:4,error:{stack:'at a.js:12'}});
  h.listeners.error({message:'TypeError: x is undefined',filename:'https://onomo-ticketing.vercel.app/assets/js/a.js?v=1',lineno:12,colno:4});
  h.listeners.unhandledrejection({reason:new Error('boom')});
  h.ctx.console.error('Réponses types',new Error('Supabase 400: bad'));
  await flush();
  assert.equal(h.calls.length,3);
  const [path,method,body,prefer]=h.calls[0];
  assert.equal(path,'client_errors');assert.equal(method,'POST');assert.equal(prefer,'return=minimal');
  assert.equal(body.kind,'error');assert.equal(body.source,'https://onomo-ticketing.vercel.app/assets/js/a.js');assert.equal(body.line,12);
  assert.equal(body.page,'/#detail?token=[masqué]');assert.equal(body.view,'tickets');
  assert.equal(h.calls[1][2].message,'Error: boom');assert.equal(h.calls[1][2].kind,'rejection');
  assert.equal(h.calls[2][2].kind,'console');assert.match(h.calls[2][2].message,/Réponses types Error: Supabase 400: bad/);
  assert.equal(h.logged.length,1,'console.error still prints');
  for(let i=0;i<40;i++)h.api.report('console',`distinct ${i}`);
  await flush();
  assert.equal(h.calls.length,20);
});

test('nothing is sent when signed out, for ignored noise, or about a failed report',async()=>{
  const out=load({user:null});out.listeners.error({message:'TypeError: y'});await flush();assert.equal(out.calls.length,0);
  const noise=load();
  noise.listeners.error({message:'ResizeObserver loop completed with undelivered notifications.'});
  noise.listeners.error({message:'Script error.'});
  noise.listeners.error({message:'x',filename:'chrome-extension://abc/content.js'});
  noise.listeners.error({target:{tagName:'IMG'}});
  await flush();assert.equal(noise.calls.length,0);
  const failing=load({fail:true});
  failing.api.report('error','first');await flush();await flush();
  assert.equal(failing.calls.length,1);assert.equal(failing.logged.length,0);
});

test('administrators see problems grouped, escaped and newest first; others are refused',async()=>{
  const rows=[
    {id:3,created_at:'2026-11-19T10:00:00Z',user_id:'u1',kind:'console',message:'<img src=x> failed',source:null,stack:null,view:'tickets',app_version:'onomo-shell-v56',user_agent:'Chrome/131'},
    {id:2,created_at:'2026-11-19T09:00:00Z',user_id:'u2',kind:'error',message:'TypeError: a',source:'a.js',line:3,stack:'at a.js:3'},
    {id:1,created_at:'2026-11-18T09:00:00Z',user_id:'u3',kind:'error',message:'TypeError: a',source:'a.js',line:3}
  ];
  const h=load();h.api._setRows(rows);
  const groups=h.api.groups(rows);
  assert.equal(groups.length,2);assert.equal(groups[1].count,2);assert.equal(groups[1].users.size,2);assert.equal(groups[1].first,'2026-11-18T09:00:00Z');
  h.api.render();
  const out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('&lt;img src=x&gt; failed'));assert.ok(!out.includes('<img src=x>'));
  assert.ok(out.indexOf('failed')<out.indexOf('TypeError: a'));
  const staff=load({user:{auth_user_id:'u9',role:'it_hotel'}});staff.api.render();
  assert.match(staff.elements.mainContent.innerHTML,/Réservé aux administrateurs/);assert.equal(staff.calls.length,0);
});

test('clearing asks first and deletes every row',async()=>{
  const declined=load({confirm:false});declined.api._setRows([{id:1}]);
  assert.equal(await declined.api.clear(),false);assert.equal(declined.calls.length,0);
  const h=load();h.api._setRows([{id:1}]);
  assert.equal(await h.api.clear(),true);
  assert.deepEqual(h.calls[0].slice(0,2),['client_errors?id=gt.0','DELETE']);
});

test('the database keeps the journal to administrators and caps each user',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261119090000_client_errors.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'revoke all on public.client_errors from anon, authenticated;',
    'with check (user_id = (select auth.uid()));',
    'using ((select public.is_admin()));',
    "e.created_at > now() - interval '1 hour') >= 60 then",
    'grant insert (kind, message, source, line, col, stack, page, view, app_version, user_agent) on public.client_errors to authenticated;'
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the admin menu and both renderView maps route the journal page',()=>{
  assert.ok(html.includes(`data-view="client-errors" onclick="switchView('client-errors',this)"`));
  assert.ok(html.includes('"client-errors":()=>globalThis.ErrorJournal?.render()'));
  const override=html.slice(html.indexOf('renderView = function(){'));
  assert.ok(override.slice(0,2600).includes("'client-errors': () => globalThis.ErrorJournal?.render()"));
  assert.ok(override.slice(0,500).includes("'knowledge','client-errors'"));
  const adminSection=html.slice(html.indexOf('<div id="sbAdminSec"'),html.indexOf('<div id="sbAdminSec"')+800);
  assert.ok(adminSection.includes('data-view="client-errors"'));
  assert.ok(html.indexOf('assets/js/error-journal.js')<html.indexOf('assets/js/ticket-satisfaction.js'));
});

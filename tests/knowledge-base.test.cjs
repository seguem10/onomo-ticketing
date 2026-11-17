const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/knowledge-base.js','utf8');
const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');

function load({role='it_hotel',fetch,confirm=true}={}){
  const elements={mainContent:{innerHTML:''},kbSuggest:{innerHTML:''},kbTitle:{value:''},kbCategory:{value:''},kbBody:{value:''},kbPublished:{checked:true}};
  const calls=[],toasts=[];
  const ctx={
    console,Promise,encodeURIComponent,JSON,String,Array,Set,
    currentUser:{auth_user_id:'u1',role},currentView:'knowledge',
    showToast:(message,kind)=>toasts.push([message,kind]),
    document:{getElementById:id=>{if(id==='kbList')return null;return elements[id]||null;}},
    window:{confirm:()=>confirm,sbOK:()=>true,sbFetch:async(path,options={})=>{calls.push([path,options.method||'GET',options.body?JSON.parse(options.body):null]);return fetch?fetch(path,options):[];}}
  };
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.KnowledgeBase,elements,calls,toasts};
}
const rows=[
  {id:'a1',title:'Le Wi-Fi ne fonctionne pas',category:'Réseau',body:'Redémarrez la borne.',published:true},
  {id:'a2',title:'L’imprimante n’imprime plus',category:'Matériel',body:'Vérifiez le papier.\nhttps://support.example.invalid/x',published:true},
  {id:'a3',title:'Procédure interne serveur',category:'Réseau',body:'Brouillon <b>IT</b>',published:false}
];

test('search ignores accents, case and small words, and ranks title matches first',()=>{
  const {api}=load();api._setRows(rows);
  for(const value of ['wifi','Wi-Fi','wi fi'])assert.deepEqual([...api.find(value,rows)].map(r=>r.id),['a1'],value);
  assert.deepEqual([...api.find('le WI-FI fonctionne',rows)].map(r=>r.id),['a1']);
  assert.deepEqual([...api.find('IMPRIMANTE bloquée',rows)].map(r=>r.id),['a2']);
  assert.deepEqual([...api.find('reseau',rows)].map(r=>r.id),['a1','a3']);
  assert.deepEqual([...api._words('Le mot de passe de ma session')],['mot','passe','session']);
});

test('requesters see published articles only; technicians also see drafts and the editing tools',()=>{
  const requester=load({role:'demandeur'});requester.api._setRows(rows);requester.api.render();
  let out=requester.elements.mainContent.innerHTML;
  assert.ok(out.includes('Le Wi-Fi ne fonctionne pas'));assert.ok(!out.includes('Procédure interne'));assert.ok(!out.includes('Nouvelle fiche'));
  const staff=load();staff.api._setRows(rows);staff.api.render();
  out=staff.elements.mainContent.innerHTML;
  assert.ok(out.includes('Procédure interne'));assert.ok(out.includes('Brouillon'));assert.ok(out.includes('Nouvelle fiche'));
});

test('an opened article shows escaped text, line breaks and safe links',()=>{
  const h=load({role:'demandeur'});h.api._setRows(rows);h.api.render();h.api.toggle('a2');
  const out=h.elements.mainContent.innerHTML;
  assert.ok(out.includes('Vérifiez le papier.<br><a href="https://support.example.invalid/x" target="_blank" rel="noopener noreferrer">'));
  assert.ok(!out.includes('KnowledgeBase.remove'));
  const staff=load();staff.api._setRows(rows);staff.api.render();staff.api.toggle('a3');
  assert.ok(staff.elements.mainContent.innerHTML.includes('Brouillon &lt;b&gt;IT&lt;/b&gt;'));
  assert.ok(staff.elements.mainContent.innerHTML.includes('KnowledgeBase.remove'));
});

test('an article is created, then updated; incomplete forms are refused',async()=>{
  const h=load({fetch:(path,options)=>[{id:'n1',...JSON.parse(options.body)}]});
  h.api._setRows([]);h.api.edit('new');
  h.elements.kbTitle.value='ab';h.elements.kbBody.value='x';
  assert.equal(await h.api.save(),false);assert.equal(h.calls.length,0);assert.equal(h.toasts[0][1],'err');
  h.elements.kbTitle.value='  VPN  ';h.elements.kbCategory.value='';h.elements.kbBody.value=' Lancez le client VPN. ';h.elements.kbPublished.checked=false;
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[0],['kb_articles','POST',{title:'VPN',category:'Général',body:'Lancez le client VPN.',published:false}]);
  h.api.edit('n1');h.elements.kbTitle.value='VPN';h.elements.kbCategory.value='Réseau';h.elements.kbBody.value='Étape 1';h.elements.kbPublished.checked=true;
  assert.equal(await h.api.save(),true);
  assert.deepEqual(h.calls[1],['kb_articles?id=eq.n1','PATCH',{title:'VPN',category:'Réseau',body:'Étape 1',published:true}]);
});

test('publishing toggles, and a refused delete is reported',async()=>{
  const h=load({fetch:(path,options)=>options.method==='PATCH'?[{...rows[2],...JSON.parse(options.body)}]:[]});
  h.api._setRows([...rows]);
  assert.equal(await h.api.togglePublished('a3'),true);
  assert.deepEqual(h.calls[0],['kb_articles?id=eq.a3','PATCH',{published:true}]);
  assert.equal(await h.api.remove('a1'),false);assert.equal(h.toasts.at(-1)[1],'err');
  const declined=load({confirm:false});declined.api._setRows([...rows]);
  assert.equal(await declined.api.remove('a1'),false);assert.equal(declined.calls.length,0);
});

test('the new ticket form suggests up to three published articles',()=>{
  const h=load({role:'demandeur'});
  h.api._setRows([...rows,{id:'a4',title:'Wi-Fi invités',category:'Réseau',body:'Code du jour',published:true}]);
  h.api.suggest('Problème wi-fi');
  let out=h.elements.kbSuggest.innerHTML;
  assert.ok(out.includes('Ces fiches peuvent résoudre votre problème'));
  assert.ok(out.includes('Le Wi-Fi ne fonctionne pas'));assert.ok(out.includes('Wi-Fi invités'));
  assert.ok(!out.includes('Procédure interne'));
  h.api.toggleSuggestion('a1');assert.ok(h.elements.kbSuggest.innerHTML.includes('Redémarrez la borne.'));
  h.api.suggest('de la');assert.equal(h.elements.kbSuggest.innerHTML,'');
  h.api.suggest('wifi');h.api.resetSuggestions();assert.equal(h.elements.kbSuggest.innerHTML,'');
});

test('the database lets everyone read published articles and technicians write',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261117190000_kb_articles.sql','utf8').replace(/\r\n/g,'\n');
  for(const fragment of [
    'revoke all on public.kb_articles from anon, authenticated;',
    "and (published or (select public.has_permission('ticket:update:all'))));",
    "with check ((select public.has_permission('ticket:update:all'))\n              and created_by = (select auth.uid()));",
    'grant update (title, body, category, published) on public.kb_articles to authenticated;',
    'new.updated_by := auth.uid();',
    'where not exists (select 1 from public.kb_articles);'
  ])assert.ok(sql.includes(fragment),fragment);
});

test('the page, its menu entry and the ticket form are wired',()=>{
  assert.ok(html.includes(`data-view="knowledge" onclick="switchView('knowledge',this)"`));
  assert.ok(html.includes('knowledge:()=>globalThis.KnowledgeBase?.render()'));
  assert.ok(html.includes('knowledge:"Base de connaissances"'));
  assert.ok(html.includes('<div id="kbSuggest" aria-live="polite"></div>'));
  assert.ok(html.includes('function onTitreInput(v){\n  globalThis.KnowledgeBase?.suggest(v);'));
  assert.ok(html.includes('globalThis.KnowledgeBase?.resetSuggestions();'));
  assert.ok(html.includes('<script src="assets/js/knowledge-base.js?v='));
});

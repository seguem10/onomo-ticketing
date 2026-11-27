const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const migration=fs.readFileSync('supabase/migrations/20261127120000_kb_domain_articles.sql','utf8');
const assistant=fs.readFileSync('assets/js/it-assistant.js','utf8');

function engine(){
  const ctx={Map,Set,String,Array,Math};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/js/problem-search.js','utf8'),ctx);
  return ctx.ProblemSearch;
}
function knowledgeBase(rows){
  const S=engine();
  const ctx={console:{error(){},warn(){},log(){}},Promise,encodeURIComponent,JSON,String,Array,Set,ProblemSearch:S,
    currentUser:{role:'demandeur'},currentView:'knowledge',showToast(){},document:{getElementById:()=>null},window:{sbOK:()=>true,sbFetch:async()=>[],ProblemSearch:S}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/js/knowledge-base.js','utf8'),ctx);
  ctx.window.KnowledgeBase._setRows(rows);
  return ctx.window.KnowledgeBase;
}
function loadAssistant(lang='fr'){
  const main={innerHTML:''},nodes={mainContent:main},requests=[];
  const suggestions={outerHTML:''};
  const ctx={console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Map,Proxy,Object,Error,Uint8Array,setTimeout,
    localStorage:{getItem:()=>lang},navigator:{},
    document:{getElementById:id=>nodes[id]||null,querySelector:sel=>sel==='.assistant-suggestions'?suggestions:null,querySelectorAll:()=>[],createElement:()=>({})},
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({conversation_id:'c1',answer:{answer:'Réponse'},sources:[],similar_tickets:[],kb_articles:[]})};}};
  ctx.window={OnomoI18n:{language:lang},OnomoAuth:{getSession:async()=>({access_token:'t'}),getConfig:()=>({sbUrl:'https://x.supabase.co',sbKey:'k'})},
    showToast(){},sbFetch:async()=>[],openNewTicket(){},CATS:['IT / Réseau']};
  vm.createContext(ctx);vm.runInContext(assistant,ctx);
  return {api:ctx.window.ITAssistant,main,nodes,suggestions,requests};
}

test('the migration publishes 25 bilingual domain articles, once, and moves the Opera articles',()=>{
  assert.ok(migration.includes("update public.kb_articles set category = 'OPERA PMS'\nwhere category = 'Logiciels' and title like 'Opera :%';")||migration.replace(/\r\n/g,'\n').includes("update public.kb_articles set category = 'OPERA PMS'\nwhere category = 'Logiciels' and title like 'Opera :%';"));
  assert.ok(/where not exists[\s\S]*k\.title = v\.title|where not exists/i.test(migration),'existing titles are never inserted twice');
  const counts={};
  for(const m of migration.matchAll(/,\s*'(OPERA PMS|Sage 1000|Citrix|Caisse|Réseau|Messagerie|Matériel)',\s*\n/g))counts[m[1]]=(counts[m[1]]||0)+1;
  assert.deepEqual(counts,{'OPERA PMS':5,'Sage 1000':4,'Citrix':4,'Caisse':3,'Réseau':3,'Messagerie':3,'Matériel':3});
});

test('choosing a domain shows its own frequent questions, and one click asks it in that domain',async()=>{
  const h=loadAssistant('en');
  await h.api.renderAssistantView();
  assert.ok(h.main.innerHTML.includes('A guest cannot connect to the Wi-Fi'),'generic questions first');
  h.api.changeDomain('sage1000');
  assert.ok(h.suggestions.outerHTML.includes('Sage 1000 refuses sign-in'));
  assert.ok(h.suggestions.outerHTML.includes('Frequent questions · Sage 1000'));
  assert.ok(!h.suggestions.outerHTML.includes('Wi-Fi'));
  h.api.changeDomain('citrix');
  assert.ok(h.suggestions.outerHTML.includes('I cannot print from Citrix'));
  Object.assign(h.nodes,{assistantInput:{value:''},assistantSendBtn:{disabled:false,innerHTML:''},assistantDomain:{value:'citrix'},
    assistantMessages:{innerHTML:'',scrollTop:0,scrollHeight:0,querySelector:()=>null,insertAdjacentHTML(){}}});
  h.api.askSuggestion(2);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.requests[0].message,'I cannot print from Citrix');
  assert.equal(h.requests[0].domain,'citrix');
});

test('every domain has questions in French, English and Arabic, and knowledge base categories',()=>{
  for(const domain of ['microsoft365','sage1000','citrix','opera','pos','network','maintenance'])
    assert.ok(new RegExp(`${domain}:\\[`).test(assistant.slice(assistant.indexOf('const DOMAIN_CATEGORIES'))),domain);
  const block=assistant.slice(assistant.indexOf('const DOMAIN_SUGGESTIONS'),assistant.indexOf('const currentSuggestions'));
  const items=block.match(/\{icon:[^}]+\}/g);
  assert.ok(items.length>=25);
  for(const item of items)assert.ok(/fr:'/.test(item)&&/en:'/.test(item)&&/ar:'/.test(item),item);
});

test('related articles put the chosen domain first',()=>{
  const kb=knowledgeBase([
    {id:'gen',title:'L’imprimante n’imprime plus',category:'Matériel',body:'Papier, toner.',published:true},
    {id:'sage',title:'Sage 1000 : imprimer ou exporter un état',category:'Sage 1000',body:'Imprimante par défaut.',published:true},
    {id:'citrix',title:'Citrix : imprimer depuis une application',category:'Citrix',body:'Imprimante de la session.',published:true}
  ]);
  const ids=list=>JSON.parse(JSON.stringify(list)).map(r=>r.id);
  assert.equal(ids(kb.related('imprimer',3)).length,3);
  assert.equal(ids(kb.related('imprimer',3,['Citrix']))[0],'citrix');
  assert.equal(ids(kb.related('imprimer',3,['Sage 1000']))[0],'sage');
  assert.equal(JSON.parse(JSON.stringify(kb.related('imprimer',1,['Sage 1000'])))[0].category,'Sage 1000');
});

test('domain questions find the right article',()=>{
  const S=engine();
  const A=[
    {id:'sage-login',title:'Sage 1000 ne s’ouvre pas ou refuse la connexion'},
    {id:'opera-login',title:'Opera : impossible de se connecter'},
    {id:'audit',title:'Opera : la clôture de nuit (Night Audit) est bloquée'},
    {id:'tpe',title:'Le paiement par carte (TPE) est refusé ou hors ligne'},
    {id:'ups',title:'Un onduleur émet des bips'},
    {id:'share',title:'Partager un fichier en toute sécurité'}
  ];
  const top=q=>S.rank(q,A,a=>({title:a.title,body:''}),{limit:1})[0]?.id;
  assert.equal(top('sage ne veut pas se connecter'),'sage-login');
  assert.equal(top('night audit bloqué'),'audit');
  assert.equal(top('le tpe est hors ligne'),'tpe');
  assert.equal(top('onduleur qui bip'),'ups');
  assert.equal(top('partager un fichier'),'share');
});

test('the server favours the articles of the conversation domain',()=>{
  const fn=fs.readFileSync('supabase/functions/ai-it-assistant/index.ts','utf8');
  assert.ok(fn.includes("sage1000:['sage 1000'],citrix:['citrix'],opera:['opera pms','serrures']"));
  assert.ok(fn.includes('domainCategories.has(String(article.category??\'\').toLowerCase())?3:0'));
});

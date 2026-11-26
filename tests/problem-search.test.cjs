const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function engine(){
  const ctx={Map,Set,String,Array,Math};vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('assets/js/problem-search.js','utf8'),ctx);
  return ctx.ProblemSearch;
}
const A=[
  {id:'print',title:'L’imprimante n’imprime plus',title_en:'The printer no longer prints',category:'Matériel',body:'Vérifiez le papier et le toner.'},
  {id:'slow',title:'Mon ordinateur est très lent',title_en:'My computer is very slow',category:'Matériel',body:'Redémarrez le poste.'},
  {id:'mail',title:'Je ne reçois plus mes e-mails',title_en:'I no longer receive my e-mails',category:'Messagerie',body:'Ouvrez https://outlook.office.com.'},
  {id:'pos',title:'Caisse Micros figée ou très lente',title_en:'Micros POS frozen or very slow',category:'Caisse',body:'Vérifiez le câble réseau de la caisse.'},
  {id:'card',title:'La carte de chambre d’un client ne fonctionne pas',title_en:'A guest’s key card does not work',category:'Serrures',body:'Réencodez la carte.'},
  {id:'wifi',title:'Un client n’arrive pas à se connecter au Wi-Fi',title_en:'A guest cannot connect to the Wi-Fi',category:'Réseau',body:'Oubliez le réseau.'},
  {id:'phish',title:'E-mail suspect ou tentative d’hameçonnage',title_en:'Suspicious e-mail or phishing attempt',category:'Sécurité',body:'Ne cliquez sur aucun lien.'},
  {id:'pwd',title:'J’ai oublié mon mot de passe',title_en:'I forgot my password',category:'Accès',body:'Créez un ticket.'}
];
const fields=a=>({title:`${a.title} ${a.title_en}`,body:`${a.category} ${a.body}`});
const top=(S,q)=>S.rank(q,A,fields,{limit:1})[0]?.id;

test('word roots: different forms of the same word meet',()=>{
  const S=engine();
  for(const q of ['imprimer','imprime','imprimantes','printing'])assert.equal(top(S,q),'print',q);
  assert.equal(top(S,'connecter wifi'),'wifi');
});

test('synonyms used by hotel staff, in French and English',()=>{
  const S=engine();
  const cases=[['mon pc rame','slow'],['mdp oublié','pwd'],['la caisse plante','pos'],['badge client','card'],['reçu une arnaque par mail','phish'],
    ['outlook ne reçoit rien','mail'],['the guest has no internet','wifi'],['my computer is slow','slow'],['key card','card']];
  for(const [q,id] of cases)assert.equal(top(S,q),id,q);
});

test('small typos on longer words are tolerated, short words are not guessed',()=>{
  const S=engine();
  assert.equal(top(S,'imprimente'),'print');assert.equal(top(S,'outlok'),'mail');assert.equal(top(S,'ordinateu lent'),'slow');
  assert.equal(S.rank('xyz',A,fields).length,0);
  assert.ok(S._close('outlok','outlook'));assert.ok(!S._close('pc','pa'));
});

test('an article answering more of the question ranks first, and an empty query lists everything',()=>{
  const S=engine();
  const ranked=S.rank('caisse lente',A,fields).map(a=>a.id);
  assert.equal(ranked[0],'pos','both words beat a single one');
  assert.ok(ranked.includes('slow'));
  assert.equal(S.rank('',A,fields).length,A.length);
  assert.equal(S.rank('  merci bonjour  ',A,fields).length,A.length,'only greetings: nothing to search');
});

test('highlighting marks matching words of already-escaped text and never unescapes it',()=>{
  const S=engine();
  assert.equal(S.highlight('L’imprimante n’imprime plus','imprimer'),'L’<mark>imprimante</mark> n’<mark>imprime</mark> plus');
  assert.equal(S.highlight('Le Wi-Fi ne fonctionne pas','wifi'),'Le <mark>Wi-Fi</mark> ne fonctionne pas');
  const escaped='&lt;img src=x onerror=alert(1)&gt; imprimante';
  const out=S.highlight(escaped,'img imprimante');
  assert.ok(!out.includes('<img'));assert.ok(out.includes('&lt;'));
  assert.equal(S.highlight('Texte','  '),'Texte');
});

test('the knowledge base uses the engine and highlights the matched words',()=>{
  const S=engine();
  const elements={mainContent:{innerHTML:''},kbSuggest:{innerHTML:''}};
  const ctx={console:{error(){},warn(){},log(){}},Promise,encodeURIComponent,JSON,String,Array,Set,ProblemSearch:S,
    currentUser:{role:'demandeur'},currentView:'knowledge',showToast(){},document:{getElementById:id=>elements[id]||null},window:{sbOK:()=>true,sbFetch:async()=>[],ProblemSearch:S}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync('assets/js/knowledge-base.js','utf8'),ctx);
  const kb=ctx.window.KnowledgeBase;
  kb._setRows(A.map(a=>({...a,published:true})));
  kb.render();kb.search('imprimer');
  assert.ok(elements.mainContent.innerHTML.includes('<mark>imprimante</mark>'));
  kb.suggest('mon pc rame');
  assert.ok(elements.kbSuggest.innerHTML.includes('Mon <mark>ordinateur</mark> est très <mark>lent</mark>'),'synonyms of "pc" and "rame" are highlighted');
  assert.equal(JSON.parse(JSON.stringify(kb.related('la caisse plante')))[0].id,'pos');
});

test('the server search uses word roots, synonyms and accent-free comparison; the page loads the engine first',()=>{
  const fn=fs.readFileSync('supabase/functions/ai-it-assistant/index.ts','utf8');
  assert.ok(fn.includes('const KB_SYNONYMS:Record<string,string[]>='));
  assert.ok(fn.includes("KB_SYNONYMS[word]??KB_SYNONYMS[root]??[]"));
  assert.ok(fn.includes("const plain=(text:string)=>text.toLowerCase().normalize('NFD').replace(/\\p{M}/gu,'');"));
  const html=fs.readFileSync('index.html','utf8');
  assert.ok(html.indexOf('assets/js/problem-search.js')>0&&html.indexOf('assets/js/problem-search.js')<html.indexOf('assets/js/knowledge-base.js'));
  const assistant=fs.readFileSync('assets/js/it-assistant.js','utf8');
  assert.ok(assistant.includes('articles=[...local,...(Array.isArray(answer.kb_articles)?answer.kb_articles:[])]'),'the page’s own ranking comes first');
});

test('the ticket search bar finds tickets by meaning, and still by exact text such as a number',()=>{
  const S=engine();
  const html=fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n');
  const start=html.indexOf('function ticketMatchesSearch(t,q){'),end=html.indexOf('function getFiltered(){');
  const ctx={String,Boolean,window:{ProblemSearch:S}};vm.createContext(ctx);
  vm.runInContext(html.slice(start,end)+';globalThis.match=ticketMatchesSearch;',ctx);
  const t={titre:'Imprimante réception bloquée',numero:'#000042',hotel:'ONOMO Hotel Dakar',categorie:'IT / Réseau',description:'Le papier coince depuis ce matin',created_by_name:'Awa'};
  for(const q of ['#000042','dakar','awa','imprimer','imprimente','printer','papier coincé'])assert.equal(ctx.match(t,q),true,q);
  for(const q of ['wifi','outlook','#000043'])assert.equal(ctx.match(t,q),false,q);
  assert.equal((html.match(/mq ?= ?!q ?\|\| ?ticketMatchesSearch\(t, ?q\)/g)||[]).length,2,'both ticket lists use it');
});

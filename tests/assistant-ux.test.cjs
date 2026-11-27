const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/it-assistant.js','utf8');

function load({lang='fr',response}={}){
  const main={innerHTML:''},toasts=[],requests=[],opened=[];
  const nodes={mainContent:main};
  const ctx={console:{error(){},warn(){},log(){}},Promise,JSON,String,Array,Set,Map,Proxy,Object,Error,Uint8Array,setTimeout,
    localStorage:{getItem:()=>lang},navigator:{clipboard:{writeText:async text=>{ctx.copied=text;}}},
    document:{getElementById:id=>nodes[id]||null,querySelectorAll:()=>[],createElement:()=>({})},
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>response||{conversation_id:'c1',answer:{answer:'Réponse',checks:['Vérifier le câble'],suggested_ticket:{title:'Imprimante'}},sources:[],similar_tickets:[],kb_articles:[]}};}};
  ctx.window={OnomoI18n:{language:lang},OnomoAuth:{getSession:async()=>({access_token:'t'}),getConfig:()=>({sbUrl:'https://x.supabase.co',sbKey:'k'})},
    showToast:(m,k)=>toasts.push([m,k]),sbFetch:async()=>[],openNewTicket:arg=>opened.push(arg),CATS:['IT / Réseau']};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {api:ctx.window.ITAssistant,ctx,nodes,main,toasts,requests,opened};
}

test('the area is guessed from the question when the user leaves the generic one',()=>{
  const {api}=load();
  const cases=[['La caisse Micros est figée','pos'],['Opera ne veut pas faire le check-in','opera'],['Erreur dans la comptabilité Sage','sage1000'],
    ['Outlook ne reçoit plus les mails','microsoft365'],['Le Wi-Fi de la réception coupe','network'],['L’imprimante du back office bourre','maintenance'],
    ['A guest key card does not open the door','maintenance'],['Bonjour, j’ai une question','general']];
  for(const [text,domain] of cases)assert.equal(api.detectDomain(text),domain,text);
});

test('an empty conversation offers frequent questions in the page language, and one click asks it',async()=>{
  const h=load({lang:'en'});
  const input={value:''},button={disabled:false,innerHTML:''},select={value:'general'},list={innerHTML:'',scrollTop:0,scrollHeight:0,querySelector:()=>null,insertAdjacentHTML(){}};
  await h.api.renderAssistantView();
  assert.ok(h.main.innerHTML.includes('Frequent questions'));
  assert.ok(h.main.innerHTML.includes('A guest cannot connect to the Wi-Fi'));
  assert.ok(h.main.innerHTML.includes('IT / Network'),'area names follow the language');
  assert.ok(h.main.innerHTML.includes("onkeydown=\"if((event.ctrlKey||event.metaKey)&&event.key==='Enter')"));
  Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantDomain:select,assistantMessages:list});
  h.api.askSuggestion(1);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.requests[0].message,'A guest cannot connect to the Wi-Fi');
  assert.equal(h.requests[0].domain,'network');assert.equal(h.requests[0].language,'en');
});

test('after an answer: copy, "solved" hides the ticket offer, "still stuck" opens the pre-filled ticket',async()=>{
  const h=load();
  const input={value:'Mon imprimante ne marche pas'},button={disabled:false,innerHTML:''},list={innerHTML:'',scrollTop:0,scrollHeight:0,querySelector:()=>null,insertAdjacentHTML(){}};
  Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantMessages:list});
  await h.api.renderAssistantView();
  Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantMessages:list});
  await h.api.sendMessage();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(h.requests[0].domain,'maintenance','guessed from "imprimante"');
  let out=h.main.innerHTML;
  assert.ok(out.includes('C’est résolu')&&out.includes('Toujours bloqué'));
  assert.ok(out.includes('ITAssistant.copyAnswer(this)'));
  assert.ok(out.includes('assistant-ticket-cta'));
  h.api.markResolved();await new Promise(resolve=>setTimeout(resolve,20));
  out=h.main.innerHTML;
  assert.ok(out.includes('Parfait, problème résolu'));assert.ok(!out.includes('assistant-ticket-cta'));
  h.api.stillBlocked();
  assert.equal(h.opened.length,1);assert.equal(h.opened[0].titre,'Imprimante');
});

test('feedback is saved once per conversation, IT staff see the 30-day summary, history can be searched',async()=>{
  const calls=[];
  const h=load();
  h.ctx.window.canManageTickets=()=>true;h.ctx.window.currentUser={role:'it_hotel'};
  h.ctx.window.sbFetch=async(path,options={})=>{calls.push([path,options.method||'GET',options.prefer,options.body?JSON.parse(options.body):null]);
    if(path.startsWith('it_ai_conversations'))return [{id:'c9',title:'Imprimante <bar>',updated_at:'2026-11-20T10:00:00Z'},{id:'c8',title:'Outlook',updated_at:'2026-11-19T10:00:00Z'},{id:'c7',title:'Wi-Fi',updated_at:'2026-11-18T10:00:00Z'},{id:'c6',title:'Opera',updated_at:'2026-11-17T10:00:00Z'}];
    if(path==='rpc/it_ai_feedback_summary')return [{conversations:12,answered:5,resolved:4,blocked:1}];
    return [];};
  await h.api.renderAssistantView();
  let out=h.main.innerHTML;
  assert.ok(out.includes('<b>12</b> conversations'));assert.ok(out.includes('<b>4</b> résolus sans ticket'));assert.ok(out.includes('<b>80 %</b>'));
  assert.ok(out.includes('class="assistant-history-search"'));
  assert.ok(out.includes('Imprimante &lt;bar&gt;'));assert.ok(!out.includes('Imprimante <bar>'));
  assert.ok(out.includes('data-conversation-id="c9"'),'conversation ids are passed as data, not inside the handler');
  const input={value:'imprimante'},button={disabled:false,innerHTML:''},list={innerHTML:'',scrollTop:0,scrollHeight:0,querySelector:()=>null,insertAdjacentHTML(){}};
  Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantMessages:list});
  await h.api.sendMessage();await new Promise(resolve=>setTimeout(resolve,20));
  h.api.markResolved();await new Promise(resolve=>setTimeout(resolve,20));
  const save=calls.find(c=>c[0].startsWith('it_ai_feedback'));
  assert.deepEqual(save,['it_ai_feedback?on_conflict=conversation_id','POST','resolution=merge-duplicates,return=minimal',{conversation_id:'c1',resolved:true}]);
});

test('a requester sees no statistics and dictation is offered only when the browser supports it',async()=>{
  const h=load();
  await h.api.renderAssistantView();
  assert.ok(!h.main.innerHTML.includes('assistant-stats'));
  assert.ok(!h.main.innerHTML.includes('assistantDictate'));
  const v=load();v.ctx.window.webkitSpeechRecognition=function(){};
  await v.api.renderAssistantView();
  assert.ok(v.main.innerHTML.includes('id="assistantDictate"'));
});

test('without an AI answer, the server answers from the best matching published article',()=>{
  const fn=fs.readFileSync('supabase/functions/ai-it-assistant/index.ts','utf8');
  assert.ok(fn.includes("const topArticle=kbArticles[0]&&kbArticles[0].score>=3?kbArticles[0]:null;"));
  assert.ok(fn.includes("const answer=topArticle?kbAnswer(topArticle):procedureGuide(domain,message,language);"));
  assert.ok(fn.includes("providerUnavailable?(topArticle?kbAnswer(topArticle):fallbackAnswer(domain,message,language))"));
  assert.ok(fn.includes("provider:topArticle?'knowledge-base':'procedure-guide'"));
  const sql=fs.readFileSync('supabase/migrations/20261126120000_ai_assistant_feedback.sql','utf8');
  assert.ok(sql.includes("where public.has_permission('ticket:update:all');"),'the summary is for technicians only');
  assert.ok(sql.includes("and exists (select 1 from public.it_ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()))"));
});

test('answers are short first: one sentence, at most three steps and two questions, the rest folded',async()=>{
  const h=load({response:{conversation_id:'c1',answer:{answer:'Outlook ne s’ouvre pas.',checks:['Fermez Outlook — il se ferme — rouvrez-le','Redémarrez le poste','Testez Outlook sur le web','Videz le cache'],solution:['Redémarrez le poste','Créez un ticket'],questions:['Depuis quand ?','Un seul poste ?','Quel message ?'],causes:['Profil Outlook'],validation:['Outlook s’ouvre'],assumptions:['Compte actif']},sources:[],similar_tickets:[],kb_articles:[]}});
  const input={value:'outlook'},button={disabled:false,innerHTML:''},list={innerHTML:'',scrollTop:0,scrollHeight:0,querySelector:()=>null,insertAdjacentHTML(){}};
  Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantMessages:list});
  await h.api.renderAssistantView();Object.assign(h.nodes,{assistantInput:input,assistantSendBtn:button,assistantMessages:list});
  await h.api.sendMessage();await new Promise(resolve=>setTimeout(resolve,20));
  const out=h.main.innerHTML;
  const steps=out.slice(out.indexOf('<ol class="assistant-steps">'),out.indexOf('</ol>'));
  assert.equal((steps.match(/<li>/g)||[]).length,3);
  assert.ok(steps.includes('<li>Fermez Outlook</li>'),'only the action of an AI check');
  assert.equal((steps.match(/Redémarrez le poste/g)||[]).length,1,'no duplicated step');
  assert.ok(out.includes('Depuis quand ? · Un seul poste ?')&&!out.includes('Un seul poste ? · Quel message ?'));
  assert.ok(out.includes('<details class="assistant-details"><summary>Voir le diagnostic complet</summary>'));
  assert.ok(out.indexOf('Profil Outlook')>out.indexOf('<details'),'causes are in the folded part');
});

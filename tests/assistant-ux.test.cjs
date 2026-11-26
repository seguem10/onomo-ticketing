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

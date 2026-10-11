const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/conversation-reads.js'),'utf8');
async function harness(){
 const calls=[];let intersection;
 const card={dataset:{commentId:'11111111-1111-4111-8111-111111111111'},classList:{contains:()=>false}};
 const document={visibilityState:'visible',getElementById:()=>({value:'fr'}),querySelectorAll:selector=>selector.includes('conversation-message')?[card]:[],addEventListener(){}};
 const window={currentUser:{auth_user_id:'reader'},sbFetch:async(path,options)=>{calls.push({path,options});return [];}};
 const context={window,document,console,setTimeout,clearTimeout,setInterval(){},MutationObserver:class{observe(){}},IntersectionObserver:class{constructor(callback){intersection=callback;}observe(){}disconnect(){}}};
 vm.runInNewContext(source,context);await new Promise(resolve=>setImmediate(resolve));
 return {calls,document,card,intersect:entries=>intersection(entries)};
}
test('records visible messages once, without accepting client timestamps',async()=>{
 const h=await harness();const entry={target:h.card,isIntersecting:true,intersectionRatio:0.8};
 h.intersect([entry]);h.intersect([entry]);
 const writes=h.calls.filter(call=>call.options?.method==='POST');assert.equal(writes.length,1);
 assert.deepEqual(JSON.parse(writes[0].options.body),{comment_id:h.card.dataset.commentId,user_id:'reader'});
});
test('hidden tabs and offscreen messages do not produce read receipts',async()=>{
 const h=await harness();h.intersect([{target:h.card,isIntersecting:false,intersectionRatio:0}]);
 h.document.visibilityState='hidden';h.intersect([{target:h.card,isIntersecting:true,intersectionRatio:1}]);
 assert.equal(h.calls.filter(call=>call.options?.method==='POST').length,0);
});

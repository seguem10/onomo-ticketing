const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('assets/js/recipe-panel.js','utf8');
async function harness({allowed=true,confirm=true,existing=false}={}){
 const calls=[],nodes=new Map();let observer;
 const make=tag=>({tag,dataset:{},children:[],listeners:{},append(...items){this.children.push(...items);for(const item of items)if(item.id)nodes.set(item.id,item);},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},remove(){nodes.delete(this.id);}});
 const sidebar=make('aside');nodes.set('sidebar',sidebar);
 const client={functions:{invoke:async(name,options)=>{calls.push({name,options});if(options.method==='GET')return {data:{can_create:allowed},error:null};if(name==='recipe-create-ticket')return {data:{ok:true,created:!existing,ticket:{id:'reserved'}},error:null};return {data:{accepted:1},error:null};}}};
 const window={currentUser:{id:'synthetic-user'},OnomoAuth:{getClient:()=>client}};
 vm.runInNewContext(source,{window,document:{body:make('body'),getElementById:id=>nodes.get(id),createElement:make},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},confirm:()=>confirm});
 await new Promise(setImmediate);
 return {calls,nodes,window,refresh:observer};
}
test('only eligibility GET runs at load; allowed account gets button',async()=>{
 const h=await harness();assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.method,'GET');assert.ok(h.nodes.has('onomoRecipePanel'));await h.refresh();assert.equal(h.calls.length,1);
});
test('ineligible or logged-out account has no creation control',async()=>{
 const h=await harness({allowed:false});assert.ok(!h.nodes.has('onomoRecipePanel'));
 const other=await harness();other.window.currentUser=null;await other.refresh();assert.ok(!other.nodes.has('onomoRecipePanel'));
});
test('cancel prevents writes; confirmed new creation notifies once',async()=>{
 const cancelled=await harness({confirm:false});await cancelled.nodes.get('onomoRecipePanel').children[0].listeners.click();assert.equal(cancelled.calls.length,1);
 const h=await harness();await h.nodes.get('onomoRecipePanel').children[0].listeners.click();assert.deepEqual(h.calls.map(c=>c.name),['recipe-create-ticket','recipe-create-ticket','ticket-notification-delivery']);assert.equal(h.calls[2].options.body.event,'created');
});
test('existing ticket never causes a repeated notification',async()=>{
 const h=await harness({existing:true});await h.nodes.get('onomoRecipePanel').children[0].listeners.click();assert.equal(h.calls.length,2);
});
test('public launcher contains no recipient address or reserved UUID',()=>{
 assert.ok(!source.includes('@'));assert.ok(!source.includes('7fedbb65'));assert.ok(!source.includes('service_role'));
});

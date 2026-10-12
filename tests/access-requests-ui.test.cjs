const test=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
const code=fs.readFileSync('assets/js/access-requests.js','utf8');
function setup(result={data:[],error:null}){
 const host={innerHTML:'',querySelector:()=>null};let oldCalls=0;
 const query={select(){return this},order(){return this},eq(){return this},is(){return this},limit(){return Promise.resolve({data:[],error:null})},range(){return Promise.resolve(result)}};
 const ctx={currentView:'access-requests',currentUser:{id:'profile',auth_user_id:'actor',role:'it_hotel',hotel:'Airport'},document:{getElementById:id=>id==='mainContent'?host:null,addEventListener(){}},window:{renderView:()=>oldCalls++,OnomoAuth:{getClient:()=>({from:()=>query})}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {ctx,host,oldCalls:()=>oldCalls};
}
test('list renders empty state, pending-test warning and pagination',async()=>{
 const {ctx,host}=setup();await ctx.window.OnomoAccessRequests.render();
 assert.match(host.innerHTML,/Aucune demande visible/);assert.match(host.innerHTML,/tests multi-comptes/);assert.match(host.innerHTML,/data-access-action="next" disabled/);
});
test('untrusted request text is escaped and roles cannot bypass stage or scope',async()=>{
 const {ctx,host}=setup({data:[{id:'uuid',subject:'<script>evil</script>',hotel:'Airport',system_name:'OPERA',stage:'it',created_at:'2026-10-11'}]});
 await ctx.window.OnomoAccessRequests.render();assert.match(host.innerHTML,/&lt;script&gt;/);assert.doesNotMatch(host.innerHTML,/<script>/);
 const can=ctx.window.OnomoAccessRequests.canDecide;
 assert.equal(can({requester_id:'other',hotel:'Airport',stage:'it'}),true);
 assert.equal(can({requester_id:'actor',hotel:'Airport',stage:'it'}),false);
 assert.equal(can({requester_id:'other',hotel:'Other',stage:'it'}),false);
 assert.equal(can({requester_id:'other',hotel:'Airport',stage:'hr'}),false);
 ctx.currentUser.role='admin';assert.equal(can({requester_id:'other',hotel:'Airport',stage:'it'}),false);
});
test('navigation away ignores a delayed request response',async()=>{
 const {ctx,host}=setup();const pending=ctx.window.OnomoAccessRequests.render();
 ctx.currentView='tickets';ctx.window.renderView();host.innerHTML='ticket screen';await pending;
 assert.equal(host.innerHTML,'ticket screen');
});
test('mail monitor distinguishes provider acceptance from confirmed receipt',()=>{
 const {ctx}=setup();const render=ctx.window.OnomoAccessRequests.emailMonitorHtml;
 const html=render([{request_id:'<script>',event_stage:'it',delivery_status:'sent',provider_status:200,event_at:'2026-10-12'}]);
 assert.match(html,/Accepté par EmailJS/);assert.match(html,/ne confirme pas la réception/);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.match(render([],true),/Journal indisponible/);
 assert.match(render([],false),/Aucune alerte email/);
});

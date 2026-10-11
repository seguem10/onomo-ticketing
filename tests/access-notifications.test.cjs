const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('assets/js/access-notifications.js','utf8');
test('access notification polling isolates accounts and suppresses duplicates',async()=>{
 let rows=[{id:'initial',event_stage:'it'}];const toasts=[];
 const query={select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:rows,error:null})}};
 const ctx={currentUser:{auth_user_id:'first'},setInterval(){},document:{hidden:false,addEventListener(){}},window:{addEventListener(){},showToast:m=>toasts.push(m),OnomoAuth:{getClient:()=>({from:()=>query})}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);const poll=ctx.window.OnomoAccessNotifications.poll;
 await poll();assert.equal(toasts.length,0);
 rows=[{id:'new',event_stage:'director'},...rows];await poll();await poll();assert.equal(toasts.length,1);
 ctx.currentUser={auth_user_id:'second'};await poll();assert.equal(toasts.length,1);
 rows=[{id:'new-second',event_stage:'hr'},...rows];await poll();assert.equal(toasts.length,2);
 ctx.document.hidden=true;rows=[{id:'hidden',event_stage:'hr'},...rows];await poll();assert.equal(toasts.length,2);
});

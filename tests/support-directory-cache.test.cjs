const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/js/user-admin-fix.js','utf8')
 .replace(/\}\)\(\);\s*$/, 'window.testLoadUsers=loadUsers;})();');
function harness(fetch){
 const window={DEMO_USERS:[{email:'stale-other-hotel@example.invalid'}],currentUser:{role:'it_hotel'},sbOK:()=>true,sbFetch:fetch};
 vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}}});
 return window;
}
test('empty connected directory never restores a stale user list',async()=>{
 const w=harness(async()=>[]);assert.equal((await w.testLoadUsers()).length,0);
});
test('failed or malformed directory never restores a stale user list',async()=>{
 for(const fetch of [async()=>{throw Error('denied')},async()=>({error:'denied'})]){
  const w=harness(fetch);assert.equal((await w.testLoadUsers()).length,0);
 }
});
test('connected directory displays only returned rows',async()=>{
 const rows=[{email:'allowed@example.invalid'}];
 const w=harness(async()=>rows);assert.equal(await w.testLoadUsers(),rows);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadUsersPage}=require('./users-page-harness.cjs');
function harness(fetch){
 const page=loadUsersPage({DEMO_USERS:[{email:'stale-other-hotel@example.invalid'}],currentUser:{role:'it_hotel'},window:{sbOK:()=>true,sbFetch:fetch}});
 return {testLoadUsers:page.loadUsersPage};
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

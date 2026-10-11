const {test}=require('node:test');
const assert=require('node:assert/strict');
test('internal email excludes requester and users without the RLS permission',async()=>{
 const {internalRecipients}=await import('../supabase/functions/ticket-notification-delivery/recipients.mjs');
 const memberships=[{user_id:'requester',role_id:'r'},{user_id:'it',role_id:'i'},{user_id:'admin',role_id:'a'}];
 const roles=[{id:'r',permissions:['comment:create']},{id:'i',permissions:['ticket:update:all']},{id:'a',permissions:{'*':true}}];
 assert.deepEqual(internalRecipients(['requester','it','admin','unknown'],memberships,roles),['it','admin']);
 assert.deepEqual(internalRecipients(['it'],[],roles),[]);
});

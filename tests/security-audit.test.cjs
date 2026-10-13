const {test}=require('node:test');const assert=require('node:assert/strict');
test('security journal uses deployed schema and drops secret metadata fields',async()=>{
 const {auditRow}=await import('../supabase/functions/_shared/audit-row.mjs');
 const row=auditRow('actor','mfa_reset','target',{email:'a@example.com',password:'SECRET',mfa_secret:'SECRET',access_token:'SECRET'});
 assert.equal(row.user,'actor');assert.ok(row.id);assert.ok(row.timestamp);
 assert.equal(JSON.stringify(row).includes('SECRET'),false);
 assert.deepEqual(JSON.parse(row.detail),{target:'target',email:'a@example.com'});
});

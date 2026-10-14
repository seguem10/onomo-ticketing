const {test}=require('node:test');const assert=require('node:assert/strict');
test('authenticated JWT assurance accepts AAL2 only for the verified user and nonexpired token',async()=>{
 const {authenticatedAssurance}=await import('../supabase/functions/admin-mfa-policy/assurance.mjs');
 const token=p=>'header.'+Buffer.from(JSON.stringify(p)).toString('base64url')+'.signature';
 const p={sub:'admin',exp:Date.now()/1000+60,aal:'aal2'};
 assert.equal(authenticatedAssurance(token(p),'admin'),'aal2');
 assert.equal(authenticatedAssurance(token({...p,aal:'aal1'}),'admin'),null);
 assert.equal(authenticatedAssurance(token(p),'another'),null);
 assert.equal(authenticatedAssurance(token({...p,exp:1}),'admin'),null);
 assert.equal(authenticatedAssurance('invalid','admin'),null);
});

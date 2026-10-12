const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('supabase/functions/admin-mfa-policy/index.ts','utf8');
test('MFA reset retains mandatory MFA and requires administrator AAL2 and identity confirmation',()=>{
 assert.match(source,/reset\?true/);
 assert.match(source,/currentLevel!=='aal2'/);
 assert.match(source,/identity_confirmed!==true/);
 assert.match(source,/target===auth.user.id/);
 assert.ok(source.indexOf('mfa_reset_requested')<source.indexOf('deleteFactor'));
 assert.match(source,/mfa_reset_completed/);
});

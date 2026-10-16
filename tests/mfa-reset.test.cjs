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

test('reset UI uses a modal form instead of unsupported native prompts',()=>{
 const ui=fs.readFileSync('assets/js/mfa-auth.js','utf8');
 const reset=ui.slice(ui.indexOf('async function reset('));
 assert.doesNotMatch(reset,/\b(?:prompt|confirm)\s*\(/);
 assert.match(reset,/await requestResetReason\(\)/);
 assert.match(reset,/type="checkbox" required/);
 assert.match(reset,/reportValidity\(\)/);
 assert.match(reset,/reason\.length<10/);
 assert.match(reset,/dialog\.showModal\(\)/);
 assert.match(reset,/finish\(null\)/);
});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/js/user-admin-fix.js','utf8')
 .replace(/\}\)\(\);\s*$/, 'window.testEmailMessage=emailTestAcceptedMessage;})();');
const window={};
vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}}});
test('email test identifies Microsoft 365 or EmailJS, without asserting delivery',()=>{
 for(const [provider,label] of [['microsoft365','Microsoft 365'],['emailjs','EmailJS'],['unknown','Le service email']]){
  const message=window.testEmailMessage({ok:true,accepted:true,provider,recipient:'admin@example.invalid'});
  assert.ok(message.startsWith(label+' a accepté'));
  assert.ok(message.includes('La réception reste à confirmer'));
 }
});
test('malformed or unaccepted email test cannot display success',()=>{
 for(const data of [undefined,{}, {ok:true,accepted:false,recipient:'a@b.c'}, {ok:true,accepted:true}, {ok:true,accepted:true,recipient:''}]){
  assert.throws(()=>window.testEmailMessage(data),/Test email non confirmé/);
 }
});

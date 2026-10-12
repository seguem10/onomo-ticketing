const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('ticket update mail is triggered only after a successful persisted update',()=>{
 const source=fs.readFileSync('assets/js/runtime-sync.js','utf8');
 const hook=source.slice(source.indexOf("const previousUpdate=window.updateTicket"),source.indexOf('const previousCreate=window.createTicket'));
 assert.match(hook,/result===true&&window.sbOK\?\.\(\)/);
 assert.match(hook,/deliver\?\.\('updated',\{id\}\)/);
 assert.ok(hook.indexOf('await previousUpdate')<hook.indexOf("'updated'"));
});

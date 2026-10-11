const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={currentUser:{auth_user_id:'user1'}},values=new Map();
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/conversation-extras.js'),'utf8'),{window,document:{getElementById:id=>id==='conversationUseSignature'?{checked:true}:{value:'fr'}},localStorage:{getItem:key=>values.get(key)}});
const parent={id:'parent',ticket_id:'ticket',visibility:'internal',auteur:'IT',message:'Private note'};
test('private note cannot be quoted in public reply or by requester',()=>{
 assert.equal(window.ConversationExtras.quote({reply_to:'parent',visibility:'public'},{id:'ticket'},[parent],true,x=>x),'');
 assert.equal(window.ConversationExtras.quote({reply_to:'parent',visibility:'internal'},{id:'ticket'},[parent],false,x=>x),'');
});
test('quote stays in its ticket and escapes user content',()=>{
 assert.equal(window.ConversationExtras.quote({reply_to:'parent',visibility:'internal'},{id:'other'},[parent],true,x=>x),'');
 const result=window.ConversationExtras.quote({reply_to:'parent',visibility:'internal'},{id:'ticket'},[parent],true,x=>`escaped:${x}`);
 assert.match(result,/escaped:Private note/);
});
test('signature is optional and isolated per user',()=>{
 assert.equal(window.ConversationExtras.withSignature('Hello'),'Hello');values.set('onomo.signature.user1','Signature');
 assert.equal(window.ConversationExtras.withSignature('Hello'),'Hello\n\nSignature');window.currentUser.auth_user_id='user2';
 assert.equal(window.ConversationExtras.withSignature('Hello'),'Hello');
});

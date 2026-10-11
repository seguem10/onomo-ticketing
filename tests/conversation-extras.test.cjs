const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={currentUser:{auth_user_id:'user1'}},values=new Map();
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/conversation-extras.js'),'utf8'),{window,URL,document:{getElementById:id=>id==='conversationUseSignature'?{checked:true}:{value:'fr'}},localStorage:{getItem:key=>values.get(key)}});
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
test('formatting supports legacy emphasis, lists, and code',()=>{
 const html=window.ConversationExtras.format('**Bold** __Underline__ _Italic_ `code`\n1. First\n2. Second\n• Bullet');
 for(const fragment of ['<strong>Bold</strong>','<u>Underline</u>','<em>Italic</em>','<code>code</code>','<ol><li>First</li><li>Second</li></ol>','<ul><li>Bullet</li></ul>'])assert.ok(html.includes(fragment));
});
test('only safe HTTP links become clickable',()=>{
 const html=window.ConversationExtras.format('[Help](https://example.com/a_b)');
 assert.match(html,/href="https:\/\/example.com\/a_b"/);assert.match(html,/rel="noopener noreferrer"/);
 for(const url of ['javascript:alert','data:text/html,test','https://user:secret@example.com','file:///etc/passwd'])assert.ok(!window.ConversationExtras.format(`[x](${url})`).includes('<a '));
});
test('untrusted HTML and link labels are escaped',()=>{
 const html=window.ConversationExtras.format('<img src=x onerror=alert(1)>\n[<script>](https://example.com)\n**<svg>**');
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg>'));assert.match(html,/&lt;img/);
});

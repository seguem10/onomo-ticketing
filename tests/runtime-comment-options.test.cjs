const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/runtime-sync.js'),'utf8');
test('runtime comment wrapper preserves private visibility and reply target',async()=>{
  const calls=[];
  const window={addComment:async(...args)=>{calls.push(args);return {id:'comment'};}};
  const start=source.indexOf('  const previousComment=window.addComment;');
  const end=source.indexOf('\n',source.indexOf("if(typeof previousComment",start));
  vm.runInNewContext(source.slice(start,end),{window,installAuthenticatedSbFetch(){},touch(){},channel:null,syncTickets:async()=>{}});
  const options={visibility:'internal',replyTo:'parent'};
  const result=await window.addComment('Private test',options);
  assert.equal(calls[0][1],options);
  assert.equal(result.id,'comment');
});

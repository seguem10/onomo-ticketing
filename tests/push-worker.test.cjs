const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('service-worker.js','utf8');
function setup(windows=[]){
 const listeners={},shown=[],opened=[];
 const ctx={URL,self:{location:{origin:'https://onomo-ticketing.vercel.app'},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>windows,openWindow:async url=>opened.push(url)}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {listeners,shown,opened};
}
test('push ignores sensitive text and untrusted links in payload',async()=>{
 const {listeners,shown}=setup();let promise;
 listeners.push({data:{json:()=>({body:'PRIVATE HR CONTENT',url:'https://evil.example/'})},waitUntil:p=>promise=p});await promise;
 assert.equal(shown.length,1);assert.doesNotMatch(JSON.stringify(shown),/PRIVATE HR|evil/);
 assert.equal(shown[0][1].data.url,'https://onomo-ticketing.vercel.app/');
});
test('notification click focuses same-origin window without changing its route',async()=>{
 let focused=0,promise,closed=0;
 const {listeners,opened}=setup([{url:'https://evil.example/',focus:()=>assert.fail('external window')},{url:'https://onomo-ticketing.vercel.app/#users',focus:async()=>focused++}]);
 listeners.notificationclick({notification:{close:()=>closed++,data:{url:'https://evil.example/'}},waitUntil:p=>promise=p});await promise;
 assert.equal(focused,1);assert.equal(closed,1);assert.equal(opened.length,0);
});
test('notification click only opens the fixed application origin when no window exists',async()=>{
 const {listeners,opened}=setup();let promise;
 listeners.notificationclick({notification:{close(){},data:{url:'javascript:evil'}},waitUntil:p=>promise=p});await promise;
 assert.deepEqual(opened,['https://onomo-ticketing.vercel.app/']);
});

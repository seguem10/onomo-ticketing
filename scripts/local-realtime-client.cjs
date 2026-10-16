// Executed inside LOCAL Storage container; synthetic tokens arrive on stdin.
const fs=require('node:fs');const assert=require('node:assert/strict');const WebSocket=require('/app/node_modules/ws');
const input=JSON.parse(fs.readFileSync(0,'utf8'));const sockets=[];let phase='subscribe';
function subscribe(token,label){return new Promise((resolve,reject)=>{const events=[];const ws=new WebSocket('ws://realtime:4000/socket/websocket?apikey='+encodeURIComponent(token)+'&vsn=1.0.0',{headers:{Host:'realtime-dev.localhost:4000'}});sockets.push(ws);const timeout=setTimeout(()=>reject(new Error('Subscription timed out')),20000);ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({topic:'realtime:'+label,event:'phx_join',ref:'1',payload:{config:{broadcast:{ack:false,self:false},presence:{key:''},postgres_changes:[{event:'UPDATE',schema:'public',table:'recipe_tickets'}],private:false},access_token:token}})));ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.event==='postgres_changes')events.push(msg.payload);if(msg.event==='system'&&msg.payload?.status==='ok'){clearTimeout(timeout);resolve({ws,events});}if(msg.event==='phx_reply'&&msg.payload?.status==='error'){clearTimeout(timeout);reject(new Error('Join denied'));}});});}
async function patch(id,token,label){const r=await fetch('http://rest:3000/recipe_tickets?id=eq.'+id,{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({titre:label})});assert.ok(r.ok);}
const contains=(events,id)=>events.some(e=>e.data?.record?.id===id||e.record?.id===id);
(async()=>{
 const [a,b]=await Promise.all([subscribe(input.a.token,'test-a'),subscribe(input.b.token,'test-b')]);console.log('PASS both authenticated subscriptions ready');
 phase='delivery';await patch(input.idA,input.a.token,'Fake realtime A');await patch(input.idB,input.b.token,'Fake realtime B');
 const until=Date.now()+15000;while(Date.now()<until&&(!contains(a.events,input.idA)||!contains(b.events,input.idB)))await new Promise(r=>setTimeout(r,250));
 assert.ok(contains(a.events,input.idA));console.log('PASS A receives authorized event A');assert.ok(contains(b.events,input.idB));console.log('PASS B receives authorized event B');
 assert.equal(contains(a.events,input.idB),false);assert.equal(contains(b.events,input.idA),false);console.log('PASS cross-hotel events absent with positive controls');
 console.log('4 local Realtime checks PASS; minimal scope fixture only.');
})().catch(()=>{console.error('Local Realtime test failed at '+phase+'; sensitive output suppressed.');process.exitCode=1;}).finally(()=>{for(const ws of sockets)ws.terminate();});

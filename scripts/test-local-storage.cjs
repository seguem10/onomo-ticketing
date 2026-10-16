const fs=require('node:fs');const crypto=require('node:crypto');const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const sql=q=>execFileSync('docker',['exec','-i','onomo-recipe-db','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,stdio:['pipe','pipe','pipe']});
const base='http://127.0.0.1:65435';let phase='health';
async function account(){const r=await fetch('http://127.0.0.1:65433/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'file-test-'+crypto.randomUUID()+'@example.com',password:crypto.randomBytes(24).toString('hex')+'Aa9!'})});assert.equal(r.status,200);const x=await r.json();assert.match(x.user.id,/^[0-9a-f-]{36}$/);return {id:x.user.id,token:x.access_token};}
const headers=t=>({'Content-Type':'application/json',...(t?{Authorization:'Bearer '+t}:{})});
(async()=>{
 assert.equal((await fetch(base+'/status')).status,200);
 phase='fixture';sql(fs.readFileSync('tests/local-storage-fixture.sql','utf8'));const a=await account(),b=await account(),ticket=crypto.randomUUID();
 sql(`insert into recipe.accounts values('${a.id}','it_hotel',array['FAKE-A']),('${b.id}','it_hotel',array['FAKE-B']);insert into public.recipe_tickets(id,hotel,created_by,titre) values('${ticket}','FAKE-A','${a.id}','Synthetic attachment');`);
 const object='/recipe-private/'+ticket+'/fake.txt';
 phase='upload own';const uploaded=await fetch(base+'/object'+object,{method:'POST',headers:{Authorization:'Bearer '+a.token,'Content-Type':'text/plain'},body:'FICTITIOUS LOCAL CONTENT'});assert.equal(uploaded.status,200);console.log('PASS authorized synthetic upload');
 phase='read own';const own=await fetch(base+'/object/authenticated'+object,{headers:headers(a.token)});assert.equal(own.status,200);assert.equal(await own.text(),'FICTITIOUS LOCAL CONTENT');console.log('PASS authorized private file read');
 phase='read other';const foreign=await fetch(base+'/object/authenticated'+object,{headers:headers(b.token)});assert.ok(foreign.status>=400);console.log('PASS other hotel private file read refused');
 phase='anonymous';assert.ok((await fetch(base+'/object/authenticated'+object)).status>=400);console.log('PASS anonymous private file read refused');
 phase='foreign signing';const denied=await fetch(base+'/object/sign'+object,{method:'POST',headers:headers(b.token),body:JSON.stringify({expiresIn:60})});assert.ok(denied.status>=400);console.log('PASS other hotel cannot create signed URL');
 phase='authorized signing';const signed=await fetch(base+'/object/sign'+object,{method:'POST',headers:headers(a.token),body:JSON.stringify({expiresIn:1})});assert.equal(signed.status,200);const data=await signed.json();assert.ok(data.signedURL?.startsWith('/object/sign/'));const url=base+data.signedURL;assert.equal(new URL(url).hostname,'127.0.0.1');assert.equal((await fetch(url)).status,200);console.log('PASS valid short signed URL');
 await new Promise(resolve=>setTimeout(resolve,2100));phase='expiration';assert.ok((await fetch(url)).status>=400);console.log('PASS signed URL expires');
 console.log('7 real localhost Storage assertions PASS. Minimal fixture, not full production storage audit.');
})().catch(()=>{console.error('Local Storage test failed at '+phase+'; no sensitive response printed.');process.exit(1);});

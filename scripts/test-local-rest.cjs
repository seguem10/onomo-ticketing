const fs=require('node:fs');const crypto=require('node:crypto');const assert=require('node:assert/strict');const {execFileSync}=require('node:child_process');
const sql=q=>execFileSync('docker',['exec','-i','onomo-recipe-db','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,stdio:['pipe','pipe','pipe']});
async function account(){const email='recipe-'+crypto.randomUUID()+'@example.com',password=crypto.randomBytes(24).toString('hex')+'Aa9!';const r=await fetch('http://127.0.0.1:65433/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);const data=await r.json();assert.match(data.user.id,/^[0-9a-f-]{36}$/);return {id:data.user.id,token:data.access_token};}
async function rest(path,token,method='GET',body){const r=await fetch('http://127.0.0.1:65434/recipe_tickets'+path,{method,headers:{'Content-Type':'application/json',Prefer:'return=representation',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json();}catch(_){}return {status:r.status,data};}
let phase='fixture';
(async()=>{
 sql(fs.readFileSync('tests/local-rest-fixture.sql','utf8'));
 phase='accounts';const a=await account(),b=await account();const idA=crypto.randomUUID(),idB=crypto.randomUUID();
 sql(`insert into recipe.accounts values('${a.id}','it_hotel',array['FAKE-A']),('${b.id}','it_hotel',array['FAKE-B']);insert into public.recipe_tickets(id,hotel,created_by,titre) values('${idA}','FAKE-A','${a.id}','Fictitious A'),('${idB}','FAKE-B','${b.id}','Fictitious B');`);
 phase='read A';const rows=await rest('?select=id,hotel',a.token);assert.equal(rows.status,200);assert.deepEqual(rows.data.map(r=>r.hotel),['FAKE-A']);console.log('PASS real Auth token reads only hotel A');
 phase='IDOR';const hidden=await rest('?id=eq.'+idB,a.token);assert.equal(hidden.status,200);assert.deepEqual(hidden.data,[]);console.log('PASS foreign UUID read returns no data');
 phase='update B';const denied=await rest('?id=eq.'+idB,a.token,'PATCH',{titre:'Denied fake change'});assert.equal(denied.status,200);assert.deepEqual(denied.data,[]);console.log('PASS foreign UUID update affects no row');
 phase='update A';const allowed=await rest('?id=eq.'+idA,a.token,'PATCH',{titre:'Allowed fake change'});assert.equal(allowed.status,200);assert.equal(allowed.data.length,1);console.log('PASS authorized update works');
 phase='insert B';const cross=await rest('',a.token,'POST',{hotel:'FAKE-B',created_by:a.id,titre:'Denied fake insert'});assert.equal(cross.status,403);console.log('PASS cross-hotel insert refused');
 phase='impersonation';const forged=await rest('',a.token,'POST',{hotel:'FAKE-A',created_by:b.id,titre:'Denied fake author'});assert.equal(forged.status,403);console.log('PASS creator impersonation refused');
 phase='read B';const other=await rest('?select=id,hotel',b.token);assert.equal(other.status,200);assert.deepEqual(other.data.map(r=>r.hotel),['FAKE-B']);console.log('PASS second account remains scoped to B');
 phase='anonymous';const anon=await rest('?select=id',null);assert.ok([401,403].includes(anon.status));console.log('PASS anonymous read refused');
 console.log('8 real localhost REST assertions PASS; fixture policy model, not complete production schema.');
})().catch(()=>{console.error('Local REST test failed at '+phase+'; sensitive response suppressed.');process.exit(1);});

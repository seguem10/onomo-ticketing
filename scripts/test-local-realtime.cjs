const crypto=require('node:crypto');const path=require('node:path');const assert=require('node:assert/strict');const {execFileSync,spawnSync}=require('node:child_process');
const sql=q=>execFileSync('docker',['exec','-i','onomo-recipe-db','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{input:q,stdio:['pipe','pipe','pipe']});
async function account(){const r=await fetch('http://127.0.0.1:65433/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'realtime-test-'+crypto.randomUUID()+'@example.com',password:crypto.randomBytes(24).toString('hex')+'Aa9!'})});assert.equal(r.status,200);const data=await r.json();assert.match(data.user.id,/^[0-9a-f-]{36}$/);return {id:data.user.id,token:data.access_token};}
(async()=>{
 const a=await account(),b=await account(),idA=crypto.randomUUID(),idB=crypto.randomUUID();
 sql(`insert into recipe.accounts values('${a.id}','it_hotel',array['FAKE-A']),('${b.id}','it_hotel',array['FAKE-B']);insert into public.recipe_tickets(id,hotel,created_by,titre) values('${idA}','FAKE-A','${a.id}','Fictitious realtime A'),('${idB}','FAKE-B','${b.id}','Fictitious realtime B');do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='recipe_tickets') then alter publication supabase_realtime add table public.recipe_tickets;end if;end$$;`);
 execFileSync('docker',['cp',path.join(__dirname,'local-realtime-client.cjs'),'onomo-recipe-storage:/tmp/onomo-realtime-client.cjs'],{stdio:'pipe'});
 const result=spawnSync('docker',['exec','-i','onomo-recipe-storage','node','/tmp/onomo-realtime-client.cjs'],{input:JSON.stringify({a,b,idA,idB}),encoding:'utf8'});
 process.stdout.write(result.stdout||'');if(result.status!==0){console.error('Realtime fixture test incomplete; no credentials printed.');process.exit(1);}
})().catch(()=>{console.error('Local Realtime setup failed; sensitive output suppressed.');process.exit(1);});

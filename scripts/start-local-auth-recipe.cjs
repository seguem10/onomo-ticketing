// Local-only generated Compose. No remote projects, real accounts or secrets.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {execFileSync,spawnSync}=require('node:child_process');
const directory=path.resolve(__dirname,'../../onomo-security-local');
const original=JSON.parse(execFileSync('docker',['inspect','supabase_db_onomo-security-local'],{encoding:'utf8'}))[0];
if(original.State.Running)throw new Error('Stop only the known recipe DB before reuse');
const mount=original.Mounts.find(m=>m.Type==='volume'&&m.Name==='supabase_db_onomo-security-local');
if(!mount)throw new Error('Expected local-only volume missing');
const values=Object.fromEntries(original.Config.Env.map(item=>{const at=item.indexOf('=');return [item.slice(0,at),item.slice(at+1)];}));
if(!values.POSTGRES_PASSWORD)throw new Error('Local DB password missing');
const env={...process.env,RECIPE_DB_PASSWORD:values.POSTGRES_PASSWORD,RECIPE_JWT_SECRET:crypto.randomBytes(48).toString('hex')};
const config={name:'onomo-auth-recipe',services:{
 db:{image:'public.ecr.aws/supabase/postgres:17.6.1.167',container_name:'onomo-recipe-db',ports:['127.0.0.1:65432:5432'],volumes:['localdb:/var/lib/postgresql/data'],environment:{POSTGRES_PASSWORD:'${RECIPE_DB_PASSWORD}'},healthcheck:{test:['CMD','pg_isready','-U','postgres'],interval:'3s',timeout:'3s',retries:20}},
 auth:{image:'public.ecr.aws/supabase/gotrue:v2.196.0',container_name:'onomo-recipe-auth',ports:['127.0.0.1:65433:9999'],depends_on:{db:{condition:'service_healthy'}},environment:{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:'http://127.0.0.1:65433',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:'postgres://supabase_auth_admin:${RECIPE_DB_PASSWORD}@db:5432/postgres',GOTRUE_SITE_URL:'http://127.0.0.1:65434',GOTRUE_JWT_SECRET:'${RECIPE_JWT_SECRET}',GOTRUE_JWT_EXP:'900',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_MFA_TOTP_ENROLL_ENABLED:'true',GOTRUE_MFA_TOTP_VERIFY_ENABLED:'true'},healthcheck:{test:['CMD','wget','--spider','-q','http://127.0.0.1:9999/health'],interval:'3s',timeout:'3s',retries:20}},
 rest:{image:'public.ecr.aws/supabase/postgrest:v16.2',container_name:'onomo-recipe-rest',ports:['127.0.0.1:65434:3000'],depends_on:{db:{condition:'service_healthy'}},environment:{PGRST_DB_URI:'postgres://authenticator:${RECIPE_DB_PASSWORD}@db:5432/postgres',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:'${RECIPE_JWT_SECRET}'}}
},volumes:{localdb:{external:true,name:mount.Name}}};
const file=path.join(directory,'compose.auth-recipe.json');fs.writeFileSync(file,JSON.stringify(config,null,2));
const result=spawnSync('docker',['compose','-f',file,'up','-d'],{env,encoding:'utf8'});
if(result.status!==0){process.stderr.write('Local Compose failed; inspect health without logging credentials.\n');process.exit(result.status||1);}
const containers=JSON.parse(execFileSync('docker',['inspect','onomo-recipe-db','onomo-recipe-auth','onomo-recipe-rest'],{encoding:'utf8'}));
for(const c of containers)for(const bindings of Object.values(c.HostConfig.PortBindings||{}))for(const b of bindings||[])if(b.HostIp!=='127.0.0.1')throw new Error('Unexpected non-loopback port');
console.log('Local Compose started; all three services bind only to 127.0.0.1. Health/API tests still required.');

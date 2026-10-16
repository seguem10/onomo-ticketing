const crypto=require('node:crypto');const assert=require('node:assert/strict');
const origin='http://127.0.0.1:65433';
async function request(route,body,token){const r=await fetch(origin+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});let data={};try{data=await r.json();}catch(_){}return {status:r.status,data};}
function totp(secret){let bits='';for(const char of secret.toUpperCase().replace(/=+$/,'')){const n='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);if(n<0)throw new Error('Invalid local test secret');bits+=n.toString(2).padStart(5,'0');}const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hmac=crypto.createHmac('sha1',Buffer.from(bytes)).update(counter).digest();const offset=hmac[19]&15;return ((hmac.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0');}
(async()=>{
 const email='onomo-test-'+crypto.randomUUID()+'@example.com',password=crypto.randomBytes(24).toString('base64url')+'Aa9!';
 const signup=await request('/signup',{email,password});assert.equal(signup.status,200);assert.ok(signup.data.user?.id);console.log('PASS synthetic local signup');
 const bad=await request('/token?grant_type=password',{email,password:'IncorrectFakePassword9!'});assert.notEqual(bad.status,200);console.log('PASS incorrect password refused');
 const login=await request('/token?grant_type=password',{email,password});assert.equal(login.status,200);assert.ok(login.data.access_token);console.log('PASS local password login');
 const identity=await request('/user',null,login.data.access_token);assert.equal(identity.status,200);assert.equal(identity.data.id,signup.data.user.id);console.log('PASS authenticated identity');
 const enroll=await request('/factors',{factor_type:'totp',friendly_name:'Isolated audit'},login.data.access_token);assert.equal(enroll.status,200);assert.ok(enroll.data.totp?.secret);
 const challenge=await request('/factors/'+enroll.data.id+'/challenge',{},login.data.access_token);assert.equal(challenge.status,200);
 const verified=await request('/factors/'+enroll.data.id+'/verify',{challenge_id:challenge.data.id,code:totp(enroll.data.totp.secret)},login.data.access_token);assert.equal(verified.status,200);
 assert.equal(JSON.parse(Buffer.from(verified.data.access_token.split('.')[1],'base64url')).aal,'aal2');console.log('PASS real local TOTP verification yields AAL2');
 const logout=await request('/logout?scope=global',{},verified.data.access_token);assert.equal(logout.status,204);
 const refresh=await request('/token?grant_type=refresh_token',{refresh_token:verified.data.refresh_token});assert.notEqual(refresh.status,200);console.log('PASS logged-out refresh token refused');
 console.log('6 local Auth assertions PASS. No production request, no email sent, no credentials printed.');
})().catch(()=>{console.error('Local Auth test failed; no sensitive response printed.');process.exit(1);});

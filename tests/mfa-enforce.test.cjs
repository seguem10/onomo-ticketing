const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/mfa-auth.js','utf8');

function load({enrollResults}={}){
  const calls={enroll:[],unenroll:0};
  let modal=null;
  const element=()=>({addEventListener(){},focus(){},dataset:{},set innerHTML(v){},get innerHTML(){return '';}});
  const document={
    getElementById:id=>id==='nativeMfaModal'?modal:(modal?element():null),
    querySelectorAll:()=>[],
    createElement:()=>({set innerHTML(v){},remove(){modal=null;}}),
    body:{appendChild:node=>{modal=node;}},
  };
  const results=[...(enrollResults||[{data:{id:'f1',totp:{qr_code:'',secret:'ABCD'}}}])];
  const auth={mfa:{
    getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}}),
    listFactors:async()=>({data:{totp:[],phone:[],all:[]}}),
    unenroll:async()=>{calls.unenroll++;return {};},
    enroll:async params=>{calls.enroll.push(params.friendlyName);await new Promise(r=>setTimeout(r,5));return results.shift()||{data:{id:'f2',totp:{qr_code:'',secret:'EFGH'}}};},
  }};
  const window={OnomoAuth:{getClient:()=>({auth})},showToast(){}};
  const ctx={window,document,console:{warn(){}},setTimeout,Promise};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  return {mfa:window.OnomoMfa,calls,hasModal:()=>!!modal};
}

const session={user:{app_metadata:{mfa_required:true}}};

test('concurrent sign-in and restore enroll MFA only once',async()=>{
  const {mfa,calls,hasModal}=load();
  const [a,b]=await Promise.all([mfa.enforce(session),mfa.enforce(session)]);
  assert.equal(a,false);assert.equal(b,false);
  assert.equal(calls.enroll.length,1);
  assert.ok(hasModal());
});

test('a later check keeps the MFA screen already shown',async()=>{
  const {mfa,calls}=load();
  await mfa.enforce(session);
  await mfa.enforce(session);
  assert.equal(calls.enroll.length,1);
});

test('a factor name conflict falls back to a dated name',async()=>{
  const {mfa,calls,hasModal}=load({enrollResults:[
    {error:{code:'mfa_factor_name_conflict',message:'A factor with the friendly name "ONOMO Support IT" for this user already exists'}},
    {data:{id:'f3',totp:{qr_code:'',secret:'IJKL'}}},
  ]});
  assert.equal(await mfa.enforce(session),false);
  assert.equal(calls.enroll.length,2);
  assert.match(calls.enroll[1],/^ONOMO Support IT \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.ok(hasModal());
});

test('MFA is skipped when it is not required',async()=>{
  const {mfa,calls}=load();
  assert.equal(await mfa.enforce({user:{app_metadata:{}}}),true);
  assert.equal(calls.enroll.length,0);
});

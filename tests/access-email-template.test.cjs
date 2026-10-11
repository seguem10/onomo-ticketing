const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('../supabase/functions/access-request-email/template.mjs');
const notification={request_id:'request',event_stage:'it',recipient_id:'recipient'};
const request={id:'request',stage:'it',hotel:'Airport',system_name:'OPERA',description:'PRIVATE SECRET',subject:'sensitive request'};
const recipient={auth_user_id:'recipient',email:'qa@example.com',prenom:'QA'};
test('email parameters contain status but no request free text or secrets',async()=>{
 const {accessEmailParameters:parameters}=await modulePromise;const value=parameters(notification,request,recipient);
 assert.equal(value.to_email,'qa@example.com');assert.match(value.request_status,/validation IT/);
 assert.doesNotMatch(JSON.stringify(value),/PRIVATE SECRET|sensitive request/);
 assert.equal(value.app_url,'https://onomo-ticketing.vercel.app/');
});
test('email contract refuses stale stages or mismatched recipients',async()=>{
 const {accessEmailParameters:parameters}=await modulePromise;
 assert.throws(()=>parameters(notification,{...request,stage:'hr'},recipient),/stale/);
 assert.throws(()=>parameters(notification,request,{...recipient,auth_user_id:'other'}),/wrong_recipient/);
});

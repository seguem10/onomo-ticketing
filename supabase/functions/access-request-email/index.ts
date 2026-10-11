import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { accessEmailParameters } from './template.mjs';
const url=Deno.env.get('SUPABASE_URL')||'';
const anon=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const serviceId=Deno.env.get('EMAILJS_SERVICE_ID')||'';
const templateId=Deno.env.get('ACCESS_REQUEST_EMAILJS_TEMPLATE_ID')||'';
const publicKey=Deno.env.get('EMAILJS_PUBLIC_KEY')||'';
const privateKey=Deno.env.get('EMAILJS_PRIVATE_KEY')||'';
const options={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(async req=>{
 const cors={'Access-Control-Allow-Origin':'https://onomo-ticketing.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
 if(req.method==='OPTIONS')return reply({});
 if(req.method!=='POST')return reply({error:'Méthode interdite'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!token)return reply({error:'Session requise'},401);
  const input=await req.json();
  if(typeof input.request_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.request_id))return reply({error:'Demande invalide'},400);
  const caller=createClient(url,anon,{...options,global:{headers:{Authorization:`Bearer ${token}`}}});
  const auth=await caller.auth.getUser(token);
  if(auth.error||!auth.data.user)return reply({error:'Session invalide'},401);
  // The request read enforces live session, first-login, MFA and scoped RLS.
  const result=await caller.from('access_requests').select('id,requester_id,hotel,stage,system_name').eq('id',input.request_id).maybeSingle();
  if(result.error||!result.data)return reply({error:'Demande inaccessible'},403);
  const request=result.data;
  let authorized=request.stage==='it'&&request.requester_id===auth.data.user.id;
  if(request.stage!=='it'){
   const last=await caller.from('access_request_decisions').select('actor_id').eq('request_id',request.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
   authorized=!last.error&&last.data?.actor_id===auth.data.user.id;
  }
  if(!authorized)return reply({error:'Seul l’auteur de cet événement peut déclencher son envoi'},403);
  if(!serviceId||!templateId||!publicKey)return reply({configured:false,delivered:0});
  const service=createClient(url,serviceKey,options);
  const notifications=await service.from('access_request_notifications').select('id,request_id,recipient_id,event_stage').eq('request_id',request.id).eq('event_stage',request.stage).order('created_at').limit(30);
  if(notifications.error)throw notifications.error;
  let delivered=0,failed=0,skipped=0;
  for(const notification of notifications.data||[]){
   const profile=await service.from('utilisateurs').select('auth_user_id,email,prenom,nom').eq('auth_user_id',notification.recipient_id).maybeSingle();
   if(profile.error||!profile.data){skipped++;continue;}
   let params;
   try{params=accessEmailParameters(notification,request,profile.data);}catch(_){skipped++;continue;}
   await new Promise(resolve=>setTimeout(resolve,1100));
   const claim=await service.rpc('claim_access_email',{notification_id:notification.id});
   if(claim.error)throw claim.error;
   if(claim.data!==true){skipped++;continue;}
   let deliveryStatus='uncertain',httpStatus:number|null=null;
   try{
    const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
     method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
     body:JSON.stringify({service_id:serviceId,template_id:templateId,user_id:publicKey,accessToken:privateKey||undefined,template_params:params})
    });
    httpStatus=response.status;deliveryStatus=response.ok?'sent':'failed';
    if(response.ok)delivered++;else failed++;
   }catch(_){failed++;}
   const finish=await service.rpc('finish_access_email',{notification_id:notification.id,delivery_status:deliveryStatus,http_status:httpStatus});
   if(finish.error)console.error('access_email_ledger_update_failed');
  }
  return reply({configured:true,delivered,failed,skipped});
 }catch(_){return reply({error:'Envoi indisponible. La demande et les alertes restent enregistrées.'},500);}
});

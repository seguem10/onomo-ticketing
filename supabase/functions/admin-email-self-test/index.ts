import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
const url=Deno.env.get('SUPABASE_URL')||'';
const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const options={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(async req=>{
 const headers={'Access-Control-Allow-Origin':'https://onomo-ticketing.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({error:'Méthode interdite'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'Session requise'},401);
  const caller=createClient(url,anon,{...options,global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data,error}=await caller.auth.getUser(token);if(error||!data.user?.email||!data.user.email_confirmed_at)return reply({error:'Session ou adresse confirmée requise'},401);
  const permission=await caller.rpc('is_admin');if(permission.error||permission.data!==true)return reply({error:'Administrateur requis'},403);
  const service=createClient(url,serviceKey,options);
  const claim=await service.rpc('claim_admin_email_self_test',{actor:data.user.id});
  if(claim.error)return reply({error:'Protection anti-répétition indisponible'},503);
  if(claim.data!==true)return reply({error:'Attendez 60 secondes avant un nouveau test'},429);
  const serviceId=Deno.env.get('EMAILJS_SERVICE_ID'),templateId=Deno.env.get('EMAILJS_TEMPLATE_ID'),publicKey=Deno.env.get('EMAILJS_PUBLIC_KEY');
  if(!serviceId||!templateId||!publicKey)return reply({error:'Configuration EmailJS incomplète'},503);
  const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
   method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),
   body:JSON.stringify({service_id:serviceId,template_id:templateId,user_id:publicKey,accessToken:Deno.env.get('EMAILJS_PRIVATE_KEY')||undefined,
    template_params:{agent_email:data.user.email,to_email:data.user.email,agent_prenom:'Administrateur',to_name:'Administrateur',name:'ONOMO Desk',email:'it@onomohotel.com',ticket_numero:'TEST-NOTIFICATION',ticket_number:'TEST-NOTIFICATION',ticket_titre:'Test email — aucune action requise',ticket_title:'Test email — aucune action requise',ticket_hotel:'Test uniquement',hotel:'Test uniquement',ticket_priorite:'Test',priority:'Test',status:'Test',subject:'[ONOMO] TEST-NOTIFICATION',event_label:'Test de notification email',app_url:'https://onomo-ticketing.vercel.app/',message_html:'Test de notification ONOMO. Aucun ticket créé et aucune action requise.'}})
  });
  await service.from('audit_logs').insert({actor_id:data.user.id,action:response.ok?'email_self_test_accepted':'email_self_test_failed',entity_type:'user',entity_id:data.user.id,metadata:{provider:'emailjs',provider_status:response.status}});
  if(!response.ok)return reply({error:'EmailJS a refusé le test',provider_status:response.status},502);
  return reply({ok:true,provider:'emailjs',accepted:true,recipient:data.user.email});
 }catch(_){return reply({error:'Envoi non confirmé. Vérifiez la boîte mail avant de réessayer.'},502);}
});

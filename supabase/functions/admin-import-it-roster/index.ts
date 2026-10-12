import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import {ROSTER,accountBody} from './roster.mjs';
const url=Deno.env.get('SUPABASE_URL')||'';
const anon=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY')||'';
const settings={auth:{persistSession:false,autoRefreshToken:false}};
Deno.serve(async req=>{
 const headers={'Access-Control-Allow-Origin':'https://onomo-ticketing.vercel.app','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-retry-count,traceparent,tracestate,baggage','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({error:'Méthode interdite'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'Session requise'},401);
  const client=createClient(url,anon,{...settings,global:{headers:{Authorization:`Bearer ${token}`}}});
  const auth=await client.auth.getUser(token);if(auth.error||!auth.data.user)return reply({error:'Session invalide'},401);
  const permission=await client.rpc('is_admin');if(permission.error||permission.data!==true)return reply({error:'Administrateur requis'},403);
  const input=await req.json();if(input.confirm!=='IMPORT_IT_20261012')return reply({error:'Confirmation de la liste requise'},400);
  const hotels=await client.from('hotels').select('nom');if(hotels.error)throw hotels.error;
  const names=new Set(hotels.data.map(h=>h.nom));
  if(ROSTER.some(member=>[member.hotel,...(member.hotels||[])].filter(Boolean).some(h=>!names.has(h))))return reply({error:'Un hôtel de la liste est introuvable'},409);
  const results=[];
  for(const member of ROSTER){
   const exists=await client.from('utilisateurs').select('id').eq('email',member.email).maybeSingle();
   if(exists.error)throw exists.error;
   if(exists.data){results.push({email:member.email,status:'existing_unchanged'});continue;}
   // Random secrets live only in this request and in the admin's one-time
   // response. Never log or persist them in profiles, audit records or Git.
   const bytes=crypto.getRandomValues(new Uint8Array(24));
   const password='Aa9!'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
   const created=await fetch(url+'/functions/v1/admin-create-user',{
    method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:anon,'Content-Type':'application/json'},
    body:JSON.stringify(accountBody(member,password)),signal:AbortSignal.timeout(25000)
   });
   if(!created.ok){results.push({email:member.email,status:'failed',http_status:created.status});continue;}
   results.push({email:member.email,status:'created',temporary_password:password});
  }
  return reply({results,created:results.filter(r=>r.status==='created').length,existing:results.filter(r=>r.status==='existing_unchanged').length,failed:results.filter(r=>r.status==='failed').length});
 }catch(_){return reply({error:'Import interrompu. Les comptes déjà créés sont conservés. Ne relancez pas avant de vérifier la liste ; un mot de passe perdu devra être réinitialisé par l’administrateur.'},500);}
});

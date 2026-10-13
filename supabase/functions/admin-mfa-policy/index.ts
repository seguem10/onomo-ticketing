// ONOMO Support IT — administrator-managed MFA policy.
// An administrator can require MFA, but never sees or creates a user's TOTP
// secret. Enrollment and verification stay between Supabase Auth and the user.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const URL=Deno.env.get("SUPABASE_URL")??"";
const ANON=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")??Deno.env.get("SUPABASE_ANON_KEY")??"";
const SERVICE=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
const allowedOrigin=(origin:string)=>origin==='https://onomo-ticketing.vercel.app'||/^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin)||/^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
const headers=(req:Request)=>{const origin=req.headers.get('origin')??'';return {'Access-Control-Allow-Origin':allowedOrigin(origin)?origin:'https://onomo-ticketing.vercel.app','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin','Content-Type':'application/json'};};
const reply=(req:Request,body:Record<string,unknown>,status=200)=>new Response(JSON.stringify(body),{status,headers:headers(req)});

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{headers:headers(req)});
  if(req.method!=='POST')return reply(req,{error:'Méthode non autorisée.'},405);
  if(!URL||!ANON||!SERVICE)return reply(req,{error:'Service MFA non configuré.'},503);
  const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim();
  if(!token)return reply(req,{error:'Session utilisateur requise.'},401);
  let input:{target_user_id?:unknown;required?:unknown;action?:unknown;reason?:unknown;identity_confirmed?:unknown};
  try{input=await req.json();}catch(_){return reply(req,{error:'Données invalides.'},400);}
  const target=typeof input.target_user_id==='string'?input.target_user_id.trim():'';
  const reset=input.action==='reset';
  const required=reset?true:(typeof input.required==='boolean'?input.required:null);
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(target)||required===null)return reply(req,{error:'Politique MFA invalide.'},400);
  const requester=createClient(URL,ANON,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await requester.auth.getUser(token);
  if(authError||!auth.user)return reply(req,{error:'Session expirée ou invalide.'},401);
  const {data:isAdmin,error:permissionError}=await requester.rpc('is_admin');
  if(permissionError||isAdmin!==true)return reply(req,{error:'Accès réservé aux administrateurs MFA.'},403);
  if(reset){
    const reason=typeof input.reason==='string'?input.reason.trim():'';
    if(reason.length<10||reason.length>300||input.identity_confirmed!==true)return reply(req,{error:'Vérifiez l’identité et indiquez un motif de 10 à 300 caractères.'},400);
    if(target===auth.user.id)return reply(req,{error:'Un autre administrateur doit réinitialiser votre MFA.'},403);
    const {data:assurance,error:assuranceError}=await requester.auth.mfa.getAuthenticatorAssuranceLevel(token);
    if(assuranceError||assurance?.currentLevel!=='aal2')return reply(req,{error:'L’administrateur doit valider son propre MFA avant cette opération.'},403);
  }
  const service=createClient(URL,SERVICE,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileError}=await service.from('utilisateurs').select('id,auth_user_id,email').eq('auth_user_id',target).maybeSingle();
  if(profileError||!profile)return reply(req,{error:'Compte utilisateur introuvable.'},404);
  const {data:targetAuth,error:targetAuthError}=await service.auth.admin.getUserById(target);
  if(targetAuthError||!targetAuth.user)return reply(req,{error:'Compte Auth introuvable.'},404);
  const appMetadata={...(targetAuth.user.app_metadata??{}),mfa_required:required};
  const {error:updateAuthError}=await service.auth.admin.updateUserById(target,{app_metadata:appMetadata});
  if(updateAuthError){console.error('MFA app metadata update',updateAuthError.message);return reply(req,{error:'Impossible de mettre à jour la politique MFA.'},502);}
  const {error:updateProfileError}=await service.from('utilisateurs').update({mfa_enabled:required,mfa_secret:null}).eq('auth_user_id',target);
  if(updateProfileError){console.error('MFA profile update',updateProfileError.message);return reply(req,{error:'La politique MFA Auth a été mise à jour, mais le profil doit être réconcilié.'},502);}
  if(reset){
    const {error:auditError}=await service.from('audit_logs').insert(auditRow(auth.user.id,'mfa_reset_requested',target,{reason:input.reason,identity_confirmed:true}));
    if(auditError)return reply(req,{error:'Journalisation impossible : aucun facteur MFA supprimé.'},502);
    const factors=targetAuth.user.factors??[];
    if(!factors.some(f=>f.status==='verified'))return reply(req,{error:'Aucun facteur vérifié à réinitialiser. Le MFA reste obligatoire.'},409);
    for(const factor of factors){
      const {error:deleteError}=await service.auth.admin.mfa.deleteFactor({userId:target,id:factor.id});
      if(deleteError)return reply(req,{error:'Réinitialisation partielle. MFA obligatoire conservé ; contactez l’administrateur avant de réessayer.'},502);
    }
    const {error:completedAuditError}=await service.from('audit_logs').insert(auditRow(auth.user.id,'mfa_reset_completed',target,{reason:input.reason,factors_removed:factors.length}));
    if(completedAuditError)return reply(req,{error:'MFA réinitialisé mais journal final incomplet. Ne relancez pas.'},502);
    return reply(req,{ok:true,required:true,reenrollment_required:true});
  }
  const audit=await service.from('audit_logs').insert(auditRow(auth.user.id,required?'mfa_required':'mfa_requirement_removed',target,{target_email:profile.email}));
  if(audit.error)console.error('MFA policy audit failed',audit.error.code);
  return reply(req,{ok:true,target_user_id:target,required});
});
import {auditRow} from '../_shared/audit-row.mjs';

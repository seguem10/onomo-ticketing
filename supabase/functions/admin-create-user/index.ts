import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
const roleMap: Record<string, string> = { admin:'Administrateur', administrateur:'Administrateur', direction:'Directeur', directeur:'Directeur', it_regional:'IT Regional', 'it regional':'IT Regional', it_hotel:'IT Hotel', 'it hotel':'IT Hotel', demandeur:'Demandeur', Administrateur:'Administrateur', Directeur:'Directeur', 'IT Regional':'IT Regional', 'IT Hotel':'IT Hotel', Demandeur:'Demandeur' }
function getSecretKey(){ const direct=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(direct)return direct; const single=Deno.env.get('SUPABASE_SECRET_KEY'); if(single&&!single.trim().startsWith('{'))return single; const many=Deno.env.get('SUPABASE_SECRET_KEYS'); if(many){try{const parsed=JSON.parse(many);const first=Object.values(parsed||{})[0];if(typeof first==='string'&&first)return first}catch(_){}} return null }
const normalizeRole=(value:unknown)=>{const raw=String(value||'').trim();return roleMap[raw]||roleMap[raw.toLowerCase()]||raw}
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders}); if(req.method!=='POST')return json({error:'Méthode non autorisée'},405)
  try{
    const supabaseUrl=Deno.env.get('SUPABASE_URL'); const publishableKey=Deno.env.get('SUPABASE_ANON_KEY')||Deno.env.get('SUPABASE_PUBLISHABLE_KEY'); const serviceRoleKey=getSecretKey()
    if(!supabaseUrl||!publishableKey)return json({error:'Configuration Supabase publique manquante'},500); if(!serviceRoleKey)return json({error:'Clé serveur Supabase manquante'},500)
    const token=(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token)return json({error:'Session Supabase requise'},401)
    const callerClient=createClient(supabaseUrl,publishableKey,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}})
    const {data:callerData,error:callerError}=await callerClient.auth.getUser(token); if(callerError||!callerData.user)return json({error:'Session Supabase invalide'},401)
    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:callerRoles,error:rolesError}=await admin.from('app_user_roles').select('role_id, app_roles(name, permissions)').eq('user_id',callerData.user.id)
    if(rolesError){console.error('admin-create-user role lookup failed',{userId:callerData.user.id,message:rolesError.message});return json({error:`Lecture des rôles impossible: ${rolesError.message}`},500)}
    const isAdmin=(callerRoles||[]).some((row:any)=>row.app_roles?.name==='Administrateur'||row.app_roles?.permissions?.includes?.('*')); if(!isAdmin)return json({error:'Accès réservé aux administrateurs'},403)
    let payload:any; try{payload=await req.json()}catch{return json({error:'JSON invalide'},400)}
    const email=String(payload.email||'').trim().toLowerCase(),password=String(payload.password||''),prenom=String(payload.prenom||'').trim(),nom=String(payload.nom||'').trim(),roleInput=String(payload.role||'it_hotel').trim()
    const requestedRoles=Array.isArray(payload.roles)&&payload.roles.length?payload.roles:[roleInput]; const roleNames=[...new Set(requestedRoles.map(normalizeRole).filter(Boolean))]
    const hotel=payload.hotel?String(payload.hotel):null; const hotels=Array.isArray(payload.hotels)?payload.hotels.map((v:unknown)=>String(v)):[]
    if(!email||!password)return json({error:'Email et mot de passe requis'},400); if(password.length<8)return json({error:'Le mot de passe doit contenir au moins 8 caractères'},400)
    const allowedRoles=new Set(['Administrateur','IT Regional','IT Hotel','Directeur','Demandeur']); if(!roleNames.length||roleNames.some((r:string)=>!allowedRoles.has(r)))return json({error:`Rôle non autorisé: ${roleNames.join(', ')}`},400)
    console.log('admin-create-user start',{caller:callerData.user.id,email,roles:roleNames,hotel,hotelsCount:hotels.length})
    const {data:authData,error:authError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{prenom,nom,role:roleNames[0],roles:roleNames,hotel,hotels}})
    if(authError||!authData.user){console.error('admin-create-user auth.createUser failed',{email,message:authError?.message,status:authError?.status});return json({error:authError?.message||'Création Auth impossible'},400)}
    const authUser=authData.user
    const profile={id:authUser.id,auth_user_id:authUser.id,email,pwd:'',prenom,nom,role:roleNames[0],hotel,hotels,roles:roleNames,must_change_password:false,mfa_enabled:false,mfa_secret:null,created_at:new Date().toISOString()}
    const {error:profileError}=await admin.from('utilisateurs').insert(profile)
    if(profileError){console.error('admin-create-user profile insert failed',{authUserId:authUser.id,message:profileError.message,code:profileError.code,details:profileError.details});await admin.auth.admin.deleteUser(authUser.id);return json({error:`Profil utilisateurs impossible: ${profileError.message}`},400)}
    for(const roleName of roleNames){
      const {data:roleRow,error:roleError}=await admin.from('app_roles').select('id').eq('name',roleName).maybeSingle(); if(roleError||!roleRow){console.error('admin-create-user role not found',{roleName,message:roleError?.message});await admin.from('utilisateurs').delete().eq('auth_user_id',authUser.id);await admin.auth.admin.deleteUser(authUser.id);return json({error:`Rôle introuvable: ${roleName}`},400)}
      const {error:linkError}=await admin.from('app_user_roles').insert({user_id:authUser.id,role_id:roleRow.id}); if(linkError){console.error('admin-create-user role link failed',{roleName,message:linkError.message,code:linkError.code,details:linkError.details});await admin.from('utilisateurs').delete().eq('auth_user_id',authUser.id);await admin.auth.admin.deleteUser(authUser.id);return json({error:`Association du rôle impossible: ${linkError.message}`},400)}
    }
    console.log('admin-create-user success',{authUserId:authUser.id,email,roles:roleNames}); return json({ok:true,user:{id:authUser.id,email,prenom,nom,role:roleNames[0],hotel,hotels,roles:roleNames}},201)
  }catch(error){console.error('admin-create-user unhandled error',error instanceof Error?{message:error.message,stack:error.stack}:error);return json({error:error instanceof Error?error.message:'Erreur serveur lors de la création du compte'},500)}
})

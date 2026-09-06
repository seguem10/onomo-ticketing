import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const roleMap: Record<string, string> = {
  admin: 'Administrateur',
  direction: 'Directeur',
  it_regional: 'IT Regional',
  it_hotel: 'IT Hotel',
  Administrateur: 'Administrateur',
  Directeur: 'Directeur',
  'IT Regional': 'IT Regional',
  'IT Hotel': 'IT Hotel',
  Demandeur: 'Demandeur',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY')
  if (!serviceRoleKey) return json({ error: 'Clé serveur Supabase manquante' }, 500)

  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Session Supabase requise' }, 401)

  const callerClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token)
  if (callerError || !callerData.user) return json({ error: 'Session Supabase invalide' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: callerRoles, error: rolesError } = await admin
    .from('app_user_roles')
    .select('role_id, app_roles(name, permissions)')
    .eq('user_id', callerData.user.id)

  if (rolesError) return json({ error: rolesError.message }, 500)
  const isAdmin = (callerRoles || []).some((row: any) => {
    const role = row.app_roles
    return role?.name === 'Administrateur' || role?.permissions?.includes?.('*')
  })
  if (!isAdmin) return json({ error: 'Accès réservé aux administrateurs' }, 403)

  let payload: any
  try { payload = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }

  const email = String(payload.email || '').trim().toLowerCase()
  const password = String(payload.password || '')
  const prenom = String(payload.prenom || '').trim()
  const nom = String(payload.nom || '').trim()
  const roleInput = String(payload.role || 'it_hotel')
  const roleNames = Array.isArray(payload.roles) && payload.roles.length
    ? payload.roles.map((r: string) => roleMap[r] || r)
    : [roleMap[roleInput] || roleInput]
  const hotel = payload.hotel ? String(payload.hotel) : null
  const hotels = Array.isArray(payload.hotels) ? payload.hotels : []

  if (!email || !password) return json({ error: 'Email et mot de passe requis' }, 400)
  if (password.length < 8) return json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, 400)

  const allowedRoles = new Set(['Administrateur', 'IT Regional', 'IT Hotel', 'Directeur', 'Demandeur'])
  if (roleNames.some((r: string) => !allowedRoles.has(r))) return json({ error: 'Rôle non autorisé' }, 400)

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { prenom, nom, role: roleNames[0], hotel, hotels },
  })
  if (authError || !authData.user) return json({ error: authError?.message || 'Création Auth impossible' }, 400)

  const authUser = authData.user
  const profile = {
    id: authUser.id,
    auth_user_id: authUser.id,
    email,
    pwd: '',
    prenom,
    nom,
    role: roleInput,
    hotel,
    hotels,
    must_change_password: false,
    mfa_enabled: false,
    mfa_secret: null,
    created_at: new Date().toISOString(),
  }

  const { error: profileError } = await admin.from('utilisateurs').insert(profile)
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.id)
    return json({ error: `Profil utilisateurs impossible: ${profileError.message}` }, 400)
  }

  for (const roleName of roleNames) {
    const { data: roleRow, error: roleError } = await admin
      .from('app_roles')
      .select('id')
      .eq('name', roleName)
      .maybeSingle()
    if (roleError || !roleRow) {
      await admin.from('utilisateurs').delete().eq('auth_user_id', authUser.id)
      await admin.auth.admin.deleteUser(authUser.id)
      return json({ error: `Rôle introuvable: ${roleName}` }, 400)
    }
    const { error: linkError } = await admin.from('app_user_roles').insert({ user_id: authUser.id, role_id: roleRow.id })
    if (linkError) {
      await admin.from('utilisateurs').delete().eq('auth_user_id', authUser.id)
      await admin.auth.admin.deleteUser(authUser.id)
      return json({ error: `Association du rôle impossible: ${linkError.message}` }, 400)
    }
  }

  return json({ ok: true, user: { id: authUser.id, email, prenom, nom, role: roleInput, hotel, hotels, roles: roleNames } }, 201)
})

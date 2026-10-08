import { createClient } from "npm:@supabase/supabase-js@2";

const projectUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin") || "";
  const local = origin === "http://localhost" || origin.startsWith("http://localhost:");
  const preview = origin.startsWith("https://onomo-ticketing-") && origin.endsWith(".vercel.app");
  return origin === "https://onomo-ticketing.vercel.app" || local || preview ? origin : "";
}

function response(request: Request, body: Record<string, unknown>, status = 200) {
  const origin = allowedOrigin(request);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function strongPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 12) return false;
  let lower = false;
  let upper = false;
  let digit = false;
  let special = false;
  for (const char of Array.from(value)) {
    if (char >= "a" && char <= "z") lower = true;
    else if (char >= "A" && char <= "Z") upper = true;
    else if (char >= "0" && char <= "9") digit = true;
    else special = true;
  }
  return lower && upper && digit && special;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return response(request, {});
  if (request.method !== "POST") return response(request, { error: "Méthode non autorisée." }, 405);
  if (!projectUrl || !anonKey || !serviceRoleKey) return response(request, { error: "Configuration serveur incomplète." }, 500);

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return response(request, { error: "Session utilisateur requise." }, 401);
  const token = authorization.slice(7);
  let payload: { password?: unknown };
  try { payload = await request.json(); } catch (_) { return response(request, { error: "Requête invalide." }, 400); }
  if (!strongPassword(payload.password)) {
    return response(request, { error: "Utilisez au moins 12 caractères avec une majuscule, une minuscule, un chiffre et un caractère spécial." }, 400);
  }

  const requester = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: requesterData, error: requesterError } = await requester.auth.getUser(token);
  if (requesterError || !requesterData.user) return response(request, { error: "Session utilisateur invalide." }, 401);

  const admin = createClient(projectUrl, serviceRoleKey);
  const { data: profile, error: profileError } = await admin
    .from("utilisateurs")
    .select("id,email,must_change_password")
    .eq("auth_user_id", requesterData.user.id)
    .maybeSingle();
  if (profileError) return response(request, { error: "Profil utilisateur indisponible." }, 500);
  if (!profile) return response(request, { error: "Profil utilisateur introuvable." }, 404);
  if (profile.must_change_password !== true) return response(request, { error: "Cette étape initiale a déjà été terminée." }, 409);

  const appMetadata = { ...(requesterData.user.app_metadata || {}), mfa_required: true };
  const { error: authUpdateError } = await admin.auth.admin.updateUserById(requesterData.user.id, {
    password: payload.password as string,
    app_metadata: appMetadata,
  });
  if (authUpdateError) return response(request, { error: "Le mot de passe n’a pas pu être mis à jour." }, 502);

  const { error: profileUpdateError } = await admin
    .from("utilisateurs")
    .update({ must_change_password: false, mfa_enabled: true, mfa_secret: null, pwd: "" })
    .eq("id", profile.id);
  if (profileUpdateError) return response(request, { error: "Mot de passe changé, mais l’activation MFA doit être finalisée par un administrateur." }, 502);

  await admin.from("audit_logs").insert({
    actor_id: requesterData.user.id,
    action: "first_login_password_changed_mfa_required",
    entity_type: "user",
    entity_id: requesterData.user.id,
    metadata: { email: profile.email },
  });
  return response(request, { ok: true, mfaRequired: true });
});

// Server-side password resets performed by an authenticated application admin.
// The service-role key stays in Edge Function secrets and is never sent to a browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const previewOrigin = origin.startsWith("https://onomo-ticketing") && origin.endsWith(".vercel.app");
  const localOrigin = origin === "http://localhost" || origin.startsWith("http://localhost:");
  const allowed = origin === "https://onomo-ticketing.vercel.app" || previewOrigin || localOrigin;
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://onomo-ticketing.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
function reply(req: Request, body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } }); }
function passwordIsStrong(password: unknown): password is string {
  if (typeof password !== "string" || password.length < 12) return false;
  const chars = Array.from(password);
  const hasLower = chars.some(char => char >= "a" && char <= "z");
  const hasUpper = chars.some(char => char >= "A" && char <= "Z");
  const hasDigit = chars.some(char => "0123456789".includes(char));
  const hasSpecial = chars.some(char => !"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".includes(char));
  return hasLower && hasUpper && hasDigit && hasSpecial;
}
function isUuid(value: unknown): value is string { return typeof value === "string" && value.length === 36 && [8, 13, 18, 23].every(index => value[index] === "-"); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Méthode non autorisée." }, 405);
  if (!URL || !ANON_KEY || !SERVICE_KEY) return reply(req, { error: "La réinitialisation sécurisée n'est pas configurée côté serveur." }, 503);

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return reply(req, { error: "Session utilisateur requise." }, 401);
  const requester = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await requester.auth.getUser(token);
  const { data: isAdmin, error: permissionError } = await requester.rpc("is_admin");
  if (authError || !auth.user) return reply(req, { error: "Session expirée ou invalide." }, 401);
  if (permissionError || isAdmin !== true) return reply(req, { error: "Accès réservé aux administrateurs." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return reply(req, { error: "Données de requête invalides." }, 400); }
  if (!isUuid(body.target_user_id)) return reply(req, { error: "Utilisateur cible invalide." }, 400);
  if (!passwordIsStrong(body.password)) return reply(req, { error: "Le mot de passe doit contenir 12 caractères minimum, une majuscule, une minuscule, un chiffre et un caractère spécial." }, 400);

  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("utilisateurs").select("id,auth_user_id,email").eq("auth_user_id", body.target_user_id).maybeSingle();
  if (profileError) {
    console.error("Profile lookup failed", profileError.message);
    return reply(req, { error: "Impossible de vérifier le compte cible." }, 502);
  }
  if (!profile?.auth_user_id) return reply(req, { error: "Compte utilisateur introuvable." }, 404);

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.auth_user_id, { password: body.password });
  if (updateError) {
    console.error("Password reset failed", updateError.message);
    return reply(req, { error: "Impossible de mettre à jour le mot de passe. Réessayez." }, 502);
  }
  // A temporary password requires the account owner to choose a private one after login.
  const { error: forceChangeError } = await admin.from("utilisateurs").update({ must_change_password: true, pwd: "" }).eq("id", profile.id);
  if (forceChangeError) {
    console.error("Force password change flag failed", forceChangeError.message);
    return reply(req, { error: "Le mot de passe a été modifié, mais le marquage de première connexion a échoué. Contactez le support." }, 502);
  }
  // Never log the submitted password or a derivative of it.
  await admin.from("audit_logs").insert({ actor_id: auth.user.id, action: "admin_password_reset", entity_type: "user", entity_id: profile.auth_user_id, metadata: { email: profile.email } });
  return reply(req, { ok: true, mustChangePassword: true });
});

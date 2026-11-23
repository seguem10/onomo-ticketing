// Server-side account deletion performed by an authenticated application admin.
// Deleting only the public.utilisateurs row left a working Supabase Auth login
// behind ("Aucun profil n'est lié à ce compte"). This function deletes the Auth
// user; utilisateurs.auth_user_id references auth.users ON DELETE CASCADE, so the
// profile and its role links are removed with it. The service-role key stays in
// Edge Function secrets and is never sent to a browser.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const previewOrigin = origin.startsWith("https://onomo-ticketing-") && origin.endsWith(".vercel.app");
  const localOrigin = origin === "http://localhost" || origin.startsWith("http://localhost:");
  const allowed = origin === "https://onomo-ticketing.vercel.app" || previewOrigin || localOrigin;
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://onomo-ticketing.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
function reply(req: Request, body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } }); }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
const isAdminRole = (role: unknown) => ["admin", "administrateur", "administrator"].includes(String(role ?? "").trim().toLowerCase());

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Méthode non autorisée." }, 405);
  if (!URL || !ANON_KEY || !SERVICE_KEY) return reply(req, { error: "La suppression sécurisée n'est pas configurée côté serveur." }, 503);

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
  if (!isUuid(body.profile_id)) return reply(req, { error: "Utilisateur cible invalide." }, 400);

  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: profile, error: profileError } = await admin.from("utilisateurs").select("id,auth_user_id,email,role").eq("id", body.profile_id).maybeSingle();
  if (profileError) {
    console.error("Profile lookup failed", profileError.message);
    return reply(req, { error: "Impossible de vérifier le compte cible." }, 502);
  }
  if (!profile) return reply(req, { error: "Compte utilisateur introuvable." }, 404);
  if (profile.auth_user_id === auth.user.id || profile.id === auth.user.id) return reply(req, { error: "Impossible de supprimer votre propre compte." }, 400);

  if (isAdminRole(profile.role)) {
    const { count, error: countError } = await admin.from("utilisateurs").select("id", { count: "exact", head: true }).in("role", ["admin", "administrateur", "administrator"]);
    if (countError) return reply(req, { error: "Impossible de vérifier les administrateurs restants." }, 502);
    if ((count ?? 0) <= 1) return reply(req, { error: "Impossible de supprimer le dernier administrateur." }, 400);
  }

  if (profile.auth_user_id) {
    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(profile.auth_user_id);
    // A login already removed elsewhere is not an error: continue with the profile.
    if (deleteAuthError && !/not.?found/i.test(deleteAuthError.message)) {
      console.error("Auth user deletion failed", deleteAuthError.message);
      return reply(req, { error: "Impossible de supprimer le compte de connexion. Réessayez." }, 502);
    }
  }
  // Covers legacy profiles without auth_user_id and any schema without the cascade.
  const { error: deleteProfileError } = await admin.from("utilisateurs").delete().eq("id", profile.id);
  if (deleteProfileError) {
    console.error("Profile deletion failed", deleteProfileError.message);
    return reply(req, { error: "Le compte de connexion a été supprimé, mais pas la fiche utilisateur. Contactez le support." }, 502);
  }

  const audit = await admin.from("audit_logs").insert(auditRow(auth.user.id, "user_deleted", profile.auth_user_id ?? profile.id, { email: profile.email }));
  if (audit.error) console.error("user deletion audit failed", audit.error.code);
  return reply(req, { ok: true, id: profile.id });
});
import { auditRow } from "../_shared/audit-row.mjs";

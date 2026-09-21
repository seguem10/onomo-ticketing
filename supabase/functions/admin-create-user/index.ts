// Privileged account provisioning. Keep the service-role key in Edge Function secrets only.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const roleNames: Record<string, string> = { admin: "Administrateur", it_regional: "IT Regional", it_hotel: "IT Hotel", direction: "Directeur", demandeur: "Demandeur" };

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = origin === "https://onomo-ticketing.vercel.app" || /^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin);
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://onomo-ticketing.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
}
function reply(req: Request, body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } }); }
function passwordIsStrong(password: unknown): password is string { return typeof password === "string" && password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return reply(req, { error: "Méthode non autorisée." }, 405);
  if (!URL || !ANON_KEY || !SERVICE_KEY) return reply(req, { error: "La création de comptes n'est pas configurée côté serveur." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(req, { error: "Session utilisateur requise." }, 401);
  const requester = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await requester.auth.getUser(token);
  const { data: isAdmin, error: permissionError } = await requester.rpc("is_admin");
  if (authError || !auth.user) return reply(req, { error: "Session expirée ou invalide." }, 401);
  if (permissionError || isAdmin !== true) return reply(req, { error: "Accès réservé aux administrateurs." }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch (_) { return reply(req, { error: "Données de requête invalides." }, 400); }
  const prenom = typeof body.prenom === "string" ? body.prenom.trim().slice(0, 100) : "";
  const nom = typeof body.nom === "string" ? body.nom.trim().slice(0, 100) : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const requested = Array.isArray(body.roles) ? body.roles : [body.role];
  const roles = [...new Set(requested.filter((role): role is string => typeof role === "string" && role in roleNames))];
  const role = typeof body.role === "string" && body.role in roleNames ? body.role : roles[0];
  const hotel = typeof body.hotel === "string" && body.hotel.trim() ? body.hotel.trim().slice(0, 160) : null;
  const hotels = Array.isArray(body.hotels) ? [...new Set(body.hotels.filter((v): v is string => typeof v === "string" && v.trim()).map(v => v.trim().slice(0, 160)))].slice(0, 100) : [];
  if (!prenom || !nom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.length || !role) return reply(req, { error: "Prénom, nom, email valide et au moins un rôle sont requis." }, 400);
  if (!passwordIsStrong(body.password)) return reply(req, { error: "Le mot de passe doit contenir 12 caractères minimum, une majuscule, une minuscule, un chiffre et un caractère spécial." }, 400);
  if (role === "it_hotel" && !hotel) return reply(req, { error: "Un hôtel est requis pour le rôle IT Hôtel." }, 400);
  if (role === "it_regional" && !hotels.length) return reply(req, { error: "Au moins un hôtel est requis pour le rôle IT Régional." }, 400);
  const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { prenom, nom } });
  if (createError || !created.user) {
    const duplicate = /already|registered|exists/i.test(createError?.message ?? "");
    console.error("Auth user creation failed", createError?.message);
    return reply(req, { error: duplicate ? "Cette adresse email est déjà utilisée." : "Impossible de créer le compte. Réessayez." }, duplicate ? 409 : 502);
  }
  const userId = created.user.id;
  try {
    const profile = { id: userId, auth_user_id: userId, prenom, nom, email, pwd: "", role, roles, hotel, hotels, must_change_password: true };
    const { error: profileError } = await admin.from("utilisateurs").upsert(profile, { onConflict: "auth_user_id" });
    if (profileError) throw profileError;
    const { data: dbRoles, error: roleError } = await admin.from("app_roles").select("id,name").in("name", roles.map(value => roleNames[value]));
    if (roleError || !dbRoles || dbRoles.length !== roles.length) throw roleError ?? new Error("Rôle introuvable dans app_roles.");
    const { error: linkError } = await admin.from("app_user_roles").upsert(dbRoles.map(dbRole => ({ user_id: userId, role_id: dbRole.id })), { onConflict: "user_id,role_id" });
    if (linkError) throw linkError;
    await admin.from("audit_logs").insert({ actor_id: auth.user.id, action: "user_created", entity_type: "user", entity_id: userId, metadata: { email, roles } });
  } catch (error) {
    console.error("Account setup failed", error);
    await admin.auth.admin.deleteUser(userId);
    return reply(req, { error: "Le compte n'a pas pu être configuré; aucune création partielle n'a été conservée." }, 502);
  }
  return reply(req, { id: userId, email, roles, mustChangePassword: true }, 201);
});

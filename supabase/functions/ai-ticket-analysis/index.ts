// Secure JSON-only ticket analysis proxy. Voice transcription needs a dedicated provider.
import { createClient } from "npm:@supabase/supabase-js@2";
const KEY = Deno.env.get("ANTHROPIC_API_KEY"), URL = Deno.env.get("SUPABASE_URL"), ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
const allowedOrigin = (origin: string) => origin === "https://onomo-ticketing.vercel.app" || /^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin);
const cors = (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://onomo-ticketing.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
};
const send = (req: Request, body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
const categoriesDefault = ["Maintenance", "IT / Réseau", "Chambres", "Restauration", "Guest relations", "Sécurité", "Ménage", "Autre"], prioritiesDefault = ["Basse", "Normale", "Haute", "Urgente"];
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return send(req, { error: "Méthode non autorisée." }, 405);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !URL || !ANON) return send(req, { error: "Session utilisateur requise." }, 401);
  const client = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await client.auth.getUser(token); if (!user) return send(req, { error: "Session expirée ou invalide." }, 401);
  const { data: canCreate, error: permissionError } = await client.rpc("has_permission", { permission_name: "ticket:create" });
  if (permissionError || canCreate !== true) return send(req, { error: "Vous n'êtes pas autorisé à utiliser l'analyse de ticket." }, 403);
  if (!KEY) return send(req, { error: "L'analyse IA n'est pas configurée côté serveur." }, 503);
  if (!req.headers.get("content-type")?.includes("application/json")) return send(req, { error: "L'analyse vocale requiert un service de transcription configuré séparément." }, 415);
  let payload: { titre?: string; description?: string; categories?: string[]; priorites?: string[] }; try { payload = await req.json(); } catch (_) { return send(req, { error: "Données de requête invalides." }, 400); }
  const titre = String(payload.titre ?? "").trim().slice(0, 500), description = String(payload.description ?? "").trim().slice(0, 2000);
  const categories = Array.isArray(payload.categories) && payload.categories.length ? payload.categories.slice(0, 30).map(String) : categoriesDefault;
  const priorities = Array.isArray(payload.priorites) && payload.priorites.length ? payload.priorites.slice(0, 10).map(String) : prioritiesDefault;
  if (!titre) return send(req, { error: "Le titre du ticket est requis." }, 400);
  const prompt = `Réponds uniquement avec un JSON valide: {"priorite":"valeur parmi ${JSON.stringify(priorities)}","categorie":"valeur parmi ${JSON.stringify(categories)}","resume":"max 150 caractères","action":"max 150 caractères"}. Ticket: ${titre}\n${description}`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: prompt }] }) });
    if (!response.ok) { console.error("Anthropic", response.status); return send(req, { error: "L'analyse IA est temporairement indisponible." }, 502); }
    const raw = await response.json(), parsed = JSON.parse(String(raw?.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim());
    return send(req, { priorite: priorities.includes(parsed.priorite) ? parsed.priorite : "Normale", categorie: categories.includes(parsed.categorie) ? parsed.categorie : "Autre", assigne: "", resume: String(parsed.resume ?? "").slice(0, 200), action: String(parsed.action ?? "").slice(0, 200) });
  } catch (error) { console.error("ai-ticket-analysis", error); return send(req, { error: "L'analyse IA est temporairement indisponible." }, 502); }
});

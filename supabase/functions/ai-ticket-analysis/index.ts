// Secure JSON-only ticket analysis proxy. Voice transcription needs a dedicated provider.
import { createClient } from "npm:@supabase/supabase-js@2";
const KEY = Deno.env.get("ANTHROPIC_API_KEY"), URL = Deno.env.get("SUPABASE_URL"), ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const send = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
const categoriesDefault = ["Maintenance", "IT / Réseau", "Chambres", "Restauration", "Guest relations", "Sécurité", "Ménage", "Autre"], prioritiesDefault = ["Basse", "Normale", "Haute", "Urgente"];
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return send({ error: "Méthode non autorisée." }, 405);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !URL || !ANON) return send({ error: "Session utilisateur requise." }, 401);
  const client = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await client.auth.getUser(token); if (!user) return send({ error: "Session expirée ou invalide." }, 401);
  if (!KEY) return send({ error: "L'analyse IA n'est pas configurée côté serveur." }, 503);
  if (!req.headers.get("content-type")?.includes("application/json")) return send({ error: "L'analyse vocale requiert un service de transcription configuré séparément." }, 415);
  let payload: { titre?: string; description?: string; categories?: string[]; priorites?: string[] }; try { payload = await req.json(); } catch (_) { return send({ error: "Données de requête invalides." }, 400); }
  const titre = String(payload.titre ?? "").trim().slice(0, 500), description = String(payload.description ?? "").trim().slice(0, 2000);
  const categories = Array.isArray(payload.categories) && payload.categories.length ? payload.categories.slice(0, 30).map(String) : categoriesDefault;
  const priorities = Array.isArray(payload.priorites) && payload.priorites.length ? payload.priorites.slice(0, 10).map(String) : prioritiesDefault;
  if (!titre) return send({ error: "Le titre du ticket est requis." }, 400);
  const prompt = `Réponds uniquement avec un JSON valide: {"priorite":"valeur parmi ${JSON.stringify(priorities)}","categorie":"valeur parmi ${JSON.stringify(categories)}","resume":"max 150 caractères","action":"max 150 caractères"}. Ticket: ${titre}\n${description}`;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 300, messages: [{ role: "user", content: prompt }] }) });
    if (!response.ok) { console.error("Anthropic", response.status); return send({ error: "L'analyse IA est temporairement indisponible." }, 502); }
    const raw = await response.json(), parsed = JSON.parse(String(raw?.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim());
    return send({ priorite: priorities.includes(parsed.priorite) ? parsed.priorite : "Normale", categorie: categories.includes(parsed.categorie) ? parsed.categorie : "Autre", assigne: "", resume: String(parsed.resume ?? "").slice(0, 200), action: String(parsed.action ?? "").slice(0, 200) });
  } catch (error) { console.error("ai-ticket-analysis", error); return send({ error: "L'analyse IA est temporairement indisponible." }, 502); }
});

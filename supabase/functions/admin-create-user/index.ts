// supabase/functions/ai-ticket-analysis/index.ts
//
// Proxy sécurisé vers l'API Anthropic pour l'analyse IA des tickets.
//
// Pourquoi cette fonction existe :
// L'appel direct à https://api.anthropic.com depuis le navigateur (ancien code
// dans index.html) ne peut jamais fonctionner : il faudrait exposer une clé API
// dans le JavaScript client, ce que l'API Anthropic bloque de toute façon (CORS).
// Cette Edge Function reçoit la requête du navigateur, appelle l'API Anthropic
// côté serveur avec la clé stockée en secret, et renvoie uniquement le résultat
// structuré au client. La clé ANTHROPIC_API_KEY n'est jamais transmise au navigateur.
//
// Déploiement :
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx
//   supabase functions deploy ai-ticket-analysis

import { createClient } from "npm:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_PUBLISHABLE_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_CATEGORIES = ["Maintenance", "IT / Réseau", "Chambres", "Restauration", "Guest relations", "Sécurité", "Ménage", "Autre"];
const DEFAULT_PRIORITIES = ["Basse", "Normale", "Haute", "Urgente"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return jsonResponse(
      { error: "ANTHROPIC_API_KEY non configurée côté serveur. Voir supabase secrets set ANTHROPIC_API_KEY=..." },
      500
    );
  }

  // A publishable key identifies the project, not the caller. Verify the user
  // token server-side before an expensive third-party request can be made.
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token || !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return jsonResponse({ error: "Session utilisateur requise" }, 401);
  }
  const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await auth.auth.getUser(token);
  if (authError || !user) {
    return jsonResponse({ error: "Session utilisateur invalide ou expirée" }, 401);
  }

  let payload: { titre?: string; description?: string; categories?: string[]; priorites?: string[] };
  try {
    payload = await req.json();
  } catch (_e) {
    return jsonResponse({ error: "Corps de requête JSON invalide" }, 400);
  }

  const titre = (payload.titre || "").slice(0, 500);
  const description = (payload.description || "").slice(0, 2000);
  const CATEGORIES = Array.isArray(payload.categories) && payload.categories.length > 0 ? payload.categories : DEFAULT_CATEGORIES;
  const PRIORITIES = Array.isArray(payload.priorites) && payload.priorites.length > 0 ? payload.priorites : DEFAULT_PRIORITIES;

  if (!titre.trim()) {
    return jsonResponse({ error: "Le titre du ticket est requis" }, 400);
  }

  const systemPrompt = `Tu es un assistant qui analyse des tickets de support IT hôtelier.
Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après, avec exactement ces clés :
{"priorite":"une valeur parmi ${JSON.stringify(PRIORITIES)}","categorie":"une valeur parmi ${JSON.stringify(CATEGORIES)}","resume":"résumé en une phrase (max 150 caractères)","action":"action recommandée en une phrase (max 150 caractères)"}
Ne renvoie rien d'autre que ce JSON.`;

  const userMessage = `Titre du ticket : ${titre}\nDescription : ${description || "(aucune description fournie)"}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return jsonResponse(
        { error: `Erreur API Anthropic (${response.status})`, priorite: "Normale", categorie: "Guest relations", resume: "Analyse IA indisponible.", action: "" },
        502
      );
    }

    const data = await response.json();
    const text: string = data?.content?.[0]?.text || "";

    let parsed: Record<string, string>;
    try {
      const cleaned = text.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (_e) {
      console.error("Failed to parse Claude response as JSON:", text);
      return jsonResponse(
        { error: "Réponse IA non structurée", priorite: "Normale", categorie: "Guest relations", resume: "Analyse IA indisponible (format inattendu).", action: "" },
        502
      );
    }

    // Validation stricte des valeurs renvoyées avant de les passer au client
    const priorite = PRIORITIES.includes(parsed.priorite) ? parsed.priorite : "Normale";
    const categorie = CATEGORIES.includes(parsed.categorie) ? parsed.categorie : "Guest relations";
    const resume = String(parsed.resume || "").slice(0, 200);
    const action = String(parsed.action || "").slice(0, 200);

    return jsonResponse({ priorite, categorie, assigne: "", resume, action });
  } catch (e) {
    console.error("ai-ticket-analysis error:", e);
    return jsonResponse(
      { error: "Erreur réseau lors de l'appel à l'API Anthropic", priorite: "Normale", categorie: "Guest relations", resume: "Analyse IA indisponible.", action: "" },
      502
    );
  }
});

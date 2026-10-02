// Server-side email delivery for ticket activity. Browser clients never see
// the provider secret and may not supply their own recipient list.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID") ?? "";
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID") ?? "";
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY") ?? "";
const EMAILJS_PRIVATE_KEY = Deno.env.get("EMAILJS_PRIVATE_KEY") ?? "";
const FROM = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "ONOMO Support IT <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://onomo-ticketing.vercel.app";

function allowedOrigin(origin: string) {
  return origin === "https://onomo-ticketing.vercel.app" || /^https:\/\/onomo-ticketing(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}
function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return { "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://onomo-ticketing.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin", "Content-Type": "application/json" };
}
function reply(req: Request, body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: headers(req) }); }
function escape(value: unknown) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char)); }
function eventLabel(event: string) { return ({ created: "Nouveau ticket", updated: "Ticket mis à jour", comment: "Nouveau commentaire", attachment: "Pièce jointe ajoutée" } as Record<string, string>)[event] ?? "Mise à jour de ticket"; }

Deno.serve(async req => {
  try {
  if (req.method === "OPTIONS") return new Response(null, { headers: headers(req) });
  if (req.method !== "POST") return reply(req, { error: "Méthode non autorisée." }, 405);
  if (!URL || !ANON || !SERVICE) return reply(req, { error: "Service de notification non configuré." }, 503);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return reply(req, { error: "Session utilisateur requise." }, 401);
  let input: { ticket_id?: unknown; event?: unknown };
  try { input = await req.json(); } catch (_) { return reply(req, { error: "Données invalides." }, 400); }
  const ticketId = typeof input.ticket_id === "string" ? input.ticket_id : "";
  const event = typeof input.event === "string" ? input.event : "";
  if (!ticketId || !["created", "updated", "comment", "attachment"].includes(event)) return reply(req, { error: "Événement de notification invalide." }, 400);

  const userClient = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await userClient.auth.getUser(token);
  if (authError || !auth.user) return reply(req, { error: "Session expirée ou invalide." }, 401);
  const { data: ticket, error: ticketError } = await userClient.from("tickets").select("id,numero,titre,hotel,categorie,priorite,statut").eq("id", ticketId).maybeSingle();
  if (ticketError || !ticket) return reply(req, { error: "Ticket introuvable ou accès non autorisé." }, 403);

  const service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: recipientRows, error: recipientsError } = await service.rpc("ticket_notification_recipient_ids", { target_ticket: ticketId });
  if (recipientsError) { console.error("ticket notification recipients", recipientsError.message); return reply(req, { error: "Destinataires indisponibles." }, 500); }
  const ids = [...new Set((recipientRows ?? []).map((row: { recipient_id?: string }) => row.recipient_id).filter((id): id is string => Boolean(id) && id !== auth.user.id))];
  if (!ids.length) return reply(req, { email_configured: Boolean(RESEND_KEY), recipients: 0, delivered: 0 });
  const { data: profiles, error: profileError } = await service.from("utilisateurs").select("auth_user_id,email,prenom,nom").in("auth_user_id", ids);
  if (profileError) { console.error("ticket notification profiles", profileError.message); return reply(req, { error: "Profils destinataires indisponibles." }, 500); }
  const recipients = (profiles ?? []).filter(profile => typeof profile.email === "string" && profile.email.includes("@"));
  const emailJsConfigured = Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
  if (!emailJsConfigured && !RESEND_KEY) return reply(req, { email_configured: false, recipients: recipients.length, delivered: 0 });

  const subject = `[ONOMO Support IT] ${eventLabel(event)} — ${ticket.numero ?? ticket.id}`;
  const details = `<p><strong>${escape(ticket.titre)}</strong></p><table><tr><td>Ticket</td><td>${escape(ticket.numero ?? ticket.id)}</td></tr><tr><td>Hôtel</td><td>${escape(ticket.hotel)}</td></tr><tr><td>Statut</td><td>${escape(ticket.statut)}</td></tr><tr><td>Priorité</td><td>${escape(ticket.priorite)}</td></tr></table><p><a href="${APP_URL}">Ouvrir ONOMO Support IT</a></p>`;
  const sent = await Promise.all(recipients.map(async profile => {
    if (emailJsConfigured) {
      // EmailJS uses a predefined template. The recipient and ticket data are
      // supplied as variables; no EmailJS credential reaches the browser.
      const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          accessToken: EMAILJS_PRIVATE_KEY || undefined,
          template_params: {
            // Names used by the existing ONOMO Desk EmailJS template.
            agent_email: profile.email,
            agent_prenom: profile.prenom ?? profile.email,
            ticket_numero: ticket.numero ?? ticket.id,
            ticket_titre: ticket.titre,
            ticket_hotel: ticket.hotel,
            ticket_priorite: ticket.priorite,
            name: "ONOMO Desk",
            email: "it@onomohotel.com",
            // Neutral aliases retained for a later template redesign.
            to_email: profile.email,
            to_name: `${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim(),
            subject,
            event_label: eventLabel(event),
            ticket_number: ticket.numero ?? ticket.id,
            ticket_title: ticket.titre,
            hotel: ticket.hotel,
            status: ticket.statut,
            priority: ticket.priorite,
            app_url: APP_URL,
            message_html: details,
          },
        }),
      });
      if (!response.ok) console.error("ticket notification EmailJS", response.status, (await response.text()).slice(0, 300));
      return response.ok;
    }
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [profile.email], subject, html: `<p>Bonjour ${escape(`${profile.prenom ?? ""} ${profile.nom ?? ""}`.trim() || "" )},</p><p>${escape(eventLabel(event))}.</p>${details}` }) });
    if (!response.ok) console.error("ticket notification Resend", response.status, (await response.text()).slice(0, 300));
    return response.ok;
  }));
  return reply(req, { email_configured: true, provider: emailJsConfigured ? "emailjs" : "resend", recipients: recipients.length, delivered: sent.filter(Boolean).length });
  } catch (error) {
    // Always reply with CORS headers: the browser can then show a useful
    // message instead of a generic "Failed to fetch".
    console.error("ticket notification delivery", error instanceof Error ? error.message : String(error));
    return reply(req, { error: "Le service de notification a rencontré une erreur temporaire." }, 500);
  }
});

// Delivers SLA escalation e-mails. This function is invoked only by a
// database schedule bearing the secret stored in Supabase Vault; browser
// clients never see an e-mail provider credential or the scheduler secret.
import { createClient } from "npm:@supabase/supabase-js@2";

const URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("SLA_ESCALATION_CRON_SECRET") ?? "";
const EMAILJS_SERVICE_ID = Deno.env.get("EMAILJS_SERVICE_ID") ?? "";
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID") ?? "";
const EMAILJS_PUBLIC_KEY = Deno.env.get("EMAILJS_PUBLIC_KEY") ?? "";
const EMAILJS_PRIVATE_KEY = Deno.env.get("EMAILJS_PRIVATE_KEY") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("NOTIFICATION_FROM_EMAIL") ?? "ONOMO Support IT <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://onomo-ticketing.vercel.app";

type Escalation = {
  event_id: string; ticket_id: string; escalation_stage: "warning" | "breach" | "critical";
  recipient_email: string; recipient_first_name: string | null; recipient_last_name: string | null;
  ticket_number: string; ticket_title: string; ticket_hotel: string; ticket_priority: string; ticket_status: string;
};

function secureEquals(a: string, b: string) {
  if (!a || !b) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) mismatch |= aBytes[i] ^ bBytes[i];
  return mismatch === 0;
}
function escape(value: unknown) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char)); }
function label(stage: Escalation["escalation_stage"]) { return ({ warning: "Avertissement SLA", breach: "SLA dépassé", critical: "Escalade SLA critique" } as const)[stage]; }
function detail(row: Escalation) {
  return `<p><strong>${escape(row.ticket_title)}</strong></p><table><tr><td>Ticket</td><td>${escape(row.ticket_number)}</td></tr><tr><td>Hôtel</td><td>${escape(row.ticket_hotel)}</td></tr><tr><td>Priorité</td><td>${escape(row.ticket_priority)}</td></tr><tr><td>Statut</td><td>${escape(row.ticket_status)}</td></tr></table><p><a href="${APP_URL}">Ouvrir ONOMO Support IT</a></p>`;
}

Deno.serve(async req => {
  if (req.method !== "POST") return Response.json({ error: "Méthode non autorisée." }, { status: 405 });
  if (!URL || !SERVICE || !CRON_SECRET) return Response.json({ error: "Service SLA non configuré." }, { status: 503 });
  if (!secureEquals(req.headers.get("x-onomo-sla-cron-secret") ?? "", CRON_SECRET)) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const emailJsConfigured = Boolean(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
  if (!emailJsConfigured && !RESEND_KEY) return Response.json({ error: "Fournisseur e-mail non configuré." }, { status: 503 });

  const service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await service.rpc("claim_sla_escalation_email_batch", { batch_limit: 25 });
  if (error) { console.error("SLA e-mail claim", error.message); return Response.json({ error: "File d’attente SLA indisponible." }, { status: 500 }); }

  let delivered = 0;
  for (const row of (data ?? []) as Escalation[]) {
    const subject = `[ONOMO Support IT] ${label(row.escalation_stage)} — ${row.ticket_number}`;
    const recipientName = `${row.recipient_first_name ?? ""} ${row.recipient_last_name ?? ""}`.trim();
    let success = false;
    let failure = "";
    try {
      if (emailJsConfigured) {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service_id: EMAILJS_SERVICE_ID, template_id: EMAILJS_TEMPLATE_ID, user_id: EMAILJS_PUBLIC_KEY, accessToken: EMAILJS_PRIVATE_KEY || undefined, template_params: {
            agent_email: row.recipient_email, agent_prenom: row.recipient_first_name ?? row.recipient_email,
            ticket_numero: row.ticket_number, ticket_titre: row.ticket_title, ticket_hotel: row.ticket_hotel, ticket_priorite: row.ticket_priority,
            name: "ONOMO Desk", email: "it@onomohotel.com", to_email: row.recipient_email, to_name: recipientName,
            subject, event_label: label(row.escalation_stage), ticket_number: row.ticket_number, ticket_title: row.ticket_title,
            hotel: row.ticket_hotel, status: row.ticket_status, priority: row.ticket_priority, app_url: APP_URL, message_html: detail(row),
          } }),
        });
        success = response.ok; if (!success) failure = `EmailJS ${response.status}`;
      } else {
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: FROM, to: [row.recipient_email], subject, html: `<p>Bonjour ${escape(recipientName)},</p><p>${escape(label(row.escalation_stage))}.</p>${detail(row)}` }) });
        success = response.ok; if (!success) failure = `Resend ${response.status}`;
      }
    } catch (cause) { failure = cause instanceof Error ? cause.message : "Erreur fournisseur e-mail"; }
    const { error: completeError } = await service.rpc("complete_sla_escalation_email_delivery", { target_event: row.event_id, delivered: success, failure_message: failure || null });
    if (completeError) console.error("SLA e-mail completion", completeError.message);
    if (success) delivered++;
  }
  return Response.json({ queued: (data ?? []).length, delivered });
});

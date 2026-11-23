// Microsoft Teams alerts for the IT channel. The webhook address is a secret
// (Supabase secret TEAMS_WEBHOOK_URL): it never reaches the browser. Without
// it, nothing is sent and the e-mail flow is unchanged.

const URGENT = new Set(['urgente', 'urgent', 'critique', 'critical']);
export function isUrgent(priority) {
  return URGENT.has(String(priority ?? '').trim().toLowerCase());
}

// Only Teams/Power Automate webhook hosts are accepted, so a mistyped secret
// cannot send ticket details to an unrelated site.
export function teamsWebhookAllowed(url) {
  try {
    const parsed = new URL(String(url ?? ''));
    return parsed.protocol === 'https:' && (
      /\.webhook\.office\.com$/i.test(parsed.hostname) ||
      /\.logic\.azure\.com$/i.test(parsed.hostname) ||
      /\.powerplatform\.com$/i.test(parsed.hostname)
    );
  } catch { return false; }
}

const clip = (value, max) => { const text = String(value ?? '').trim(); return text.length > max ? `${text.slice(0, max - 1)}…` : text; };

// Adaptive Card wrapped as a message: accepted by both the Teams "Workflows"
// webhook and the older incoming-webhook connector. Text is plain (Adaptive
// Cards do not run HTML), and values are clipped.
export function teamsPayload({ heading, ticket, appUrl, attention = true }) {
  const facts = [
    ['Ticket', ticket?.number],
    ['Hôtel', ticket?.hotel],
    ['Priorité', ticket?.priority],
    ['Statut', ticket?.status],
  ].filter(([, value]) => value).map(([title, value]) => ({ title, value: clip(value, 120) }));
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', text: clip(heading, 120), weight: 'Bolder', size: 'Medium', color: attention ? 'Attention' : 'Default', wrap: true },
          { type: 'TextBlock', text: clip(ticket?.title, 200), wrap: true },
          { type: 'FactSet', facts },
        ],
        actions: [{ type: 'Action.OpenUrl', title: 'Ouvrir ONOMO Support IT', url: appUrl }],
      },
    }],
  };
}

export async function postTeams(url, payload, fetchImpl = fetch) {
  if (!teamsWebhookAllowed(url)) return { sent: false, reason: url ? 'webhook refusé' : 'non configuré' };
  try {
    const response = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return response.ok ? { sent: true } : { sent: false, reason: `Teams ${response.status}` };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message : 'Teams indisponible' };
  }
}

// Post once per (ticket, event): the log row is claimed first, and released
// if Teams refuses so that a later attempt can try again.
export async function alertTeamsOnce(service, url, { ticketId, event, payload }, fetchImpl = fetch) {
  if (!teamsWebhookAllowed(url)) return { sent: false, reason: url ? 'webhook refusé' : 'non configuré' };
  const { data, error } = await service.from('teams_notification_log')
    .upsert({ ticket_id: ticketId, event }, { onConflict: 'ticket_id,event', ignoreDuplicates: true })
    .select('ticket_id');
  if (error) return { sent: false, reason: error.message };
  if (!data || !data.length) return { sent: false, reason: 'déjà envoyé' };
  const result = await postTeams(url, payload, fetchImpl);
  if (!result.sent) await service.from('teams_notification_log').delete().eq('ticket_id', ticketId).eq('event', event);
  return result;
}

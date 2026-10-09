/* Operational SLA dashboard. It only reads tickets already visible to the
   signed-in user, so the panel cannot broaden a role's data access. */
(function () {
  'use strict';

  const copy = {
    fr: {
      title: 'Suivi SLA', subtitle: 'Vos tickets ouverts selon votre périmètre',
      onTrack: 'Dans les temps', atRisk: 'À risque', breached: 'Dépassés',
      open: 'tickets ouverts', none: 'Aucun ticket ouvert',
      riskList: 'À surveiller', breachList: 'À traiter en priorité',
      updated: 'Mise à jour automatique', openTicket: 'Ouvrir le ticket',
    },
    en: {
      title: 'SLA monitoring', subtitle: 'Your open tickets within your access scope',
      onTrack: 'On track', atRisk: 'At risk', breached: 'Breached',
      open: 'open tickets', none: 'No open tickets',
      riskList: 'Monitor', breachList: 'Priority action',
      updated: 'Automatically updated', openTicket: 'Open ticket',
    },
    ar: {
      title: 'متابعة اتفاقية مستوى الخدمة', subtitle: 'التذاكر المفتوحة ضمن نطاق صلاحياتك',
      onTrack: 'ضمن الوقت', atRisk: 'معرضة للتأخير', breached: 'متأخرة',
      open: 'تذاكر مفتوحة', none: 'لا توجد تذاكر مفتوحة',
      riskList: 'للمتابعة', breachList: 'إجراء ذو أولوية',
      updated: 'تحديث تلقائي', openTicket: 'فتح التذكرة',
    },
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  function text(key) {
    const language = window.OnomoI18n && window.OnomoI18n.language;
    return (copy[language] || copy.fr)[key] || copy.fr[key];
  }

  function renderSlaPanel() {
    const host = document.getElementById('mainContent');
    if (!host || host.querySelector('[data-sla-dashboard]')) return;

    const tickets = typeof window.visibleTickets === 'function' ? window.visibleTickets() : [];
    const openTickets = tickets.filter((ticket) => !['résolu', 'fermé'].includes(String(ticket.statut || '').toLowerCase()));
    const atRisk = openTickets.filter((ticket) => window.getSLAStatus && window.getSLAStatus(ticket) === 'warn');
    const breached = openTickets.filter((ticket) => window.getSLAStatus && window.getSLAStatus(ticket) === 'breach');
    const onTrack = Math.max(0, openTickets.length - atRisk.length - breached.length);
    const listing = (items) => items.slice(0, 4).map((ticket) => `
      <button type="button" data-sla-ticket-id="${escapeHtml(ticket.id)}" title="${escapeHtml(text('openTicket'))}" style="border:0;background:transparent;color:inherit;padding:0;text-decoration:underline;cursor:pointer;font:inherit">
        ${escapeHtml(ticket.numero || ticket.titre || '—')}
      </button>`).join(' · ');
    const direction = (window.OnomoI18n && window.OnomoI18n.language) === 'ar' ? 'rtl' : 'ltr';

    host.insertAdjacentHTML('afterbegin', `
      <section class="card" data-sla-dashboard style="margin-bottom:18px;padding:20px" dir="${direction}">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap">
          <div>
            <h3 style="margin:0;color:var(--ink,#10233e)"><i class="ti ti-clock-exclamation" style="color:var(--gold,#c99718)"></i> ${text('title')}</h3>
            <p style="margin:5px 0 0;color:var(--muted,#6f8098);font-size:13px">${text('subtitle')}</p>
          </div>
          <span style="color:var(--muted,#6f8098);font-size:12px"><i class="ti ti-refresh"></i> ${text('updated')}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">
          <div style="border:1px solid #dce7f4;border-radius:12px;padding:14px;background:#f8fbff"><div style="font-size:25px;font-weight:800;color:#168f55">${onTrack}</div><strong>${text('onTrack')}</strong><div style="font-size:12px;color:var(--muted,#6f8098);margin-top:3px">${text('open')}</div></div>
          <div style="border:1px solid #f2d787;border-radius:12px;padding:14px;background:#fffaf0"><div style="font-size:25px;font-weight:800;color:#b47900">${atRisk.length}</div><strong>${text('atRisk')}</strong><div style="font-size:12px;color:var(--muted,#6f8098);margin-top:3px">${atRisk.length ? listing(atRisk) : text('none')}</div></div>
          <div style="border:1px solid #f5b5b5;border-radius:12px;padding:14px;background:#fff5f5"><div style="font-size:25px;font-weight:800;color:#c93636">${breached.length}</div><strong>${text('breached')}</strong><div style="font-size:12px;color:var(--muted,#6f8098);margin-top:3px">${breached.length ? listing(breached) : text('none')}</div></div>
        </div>
      </section>`);

    host.querySelectorAll('[data-sla-ticket-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const ticketId = button.getAttribute('data-sla-ticket-id');
        if (ticketId && typeof window.openDetail === 'function') window.openDetail(ticketId);
      });
    });
  }

  function install() {
    const previousRender = window.renderDashboard;
    if (typeof previousRender !== 'function' || previousRender.__slaDashboardInstalled) return;
    function dashboardWithSla() {
      const result = previousRender.apply(this, arguments);
      renderSlaPanel();
      return result;
    }
    dashboardWithSla.__slaDashboardInstalled = true;
    window.renderDashboard = dashboardWithSla;
  }

  install();
}());

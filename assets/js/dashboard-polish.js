/* Dashboard presentation layer. It reads existing filtered data; it does not mutate tickets. */
(function () {
  const copy = {
    fr: {
      operations: 'Vue opérationnelle',
      requester: 'Suivi de vos demandes',
      leadership: 'Pilotage du support IT',
      admin: 'Vue groupe et opérations',
      it: 'Les priorités de votre périmètre sont à jour.',
      requesterText: 'Retrouvez le suivi de vos demandes et les dernières mises à jour.',
      leadershipText: 'Suivez les incidents, les priorités et la qualité de service en un coup d’œil.',
      open: 'tickets ouverts',
      newTicket: 'Nouveau ticket',
      scope: 'Périmètre'
    },
    en: {
      operations: 'Operations overview',
      requester: 'Your request follow-up',
      leadership: 'IT support overview',
      admin: 'Group and operations overview',
      it: 'Your scope priorities are up to date.',
      requesterText: 'Find your requests and their latest updates in one place.',
      leadershipText: 'Track incidents, priorities and service quality at a glance.',
      open: 'open tickets',
      newTicket: 'New ticket',
      scope: 'Scope'
    },
    ar: {
      operations: 'نظرة تشغيلية',
      requester: 'متابعة طلباتك',
      leadership: 'إدارة دعم تقنية المعلومات',
      admin: 'نظرة عامة على المجموعة والعمليات',
      it: 'أولويات نطاقك محدثة.',
      requesterText: 'تابع طلباتك وآخر تحديثاتها من مكان واحد.',
      leadershipText: 'تابع الحوادث والأولويات وجودة الخدمة بسرعة.',
      open: 'تذاكر مفتوحة',
      newTicket: 'تذكرة جديدة',
      scope: 'النطاق'
    }
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const language = () => window.OnomoI18n?.language || 'fr';

  function renderDashboardHero() {
    const root = document.getElementById('mainContent');
    const user = window.currentUser;
    if (!root || !user || root.querySelector('.dashboard-hero')) return;

    const locale = copy[language()] || copy.fr;
    const role = user.role || '';
    const isRequester = role === 'demandeur';
    const isAdmin = role === 'admin';
    const isLeadership = isAdmin || role === 'direction';
    const name = `${user.prenom || ''} ${user.nom || ''}`.trim() || user.email || '—';
    const scope = user.hotel || (isAdmin ? locale.admin : locale.scope);
    const openTickets = typeof window.visibleTickets === 'function'
      ? window.visibleTickets().filter((ticket) => !['résolu', 'fermé'].includes(ticket.statut)).length
      : 0;
    const eyebrow = isRequester ? locale.requester : isLeadership ? locale.leadership : locale.operations;
    const description = isRequester ? locale.requesterText : isLeadership ? locale.leadershipText : locale.it;
    const action = isRequester || !['direction'].includes(role)
      ? `<button class="btn" type="button" onclick="openNewTicket()"><i class="ti ti-plus"></i>${escapeHtml(locale.newTicket)}</button>`
      : '';

    root.insertAdjacentHTML('afterbegin', `
      <section class="dashboard-hero" aria-label="${escapeHtml(eyebrow)}">
        <div class="dashboard-hero-copy">
          <div class="dashboard-hero-eyebrow"><i class="ti ti-sparkles" aria-hidden="true"></i>${escapeHtml(eyebrow)}</div>
          <h1>${escapeHtml(name)}</h1>
          <p>${escapeHtml(description)} <strong>${openTickets}</strong> ${escapeHtml(locale.open)}.</p>
        </div>
        <div class="dashboard-hero-actions">
          <div class="dashboard-scope"><i class="ti ti-building" aria-hidden="true"></i><span>${escapeHtml(scope)}</span></div>
          ${action}
        </div>
      </section>`);
  }

  function decorate() {
    const original = window.renderDashboard;
    if (typeof original !== 'function' || original.__onomoPolished) return;
    function enhancedDashboard() {
      original.apply(this, arguments);
      renderDashboardHero();
    }
    enhancedDashboard.__onomoPolished = true;
    window.renderDashboard = enhancedDashboard;
    if (window.currentView === 'dashboard' && window.currentUser) enhancedDashboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorate, { once: true });
  else decorate();
}());

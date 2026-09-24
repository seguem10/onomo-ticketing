/* Visual enhancements only: preserves data fetching, ticket workflow and RBAC. */
(function () {
  const storageKey = 'onomo_sidebar_compact';

  function labelNavigationForTooltips() {
    document.querySelectorAll('.nav-item').forEach((item) => {
      const label = item.querySelector('span:not(.nav-badge)')?.textContent?.trim();
      if (label) item.dataset.tooltip = label;
    });
  }

  function syncSidebarButton() {
    const button = document.getElementById('sidebarCollapseBtn');
    if (!button) return;
    const compact = document.body.classList.contains('sidebar-compact');
    button.setAttribute('aria-pressed', String(compact));
    button.setAttribute('aria-label', compact ? 'Agrandir le menu' : 'Réduire le menu');
    button.setAttribute('title', compact ? 'Agrandir le menu' : 'Réduire le menu');
  }

  function initSidebarCompactMode() {
    labelNavigationForTooltips();
    if (localStorage.getItem(storageKey) === '1') document.body.classList.add('sidebar-compact');
    syncSidebarButton();

    document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => {
      const compact = document.body.classList.toggle('sidebar-compact');
      localStorage.setItem(storageKey, compact ? '1' : '0');
      syncSidebarButton();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSidebarCompactMode, { once: true });
  else initSidebarCompactMode();
}());

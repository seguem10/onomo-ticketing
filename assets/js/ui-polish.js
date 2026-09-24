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

  function labelTicketCells(root = document) {
    root.querySelectorAll('.ticket-table').forEach((table) => {
      const labels = Array.from(table.querySelectorAll('thead th')).map((cell) => cell.textContent.trim());
      table.querySelectorAll('tbody tr').forEach((row) => {
        Array.from(row.children).forEach((cell, index) => {
          if (labels[index]) cell.setAttribute('data-label', labels[index]);
        });
      });
    });
  }

  function observeDynamicTables() {
    const root = document.getElementById('mainContent');
    if (!root) return;
    labelTicketCells(root);
    new MutationObserver(() => labelTicketCells(root)).observe(root, { childList: true, subtree: true });
  }

  function init() {
    initSidebarCompactMode();
    observeDynamicTables();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());

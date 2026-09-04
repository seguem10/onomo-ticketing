(function(){
  const sidebar=document.getElementById('sidebar');
  const toggle=document.getElementById('menuToggle');
  const backdrop=document.getElementById('sidebarBackdrop');
  function closeMenu(){sidebar.classList.remove('is-open');backdrop.classList.remove('is-visible');toggle.setAttribute('aria-expanded','false')}
  toggle?.addEventListener('click',()=>{const opening=!sidebar.classList.contains('is-open');sidebar.classList.toggle('is-open',opening);backdrop.classList.toggle('is-visible',opening);toggle.setAttribute('aria-expanded',String(opening))});
  backdrop?.addEventListener('click',closeMenu);
  document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>{document.querySelector('.nav-link.active')?.classList.remove('active');link.classList.add('active');closeMenu();if(link.dataset.page&&link.dataset.page!=='Tableau de bord')window.onomoUI.notify(`${link.dataset.page} : module en cours de préparation.`)}));
  window.onomoUI={notify(message){const toast=document.getElementById('toast');toast.textContent=message;toast.classList.add('show');window.setTimeout(()=>toast.classList.remove('show'),3200)}};
})();

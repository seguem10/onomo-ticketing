/* Onomo Support IT - corrections complémentaires */
(function(){
  'use strict';
  const POWER=['Administrateur','IT Regional','IT Hotel','Directeur'];
  const roleName=u=>{const a={admin:'Administrateur',it_regional:'IT Regional',it_hotel:'IT Hotel',direction:'Directeur'};return (u?.roles?.length?u.roles:[u?.role||'Demandeur']).map(r=>a[r]||r)};
  const isPower=u=>roleName(u).some(r=>POWER.includes(r));
  const isAdmin=u=>roleName(u).includes('Administrateur');
  function disableVoice(){
    document.querySelectorAll('#voiceDictationBtn,[id*=voice],[class*=voice]').forEach(el=>el.remove());
    document.querySelectorAll('button').forEach(b=>{const t=(b.textContent||'').toLowerCase();if(t.includes('dicter automatiquement')||t.includes('dictée vocale'))b.remove();});
  }
  function fixLabels(){
    document.querySelectorAll('*').forEach(el=>{el.childNodes.forEach(n=>{if(n.nodeType===3)n.nodeValue=n.nodeValue.replace(/principatenece/gi,'Maintenance').replace(/urgents+/gi,m=>m.startsWith('U')?'Urgent':'urgent');});});
    document.querySelectorAll('option').forEach(o=>{if(/principatenece/i.test(o.textContent))o.textContent=o.textContent.replace(/principatenece/gi,'Maintenance');});
  }
  function hideAdminReport(){
    if(!currentUser||!isAdmin(currentUser))return;
    document.querySelectorAll('[data-view="report-my"],#sbMySec').forEach(el=>el.style.display='none');
    document.querySelectorAll('.nav-item').forEach(el=>{if(/mon rapport/i.test(el.textContent||''))el.style.display='none';});
  }
  function protectNavigation(){
    if(!currentUser)return;
    const power=isPower(currentUser),admin=isAdmin(currentUser);
    document.querySelectorAll('[data-view="settings"]').forEach(el=>el.style.display=admin?'':'none');
    document.querySelectorAll('[data-view="dashboard"],[data-view="urgents"]').forEach(el=>el.style.display=power?'':'none');
    if(!power)document.querySelectorAll('[data-view="report-global"],[data-view="report-hotel"],[data-view="report-agents"],[data-view="report-anomalies"],[data-view="report-my"],[data-view="users"],[data-view="hotels-admin"]').forEach(el=>el.style.display='none');
  }
  function refresh(){disableVoice();fixLabels();hideAdminReport();protectNavigation();}
  document.addEventListener('DOMContentLoaded',()=>{refresh();new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true});setTimeout(refresh,500);setTimeout(refresh,1500);});
  window.OnomoCorrections={refresh,disableVoice,fixLabels};
})();

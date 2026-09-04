/* Tableau de bord connecté à la base existante. */
const onomoConnection={url:'https://aljnwqrjplqvehctsdqj.supabase.co',key:'sb_publishable_MTVHDgxw7E2pmGKy8FzfJQ_Cg9UOg8a'};
let connectedTickets=[];

async function onomoApi(path,options={}){
  const response=await fetch(`${onomoConnection.url}/rest/v1/${path}`,{...options,headers:{apikey:onomoConnection.key,Authorization:`Bearer ${onomoConnection.key}`,'Content-Type':'application/json',Prefer:options.prefer||'return=representation'}});
  if(!response.ok)throw new Error(`Erreur de connexion (${response.status})`);
  const text=await response.text();return text?JSON.parse(text):[];
}
function safe(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));}
function elapsed(value){const seconds=(Date.now()-new Date(value).getTime())/1000;if(seconds<60)return"À l'instant";if(seconds<3600)return`Il y a ${Math.floor(seconds/60)} min`;if(seconds<86400)return`Il y a ${Math.floor(seconds/3600)} h`;return new Date(value).toLocaleDateString('fr-FR');}
function statusText(status){return({nouveau:'Ouvert',en_cours:'En cours',en_attente:'En attente',résolu:'Résolu',fermé:'Fermé'})[status]||status||'Ouvert';}
function priorityClass(priority){return priority==='Urgente'||priority==='Haute'?'priority-high':priority==='Basse'?'priority-low':'priority-medium';}
function renderConnectedDashboard(){
  const rows=connectedTickets.slice(0,4).map(ticket=>{const name=ticket.assigne_a||'Non assigné',status=ticket.statut||'nouveau';return `<tr><td><strong>${safe(ticket.numero||'—')}</strong><span>${safe(ticket.titre||'Sans objet')}</span></td><td><div class="user-cell"><span class="mini-avatar purple">${safe(name.slice(0,2).toUpperCase())}</span>${safe(name)}</div></td><td><span class="badge ${priorityClass(ticket.priorite)}">${safe(ticket.priorite||'Normale')}</span></td><td><span class="badge ${status==='résolu'?'status-done':status==='en_cours'?'status-progress':'status-open'}">${safe(statusText(status))}</span></td><td>${elapsed(ticket.updated_at||ticket.created_at)}</td></tr>`;}).join('');
  const tbody=document.querySelector('tbody');if(tbody)tbody.innerHTML=rows||'<tr><td colspan="5">Aucun ticket trouvé.</td></tr>';
  const open=connectedTickets.filter(ticket=>!['résolu','fermé'].includes(ticket.statut)).length,waiting=connectedTickets.filter(ticket=>ticket.statut==='en_attente').length,resolved=connectedTickets.filter(ticket=>ticket.statut==='résolu').length,stats=document.querySelectorAll('.stat-card strong');
  if(stats.length===4){stats[0].textContent=open;stats[1].textContent=waiting;stats[2].textContent=resolved;stats[3].textContent='—';}
  const count=document.querySelector('.nav-count');if(count)count.textContent=open;
}
async function loadConnectedTickets(){try{connectedTickets=await onomoApi('tickets?order=created_at.desc&limit=500');renderConnectedDashboard();window.onomoUI.notify('Tickets synchronisés avec la base connectée.');}catch(error){window.onomoUI.notify(`Impossible de charger les tickets : ${error.message}`);}}

document.addEventListener('DOMContentLoaded',()=>{
  const ticketModal=document.getElementById('ticketModal'),searchModal=document.getElementById('searchModal');
  document.getElementById('newTicketButton')?.addEventListener('click',()=>ticketModal.showModal());
  document.querySelectorAll('[data-close-modal]').forEach(button=>button.addEventListener('click',()=>ticketModal.close()));
  document.getElementById('searchButton')?.addEventListener('click',()=>searchModal.showModal());
  document.querySelectorAll('[data-close-search]').forEach(button=>button.addEventListener('click',()=>searchModal.close()));
  document.getElementById('ticketForm')?.addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;button.textContent='Création…';const ticket={numero:`ONO-${String(Date.now()).slice(-5)}`,titre:document.getElementById('ticketTitle').value.trim(),description:event.target.description.value.trim(),priorite:document.getElementById('ticketPriority').value,statut:'nouveau',hotel:'Onomo Maroc',categorie:'IT / Réseau',role_source:'admin',created_at:new Date().toISOString()};try{const created=await onomoApi('tickets',{method:'POST',body:JSON.stringify(ticket)});connectedTickets.unshift(created[0]||ticket);renderConnectedDashboard();ticketModal.close();event.target.reset();window.onomoUI.notify(`Le ticket ${ticket.numero} a été créé dans la base.`);}catch(error){window.onomoUI.notify(`Création impossible : ${error.message}`);}finally{button.disabled=false;button.textContent='Créer le ticket';}});
  document.getElementById('ticketSearch')?.addEventListener('input',event=>{const query=event.target.value.toLowerCase();document.querySelectorAll('tbody tr').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(query));});
  loadConnectedTickets();
  if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
});

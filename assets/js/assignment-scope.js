/* ONOMO Support IT — assignee selector scoped to the ticket's hotel.
   The server RPC is authoritative; the browser only presents its eligible
   results and never receives email addresses or credentials. */
(function(){
  'use strict';
  const role=value=>({admin:'admin',administrateur:'admin',it_hotel:'it_hotel','it hotel':'it_hotel',it_regional:'it_regional','it régional':'it_regional',demandeur:'demandeur',requester:'demandeur'}[String(value||'').toLowerCase().trim()]||String(value||'').toLowerCase().trim());
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nameOf=user=>`${user?.prenom||''} ${user?.nom||''}`.trim();
  const labels={local:'IT de cet hôtel',regional:'IT régional couvrant cet hôtel',admin:'Administrateurs — escalade'};
  const allowedRoles=new Set(['admin','it_hotel','it_regional','demandeur']);

  function currentRole(){return role(currentUser?.role);}
  function notice(select,message,kind='info'){
    let node=select.parentElement?.querySelector('.assignment-scope-notice');
    if(!node){node=document.createElement('div');node.className='assignment-scope-notice';node.style.cssText='font-size:11px;margin-top:6px;line-height:1.45';select.parentElement?.appendChild(node);}
    node.style.color=kind==='err'?'var(--red-t,#b42318)':'var(--tx3)';
    node.textContent=message||'';
  }
  function fallbackCandidates(hotel){
    const users=Array.isArray(window.DEMO_USERS)?window.DEMO_USERS:[];
    return users.filter(user=>{
      const userRole=role(user.role);
      if(userRole==='admin')return true;
      if(userRole==='it_hotel')return String(user.hotel||'').trim()===String(hotel||'').trim();
      if(userRole==='it_regional'){
        const hotels=Array.isArray(user.hotels)?user.hotels:[];
        return hotels.includes(hotel);
      }
      return false;
    }).map(user=>({assigned_to:user.auth_user_id||user.id,prenom:user.prenom,nom:user.nom,role:role(user.role),scope_type:role(user.role)==='admin'?'admin':role(user.role)==='it_regional'?'regional':'local'})).filter(user=>user.assigned_to&&nameOf(user));
  }
  async function candidates(hotel){
    if(!hotel)return [];
    if(typeof window.sbOK==='function'&&window.sbOK()&&typeof window.sbFetch==='function'){
      const rows=await window.sbFetch('rpc/ticket_assignment_candidates',{method:'POST',body:JSON.stringify({ticket_hotel:hotel}),prefer:'return=representation'});
      return Array.isArray(rows)?rows:[];
    }
    return fallbackCandidates(hotel);
  }
  function selectedValue(select){
    const option=select?.selectedOptions?.[0];
    if(!option)return null;
    const assignedTo=option.dataset?.assignedTo||'';
    const assigneeName=option.dataset?.assigneeName||option.value||'';
    return {assignedTo,assigneeName};
  }
  async function populate(id,hotel,selected=''){
    const select=document.getElementById(id);if(!select)return;
    select.disabled=true;
    select.innerHTML='<option value="">Chargement des responsables autorisés…</option>';
    notice(select,'');
    try{
      const rows=await candidates(hotel);
      select.innerHTML='<option value="">— Non assigné —</option>';
      const grouped={local:[],regional:[],admin:[]};
      rows.forEach(row=>{const key=grouped[row.scope_type]?row.scope_type:'regional';grouped[key].push(row);});
      ['local','regional','admin'].forEach(key=>{
        if(!grouped[key].length)return;
        const group=document.createElement('optgroup');group.label=labels[key];
        grouped[key].forEach(row=>{
          const name=nameOf(row);if(!name||!row.assigned_to)return;
          const option=document.createElement('option');
          option.value=name;option.textContent=name;
          option.dataset.assignedTo=row.assigned_to;option.dataset.assigneeName=name;option.dataset.scope=key;
          if(String(selected)===String(row.assigned_to)||String(selected)===name)option.selected=true;
          group.appendChild(option);
        });
        select.appendChild(group);
      });
      select.disabled=false;
      if(!rows.length)notice(select,'Aucun responsable autorisé n’est configuré pour cet hôtel.','err');
      else notice(select,'Assignation limitée à cet hôtel, à son IT régional et aux administrateurs.');
    }catch(error){
      console.warn('Chargement des responsables autorisés impossible',error);
      select.innerHTML='<option value="">Responsables indisponibles</option>';
      select.disabled=true;
      notice(select,'Impossible de vérifier les responsables autorisés. Réessayez avant d’enregistrer.','err');
    }
  }
  function ticketHotelForSelect(id){
    if(id==='editAgent')return currentTicket?.hotel||'';
    return document.getElementById('ntHotel')?.value||currentUser?.hotel||'';
  }
  const previousPopulate=window.populateAgentSelect;
  if(typeof previousPopulate==='function')window.populateAgentSelect=function(id,selected=''){
    const actor=currentRole();
    if((id==='editAgent'||id==='ntAgent')&&allowedRoles.has(actor)){
      void populate(id,ticketHotelForSelect(id),selected);
      return;
    }
    return previousPopulate.apply(this,arguments);
  };
  document.addEventListener('change',event=>{
    if(event.target?.id==='ntHotel'&&allowedRoles.has(currentRole()))void populate('ntAgent',event.target.value,'');
  });
  const previousCreate=window.createTicket;
  if(typeof previousCreate==='function')window.createTicket=async function(data){
    const chosen=selectedValue(document.getElementById('ntAgent'));
    if(chosen?.assignedTo)return previousCreate.call(this,{...data,assigned_to:chosen.assignedTo,assigne_a:chosen.assigneeName});
    return previousCreate.apply(this,arguments);
  };
  const previousUpdate=window.updateTicket;
  if(typeof previousUpdate==='function')window.updateTicket=async function(id,updates){
    if(Object.prototype.hasOwnProperty.call(updates||{},'assigne_a')){
      const chosen=selectedValue(document.getElementById('editAgent'));
      if(chosen?.assignedTo)return previousUpdate.call(this,id,{...updates,assigned_to:chosen.assignedTo,assigne_a:chosen.assigneeName});
      if(document.getElementById('editAgent')?.value==='')return previousUpdate.call(this,id,{...updates,assigned_to:null,assigne_a:''});
    }
    return previousUpdate.apply(this,arguments);
  };
  window.OnomoAssignmentScope={candidates,populate,selectedValue};
})();

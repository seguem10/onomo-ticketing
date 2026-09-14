/* ONOMO Support IT - Integrate Demandeur into the existing Users form */
(function(){
  'use strict';

  const norm=v=>String(v??'').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const isAdmin=()=>['admin','administrateur'].includes(norm(typeof currentUser!=='undefined'?currentUser?.role:window.currentUser?.role));

  function roleSelects(){
    return [...document.querySelectorAll('select')].filter(select=>{
      const id=norm(select.id),name=norm(select.name),label=norm(select.previousElementSibling?.textContent||select.parentElement?.querySelector('label')?.textContent||'');
      const text=[id,name,label].join(' ');
      return /role|profil|permission|fonction/.test(text) || [...select.options].some(o=>/admin|regional|hotel|demandeur|requester|directeur|direction/.test(norm(o.value+' '+o.text)));
    });
  }

  function addRequesterOption(){
    if(!isAdmin())return;
    roleSelects().forEach(select=>{
      if([...select.options].some(o=>norm(o.value)==='demandeur'||norm(o.textContent)==='demandeur'))return;
      const option=document.createElement('option');
      option.value='demandeur';
      option.textContent='Demandeur';
      select.appendChild(option);
      select.addEventListener('change',()=>applyRequesterRules(select));
    });
  }

  function applyRequesterRules(select){
    const requester=norm(select.value)==='demandeur';
    const form=select.closest('form')||select.closest('[role="dialog"]')||select.parentElement?.parentElement?.parentElement;
    if(!form)return;
    const hotel=[...form.querySelectorAll('select,input')].find(el=>{
      const text=norm([el.id,el.name,el.previousElementSibling?.textContent||'',el.parentElement?.querySelector('label')?.textContent||''].join(' '));
      return /hotel|établissement|etablissement/.test(text);
    });
    if(hotel&&requester){
      hotel.required=true;
      hotel.dataset.onomoRequesterRequired='1';
    }else if(hotel&&hotel.dataset.onomoRequesterRequired==='1'){
      hotel.required=false;
      delete hotel.dataset.onomoRequesterRequired;
    }
  }

  function wire(){
    if(!isAdmin())return;
    addRequesterOption();
    roleSelects().forEach(applyRequesterRules);
  }

  function start(){
    wire();
    new MutationObserver(wire).observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

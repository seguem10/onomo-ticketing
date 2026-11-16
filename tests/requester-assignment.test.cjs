const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/assignment-scope.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const i18n=fs.readFileSync('assets/js/i18n.js','utf8');

class El{
  constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.style={};this.disabled=false;this.parentElement=null;this.className='';this.textContent='';this.value='';}
  set innerHTML(markup){
    this.children=[];
    const match=String(markup).match(/^<option value="">(.*)<\/option>$/);
    if(match){const option=new El('option');option.textContent=match[1];this.appendChild(option);}
  }
  appendChild(child){child.parentElement=this;this.children.push(child);return child;}
  querySelector(selector){return selector==='.assignment-scope-notice'?this.children.find(child=>child.className==='assignment-scope-notice')||null:null;}
  get options(){return this.children.flatMap(child=>child.tag==='optgroup'?child.children:[child]);}
  get groups(){return this.children.filter(child=>child.tag==='optgroup');}
  get selectedOptions(){const chosen=this.options.find(option=>option.value===this.value);return chosen?[chosen]:[];}
}

function harness({role='demandeur',hotel='Onomo Dakar',answers=[[]]}={}){
  const form=new El('div'),agent=form.appendChild(new El('select')),hotelSelect=new El('select');
  const calls=[],toasts=[],created=[],listeners={};
  const window={
    sbOK:()=>true,
    sbFetch:async(path,options)=>{calls.push(path);const answer=answers[Math.min(calls.length-1,answers.length-1)];if(answer instanceof Error)throw answer;return answer;},
    showToast:(message,kind)=>toasts.push([message,kind]),
    populateAgentSelect(){return 'legacy';},
    createTicket:async data=>{created.push(data);return {id:'t1'};},
    updateTicket:async()=>true,
    addEventListener:(type,handler)=>{listeners[type]=handler;}
  };
  const context=vm.createContext({
    window,console:{warn(){}},setTimeout:(fn)=>setImmediate(fn),
    currentUser:{role,hotel},currentTicket:null,
    document:{getElementById:id=>({ntAgent:agent,ntHotel:hotelSelect}[id]||null),createElement:tag=>new El(tag),addEventListener(){}}
  });
  vm.runInContext(source,context);
  return {window,agent,form,hotelSelect,calls,toasts,created,listeners};
}
const notice=form=>form.querySelector('.assignment-scope-notice')?.textContent||'';
const rows=[
  {assigned_to:'u-local',prenom:'Ama',nom:'Local',scope_type:'local'},
  {assigned_to:'u-reg',prenom:'Ben',nom:'Regional',scope_type:'regional'},
  {assigned_to:'u-admin',prenom:'Cia',nom:'Admin',scope_type:'admin'}
];

test('a requester gets the IT staff allowed for their hotel, grouped, first one selected',async()=>{
  const h=harness({answers:[rows]});
  await h.window.OnomoAssignmentScope.populate('ntAgent','','');
  assert.deepEqual(h.calls,['rpc/requester_available_it']);
  assert.deepEqual(h.agent.groups.map(group=>group.label),['IT de votre hôtel','IT régional','Administrateurs — escalade']);
  assert.equal(h.agent.options[0].textContent,'— Sélectionner un IT —');
  assert.deepEqual(h.agent.options.slice(1).map(option=>[option.value,option.textContent,option.dataset.assigneeName]),[['u-local','Ama Local','Ama Local'],['u-reg','Ben Regional','Ben Regional'],['u-admin','Cia Admin','Cia Admin']]);
  assert.equal(h.agent.value,'u-local');
  assert.equal(h.agent.disabled,false);
  assert.equal(notice(h.form),'');
  assert.deepEqual(h.hotelSelect.options.map(option=>[option.value,option.textContent,option.disabled]),[['Onomo Dakar','Onomo Dakar',false]]);
  assert.equal(h.hotelSelect.value,'Onomo Dakar');
});

test('the populateSelects path routes a requester to the same list',async()=>{
  const h=harness({answers:[rows]});
  assert.equal(h.window.populateAgentSelect('ntAgent'),undefined);
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(h.calls,['rpc/requester_available_it']);
  assert.equal(h.agent.value,'u-local');
});

test('an empty or failed answer is retried before showing that no IT is available',async()=>{
  const h=harness({answers:[new Error('not ready'),[],rows]});
  await h.window.OnomoAssignmentScope.populate('ntAgent','','');
  assert.equal(h.calls.length,3);
  assert.equal(h.agent.value,'u-local');

  const none=harness({answers:[[]],hotel:''});
  await none.window.OnomoAssignmentScope.populate('ntAgent','','');
  assert.equal(none.calls.length,3);
  assert.equal(none.agent.disabled,true);
  assert.match(notice(none.form),/Aucun responsable IT/);
  assert.deepEqual(none.hotelSelect.options.map(option=>[option.value,option.textContent,option.disabled]),[['','— Aucun hôtel assigné —',true]]);
});

test('a requester ticket is assigned to the chosen IT and blocked without one',async()=>{
  const h=harness({answers:[rows]});
  await h.window.OnomoAssignmentScope.populate('ntAgent','','');
  h.agent.value='u-reg';
  await h.window.createTicket({titre:'Wi-Fi'});
  assert.equal(JSON.stringify(h.created),JSON.stringify([{titre:'Wi-Fi',assigned_to:'u-reg',assigne_a:'Ben Regional'}]));
  h.agent.value='';
  assert.equal(await h.window.createTicket({titre:'Wi-Fi'}),null);
  assert.equal(h.created.length,1);
  assert.equal(h.toasts.at(-1)[1],'err');
});

test('other roles keep the hotel-scoped candidates',async()=>{
  const h=harness({role:'it_hotel',answers:[rows]});
  await h.window.OnomoAssignmentScope.populate('ntAgent','Onomo Dakar','');
  assert.deepEqual(h.calls,['rpc/ticket_assignment_candidates']);
  assert.equal(h.agent.options[0].textContent,'— Non assigné —');
});

test('a language change refreshes an open requester form',async()=>{
  const h=harness({answers:[rows]});
  h.listeners['onomo:languagechange']();
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.deepEqual(h.calls,['rpc/requester_available_it']);
});

test('ticket submission checks the requester hotel and IT first',()=>{
  const body=html.slice(html.indexOf('async function submitNewTicket(){'));
  const check=body.slice(0,body.indexOf('const titre='));
  assert.match(check,/\["demandeur","requester"\]\.includes/);
  assert.match(check,/getElementById\("ntHotel"\)\?\.value\)\{showToast\(text\("no_hotel_assigned"/);
  assert.match(check,/getElementById\("ntAgent"\)\?\.value\)\{showToast\(text\("no_it_available"/);
});

test('the former requester patch is no longer loaded',()=>{
  assert.ok(!i18n.includes('user-ticket-fix.js'));
  assert.ok(!fs.existsSync('assets/js/user-ticket-fix.js'));
});

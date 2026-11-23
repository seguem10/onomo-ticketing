const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync('assets/js/sla-dashboard.js','utf8');
const html=fs.readFileSync('index.html','utf8');

function renderPanel(tickets,statusOf){
  const inserted=[];
  const welcome={insertAdjacentHTML:(where,markup)=>inserted.push(['welcome',where,markup])};
  const host={
    querySelector:selector=>selector==='.dash-welcome'?welcome:null,
    querySelectorAll:()=>[],
    insertAdjacentHTML:(where,markup)=>inserted.push(['host',where,markup])
  };
  const window={visibleTickets:()=>tickets,getSLAStatus:statusOf,renderDashboard(){},OnomoI18n:{language:'fr'}};
  const ctx={window,document:{getElementById:()=>host}};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  window.renderDashboard();
  return inserted;
}

test('SLA panel is placed below the dashboard greeting',()=>{
  const [[target,where]]=renderPanel([],()=>'ok');
  assert.equal(target,'welcome');assert.equal(where,'afterend');
});

test('SLA cards say "no open ticket" only when nothing is open',()=>{
  const empty=renderPanel([],()=>'ok')[0][2];
  assert.equal((empty.match(/Aucun ticket ouvert/g)||[]).length,3);
  const open=renderPanel([{id:'1',statut:'en_cours'},{id:'2',statut:'nouveau'}],()=>'ok')[0][2];
  assert.match(open,/sur 2 ticket\(s\) ouvert\(s\)/);
  assert.match(open,/Aucun ticket à risque/);
  assert.match(open,/Aucun dépassement/);
  assert.doesNotMatch(open,/Aucun ticket ouvert/);
});

test('follow-up hint only shows on the waiting filters',()=>{
  assert.match(html,/followUp&&\(filterStat==='waiting_it'\|\|filterStat==='waiting_requester'\)\?`<p class="ticket-follow-up-hint">/);
  assert.match(html,/st==='tous'\?esc\(appText\('all','Tous'\)\)/);
});

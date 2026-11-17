const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const load=()=>import('../supabase/functions/_shared/teams.mjs');
const HOOK='https://onomo.webhook.office.com/webhookb2/abc';

function fakeService({inserted=true,error=null}={}){
  const calls=[];
  const service={from:table=>({
    upsert:(row,options)=>{calls.push(['upsert',table,row,options]);return {select:async()=>({data:inserted?[{ticket_id:row.ticket_id}]:[],error})};},
    delete:()=>{const chain={eq:(column,value)=>{calls.push(['delete-eq',column,value]);return chain;}};calls.push(['delete',table]);return chain;}
  })};
  return {service,calls};
}

test('only urgent and critical tickets count as urgent',async()=>{
  const {isUrgent}=await load();
  for(const value of ['Urgente','urgent','Critique',' critique '])assert.equal(isUrgent(value),true,value);
  for(const value of ['Haute','Normale','Basse','',null])assert.equal(isUrgent(value),false,String(value));
});

test('only Teams and Power Automate webhook hosts are accepted',async()=>{
  const {teamsWebhookAllowed}=await load();
  for(const url of [HOOK,'https://prod-12.westeurope.logic.azure.com/workflows/x','https://default1.environment.api.powerplatform.com/powerautomate/x'])assert.equal(teamsWebhookAllowed(url),true,url);
  for(const url of ['','not a url','http://onomo.webhook.office.com/x','https://evil.example/webhook.office.com','https://webhook.office.com.evil.example/x'])assert.equal(teamsWebhookAllowed(url),false,url);
});

test('the card carries the ticket as plain, clipped text and a link to the app',async()=>{
  const {teamsPayload}=await load();
  const card=teamsPayload({heading:'Ticket Urgente — Onomo Dakar',ticket:{number:'TK-1',title:'x'.repeat(300),hotel:'Onomo Dakar',priority:'Urgente',status:''},appUrl:'https://onomo-ticketing.vercel.app'});
  assert.equal(card.type,'message');
  const content=card.attachments[0].content;
  assert.equal(card.attachments[0].contentType,'application/vnd.microsoft.card.adaptive');
  assert.equal(content.body[1].text.length,200);
  assert.deepEqual(content.body[2].facts.map(f=>f.title),['Ticket','Hôtel','Priorité']);
  assert.equal(content.actions[0].url,'https://onomo-ticketing.vercel.app');
});

test('an alert is posted once per ticket and event, and released if Teams refuses',async()=>{
  const {alertTeamsOnce}=await load();
  const posts=[];
  const ok=async(url,options)=>{posts.push([url,JSON.parse(options.body)]);return {ok:true};};
  const first=fakeService();
  assert.deepEqual(await alertTeamsOnce(first.service,HOOK,{ticketId:'t1',event:'sla_breach',payload:{a:1}},ok),{sent:true});
  assert.deepEqual(first.calls[0],['upsert','teams_notification_log',{ticket_id:'t1',event:'sla_breach'},{onConflict:'ticket_id,event',ignoreDuplicates:true}]);
  assert.deepEqual(posts,[[HOOK,{a:1}]]);

  const again=fakeService({inserted:false});
  assert.deepEqual(await alertTeamsOnce(again.service,HOOK,{ticketId:'t1',event:'sla_breach',payload:{}},ok),{sent:false,reason:'déjà envoyé'});
  assert.equal(posts.length,1);

  const refused=fakeService();
  const result=await alertTeamsOnce(refused.service,HOOK,{ticketId:'t2',event:'urgent_created',payload:{}},async()=>({ok:false,status:400}));
  assert.deepEqual(result,{sent:false,reason:'Teams 400'});
  assert.deepEqual(refused.calls.slice(1),[['delete','teams_notification_log'],['delete-eq','ticket_id','t2'],['delete-eq','event','urgent_created']]);

  const unset=fakeService();
  assert.deepEqual(await alertTeamsOnce(unset.service,'',{ticketId:'t3',event:'sla_breach',payload:{}},ok),{sent:false,reason:'non configuré'});
  assert.equal(unset.calls.length,0);
});

test('the Edge Functions alert Teams for urgent tickets and breached SLAs only',()=>{
  const delivery=fs.readFileSync('supabase/functions/ticket-notification-delivery/index.ts','utf8');
  assert.ok(delivery.includes('if ((event === "created" || event === "updated") && isUrgent(ticket.priorite)) {'));
  assert.ok(delivery.includes('ticketId, event: "urgent_created",'));
  assert.ok(delivery.includes('Deno.env.get("TEAMS_WEBHOOK_URL")'));
  const sla=fs.readFileSync('supabase/functions/sla-escalation-email/index.ts','utf8');
  assert.ok(sla.includes('if (row.escalation_stage !== "warning") {'));
  assert.ok(sla.includes('event: row.escalation_stage === "critical" ? "sla_critical" : "sla_breach"'));
  const sql=fs.readFileSync('supabase/migrations/20261117170000_teams_notification_log.sql','utf8');
  assert.ok(sql.includes('primary key (ticket_id, event)'));
  assert.ok(sql.includes('revoke all on public.teams_notification_log from anon, authenticated;'));
});

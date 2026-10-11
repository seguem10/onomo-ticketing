const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const window={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../assets/js/ticket-follow-up.js'),'utf8'),{window,document:{getElementById:()=>({value:'fr'})}});
const ticket={id:'t1',statut:'en_cours',created_by:'requester',created_by_name:'Reception',assigne_a:'IT Hotel'};
const msg=(id,author,date,visibility='public')=>({id,ticket_id:'t1',author_id:author,auteur:author,created_at:date,visibility});
const profiles=[{auth_user_id:'tech',role:'it_hotel'}];
test('new ticket waits for IT and requester public reply waits for IT',()=>{
 assert.equal(window.TicketFollowUp.state(ticket,[]),'waiting_it');
 assert.equal(window.TicketFollowUp.state(ticket,[msg('1','requester','2026-10-11T10:00:00Z')]),'waiting_it');
});
test('public IT reply waits for requester; internal reply does not change it',()=>{
 const rows=[msg('1','requester','2026-10-11T10:00:00Z'),msg('2','tech','2026-10-11T11:00:00Z')];
 assert.equal(window.TicketFollowUp.state(ticket,rows,profiles),'waiting_requester');
 rows.push(msg('3','requester','2026-10-11T12:00:00Z','internal'));
 assert.equal(window.TicketFollowUp.state(ticket,rows,profiles),'waiting_requester');
});
test('resolved tickets and unknown authors are not assigned a waiting category',()=>{
 assert.equal(window.TicketFollowUp.state({...ticket,statut:'résolu'},[]),'');
 assert.equal(window.TicketFollowUp.state(ticket,[msg('1','unknown','2026-10-11T10:00:00Z')]),'');
});
test('messages from another ticket are ignored and source order remains unchanged',()=>{
 const rows=[msg('1','requester','2026-10-11T10:00:00Z'),{...msg('2','tech','2026-10-11T11:00:00Z'),ticket_id:'t2'}];
 assert.equal(window.TicketFollowUp.state(ticket,rows,profiles),'waiting_it');assert.equal(rows[0].id,'1');
});

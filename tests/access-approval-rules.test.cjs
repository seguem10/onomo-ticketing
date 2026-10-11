const test=require('node:test');
const assert=require('node:assert/strict');
const rules=import('../assets/js/access-approval-rules.mjs');
const request={requesterId:'requester',hotel:'Airport',stage:'it'};
const it={id:'it',role:'it_hotel',hotel:'Airport'};
test('IT then hotel director then regional HR are required',async()=>{
 const {nextApprovalState:next}=await rules;
 assert.equal(next(request,it,'approve'),'director');
 assert.equal(next({...request,stage:'director'},{id:'dg',role:'directeur_hotel',hotel:'Airport'},'approve'),'hr');
 assert.equal(next({...request,stage:'hr'},{id:'hr',role:'rh_regional',hotels:['Airport']},'approve'),'approved');
 assert.equal(next(request,{id:'regional',role:'it_regional',hotels:['Airport']},'approve'),'director');
});
test('roles cannot bypass order, hotel scope or self-approval',async()=>{
 const {nextApprovalState:next}=await rules;
 assert.throws(()=>next(request,{...it,id:'requester'},'approve'),/self_approval/);
 assert.throws(()=>next(request,{...it,hotel:'Other'},'approve'),/outside_hotel/);
 assert.throws(()=>next(request,{id:'admin',role:'admin'},'approve'),/wrong_approval/);
 assert.throws(()=>next({...request,stage:'hr'},it,'approve'),/wrong_approval/);
});
test('rejection is terminal at every stage and final approval is closed',async()=>{
 const {nextApprovalState:next}=await rules;
 for(const [stage,actor] of [['it',it],['director',{id:'dg',role:'directeur_hotel',hotel:'Airport'}],['hr',{id:'hr',role:'rh_regional',hotels:['Airport']}]])
   assert.equal(next({...request,stage},actor,'reject'),'rejected');
 for(const stage of ['rejected','approved'])assert.throws(()=>next({...request,stage},it,'approve'),/request_closed/);
 assert.throws(()=>next(request,it,'unknown'),/invalid_decision/);
});

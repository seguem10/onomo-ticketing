// Domain specification only: never use client-side rules as authorization.
// The production decision API must check these rules against persisted roles,
// scopes and decisions under a database row lock before committing a decision.
export const APPROVAL_STEPS=Object.freeze(['it','director','hr']);
const roles={
 it:new Set(['it_hotel','it_regional']),
 director:new Set(['directeur_hotel']),
 hr:new Set(['rh_regional'])
};
export function nextApprovalState(request, actor, decision){
 if(!request?.requesterId||!request.hotel||!actor?.id)throw new Error('invalid_identity');
 if(actor.id===request.requesterId)throw new Error('self_approval_forbidden');
 if(!['approve','reject'].includes(decision))throw new Error('invalid_decision');
 const step=request.stage;
 if(!APPROVAL_STEPS.includes(step))throw new Error('request_closed');
 if(!roles[step].has(actor.role))throw new Error('wrong_approval_role');
 const scoped=actor.role==='it_hotel'||actor.role==='directeur_hotel'
   ?actor.hotel===request.hotel
   :Array.isArray(actor.hotels)&&actor.hotels.includes(request.hotel);
 if(!scoped)throw new Error('outside_hotel_scope');
 if(decision==='reject')return 'rejected';
 return APPROVAL_STEPS[APPROVAL_STEPS.indexOf(step)+1]||'approved';
}

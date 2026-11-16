const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const i18n=fs.readFileSync('assets/js/i18n.js','utf8');
const activity=fs.readFileSync('assets/js/admin-activity.js','utf8');

test('security entries use translated audit labels with a readable fallback',()=>{
  assert.match(activity,/action:t\('security','Sécurité'\)\+' · '\+actionLabel\(r\.action\)/);
  const humanizeLine=activity.split('\n').find(l=>l.includes('const humanize='));
  const labelLine=activity.split('\n').find(l=>l.includes('const actionLabel='));
  const dict={audit_admin_password_reset:'Password reset by an administrator'};
  const make=new Function('window',`${humanizeLine.trim()}\n${labelLine.trim()}\nreturn actionLabel;`);
  const actionLabel=make({OnomoI18n:{t:key=>dict[key]||key}});
  assert.equal(actionLabel('admin_password_reset'),'Password reset by an administrator');
  assert.equal(actionLabel('some_new_event'),'Some new event');
});

test('audit labels exist in French, English and Arabic',()=>{
  for(const key of ['audit_admin_password_reset','audit_session_expired','audit_user_created','audit_user_deleted','audit_mfa_required','audit_mfa_reset_completed']){
    assert.equal((i18n.match(new RegExp(`[{,]${key}:'`,'g'))||[]).length,3,key);
  }
});

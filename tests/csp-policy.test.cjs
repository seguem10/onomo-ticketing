const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {scriptSources, harden, supabaseScript} = require('../scripts/csp-policy.cjs');
const root = path.resolve(__dirname, '..');
test('CSP permits only exact inline bytes and reviewed script CDN path', () => {
  const policy = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).headers[0].headers.find(x => x.key === 'Content-Security-Policy').value;
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const src = policy.split(';').map(x => x.trim()).find(x => x.startsWith('script-src '));
  assert.equal(src, 'script-src ' + scriptSources(html));
  assert.ok(!src.includes("'unsafe-inline'"));
  assert.ok(!src.includes("'unsafe-eval'"));
  const remoteSources=src.split(' ').filter(token=>/^https?:\/\//.test(token)).map(token=>new URL(token).href);
  assert.deepEqual(remoteSources,[new URL(supabaseScript).href]);
  assert.equal(harden(policy, html), policy);
  assert.ok(policy.includes("script-src-attr 'unsafe-inline'"), 'known legacy handler exception remains explicit');
});
test('changing inline script changes the hash, injected scripts are not implicitly authorized', () => {
  assert.notEqual(scriptSources('<script>const a=1;</script>'), scriptSources('<script>const a=2;</script>'));
  assert.equal(scriptSources('<script>\r\nconst a=1;\r\n</script>'), scriptSources('<script>\nconst a=1;\n</script>'));
  assert.throws(() => scriptSources('<script src="https://cdn.jsdelivr.net/npm/unreviewed/index.js"></script>'));
  assert.equal(scriptSources('<script>x()</script><!-- <script>evil()</script> -->'), scriptSources('<script>x()</script>'));
  assert.notEqual(scriptSources('<script>const html=`<!-- preserve -->`;</script>'), scriptSources('<script>const html=``;</script>'));
  assert.equal(scriptSources('<script>x()</script\t\n bar>'),scriptSources('<script>x()</script>'));
});

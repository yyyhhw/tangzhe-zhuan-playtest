"""Read-only verification of exact candidate application and scoped maintenance.
Run from any directory; requires the local Git history of this candidate.
"""
import subprocess,json,hashlib
from pathlib import Path
here=Path(__file__).resolve().parent;root=here.parents[2];m=json.loads((here/'maintenance.json').read_text());base=m['baseline'];pre=m['preTokenHead'];old=m['oldToken'];new=m['newToken']
def blob(ref,path):return subprocess.check_output(['git','show',ref+':'+path],cwd=root)
def current(p):return (root/p).read_bytes()
# Existing test assertions remain exact except current release-token expectations.
extra={'tests/formal/tea-entry-cards-out.test.mjs':[("p==='preview/pet/game/'?'tea-td-cards-out-20261012-r1':pageToken","p==='preview/pet/game/'?'"+new+"':pageToken")], 'tests/formal/copy52-display.test.mjs':[("p==='preview/pet/game/app.js'?'tea-td-cards-out-20261012-r1':pageToken","p==='preview/pet/game/app.js'?'"+new+"':pageToken"),("p==='preview/pet/game/app.js'?'home35-td46-home22-copy52-20261012-r1':pageToken","p==='preview/pet/game/app.js'?'"+new+"':pageToken")], 'tests/wearables8/resource-chain.test.mjs':[('preview-tea-td-cards-out-20261012-r1','preview-'+new)]}
for p in m['tokenFiles']:
 expected=blob(pre,p).decode().replace(old,new)
 for a,b in extra.get(p,[]):expected=expected.replace(a,b)
 assert current(p).decode()==expected,p
p='preview/pet/game/index.html';expected=blob(pre,p).decode().replace("var B='preview-tea-td-cards-out-20261012-r1'","var B='preview-"+new+"'").replace('app.js?v=home35-td46-home22-copy52-20261012-r1','app.js?v='+new);assert current(p).decode()==expected
p='preview/pet/game/version.json';assert current(p).decode()==blob(pre,p).decode().replace('preview-tea-td-cards-out-20261012-r1','preview-'+new)
# Exactly the listed live-file fingerprint entries may advance. All other values stay fixed.
for manifest in {x['manifest'] for x in m['liveFingerprintUpdates']}:
 expected=json.loads(blob(base,manifest));rows=expected.get('checks',[]) if isinstance(expected,dict) else expected
 for change in [x for x in m['liveFingerprintUpdates'] if x['manifest']==manifest]:
  b=current(change['path']);b=b.decode().replace(new,change['normalization']).encode() if change['normalization'] else b
  h=hashlib.sha256(b).hexdigest();assert h==change['new'];row=next(x for x in rows if x['path']==change['path'] and not x.get('start'));assert row[change['field']]==change['old'];row[change['field']]=h
 assert json.loads(current(manifest))==expected,manifest
p='qa-protocol2/dependency-pins.json';expected=json.loads(blob(base,p))
for row in expected:
 b=current(row['path']);row['sha256']=hashlib.sha256(b).hexdigest();row['bytes']=len(b)
assert json.loads(current(p))==expected
# No rewrites of old reports or other test-integrity baseline manifests.
files=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'tests'],cwd=root,text=True).splitlines();changedManifests={x['manifest'] for x in m['liveFingerprintUpdates']}
for p in files:
 if p.startswith('tests/reports/') or (p.endswith('.json') and any(x in p for x in ['integrity','protected-blobs','legacy-token-pins']) and p not in changedManifests):assert current(p)==blob(base,p),p
# 128 functions and 129 modules remain exact, ignoring only resource token.
for p in ['app.js','pet/game/app.js']:
 a=blob(base,p).decode();b=current(p).decode()
 for name in ['homeAutoTick','homeLiveTap']:
  def extract(s):
   start=s.index('function '+name+'(');end=s.find('\nfunction ',start+1);return s[start:end]
  assert extract(a)==extract(b),p+' '+name
for p in ['space/overlay.mjs','space/xingtu-views.mjs']:assert current(p).decode()==blob(base,p).decode().replace(old,new),p
# Original 127 patch applied without introducing extra product edits.
changed=subprocess.check_output(['git','diff','--name-only',base,pre],cwd=root,text=True).splitlines();assert set(changed)=={'app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'}
print('PASS: token expectations only; 5 explicit live fingerprint entries; all other baselines/reports unchanged; 128/129 preserved')

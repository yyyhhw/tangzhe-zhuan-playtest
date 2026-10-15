"""Read-only proof: release maintenance changes tokens and derived pins only.
Run from repository root: python tests/reports/integration-home128-xingtu129/verify-maintenance.py
Requires the cherry-picked pre-token ancestor in Git history. No network or writes.
"""
import json,hashlib,subprocess
from pathlib import Path
here=Path(__file__).resolve().parent
root=here.parents[2]
m=json.loads((here/'resource-chain.json').read_text())
def show(path):return subprocess.check_output(['git','show',m['preTokenHead']+':'+path],cwd=root)
for row in m['files']:
 before=show(row['path']).decode();after=(root/row['path']).read_text()
 assert after==before.replace(m['oldToken'],m['newToken']),row['path']
pinpath='qa-protocol2/dependency-pins.json';old=json.loads(show(pinpath));new=json.loads((root/pinpath).read_text());expected=json.loads(show(pinpath))
for pin in expected:
 b=(root/pin['path']).read_bytes();pin.update(bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
assert new==expected,'pin metadata or entries changed beyond hashes/bytes'
# All historical test integrity manifests must remain exact baseline bytes.
base='aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5'
protected=subprocess.check_output(['git','ls-tree','-r','--name-only',base,'tests'],cwd=root,text=True).splitlines()
protected=[p for p in protected if p.endswith('.json') and any(x in p for x in ['integrity','protected-blobs','legacy-token-pins'])]
for p in protected:assert (root/p).read_bytes()==subprocess.check_output(['git','show',base+':'+p],cwd=root),p
# Combined product edits before maintenance are exact accepted candidate blobs.
for candidate,paths in [('12aa45f467e7a866de8efc7e28bf541316d3f9dd',['app.js','pet/game/app.js']),('eca6f11c21e76679d49da8a0b24c717f6fa509ad',['space/overlay.mjs','space/xingtu-views.mjs'])]:
 for p in paths:
  assert show(p)==subprocess.check_output(['git','show',candidate+':'+p],cwd=root),p
print(f'PASS: {len(m["files"])} token-only files; pins exactly derived; {len(protected)} historical manifests unchanged; accepted product blobs exact')

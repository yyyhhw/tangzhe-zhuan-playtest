"""Decode every story-card WebP and compare against the actual album catalog."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[2]
catalog=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {ROUTES} from './space/album.mjs';console.log(JSON.stringify(ROUTES.flatMap(r=>r.cards.map((c,i)=>({key:r.id+'_'+(i+1),title:c.title})))));"],cwd=ROOT))
assert len(catalog)==25
rows=[]
for row in catalog:
 file=ROOT/'art/spacecards'/(row['key']+'.webp')
 with Image.open(file) as im:
  im.load();assert im.format=='WEBP' and im.size==(1024,768),(file,im.format,im.size)
  rows.append({**row,'path':str(file.relative_to(ROOT)),'size':list(im.size),'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
assert len(list((ROOT/'art/spacecards').glob('*.webp')))==25
(ROOT/'tests/xt11/art-files.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
print(f"25/25 distinct 1024x768 WebP decoded; {sum(r['bytes'] for r in rows)} bytes")
assert len({r['sha256'] for r in rows})==25

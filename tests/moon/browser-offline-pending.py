import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[2];BASE='http://127.0.0.1:8877';rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for scope,path in [('formal','/'),('preview','/preview/'),('formal','/pet/game/')]:
  for mode in ['offline','pending']:
   subprocess.run(['node','tests/moon/generate-offline-fixtures.mjs','/tmp/moon-fixtures'],cwd=R,check=True,stdout=subprocess.DEVNULL)
   f=json.loads(Path(f'/tmp/moon-fixtures/{scope}-{mode}.json').read_text());c=b.new_context();pg=c.new_page()
   try:
    pg.goto(BASE+'/probe');pg.evaluate("f=>{if(!f.synthetic||localStorage.length!==0)throw Error('NOT_EMPTY');for(const[k,v]of Object.entries(f.keys))localStorage.setItem(k,v);}",f);pg.goto(BASE+path);pg.wait_for_function('!!window.__tzz && !!window.XingTu && !!__tzz.state.pending');before=pg.evaluate('({balance:__tzz.E.balance(__tzz.state),pending:__tzz.state.pending,blocked:XingTu.open().ok})');assert before['blocked']==False
    evidence={k:v for k,v in f['keys'].items() if k.endswith('original')};pg.locator('#claim').click();pg.wait_for_function('!__tzz.state.pending');after=pg.evaluate('({balance:__tzz.E.balance(__tzz.state),log:__tzz.state.claimLog,space:__tzz.state.space})');assert after['balance']>=before['balance']+before['pending']['amount'];assert pg.evaluate('rows=>Object.entries(rows).every(([k,v])=>localStorage.getItem(k)===v)',evidence)
    pg.evaluate('XingTu.open()');pg.locator('#xingtuDepart').click();pg.wait_for_selector('#xingtuClaim',timeout=15000);pg.locator('#xingtuClaim').click();assert pg.evaluate('__tzz.state.space.pts')==8;assert pg.evaluate('rows=>Object.entries(rows).every(([k,v])=>localStorage.getItem(k)===v)',evidence)
    rows.append({'scope':scope,'path':path,'mode':mode,'pass':True,'offlineAmount':before['pending']['amount'],'claimId':before['pending'].get('id'),'pts':8,'immutableEvidenceUnchanged':True})
   except Exception as e:rows.append({'scope':scope,'path':path,'mode':mode,'pass':False,'error':str(e)})
   finally:c.close()
   print(json.dumps(rows[-1]),flush=True)
 b.close()
Path('/tmp/space-offline-results.json').write_text(json.dumps(rows,indent=2));assert all(r['pass'] for r in rows)

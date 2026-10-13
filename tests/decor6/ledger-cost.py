"""Bounded hidden receipt validator micro-cost, real candidate module, CPU4; attribution only."""
import json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/decor6-controlled');d=json.loads((out/'controlled-seeds.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();pg=c.new_page();pg.goto('http://127.0.0.1:8765/probe');pg.evaluate('(seed)=>{for(const[k,v]of seed)localStorage.setItem(k,v)}',d['seeds']['D']);c.add_init_script(f'Date.now=()=>{d["clock"]};window.requestAnimationFrame=()=>0;');pg.goto('http://127.0.0.1:8765/');pg.wait_for_function('!!window.__tzz',polling=50);cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
 rows=pg.evaluate('''async()=>{const {validateHiddenLedger}=await import('/collectibles/decor6-grants.mjs?v=decor6-on52-candidate-20261013-r1');let rows=[];for(let r=0;r<8;r++){let t=performance.now();for(let i=0;i<200;i++){if(!validateHiddenLedger(__tzz.state))throw Error('ledger');}rows.push((performance.now()-t)/200);}return rows;}''');b.close()
result={'cpu':4,'batchMeansMsPerValidation':rows,'medianWarmMsPerValidation':statistics.median(rows[2:]),'validationsPerOrdinaryCommit':3};(out/'ledger-cost.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

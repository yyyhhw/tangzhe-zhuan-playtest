"""Same-page CPU4 persist before/after two real host claims; fixed clock/no rAF for isolation."""
import json,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('/tmp/decor6-order-perf');d=json.loads((out/'seeds.json').read_text())
ROUND='''async()=>{let times=[];for(let i=0;i<15;i++){const t=performance.now();if(!__tzz.persist())throw Error('persist');times.push(performance.now()-t);await new Promise(r=>setTimeout(r,150));}return times;}'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);c=b.new_context();pg=c.new_page();pg.goto('http://127.0.0.1:8872/probe');pg.evaluate('(seed)=>{for(const[k,v]of seed)localStorage.setItem(k,v)}',d['seeds']['C']);c.add_init_script(f'Date.now=()=>{d["clock"]};window.requestAnimationFrame=()=>0;');pg.goto('http://127.0.0.1:8872/');pg.wait_for_function('!!window.__tzz',polling=50);cdp=c.new_cdp_session(pg);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4});before=pg.evaluate(ROUND)
 claims=pg.evaluate('''()=>{const times=[];for(const id of ['d_opening_photo','d_ward_charm']){const t=performance.now(),r=FormalCollectionRuntime.claimHidden(id);if(!r.ok)throw Error(r.code);times.push({id,ms:performance.now()-t});}return times;}''');after=pg.evaluate(ROUND);owned=pg.evaluate('__tzz.state.gacha.owned.length');assert owned==58 and not pg.evaluate('__tzz.saveBlocked');b.close()
result={'cpu':4,'before56Times':before,'after58Times':after,'beforeMedian':statistics.median(before[3:]),'afterMedian':statistics.median(after[3:]),'claims':claims,'owned':owned};(out/'live-claim-performance.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

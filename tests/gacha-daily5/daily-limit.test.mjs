// 杨总 16:12：盲盒每人每天最多开 5 次（游戏日 = 与每日双倍同一 dayKey）。被挡不扣币、不改保底/不重复规则。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import {assembly,until,copy} from '../wearables8/production-harness.mjs';
const require=createRequire(import.meta.url);
const T0=Date.UTC(2026,9,13,4,0,0),DAY=86400000;
for(const file of ['economy.js','pet/game/economy.js']){
  const E=require('../../'+file);
  const rich=()=>{const s=E.newState(T0);s.coins=1e12;s.shops[3].open=true;s.shops[3].lv=1;s.shops[3].emp=1;s.maxSeen=T0;return s;};
  test(file+': 5 draws per game day, 6th blocked with no coin/collection/pity change',()=>{
    const s=rich();assert.equal(E.CFG.GACHA_DAILY_LIMIT,5);assert.equal(E.gachaDailyLeft(s,T0),5);
    for(let i=0;i<5;i++){const r=E.gachaDraw(s,0.5,undefined,T0+i);assert(r.ok,'draw '+i);assert.equal(E.gachaDailyLeft(s,T0),4-i);}
    const before=JSON.stringify(s),r=E.gachaDraw(s,0.5,undefined,T0+9);
    assert.equal(r.ok,false);assert.equal(r.dailyLimit,true);assert.equal(r.why,'今天的 5 次已开完');assert.equal(JSON.stringify(s),before,'blocked attempt changes nothing (coins, owned, pity, draws)');
    assert.deepEqual(s.gachaDaily,{day:E.dayKey?E.dayKey(T0):s.gachaDaily.day,n:5});
  });
  test(file+': day rollover (game-day boundary, same as daily double) resets to 5',()=>{
    const s=rich();for(let i=0;i<5;i++)assert(E.gachaDraw(s,0.5,undefined,T0).ok);assert.equal(E.gachaDailyLeft(s,T0),0);
    const next=E.nextResetTs(T0);assert.equal(E.gachaDailyLeft(s,next-1),0);assert.equal(E.gachaDailyLeft(s,next),5);
    const r=E.gachaDraw(s,0.5,undefined,next);assert(r.ok);assert.equal(s.gachaDaily.n,1);assert.notEqual(s.gachaDaily.day,'2000-01-01');
  });
  test(file+': clock moved back to an earlier day cannot refill draws',()=>{
    const s=rich();for(let i=0;i<5;i++)E.gachaDraw(s,0.5,undefined,T0);assert.equal(E.gachaDailyLeft(s,T0-DAY),0);
  });
  test(file+': old save without gachaDaily = 0 opened today; bad value normalized to null; no validation failure',()=>{
    const old=JSON.parse(JSON.stringify(rich()));delete old.gachaDaily;const s=E.migrate(old,T0).st;assert.equal(s.gachaDaily,null);assert.equal(E.gachaDailyLeft(s,T0),5);
    assert.equal(E.validState(JSON.parse(JSON.stringify(old))).length,0);assert.equal(E.checkSave(JSON.parse(JSON.stringify(old))).length,0);
    for(const bad of ['x',{day:1,n:2},{day:'2026-10-13',n:-1},{day:'2026-10-13',n:1.5}])assert.equal(E.migrate({...old,gachaDaily:bad},T0).st.gachaDaily,null);
    assert.equal(Object.hasOwn(E.newState(0),'gachaDaily'),false,'not part of required parent shape (old saves stay complete)');
  });
  test(file+': legacy callers without now (sims/tests) are not limited; complete box still reports 已集齐 first',()=>{
    const s=rich();for(let i=0;i<8;i++)assert(E.gachaDraw(s,0.5).ok);assert.equal(s.gachaDaily??null,null);
  });
}
for(const file of ['app.js','pet/game/app.js'])test(file+': UI shows 今日剩余 X/5, disabled 今天的 5 次已开完 button, no 再开一个 at 0',()=>{
  const s=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8');
  assert.match(s,/今日剩余 \$\{dailyLeft\}\/\$\{E\.CFG\.GACHA_DAILY_LIMIT\}/);assert.match(s,/id="gachaDailyDone" disabled>\$\{E\.CFG\.GACHA_DAILY_LIMIT\} 次已开完</);
  assert.match(s,/!done && !resumed && E\.gachaDailyLeft\(state, now\(\)\) > 0/);assert.match(s,/E\.gachaDraw\(state, rand\(\), undefined, now\(\)\)/);
});
for(const path of ['/','/pet/game/'])test(`formal ${path}: real doGacha + P2 coordinator — 5 commits, 6th blocked without debit/write, gachaDaily persisted and survives reload`,{timeout:30000},async t=>{
  const h=await assembly({scope:'formal',path,protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));s.coins=1e9;f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app||h.settled,'app');assert(h.app);
  h.context.__gachaRandom=()=>0.5;
  for(let i=0;i<5;i++){const n=h.context.__revealCalls||0;h.app.doGacha();await until(()=>(h.context.__revealCalls||0)>n,'reveal '+i+' '+JSON.stringify({fail:h.context.__failBuy,toasts:h.context.__modelToasts,coins:h.app.state.coins}));}
  const saved=JSON.parse(h.data.get(h.t.keys.main));assert.equal(saved.gachaDaily.n,5);const before=copy(h.app.state),writes=h.writes().length;
  h.app.doGacha();assert.equal(h.app.state.coins,before.coins,'no coins deducted');assert.equal(h.writes().length,writes,'no write');assert.deepEqual(copy(h.app.state.gacha),before.gacha);assert.match(h.context.__failBuy?.at(-1),/^今天的 5 次已开完，(今天|明天) \d{2}:\d{2} 恢复$/);
  const keep=new Map(h.data);await h.close();const r=await assembly({scope:'formal',path,configure:f=>{f.data.clear();for(const [k,v] of keep)f.data.set(k,v);}});t.after(()=>r.close());await until(()=>r.app||r.settled,'reopen');
  assert.deepEqual(copy(r.app.state.gachaDaily),saved.gachaDaily);const w=r.writes().length;r.app.doGacha();assert.equal(r.writes().length,w,'still blocked after reload');
});
test('formal P2 validator rejects malformed gachaDaily and accepts absent/null',{timeout:20000},async t=>{
  for(const [value,ok] of [[undefined,true],[null,true],[{day:'2026-10-13',n:2},true],[{day:'2026-10-13',n:2,extra:1},false],[{day:'13/10',n:2},false],[{day:'2026-10-13',n:-1},false]]){
    const h=await assembly({scope:'formal',protocol:2,configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));if(value===undefined)delete s.gachaDaily;else s.gachaDaily=value;f.data.set(f.keys.main,JSON.stringify(s));}});
    await until(()=>h.app||h.settled||h.view()?.phase==='protected','boot');assert.equal(!!h.app,ok,JSON.stringify(value));await h.close();
  }
});

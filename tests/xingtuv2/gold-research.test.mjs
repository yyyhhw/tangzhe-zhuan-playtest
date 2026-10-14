// 星途 v2-B（候选）：科研成果用金币买。杨总 22:28：每个岗位升满合计 1000 亿，四岗 4000 亿，按 demo 曲线每档 ×10。
import test from 'node:test';import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {planMoon,TIER_PRICE,RESEARCH_TOTAL_PER_POST,researchSpend,SYS_KEYS} from '../../space/moon.mjs';
import {HIDDEN_RULES} from '../../space/album.mjs';
import {assembly,until} from '../wearables8/production-harness.mjs';
const fresh=(coins,lv=5)=>{const space=defaultSpace();space.lv={tech:lv,war:lv,med:lv,life:lv};return {rev:1,coins,shops:[0,1,2,3].map(()=>({open:true,lv:35})),space};};
const plan=(s,i)=>planMoon(s,i,{scope:'formal',now:1700000000000,makeId:()=>'00000000-0000-4000-8000-000000000000'});
test('合计锁死：每岗 5 件 = 1000 亿，四岗 = 4000 亿；每档 ×10（取整误差只在最后一档）',()=>{
  assert.equal(RESEARCH_TOTAL_PER_POST,1e11);assert.equal(TIER_PRICE.reduce((a,b)=>a+b,0),1e11);assert.equal(TIER_PRICE.reduce((a,b)=>a+b,0)*SYS_KEYS.length,4e11);
  assert.deepEqual(TIER_PRICE,[9000090,90000900,900009000,9000090001,90000900009]);
  for(let i=1;i<5;i++)assert(Math.abs(TIER_PRICE[i]/TIER_PRICE[i-1]-10)<1e-6);
  assert(TIER_PRICE.every(Number.isSafeInteger));
});
test('四岗全部买满：金币正好少 4000 亿，20 件全到手',()=>{
  let s=fresh(5e11);for(const k of SYS_KEYS)for(let t=1;t<=5;t++){const r=plan(s,{type:'research',sys:k,tier:t});assert(r.ok&&!r.noop,JSON.stringify(r));s=r.state;}
  assert.equal(s.coins,1e11);assert.equal(Object.keys(s.space.items).length,20);
  const again=plan(s,{type:'research',sys:'tech',tier:1});assert(again.ok&&again.noop);assert.equal(again.code,'SPACE_RESEARCH_OWNED');
});
test('钱不够、科研等级不够都拒绝；只扣金币不动别的',()=>{
  assert.equal(plan(fresh(TIER_PRICE[0]-1),{type:'research',sys:'med',tier:1}).code,'SPACE_COINS_NOT_ENOUGH');
  assert.equal(plan(fresh(1e12,2),{type:'research',sys:'med',tier:3}).code,'SPACE_RESEARCH_LV_REQUIRED');
  const s0=fresh(1e9,1),r=plan(s0,{type:'research',sys:'war',tier:1});assert(r.ok);
  const a=JSON.parse(JSON.stringify(r.state)),b=JSON.parse(JSON.stringify(s0));delete a.space;delete b.space;a.coins=b.coins;assert.deepEqual(a,b);assert.equal(r.state.coins,1e9-TIER_PRICE[0]);
});
test('researchSpend：只认新增 sys:t=1；删/改/乱写 → null（协调器拒绝）',()=>{
  assert.equal(researchSpend({items:{}},{items:{'tech:2':1,'life:5':1}}),TIER_PRICE[1]+TIER_PRICE[4]);
  assert.equal(researchSpend({items:{'tech:1':1}},{items:{}}),null);assert.equal(researchSpend({items:{}},{items:{'tech:6':1}}),null);assert.equal(researchSpend({items:{}},{items:{'tech:1':2}}),null);
  assert.equal(researchSpend({items:{}},{items:{}}),0);
});
test('月面隐藏物「旧时代的国旗」要曲率雷达（科技 3 级成果）',()=>{const s=defaultSpace();assert.equal(HIDDEN_RULES.moon(s),false);s.items['tech:3']=1;assert.equal(HIDDEN_RULES.moon(s),true);});
for(const scope of ['formal','preview'])test(scope+'：真协调器——买一件扣对金币、存档里有这件',{timeout:20000},async t=>{
  const h=await assembly({scope,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}s.coins=2e7;s.coinFrac=0;const sp=defaultSpace();s.space=sp;f.data.set(f.keys.main,JSON.stringify(s));}});
  t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');
  const m=h.context.XingTu;assert(m.open().ok);await h.click('xingtuTabShip');
  const before=h.app.state.coins;assert.equal(h.node('xingtuBuy-tech-2').disabled,true,'科研 1 级买不了 2 级');
  await h.click('xingtuBuy-tech-1');
  const v=m.view();assert.equal(v.space.items['tech:1'],1);assert(Math.abs(h.app.state.coins-(before-TIER_PRICE[0]))<1,`${h.app.state.coins} vs ${before}`);
  const saved=JSON.parse(h.writes().at(-1).value??h.writes().at(-1)[1]??'null');if(saved&&saved.coins!==undefined)assert.equal(saved.space.items['tech:1'],1);
});

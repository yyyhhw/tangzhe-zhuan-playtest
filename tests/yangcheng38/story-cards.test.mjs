// 养成-38：故事卡获得路径（盲盒 5 张 + 特殊条件 3 张带提示）与 8 种家里变化。碰存档 → 含老档迁移回归。
import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import fs from 'node:fs';
const require=createRequire(import.meta.url);
const load=p=>{const f=new URL('../../'+p,import.meta.url).pathname;delete require.cache[require.resolve(f)];return require(f);};
const HS=load('home/story-home.js');
const COND=['k_3','k_4','k_8'],BOX=['k_1','k_2','k_5','k_6','k_7'];
const opened=E=>{const s=E.newState(1);s.shops.forEach(x=>{x.open=true;x.lv=5;x.emp=1;});s.coins=1e15;s.totalEarned=1e15;return s;};
for(const p of ['economy.js','pet/game/economy.js']){
 test(p+': 3 张条件卡带提示、不进盲盒池；价格 / 超级概率 / 保底不变',()=>{
  const E=load(p);assert.deepEqual(E.STORY_COND_IDS,COND);
  for(const id of COND){const it=E.ITEM_BY_ID[id];assert.ok(it.hint&&it.cond);}
  assert.match(E.ITEM_BY_ID.k_3.hint,/圆滚滚的夜宵客/);assert.match(E.ITEM_BY_ID.k_4.hint,/晚上回家看看/);assert.match(E.ITEM_BY_ID.k_8.hint,/四家店都亮起灯/);
  const s=opened(E),rem=E.gachaRemaining(s).map(x=>x.id);for(const id of COND)assert.ok(!rem.includes(id));for(const id of BOX)assert.ok(rem.includes(id));
  const o=E.gachaOdds(s);assert.equal(o.superP,.1);assert.equal(E.gachaPrice(s),200000);s.gacha.pity=14;assert.equal(E.gachaOdds(s).superP,1);
  const t=opened(E),seen=new Set();let n=0;while(E.gachaRemaining(t).length){const r=E.gachaDraw(t,(n++*0.6180339887)%1);assert.ok(r.ok);seen.add(r.item.id);assert.equal(r.cost,200000);}
  for(const id of COND)assert.ok(!seen.has(id));assert.equal(E.gachaComplete(t),true);assert.equal(E.cardsComplete(t),false);
 });
 test(p+': 触发条件——收下夜游食神（烧烤摊）/ 夜里进家 / 四店都有员工（进家或雇到第 4 家）',()=>{
  const E=load(p),s=E.newState(1);
  assert.deepEqual(E.storyCardsDue(s,{kind:'guest',shop:1}),[]);assert.deepEqual(E.storyCardsDue(s,{kind:'guest',shop:0}),['k_3']);
  assert.deepEqual(E.storyCardsDue(s,{kind:'home',period:'day'}),[]);assert.deepEqual(E.storyCardsDue(s,{kind:'home',period:'night'}),['k_4']);
  assert.deepEqual(E.storyCardsDue(s,{kind:'hire'}),[]);
  s.shops.forEach(x=>{x.open=true;x.emp=1;});s.shops[3].emp=0;assert.deepEqual(E.storyCardsDue(s,{kind:'home',period:'day'}),[]);
  s.shops[3].emp=1;assert.deepEqual(E.storyCardsDue(s,{kind:'hire'}),['k_8']);assert.deepEqual(E.storyCardsDue(s,{kind:'home',period:'night'}),['k_4','k_8']);
 });
 test(p+': 入库不扣币、不计抽数、不动保底和每日次数；不重复；只认条件卡',()=>{
  const E=load(p),s=opened(E);s.gacha.pity=6;s.gacha.draws=9;const c=s.coins,daily=JSON.stringify(s.gachaDaily);
  const r=E.grantStoryCard(s,'k_3');assert.ok(r.ok);assert.equal(s.coins,c);assert.equal(s.gacha.draws,9);assert.equal(s.gacha.pity,6);assert.equal(JSON.stringify(s.gachaDaily),daily);
  assert.equal(E.grantStoryCard(s,'k_3').ok,false);assert.equal(s.gacha.owned.filter(x=>x==='k_3').length,1);
  assert.equal(E.grantStoryCard(s,'k_1').ok,false);assert.equal(E.grantStoryCard(s,'c_apron').ok,false);
  assert.deepEqual(E.storyCardsDue(s,{kind:'guest',shop:0}),[]);
 });
 test(p+': 集齐 8 张（5 抽 + 3 条件）仍给金牌摊主；最后一张靠条件拿到时 setDone',()=>{
  const E=load(p),s=opened(E);s.gacha.owned.push(...BOX,'k_3','k_4');const r=E.grantStoryCard(s,'k_8');assert.ok(r.ok&&r.setDone);assert.ok(E.cardsComplete(s));
 });
 test(p+': 老档迁移——已抽到的条件卡保留；老档已满足四店条件，第一次进家就得「一条街的灯」；保存→重载后不丢',()=>{
  const E=load(p);
  const old=opened(E);old.gacha.owned=['c_apron','k_3','k_4','k_1'];old.gacha.draws=4;old.v=Math.max(1,(old.v||1)-1);
  const raw=JSON.parse(JSON.stringify(old));const m=E.migrate(raw,1);const st=m.st||m;
  for(const id of ['k_3','k_4','k_1'])assert.ok(st.gacha.owned.includes(id),id);
  assert.deepEqual(E.storyCardsDue(st,{kind:'home',period:'day'}),['k_8']);
  assert.ok(E.grantStoryCard(st,'k_8').ok);
  const back=E.migrate(JSON.parse(JSON.stringify(st)),1);const st2=back.st||back;assert.ok(st2.gacha.owned.includes('k_8'));assert.equal(new Set(st2.gacha.owned).size,st2.gacha.owned.length);
  assert.deepEqual(E.storyCardsDue(st2,{kind:'home',period:'night'}),[]);
  const fresh=E.migrate(JSON.parse(JSON.stringify(E.newState(1))),1);const f=fresh.st||fresh;assert.deepEqual(E.storyCardsDue(f,{kind:'home',period:'day'}),[]);
 });
}
test('preview 渠道不改（没有条件卡钩子，盲盒池照旧）',()=>{const E=load('preview/economy.js');assert.equal(E.STORY_COND_IDS,undefined);});
test('家里变化：8 张卡各自的台词条件，每句 ≤16 字',()=>{
  const all=JSON.stringify(HS.LINES).match(/"[^"]*[\u4e00-\u9fff][^"]*"/g).map(x=>JSON.parse(x));for(const l of all)assert.ok([...l].length<=16,l);
  const C=(o)=>({owned:new Set(['k_1','k_2','k_3','k_4','k_5','k_6','k_7','k_8']),placed:[],hasSeat:true,hasTable:true,...o});
  assert.deepEqual(HS.linesFor(C({who:'c77',kind:'read',period:'morning'})),HS.LINES.k1);
  assert.deepEqual(HS.linesFor(C({who:'pearl',kind:'read',period:'morning'})),[]);
  assert.ok(HS.linesFor(C({who:'c77',kind:'sit',period:'day'})).includes('凉茶先放稳，辣的事等会儿再说。'));
  assert.deepEqual(HS.linesFor(C({who:'c77',kind:null,period:'day'})),['质检老师又来巡店了。']);
  assert.ok(HS.linesFor(C({who:'c77',kind:null,period:'day',placed:['furn_pearl_tea_stool']})).includes('那把竹椅不能吃，真的。'));
  assert.ok(HS.linesFor(C({who:'otaku',kind:'lie',period:'night'})).includes('这一格留白，给月亮。'));
  assert.ok(HS.linesFor(C({who:'rocket',kind:null,period:'night',hasSeat:false})).includes('站立观测，月亮信号良好。'));
  assert.ok(!HS.linesFor(C({who:'rocket',kind:null,period:'night'})).includes('站立观测，月亮信号良好。'));
  assert.deepEqual(HS.linesFor(C({who:'pearl',kind:'eat',period:'day'})),HS.LINES.k5);
  assert.deepEqual(HS.linesFor(C({who:'pearl',kind:null,period:'day',hasTable:false})),['没桌子，就在手心里数。']);
  assert.deepEqual(HS.linesFor(C({who:'otaku',kind:'lie',period:'day'})),HS.LINES.k6);
  assert.deepEqual(HS.linesFor(C({who:'otaku',kind:'rug',period:'day'})),['坐着看也行，名场面不挑地方。']);
  assert.deepEqual(HS.linesFor(C({who:'pearl',kind:'read',period:'dusk'})),['四盏灯，一盏都不能少。']);
  assert.deepEqual(HS.linesFor({owned:[],who:'c77',kind:null,period:'night',placed:[]}),[]);
  const sc=HS.scene(C({who:'c77',period:'night',kind:'sit',posed:true}));assert.deepEqual(sc,{panda:true,moon:true,street:false,tea:true});
  assert.equal(HS.scene(C({who:'pearl',period:'dusk'})).panda,false);assert.equal(HS.scene(C({who:'pearl',period:'dusk'})).street,true);
  assert.equal(HS.countdownDue({owned:['k_7'],who:'rocket',joined:false}),false);assert.equal(HS.countdownDue({owned:['k_7'],who:'rocket',joined:true}),true);assert.equal(HS.countdownDue({owned:['k_7'],who:'rocket',joined:true,done:true}),false);
  assert.equal(HS.STYLE_LIVE,false);assert.equal(HS.pick(['a'],['b'],()=>.1)[0],'b');assert.equal(HS.pick(['a'],['b'],()=>.9)[0],'a');assert.equal(HS.pick(['a'],[],()=>.1)[0],'a');
});
for(const p of ['app.js','pet/game/app.js'])test(p+': 接线——收下夜游食神 / 进家 / 雇人入库，提示 toast，图鉴提示，家里画面',()=>{
  const s=fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  for(const x of ["storyGrant({ kind:'guest', shop })","storyGrant({ kind:'home', period:storyPeriod() })","storyGrant({ kind:'hire' })","'新故事卡「' + E.ITEM_BY_ID[id].name + '」，去图鉴看看。'","'提示：' + c.hint","${storySceneHTML(id)}","${storyTeaHTML(id)}","storyCountdown(arg)","HS.pick(pool, HS.linesFor(storyCtx(id, kind))"])assert.ok(s.includes(x),x);
});
// 熊大 r2 复验 6 项（fcb91c1）：k5 无桌坐着必说手心句；k6 沙发躺；pick 强制
test('r2: k5 无桌坐着说「没桌子，就在手心里数。」且必说；k6 沙发当床',()=>{
  const owned=new Set(['k_5','k_6']);
  for(const kind of [null,'sit','rug']){const l=HS.linesFor({owned,who:'pearl',kind,hasTable:false});assert.deepEqual([...l],['没桌子，就在手心里数。']);assert.equal(HS.pick(['普通'],l,()=>.99),l);}
  assert.equal(HS.linesFor({owned,who:'pearl',kind:'sit',hasTable:true}).includes('没桌子，就在手心里数。'),false);
  assert.equal(HS.lieOn({owned,who:'otaku'},'furn_sofa'),true);assert.equal(HS.lieOn({owned,who:'otaku'},'furn_otaku_modular_couch'),true);
  assert.equal(HS.lieOn({owned,who:'otaku'},'furn_otaku_gaming_chair'),false);assert.equal(HS.lieOn({owned:new Set(),who:'otaku'},'furn_sofa'),false);assert.equal(HS.lieOn({owned,who:'pearl'},'furn_sofa'),false);
  assert.ok(HS.linesFor({owned,who:'otaku',kind:'lie'}).includes('这一格，名场面。'));
});
test('r2: app 源码——k7 不缩短停留、气球按主人、decor 不说、熊猫读竹家具坐标（root+pet 同步）',async()=>{
  const fs=await import('node:fs');
  for(const f of ['app.js','pet/game/app.js']){const s=fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8');
    for(const x of ['Math.max(ac.autoHold || 0, clock + 7)','storyBalloonWho === id',"homeMode !== 'live' || tab !== 'home'",'storyPandaFloorHTML(id)','function storyBambooSpot(id)','HS.lieOn'])assert.ok(s.includes(x),f+' '+x);
    assert.ok(!s.includes('ac.autoHold = clock + 7;'),f);}
});

// 星途-114：真实入口/协调器/overlay（Node/VM 模型，不是浏览器）——返航报告新剧情卡块、册子页签、还没开航、抢锁/脏内存零写。
import test from 'node:test';import assert from 'node:assert/strict';
import {assembly,until} from '../wearables8/production-harness.mjs';
const opts={timeout:20000};
async function ready(t,{scope='formal',path}={}){const h=await assembly({scope,path,protocol:2,mode:'bootstrap',configure:f=>{const s=JSON.parse(f.data.get(f.keys.main));for(const x of s.shops){x.open=true;x.lv=35;}f.data.set(f.keys.main,JSON.stringify(s));}});t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');assert(h.app&&h.context.XingTu,JSON.stringify(h.errors));let time=1700000001000;h.context.Date.now=()=>time;return {...h,setTime:v=>time=v,moon:h.context.XingTu};}
const txt=(h,id)=>h.node(id)?.textContent;
for(const [scope,path] of [['formal',undefined],['formal','/pet/game/'],['preview',undefined]])test(`${scope}${path||''}: report shows 新剧情卡 before 收下; claim writes card once; 册子 shows 1/25, moon row, others 还没开航`,opts,async t=>{
 const h=await ready(t,{scope,path});h.moon.open();assert(h.node('xingtuDepart').onclick().ok);h.setTime(1700000601000);h.moon.refresh();assert(h.node('xingtuChoiceB').onclick().ok);
 assert.equal(txt(h,'xingtuNewCardTag'),'新剧情卡');assert.equal(txt(h,'xingtuNewCardTitle'),'月面第一串');assert.equal(txt(h,'xingtuAlbumTip'),'放进星途册子了');assert.equal(h.node('xingtuNewHidden'),null,'radar hidden not obtainable yet');
 assert.equal(h.app.state.space.cards.moon??0,0,'nothing before 收下');const claim=h.node('xingtuClaim');assert(claim.onclick().ok);assert.equal(h.app.state.space.cards.moon,1);const w=h.writes().length;claim.onclick();assert.equal(h.writes().length,w);assert.equal(h.app.state.space.cards.moon,1);
 assert.match(txt(h,'xingtuReport'),/剧情卡「月面第一串」/);
 const w2=h.writes().length;h.node('xingtuTabAlbum').onclick();assert.equal(h.writes().length,w2,'album is read-only');
 assert.equal(txt(h,'xingtuAlbumHead'),'1/25 剧情卡   0/9 隐藏物   0/7 外星来客');assert.equal(txt(h,'xingtuCard-moon-1'),'月面第一串');assert.match(txt(h,'xingtuCard-moon-2'),/^第 2 张/);assert.notEqual(txt(h,'xingtuCard-moon-2'),'月球车代驾');
 assert(h.node('xingtuRow-station'));assert(h.node('xingtuRow-signal'));// 星途 v2-D：9 条航线全开航，没有「还没开航」的行了
 h.node('xingtuHid-moon').onclick();assert.equal(txt(h,'xingtuHidDetail'),'线索：带着雷达去，看看月坑背面。');h.node('xingtuHid-signal').onclick();assert.equal(txt(h,'xingtuHidDetail'),'线索：信封上写着：给那条街的四个人。');
 h.node('xingtuCard-moon-1').onclick();assert.equal(txt(h,'xingtuCardDetail'),'月面第一串：77 在月坑边支起烤架：“低重力，孜然撒得特别匀。”');
 
 h.node('xingtuTabVoyage').onclick();assert(h.node('xingtuDepart'));
 // 第二趟：不再显示「放进星途册子了」，发第 2 张
 assert(h.node('xingtuDepart').onclick().ok);h.setTime(1700001300000);h.moon.refresh();assert(h.node('xingtuChoiceA').onclick().ok);assert.equal(txt(h,'xingtuNewCardTitle'),'月球车代驾');assert.equal(h.node('xingtuAlbumTip'),null);assert(h.node('xingtuClaim').onclick().ok);assert.equal(h.app.state.space.cards.moon,2);
});
for(const scope of ['formal','preview'])test(`${scope}: save-lock contention on the report — pending save / dirty memory / stolen lock → zero writes, no card`,opts,async t=>{
 const h=await ready(t,{scope});h.moon.open();assert(h.node('xingtuDepart').onclick().ok);h.setTime(1700000601000);h.moon.refresh();assert(h.node('xingtuChoiceB').onclick().ok);
 const claim=h.node('xingtuClaim').onclick,raw=h.data.get(h.t.keys.main),n=h.writes().length;
 h.app.persist.pending={operation:'fixture'};assert(!claim().ok);delete h.app.persist.pending;assert.equal(h.writes().length,n);
 h.stealLock();await new Promise(r=>setImmediate(r));assert(!claim().ok);assert.equal(h.writes().length,n);assert.equal(h.data.get(h.t.keys.main),raw);assert.equal(JSON.parse(raw).space.cards.moon??0,0);
});

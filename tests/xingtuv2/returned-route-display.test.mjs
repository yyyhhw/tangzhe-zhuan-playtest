import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSpace} from '../../space/domain.mjs';
import {planMoon} from '../../space/moon.mjs';
import {ROUTE_BY_ID} from '../../space/album.mjs';
import {assembly,until} from '../wearables8/production-harness.mjs';

const T=1700000000000,NOW=T+4_000_000;
const destinations=['station','mars','moon'];
for(const [scope,path] of [['formal','/'],['formal','/pet/game/'],['preview','/preview/']]){
 for(const route of destinations)test(`${path} ${route} 领完：上趟报告和下次月面出航明确区分，显示不写档`,async t=>{
  const h=await assembly({scope,path,protocol:2,mode:'bootstrap',clockNow:NOW,configure:f=>{
   let s=JSON.parse(f.data.get(f.keys.main));for(const shop of s.shops){shop.open=true;shop.lv=35;}
   s.space=defaultSpace();s.space.lv={tech:5,war:5,med:5,life:5};s.space.pts=120;
   const run=(intent,now)=>{const r=planMoon(s,intent,{scope,now,makeId:()=>'00000000-0000-4000-8000-000000000001'});assert(r.ok,r.code);s=r.state;};
   run({type:'depart',route},T);const id=s.space.voyage.voyageId,arrival=T+s.space.voyage.dur;
   run({type:'choose',voyageId:id,choice:'b'},arrival);run({type:'claim',voyageId:id},arrival+1);
   s.lastSeen=NOW;s.maxSeen=NOW;
   f.data.set(f.keys.main,JSON.stringify(s));
  }});
  t.after(()=>h.close());await until(()=>h.app&&h.context.XingTu||h.errors.length||h.bootError,'moon host');
  const host=h.context.XingTu;assert.equal(host.open().ok,true,JSON.stringify(h.app.xingtuContext()));
  const before=JSON.stringify(h.app.state),writes=h.writes().length,view=host.view();
  assert.equal(view.phase,'report');assert.equal(view.voyage.route,route);assert.equal(view.space.visits[route],1);
  assert.ok(h.node('xingtuRuleset').textContent.startsWith(`上趟：${ROUTE_BY_ID[route].name} · `));
  assert.ok(h.node('xingtuRuleset').textContent.endsWith('返航报告已收下'));
  assert.equal(h.node('xingtuNextRoute').textContent,'下次出航：月面基地 · 其他目的地请到星图选择');
  assert.ok(h.node('xingtuStatus').children[0].textContent.includes(`月面基地累计往返次数：${route==='moon'?1:0}`));
  assert.equal(h.node('xingtuDepart').textContent,'出航月面基地');
  // The completed voyage stays completed on every tab, especially Ship (129 independent QA).
  const completedHeading=h.node('xingtuRuleset').textContent;
  for(const tab of ['xingtuTabShip','xingtuTabMap','xingtuTabAlbum','xingtuTabVoyage']){
   await h.click(tab);
   assert.equal(h.node('xingtuRuleset').textContent,completedHeading,tab);
   assert.doesNotMatch(h.node('xingtuRuleset').textContent,/这趟|看完再领探索点/);
  }
  host.refresh();host.close();host.open();
  assert.equal(JSON.stringify(h.app.state),before);assert.equal(h.writes().length,writes);
  // Existing button still departs for moon; earlier route's receipt, visits and rewards stay intact.
  const previous=host.view();await h.click('xingtuDepart');
  const next=host.view();assert.equal(next.phase,'flying');assert.equal(next.voyage.route,'moon');
  assert.equal(JSON.stringify(next.space.visits),JSON.stringify(previous.space.visits));
  assert.equal(next.space.pts,previous.space.pts);assert.equal(JSON.stringify(next.receipt),JSON.stringify(previous.receipt));
  assert.ok(h.node('xingtuRuleset').textContent.startsWith('这趟：月面基地 · 10 分钟'));
 });
}

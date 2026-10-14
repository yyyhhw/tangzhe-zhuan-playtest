import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
import {prepareSecondEightCatalog} from '../../collectibles/wearables18-catalog.mjs';
import {prepareDecor6Catalog} from '../../collectibles/decor6-catalog.mjs';
import {prepareBox200Catalog} from '../../collectibles/box200-catalog.mjs';
import {HIDDEN_GOALS,dueHidden,installHiddenGoals,toastText} from '../../collectibles/box200-hidden.mjs';
import {BOX200_COPY} from '../../collectibles/box200-copy.mjs';
import {wrapWearables} from '../../collectibles/box200-display.mjs';
import second from '../../candidates/blindbox18/display.mjs';
const require=createRequire(import.meta.url),econ=new URL('../../economy.js',import.meta.url).pathname;
const H6=['c_moon_night_robe','h_golden_skewer_crown','h_pearl_halo','d_street_neon_arch','d_comet_jar','d_manga_golden_page'];
function fresh(){delete require.cache[require.resolve(econ)];const E=require(econ);prepareEightWearableCatalog(E).setActive(true);prepareSecondEightCatalog(E).setActive(true);prepareDecor6Catalog(E).setActive(true);prepareBox200Catalog(E).setActive(true);return E;}
function st(E){const s=E.newState(Date.UTC(2026,9,14,0));s.shops.forEach(x=>{x.open=true;x.emp=1;x.lv=10;});s.coins=1e15;return s;}
// Fake app mirroring window.__tzz: atomic = apply + persist (counted), optional failure.
function fakeApp(E,s,{fail=false}={}){const app={E,state:s,saveBlocked:false,saves:0,toasts:[],renders:0,toast:m=>app.toasts.push(m),renderTab:()=>app.renders++,
  atomic(fn){const before=JSON.stringify(app.state);const r=fn();if(fail){app.state=JSON.parse(before);return {ok:false,why:'saveFailed'};}app.saves++;return r;}};return app;}
const sync={setInterval:null,setTimeout:(f)=>f(),doc:{hidden:false}};
test('6 hidden items are live (hidden, not in pool), each has unlock + toast copy (王大妈 1791954091), comet hint notes 四家店 Lv35',()=>{
  const E=fresh();assert.deepEqual(Object.keys(HIDDEN_GOALS),H6);
  for(const id of H6){const it=E.ITEM_BY_ID[id];assert(it&&it.hidden===true&&it.box200,id);assert(!E.REGULAR_ITEMS.includes(it));assert(BOX200_COPY[id].unlock&&BOX200_COPY[id].toast,id);assert(!/1%/.test(BOX200_COPY[id].unlock));assert(toastText(id).includes(it.name));assert(BOX200_COPY[id].toast.length<=26,id);}
  assert.equal(BOX200_COPY.d_comet_jar.unlock,'星途去月球往返 10 次');assert(BOX200_COPY.d_comet_jar.hint.endsWith('（四家店 Lv35 开放）'));
  assert.equal(BOX200_COPY.h_golden_skewer_crown.toast,'烧烤摊到 Lv50 了，送你隐藏款「金串串冠」');
});
test('goals: exact thresholds',()=>{
  const E=fresh(),s=st(E);assert.deepEqual(dueHidden(E,s),[]);
  s.shops.forEach(x=>x.lv=34);assert.deepEqual(dueHidden(E,s),[]);s.shops.forEach(x=>x.lv=35);assert.deepEqual(dueHidden(E,s),['c_moon_night_robe']);
  s.shops[0].lv=49;s.shops[1].lv=50;s.shops[2].lv=50;assert.deepEqual(dueHidden(E,s),['c_moon_night_robe','h_pearl_halo','d_manga_golden_page']);s.shops[0].lv=50;assert(dueHidden(E,s).includes('h_golden_skewer_crown'));
  const t=st(E);t.space={visits:{moon:9}};assert(!dueHidden(E,t).includes('d_comet_jar'));t.space.visits.moon=10;assert.deepEqual(dueHidden(E,t),['d_comet_jar']);
  const u=st(E),reg=E.ITEMS.filter(x=>!x.hidden).map(x=>x.id);u.gacha.owned=reg.slice(0,59).concat(['d_opening_photo']);assert(!dueHidden(E,u).includes('d_street_neon_arch'),'hidden do not count');
  u.gacha.owned.push(reg[59]);assert.deepEqual(dueHidden(E,u),['d_street_neon_arch']);
});
test('grant: on load for old saves already past goals, one save, toast each once in order, no draws/daily/pity/coins touched; idempotent',()=>{
  const E=fresh(),s=st(E);s.shops.forEach(x=>x.lv=60);s.space={visits:{moon:12}};s.gacha.draws=3;s.gacha.pity=2;const coins=s.coins,daily=JSON.stringify(E.gachaDailyLeft?E.gachaDailyLeft(s,Date.UTC(2026,9,14,0)):null);
  const app=fakeApp(E,s),h=installHiddenGoals(app,sync);
  assert.deepEqual(h.granted,['c_moon_night_robe','h_golden_skewer_crown','h_pearl_halo','d_comet_jar','d_manga_golden_page']);assert.equal(app.saves,1);
  assert.deepEqual(app.toasts,h.granted.map(id=>BOX200_COPY[id].toast));
  assert.equal(s.gacha.draws,3);assert.equal(s.gacha.pity,2);assert.equal(s.coins,coins);assert.equal(JSON.stringify(E.gachaDailyLeft?E.gachaDailyLeft(s,Date.UTC(2026,9,14,0)):null),daily);
  assert.deepEqual(h.check(),[]);assert.deepEqual(h.check(),[]);assert.equal(app.saves,1);assert.equal(app.toasts.length,5);
  assert.equal(new Set(s.gacha.owned).size,s.gacha.owned.length);assert.deepEqual(E.validState(s),[]);
});
test('grant on progress: reaching a goal later is picked up by the next check; save failure grants nothing and backs off',()=>{
  const E=fresh(),s=st(E),app=fakeApp(E,s),h=installHiddenGoals(app,sync);assert.deepEqual(h.granted,[]);assert.equal(app.saves,0);
  s.shops[1].lv=50;assert.deepEqual(h.check(),['h_pearl_halo']);assert(s.gacha.owned.includes('h_pearl_halo'));assert.deepEqual(app.toasts,['奶茶店到 Lv50 了，送你隐藏款「珍珠光环」']);
  const E2=fresh(),s2=st(E2);s2.shops[2].lv=50;const bad=fakeApp(E2,s2,{fail:true}),h2=installHiddenGoals(bad,sync);assert.deepEqual(h2.granted,[]);assert(!bad.state.gacha.owned.includes('d_manga_golden_page'));assert.deepEqual(bad.toasts,[]);
  const saved=fakeApp(E2,s2);saved.saveBlocked=true;assert.deepEqual(installHiddenGoals(saved,sync).granted,[]);
});
test('daily 5 opens unaffected by a grant; box opens never award box200 hidden',()=>{
  const E=fresh(),s=st(E),t0=Date.UTC(2026,9,13,22);for(let i=0;i<4;i++)assert(E.gachaDraw(s,(i*.17+.31)%1,undefined,t0+i).ok);
  s.shops.forEach(x=>x.lv=35);const app=fakeApp(E,s);installHiddenGoals(app,sync);assert(s.gacha.owned.includes('c_moon_night_robe'));
  assert(E.gachaDraw(s,.5,undefined,t0+5).ok,'5th open still available');const r=E.gachaDraw(s,.5,undefined,t0+6);assert(!r.ok&&r.dailyLimit);
  for(const id of s.gacha.owned)if(H6.includes(id))assert.equal(id,'c_moon_night_robe');
});
test('collection: unearned box200 hidden show "{unlock} 就送"; earned show name; no-art items render fallback slot',()=>{
  const E=fresh(),W=wrapWearables(second),s=st(E);
  assert(W.catalogHTML(E,s,'h_pearl_halo').includes('奶茶店升到 Lv50 就送'));assert(W.catalogHTML(E,s,'c_moon_night_robe').includes('四家店都升到 Lv35 就送'));
  s.gacha.owned.push('h_pearl_halo');const html=W.catalogHTML(E,s,'h_pearl_halo');assert(html.includes('珍珠光环'));assert(html.includes('图示暂不可用'));
  assert(!W.catalogHTML(E,s,'h_chili_cap').includes('就送'));
});

// 文案-115：toast 图标按情绪分。四份 toast 代码逐字一致；只多一个 class，不动优先级/队列/role。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const APPS=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'],CSS=['style.css','pet/game/style.css','preview/style.css','preview/pet/game/style.css'];
const block=t=>{const a=t.indexOf('let toastTimer = 0'),b=t.indexOf("window.addEventListener('pageshow', toastResume);");assert(a>0&&b>a);return t.slice(a,b);};
test('the 6 hidden-item grant copies in box200-copy are exactly the asserted ones',()=>{const t=source('collectibles/box200-copy.mjs');const got=[...t.matchAll(/"toast": "([^"]*送你隐藏款[^"]*)"/g)].map(m=>m[1]);assert.deepEqual(got.sort(),[...HIDDEN6].sort());});
test('four toast code copies are byte-identical',()=>{const ref=block(source(APPS[0]));for(const f of APPS.slice(1))assert.equal(block(source(f)),ref,f);});
test('four stylesheets: red「!」stays default, gold check only for .toast-good',()=>{for(const f of CSS){const s=source(f);assert(s.includes('#toast::before{content:"!"'),f);assert(/#toast\.toast-good::before\{content:"✓";background:var\(--yellow\)/.test(s),f);}});
function harness(f){
 const cls=new Set(),attrs={},el={classList:{toggle:(k,on)=>on?cls.add(k):cls.delete(k),remove:k=>cls.delete(k),add:k=>cls.add(k),contains:k=>cls.has(k)},setAttribute:(k,v)=>attrs[k]=v,style:{},textContent:'',offsetWidth:1};
 const c=vm.createContext({document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},performance:{now:()=>0},Date,setTimeout:()=>1,clearTimeout(){},toastEl:el,Math});
 vm.runInContext('let toastEl=globalThis.toastEl;'+block(source(f)).replace(/^const toastEl[^\n]*\n/m,'')+'\nglobalThis.t={toast,toastMood,get q(){return toastQueue},get active(){return toastActive}};',c);
 return {show(msg,ms,pl,kind){c.t.toast(msg,ms,pl,kind);return {good:cls.has('toast-good'),role:attrs.role,text:el.textContent};},t:c.t};
}
// 115 FAIL→已修：6 条隐藏款发放 toast（collectibles/box200-copy.mjs）必须是金色对勾
const HIDDEN6=['四家店都到 Lv35 了，送你隐藏款「月夜摊主袍」','烧烤摊到 Lv50 了，送你隐藏款「金串串冠」','奶茶店到 Lv50 了，送你隐藏款「珍珠光环」','盲盒收集满 60 件，送你隐藏款「街口灯拱门」','第 10 次从月球回来，送你隐藏款「彗星玻璃罐」','漫画书店到 Lv50 了，送你隐藏款「金色原稿」'];
const GOOD=['到账 +1.2万','双倍到账 +3万（金币已到上限，多出的没进账）','奶茶 团单收入 +500','已领取：开业合照','漫画杯套：Lv50 分镜特效 + 小红包 1万','奶茶店 Lv50！收益 ×8','宠物安排已保存','已摆出：四家店共用，开店后可见','操作完成'];
const BAD=['金币不够，躺一会儿再来','保存失败：没有跳转，请稍后再试','存档异常（只读模式）：买卖、升级都暂停，原存档保留','离线收益数据异常，这一笔没有入账（余额不变）','这位 CEO 还没加入','此 QA 入口未接入，已阻止跳转到真实存档页面','检测到手机时间被往回调，这段时间不发离线收益','房间放不下了：先收回点东西','存档已保护，请刷新后重试'];
for(const f of APPS)test(f+': payouts/rewards/completions gold ✓; errors/blocked/not-enough keep red「!」; role & priority unchanged',()=>{
 for(const m of GOOD){const h=harness(f),r=h.show(m);assert.equal(r.good,true,m);assert.equal(r.role,'status',m);}
 for(const m of HIDDEN6){const h=harness(f),r=h.show(m,1900,'header');assert.equal(r.good,true,'hidden grant gold ✓: '+m);}
 for(const m of BAD){const h=harness(f),r=h.show(m);assert.equal(r.good,false,m);}
 const h=harness(f);assert.equal(h.show('保存失败',2800).role,'alert');assert.equal(h.show('到账 +1').text,'保存失败','error still holds over payout (queue unchanged)');assert.equal(h.t.q.length,1);
 const e=harness(f);assert.equal(e.show('已领取：X',1900,'','error').good,false,'explicit error kind never gold');
 const s=harness(f);s.show('到账 +1');assert.equal(s.show('金币不够').good,false,'class resets between toasts');
});

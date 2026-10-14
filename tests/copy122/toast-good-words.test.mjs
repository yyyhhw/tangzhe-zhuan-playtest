// 文案-122：按文案-118 清单，17 条好消息 toast 改成金色对勾——只在 TOAST_GOOD 末尾加词；四份逐字一致，不改调用点/优先级。
// 「撤销了一步」从 115 的 BAD 样例移到这里的 GOOD（118 清单第 12 条，杨总目标：文案人性化）。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const APPS=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'];
const block=t=>{const a=t.indexOf('let toastTimer = 0'),b=t.indexOf("window.addEventListener('pageshow', toastResume);");assert(a>0&&b>a);return t.slice(a,b);};
function harness(f){
 const cls=new Set(),attrs={},el={classList:{toggle:(k,on)=>on?cls.add(k):cls.delete(k),remove:k=>cls.delete(k),add:k=>cls.add(k),contains:k=>cls.has(k)},setAttribute:(k,v)=>attrs[k]=v,style:{},textContent:'',offsetWidth:1};
 const c=vm.createContext({document:{hidden:false,addEventListener(){}},window:{addEventListener(){}},performance:{now:()=>0},Date,setTimeout:()=>1,clearTimeout(){},toastEl:el,Math});
 vm.runInContext('let toastEl=globalThis.toastEl;'+block(source(f)).replace(/^const toastEl[^\n]*\n/m,'')+'\nglobalThis.t={toast,toastMood,get q(){return toastQueue},get active(){return toastActive}};',c);
 return {show(msg,ms,pl,kind){c.t.toast(msg,ms,pl,kind);return {good:cls.has('toast-good'),role:attrs.role,text:el.textContent};},t:c.t};
}
// 118 清单的 17 条好消息（文字按代码里拼好的样子）
const GOOD17=['奶茶店 开张啦！','雇到 阿炭！开始自动赚钱','招财猫 已进公共仓库（仓库 3 件）','77 搬进小公寓啦！6×5 格',
 '珍珠喷泉：连续爆单 20 秒！','人造太阳：超频 30 秒！','次元传送门：漫画角色客串，大订单 +1.2万',
 '烧烤来了「夜宵大哥」','奶茶来了特殊客人「熊猫」','77 已调任（旧岗位收益已结清），全街每秒 1,234','77 交换任职（旧岗位收益已结清），全街每秒 1,234',
 '撤销了一步','转好了（挪了一点才放得下）','招财猫 收回仓库','已从四家店收起','宠物跑出来了：屋里有空地了','存档已升级到 v12（新盲盒 + CEO 穿搭，收藏都保留）'];
// 容易撞词的坏消息/提示：必须还是红「!」
const STILL_RED=['请收起或挪开家具','撤销没有生效','开张没有生效，金币已退回','雇人没有生效，金币已退回','房间放不下了：先收回点东西','金币不够，躺一会儿再来','保存失败：没有跳转，请稍后再试','这位 CEO 还没加入','检测到手机时间被往回调，这段时间不发离线收益',
 // 返修（熊大 20:21）：否定句不能因「完成」判金；来了/搬进/雇到 收窄后，不带成功短语的句子不变金
 '没有完成','这次没有完成，下次再来','还没完成','任务未完成','没完成就走了',
 '瞌睡来了……','客人来了又走了','搬进去之前先收起家具','雇到人之前要先开张'];
for(const f of APPS)test(f+': 118 清单 17 条好消息金色对勾，撞词坏消息仍红「!」',()=>{
 for(const m of GOOD17){const h=harness(f),r=h.show(m);assert.equal(r.good,true,m);}
 for(const m of STILL_RED){const h=harness(f),r=h.show(m);assert.equal(r.good,false,m);}
 const e=harness(f);assert.equal(e.show('奶茶店 开张啦！',1900,'','error').good,false,'explicit error kind never gold');
});
test('four TOAST_GOOD lines byte-identical and end with the 118 words',()=>{const re=/^const TOAST_GOOD = .*$/m;const ref=source(APPS[0]).match(re)[0];assert(ref.endsWith('|收回仓库|已从四家店收起|跑出来了|存档已升级/;'));for(const f of APPS.slice(1))assert.equal(source(f).match(re)[0],ref,f);});
test('四份 TOAST_BAD 逐字一致，并且认否定句（返修）',()=>{const re=/^const TOAST_BAD = .*$/m;const ref=source(APPS[0]).match(re)[0];assert(/没有\|没完成\|未完成\/;$/.test(ref),ref);for(const f of APPS.slice(1))assert.equal(source(f).match(re)[0],ref,f);});

// 文案-124：宠物兜底失败提示改成「这次没办成…」，四份一致，toast 判定走 BAD（不金）。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const FILES=['app.js','pet/game/app.js','preview/app.js','preview/pet/game/app.js'],MSG='这次没办成，宠物和金币都没变，稍后再试';
const re=(s,n)=>{const l=s.split('\n').find(x=>x.startsWith('const '+n+' = /'));assert(l,n);return [l,new RegExp(l.slice(l.indexOf('/')+1,l.lastIndexOf('/')))];};
test('四份新文案在位、旧兜底「没有完成」移除、正则逐字一致',()=>{const lines=FILES.map(f=>{const s=fs.readFileSync(f,'utf8');assert(s.includes(`'${MSG}'`),f);assert(!s.includes("'没有完成'"),f);return re(s,'TOAST_GOOD')[0]+re(s,'TOAST_BAD')[0];});for(const l of lines)assert.equal(l,lines[0]);});
test('「没办成」不判金（走 alert）',()=>{for(const f of FILES){const s=fs.readFileSync(f,'utf8'),[,G]=re(s,'TOAST_GOOD'),[,B]=re(s,'TOAST_BAD');assert.equal(G.test(MSG)&&!B.test(MSG),false,f);}});

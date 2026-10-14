// 星途-04 第7条（v2-A 候选）：标题「星途」、副标题跟当前航线、飞行终点跟航线
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {moonArt} from '../../space/art.mjs';
const ov=fs.readFileSync(new URL('../../space/overlay.mjs',import.meta.url),'utf8');
test('标题只写「星途」，不再写死月面',()=>{assert(ov.includes("node('h2',null,'星途')"));assert(!ov.includes('星途 · 月面基地'));assert(!ov.includes('每次 10 分钟'));});
test('副标题按航线：这趟：<航线> · <航程>',()=>{assert(ov.includes('这趟：${ROUTE_BY_ID[rid]?.name'));assert(ov.includes('ROUTE_TIME[rid]'));});
test('飞行图终点跟航线',()=>{const s=moonArt(.5,'火星峡谷');assert(s.includes('>火星峡谷</text>'));assert(s.includes('飞船往返火星峡谷'));assert(!s.includes('月面基地'));
 assert(moonArt(0).includes('>月面基地</text>'));assert(ov.includes('moonArt(1,RN(view))'));assert(!moonArt(0,'<x>').includes('<x>'));});

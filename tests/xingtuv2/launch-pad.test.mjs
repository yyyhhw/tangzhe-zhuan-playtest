// 星途 v2-2：发射台入口画面（demo renderStreet）。只加画面：文案、按钮、解锁条件不变；SVG defs 自带且加 xp- 前缀，不和页面别的 id 撞。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
for(const p of ['app.js','pet/game/app.js'])test(p+'：发射台画面在入口卡里，原文案和按钮不变',()=>{
  const s=fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');const m=s.match(/const XINGTU_PAD = (".*");\n/);assert(m);const svg=JSON.parse(m[1]);
  for(const id of svg.matchAll(/id="([\w-]+)"/g))assert(id[1].startsWith('xp-'),id[1]);
  for(const r of svg.matchAll(/url\(#([\w-]+)\)|href="#([\w-]+)"/g)){const id=r[1]||r[2];assert(svg.includes(`id="${id}"`),id);}
  assert(svg.includes('科技公司 · 发射台'));
  const card=s.slice(s.indexOf('function xingtuCard(i)'),s.indexOf('function ceoPost'));
  assert(card.includes('${XINGTU_PAD}'));assert(card.includes('星途 · 发射台'));assert(card.includes('data-act="xingtu"'));assert(card.includes("state.shops.every(s=>!!s.open&&s.lv>=35)"));
});

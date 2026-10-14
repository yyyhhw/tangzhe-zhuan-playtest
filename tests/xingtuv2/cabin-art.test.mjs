// 熊大舱室插画首批（xiongda/xt05-cabin-art f6e9338）：tech/war/med/life → bridge/gun/medical/kitchen；只请求已交付的级别，其余继续 SVG。
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {CABIN_FILE,CABIN_LEVELS,cabinArtPath} from '../../space/xingtu-views.mjs';
test('映射与路径：已交付的级别都在、没交付的不出 URL',()=>{
  assert.deepEqual(CABIN_FILE,{tech:'bridge',war:'gun',med:'medical',life:'kitchen'});
  for(const k of Object.keys(CABIN_FILE))for(let lv=1;lv<=5;lv++){const p=cabinArtPath(k,lv);
    if(CABIN_LEVELS[k].includes(lv)){assert.equal(p,`../art/xingtu-cabins/${CABIN_FILE[k]}-${lv}.webp`);assert(fs.existsSync(new URL('../../space/'+p,import.meta.url)),p);}
    else assert.equal(p,null,`${k}-${lv} 没交付，不该发请求`);}
  // manifest 里每张交付的图都被接上
  const m=JSON.parse(fs.readFileSync(new URL('../../art/xingtu-cabins/manifest.json',import.meta.url)));
  for(const x of m){const g=x.path.match(/(bridge|gun|medical|kitchen)-(\d)\.webp$/);if(!g)continue;const k=Object.keys(CABIN_FILE).find(k=>CABIN_FILE[k]===g[1]);assert(CABIN_LEVELS[k].includes(Number(g[2])),x.path);}
});

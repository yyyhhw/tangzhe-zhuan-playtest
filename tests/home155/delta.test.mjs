// 家宅-155：四份 app.js 都带同一行修复；exact delta 对缺失/重复/改动都报错（负例），不是泛化归一
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {withoutHome155Delta,HOME155_FILES,HOME155_OLD,HOME155_NEW} from './protection-delta.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('four app.js carry the identical 家宅-155 line exactly once, old line gone',()=>{for(const p of ['app.js','pet/game/app.js',...HOME155_FILES]){const s=read(p);assert.equal(s.split(HOME155_NEW).length,2,p);assert.equal(s.split(HOME155_OLD).length,1,p);}});
test('delta restores main line for preview files only and rejects missing/duplicate/edited line',()=>{
 for(const p of HOME155_FILES){const s=read(p),r=withoutHome155Delta(p,s);assert.equal(r.length,s.length-HOME155_NEW.length+HOME155_OLD.length);assert(r.includes(HOME155_OLD)&&!r.includes(HOME155_NEW));
  assert.throws(()=>withoutHome155Delta(p,s.replace(HOME155_NEW,HOME155_OLD)),/HOME155_DELTA_NOT_EXACT/);
  assert.throws(()=>withoutHome155Delta(p,s+HOME155_NEW),/HOME155_DELTA_NOT_EXACT/);
  assert.throws(()=>withoutHome155Delta(p,s.replace(HOME155_NEW,HOME155_NEW.replace('has-art','has-art2'))),/HOME155_DELTA_NOT_EXACT/);}
 assert.equal(withoutHome155Delta('app.js','x'),'x');
});

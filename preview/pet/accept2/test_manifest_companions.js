'use strict';
const assert=require('node:assert/strict'),PA=require('../art.js'),M=require('../art/cat/manifest.json'),copy=o=>JSON.parse(JSON.stringify(o));
let n=0;function invalid(label,mutate){const m=copy(M);mutate(m);let r;assert.doesNotThrow(()=>r=PA.validateManifest(m),label);assert(!r.ok,label);n++;}
assert(PA.validateManifest(M).ok);
invalid('out of bounds in secondary image',m=>m.clips.walk_S.frames[2].sourceRect[0]=99999);
invalid('null secondary atlas',m=>m.atlases.walk_s_base=null);
invalid('missing atlas dimensions',m=>delete m.atlases.walk_s_base.size);
invalid('missing secondary image mapping',m=>m.clips.walk_S.frames[2].imageKey='wrong');
invalid('null frame',m=>m.clips.walk_E.frames[2]=null);
invalid('null clip',m=>m.clips.play=null);
invalid('empty loop',m=>m.clips.walk_E.frames=[]);
invalid('missing required semantic',m=>delete m.clips.rest);
invalid('wrong motion direction',m=>m.clips.walk_S.dir='N');
invalid('dog action mapped into companion',m=>m.clips.sniff=copy(m.clips.groom));
invalid('play mapped to rest poses',m=>m.clips.play.frames=copy(m.clips.rest.frames));
invalid('NaN anchor',m=>m.clips.run_E.frames[1].anchor[1]=NaN);
invalid('negative scale',m=>m.atlases.run_e.sourceScale=-1);
const airborne=M.clips.run_E.frames.find(f=>f.anchor[1]>f.sourceRect[3]);assert(airborne,'projected airborne anchor must remain legal');
console.log(`PASS ${n} malformed multi-atlas/semantic cases rejected without exceptions; airborne anchor accepted; no fixed108-frame requirement`);

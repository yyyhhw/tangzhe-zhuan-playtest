import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const src=f=>fs.readFileSync(new URL('../../'+f,import.meta.url),'utf8');
test('音效-112: 星途 open stops only BGM (no context suspend), SFX hook guarded by hidden/frozen; root+pet',()=>{
  assert(src('app.js').includes("xingtuAudioPause:{value:()=>stopBgm()}"));assert(src('app.js').includes("xingtuSfx:{value:n=>{if(!document.hidden&&!frozen)sfx(n);}}"));
  assert(src('pet/game/app.js').includes("xingtuAudioPause:()=>stopBgm()"));assert(src('pet/game/app.js').includes("xingtuSfx:n=>{if(!document.hidden&&!frozen)sfx(n);}"));
  for(const f of ['app.js','pet/game/app.js'])assert(/function sfx\(name\) \{\n  if \(!AU\.ctx \|\| AU\.ctx\.state !== 'running' \|\| state\.muted\) return;/.test(src(f)),f+' sfx muted guard');
});
test('音效-112: overlay plays swoosh on successful depart, reveal on successful claim, nothing on failure',()=>{
  const o=src('space/overlay.mjs');assert(o.includes("if(r.ok){const n=intent.type==='depart'?'swoosh':intent.type==='claim'?'reveal':null;if(n)try{app.xingtuSfx?.(n);}catch{}}return r;"));
});

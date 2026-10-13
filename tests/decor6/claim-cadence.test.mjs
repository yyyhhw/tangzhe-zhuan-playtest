import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
for(const file of ['app.js','preview/app.js','pet/game/app.js'])test(file+': confirmed hidden claim restarts deadline after commit; failure does not impersonate success',()=>{
 const source=fs.readFileSync(new URL('../../'+file,import.meta.url),'utf8'),act=source.match(/function act\([^\n]*\) \{[\s\S]*?\n\}/)[0];
 for(const ok of [true,false]){const c={ms:14900,DECOR6:true,state:{cur:0},dirty:false,E:{ITEM_BY_ID:{d_opening_photo:{name:'开业合影'}}},toast(){},persist:Object.assign(()=>{},{nextAutoAt:15000}),performance:{now:()=>c.ms},COLLECTION:{claimHidden:()=>{c.ms+=400;return {ok};}}};vm.createContext(c);vm.runInContext(act,c);c.act('claimHidden','d_opening_photo');assert.equal(c.persist.nextAutoAt,ok?30300:15000);}
});

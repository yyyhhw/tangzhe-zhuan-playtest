'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const E=require('../../economy.js'),OldE=require('../../../economy.js'),OldPG=require('../../../pet/game/petgame.js'),PG=require('../game/petgame.js'),PE=require('../engine.js'),M=require('../art/manifest.json');
const stamp=1790000000000,J=JSON.stringify,clone=x=>JSON.parse(J(x));
const fresh=()=>{const s=E.newState(stamp);for(const c of E.CEOS){s.ceos[c.id].unlocked=true;E.homeOf(s,c.id).placed=[];}s.coins=1000000;return s;};
const manifests={dog:M};for(const id of ['cat','rabbit']){const m=require('../art/'+id+'/manifest.json');manifests[id]=m;assert(PG.registerSpecies(id,m,{naturalWidth:m.atlas.size[0],naturalHeight:m.atlas.size[1],companionAtlases:Object.fromEntries(Object.entries(m.atlases||{}).map(([k,a])=>[k,{naturalWidth:a.size[0],naturalHeight:a.size[1]}]))},'unit-only').ok);}
const buy=(s,species,room='c77',save=()=>true,opt={})=>PG.buy(s,E,room,stamp,manifests[species],save,false,{species,prototype:true,...opt});
function storage(s){const data=new Map([['main',J(s)],['bak',J(s)],['formal','FORMAL-SENTINEL']]);return {data,getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('v14 migration, verified backup, repeated saves and old-version rollback',()=>{
 for(const hasUid of [false,true]){
  const s=fresh();assert(OldPG.buy(s,OldE,'c77',stamp-1234,M,()=>true).ok);if(hasUid)s.pet.uid='v14-original';
  const rt=OldPG.createRuntime({E:OldE,manifest:M,now:()=>stamp});rt.sync(s);rt.w.dog.affinity=73;rt.w.dog.energy=61;rt.beforePersist(s);
  const original=clone(s.pet),coins=s.coins,disk=storage(s),oldMain=disk.getItem('main');
  assert(PG.migrateRoster(s,E,{save:st=>E.commitSave(disk,'main','bak',st)}).ok);
  const dog=s.pets.list[0];assert.equal(dog.uid,hasUid?'v14-original':'pet-dog-legacy');assert.equal(dog.room,original.home);assert.deepEqual(dog.eng,original.eng);assert.notStrictEqual(dog.eng,s.pet.eng);assert.equal(dog.boughtAt,original.boughtAt);assert.equal(s.coins,coins);assert.equal(disk.getItem('bak'),oldMain);
  assert(PG.assign(s,E,dog.uid,'pearl',{save:st=>E.commitSave(disk,'main','bak',st),M}).ok);assert(E.commitSave(disk,'main','bak',s).ok);
  for(const key of ['main','bak']){const reverted=OldE.loadSave(disk.getItem(key),null,stamp).st;OldPG.norm(reverted,OldE);assert(OldPG.owned(reverted));assert.equal(reverted.pet.home,original.home);assert.equal(reverted.pet.eng.dog.affinity,73);assert.equal(reverted.coins,coins);if(hasUid)assert.equal(reverted.pet.uid,original.uid);}
  assert.deepEqual(s.pet,original);assert.equal(PG.view(s,E).pets[dog.uid].room,'pearl');assert.equal(s.pets.list.length,1);assert.equal(disk.getItem('formal'),'FORMAL-SENTINEL');
 }
});
test('buy/replace/move/standby rollback on readonly, unsafe, corrupt, conflict, quota, silent writes',()=>{
 for(const mode of ['readonly','unsafe','corrupt','conflict','quota','silent'])for(const action of ['buy','replace','move','standby']){
  let s=fresh();const a=buy(s,'dog'),b=buy(s,'cat'),c=buy(s,'rabbit',null);assert(a.ok&&b.ok&&c.ok);if(action==='buy')s.pets.list=s.pets.list.filter(p=>p.species!=='rabbit');
  const disk=storage(s);
  if(mode==='readonly')E.markBlocked(s);
  if(mode==='unsafe'){const unsafe=clone(s);unsafe.coins=Number.MAX_SAFE_INTEGER+1;s=E.loadSave(J(unsafe),null,stamp).st;disk.setItem('main',J(unsafe));}
  if(mode==='corrupt')disk.setItem('main','{broken');
  if(mode==='conflict'){const newer=clone(s);newer.rev+=4;newer.coins-=7;disk.setItem('main',J(newer));}
  if(mode==='quota')disk.setItem=()=>{throw Error('quota')};
  if(mode==='silent')disk.setItem=()=>{};
  const before=J(s),beforeDisk=J([...disk.data]),save=st=>E.commitSave(disk,'main','bak',st);
  const r=action==='buy'?buy(s,'rabbit',null,save):PG.assign(s,E,action==='replace'?c.uid:a.uid,action==='standby'?null:action==='move'?'pearl':'c77',{save,M:manifests[action==='replace'?'rabbit':'dog'],replace:action==='replace'?b.uid:undefined});
  assert(!r.ok,mode+'/'+action);assert.equal(J(s),before,mode+'/'+action+' state');assert.equal(J([...disk.data]),beforeDisk,mode+'/'+action+' disk');
 }
});
function fill(s,id){const h=E.homeOf(s,id),t=E.homeTier(h.lv),coins=s.coins;s.coins=1e9;for(let y=0;y<t.rows;y++)for(let x=0;x<t.cols;x++){if(E.canPlace(s,id,'furn_plant',x,y,0,null,'floor').ok){E.buyFurniture(s,'furn_plant');assert(E.placeItem(s,id,'furn_plant',x,y,0,'floor').ok)}}s.coins=coins;}
test('two-species full-room waiting, furniture removal, house upgrade and replacement',()=>{
 for(const relief of ['store','upgrade']){
  const s=fresh(),a=buy(s,'dog'),b=buy(s,'cat'),c=buy(s,'rabbit',null);assert(a.ok&&b.ok&&c.ok);
  const rs=[a,b].map((r,i)=>PG.createRuntime({E,manifest:manifests[i?'cat':'dog'],species:i?'cat':'dog',uid:r.uid,now:()=>stamp}));rs.forEach(r=>r.sync(s));
  fill(s,'c77');rs.forEach(r=>{r.sync(s);assert(r.waiting);assert(!r.pet(s).ok)});const before=J(s);assert(!PG.assign(s,E,c.uid,'c77',{M:manifests.rabbit,replace:b.uid,save:()=>true}).ok);assert.equal(J(s),before);
  if(relief==='store'){for(const p of [...E.homeOf(s,'c77').placed])if(p.y>=E.homeTier(1).rows-2)assert(E.storeItem(s,'c77',p.uid).ok)}
  else assert(E.upgradeHome(s,'c77').ok);
  for(const r of rs){r.sync(s);r.step(1);assert(!r.waiting);assert(PE.bodyFree(r.w,r.w.dog.x,r.w.dog.y,r.w.dog.dir,1e-6));}
  assert(PG.assign(s,E,c.uid,'c77',{M:manifests.rabbit,replace:b.uid,save:()=>true}).ok);assert.equal(PG.view(s,E).pets[b.uid].room,null);const rabbit=PG.createRuntime({E,manifest:manifests.rabbit,species:'rabbit',uid:c.uid});rabbit.sync(s);assert(!rabbit.waiting);assert(PE.bodyFree(rabbit.w,rabbit.w.dog.x,rabbit.w.dog.y,rabbit.w.dog.dir,1e-6));
 }
});
test('cache/version aligned in both local entries; preview save keys preserved',()=>{
 for(const folder of ['preview','preview/pet/game']){const h=fs.readFileSync(folder+'/index.html','utf8'),v=JSON.parse(fs.readFileSync(folder+'/version.json')).v;assert.equal(v,'13k-night2');assert(h.includes("var B='"+v+"'"));for(const q of h.matchAll(/(?:src|href)="[^"\s]+\?v=([^"\s]+)"/g))assert.equal(q[1],v);}
 for(const file of ['preview/app.js','preview/pet/game/app.js']){const src=fs.readFileSync(file,'utf8');assert(src.includes('tangzhe-preview-save'));assert(src.includes("e.key==='Escape'&&petPanelOpen"));}
});
console.log(n+' focused portal/migration/storage/floor/cache cases passed');

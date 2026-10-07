'use strict';
// Synthetic manifests are unit-test fixtures only; never shipped/registered in the browser catalog.
const assert=require('node:assert/strict'), E=require('../../economy.js'), PG=require('../game/petgame.js'), PA=require('../art.js'), dogM=require('../art/manifest.json');
const ids=Object.keys(PG.SPECIES), stamp=1790000000000, clone=x=>JSON.parse(JSON.stringify(x));
function fixture(species){let cell=0;const clips={};for(const n of ['idle_E','idle_N','idle_S','walk_E','walk_N','walk_S','attention','groom','play','rest','petted'])clips[n]={dir:n.endsWith('_N')?'N':n.endsWith('_S')?'S':'E',inPlace:!n.includes('_'),loop:!['attention','play','petted'].includes(n),frames:[{cell:cell++,ms:200}]};return {schema:'tangzhe-companion-art/1',species,placeholder:false,releaseReady:false,source:{frameSize:[256,256],origin:[128,208],perFrameCrop:false,shadow:'separate'},runtime:{cellSize:128,origin:[64,104],displayTiles:1.1},atlas:{image:'unit-fixture.png',cols:4,rows:4,size:[512,512]},directions:{drawn:['E','N','S'],mirror:{W:'E'}},body:{E:[52,205],N:[90,166],S:[90,166]},shadow:{cell:cell++,radius:[40,10]},clips};}
const manifests={dog:dogM};for(const species of ids.filter(x=>x!=='dog')){const m=fixture(species);assert(PA.validateManifest(m).ok);manifests[species]=m;assert(PG.registerSpecies(species,m,{naturalWidth:512,naturalHeight:512},'unit-only').ok);assert(!PG.speciesReady(species));assert(PG.speciesReady(species,true));}
const fresh=()=>{const s=E.newState(stamp);for(const c of E.CEOS)s.ceos[c.id].unlocked=true;s.coins=100000;return s;};
let pairs=0;
for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
 const s=fresh();for(const species of [ids[i],ids[j]]){const r=PG.buy(s,E,'c77',stamp,manifests[species],()=>true,false,{species,prototype:true});assert(r.ok,JSON.stringify(r));}
 assert.equal(PG.view(s,E).rooms.c77.length,2);assert.equal(s.coins,94000);
 for(const p of s.pets.list){const runtime=PG.createRuntime({E,manifest:manifests[p.species],species:p.species,uid:p.uid,now:()=>stamp});const w=runtime.sync(s);assert(w&&!w.noRoom,p.species);assert(runtime.pet(s).ok);runtime.step(2);runtime.beforePersist(s);assert(p.eng);assert(p.species==='dog'?p.eng.dog:p.eng.pet);}
 const saved=clone(s),loaded=E.loadSave(JSON.stringify(saved),JSON.stringify(saved),stamp).st;PG.norm(loaded,E);
 for(const p of loaded.pets.list){const original=saved.pets.list.find(x=>x.uid===p.uid);assert.deepEqual(p.eng,original.eng);assert(PG.buy(loaded,E,null,stamp,manifests[p.species],()=>true,false,{species:p.species,prototype:true}).alreadyOwned);const rt=PG.createRuntime({E,manifest:manifests[p.species],species:p.species,uid:p.uid,now:()=>stamp});assert(rt.sync(loaded));assert(rt.throwBall(loaded).ok);rt.step(5);assert.equal(rt.w.species||'dog',p.species);}
 pairs++;
}
assert.equal(pairs,21);console.log('PASS 21 pairs: unique purchase, same room, individual pet/play interaction, save/reload (synthetic logic fixtures only)');
for(const species of ids.filter(x=>x!=='dog')){
 const s=fresh(),r=PG.buy(s,E,'c77',stamp,manifests[species],()=>true,false,{species,prototype:true});assert(r.ok);const rt=PG.createRuntime({E,manifest:manifests[species],species,uid:r.uid,now:()=>stamp});rt.sync(s);rt.pet(s);const before=rt.snapshot();
 const result=PG.assign(s,E,r.uid,null,{save:()=>false,prepare:()=>rt.beforePersist(s)});assert(!result.ok);rt.sync(s);assert.deepEqual(rt.snapshot(),before,'failed save discarded live '+species+' growth');
 s.pets.list[0].eng={schema:'tangzhe-companion-save/1',v:99,species,pet:{affinity:99}};const opaque=JSON.stringify(s);rt.sync(s);assert(rt.unsupported);assert(!rt.beforePersist(s));assert.equal(JSON.stringify(s),opaque);
}
console.log('PASS six species: rollback retains live growth; unknown engine versions stay opaque');
// Regression for a cat prototype with its walk cycles unavailable: it must play in place and still reward play once.
{
 const m=clone(require('../art/cat/manifest.json')),s=fresh();for(const key of Object.keys(m.clips))if(key.startsWith('walk_')||key.startsWith('run_'))delete m.clips[key];assert(PA.validateManifest(m).ok);assert(!m.clips.walk_E);
 assert(PG.registerSpecies('cat',m,{naturalWidth:m.atlas.size[0],naturalHeight:m.atlas.size[1],companionAtlases:Object.fromEntries(Object.entries(m.atlases||{}).map(([key,a])=>[key,{naturalWidth:a.size[0],naturalHeight:a.size[1]}]))},'local-real-prototype').ok);
 const r=PG.buy(s,E,'c77',stamp,m,()=>true,false,{species:'cat',prototype:true});assert(r.ok);
 const rt=PG.createRuntime({E,manifest:m,species:'cat',uid:r.uid,now:()=>stamp});rt.sync(s);
 const before=rt.snapshot().pet,xy=[before.x,before.y];assert(rt.throwBall(s).ok);rt.step(1);
 assert.deepEqual([rt.w.dog.x,rt.w.dog.y],xy,'cat without walking frames must not slide');
 assert.equal(rt.snapshot().pet.affinity,before.affinity+1,'in-place toy play should reward this cat');
 assert(rt.throwBall(s).ok);assert.equal(rt.snapshot().pet.affinity,before.affinity+1,'repeat play uses same gain cooldown');
}
console.log('PASS no-walk cat fallback: in-place toy play gains once, respects cooldown, no sliding');
{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),m=require('../art/cat/manifest.json');
 assert(PA.validateManifest(m).ok);for(const [name,n] of Object.entries({walk_E:8,walk_N:4,walk_S:4,run_E:6}))assert.equal(m.clips[name].frames.length,n);
 assert.deepEqual(m.clips.walk_S.frames.map(f=>f.imageKey),['walk_s_base','walk_s_base','walk_s_opposite','walk_s_opposite']);
 assert.deepEqual(m.clips.groom.frames.filter(f=>f.imageKey).map(f=>[f.sourceIndex,f.imageKey]),[[6,'groom_fix']]);
 for(const a of Object.values(m.atlases))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../art/cat',a.image))).digest('hex'),a.sha256);
 assert(!PG.registerSpecies('cat',m,{naturalWidth:2048,naturalHeight:1024},'missing-extras').ok);
 const broken=clone(m);broken.clips.walk_S.frames[2].imageKey='missing';assert(!PA.validateManifest(broken).ok);
}
console.log('PASS cat locomotion source counts, cross-image S order, groom06-only patch, original pixel hashes, missing-atlas rejection');
{
 const PC=require('../companions.js'),m=require('../art/cat/manifest.json');
 for(const [dir,dx,dy,clipName] of [['E',1,0,'run_E'],['W',-1,0,'run_E'],['N',0,-1,'walk_N'],['S',0,1,'walk_S']]){
  const w=PC.createWorld({catalog:[],room:{cols:8,rows:6,items:[],front:{x:4,y:5.7},bed:{x:0,y:5,w:1,h:1}},interact:{},manifest:m,start:{x:4,y:3}});
  assert(PC.throwBall(w,{x:4+dx,y:3+dy}).ok);PC.step(w,.2);assert.equal(w.dog.dir,dir);assert.equal(w.dog.anim.name,clipName);assert(Math.hypot(w.dog.x-4,w.dog.y-3)>.1);PC.step(w,3);assert.equal(w.dog.affinity,41);
 }
}
console.log('PASS actual cat routes: E/W use run_E (W mirrored), N/S use corresponding walks, arrival rewards one play');
{
 const PC=require('../companions.js'),summaries={};
 for(const species of Object.keys(PC.CONFIG)){
  const m=require('../art/'+species+'/manifest.json'),w=PC.createWorld({catalog:E.FURNITURE,room:{cols:8,rows:6,items:species==='cat'?[{fid:'furn_catbed',x:5,y:2}]:[],front:{x:4,y:5.7},bed:{x:0,y:5,w:1,h:1}},interact:{},manifest:m,start:{x:3,y:3},seed:7}),labels=new Set(),locations=new Set();
  for(let i=0;i<900;i++){PC.step(w,.1);labels.add(w.dog.label);locations.add(w.dog.x.toFixed(1)+','+w.dog.y.toFixed(1));assert(!['sniff','pick_ball','drop_ball'].includes(w.dog.anim.name));}
  assert(locations.size>3,species+' should autonomously move');assert(labels.has(PC.CONFIG[species].groom),species+' should use own non-dog action');if(species==='cat')assert(labels.has('走到猫窝旁蜷卧'));summaries[species]={positions:locations.size,labels:[...labels]};
 }
 assert(new Set(Object.values(summaries).map(s=>JSON.stringify(s))).size===6);console.log('PASS six autonomous behavior profiles and cat-furniture rest (no canine sniff/fetch): '+JSON.stringify(summaries));
}

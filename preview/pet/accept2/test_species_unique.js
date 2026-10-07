'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../../economy.js'), PG = require('../game/petgame.js'), M = require('../art/manifest.json');
const fresh = () => { const s=E.newState(1790000000000); for(const c of E.CEOS)s.ceos[c.id].unlocked=true; s.coins=100000;return s; };
const copy = s => JSON.stringify(s), save=()=>true;
let count=0; function test(name,f){f();console.log('PASS '+name);count++;}
test('one global dog purchase, including standby and other rooms; no extra charges',()=>{
 const s=fresh(), a=PG.buy(s,E,'c77',1,M,save);assert(a.ok);const before=copy(s);
 for(const room of ['c77','pearl',null]) { const r=PG.buy(s,E,room,2,M,save);assert(r.alreadyOwned);assert.equal(copy(s),before); }
 assert(PG.assign(s,E,a.uid,null,{save}).ok);const after=copy(s);assert(PG.buy(s,E,'pearl',3,M,save).alreadyOwned);assert.equal(copy(s),after);
});
test('legacy dog counts before migration, duplicate records/growth/coins stay intact',()=>{
 const s=fresh();s.pet={owned:true,home:'c77',eng:{v:1,dog:{affinity:67}},boughtAt:10};const before=copy(s);
 assert(PG.buy(s,E,'pearl',2,M,save).alreadyOwned);assert.equal(copy(s),before);
 delete s.pet;s.pets={v:2,list:[{uid:'old-a',species:'dog',room:'c77',boughtAt:1,eng:{x:67}},{uid:'old-b',species:'dog',room:'c77',boughtAt:2,eng:{x:73}}]};
 const original=copy(s),growth=s.pets.list.map(p=>copy(p.eng));
 assert(!PG.migrateRoster(s,E,{save:()=>false}).ok);assert.equal(copy(s),original);
 assert(PG.migrateRoster(s,E,{save}).ok);const normalized=copy(s);PG.norm(s,E);assert.equal(copy(s),normalized);
 assert.deepEqual(PG.view(s,E).rooms.c77,['old-a']);assert.equal(s.pets.list[1].room,null);assert(s.pets.list[1].compatibility);
 const beforeSwap=copy(s);assert(!PG.activateDuplicate(s,E,'old-b',{save:()=>false}).ok);assert.equal(copy(s),beforeSwap);
 assert(PG.activateDuplicate(s,E,'old-b',{save}).ok);assert.deepEqual(PG.view(s,E).rooms.c77,['old-b']);assert(s.pets.list[0].compatibility);
 assert.deepEqual(s.pets.list.map(p=>copy(p.eng)),growth);assert.equal(s.coins,100000);
 assert(PG.buy(s,E,'pearl',3,M,save).alreadyOwned);
});
test('different species coexist and survive save/reload; unknown growth stays opaque',()=>{
 const s=fresh();s.pets={v:2,list:[{uid:'d',species:'dog',room:'c77',boughtAt:1,eng:null},{uid:'c',species:'cat',room:null,boughtAt:2,eng:{v:77,cat:{growth:91}}}]};
 assert(PG.assign(s,E,'c','c77',{save}).ok);assert.equal(PG.view(s,E).rooms.c77.length,2);
 const loaded=E.loadSave(copy(s),copy(s),1790000000000).st;PG.norm(loaded,E);assert.deepEqual(loaded.pets,s.pets);
});
test('unimplemented species never charge or create placeholder pets',()=>{
 for(const species of ['cat','red_panda','robot','panda_cub','alpaca','rabbit','invented']){const s=fresh(),before=copy(s);assert(!PG.buy(s,E,'c77',1,M,save,false,{species}).ok);assert.equal(copy(s),before);}
});
test('failed first purchase rolls back; retry succeeds once',()=>{
 const s=fresh(),before=copy(s);assert(!PG.buy(s,E,'c77',1,M,()=>false).ok);assert.equal(copy(s),before);
 assert(PG.buy(s,E,'c77',2,M,save).ok);assert.equal(s.coins,97000);assert(PG.buy(s,E,'c77',3,M,save).alreadyOwned);
});
test('both renderers collapse to one pet entry and reveal management without interaction controls',()=>{
 for(const file of ['preview/app.js','preview/pet/game/app.js']) {
  const source=fs.readFileSync(file,'utf8'),start=source.indexOf('function petMallCard() {'),end=source.indexOf('function petPanelFocus(',start);
  const state=fresh();assert(PG.buy(state,E,'c77',1,M,save).ok);
  const context={PG,E,state,petManifest:()=>M,petAvailable:s=>PG.speciesReady(s),petRoster:()=>PG.view(state,E),petState:()=> 'live',homeWho:'c77',homeMode:'live',petEsc:String,fmt:String,petPanelOpen:false,petSelection:'dog',petSelectedUid:null};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  let html=context.petMallCard();assert(html.includes('data-act="petOpen"'));assert(!html.includes('pet-choices'));assert(!html.includes('homePetBuy'));assert(!html.includes('homePetPat'));
  context.petPanelOpen=true;html=context.petMallCard();assert.equal((html.match(/data-act="petSelect"/g)||[]).length,7);assert.equal((html.match(/data-act="homePetPat"/g)||[]).length,0);assert(!html.includes('homePetBuy'));assert.equal((html.match(/class="pet-selected"/g)||[]).length,1);
  context.petSelection='cat';html=context.petMallCard();assert(html.includes('待加入'));assert(!html.includes('homePetPat'));assert(html.includes('data-species="cat"'));
 }
});
test('migration and compatibility swap use verified main/backup writes and roll back failures',()=>{
 const MAIN='tangzhe-preview-save',BAK=MAIN+'-bak';
 for(const mode of ['backup-throw','main-throw','backup-drop','main-drop','success']){
  const s=fresh();s.pets={v:2,list:[{uid:'a',species:'dog',room:'c77',boughtAt:17,eng:{opaque:'growth-a'}},{uid:'b',species:'dog',room:'c77',boughtAt:23,eng:{opaque:'growth-b'}}]};
  const raw=copy(s),data=new Map([[MAIN,raw],[BAK,'older-backup'],['tangzhe-save','formal-sentinel']]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(mode===(k===BAK?'backup':'main')+'-throw')throw Error('quota');if(mode===(k===BAK?'backup':'main')+'-drop')return;data.set(k,v);},removeItem:k=>data.delete(k)};
  const result=PG.migrateRoster(s,E,{save:state=>E.commitSave(storage,MAIN,BAK,state)});
  assert.equal(result.ok,mode==='success');assert.equal(data.get('tangzhe-save'),'formal-sentinel');
  if(mode!=='success'){assert.equal(copy(s),raw);assert.equal(data.get(MAIN),raw);}
  else {
   assert.deepEqual(JSON.parse(data.get(MAIN)).pets,s.pets);assert.deepEqual(PG.view(s,E).rooms.c77,['a']);
   assert.deepEqual(s.pets.list.map(p=>[p.uid,p.boughtAt,p.eng]),[['a',17,{opaque:'growth-a'}],['b',23,{opaque:'growth-b'}]]);
   const before=copy(s),main=data.get(MAIN);const bad={...storage,setItem:(k,v)=>{if(k===MAIN)throw Error('quota');storage.setItem(k,v);}};
   assert(!PG.activateDuplicate(s,E,'b',{save:state=>E.commitSave(bad,MAIN,BAK,state)}).ok);assert.equal(copy(s),before);assert.equal(data.get(MAIN),main);
   assert(PG.activateDuplicate(s,E,'b',{save:state=>E.commitSave(storage,MAIN,BAK,state)}).ok);
   const loaded=E.loadSave(data.get(MAIN),data.get(BAK),1790000000000).st;PG.norm(loaded,E);assert.deepEqual(PG.view(loaded,E).rooms.c77,['b']);assert.equal(loaded.coins,100000);
  }
 }
});

test('unknown, missing and malformed species stay opaque and quarantined, never become dogs',()=>{
 const s=fresh(),values=['ferret','constructor','__proto__','',null,42,{id:'cat'}];
 s.pets={v:2,list:values.map((species,i)=>({uid:'opaque-'+i,species,room:'c77',boughtAt:123,eng:{v:99,growth:73+i},extra:{keep:true}}))};
 s.pets.list.push({uid:'no-species',room:'c77',eng:{dog:{affinity:88}}});const raw=copy(s.pets.list),coins=s.coins;
 const v=PG.view(s,E);assert.equal((v.rooms.c77||[]).length,0);assert.equal(PG.speciesOwned(s,E,'dog'),false);
 for(const p of Object.values(v.pets)){assert(p.quarantined);assert(!PG.assign(s,E,p.uid,'c77',{save}).ok);assert.equal(PG.engSupport(p),'opaque');}
 PG.norm(s,E);assert.equal(copy(s.pets.list),raw);PG.norm(s,E);assert.equal(copy(s.pets.list),raw);
 for(const species of values){assert(!PG.buy(s,E,'c77',100,M,save,false,{species,prototype:true}).ok);assert.equal(s.coins,coins);}
 const dog=PG.buy(s,E,'c77',101,M,save);assert(dog.ok);assert.equal(copy(s.pets.list.slice(0,-1)),raw);assert.equal(s.coins,coins-3000);
 for(const species of values){const rt=PG.createRuntime({E,manifest:M,species,uid:'opaque-'+values.indexOf(species)});assert.equal(rt.sync(s),null);assert(!rt.beforePersist(s));}
});

test('conflicting unknown/known IDs keep every record and never lose paid dog ownership',()=>{
 for(const reverse of [false,true])for(const success of [false,true]){
  const s=fresh(),unknown={uid:'x',species:'ferret',eng:{opaque:1},custom:{keep:true}},dog={uid:'x',species:'dog',room:'c77',eng:{v:1,dog:{affinity:73}},boughtAt:77};
  s.pets={v:2,list:reverse?[dog,unknown]:[unknown,dog]};const original=copy(s),opaque=copy(unknown);
  assert(PG.speciesOwned(s,E,'dog'));assert.equal(Object.keys(PG.view(s,E).pets).length,2);assert(PG.buy(s,E,'pearl',1,M,save).alreadyOwned);assert.equal(copy(s),original);
  const result=PG.migrateRoster(s,E,{save:()=>success});assert.equal(result.ok,success);
  if(!success){assert.equal(copy(s),original);continue;}
  assert.equal(s.pets.list.length,2);assert.equal(copy(s.pets.list.find(p=>p.species==='ferret')),opaque);assert.deepEqual(s.pets.list.find(p=>p.species==='dog').eng,dog.eng);
  const first=copy(s),view=copy(PG.view(s,E));PG.norm(s,E);assert.equal(copy(s),first);assert.equal(copy(PG.view(s,E)),view);assert(PG.buy(s,E,null,2,M,save).alreadyOwned);
 }
 for(const species of ['ferret','cat']){const s=fresh();s.pet={uid:'x',owned:true,home:'c77',boughtAt:77,eng:{v:1,dog:{affinity:73}}};s.pets={v:2,list:[{uid:'x',species,room:'c77',eng:{opaque:1}}]};PG.norm(s,E);assert.equal(s.pets.list.length,2);assert(PG.speciesOwned(s,E,'dog'));const stable=copy(s);PG.norm(s,E);assert.equal(copy(s),stable);assert.equal(s.pet.eng.dog.affinity,73);}
 const s=fresh();s.pets={v:2,list:[{uid:'x',species:'dog',room:'c77',eng:{old:51}},{uid:'x',species:'dog',room:'c77',eng:{old:73}},{uid:'x',species:'cat',room:'c77',eng:{old:62}}]};PG.norm(s,E);
 assert.equal(s.pets.list.length,3);assert.equal(new Set(s.pets.list.map(p=>p.uid)).size,3);assert.deepEqual(s.pets.list.map(p=>p.eng.old),[51,73,62]);assert.equal(s.pets.list[1].uidRepair.originalUid,'x');assert.equal(s.pets.list[2].uidRepair.originalUid,'x');assert(s.pets.list[1].compatibility);const stable=copy(s);PG.norm(s,E);assert.equal(copy(s),stable);
});

console.log(count+' species policy cases passed; no browser/device claims');

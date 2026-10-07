// Current unified portal rendering contracts. Actual pointer/keyboard/navigation,
// replacement/cancel/save/reload are covered by test_pet_portal_e2e.mjs and
// test_dogs2_e2e.py. The obsolete two-slot DOM and repeated dog-buy contract is gone.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../../economy.js'),PG=require('../game/petgame.js'),M=require('../art/manifest.json');
let n=0;
for(const file of ['../../app.js','../game/app.js']){
 const source=fs.readFileSync(path.join(__dirname,file),'utf8'),a=source.indexOf('function petMallCard() {'),b=source.indexOf('function petPanelFocus(',a);assert(a>=0&&b>a);
 const state=E.newState(0);for(const c of E.CEOS)state.ceos[c.id].unlocked=true;state.coins=50000;
 const context={PG,E,state,homeWho:'c77',homeMode:'live',petPanelOpen:false,petSelection:'dog',petSelectedUid:null,petInteractUid:null,petRoster:()=>PG.view(state,E),petAvailable:s=>s==='dog',petManifest:()=>M,petState:()=> 'live',petEsc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt:String};
 vm.createContext(context);vm.runInContext(source.slice(a,b),context);
 function test(label,fn){fn();n++;console.log('PASS '+file+' '+label)}
 test('collapsed entry has no permanent choices or interaction cards',()=>{const h=context.petPortal();assert(h.includes('id="petEntry"'));assert(!h.includes('pet-choices'));assert(!h.includes('homePetPat'));assert(!h.includes('homePetBuy'));assert.equal(context.petRoomBar(),context.petMallCard());});
 context.petPanelOpen=true;
 test('unowned selected species only, ready/locked labels',()=>{let h=context.petPortal();assert.equal((h.match(/data-act="petSelect"/g)||[]).length,7);assert.equal((h.match(/data-act="homePetBuy"/g)||[]).length,1);context.petSelection='cat';h=context.petPortal();assert(h.includes('待加入'));assert(/homePetBuy[^>]*disabled/.test(h));context.petSelection='dog';});
 const dog=PG.buy(state,E,'c77',0,M,()=>true);assert(dog.ok);
 test('owned dog management has no interactions; room has one three-button group',()=>{const h=context.petPortal();assert(!h.includes('homePetBuy'));assert(!h.includes('homePetPat'));assert.equal((context.petInteractionContents().match(/data-act="homePet(?:Pat|Call|Ball)"/g)||[]).length,3);assert(/petPlace[^>]*disabled/.test(h));assert(h.includes('data-act="petStandby"'));});
 test('standby and other-room selection cannot interact',()=>{for(const room of [null,'pearl']){state.pets.list[0].room=room;assert.equal(context.petInteractionContents(),'');}state.pets.list[0].room='c77';});
 test('decor and waiting disable interaction controls',()=>{for(const mode of ['decor','waiting']){context.homeMode=mode==='decor'?'decor':'live';context.petState=()=>mode==='waiting'?'waiting':'live';assert(/homePetPat[^>]*disabled/.test(context.petInteractionContents()));}context.homeMode='live';context.petState=()=> 'live';});
 test('unsupported growth is preserved and labelled without enabling actions',()=>{const p=state.pets.list[0];p.eng={v:99,dog:{affinity:77}};const before=JSON.stringify(state),h=context.petPortal();assert(h.includes('当前版本暂不能运行'));assert(/homePetPat[^>]*disabled/.test(context.petInteractionContents()));assert.equal(JSON.stringify(state),before);p.eng=null;});
 test('legacy duplicate selection shows explicit activation, not second purchase',()=>{state.pets.list.push({...state.pets.list[0],uid:'old-extra',eng:{oldGrowth:73}});PG.norm(state,E);context.petSelectedUid='old-extra';const h=context.petPortal();assert(h.includes('兼容待命'));assert(h.includes('data-act="petActivate"'));assert(!h.includes('homePetBuy'));assert(!h.includes('homePetPat'));assert.equal(context.petInteractUid,state.pets.list[0].uid);});
 test('opaque records and quoted identity escape safely',()=>{state.pets.list.push({uid:'unknown',species:'ferret',eng:{opaque:true}});const p=state.pets.list[0];p.uid='pet"><img src=x onerror="bad">&\'';context.petSelectedUid=p.uid;const before=JSON.stringify(state),h=context.petPortal();assert(h.includes('未知物种记录已隔离'));assert(h.includes('pet&quot;&gt;&lt;img'));assert(!h.includes('<img src=x'));assert.equal(JSON.stringify(state),before);});
}
console.log(n+' unified portal VM contracts passed; no browser/device claims');

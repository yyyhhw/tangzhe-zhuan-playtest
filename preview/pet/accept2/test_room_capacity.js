'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const E=require('../../economy.js'),PE=require('../engine.js');let PG=require('../game/petgame.js');
// Optional old-source replay proves the admitted-second-pet regression before the fix.
if(process.env.PET_OLD_SOURCE){const Module=require('node:module'),file=require.resolve('../game/petgame.js'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(fs.readFileSync(process.env.PET_OLD_SOURCE,'utf8'),file);PG=m.exports;}
const manifests={dog:require('../art/manifest.json')};
for(const species of ['cat','rabbit']){const m=require('../art/'+species+'/manifest.json');manifests[species]=m;assert(PG.registerSpecies(species,m,{naturalWidth:m.atlas.size[0],naturalHeight:m.atlas.size[1],companionAtlases:Object.fromEntries(Object.entries(m.atlases||{}).map(([k,a])=>[k,{naturalWidth:a.size[0],naturalHeight:a.size[1]}]))},'unit-only').ok);}
const J=JSON.stringify,manifestOf=id=>manifests[id],stamp=1790000000000;
function fresh(){const s=E.newState(stamp);for(const c of E.CEOS){s.ceos[c.id].unlocked=true;E.homeOf(s,c.id).placed=[];}s.coins=1000000;return s;}
// Deliberately narrow geometry fixture (not a player-selectable house): 1 x .65
// fits each V body alone, but two .44-deep bodies cannot fit without overlap.
// Uses the real engine, real manifests, transactions and roster model.
const thinE={...E,homeTier:lv=>({...E.homeTier(lv),cols:lv===1?1:2,rows:lv===1?.65:1.5})};
const buy=(s,id,home='c77',engine=E,opt={})=>PG.buy(s,engine,home,stamp,manifests[id],()=>true,false,{species:id,manifestOf,...opt});
const move=(s,uid,home,engine=E,opt={})=>PG.assign(s,engine,uid,home,{M:manifests[PG.view(s,engine).pets[uid].species],manifestOf,save:()=>true,...opt});
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
test('one-body geometry blocks second purchase without charging or changing any save data',()=>{
 const s=fresh();assert(PG.hasRoom(s,thinE,'c77',manifests.dog,{manifestOf}));assert(PG.hasRoom(s,thinE,'c77',manifests.cat,{manifestOf}));
 assert(buy(s,'dog','c77',thinE).ok);const before=J(s),r=buy(s,'cat','c77',thinE);assert.equal(r.ok,false,'second pet must not reuse the only standing space');assert(r.noRoom);assert.equal(J(s),before);
});
test('resident departure invalidates admission result with unchanged furniture',()=>{
 const s=fresh(),a=buy(s,'dog','c77',thinE);assert(a.ok);assert(!PG.hasRoom(s,thinE,'c77',manifests.cat,{manifestOf}));
 assert(move(s,a.uid,null,thinE).ok);assert(PG.hasRoom(s,thinE,'c77',manifests.cat,{manifestOf}));assert(buy(s,'cat','c77',thinE).ok);
});
test('two-body geometry gives distinct legal footprints; house upgrade enables admission',()=>{
 const s=fresh(),a=buy(s,'dog','c77',thinE);assert(a.ok);assert(!PG.hasRoom(s,thinE,'c77',manifests.cat,{manifestOf}));assert(E.upgradeHome(s,'c77').ok);
 const plan=PG.roomCapacity(s,thinE,'c77',manifests.cat,{manifestOf});assert.equal(plan.length,2);const [x,y]=plan.map(p=>p.box);assert(x.x+x.w<=y.x+1e-7||y.x+y.w<=x.x+1e-7||x.y+x.h<=y.y+1e-7||y.y+y.h<=x.y+1e-7);
 for(const [i,id] of ['dog','cat'].entries()){const L=PG.layoutOf(s,thinE,'c77'),w=PE.createWorld({catalog:E.FURNITURE,manifest:manifests[id],room:{...L,bed:null,bowl:null}});assert(PE.bodyFree(w,plan[i].x,plan[i].y,'V',1e-7));}
 assert(buy(s,'cat','c77',thinE).ok);
});
test('move to one-body room is rejected with source room and growth intact; replacement excludes displaced pet',()=>{
 const s=fresh(),a=buy(s,'dog','c77',thinE),b=buy(s,'cat','pearl',thinE);assert(a.ok&&b.ok);s.pets.list.find(p=>p.uid===b.uid).eng={v:999,opaque:{growth:47}};const before=J(s);
 assert(!move(s,b.uid,'c77',thinE).ok);assert.equal(J(s),before);assert(move(s,b.uid,'c77',thinE,{replace:a.uid}).ok);assert.equal(PG.view(s,thinE).pets[a.uid].room,null);assert.deepEqual(PG.view(s,thinE).pets[b.uid].eng,{v:999,opaque:{growth:47}});
});
test('full-room UI probe considers replacements, but exact assignment still checks the selected pair',()=>{
 const s=fresh();E.homeOf(s,'c77').lv=2;const a=buy(s,'dog','c77',thinE),b=buy(s,'cat','c77',thinE),c=buy(s,'rabbit',null,thinE);assert(a.ok&&b.ok&&c.ok);
 assert(!PG.hasRoom(s,thinE,'c77',manifests.rabbit,{manifestOf}));assert(PG.hasRoom(s,thinE,'c77',manifests.rabbit,{manifestOf,allowReplace:true}));assert(move(s,c.uid,'c77',thinE,{replace:b.uid}).ok);
 E.homeOf(s,'c77').lv=1;const before=J(s);assert(!move(s,b.uid,'c77',thinE,{replace:c.uid}).ok);assert.equal(J(s),before);
});
test('actual integer-grid furniture removal releases legal two-pet room capacity',()=>{
 const s=fresh(),h=E.homeOf(s,'c77'),t=E.homeTier(h.lv);for(let y=0;y<t.rows;y++)for(let x=0;x<t.cols;x++){assert(E.buyFurniture(s,'furn_plant').ok);assert(E.placeItem(s,'c77','furn_plant',x,y,0,'floor').ok);}
 assert(!PG.hasRoom(s,E,'c77',manifests.dog,{manifestOf}));assert(E.storeItem(s,'c77',h.placed[0].uid).ok);
 // A whole 1x1 tile really fits two V footprints (.44 deep each); do not
 // invent a one-pet-per-tile restriction that differs from runtime geometry.
 assert(buy(s,'dog').ok);assert(PG.hasRoom(s,E,'c77',manifests.cat,{manifestOf}));assert(buy(s,'cat').ok);
});
test('geometry changed by preparation and failed storage both roll back whole move transaction',()=>{
 for(const cause of ['prepare','save']){const s=fresh();E.homeOf(s,'c77').lv=2;const a=buy(s,'dog','c77',thinE),b=buy(s,'cat','pearl',thinE);assert(a.ok&&b.ok);const before=J(s);
 const opt=cause==='prepare'?{prepare:st=>{E.homeOf(st,'c77').lv=1;return true}}:{save:()=>false};assert(!move(s,b.uid,'c77',thinE,opt).ok);assert.equal(J(s),before,cause);}
});
test('missing resident manifest fails closed; both entries use generic waiting recovery text',()=>{
 const s=fresh();assert(buy(s,'dog').ok);assert(!PG.hasRoom(s,E,'c77',manifests.cat,{manifestOf:()=>null}));
 for(const file of ['../../app.js','../game/app.js']){const src=fs.readFileSync(path.join(__dirname,file),'utf8');assert(!src.includes('小狗跑出来了'));assert(src.includes('宠物跑出来了'));assert(src.includes('manifestOf:petManifest'));}
});
console.log(n+' capacity cases passed (narrow synthetic geometry plus real integer furniture); no physical-device claims');

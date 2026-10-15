// Run real root/pet click, movement and action lifecycle functions, with a small DOM shell.
const assert = require('assert'), fs = require('fs');
const E = require('./economy'), HA = require('./home/home-autonomy'), HI = require('./home-interaction');
function extract(src, name) {
  const i = src.indexOf('function ' + name + '('); assert(i >= 0, name);
  let depth = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
  }
  throw Error(name);
}
function harness(file, items, period = 'night', source = null) {
  const src = source || fs.readFileSync(file, 'utf8');
  const names = ['homeLiveTap','homeAutoTick','homeAutoCancel','homeAutoHold','homeAutoList','homeFreePoint','homeActorOf','homeLeavePose','homeAutoBeside','homeAutoWallStand','homeAutoStandPoint','homeAutoSolids','homeAutoFreeCells','homeAutoMove','homeAdvanceActor','homeAutoStart'];
  return new Function('E','HA','HomeInteraction','items','period', `
    const Math=Object.create(globalThis.Math); Math.random=()=>.5;
    const state=E.newState(0), H=E.homeOf(state,'c77'); H.placed=items;
    const homeActor={}, HA_STAND=['eat','use','water','lamp','wall','pet'], messages=[];
    let clock=10, dirty=false, homeWho='c77', homeDrag=null, frozen=false, tab='home',homeSub='room',homeMode='live',lit=null,autoSays=0;
    const HS=null, document={hidden:false}, homeAutoPeriod=()=>period, homeAutoPets=()=>[], homeAutoReduced=()=>false;
    const homeDrawActor=()=>{}, sfx=()=>{}, toast=s=>messages.push(s), liveLine=(id,act)=>act;
    const homeLightOn=uid=>{lit=uid},homeLightOff=()=>{lit=null},homeAutoSay=()=>{autoSays++};
    const floor={getBoundingClientRect:()=>({left:0,top:0,width:600,height:400})}, $=s=>s==='#roomFloor'?floor:null;
    ${names.map(n=>extract(src,n)).join('\n')}
    const ac=homeActorOf('c77'); ac.x=0;ac.y=3;
    return {ac,messages,state, get lit(){return lit},get autoSays(){return autoSays},
      tap(uid){const p=items.find(p=>p.uid===uid),surface=p&&E.itemSurf(p)==='wall'?'#roomWall':'#roomFloor';homeLiveTap({clientX:350,clientY:350,target:{closest:s=>s.includes(surface+' .furn')&&p?{dataset:{uid}}:s===surface?floor:null}})},
      step(sec){for(let t=0;t<sec;t+=.02){clock+=.02;homeAdvanceActor(.02)}},
      decor(){homeMode='decor';homeAutoHold('c77')},
      autonomous(){ac.auto.player=false;ac.autoHold=0},
      tickAt(time){clock=time;homeAutoTick('c77',ac)},
      now:()=>clock};
  `)(E, HA, HI, items, period);
}
const P=(fid,uid='target',x=2,y=1)=>({uid,fid,x,y,rot:0,...(E.FURN_BY_ID[fid].wall?{surf:'wall',y:0}:{})});
let n=0;const ok=(label,fn)=>{if(process.env.TEST_FILTER&&!label.includes(process.env.TEST_FILTER))return;fn();n++;console.log('PASS',label)};
for(const file of ['app.js','pet/game/app.js']) {
  // Compare the actual pre-128 lifecycle against the candidate with identical inputs/RNG.
  const baseline = require('child_process').execFileSync('git', ['show', 'aea60f7f373c4045f33b90fdbf42f2cb8cefb7d5:'+file], {encoding:'utf8'});
  ok(file+' manual completion preserves autonomous last choice and next selection vs baseline',()=>{
    for(const previous of [undefined,'target','other']) {
      const current=harness(file,[P('furn_plant')]), before=harness(file,[P('furn_plant')],'night',baseline);
      for(const h of [before,current]) {h.ac.autoLast=previous;h.tap('target');h.step(25);}
      assert.strictEqual(current.ac.autoLast,before.ac.autoLast,'manual action must not become autonomous last choice');
      for(const h of [before,current]) {h.tickAt(70);h.tickAt(77.5);}
      assert.strictEqual(current.ac.auto.kind,before.ac.auto.kind);
      assert.strictEqual(current.ac.auto.pace,before.ac.auto.pace);
      assert.strictEqual(current.ac.auto.uid,before.ac.auto.uid);
      if(previous!=='target')assert.strictEqual(current.ac.auto.kind,'water');
      else assert.strictEqual(current.ac.auto.pace,true);
    }
  });
  ok(file+' idle countdown begins only after full player hold vs baseline (fixed RNG .5 = 7.5s)',()=>{
    const current=harness(file,[P('furn_plant')]), before=harness(file,[P('furn_plant')],'night',baseline);
    for(const h of [before,current]) {h.tap('target');h.step(25);h.tickAt(69.999);}
    assert.strictEqual(before.ac.auto,null);
    assert.strictEqual(current.ac.auto,null,'no pre-created autonomous idle during player hold');
    for(const h of [before,current]) h.tickAt(70);
    assert.deepStrictEqual(current.ac.auto,before.ac.auto);
    assert.deepStrictEqual(current.ac.auto,{phase:'idle',until:77.5});
    for(const h of [before,current]) h.tickAt(77.499);
    assert.strictEqual(current.ac.auto.phase,'idle');assert.deepStrictEqual(current.ac.auto,before.ac.auto);
    for(const h of [before,current]) h.tickAt(77.5);
    assert.strictEqual(current.ac.auto.phase,'moving');assert.deepStrictEqual(current.ac.auto,before.ac.auto);
  });
  for(const kind of ['eat','water','lamp','use','wall']) ok(file+' '+kind+' all whitelist IDs, arrival, original line/icon, repeat click, cleanup',()=>{
    for(const fid of HA.IDS[kind]) {
      const h=harness(file,[P(fid)]), saved=JSON.stringify(h.state);
      h.tap('target');assert(h.ac.auto?.player,fid);assert.equal(h.ac.auto.kind,kind);assert(!h.ac.actIcon);
      h.step(3);assert.equal(h.ac.auto.phase,'stay');assert.equal(h.ac.act,kind);assert.equal(h.ac.actIcon,HA.iconFor(kind,'c77'));assert(HA.linesFor(kind,'c77').includes(h.ac.line));
      assert.equal(h.autoSays,0); if(kind==='wall')assert(h.ac.y<=1&&h.ac.x>=2);
      if(kind==='lamp')assert.equal(h.lit,'target');
      h.tap('target');h.step(1);assert.equal(h.ac.auto.kind,kind);assert(HA.linesFor(kind,'c77').includes(h.ac.line));
      h.step(20);assert(!h.ac.actIcon);assert.equal(h.lit,null);assert.equal(h.ac.auto,null);
      assert.equal(JSON.stringify(h.state),saved,'interaction must not mutate save');assert(!h.messages.length);
    }
  });
  ok(file+' lamps only dusk/night; missing period and blocked wall do nothing',()=>{
    for(const p of [null,'morning','day']) {const h=harness(file,[P('furn_lamp')],p);h.tap('target');assert(!h.ac.auto);assert(!h.ac.actIcon)}
    const dusk=harness(file,[P('furn_lamp')],'dusk');dusk.tap('target');assert(dusk.ac.auto.player);
    const wall=P('furn_painting'), blockers=[];
    for(let y=0;y<2;y++)for(let x=0;x<6;x++)blockers.push(P('furn_plant','b'+x+y,x,y));
    const h=harness(file,[wall,...blockers]);h.tap('target');assert(!h.ac.auto);assert(!h.ac.actIcon);
  });
  ok(file+' sit/lie/rug/read/dress and unmatched furniture keep previous behavior',()=>{
    for(const [fid,act,pose] of [['furn_sofa','sit','sit'],['furn_bed','rest','lie'],[HA.RUG_FID,'sit','sit'],['furn_bookshelf','read',null],['furn_wardrobe','dress',null],['furn_catbed','walk',null]]) {
      const h=harness(file,[P(fid)]);h.tap('target');assert.equal(h.ac.act,act,fid);assert.equal(h.ac.pendingPose?.kind,pose);assert(!h.ac.auto?.player);
      assert.equal(h.messages.length,fid==='furn_catbed'?1:0);
    }
  });
  ok(file+' cancel moving/staying clears icons/light; autonomous speech path stays original',()=>{
    for(const wait of [0,3]) {const h=harness(file,[P('furn_lamp')]);h.tap('target');h.step(wait);h.decor();h.step(10);assert.equal(h.ac.auto,null);assert(!h.ac.actIcon);assert.equal(h.lit,null);assert.equal(h.ac.tx,null)}
    const h=harness(file,[P('furn_plant')]);h.tap('target');h.autonomous();h.step(3);assert.equal(h.autoSays,1);
  });
}
console.log(n+'/'+n+' PASS');

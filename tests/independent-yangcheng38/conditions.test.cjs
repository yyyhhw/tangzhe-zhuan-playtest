// Run: QA_SOURCE=/absolute/checkout node --test conditions.test.cjs
// These assertions intentionally fail on pre-feature main. They do not implement awards.
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(process.env.QA_SOURCE||path.join(__dirname,'main'));
const conditional=['k_3','k_4','k_8'],random=['k_1','k_2','k_5','k_6','k_7'];
for(const scope of ['', 'preview/']){
 const E=require(path.join(root,scope,'economy.js')),name=scope||'formal';
 const fresh=()=>{const s=E.newState(1792022400000);s.coins=1e10;s.shops.forEach(x=>{x.open=true;x.emp=1;});return s;};
 test(name+': exactly five story cards in random pool, three excluded',()=>assert.deepEqual(E.gachaRemaining(fresh()).filter(x=>x.type==='card').map(x=>x.id).sort(),random));
 test(name+': price / superclass probability / pity unchanged',()=>{assert.equal(E.gachaPrice(fresh()),200000);assert.equal(E.CFG.SUPER_P,.1);assert.equal(E.CFG.SUPER_PITY,15);});
 test(name+': ordinary and super RNG bucket midpoints never draw condition cards',()=>{
  const s=fresh(),o=E.gachaOdds(s);
  for(const [count,start,weight] of [[o.remSuper,0,o.superP],[o.remReg,o.superP,o.regP]])for(let i=0;i<count;i++){
   const r=E.gachaDraw(fresh(),start+weight*(i+.5)/count);assert.equal(r.ok,true);assert(!conditional.includes(r.item.id),r.item.id+' appeared in RNG bucket');
  }
 });
 test(name+': exhaustion never repeats; condition cards not needed to exhaust random pool',()=>{
  const s=fresh(),seen=new Set();let steps=0;
  while(!E.gachaComplete(s)&&steps++<1000){const r=E.gachaDraw(s,.5);assert.equal(r.ok,true);assert(!seen.has(r.item.id));seen.add(r.item.id);}
  assert(steps<1000);assert.equal(E.gachaDraw(s,.5).ok,false);for(const id of conditional)assert(!seen.has(id),'condition card drawn '+id);
 });
 test(name+': pity and exhausted-super fallback remain valid',()=>{
  let s=fresh();s.gacha.pity=14;assert.equal(E.gachaDraw(s,.99).item.type,'super');
  s=fresh();s.gacha.owned=E.SUPER_ITEMS.map(x=>x.id);s.gacha.pity=14;assert.equal(E.gachaOdds(s).superP,0);assert.notEqual(E.gachaDraw(s,.99).item.type,'super');
  s=fresh();s.gacha.owned=E.gachaRemaining(s).filter(x=>x.type!=='super').map(x=>x.id);assert.equal(E.gachaOdds(s).superP,1);assert.equal(E.gachaDraw(s,.99).item.type,'super');
 });
 test(name+': gold requires all eight cards, not just five random cards',()=>{
  const s=fresh();s.gacha.owned=[...random];assert.equal(E.cardsComplete(s),false);
  for(let missing=1;missing<=8;missing++){s.gacha.owned=Array.from({length:8},(_,i)=>'k_'+(i+1)).filter(x=>x!=='k_'+missing);assert.equal(E.cardsComplete(s),false);}
  s.gacha.owned=[...random,...conditional];assert.equal(E.cardsComplete(s),true);assert.equal(E.SET_REWARD.clothes,'c_gold');assert.equal(E.SET_REWARD.hat,'h_gold');
 });
}

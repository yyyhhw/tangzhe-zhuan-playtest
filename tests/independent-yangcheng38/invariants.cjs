// Independent economy-layer checks; no guessed condition IDs or manuscript.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=__dirname, root=path.resolve(process.argv[2]||path.join(base,'main'));
const baseline=path.join(base,'main'),now=1792022400000,ids=Array.from({length:8},(_,i)=>'k_'+(i+1));
function paths(v,p=''){if(v===null||typeof v!=='object')return [];return Object.keys(v).sort().flatMap(k=>[p+k,...paths(v[k],p+k+'.')]);}
for(const scope of ['', 'preview/']){
 const E=require(path.join(root,scope,'economy.js')),B=require(path.join(baseline,scope,'economy.js'));
 assert.deepEqual(E.ITEMS.filter(x=>x.type==='card').map(x=>x.id).sort(),ids);
 assert.deepEqual(paths(E.newState(now)),paths(B.newState(now)),'new state schema differs from fixed main');
 for(let mask=0;mask<256;mask++){
  const raw=B.newState(now);raw.gacha.owned=ids.filter((_,i)=>mask&(1<<i));
  raw.gacha.last=raw.gacha.owned.at(-1)||null;
  const wanted=[...raw.gacha.owned],s=E.migrate(JSON.parse(JSON.stringify(raw)),now).st;
  assert.deepEqual(s.gacha.owned,wanted,'old card subset '+mask);
  const loaded=E.loadSave(JSON.stringify(s),null,now);
  assert.deepEqual(loaded.st.gacha.owned,wanted,'reload subset '+mask);
 }
 console.log('PASS',scope||'formal','8 catalog IDs, fixed-main fresh schema, 256 synthetic old ownership subsets migrate/JSON/load (not production commit)');
}
console.log('NOT COVERED: condition awards; exact 3/5 split; eight home changes; production schema after condition triggers; historical real save fixtures.');

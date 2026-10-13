/** Fresh synthetic storage maps. No browser or player data is read. */
import {setup} from '../wearables8/fixture.mjs';import fs from 'node:fs';import path from 'node:path';
const out=process.argv[2]||'/tmp/blindbox18-evidence';fs.mkdirSync(out,{recursive:true});
for(const scope of ['formal','preview']){
 const t=await setup(undefined,scope);t.init();const s=JSON.parse(t.data.get(t.keys.main)),home=t.E.testHomesState(Date.now(),3);
 s.homes=home.homes;s.furnInv=home.furnInv;s.ceos=home.ceos;s.shops=home.shops;s.coins=100000000;s.totalEarned=100000000;s.lastSeen=Date.now();s.gacha.last.seen=true;
 t.data.set(t.keys.main,JSON.stringify(s));t.prepare();fs.writeFileSync(path.join(out,`blindbox18-${scope}-p1.json`),JSON.stringify([...t.data]));
}
console.log(out);

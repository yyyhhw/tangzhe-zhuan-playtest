/** Synthetic local evidence only. Never reads browser/player storage. */
import {setup} from '../wearables8/fixture.mjs';
import fs from 'node:fs';import path from 'node:path';
const out=process.argv[2]||'/tmp/decor6-evidence';fs.mkdirSync(out,{recursive:true});
const t=await setup();t.init();fs.writeFileSync(path.join(out,'decor6-p1.json'),JSON.stringify([...t.data]));
const s=JSON.parse(t.data.get(t.keys.main)),home=t.E.testHomesState(Date.now(),3);
s.homes=home.homes;s.furnInv=home.furnInv;s.ceos=home.ceos;s.shops=home.shops;
for(const f of t.E.FURNITURE)s.furnInv[f.id]=(s.furnInv[f.id]||0)+50;
s.customForwardField.history=Array.from({length:500},(_,i)=>({id:i,evidence:'synthetic-history-'+i,known:false,extra:[i,'retain',null]}));
s.gacha.future={entries:Array.from({length:200},(_,i)=>({id:i,raw:'keep'}))};t.data.set(t.keys.main,JSON.stringify(s));t.prepare();
fs.writeFileSync(path.join(out,'decor6-large-p1.json'),JSON.stringify([...t.data]));console.log(out);

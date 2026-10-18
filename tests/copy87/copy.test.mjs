import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {delta,withoutCopy87Delta} from './exact-copy-delta.mjs';
import {prepareEightWearableCatalog} from '../../qa-protocol2/eight-catalog.mjs';
import {prepareSecondEightCatalog} from '../../collectibles/wearables18-catalog.mjs';
import {prepareDecor6Catalog} from '../../collectibles/decor6-catalog.mjs';
import {prepareBox200Catalog} from '../../collectibles/box200-catalog.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex'),require=createRequire(import.meta.url);
test('copy87 changes exactly three player-facing strings; all control flow and recovery copy retain main bytes',()=>{
  for(const [file,row]of Object.entries(delta)){
    const source=read(file),check=s=>assert.equal(hash(withoutCopy87Delta(file,s)),row.mainSha256);
    check(source);
    for(const [after]of row.replacements){assert.throws(()=>check(source.replace(after,'')));assert.throws(()=>check(source+after));assert.throws(()=>check(source.replace(after,after+'篡改')));}
    assert.throws(()=>check(source+'\n/* unrelated */'));
    if(file.endsWith('/entry.mjs'))assert.throws(()=>check(source.replace("const autoUpgrade=scope==='formal'","const autoUpgrade=true")));
    else assert.throws(()=>check(source.replace('approved!==true','false')));
  }
});
for(const scope of ['formal','preview'])test(scope+' actual catalog and odds substantiate copy without assuming a denominator',()=>{
  const file=new URL('../../'+(scope==='preview'?'preview/':'')+'economy.js',import.meta.url).pathname;delete require.cache[require.resolve(file)];const E=require(file);
  assert.equal(E.ITEMS.length,36);
  for(const prepare of [prepareEightWearableCatalog,prepareSecondEightCatalog,prepareDecor6Catalog,prepareBox200Catalog])prepare(E).setActive(true);
  assert.equal(E.ITEMS.length,200);assert.equal(E.ITEMS.filter(x=>x.hidden).length,8);assert.equal(E.SUPER_ITEMS.length,4);assert.equal(E.ITEMS.filter(x=>!x.hidden&&x.type!=='super').length,188);
  const s=E.newState(1700000000000),pool=E.gachaRemaining(s),odds=E.gachaOdds(s);
  assert(pool.every(x=>!x.hidden&&!x.cond));assert.equal(odds.remReg,scope==='formal'?185:188);assert.equal(odds.perReg,.9/odds.remReg);assert.equal(odds.superP,.1);assert.equal(E.gachaPrice(s),200000);
  s.gacha.pity=14;assert.equal(E.gachaOdds(s).superP,1);s.gacha.pity=0;
  s.gacha.owned=[pool.find(x=>x.type!=='super').id];assert(!E.gachaRemaining(s).some(x=>s.gacha.owned.includes(x.id)));assert.equal(E.gachaOdds(s).remReg,odds.remReg-1);
  s.gacha.owned=E.SUPER_ITEMS.map(x=>x.id);assert.equal(E.gachaOdds(s).superP,0);
  s.gacha.owned=pool.filter(x=>x.type!=='super').map(x=>x.id);assert.equal(E.gachaOdds(s).superP,1);
});

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {cacheDelta,withoutCopy87CacheDelta} from './exact-copy-delta.mjs';
import {assertEntryChain,TOKEN} from '../integration155/entry-chain.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
test('copy87 cache delta restores exact previous candidate; rejects missing/duplicate/stale lines and unrelated changes',()=>{
  for(const [file,row]of Object.entries(cacheDelta)){
    const s=read(file),check=value=>assert.equal(hash(withoutCopy87CacheDelta(file,value)),row.priorSha256);
    check(s);
    for(const [after]of row.replacements){
      assert.throws(()=>check(s.replace(after,'')));assert.throws(()=>check(s+after));
      if(after.includes(TOKEN))assert.throws(()=>check(s.replace(after,after.replaceAll(TOKEN,'stale'))));
    }
    assert.throws(()=>check(s+'\n/* unrelated */'));
  }
});
test('copy87 legacy-entry, formal CSS/economy and both stale-lock guard tokens cannot regress independently',()=>{
  assertEntryChain(read);
  for(const [file,from,to]of [
    ['collectibles/entry.mjs','legacy-entry.mjs?v='+TOKEN,'legacy-entry.mjs?v=xingtu135-20261015-r1'],
    ...['index.html','pet/game/index.html'].flatMap(f=>['style.css','economy.js'].map(a=>[f,a+'?v='+TOKEN,a+'?v=home150-151-money152-20261017-r1'])),
    ...['app.js','pet/game/app.js'].map(f=>[f,'formal-'+TOKEN,'formal-home150-151-money152-20261017-r1'])
  ]){assert(read(file).includes(from));assert.throws(()=>assertEntryChain(p=>p===file?read(p).replaceAll(from,to):read(p)));}
});

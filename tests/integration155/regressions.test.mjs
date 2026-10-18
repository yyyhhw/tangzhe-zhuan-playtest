import {withoutHome43CacheDelta,home43Cache} from '../home43/exact-delta.mjs';
import {withoutHome155Delta} from '../home155/protection-delta.mjs';
import {withoutCopy166Delta} from '../copy166/exact-copy-delta.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {withoutIntegrationCacheDelta,withoutStoryFrameDelta,withoutPreviewUxDelta} from './exact-delta.mjs';
import {assertEntryChain,TOKEN} from './entry-chain.mjs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const extract=(s,n)=>s.match(new RegExp(`function ${n}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))[0];
test('exact cache deltas reject missing, duplicate and changed imports; preserve guard mutations',()=>{
  const rows=JSON.parse(read('tests/integration155/cache-import-delta.json'));
  for(const [file,deltas]of Object.entries(rows)){
    const s=withoutHome43CacheDelta(file,read(file)),baseline=withoutIntegrationCacheDelta(file,s); // 家宅-43 缓存号叠在上面：先撤
    for(const [after]of deltas){
      for(const bad of [s.replace(after,''),s+after,s.replace(after,after.replace(home43Cache.old,'stale'))])assert.throws(()=>withoutIntegrationCacheDelta(file,bad),/NOT_EXACT/);
    }
    const guard=file.includes('card-coordinator')?"if(!lease.owns())fail('LOCK_NOT_OWNED');":"if(!validMilestones(s))error('MILESTONES_INVALID');";
    assert(s.includes(guard));assert.notEqual(hash(withoutIntegrationCacheDelta(file,s.replace(guard,''))),hash(baseline));
  }
});
test('published frame hashes allow exactly one story hook; autosave mutation is still rejected',()=>{
  const rows=JSON.parse(read('tests/decor6/published15-integrity.json'));
  for(const file of ['app.js','pet/game/app.js']){
    const frame=extract(read(file),'frame'),expected=rows.find(x=>x.file===file&&x.name==='frame').sha256;
    const normalized=s=>hash(withoutStoryFrameDelta(file,'frame',s));
    assert.equal(normalized(frame),expected);
    assert.throws(()=>normalized(frame.replace('  storyRefreshPeriod();\n','')),/NOT_EXACT/);
    assert.notEqual(normalized(frame.replace('  storyRefreshPeriod();\n','  storyRefreshPeriod();\n  storyRefreshPeriod();\n')),expected);
    assert.notEqual(normalized(frame.replace('persist.nextAutoAt','Infinity')),expected);
    assert.notEqual(normalized(frame.replace('saveBlocked','false')),expected);
  }
});
test('actual story refresh handles boundaries and inactive views without save/state writes',()=>{
  for(const file of ['app.js','pet/game/app.js']){
    const c={tab:'home',homeSub:'room',homeMode:'live',dirty:false,period:'dusk',state:Object.freeze({coins:17})};c.storyPeriod=()=>c.period;
    vm.createContext(c);vm.runInContext('let storyObservedPeriod=null;\n'+extract(read(file),'storyRefreshPeriod'),c);
    const act=()=>vm.runInContext('storyRefreshPeriod()',c);
    act();assert(c.dirty);c.dirty=false;act();assert.equal(c.dirty,false);
    c.period='night';act();assert(c.dirty);c.dirty=false;act();assert.equal(c.dirty,false);
    for(const [key,value]of [['tab','shop'],['homeSub','mall'],['homeMode','decor']]){
      const old=c[key];c[key]=value;c.period='dusk';act();assert.equal(c.dirty,false);
      c[key]=old;act();assert(c.dirty);c.dirty=false;c.period='night';act();assert(c.dirty);c.dirty=false;
    }
    assert.deepEqual(c.state,{coins:17});
  }
});
test('cache chain rejects each stale entry, bootstrap and loaded app token',()=>{
  assertEntryChain(read);
  for(const file of ['index.html','pet/game/index.html','preview/index.html','preview/pet/game/index.html','version.json','pet/game/version.json','preview/version.json','preview/pet/game/version.json','app.js','pet/game/app.js','collection/bootstrap.mjs','preview/collection/bootstrap.mjs','collectibles/entry.mjs','qa-protocol2/entry.mjs']){
    assert.throws(()=>assertEntryChain(p=>p===file?read(p).replaceAll(TOKEN,'stale'):read(p)),undefined,file);
  }
});
test('actual stale-lock guard redirects once to current version, then refuses without storage access',async()=>{
  for(const file of ['app.js','pet/game/app.js']){
    const s=read(file),body=s.slice(s.indexOf('const E ='),s.indexOf('const STORAGE ='));
    const version=JSON.parse(read(file.replace('app.js','version.json'))).v;
    for(const token of ['obsolete',version]){
      const redirects=[],notices=[];const context={URL,window:{Economy:{CFG:{}}},location:{href:'http://localhost/?v='+token,replace:u=>redirects.push(u)},document:{createElement:()=>({}),body:{prepend:n=>notices.push(n.textContent)}}};
      await vm.runInNewContext('(async()=>{'+body+'})()',context);
      if(token==='obsolete'){assert.equal(redirects.length,1);assert.equal(new URL(redirects[0]).searchParams.get('v'),version);assert.equal(notices.length,0);}
      else{assert.equal(redirects.length,0);assert.equal(notices.length,1);assert.match(notices[0],/存档未写入/);}
    }
  }
});

test('preview deltas reconstruct exact main bytes and reject missing, duplicate, modified or unrelated changes',()=>{
  const manifest=JSON.parse(read('tests/integration155/preview-ux-delta.json'));
  for(const [file,deltas]of Object.entries(manifest.deltas)){
    // 体验-166：TOAST_GOOD 在 UX158/160 之后又加了一个词；原样字节先整体比一次，反例在撤掉 166 后的字节上构造。
    const raw=read(file),source=withoutCopy166Delta(file,raw),normalize=s=>withoutHome155Delta(file,withoutPreviewUxDelta(file,s));
    assert.equal(hash(normalize(raw)),manifest.mainSha256[file]);
    assert.equal(hash(normalize(source)),manifest.mainSha256[file]);
    for(const [after]of deltas)for(const bad of [source.replace(after,''),source+after,source.replace(after,after.replace('const TOAST_GOOD','const WRONG').replace("case 'homeWho'","case 'wrong'"))])assert.throws(()=>normalize(bad),/NOT_EXACT/);
    assert.notEqual(hash(normalize(source+'\n/* unrelated */')),manifest.mainSha256[file]);
  }
});

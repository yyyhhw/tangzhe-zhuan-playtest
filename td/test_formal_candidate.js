'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8'),base=p=>cp.execFileSync('git',['show','70d43b6:'+p],{encoding:'utf8'}),v='15-td-balance1';
for(const dir of ['', 'pet/game/']){assert.equal(JSON.parse(read(dir+'version.json')).v,v);assert(read(dir+'index.html').includes("var B='"+v+"'"));for(const p of ['app.js','economy.js'])assert(read(dir+'index.html').includes(p+'?v='+v));}
for(const p of ['tdcore.js','tdhost.js'])assert(read('index.html').includes('td/'+p+'?v='+v));
for(const p of ['td.css','tdcore.js','tdsfx.js','tdproto.js','td.js'])assert(read('td/index.html').includes(p+'?v='+v));
assert(read('app.js').includes('td/index.html?embed=1&v='+v));assert(!read('app.js').slice(read('app.js').indexOf('function tdCard()'),read('app.js').indexOf('const tdController')).includes('样品'));
const strip=s=>s.replace(/    \/\/ Optional for old saves\.[\s\S]*?(?=    if \(has\('v'\))/, '');
assert.equal(strip(read('economy.js')),strip(base('economy.js')));assert.equal(strip(read('pet/game/economy.js')),strip(base('pet/game/economy.js')));
assert.equal(read('pet/game/app.js'),base('pet/game/app.js'));assert.equal(read('upgrade-snapshot.js'),base('upgrade-snapshot.js'));
assert.equal(cp.execFileSync('git',['diff','70d43b6','--','preview','zombie','art','pet/art'],{encoding:'utf8'}),'');
const P=require('./tdproto'),T=require('./tdcore');assert.equal(P.KEY,'tangzhe-formal-td-proto-v1');assert.equal(P.LEGACY,'tangzhe-td-proto');
for(const file of ['../economy','../pet/game/economy']){const E=require(file),s=E.newState(Date.now());s.coins=5e10;s.td=T.norm();s.td.lv.bbq=4;T.applyEndless(s.td,{runId:'keep-score',waves:9,kills:99});const old=JSON.parse(JSON.stringify(s));assert.deepEqual(E.checkSave(old),[]);s.td.endless.top[0].score=-1;assert(E.checkSave(s).includes('td.endless.top'));assert.equal(old.coins,5e10);}
console.log('Formal candidate: cache, scope, unchanged wallet functions, root/pet TD validation and key isolation passed');

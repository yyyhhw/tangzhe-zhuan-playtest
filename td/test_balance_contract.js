const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');const s=fs.readFileSync(path.join(__dirname,'test_td_energy.js'),'utf8').split('check(()=>')[0];const create=new Function('require','__dirname',s+';return game;')(require,__dirname);let n=0;
for(const wave of [1,3,4,5,10]){const f=create('c77');f.api.G.wave=wave;f.api.spawn('walk');assert(Math.abs(f.api.G.es[0].max-30*1.17**(wave-1)*(1+.5*Math.max(0,wave-3)))<1e-8);n++;}
const f=create('pearl'),a=f.api,g=a.G;g.wave=10;a.spawn('boss');assert(Math.abs(g.es[0].max-800*1.17**9)<1e-8);g.breakT=0;g.es[0].d=a.PLEN-.001;a.step(1/60);assert.equal(g.lives,0);assert.equal(g.win,false);n+=3;
const e=create('rocket');e.api.G.endless=true;e.api.G.wave=15;e.api.spawn('boss');assert(Math.abs(e.api.G.es[0].max-2200*1.17**9*1.12**5)<1e-8);n++;
const h=create('otaku');h.ctx.window.advanceTime(0);assert(h.node('#skillBtn').disabled);assert(h.node('#skillBtn').textContent.includes('战斗开始可用'));assert(!h.api.activateSkill());n+=3;
console.log('Balance contract:',n,'checks passed');

'use strict';
const fs=require('fs'),assert=require('assert/strict');
const prefix=fs.readFileSync(__dirname+'/test_td_energy.js','utf8').split('check(()=>')[0];
const game=new Function('require','__dirname',prefix+';return game;')(require,__dirname);
let checks=0;
for(const speed of [1,2]){
 const f=game('pearl'),a=f.api,g=a.G;a.setSpeed(speed);a.advanceClock(19.9);assert.equal(g.wave,0);assert.equal(g.cash,120);assert(a.build('bbq',0,0));a.advanceClock(.1);assert.equal(g.wave,1);checks++;
}
function state(f){const g=f.api.G;return JSON.stringify({wave:g.wave,lives:g.lives,cash:g.cash,earned:g.energyEarned,budget:g.normalBudget,t:g.t,kills:g.kills,es:g.es,q:g.q,tw:[...g.tw],skill:[g.skillLeft,g.skillCooldown],interest:g.interestSeconds,fx:g.fx});}
for(const cmd of ['c77','pearl','otaku','rocket']){
 const x=game(cmd),y=game(cmd);for(const f of [x,y]){f.api.build('book',2,2);f.api.advanceClock(20);f.api.activateSkill();}y.api.setSpeed(2);
 x.api.advanceClock(8);y.api.advanceClock(4);assert.equal(state(x),state(y));checks++;
}
const f=game('pearl'),a=f.api,g=a.G;a.advanceClock(10);const before=state(f);a.setPause(true);a.advanceClock(100);assert.equal(state(f),before);a.setPause(false);f.ctx.document.hidden=true;a.advanceClock(100);assert.equal(state(f),before);f.ctx.document.hidden=false;a.advanceClock(10);assert.equal(g.wave,1);a.start(1);assert.equal(a.G.speed,1);assert.equal(a.G.breakT,20);checks++;
{const f=game('pearl'),a=f.api,g=a.G;for(const [i,id] of ['t77','tpearl','totaku','trocket'].entries()){g.cash=400;assert(a.build(id,i,0));const cash=g.cash;assert(!a.build(id,4,0));assert.equal(g.cash,cash);}assert.equal(g.tw.size,4);assert(a.sell(0,0));g.cash=400;assert(a.build('t77',0,0));checks++;}
{const f=game('pearl'),a=f.api,g=a.G;for(let x=0;x<3;x++){g.cash=400;assert(a.build('tea',x,0));assert.equal(g.cash,340);}checks++;}
{const x=game('rocket'),y=game('rocket');for(const f of [x,y]){f.api.advanceClock(20);f.api.setSpeed(2);}for(let i=0;i<240;i++)x.api.advanceClock(1/60);for(let i=0;i<16;i++)y.api.advanceClock(.25);assert.equal(state(x),state(y));checks++;}
console.log('Speed/build contracts:',checks,'passed');
// Pause/visibility and switches cannot create catch-up time; later preparation stays five real seconds.
{const f=game('otaku'),a=f.api,g=a.G;g.wave=1;g.breakT=0;a.setSpeed(2);a.advanceClock(4.9);assert.equal(g.wave,1);a.advanceClock(.1);assert.equal(g.wave,2);}
{const f=game('pearl'),a=f.api;for(let i=0;i<50;i++){a.setSpeed(i%2+1);a.advanceClock(.1);}assert(Math.abs(a.G.breakT-15)<1e-8);a.setPause(true);a.advanceClock(600);a.setPause(false);assert(Math.abs(a.G.breakT-15)<1e-8);}
// Same natural no-input loss and immutable result at both speeds (no state injection).
{const results=[];for(const speed of [1,2]){const f=game('pearl'),a=f.api;a.setSpeed(speed);for(let i=0;i<60000&&!a.G.over;i++)a.advanceClock(1/60);const g=a.G;assert(g.over);results.push({lives:g.lives,cash:g.cash,kills:g.kills,wave:g.wave,result:{...g.resMsg,runId:null}});}assert.deepEqual(results[0],results[1]);}
console.log('Later countdown, rapid switches and natural loss settlement equivalence passed');

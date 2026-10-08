'use strict';
const fs=require('fs'),assert=require('assert/strict');const prefix=fs.readFileSync(__dirname+'/test_td_energy.js','utf8').split('check(()=>')[0];const game=new Function('require','__dirname',prefix+';return game;')(require,__dirname);
(async()=>{
for(const [cmd,budget]of Object.entries({c77:1616,pearl:1627,otaku:1510,rocket:1615})){
 const f=game(cmd),a=f.api,g=a.G;assert.equal(g.normalBudget,budget);assert.equal(g.energyEarned,cmd==='c77'?180:120);
 // Holding cap only charges actually credited income, never overflow.
 const initial=g.energyEarned;a.gainEnergy(10000);assert.equal(g.cash,400);assert.equal(g.energyEarned,initial+400-initial);assert.equal(a.gainEnergy(20),0);assert.equal(g.energyEarned,400);
 // Exhaust cumulative budget using real build/sell spending; refunds never refill it.
 for(let i=0;i<100&&g.energyEarned<budget;i++){assert(a.build('bbq',0,0));const earned=g.energyEarned;assert(a.sell(0,0));assert.equal(g.energyEarned,earned);a.gainEnergy(100);}
 assert.equal(g.energyEarned,budget);assert(a.build('bbq',0,0));const before=g.cash;assert(a.sell(0,0));assert.equal(g.cash,before+36);assert.equal(g.energyEarned,budget);assert.equal(a.gainEnergy(100),0);
 const cash=g.cash;assert(!a.gainEnergy(NaN));assert(!a.gainEnergy(-1));assert.equal(g.cash,cash);
 // Enter endless through normal settlement and preserve record/cash; income resumes.
 g.wave=10;g.kills=181;a.end(true);await g.savePromise;const result=g.resMsg;assert(a.continueEndless());assert.equal(g.cash,cash);assert.equal(g.energyEarned,budget);assert(a.gainEnergy(1)>0);assert.equal(g.energyEarned,budget);assert.equal(g.normalResult,result);
}
// Actual time, wave and kill routes cannot exceed remaining allowance.
for(const route of ['time','wave','kill']){const f=game('rocket'),a=f.api,g=a.G;g.normalBudget=g.energyEarned+1;g.wave=1;g.breakT=0;if(route==='wave'){a.step(.01);}else{a.spawn('walk');if(route==='kill')a.hit(g.es[0],1e6,null,'book');else a.step(2);}assert.equal(g.energyEarned,g.normalBudget);assert.equal(g.cash,121);}
console.log('Cumulative energy: four budgets, credited-income cap, no refund recycling, income routes, settled endless transition passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

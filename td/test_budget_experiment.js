// Experimental budget measurement only. Does not change shipping source or saves.
// Initial energy counts; credited kill/wave/time income counts; refunds do not reset budget.
const fs=require('fs');const base=fs.readFileSync(__dirname+'/td.js','utf8');
let harness=fs.readFileSync(__dirname+'/test_td_energy.js','utf8').split('check(()=>')[0];harness=harness.replace("fs.readFileSync(__dirname+'/td.js','utf8')",'source');
function run(cmd,budget,count,kind){
 const source=base;
 const create=new Function('require','__dirname','source',harness+';return game;')(require,__dirname,source);const f=create(cmd),a=f.api,g=a.G;if(budget!==null)g.normalBudget=budget;const same={c77:'t77',pearl:'tpearl',otaku:'totaku',rocket:'trocket'}[cmd];
 const types=kind===0?[same,'tea','tech','book']:kind===1?['book','tea','tech','book']:kind===2?['tech','tea','tech','book']:['book','book','tech','tea'];
 const cells=[];for(let y=0;y<11;y++)for(let x=0;x<7;x++)if(!a.isPath(x,y))cells.push({x,y});
 function place(id){const range=a.TW[id].range;const spots=cells.filter(p=>!g.tw.has(p.x+','+p.y)).map(p=>({...p,score:Array.from({length:77},(_,k)=>[k%7,Math.floor(k/7)]).filter(([x,y])=>a.isPath(x,y)&&Math.hypot(p.x-x,p.y-y)<=range).length})).sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);return spots.length&&a.build(id,spots[0].x,spots[0].y);}
 for(let tick=0;tick<60*600&&!g.over;tick++){if(tick%30===0){if(g.tw.size<count){const i=g.tw.size;place(types[i<4?i:1+(i-4)%3]);}else for(const t of [...g.tw.values()].sort((a,b)=>a.lv-b.lv)){if(a.upTower(t.x,t.y))break;}a.activateSkill();}a.step(1/60);}
 return {cmd,budget,count,kind,win:g.win,lives:g.lives,wave:g.wave,granted:g.energyEarned,cash:g.cash,layout:[...g.tw.values()]};
}
module.exports={run};
if(require.main===module){
const results=[];
for(const cmd of ['c77','pearl','otaku','rocket']){let best=null;for(const count of [4,6,8,10,12])for(const kind of [0,1,2,3]){const r=run(cmd,10000,count,kind);if(!r.win)continue;let low=cmd==='c77'?180:120,high=Math.ceil(r.granted);while(high-low>10){const mid=Math.floor((low+high)/2),v=run(cmd,mid,count,kind);if(v.win)high=mid;else low=mid;}const v=run(cmd,high,count,kind);if(v.win&&(!best||v.budget<best.budget))best=v;}results.push(best||{cmd,win:false});console.log(JSON.stringify(best||{cmd,win:false}));}
fs.mkdirSync(__dirname+'/evidence/speed',{recursive:true});fs.writeFileSync(__dirname+'/evidence/speed/budget-experiment.json',JSON.stringify({method:'Finite heuristic strategies, binary search to 10 energy; not global optimum or proof of monotonicity; default permanent upgrades zero',results},null,2));

}

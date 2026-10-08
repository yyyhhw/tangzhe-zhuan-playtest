// Deterministic natural simulation: public build/upgrade/skill APIs, default zero upgrades.
// No enemy/health/cash/victory injection. Node DOM/audio mocks, not a browser playthrough.
const fs=require('fs'),path=require('path');
let harness=fs.readFileSync(path.join(__dirname,'test_td_energy.js'),'utf8').split('check(()=>')[0];
harness=harness.replace("fs.readFileSync(__dirname+'/td.js','utf8')","fs.readFileSync(process.env.TD_SOURCE||__dirname+'/td.js','utf8')");
const create=new Function('require','__dirname','process',harness+';return game;')(require,__dirname,process);
function run(cmd,strategy){
 const f=create(cmd),a=f.api,g=a.G,rows=[];
 const same={c77:'t77',pearl:'tpearl',otaku:'totaku',rocket:'trocket'}[cmd];
 const ids=strategy==='dps'?['trocket','book','tech','t77','tpearl','trocket','book','tech']:[same,'tea','tech','book','trocket','tea','t77','tpearl'];
 const limit=strategy==='minimal'?3:8;
 const cells=[];for(let y=0;y<11;y++)for(let x=0;x<7;x++)if(!a.isPath(x,y))cells.push({x,y});
 function place(id){const range=a.TW[id].range;const ranked=cells.filter(p=>!g.tw.has(p.x+','+p.y)).map(p=>({...p,score:cells.length&&Array.from({length:77},(_,k)=>[k%7,Math.floor(k/7)]).filter(([x,y])=>a.isPath(x,y)&&Math.hypot(p.x-x,p.y-y)<=range).length})).sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);return ranked.length&&a.build(id,ranked[0].x,ranked[0].y);}
 let prev=-1;
 for(let tick=0;tick<60*1200&&!g.over;tick++){
  if(tick%30===0){if(g.tw.size<limit)place(ids[g.tw.size]);else for(const t of [...g.tw.values()].sort((a,b)=>a.lv-b.lv)){if(a.upTower(t.x,t.y))break;}a.activateSkill();}
  if(g.wave!==prev){rows.push({cmd,strategy,wave:g.wave,lives:g.lives,cash:Math.floor(g.cash),towers:g.tw.size,seconds:Math.round(g.t)});prev=g.wave;}
  a.step(1/60);
 }
 rows.push({cmd,strategy,wave:g.wave,result:g.win?'win':'lose',lives:g.lives,cash:Math.floor(g.cash),towers:g.tw.size,seconds:Math.round(g.t)});
 return {cmd,strategy,win:g.win,lives:g.lives,wave:g.wave,rows,layout:[...g.tw.values()].map(t=>({id:t.id,x:t.x,y:t.y,lv:t.lv}))};
}
const out=[];for(const cmd of ['c77','pearl','otaku','rocket'])for(const strategy of (['c77','pearl'].includes(cmd)?['balanced','minimal','dps']:['balanced']))out.push(run(cmd,strategy));
if(process.env.BALANCE_OUT)fs.writeFileSync(process.env.BALANCE_OUT,JSON.stringify(out,null,2));console.log(out.map(({rows,layout,...s})=>s));

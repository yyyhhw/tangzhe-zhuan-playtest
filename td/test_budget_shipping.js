require('fs').mkdirSync(__dirname+'/evidence/speed',{recursive:true});
const fs=require('fs'),assert=require('assert/strict'),{run}=require('./test_budget_experiment.js');const out=[];
for(const [cmd,expected,kind] of [['c77',1616,3],['pearl',1627,1],['otaku',1510,0],['rocket',1615,3]]){const r=run(cmd,null,10,kind);assert(r.win);assert.equal(r.lives,20);assert(r.granted<=expected);out.push({...r,configuredBudget:expected});console.log(cmd,'shipping budget',expected,'income',r.granted,'life',r.lives);}
fs.writeFileSync(__dirname+'/evidence/speed/budget-shipping.json',JSON.stringify(out,null,2));

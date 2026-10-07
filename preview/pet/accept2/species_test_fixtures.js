// Node-only decoded-dimension fixtures; real browser pixels are tested separately.
const assert=require('node:assert/strict'),PG=require('../game/petgame.js');
const manifests={dog:require('../art/manifest.json')};
for(const species of ['cat','rabbit','robot','alpaca']){const m=require('../art/'+species+'/manifest.json');manifests[species]=m;assert(PG.registerSpecies(species,m,{naturalWidth:m.atlas.size[0],naturalHeight:m.atlas.size[1],companionAtlases:Object.fromEntries(Object.entries(m.atlases||{}).map(([k,a])=>[k,{naturalWidth:a.size[0],naturalHeight:a.size[1]}]))},'unit-only').ok);}
function buySpecies(st,E,species,room,stamp,save,blocked=false,opt={}){return PG.buy(st,E,room,stamp,manifests[species],save,blocked,{...opt,species,prototype:true});}
function runtimeSpecies(st,E,id,now){const p=PG.view(st,E).pets[id];return PG.createRuntime({E,manifest:manifests[p.species],species:p.species,uid:id,now});}
module.exports={manifests,buySpecies,runtimeSpecies};

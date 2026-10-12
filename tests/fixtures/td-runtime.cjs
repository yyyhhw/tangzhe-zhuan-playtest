// Node/VM only. Execute real browser dependencies; never substitute campaign constants or auth.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function loadRuntime(ctx,window,tdDir){
 ctx.setInterval=ctx.setTimeout;ctx.clearInterval=ctx.clearTimeout;
 const html=fs.readFileSync(path.join(tdDir,'index.html'),'utf8');
 const names=[...html.matchAll(/<script src="([^"?]+)(?:\?[^"\n]*)?"/g)].map(m=>m[1]).filter(p=>!p.includes('/')&&p!=='td.js');
 for(const name of names){vm.runInContext(fs.readFileSync(path.join(tdDir,name),'utf8'),ctx,{filename:path.join(tdDir,name)});}
 for(const name of ['TDCore','TDWaves','TDProgress','TDCampaign','TDStageProgress','TDProto'])window[name]=ctx[name];
 // tdsfx intentionally lives on window; no AudioContext is supplied in this state-only fixture.
 assert.equal(window.TDCampaign.STAGE_COUNT,50);assert(window.TDStageProgress.configured());
 ctx.crypto=require('node:crypto').webcrypto;window.crypto=ctx.crypto;
}
function stateMessage(tdDir,extra={},request){
 const T=require(path.join(tdDir,'tdcore.js')),P=require(path.join(tdDir,'tdcampaign-progress.js')),H=require(path.join(tdDir,'tdhost.js'));
 const state={coins:5e10,shops:[{},{},{},{open:true}],td:T.norm(),tdCampaign:P.fresh(),muted:true};let message;
 const host=H.create({state:()=>state,blocked:()=>false,balance:()=>state.coins,send:d=>message=d});
 host.msg({td:'hello',protocol:3,ruleset:P.RULESET_ID});assert(message.ok,'real host must accept current handshake');
 if(request){host.msg(request);assert(message.ok,'real host must authorize actual start request');}
 return Object.assign({},message,extra,{ack:extra.ack});
}
module.exports={loadRuntime,stateMessage};

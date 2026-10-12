'use strict';
// Supplemental current-contract checks; the fixed 82-entry comparison is not expanded silently.
const fs=require('node:fs'),assert=require('node:assert/strict');
const prefix=fs.readFileSync(__dirname+'/test_td_protocol.js','utf8').split('check(()=>')[0];
const child=new Function('require','__dirname',prefix+';return child;')(require,__dirname);
(async()=>{
 const f=child();assert.equal(f.ctx.window.TDCampaign.STAGE_COUNT,50);assert(f.ctx.window.TDStageProgress.configured());
 assert.equal(f.api.buyUp('bbq'),false);assert.equal(f.writes.length,0);
 f.connect({},f.ctx.location.origin);f.connect(f.ctx.window.parent,'https://evil.test');assert.equal(f.sent.length,0);
 f.connect();assert.equal(f.sent[0].protocol,3);assert.equal(f.sent[0].ruleset,f.api.RULESET_ID);
 for(const extra of [{protocol:2},{ruleset:'future'},{tdCampaign:{schemaVersion:99}}]){f.state(extra);assert.equal(f.api.proto.ready,false);assert.equal(f.api.buyUp('bbq'),false);assert.equal(f.api.start(1),false);assert.equal(f.writes.length,0);}
 f.state();assert(f.api.proto.ready);assert(f.api.start(1));const g=f.api.G;
 f.state({ack:'start',runId:g.runId,ok:true,mapId:'wrong-map'});assert(g.pendStart);assert(f.api.paused);
 f.state({ack:'start',runId:g.runId,ok:true});assert.equal(g.pendStart,false);assert.equal(f.api.paused,false);assert.equal(f.writes.length,0);
 const local=child(false);assert(local.api.start(1));assert(local.api.G.pendStart,'real local registration is asynchronous');
 assert(await local.api.G.startPromise);assert.equal(local.api.G.pendStart,false);const countdown=local.api.G.breakT;local.api.step(.25);assert(local.api.G.breakT<countdown);
 console.log('PASS supplemental Node/VM: real dependency order, real host protocol, origin/source rejection, future schema rejection, start identity and real async prototype confirmation; no browser claim.');
})().catch(e=>{console.error(e);process.exitCode=1;});

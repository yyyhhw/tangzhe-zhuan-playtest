// Deterministic Node/VM checks. These do NOT stand in for browser/native audio QA.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||new URL('../..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const audio='audio/carefree-kevin-macleod-8433b770.mp3';
const bytes=fs.readFileSync(path.join(root,audio));
assert.equal(bytes.length,6566713);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'8433b770a630d9b1594fd484442c677907ece899a4d149954cd2e74fd733e311');
const helper=read('audio/loop-music.js');
const report={scope:'Node/VM behavior + static cache/attribution contracts; no browser or OS playback',cases:[]};
function tick(){return new Promise(r=>setImmediate(r));}
function setup(prefix, options={}){
 const events={},devents={},calls={fetch:0,contexts:0,sources:0,starts:0,resumes:0,suspends:0,timers:0};
 const node=()=>({gain:{value:1},connect(){},disconnect(){}});
 const pcm=(channels=2,n=22050,sr=44100)=>({length:n,numberOfChannels:channels,sampleRate:sr,duration:n/sr,getChannelData:ch=>(pcm.channels??=[])[ch]??((pcm.channels??=[])[ch]=new Float32Array(n))});
 class Context{
  constructor(){calls.contexts++;this.state='suspended';this.destination={};}
  createGain(){return node();}
  createBuffer(ch,n,sr){const a=Array.from({length:ch},()=>new Float32Array(n));return {length:n,numberOfChannels:ch,sampleRate:sr,duration:n/sr,getChannelData:i=>a[i]};}
  createBufferSource(){calls.sources++;return {connect(){},start(){calls.starts++;},stop(){},disconnect(){}};}
  async decodeAudioData(){return this.createBuffer(2,22050,44100);}
  async resume(){this.state='running';calls.resumes++;}
  async suspend(){this.state='suspended';calls.suspends++;}
 }
 const document={hidden:false,baseURI:'https://example.test/tangzhe-zhuan-playtest/'+prefix,addEventListener:(e,f)=>(devents[e]??=[]).push(f)};
 const c={document,URL,AudioContext:Context,Float32Array,Math,performance:{now:()=>5000},state:{muted:options.muted||false},frozen:false,tdOpen:false,cardsOpen:false,zbOpen:false,
  addEventListener:(e,f)=>(events[e]??=[]).push(f),setInterval:()=>{calls.timers++;},clearInterval(){},
  fetch:async url=>{calls.fetch++;calls.url=String(url);return {ok:true,arrayBuffer:async()=>bytes.buffer};}};
 c.window=c;vm.createContext(c);vm.runInContext(helper,c);
 const app=read(prefix+'app.js'),start=app.indexOf('const AU ='),end=app.indexOf('/* ================= 画面',start);
 assert(start>=0&&end>start);vm.runInContext(app.slice(start,end)+'\nthis.audioAPI={AU,audioInit,audioUnlock,audioPause,audioResume,startBgm,stopBgm};',c);
 return {c,calls,events,devents,api:c.audioAPI,app};
}
for(const prefix of ['', 'preview/']){
 const assetVersion='xingtuv2-3-20261014-r1';
 const uiVersion='xingtuv2-3-20261014-r1';
 const pageVersion='xingtuv2-3-20261014-r1';const version=(prefix?'preview-':'formal-')+pageVersion;
 const app=read(prefix+'app.js'),html=read(prefix+'index.html'),boot=read(prefix+'collection/bootstrap.mjs');
 assert.equal(JSON.parse(read(prefix+'version.json')).v,version);
 assert(html.includes("var B='"+version+"'"));assert(html.includes('collection/bootstrap.mjs?v='+pageVersion));
 assert(boot.includes('app.js?'+(prefix?'collectionHost=1c&':'')+'v='+uiVersion));
 assert(!app.includes('hot-springs-town.mp3'));assert(!app.includes('Wallpaper.mp3'));
 assert(html.includes('id="settings"'));assert(html.includes('aria-label="设置与关于／鸣谢"'));
 assert(html.indexOf('audio/loop-music.js')<html.indexOf('collection/bootstrap.mjs'));
 const src=html.match(/src="([^"]*audio\/loop-music.js[^\"]*)"/)[1];
 assert.equal(new URL(src,'https://example.test/tangzhe-zhuan-playtest/'+prefix).pathname,'/tangzhe-zhuan-playtest/audio/loop-music.js');
 assert(app.includes("$('#settings').addEventListener('click', showMusicCredits)"));
 assert(app.includes("case 'musicCredits': return showMusicCredits()"));
 for(const str of ['关于／鸣谢','Carefree','Kevin MacLeod','https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1400037','https://creativecommons.org/licenses/by/4.0/','100 毫秒交叉淡化','未剪裁、未转码'])assert(app.includes(str),str);
 const h=setup(prefix);assert.equal(h.calls.contexts,0,'no context before gesture');assert.equal(h.calls.fetch,0);
 h.api.audioUnlock();await tick();await tick();assert.equal(h.calls.contexts,1);assert.equal(h.calls.fetch,1);assert.equal(h.calls.starts,1);assert.equal(h.api.AU.bgm.gain.value,.09);assert.equal(h.api.AU.sfx.gain.value,.5);
 assert.equal(h.calls.url,'https://example.test/tangzhe-zhuan-playtest/'+audio);assert.equal(h.api.AU.recorded.status.gain,1);assert.equal(h.api.AU.recorded.status.duration,.4);
 for(let i=0;i<10;i++){h.api.audioUnlock();h.api.audioResume();h.api.startBgm();}await tick();assert.equal(h.calls.contexts,1);assert.equal(h.calls.starts,1);assert.equal(h.calls.fetch,1);assert.equal(h.calls.timers,0,'no synthetic music timer');
 for(const mode of ['tdOpen','zbOpen']){
  h.c[mode]=true;h.api.audioPause();assert.equal(h.api.AU.ctx.state,'suspended');assert.equal(h.api.AU.recorded.status.gain,0);const n=h.calls.resumes;h.api.audioUnlock();h.api.audioResume();h.api.startBgm();assert.equal(h.calls.resumes,n);assert.equal(h.api.AU.recorded.status.gain,0);h.c[mode]=false;h.api.audioResume();assert.equal(h.api.AU.recorded.status.gain,1);assert.equal(h.calls.starts,1);
 }
 h.c.state.muted=true;h.api.audioPause();h.api.AU.master.gain.value=0;h.api.audioUnlock();h.api.audioResume();assert.equal(h.api.AU.recorded.status.gain,0);assert.equal(h.api.AU.ctx.state,'suspended');h.c.state.muted=false;h.api.AU.master.gain.value=1;h.api.audioUnlock();h.api.audioResume();assert.equal(h.api.AU.recorded.status.gain,1);
 h.c.document.hidden=true;for(const f of h.devents.visibilitychange)f();assert.equal(h.api.AU.recorded.status.gain,0);h.api.audioUnlock();h.api.audioResume();assert.equal(h.api.AU.recorded.status.gain,0);h.c.document.hidden=false;h.api.audioResume();assert.equal(h.api.AU.recorded.status.gain,1);
 h.c.frozen=true;h.api.audioPause();h.api.audioResume();h.api.startBgm();assert.equal(h.api.AU.recorded.status.gain,0);h.c.frozen=false;h.api.audioResume();
 for(const f of h.events.pagehide)f();assert.equal(h.api.AU.recorded.status.gain,0);assert.equal(h.api.AU.recorded.status.wanted,false);
 const muted=setup(prefix,{muted:true});muted.api.audioUnlock();await tick();assert.equal(muted.calls.fetch,0);assert.equal(muted.calls.starts,0);assert.equal(muted.calls.resumes,0);assert.equal(muted.api.AU.master.gain.value,0);
 // Slow decoding that finishes after entering a minigame must stay silent.
 const delayed=setup(prefix);let finish;delayed.c.AudioContext.prototype.decodeAudioData=function(){return new Promise(r=>{finish=()=>r(this.createBuffer(2,22050,44100));});};delayed.api.audioUnlock();await tick();delayed.c.tdOpen=true;delayed.api.audioPause();finish();await tick();assert.equal(delayed.calls.starts,0);assert.equal(delayed.api.AU.recorded.status.gain,0);delayed.c.tdOpen=false;delayed.api.audioResume();assert.equal(delayed.calls.starts,1);
 // An HTTP failure stays silent and can retry on a later trusted gesture.
 const failed=setup(prefix);failed.c.fetch=async()=>{failed.calls.fetch++;return {ok:false,status:503};};failed.api.audioUnlock();await tick();assert.equal(failed.api.AU.recorded.status.gain,0);assert(failed.api.AU.recorded.status.error.includes('MUSIC_HTTP_503'));assert.equal(failed.calls.starts,0);
 failed.c.performance.now=()=>7000;failed.c.fetch=async()=>{failed.calls.fetch++;return {ok:true,arrayBuffer:async()=>bytes.buffer};};failed.api.audioUnlock();await tick();assert.equal(failed.calls.fetch,2);assert.equal(failed.calls.starts,1);assert.equal(failed.api.AU.recorded.status.error,null);
 // Credits cannot replace outstanding dialogs; their close restores focus.
 const functionText=app.slice(app.indexOf('function showMusicCredits()'),app.indexOf('/* ---------- 离线收益 ---------- */'));
 let open=true,rendered='',handler,focused=0,closed=0;const previous={isConnected:true,focus:()=>focused++};const m={addEventListener:(e,fn)=>{handler=fn;},focus:()=>{}};
 const c={document:{activeElement:previous},modalOpen:()=>open,openModal:x=>{rendered=x;open=true;},closeModal:()=>{closed++;open=false;},$:()=>m};vm.createContext(c);vm.runInContext(functionText,c);c.showMusicCredits();assert.equal(rendered,'');open=false;c.showMusicCredits();assert(rendered.includes('CC BY 4.0'));handler();assert.equal(closed,1);assert.equal(focused,1);
 report.cases.push({site:prefix||'root',pass:true,checks:['exact official bytes','relative asset + helper URLs','cache chain','gesture-only start','one player after repeated input','unchanged volume buses','mute + persisted mute','TD/cards/zombie exclusion','hidden/pagehide/frozen silence','late decode safety','HTTP failure silence + gesture retry','visible credits + links','dialog guard + close focus']});
}
console.log(JSON.stringify(report,null,2));

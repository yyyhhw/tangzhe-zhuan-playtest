// 文案-115 附带：音效-112 修（2deffc7）回归。抽取真实 app.js 函数在 VM 里跑：后台回来音效恢复 / 星途开着 BGM 不恢复 / 静音什么都不响。
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function rig(appPath){
 const text=source(appPath),extract=name=>{const line=text.split('\n').find(l=>l.startsWith('function '+name+'('));assert(line,name);if(line.trim().endsWith('}'))return line;const start=text.indexOf(line),end=text.indexOf('\n}',start);return text.slice(start,end+2);};
 const tones=[],ctx={state:'running',currentTime:0,resumes:0,resume(){ctx.resumes++;ctx.state='running';return Promise.resolve()},suspend(){ctx.state='suspended';return Promise.resolve()},createOscillator:()=>({type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){tones.push(1)},stop(){}}),createGain:()=>({gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}})};
 const r={tones,ctx,bgm:0};const c=vm.createContext({document:{hidden:false},state:{muted:false},frozen:false,tdOpen:false,zbOpen:false,moon:false,Math,setInterval:()=>{r.bgm++;return 1},clearInterval(){}});
 Object.assign(c,{window:c,XingTu:{isOpen:()=>c.moon},AU:{ctx,sfx:{},started:true,timer:null,recorded:{start(){r.bgm++},stop(){},retry(){}}},audioInit(){},scheduleBgm(){}});
 vm.runInContext(['audioPause','audioResume','startBgm','stopBgm','tone','sfx'].map(extract).join('\n')+'\nglobalThis.api={audioPause,audioResume,startBgm,stopBgm,sfx};',c);
 r.c=c;r.api=c.api;r.text=text;r.hide=()=>{c.document.hidden=true;c.api.audioPause();};r.show=()=>{c.document.hidden=false;c.api.audioResume();};return r;
}
for(const appPath of ['app.js','pet/game/app.js','preview/app.js']){
 test(appPath+' 112 回归①：切后台再回来，音效恢复（星途关/开都一样）',()=>{
  for(const moon of [false,true]){const r=rig(appPath);r.c.moon=moon;r.hide();assert.equal(r.ctx.state,'suspended');r.api.sfx('swoosh');assert.equal(r.tones.length,0,'后台不响');r.show();assert.equal(r.ctx.state,'running');const n=r.tones.length;r.api.sfx('swoosh');assert(r.tones.length>n,'回来后 swoosh 响 moon='+moon);const m=r.tones.length;r.api.sfx('reveal');assert(r.tones.length>m,'reveal 响');}
 });
 test(appPath+' 112 回归②：星途开着回到前台，BGM 仍暂停；关掉星途才恢复',()=>{
  const r=rig(appPath);r.c.moon=true;r.api.stopBgm();const b=r.bgm;r.hide();r.show();r.show();assert.equal(r.bgm,b,'星途开着不开 BGM');r.api.startBgm();assert.equal(r.bgm,b,'startBgm 自己也挡');r.c.moon=false;r.api.audioResume();assert.equal(r.bgm,b+1,'关星途后 BGM 恢复');
 });
 test(appPath+' 112 回归③：静音时回到前台什么都不响（不恢复引擎、不开 BGM、音效不出声）',()=>{
  for(const moon of [false,true]){const r=rig(appPath);r.c.moon=moon;r.c.state.muted=true;const b=r.bgm;r.hide();const k=r.ctx.resumes;r.show();assert.equal(r.ctx.resumes,k,'静音不 resume');assert.equal(r.ctx.state,'suspended');assert.equal(r.bgm,b);r.ctx.state='running';r.api.sfx('swoosh');r.api.sfx('reveal');r.api.sfx('no');assert.equal(r.tones.length,0,'静音 sfx 不响');}
 });
 test(appPath+' 112 回归④：audioResume 不再因 XingTu.isOpen() 早退（BGM 由 startBgm 挡）',()=>{
  const r=rig(appPath),line=r.text.split('\n').find(l=>l.startsWith('function audioResume('));assert(!/XingTu/.test(line.replace(/\/\*.*\*\//g,'')),line);assert(/XingTu\?\.isOpen\(\)/.test(r.text.split('\n').find(l=>l.startsWith('function startBgm('))));
 });
}

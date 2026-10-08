import fs from 'node:fs';import assert from 'node:assert/strict';
const{chromium}=await import(process.env.TD_PLAYWRIGHT);const b=await chromium.launch({headless:true,executablePath:process.env.TD_CHROMIUM});
const raw=fs.readFileSync(new URL('./test_balance_sweep.js',import.meta.url),'utf8');const run=raw.slice(raw.indexOf('function run('),raw.indexOf('const out=[];'));const out=new URL('./evidence/balance/',import.meta.url).pathname;fs.mkdirSync(out,{recursive:true});const results=[];
try{for(const cmd of ['c77','pearl','otaku','rocket'])for(const strategy of (['c77','pearl'].includes(cmd)?['balanced','minimal','dps']:['balanced'])){
 const ctx=await b.newContext({viewport:{width:393,height:852},hasTouch:true});await ctx.addInitScript(()=>window.requestAnimationFrame=()=>0);const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8882/td/');
 const result=await p.evaluate(({run,cmd,strategy})=>{const create=cmd=>{__td.cmdSel=cmd;__td.start(1);return{api:__td};};return new Function('create','cmd','strategy',run+';return run(cmd,strategy);')(create,cmd,strategy);},{run,cmd,strategy});
 await p.waitForFunction(()=>__td.G.saveOk, null, {polling:50});await p.evaluate(()=>advanceTime(0));await p.screenshot({path:out+cmd+'-'+strategy+'.png'});assert.deepEqual(errors,[]);results.push(result);await ctx.close();
}fs.writeFileSync(out+'natural-browser.json',JSON.stringify(results,null,2));console.log(results.map(({rows,layout,...r})=>r));}finally{await b.close();}

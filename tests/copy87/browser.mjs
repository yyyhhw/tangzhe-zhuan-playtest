import {chromium,webkit} from 'playwright';import fs from 'node:fs';import {startServer} from '../webkit-smoke/static-server.mjs';import {setup} from '../wearables8/fixture.mjs';
const OUT=process.env.COPY87_OUT||new URL('./output/',import.meta.url).pathname;fs.mkdirSync(OUT,{recursive:true});
const {server,url}=await startServer();const fixtures={};for(const scope of ['preview','formal']){const t=await setup('a739f61',scope);t.init();fixtures[scope]={data:Object.fromEntries(t.data),keys:t.keys};}
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log(ok?'PASS':'FAIL',name,JSON.stringify(detail));}
for(const engine of ['chromium','webkit']){const b=await({chromium,webkit}[engine]).launch();
for(const name of ['newCancel','newConfirm','p1Cancel','p1Confirm','snapshotFail','backupFail','corrupt','formalNewRoot','formalP1Root','formalNewPet','formalP1Pet']){
 const formal=name.startsWith('formal'),scope=formal?'formal':'preview',fixture=fixtures[scope],keys=fixture.keys,snap='tangzhe-'+scope+'-collectibles-v2-original';
 const data=name.startsWith('new')||name.includes('New')?{}:{...fixture.data};if(name==='corrupt')data[keys.main]='not-json';
 const fault=name==='snapshotFail'?snap:name==='backupFail'?keys.backup:null;
 const ctx=await b.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage(),errors=[],tag=engine+' '+name;p.on('pageerror',e=>errors.push(e.message));
 await ctx.addInitScript(({data,fault})=>{for(const[k,v]of Object.entries(data))localStorage.setItem(k,v);window.__writes=[];window.__prompts=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===localStorage){window.__writes.push({key:k,value:String(v)});if(k===fault)throw Error('COPY87_INJECTED_WRITE_FAILURE');}return set.call(this,k,v);};new MutationObserver(()=>{for(const id of ['collectibleLegacyConfirm','collectibleUpgradeConfirm','collectibleUpgradeCancel'])if(document.getElementById(id))window.__prompts.push(id);}).observe(document,{subtree:true,childList:true});},{data,fault});
 const storage=()=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
 try{
  await p.goto(url+(formal?(name.includes('Pet')?'pet/game/':''):'preview/'));
  if(formal){await p.waitForFunction(()=>window.__tzz?.state);const result=await p.evaluate(()=>({protocol:window.__tzz.state._collectionProtocol,prompts:window.__prompts}));check(tag+' auto upgrade no prompts',result.protocol===2&&result.prompts.length===0,result);}
  else if(name==='corrupt'){await p.getByText('预览存档已保护',{exact:true}).waitFor();const after=await storage();check(tag+' corrupt evidence unchanged, no app',after[keys.main]==='not-json'&&await p.evaluate(()=>!window.__tzz),{});check(tag+' protected no save writes',(await p.evaluate(()=>window.__writes)).filter(x=>[keys.main,keys.backup,snap].includes(x.key)).length===0);}
  else{
   if(name.startsWith('new')){
    await p.locator('#collectibleLegacyConfirm').waitFor();const text=await p.locator('#collectionStartup').innerText();check(tag+' clear preview copy',text.includes('新版预览存档')&&text.includes('取消不会写入')&&text.includes('正式版进度不受影响'),text);
    check(tag+' waiting has no business writes',(await p.evaluate(()=>window.__writes)).filter(x=>[keys.main,keys.backup,snap].includes(x.key)).length===0);
    if(name==='newCancel'){await p.locator('#collectibleLegacyCancel').click();await p.getByText('尚未进入新版存档',{exact:true}).waitFor();const after=await storage();check(tag+' cancellation no saved game',!after[keys.main]&&!after[keys.backup]&&!after[snap]);}
    else await p.locator('#collectibleLegacyConfirm').click();
   }
   if(name!=='newCancel'){
    await p.locator('#collectibleUpgradeConfirm').waitFor();const panel=p.locator('#collectionStartup');await panel.locator('summary').click();const text=await panel.innerText();check(tag+' current counts and plain wording',text.includes('200 件')&&text.includes('188 件普通、4 件超级、8 件隐藏')&&!/共66件|90%\/60|协议2主档/.test(text),text);
    const before=await storage();check(tag+' prompt retains P1',JSON.parse(before[keys.main])._collectionProtocol===1&&!before[snap]);
    if(name==='p1Confirm')await p.screenshot({path:OUT+'/'+engine+'-preview-details.png',fullPage:true});
    await p.locator(name==='p1Cancel'?'#collectibleUpgradeCancel':'#collectibleUpgradeConfirm').click();
    if(fault){await p.getByText('存档已保护',{exact:true}).waitFor();const after=await storage();check(tag+' failed write retains exact main and blocks app',after[keys.main]===before[keys.main]&&await p.evaluate(()=>!window.__tzz),{protocol:JSON.parse(after[keys.main])._collectionProtocol});}
    else{await p.waitForFunction(()=>window.__tzz?.state);const after=await storage(),result=await p.evaluate(()=>({protocol:window.__tzz.state._collectionProtocol,owned:window.__tzz.state.gacha.owned,items:window.Economy.ITEMS.length}));
     check(tag+' protocol/catalog correct',result.protocol===(name==='p1Cancel'?1:2)&&result.items===(name==='p1Cancel'?36:200),result);
     if(name==='p1Cancel')check(tag+' no migration snapshot',!after[snap]);
     else{const writes=await p.evaluate(()=>window.__writes),si=writes.findIndex(x=>x.key===snap),bi=writes.findIndex((x,i)=>i>si&&x.key===keys.backup&&JSON.parse(x.value)._collectionProtocol===1),mi=writes.findIndex((x,i)=>i>bi&&x.key===keys.main&&JSON.parse(x.value)._collectionProtocol===2);check(tag+' snapshot then P1 backup then P2 main',!!after[snap]&&si>=0&&bi>si&&mi>bi,{si,bi,mi});check(tag+' no migration grant',JSON.stringify(result.owned)===JSON.stringify(JSON.parse(before[keys.main]).gacha.owned));}
     for(const key of [keys.source,keys.sourceBackup])check(tag+' original preserved '+key,after[key]===before[key]);
    }
   }
  }
  check(tag+' no JS errors',errors.length===0,errors);
 }catch(e){check(tag+' complete',false,e.stack);}await ctx.close();
}await b.close();}server.close();fs.writeFileSync(OUT+'/browser-report.json',JSON.stringify(checks,null,2));console.log('TOTAL',checks.filter(x=>x.ok).length,checks.length);

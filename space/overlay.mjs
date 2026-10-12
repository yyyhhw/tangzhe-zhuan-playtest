import {createMoonHost} from './host.mjs?v=space01b04-moon-on-wearables8-20261012-r1';
import {moonArt} from './art.mjs?v=space01b04-moon-on-wearables8-20261012-r1';
import {MOON_CSS} from './styles.mjs?v=space01b04-moon-on-wearables8-20261012-r1';
export function installMoonOverlay({app,runtime,document:doc=globalThis.document,window:win=globalThis}){
 if(win.XingTu)throw Error('SPACE_HOST_ALREADY_INSTALLED');
 let cover=null,body=null,content=null,timer=null,host,closeButton=null,origin=null,signature=null,revoked=false,renderFailed=false;
 let background=[];
 const connected=n=>!!n&&(n.isConnected===undefined?!!n.parentNode:n.isConnected);
 const usable=n=>{if(!connected(n)||n.disabled)return false;for(let p=n;p;p=p.parentNode){if(p.nodeType!==undefined&&p.nodeType!==1)break;if(p.hidden||p.inert||p.getAttribute?.('aria-hidden')==='true')return false;const style=win.getComputedStyle?.(p);if(style&&(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'))return false;}return true;};
 const focus=n=>{if(usable(n))n.focus?.();};
 const controls=()=>[...(cover?.querySelectorAll?.('button, a[href], input, select, textarea, [tabindex]')??[])].filter(n=>usable(n)&&n.tabIndex!==-1);
 const isolate=()=>{background=[...(doc.body.children??[])].filter(n=>n!==cover).map(n=>({n,inert:n.inert,attribute:n.getAttribute?.('inert')}));for(const {n} of background)n.inert=true;};
 const restoreBackground=()=>{for(const {n,inert,attribute}of background){n.inert=inert;if(attribute!==undefined){if(attribute===null)n.removeAttribute?.('inert');else n.setAttribute('inert',attribute);}}background=[];};
 const node=(tag,id,text)=>{const n=doc.createElement(tag);if(id)n.id=id;if(text!==undefined)n.textContent=text;return n;};
 const clearTimer=()=>{if(timer!==null){win.clearTimeout(timer);timer=null;}};
 const closeView=()=>{clearTimer();cover?.remove();restoreBackground();cover=null;body=null;content=null;signature=null;closeButton=null;const saved=origin;origin=null;
  let allowed=false;try{allowed=!renderFailed&&!revoked&&!doc.hidden&&!app.xingtuContext().blocked&&!runtime.coordinator.readOnly;}catch{}
  if(allowed)focus(saved);
 };
 const button=(id,label,fn)=>{const b=node('button',id,label);b.type='button';b.onclick=fn;return b;};
 function ensure(){if(cover)return false;origin=doc.activeElement;cover=node('section','xingtuOverlay');cover.className='xingtu-overlay';cover.setAttribute('role','dialog');cover.setAttribute('aria-modal','true');cover.setAttribute('aria-label','星途月面基地');body=node('div','xingtuPanel');body.className='xingtu-panel';cover.append(body);
  const head=node('div');head.className='xingtu-head';closeButton=button('xingtuClose','返回经营',()=>host.close());head.append(node('h2',null,'星途 · 月面基地'),closeButton);body.append(head);
  const warning=node('p','xingtuRuleset','候选测试规则：6秒／8探索点 · 科技公司Lv50测试门槛 · 非正式参数');warning.className='xingtu-test';body.append(warning);
  content=node('div','xingtuContent');body.append(content);doc.body.append(cover);isolate();return true;
 }
 const schedule=view=>{if(view.ok&&view.phase==='flying')timer=win.setTimeout(()=>{timer=null;if(host.isOpen()&&!doc.hidden)host.refresh();},1000);};
 function render(view){try{return renderView(view);}catch(error){renderFailed=true;try{host.close();}finally{renderFailed=false;}throw error;}}
 function renderView(view){
  if(!host?.isOpen())return;const created=ensure();clearTimer();
  const next=JSON.stringify([view.ok,view.code,view.phase,view.voyage?.voyageId,view.receipt,view.space?.pts,view.space?.visits,host.token]);
  if(signature===next){if(view.phase==='flying'){doc.getElementById('xingtuRemaining').textContent=`剩余 ${Math.ceil(view.remaining/1000)} 秒`;doc.getElementById('xingtuProgress').value=6000-view.remaining;const p=1-view.remaining/6000;doc.getElementById('xingtuStarMap').querySelector?.('use')?.setAttribute('transform',`translate(${72+p*160} ${84-Math.sin(p*Math.PI)*38}) rotate(65)`);}schedule(view);return;}
  signature=next;const previousFocus=doc.activeElement;while(content.firstChild)content.firstChild.remove();
  renderContent(view);if(created||!usable(previousFocus))focus(closeButton);schedule(view);
 }
 function renderContent(view){
  if(!view.ok){const error=node('p','xingtuProtection',view.code.includes('COMPATIBILITY')?'旧航次兼容保护：没有清除航程，也没有猜测奖励。':'星途暂不可写，请先核对存档或恢复正确时间。');error.className='xingtu-error';content.append(error,node('small',null,view.code));return;}
  const art=node('div','xingtuStarMap');art.className='xingtu-art';art.innerHTML=moonArt(view.phase==='flying'?1-view.remaining/6000:0);content.append(art);
  const status=node('div','xingtuStatus');status.className='xingtu-status';content.append(status);
  const token=host.token,actions=node('div','xingtuActions');actions.className='xingtu-actions';content.append(actions);
  const act=(intent)=>{const r=host.perform(intent,token);if(!r.ok&&content){const message=node('p','xingtuSaveResult',r.status==='unknown'?'保存结果尚未确认：已停止写入，请使用只读核对。':'未确认成功，没有显示起飞或重复发奖。');message.className='xingtu-error';content.append(message,node('small',null,r.code));}return r;};
  if(view.phase==='flying'){
   status.append(node('p',null,'航线：地球 → 月面基地 → 地球'),node('p','xingtuRemaining',`剩余 ${Math.ceil(view.remaining/1000)} 秒`),node('p','xingtuArrival',`本地到达时间：${new Date(view.arrival).toLocaleString()}`));
   const progress=node('progress','xingtuProgress');progress.max=6000;progress.value=6000-view.remaining;status.append(progress);
  }else if(view.phase==='arrived'){
   status.append(node('p',null,'月面往返已完成，返航报告待确认。'),node('p','xingtuArrival',`本地到达时间：${new Date(view.arrival).toLocaleString()}`));actions.append(button('xingtuClaim','确认返航报告 · 领取8探索点',()=>act({type:'claim',voyageId:view.voyage.voyageId})));
  }else{
   status.append(node('p',null,`当前探索点：${view.space.pts} · 月面往返次数：${view.space.visits.moon??0}`));
   actions.append(button('xingtuDepart','出航月面基地',()=>act({type:'depart',route:'moon'})));
  }
   if(view.receipt){const report=node('div','xingtuReport',`最近返航报告：月面基地 · 已入账 ${view.receipt.points} 探索点（一次） · ${new Date(view.receipt.claimedAt).toLocaleString()}`);report.className='xingtu-receipt';content.append(report);}

 }
 const c=runtime.coordinator;
 host=createMoonHost({app,coordinator:c,readReconcile:()=>runtime.reconcile(),render,closeView,audioPause:()=>app.xingtuAudioPause(),audioResume:()=>app.xingtuAudioResume()});
 const style=node('style','xingtuStyles');style.textContent=MOON_CSS;doc.head.append(style);
 const hide=()=>{if(doc.hidden){clearTimer();host.suspend();}else queueMicrotask(()=>host.resume());};
 doc.addEventListener('visibilitychange',hide);win.addEventListener('pagehide',()=>{revoked=true;host.invalidate();},{once:true});win.addEventListener('pageshow',e=>{if(e.persisted){revoked=true;host.invalidate();}});doc.addEventListener('keydown',e=>{
  if(!host.isOpen())return;if(e.key==='Escape'){e.preventDefault?.();host.close();return;}if(e.key!=='Tab')return;
  const list=controls(),first=list[0]??closeButton,last=list.at(-1)??closeButton,active=doc.activeElement;
  if(!list.includes(active)||(e.shiftKey?active===first:active===last)){e.preventDefault?.();focus(e.shiftKey?last:first);}
 });
 win.XingTu=host;return host;
}

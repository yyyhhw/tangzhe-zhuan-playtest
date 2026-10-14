/** 盲盒-109：盲盒200 的 6 件隐藏款达成特殊目标直接获得（杨总口径）。
 * 不走开盒、不占每天 5 次、不动 gacha.draws/pity/每日计数；只往 gacha.owned 追加，经 app.atomic → persist → coordinator.commit 落盘。
 * 幂等：已拥有的不再发；同一刻达成多件一次存档、toast 每件一条依次弹。 */
import {BOX200_COPY} from './box200-copy.mjs?v=box109-20261014-r1';
const lv=(s,i)=>Number(s?.shops?.[i]?.lv)||0;
export const HIDDEN_GOALS=Object.freeze({
  c_moon_night_robe:s=>[0,1,2,3].every(i=>lv(s,i)>=35),
  h_golden_skewer_crown:s=>lv(s,0)>=50,
  h_pearl_halo:s=>lv(s,1)>=50,
  d_street_neon_arch:(s,E)=>(s?.gacha?.owned||[]).filter(id=>{const it=E.ITEM_BY_ID[id];return it&&it.hidden!==true;}).length>=60,
  d_comet_jar:s=>(Number(s?.space?.visits?.moon)||0)>=10,
  d_manga_golden_page:s=>lv(s,2)>=50,
});
/** 当前存档里已达成、已放行、尚未拥有的隐藏款 ID（按固定顺序）。纯函数。 */
export function dueHidden(E,s){
  const owned=s?.gacha?.owned;if(!Array.isArray(owned))return [];
  return Object.keys(HIDDEN_GOALS).filter(id=>E.ITEM_BY_ID?.[id]?.hidden===true&&!owned.includes(id)&&HIDDEN_GOALS[id](s,E));
}
export const toastText=id=>BOX200_COPY[id]?.toast||`送你隐藏款「${BOX200_COPY[id]?.name||id}」`;
/** 接到真实 app（window.__tzz）上：加载时查一次，之后每 1.5 秒查一次（升级/星途返航/开盒后都会被下一次检查接住）。 */
export function installHiddenGoals(app,{setInterval:si=globalThis.setInterval,setTimeout:st=globalThis.setTimeout,doc=globalThis.document,period=1500,gap=2600}={}){
  let backoffUntil=0,queue=[],showing=false;
  const show=()=>{if(showing||!queue.length)return;if(doc?.hidden){st(show,1000);return;}showing=true;const msg=queue.shift();app.toast?.(msg,2500);st(()=>{showing=false;show();},gap);};
  function check(){
    try{
      const E=app.E,s=app.state;if(!E||!s||app.saveBlocked||Date.now()<backoffUntil)return [];
      const due=dueHidden(E,s);if(!due.length)return [];
      const r=app.atomic(()=>{const st=app.state;const ids=dueHidden(E,st);for(const id of ids)st.gacha.owned.push(id);return {ok:true,ids};},'隐藏款还没发放');
      if(!r||!r.ok){backoffUntil=Date.now()+60000;return [];}
      const ids=r.ids||due;queue.push(...ids.map(toastText));show();try{app.renderTab?.();}catch{}
      return ids;
    }catch{backoffUntil=Date.now()+60000;return [];}
  }
  const granted=check();const timer=si?si(check,period):null;
  return Object.freeze({check,granted,timer});
}

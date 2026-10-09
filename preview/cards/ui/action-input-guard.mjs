/** UI-only protection against a second activation landing on a newly rendered control.
 * No game state, storage, timers, network or rule changes. Keyboard activation is
 * distinguished by detail=0 and is never coordinate/time gated.
 */
export function createActionInputGuard({now=()=>performance.now(),windowMs=600,radiusPx=24}={}) {
  let committed=null;
  const pointer=e=>e&&e.detail!==0&&Number.isFinite(e.clientX)&&Number.isFinite(e.clientY);
  return {
    reset() {committed=null;},
    remember(event) {if(pointer(event))committed={at:now(),x:event.clientX,y:event.clientY};},
    ignores(event) {
      if(!committed||!pointer(event))return false;
      const elapsed=now()-committed.at;
      return elapsed>=0&&elapsed<=windowMs&&Math.hypot(event.clientX-committed.x,event.clientY-committed.y)<=radiusPx;
    },
  };
}

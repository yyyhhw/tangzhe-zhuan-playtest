/** Parent-page intent adapter. No direct Storage, iframe or reward input. */
export function createMoonHost({app,coordinator,render=()=>{},closeView=()=>{},audioPause=()=>{},audioResume=()=>{},readReconcile=()=>coordinator.reconcile?.()??{ok:false,code:'SPACE_RECONCILE_UNAVAILABLE'}}){
 let opened=false,disposed=false,generation=0;
 const context=()=>{try{return app.xingtuContext();}catch{return {blocked:true,otherGame:true};}};
 const gate=()=>!disposed&&!context().blocked&&!context().otherGame&&!app.persist.pending&&!coordinator.readOnly;
 const result=(r)=>({...r,status:r.ok?'success':coordinator.uncertain?'unknown':'failure'});
 function view(){if(disposed)return {ok:false,code:'SPACE_SESSION_REVOKED'};const value=coordinator.spaceView();return value;}
 function refresh(){if(opened){const value=view();render(value);return value;}return view();}
 function open(){
  if(!gate())return {ok:false,code:'SPACE_HOST_BLOCKED'};
  const state=view();
  if(state.ok?!state.unlocked:!(Array.isArray(app.state?.shops)&&app.state.shops.length>0&&app.state.shops.every(s=>s?.open===true&&s.lv>=35)))return {ok:false,code:'SPACE_TECH_LEVEL_REQUIRED'};
  if(opened){refresh();return {ok:true,alreadyOpen:true};}
  opened=true;generation++;try{audioPause();}catch{}render(state);return {ok:true};
 }
 function close(){if(!opened)return;opened=false;generation++;closeView();const c=context();if(!disposed&&!c.blocked&&!c.otherGame&&!c.muted){try{audioResume();}catch{}}}
 function perform(intent,token=generation){
  if(!opened||token!==generation||!gate())return {ok:false,code:'SPACE_CALLBACK_REVOKED',status:'failure'};
  const preview=coordinator.spacePreview(intent);if(!preview.ok)return result(preview);
  // Duplicate/stale intents are read-only, even before a normal save.
  if(preview.noop)return result(coordinator.spaceIntent(intent));
  // An independent ordinary save preserves online/offline business changes.
  // The facade then checks exact app/disk equality before its private mutation.
  let saved;try{saved=app.persist();}catch{return result({ok:false,code:'PARENT_SAVE_EXCEPTION'});}
  if(saved!==true){refresh();return result({ok:false,code:coordinator.failed||'PARENT_SAVE_FAILED'});}
  if(token!==generation||!gate())return {ok:false,code:'SPACE_CALLBACK_REVOKED',status:'failure'};
  const committed=coordinator.spaceIntent(intent);refresh();return result(committed);
 }
 function suspend(){generation++;}
 function resume(){if(disposed||!gate())return {ok:false,code:'SPACE_HOST_BLOCKED'};generation++;return refresh();}
 function invalidate(){disposed=true;generation++;opened=false;closeView();return {ok:false,code:'SPACE_SESSION_REVOKED'};}
 function reconcile(){if(disposed)return {ok:false,code:'SPACE_SESSION_REVOKED'};const r=readReconcile();if(r.ok)refresh();return result(r);}
 return Object.freeze({open,close,view,refresh,perform,suspend,resume,invalidate,reconcile,isOpen:()=>opened,get token(){return generation;}});
}

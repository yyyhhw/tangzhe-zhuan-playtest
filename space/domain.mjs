/** 星途01a: optional immutable save domain. No storage, time, RNG or economics. */
export const SPACE_SCHEMA_VERSION = 1;
const own = (x,k) => Object.hasOwn(x,k);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = (x,min=0) => Number.isSafeInteger(x) && x >= min;
const id = x => typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(x);
const copy = x => JSON.parse(JSON.stringify(x));
// Reject accessors, non-JSON values and cycles; preserve unknown JSON extensions.
function json(x,seen=new Set()) {
  if(x===null||typeof x==='string'||typeof x==='boolean')return true;
  if(typeof x==='number')return Number.isFinite(x);
  if(typeof x!=='object'||seen.has(x))return false;
  const proto=Object.getPrototypeOf(x);
  // Cross-realm intrinsic prototypes are legitimate; arbitrary intermediate
  // prototypes (including null-prototype ones) are not JSON object structure.
  const nativePrototype=(p,name)=>{
    if(!p||Object.hasOwn(p,'toJSON'))return false;
    const d=Object.getOwnPropertyDescriptor(p,'constructor');
    if(!d||!own(d,'value')||typeof d.value!=='function')return false;
    const pd=Object.getOwnPropertyDescriptor(d.value,'prototype');
    return pd?.value===p && Function.prototype.toString.call(d.value)===`function ${name}() { [native code] }`;
  };
  const plainPrototype=p=>p===null||(Object.getPrototypeOf(p)===null&&nativePrototype(p,'Object'));
  if(Array.isArray(x)) {
    if(!nativePrototype(proto,'Array')||!plainPrototype(Object.getPrototypeOf(proto)))return false;
  } else if(!plainPrototype(proto))return false;
  seen.add(x);
  const descriptors=Object.getOwnPropertyDescriptors(x);
  if(Object.getOwnPropertySymbols(x).length)return false;
  for(const [k,d]of Object.entries(descriptors)) {
    if(Array.isArray(x)&&k==='length')continue;
    if(!d.enumerable||!own(d,'value')||!json(d.value,seen))return false;
  }
  if(Array.isArray(x)) {
    const keys=Object.keys(x);
    if(keys.length!==x.length||keys.some((key,i)=>key!==String(i)))return false;
  }
  seen.delete(x);return true;
}
function stable(x) {
  if(Array.isArray(x))return '['+x.map(stable).join(',')+']';
  if(object(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';
  return JSON.stringify(x);
}
export function defaultSpace() {
  return {schemaVersion:1,lv:{tech:1,war:1,med:1,life:1},pts:0,voyage:null,
    items:{},cards:{},hidden:{},alienCards:0,wins:0,ended:false,earth:false,visits:{}};
}
export function validateSpace(value) {
  if(!object(value)||!json(value))return {ok:false,code:'SPACE_INVALID_READ_ONLY'};
  if(value.schemaVersion!==SPACE_SCHEMA_VERSION)return {ok:false,code:'SPACE_VERSION_READ_ONLY'};
  const required=Object.keys(defaultSpace());
  const map=(x,p)=>object(x)&&Object.entries(x).every(([k,v])=>id(k)&&p(v));
  const voyage=value.voyage;
  if(!required.every(k=>own(value,k))||!object(value.lv)||!['tech','war','med','life'].every(k=>own(value.lv,k)&&integer(value.lv[k],1))||
    !integer(value.pts)||!integer(value.alienCards)||!integer(value.wins)||typeof value.ended!=='boolean'||typeof value.earth!=='boolean'||
    !map(value.items,x=>integer(x,1))||!map(value.cards,x=>integer(x))||!map(value.hidden,x=>typeof x==='boolean')||!map(value.visits,x=>integer(x))||
    !(voyage===null||(object(voyage)&&['route','start','dur','ev'].every(k=>own(voyage,k))&&id(voyage.route)&&integer(voyage.start)&&integer(voyage.dur)&&
      (voyage.ev===null||id(voyage.ev)))))return {ok:false,code:'SPACE_INVALID_READ_ONLY'};
  return {ok:true};
}
export function readSpace(state) {
  if(!object(state)||!json(state))return {ok:false,code:'SPACE_PARENT_INVALID_READ_ONLY'};
  if(!own(state,'space'))return {ok:true,missing:true,space:defaultSpace()};
  const checked=validateSpace(state.space);
  return checked.ok?{ok:true,missing:false,space:copy(state.space)}:checked;
}
export function migrateSpace(state) {
  const read=readSpace(state);if(!read.ok)return read;
  // A pure proposal; never mutates the caller or writes a save.
  return {ok:true,initialized:read.missing,state:read.missing?{...copy(state),space:read.space}:copy(state)};
}
export function spaceTransition(before,after,{initialize=false}={}) {
  const a=readSpace(before),b=readSpace(after);if(!a.ok)return a;if(!b.ok)return b;
  if(initialize) {
    if(!a.missing||b.missing||stable(after.space)!==stable(defaultSpace()))return {ok:false,code:'SPACE_INITIALIZATION_ONLY'};
    const projected={...after};delete projected.space;
    if(!json(before)||!json(projected)||stable(before)!==stable(projected))return {ok:false,code:'SPACE_INITIALIZATION_ONLY'};
    return {ok:true};
  }
  return a.missing===b.missing&&(a.missing||stable(before.space)===stable(after.space))?
    {ok:true}:{ok:false,code:'SPACE_CHANGE_REQUIRES_OWNED_INITIALIZATION'};
}

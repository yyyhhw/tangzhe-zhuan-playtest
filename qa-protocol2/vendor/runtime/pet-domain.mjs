/** Audit-only candidate. Pure pet-domain transition guard; no writes or grants.
 * Inject the exact reviewed PetGame.norm and Economy, not untrusted save data.
 * Unknown records/versions/fields may survive unchanged but are never opened
 * as arbitrary mutable subtrees. Legacy state.pet is an immutable shadow. */
export const PET_DOMAIN_ENABLED=false;
const species=new Set(['dog','cat','red_panda','robot','panda_cub','alpaca','rabbit']);
const rowKeys=new Set(['uid','species','room','boughtAt','eng','compatibility','quarantined','uidRepair']);
const dogKeys=new Set(['v','savedAt','t','rs','dog','ball','home']);
const companionKeys=new Set(['schema','v','species','savedAt','t','rs','pet','toy','home']);
const dogBody=new Set(['x','y','dir','energy','affinity','lastGain','tired','asleep','lastEat']);
const companionBody=new Set(['x','y','dir','energy','affinity','lastGain']);
const ballKeys=new Set(['x','y','carried']),toyKeys=new Set(['kind','x','y','until']);
const toys={cat:'teaser',red_panda:'wood_ball',robot:'beacon',panda_cub:'bamboo',alpaca:'ribbon',rabbit:'willow'};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),own=(x,k)=>Object.hasOwn(x,k);
const finite=x=>typeof x==='number'&&Number.isFinite(x),uint=x=>Number.isInteger(x)&&x>=0&&x<=0xffffffff;
const uid=x=>typeof x==='string'&&x.trim().length>0;
const clone=x=>JSON.parse(JSON.stringify(x));
const exactKeys=(x,keys)=>obj(x)&&Object.keys(x).every(k=>keys.has(k));

export function createPetDomain({economy:E,petGame:PG,canonical}){
  if(!E?.CEO_BY_ID||typeof E.homeOpen!=='function'||typeof PG?.norm!=='function'||typeof canonical!=='function')throw Error('PET_DOMAIN_DEPENDENCIES_REQUIRED');
  const eq=(a,b)=>canonical(a)===canonical(b);
  const sameField=(a,b,k)=>own(a,k)===own(b,k)&&(!own(a,k)||eq(a[k],b[k]));
  // Avoid relying on iterator helpers in browser runtimes.
  function extrasSame(a,b,known){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(!known.has(k)&&!sameField(a,b,k))return false;return true;}
  const room=(s,r)=>r===null||(typeof r==='string'&&own(E.CEO_BY_ID,r)&&E.homeOpen(s,r));
  function engineKind(e,s){
    if(e===null||e===undefined)return 'empty';
    if(!obj(e)||e.v!==1)return 'opaque';
    if(s==='dog')return (!obj(e.dog)||!own(e.dog,'v'))&&(!obj(e.ball)||!own(e.ball,'v'))?'dog':'opaque';
    return species.has(s)&&e.schema==='tangzhe-companion-save/1'&&e.species===s&&obj(e.pet)&&!own(e.pet,'v')?'companion':'opaque';
  }
  function validBody(p,dog){return obj(p)&&finite(p.x)&&finite(p.y)&&['E','W','N','S'].includes(p.dir)&&finite(p.energy)&&p.energy>=0&&p.energy<=100&&Number.isInteger(p.affinity)&&p.affinity>=40&&p.affinity<=(dog?99999:100)&&finite(p.lastGain)&&(!dog||typeof p.tired==='boolean'&&typeof p.asleep==='boolean'&&finite(p.lastEat));}
  function validEngine(e,s,state){
    const kind=engineKind(e,s);if(kind==='empty')return true;if(kind==='opaque')return false;
    if(!finite(e.savedAt)||e.savedAt<0||!finite(e.t)||e.t<0||!uint(e.rs)||typeof e.home!=='string'||!own(E.CEO_BY_ID,e.home))return false;
    if(kind==='dog')return validBody(e.dog,true)&&obj(e.ball)&&finite(e.ball.x)&&finite(e.ball.y)&&typeof e.ball.carried==='boolean';
    return validBody(e.pet,false)&&(e.toy===null||obj(e.toy)&&e.toy.kind===toys[s]&&finite(e.toy.x)&&finite(e.toy.y)&&finite(e.toy.until));
  }
  function engineTransition(a,b,s,state){
    if(eq(a??null,b??null))return true;
    const oldKind=engineKind(a,s),nextKind=engineKind(b,s);
    if(oldKind==='opaque'||nextKind==='empty'||nextKind==='opaque'||!validEngine(b,s,state))return false;
    const aa=obj(a)?a:{},keys=s==='dog'?dogKeys:companionKeys;
    if(!extrasSame(aa,b,keys))return false;
    for(const [key,known]of (s==='dog'?[['dog',dogBody],['ball',ballKeys]]:[['pet',companionBody],['toy',toyKeys]])){
      const av=aa[key],bv=b[key];
      if(obj(av)&&!obj(bv)&&Object.keys(av).some(k=>!known.has(k)))return false;
      if(obj(bv)&&!extrasSame(obj(av)?av:{},bv,known))return false;
    }
    return true;
  }
  function recognizedRoster(p){return obj(p)&&p.v===2&&Array.isArray(p.list)&&p.list.every(obj)&&(!own(p,'activeSpecies')||obj(p.activeSpecies));}
  function transition(before,after){
    try{
      canonical(before);canonical(after);
      if(!sameField(before,after,'pet'))throw Error('LEGACY_PET_SHADOW_CHANGED');
      if(sameField(before,after,'pets'))return {ok:true,changed:false};
      if(own(before,'pets')&&!recognizedRoster(before.pets))throw Error('UNKNOWN_PETS_ROSTER_CHANGED');
      if(!recognizedRoster(after.pets))throw Error('INVALID_PETS_ROSTER');
      const normalized=clone(before);PG.norm(normalized,E);
      const baseline=normalized.pets??{v:2,list:[]};
      if(!recognizedRoster(baseline))throw Error('UNKNOWN_PETS_ROSTER_CHANGED');
      const a=baseline,b=after.pets;
      if(!extrasSame(a,b,new Set(['v','list','activeSpecies'])))throw Error('OPAQUE_PETS_FIELD_CHANGED');
      if(b.list.length<a.list.length)throw Error('PET_RECORD_REMOVED');
      const ids=new Set(),counts={},active=new Set();
      for(let i=0;i<b.list.length;i++){
        const old=a.list[i],next=b.list[i];
        if(old&&!species.has(old.species)){
          if(!eq(old,next))throw Error('OPAQUE_PET_RECORD_CHANGED');
          continue;
        }
        if(!species.has(next.species)||!uid(next.uid)||ids.has(next.uid)||!room(after,next.room)||!finite(next.boughtAt)||next.boughtAt<0||next.boughtAt>8.64e15||!own(next,'eng'))throw Error('INVALID_PET_RECORD');
        ids.add(next.uid);
        if(own(next,'compatibility')&&typeof next.compatibility!=='boolean'||own(next,'quarantined')&&next.quarantined!==false)throw Error('INVALID_PET_FLAGS');
        if(old){
          if(next.uid!==old.uid||next.species!==old.species||next.boughtAt!==old.boughtAt||!sameField(old,next,'uidRepair'))throw Error('PET_IDENTITY_CHANGED');
          if(!extrasSame(old,next,rowKeys))throw Error('OPAQUE_PET_FIELD_CHANGED');
          if(!engineTransition(old.eng,next.eng,next.species,after))throw Error('UNSUPPORTED_PET_ENGINE_CHANGE');
        }else{
          if(!exactKeys(next,rowKeys)||own(next,'uidRepair')||next.eng!==null||b.list.slice(0,i).some(p=>p.species===next.species))throw Error('INVALID_NEW_PET');
        }
        if(next.room!==null){
          if(next.compatibility===true||active.has(next.species))throw Error('INVALID_ACTIVE_PET');
          active.add(next.species);counts[next.room]=(counts[next.room]??0)+1;if(counts[next.room]>2)throw Error('PET_ROOM_OVERFULL');
        }
      }
      const ap=a.activeSpecies??{},bp=b.activeSpecies??{};
      for(const k of new Set([...Object.keys(ap),...Object.keys(bp)])){
        if(!species.has(k)){if(!sameField(ap,bp,k))throw Error('OPAQUE_PET_PREFERENCE_CHANGED');continue;}
        if(!own(bp,k)||!uid(bp[k])||!b.list.some(p=>p.species===k&&p.uid===bp[k]))throw Error('INVALID_PET_PREFERENCE');
      }
      return {ok:true,changed:true};
    }catch(e){return {ok:false,code:e?.message||String(e)};}
  }
  function canSnapshot(record){
    if(!obj(record)||!species.has(record.species))return false;
    const e=record.eng,kind=engineKind(e,record.species);if(kind==='empty')return true;if(kind==='opaque')return false;
    if(!exactKeys(e,kind==='dog'?dogKeys:companionKeys))return false;
    return kind==='dog'?(!obj(e.dog)||exactKeys(e.dog,dogBody))&&(!obj(e.ball)||exactKeys(e.ball,ballKeys)):exactKeys(e.pet,companionBody)&&(!own(e,'toy')||e.toy===null||exactKeys(e.toy,toyKeys));
  }
  return Object.freeze({transition,canSnapshot,validEngine,engineKind,mutableFields:Object.freeze(['pets'])});
}

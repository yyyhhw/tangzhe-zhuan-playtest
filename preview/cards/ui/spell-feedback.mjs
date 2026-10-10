/** Presentation of successful public events only. No rule, save, AI, RNG or hand access. */
export const SPELL_TIMING = Object.freeze({windup:460,flight:420,impact:1250,gap:150});
export const SHIELD_ATTACK_TIMING = Object.freeze({windup:180,flight:320,impact:1250,gap:150});
const VISUALS = Object.freeze({
  VAN_EX1_371:{theme:'holy',name:'圣盾'},
  VAN_EX1_400:{theme:'wind',name:'旋风'},
  VAN_CS2_025:{theme:'arcane',name:'奥术'},
  VAN_CS2_023:{theme:'arcane',name:'书页'},
  VAN_CS2_029:{theme:'fire',name:'火球'},
  VAN_CS2_032:{theme:'fire',name:'烈焰'},
  VAN_CS2_089:{theme:'heal',name:'治疗'},
  VAN_CS2_093:{theme:'holy',name:'圣光'},
  VAN_CS2_062:{theme:'shadow',name:'暗焰'},
});
const POWERS = Object.freeze({mage:{theme:'fire',name:'火球'},warrior:{theme:'ward',name:'护甲'},paladin:{theme:'holy',name:'召唤'},warlock:{theme:'shadow',name:'墨契'}});
/** Card identity comes from resolved play.cardId, never a hand or a command's guess. */
export function planSpellFeedback(events,captured,cardInfo) {
  const attack=(events || []).find(e=>e.type==='attack');
  const shieldAttack=attack && (events || []).some(e=>e.type==='shieldBreak');
  const cast=(events || []).find(e=>e.type==='play'||e.type==='power') || (shieldAttack?{type:'attack',player:captured?.[attack.source]?.player}:null);
  if (!cast) return null;
  const card=cast.type==='play'?cardInfo(cast.cardId):null;
  if (cast.type==='play' && card?.type!=='spell') return null;
  // A lightning renderer is defined for explicitly marked presentation effects,
  // but no current card or rule is relabelled to admit one.
  const visual=cast.type==='attack'?{theme:'holy',name:'攻击'}:cast.type==='power'?POWERS[cast.classId]:card.effect?.visual==='lightning'?{theme:'lightning',name:'闪电'}:VISUALS[card.metadata?.sourceId] || (card.id==='spareMinute'?{theme:'mana',name:'法力'}:null);
  if (!visual) return null;
  const casterEntry=cast.type==='attack'?[attack.source,captured?.[attack.source]]:Object.entries(captured || {}).find(([,c])=>c.isHero && c.player===cast.player);
  if (!casterEntry?.[1]) return null;
  const [source,anchor]=casterEntry, targets=new Map();
  const target=(uid)=>{if(!targets.has(uid))targets.set(uid,{uid,damage:0,armorLost:0,heal:null,armor:null,draw:0,burn:0,mana:null,summon:false,dead:false,shieldGranted:false,shieldAlready:false,shieldBreak:0});return targets.get(uid);};
  for (const e of events) {
    if (e.type==='damage' && e.amount>0) {const t=target(e.target);t.damage+=e.amount;t.armorLost+=e.absorbed||0;}
    if (e.type==='shieldGrant') {const t=target(e.target);t.shieldGranted=true;t.shieldAlready=!!e.already;}
    if (e.type==='shieldBreak') target(e.target).shieldBreak+=e.prevented;
    if (e.type==='heal') target(e.target).heal=(target(e.target).heal||0)+e.amount;
    if (e.type==='armor') target(e.target).armor=(target(e.target).armor||0)+e.amount;
    if (e.type==='death') target(e.uid).dead=true;
    if (e.type==='draw' && e.player===cast.player) target(source).draw++;
    if (e.type==='burn' && e.player===cast.player) target(source).burn++;
    if (e.type==='mana' && e.player===cast.player) target(source).mana=(target(source).mana||0)+e.amount;
    if (e.type==='summon' && e.player===cast.player) target(e.uid).summon=true;
  }
  if (!targets.size) target(source);
  return {kind:cast.type,attackTarget:cast.type==='attack'?attack.target:null,source,sourceName:anchor.publicName,player:cast.player,...visual,targets:[...targets.values()],label:card?.name || visual.name};
}
export function resultLabel(target) {
  const parts=[];
  if(target.shieldGranted)parts.push(target.shieldAlready?'圣盾已存在':'获得圣盾');
  if(target.shieldBreak)parts.push(`圣盾破碎 · 抵挡 ${target.shieldBreak}`);
  if(target.damage)parts.push(target.armorLost?`生命 −${target.damage-target.armorLost} · 护甲 −${target.armorLost}`:`−${target.damage}`);
  if(target.heal!==null)parts.push(`生命 +${target.heal}`);
  if(target.armor!==null)parts.push(`护甲 +${target.armor}`);
  if(target.draw)parts.push(`抽牌 ${target.draw}`);
  if(target.burn)parts.push(`弃牌 ${target.burn}`);
  if(target.mana!==null)parts.push(`法力 +${target.mana}`);
  if(target.summon)parts.push('已召唤');
  return parts.join(' · ') || '已施放';
}
export function keywordLabels(entity) {
  const keys=Array.isArray(entity?.keywords)?entity.keywords:[];
  // Only actual runtime keywords create labels; never infer them from card art or text.
  return [['charge','冲锋'],['taunt','嘲讽'],['divineShield','圣盾']].filter(([key])=>keys.includes(key)).map(([key,label])=>({key,label}));
}
/** Clone only a public character. Freeze computed appearance outside its old ancestors. */
export function clonePublicCharacter(node,getStyle=globalThis.getComputedStyle) {
  const clone=node.cloneNode(true);
  const originals=[node,...(node.querySelectorAll?.('*')||[])],copies=[clone,...(clone.querySelectorAll?.('*')||[])];
  originals.forEach((original,i)=>{
    const copy=copies[i];if(!copy)return;
    if(getStyle){try{const style=getStyle(original);for(const property of style)copy.style.setProperty(property,style.getPropertyValue(property));}catch{}}
    copy.removeAttribute?.('id');copy.removeAttribute?.('data-entity');copy.removeAttribute?.('data-gesture-target');copy.removeAttribute?.('data-card');
    copy.removeAttribute?.('aria-live');copy.removeAttribute?.('aria-describedby');copy.removeAttribute?.('aria-labelledby');
    if(copy.style){copy.style.animation='none';copy.style.transition='none';}
    copy.tabIndex=-1;if('disabled'in copy)copy.disabled=true;copy.inert=true;
  });
  const wasTarget=node.classList?.contains?.('valid-target');
  clone.classList?.remove?.('selected','valid-target','can-attack');
  clone.style.outline='none';if(wasTarget)clone.style.boxShadow='none';
  clone.setAttribute('aria-hidden','true');return clone;
}
/** Deterministic visual shards, never game RNG. Caller owns animations and cleanup. */
export function addShieldBreak({document,layer,rect,uid,reduced,animate}) {
  const ring=document.createElement('span');ring.className='divine-shield-break';ring.dataset.shieldTarget=uid;
  Object.assign(ring.style,{left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});layer.append(ring);
  if(reduced)return;
  animate(ring,[{transform:'scale(1)',opacity:1},{transform:'scale(1.14)',opacity:0}],{duration:420,easing:'ease-out',fill:'forwards'});
  for(let i=0;i<8;i++) {
    const angle=i*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle),shard=document.createElement('span');shard.className='divine-shield-shard';shard.dataset.shieldTarget=uid;
    Object.assign(shard.style,{left:`${rect.left+rect.width/2+x*rect.width*.4}px`,top:`${rect.top+rect.height/2+y*rect.height*.4}px`,transform:`rotate(${i*45}deg)`});layer.append(shard);
    animate(shard,[{transform:`rotate(${i*45}deg)`,opacity:1},{transform:`translate(${x*23}px,${y*23}px) rotate(${i*45+80}deg)`,opacity:0}],{duration:500,easing:'ease-out',fill:'forwards'});
  }
}
function syncShieldScene(clone,liveNode) {
  clone.classList.remove('has-divine-shield');
  for(const old of clone.querySelectorAll('.divine-shield-shell,.minion-keywords'))old.remove();
  for(const selector of ['.divine-shield-shell','.minion-keywords']) {
    const source=liveNode.querySelector(selector);if(!source)continue;
    const copy=clonePublicCharacter(source);for(const node of [copy,...copy.querySelectorAll('*')])node.style.visibility='visible';clone.append(copy);
    if(selector==='.divine-shield-shell')clone.classList.add('has-divine-shield');
  }
  const from=liveNode.querySelector('.minion-name'),to=clone.querySelector('.minion-name');
  if(from&&to&&globalThis.getComputedStyle)to.style.bottom=globalThis.getComputedStyle(from).bottom;
}
/** Update public text without flattening styled descendants (e.g. hidden stat labels).
 * A changed structure is left intact rather than converted into visible label text. */
export function syncPublicText(from,to) {
  const source=Array.from(from.childNodes || []),target=Array.from(to.childNodes || []);
  if (!source.length && !target.length) { to.textContent=from.textContent; return; }
  if (source.length!==target.length) return;
  source.forEach((node,index)=>{
    const copy=target[index];if(node.nodeType!==copy.nodeType)return;
    if(node.nodeType===3 || node.nodeType===4)copy.nodeValue=node.nodeValue;
    else if(node.nodeType===1 && node.nodeName===copy.nodeName)syncPublicText(node,copy);
  });
}
export function createSpellFeedback({document,isBlocked,matchMedia,now=()=>globalThis.performance?.now?.()??Date.now(),setTimer=setTimeout,clearTimer=clearTimeout,onFinish=()=>{}}) {
  let current=null,lastError=null;
  const center=r=>({x:r.left+r.width/2,y:r.top+r.height/2});
  function clear() {
    const owner=current;current=null;if(!owner)return;
    for(const timer of owner.timers)clearTimer(timer);
    for(const animation of owner.animations){try{animation.cancel();}catch{}}
    try{owner.layer.remove();}catch{}
    delete document.body.dataset.spellScene;
  }
  function remaining(){return current?Math.max(0,current.expires-now())+SPELL_TIMING.gap:0;}
  function show(plan,captured,actionStartedAt) {
    clear();if(!plan||isBlocked())return false;
    try{
    const source=captured[plan.source];if(!source)return false;
    const timing=plan.kind==='attack'?SHIELD_ATTACK_TIMING:SPELL_TIMING;
    const started=now(),duration=timing.windup+timing.flight+timing.impact;
    const layer=document.createElement('div');layer.className=`combat-fx spell-fx effect-${plan.theme}`;layer.setAttribute('aria-hidden','true');
    Object.assign(layer.dataset,{phase:'windup',caster:plan.source,effect:plan.theme,actionStartedAt:String(actionStartedAt??started),fxStartedAt:String(started),fxExpiresAt:String(started+duration),impactAt:String(started+timing.windup+timing.flight)});
    const owner={layer,timers:new Set(),animations:[],expires:started+duration};current=owner;
    const valid=()=>{if(current!==owner)return false;if(isBlocked()){clear();return false;}return true;};
    const later=(fn,ms)=>{const timer=setTimer(()=>{owner.timers.delete(timer);if(valid()){try{fn();}catch(error){lastError=String(error?.message||error);clear();onFinish();}}},ms);owner.timers.add(timer);};
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    layer.dataset.reducedMotion=String(reduced);
    const animate=(el,frames,options)=>{if(reduced)return false;try{if(!el.animate)return false;owner.animations.push(el.animate(frames,options));return true;}catch{return false;}};
    const add=(className,text)=>{const el=document.createElement('span');el.className=className;if(text!==undefined)el.textContent=text;layer.append(el);return el;};
    const position=(el,r)=>{Object.assign(el.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});};
    const dot=(el,p)=>{el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;};
    const avatar=source.avatarRect||source.rect,origin={x:avatar.left+avatar.width/2,y:Math.max(22,avatar.top-22)};
    const mark=add('spell-caster-ring');position(mark,source.rect);
    const orb=add('spell-charge');dot(orb,origin);if(plan.kind==='attack')orb.hidden=true;
    const label=add('spell-phase-label',`${plan.name} · 蓄力`);dot(label,{x:origin.x,y:Math.max(9,origin.y-26)});
    animate(orb,[{transform:'translate(-50%,-50%) scale(.25)',opacity:.6},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:timing.windup,easing:'ease-out',fill:'forwards'});
    // Reflowed survivors use their live UID. Removed targets use a named public
    // death lane; never land a hit on the new occupant of an old board rectangle.
    const live=[...document.querySelectorAll('[data-entity]')];
    const dead=plan.targets.filter(t=>t.dead),band=document.getElementById?.('last-action-status')?.getBoundingClientRect();
    let deathLane=null;
    if(dead.length && band){deathLane=add('combat-death-lane');deathLane.hidden=true;position(deathLane,band);}
    const scene=new Map();
    for(const [uid,entry] of Object.entries(captured)){
      if(!entry.sceneClone)continue;
      const clone=entry.sceneClone;clone.classList.add('spell-scene-character');clone.dataset.sceneEntity=uid;
      Object.assign(clone.style,{position:'absolute',margin:'0',transform:'none',visibility:'visible',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none'});position(clone,entry.rect);layer.append(clone);scene.set(uid,clone);
    }
    if(plan.kind==='attack') {
      const moving=scene.get(plan.source),target=captured[plan.attackTarget];
      if(moving&&target){const a=center(source.rect),b=center(target.rect),dx=b.x-a.x,dy=b.y-a.y,total=timing.windup+timing.flight+200;
        moving.dataset.attacking='true';
        animate(moving,[{transform:'translate(0,0)'},{transform:'translate(0,0)',offset:timing.windup/total},{transform:`translate(${dx}px,${dy}px) scale(1.06)`,offset:(timing.windup+timing.flight)/total},{transform:'translate(0,0)'}],{duration:total,easing:'ease-in-out',fill:'forwards'});
      }
    }
    document.body.dataset.spellScene='windup';
    const endpoints=plan.targets.map(t=>{
      const anchor=captured[t.uid],node=live.find(el=>el.dataset.entity===t.uid);
      let rect=anchor?.rect||node?.getBoundingClientRect();
      let badge=null;
      if(t.dead){
        if(!deathLane)return null;
        // The projectile keeps the original battlefield endpoint; the death
        // lane is only an additional public result, never the flight target.
        badge=document.createElement('span');badge.className='combat-death-badge spell-fallen-target';badge.dataset.fallenTarget=t.uid;
        badge.textContent=`${anchor?.publicSide||''}·${anchor?.publicName||'随从'} 阵亡`;badge.hidden=true;deathLane.append(badge);
      }
      return rect?{...t,rect,badge}:null;
    }).filter(Boolean);
    document.body.append(layer);
    later(()=>{
      layer.dataset.phase='flight';document.body.dataset.spellScene='flight';label.textContent=`${plan.name} · 施放`;orb.remove();
      for(const endpoint of endpoints){
        const end=center(endpoint.rect),dx=end.x-origin.x,dy=end.y-origin.y,length=Math.hypot(dx,dy);
        if(plan.theme==='lightning'){
          // Fixed geometry, never rules RNG: a continuous caster-to-target bolt.
          const points=Array.from({length:7},(_,i)=>{const f=i/6,offset=i===0||i===6?0:(i%2?8:-8);return{x:origin.x+dx*f-(length?dy/length:0)*offset,y:origin.y+dy*f+(length?dx/length:0)*offset};});
          for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],bolt=add('spell-path spell-bolt');dot(bolt,a);bolt.style.width=`${Math.hypot(b.x-a.x,b.y-a.y)}px`;bolt.style.transform=`rotate(${Math.atan2(b.y-a.y,b.x-a.x)}rad)`;bolt.dataset.target=endpoint.uid;}
        }else{
          const path=add('spell-path');dot(path,origin);path.style.width=`${length}px`;path.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;path.dataset.target=endpoint.uid;
        }
        const targetMark=add('spell-target-marker');position(targetMark,endpoint.rect);targetMark.dataset.target=endpoint.uid;
        if(!reduced && plan.theme!=='lightning' && plan.kind!=='attack'){
          const projectile=add('spell-projectile');dot(projectile,origin);projectile.dataset.target=endpoint.uid;
          const moving=animate(projectile,[{transform:'translate(-50%,-50%) scale(.85)'},{transform:`translate(calc(-50% + ${dx*.5}px),calc(-50% + ${dy*.5-18}px)) scale(1.1)`,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.85)`}],{duration:timing.flight,easing:'cubic-bezier(.3,.1,.65,.9)',fill:'forwards'});
          if(!moving)dot(projectile,end);
        }
      }
    },timing.windup);
    later(()=>{
      layer.dataset.phase='impact';document.body.dataset.spellScene='impact';label.textContent=`${plan.name} · 命中`;
      if(deathLane)deathLane.hidden=false;
      // Reveal already-resolved public stats at contact, retaining the old
      // coordinates until cleanup so board reflow cannot steal the target.
      for(const [uid,clone] of scene){
        const endpoint=endpoints.find(t=>t.uid===uid);
        if(endpoint?.dead){
          clone.style.filter='grayscale(1)';clone.dataset.departing='true';
          animate(clone,[{opacity:1},{opacity:0}],{duration:340,easing:'ease-out',fill:'forwards'});
          later(()=>clone.remove(),340);continue;
        }
        const liveNode=[...document.querySelectorAll('[data-entity]')].find(el=>el.dataset.entity===uid);
        if(!liveNode)continue;
        if(plan.targets.some(t=>t.summon))position(clone,liveNode.getBoundingClientRect());
        syncShieldScene(clone,liveNode);
        for(const selector of ['.health-stat','.hp','.armor','.minion-status','.hero-readiness']){const from=liveNode.querySelector(selector),to=clone.querySelector(selector);if(from&&to)syncPublicText(from,to);}
      }
      for(const el of layer.querySelectorAll('.spell-path,.spell-projectile,.spell-target-marker'))el.remove();
      for(const endpoint of endpoints){
        if(endpoint.summon && !scene.has(endpoint.uid)){
          const liveNode=[...document.querySelectorAll('[data-entity]')].find(el=>el.dataset.entity===endpoint.uid);
          if(liveNode){const clone=clonePublicCharacter(liveNode);clone.classList.add('spell-scene-character');clone.dataset.sceneEntity=endpoint.uid;for(const node of [clone,...clone.querySelectorAll('*')])node.style.visibility='visible';Object.assign(clone.style,{position:'absolute',margin:'0',transform:'none',minWidth:'0',minHeight:'0',maxWidth:'none',maxHeight:'none'});position(clone,endpoint.rect);layer.append(clone);scene.set(endpoint.uid,clone);}
        }
        if(endpoint.dead && endpoint.badge){endpoint.badge.hidden=false;endpoint.badge.dataset.damageTarget=endpoint.uid;endpoint.badge.textContent+=` · ${resultLabel(endpoint)}`;}
        if(endpoint.shieldBreak)addShieldBreak({document,layer,rect:endpoint.rect,uid:endpoint.uid,reduced,animate});
        const burst=add('combat-impact spell-impact');position(burst,endpoint.rect);burst.dataset.damageTarget=endpoint.uid;
        const number=add(`combat-damage spell-result${endpoint.damage?'':' spell-benefit'}`,resultLabel(endpoint));dot(number,center(endpoint.rect));number.dataset.damageTarget=endpoint.uid;
        const flare=add('spell-impact-flare');position(flare,endpoint.rect);
        animate(flare,[{transform:'scale(.75)',opacity:.8},{transform:'scale(1.2)',opacity:0}],{duration:360,easing:'ease-out',fill:'forwards'});
      }
    },timing.windup+timing.flight);
    later(()=>{clear();onFinish();},duration);
    return true;
    }catch(error){lastError=String(error?.message||error);clear();return false;}
  }
  return {show,clear,remaining,active:()=>!!current,error:()=>lastError};
}

// Presentation only: runtime fields are the source; artwork themes are not schools.
const mechanismKeys = card => [...new Set([...(card?.keywords || []),...(card?.effect?.kind==='grantDivineShield'?['divineShield']:[])])];
export function mechanismText(card) {
  const definitions = {charge:'冲锋：登场当回合即可攻击。',taunt:'嘲讽：敌方攻击须先选择嘲讽随从。',divineShield:'圣盾：抵挡下一次正数伤害，随后消失。'};
  const lines = mechanismKeys(card).filter(k=>definitions[k]).map(k=>definitions[k]);
  if (card?.spellDamage > 0) lines.push(`法伤 +${card.spellDamage}：提高己方法术伤害，不影响英雄技能。`);
  return lines.join(' ');
}
export function mechanismLabels(card) {
  const names={charge:'冲锋',taunt:'嘲讽',divineShield:'圣盾'};
  return [...mechanismKeys(card).filter(k=>names[k]).map(k=>names[k]),...(card?.spellDamage>0?[`法伤+${card.spellDamage}`]:[])].join(' · ');
}
export function powerDescription(game, player, cards) {
  const p=game.config.powers, cls=game.players[player].classId, token=cards[p.paladinToken];
  const descriptions={warrior:`自身获得 ${p.warriorArmor} 点护甲；无需选择目标。`,mage:`选择任意一个英雄或随从（含己方），造成 ${p.mageDamage} 点伤害；不受法伤加成。`,paladin:`在己方场上召唤 ${token.name}（${token.attack} 攻 / ${token.health} 血）；无需目标，满场不可用。`,warlock:`自身抽 ${p.warlockDraw} 张牌，再对自己造成 ${p.warlockDamage} 点伤害；无需选择目标。满手抽牌会销毁，空牌库会触发疲劳。`};
  return `${p.cost} 法力 · 每回合一次。${descriptions[cls] || ''}`;
}
export function heavyHit(events) {
  // Only one resolved hit reaching six life damage; no summing AoE, absorption,
  // shield-break prevention, or nominal card damage into a false heavy impact.
  return Math.max(0,...(events || []).filter(e=>e.type==='damage').map(e=>Math.max(0,(e.amount||0)-(e.absorbed||0))));
}
export function createHeavyFeedback({document,matchMedia}) {
  let owner=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function clear(){
    const previous=owner;owner=null;if(!previous)return;
    for(const timer of previous.timers)clearTimeout(timer);
    for(const animation of previous.animations){try{animation.cancel();}catch{}}
    for(const item of previous.numbers){item.node.classList.remove('is-heavy-number');item.node.textContent=item.text;item.node.style.top=item.top;item.node.style.left=item.left;}
    previous.layer?.remove();
  }
  function show(events,captured={},delay=0){
    clear();
    const hit=(events||[]).filter(e=>e.type==='damage'&&(e.amount||0)-(e.absorbed||0)>=6)
      .sort((a,b)=>(b.amount-(b.absorbed||0))-(a.amount-(a.absorbed||0)))[0];
    if(!hit || document.visibilityState==='hidden')return;
    const current={timers:[],animations:[],numbers:[],layer:null};owner=current;
    const later=(fn,ms)=>current.timers.push(setTimeout(()=>{if(owner===current)fn();},ms));
    const animate=(el,frames,options)=>{
      if(reduced.matches||!el?.animate)return;
      try{current.animations.push(el.animate(frames,options));}catch{}
    };
    const impact=()=>{
      if(document.visibilityState==='hidden'){clear();return;}
      const amount=hit.amount-(hit.absorbed||0);
      const layer=document.createElement('div');current.layer=layer;
      layer.className='heavy-impact';layer.setAttribute('aria-hidden','true');layer.dataset.lifeDamage=String(amount);
      layer.dataset.damageTarget=hit.target||'';layer.dataset.phase='impact';
      document.body.append(layer);
      const live=[...document.querySelectorAll('[data-entity]')].find(n=>n.dataset.entity===hit.target);
      const fallen=[...document.querySelectorAll('[data-fallen-target]')].find(n=>n.dataset.fallenTarget===hit.target);
      // Survivors follow their current UID; dead characters use their named result
      // badge, never a vacated rectangle now occupied by another character.
      const anchor=live||fallen;
      const rect=anchor?.getBoundingClientRect();
      if(rect){
        const ring=document.createElement('span');ring.className='heavy-hit-ring';
        Object.assign(ring.style,{left:`${rect.left-6}px`,top:`${rect.top-6}px`,width:`${rect.width+12}px`,height:`${rect.height+12}px`});layer.append(ring);
        animate(ring,[{scale:'.72',opacity:1},{scale:'1.22',opacity:.9,offset:.3},{scale:'1.4',opacity:0}],{duration:440,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
        if(!reduced.matches){
          for(let i=0;i<8;i++){
            const angle=i*Math.PI/4,dx=Math.cos(angle),dy=Math.sin(angle);
            const streak=document.createElement('span');streak.className='heavy-hit-streak';
            Object.assign(streak.style,{left:`${rect.left+rect.width/2}px`,top:`${rect.top+rect.height/2}px`});layer.append(streak);
            animate(streak,[{transform:`translate(${dx*15}px,${dy*15}px) rotate(${i*45}deg)`,opacity:1},{transform:`translate(${dx*(rect.width/2+28)}px,${dy*(rect.height/2+20)}px) rotate(${i*45}deg)`,opacity:0}],{duration:330,easing:'ease-out',fill:'forwards'});
          }
        }
        // Only an inner, decorative portrait moves. Button geometry, stats,
        // pointer routing, legal targets and simulation remain untouched.
        const portrait=live?.querySelector('.minion-art,.hero-avatar');
        if(portrait)animate(portrait,[{translate:'0 0',filter:'brightness(1)'},{translate:'-10px 3px',filter:'brightness(2.2)',offset:.15},{translate:'6px -2px',filter:'brightness(1.1)',offset:.4},{translate:'-2px 0',filter:'brightness(1)',offset:.7},{translate:'0 0',filter:'brightness(1)'}],{duration:330,easing:'ease-out'});
      }
      const numbers=[...document.querySelectorAll('.combat-damage,.combat-death-badge')].filter(n=>n.dataset.damageTarget===hit.target);
      for(const number of numbers){
        current.numbers.push({node:number,text:number.textContent,top:number.style.top,left:number.style.left});
        number.classList.add('is-heavy-number');number.textContent=`重击 · ${number.textContent}`;
        if(number.classList.contains('combat-damage')){
          number.style.top=`${Math.max(56,parseFloat(number.style.top)||56)}px`;
          const half=number.getBoundingClientRect().width*.65+8;
          number.style.left=`${Math.max(half,Math.min(document.documentElement.clientWidth-half,parseFloat(number.style.left)||half))}px`;
        }
        animate(number,[{scale:'.72'},{scale:'1.25',offset:.22},{scale:'1'}],{duration:420,easing:'ease-out'});
      }
      // A restrained perimeter pulse accompanies the local hit; this is not a
      // scene/camera shake and does not transform any interactive container.
      animate(layer,[{opacity:.25},{opacity:1,offset:.15},{opacity:0}],{duration:520,easing:'ease-out',fill:'forwards'});
      later(clear,520);
    };
    if(delay>0)later(impact,delay);else impact();
  }
  reduced.addEventListener?.('change',clear);
  return {show,clear};
}

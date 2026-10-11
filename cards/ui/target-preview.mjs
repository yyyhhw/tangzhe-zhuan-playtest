import {legalActions,apply,CARDS,effectiveSpellDamage} from '../cardcore.mjs?v=card-shield-10';
// Read-only view of legal choices. Area effects are resolved by the existing
// engine on its copied state, not inferred from the spell's allegiance text.
export function targetPreview(game,selection,enabled=true){
  const legal=enabled&&selection?legalActions(game).filter(a=>a.player===0&&a.type===selection.type&&(selection.type==='power'||a.source===selection.source)):[];
  const selectable=new Set(legal.map(a=>a.target).filter(Boolean)),affected=new Set(),labels=new Map();
  const card=selection?.type==='play'?CARDS[game.players[0].hand.find(c=>c.uid===selection.source)?.cardId]:null;
  for(const uid of selectable){let label='目标';if(selection.type==='attack'){const source=[game.players[0].hero,...game.players[0].board].find(e=>e.uid===selection.source);label='伤−'+(source.atk??source.attack);}else if(selection.type==='power')label='伤−'+game.config.powers.mageDamage;else if(card?.effect?.kind==='damage')label='伤−'+effectiveSpellDamage(game,0,card);else if(card?.effect?.kind==='heal')label='疗+'+card.effect.n;else if(card?.effect?.kind==='grantDivineShield')label='圣盾';labels.set(uid,label);}
  if(card?.effect?.kind==='areaDamage'){
    const action=legal.find(a=>!a.target);
    if(action){const result=apply(game,{...action,commandId:'ui-area-preview-'+game.revision,expectedRevision:game.revision});
      if(result.ok)for(const e of result.events)if(e.type==='shieldBreak'||e.type==='damage'&&e.amount>0||e.type==='heal'&&e.amount>0){affected.add(e.target);labels.set(e.target,e.type==='heal'?'疗+'+e.amount:'伤−'+(e.amount??e.prevented));}
    }
  }
  return {selectable,affected,labels};
}

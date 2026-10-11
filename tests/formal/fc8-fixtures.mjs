import * as core from '../../cards/cardcore.mjs';
export function fixture(hero='warrior',extra=[],{enemyTaunt=true}={}){
 function deck(kind,first){const eligible=Object.keys(core.CARD_METADATA).filter(id=>['neutral',kind].includes(core.CARD_METADATA[id].class));const out=[...new Set(first)];for(const id of eligible)for(let n=0;n<2&&out.length<30;n++)if(out.filter(x=>x===id).length<2)out.push(id);return out;}
 let game=core.createGame({heroes:[hero,'warrior'],decks:[deck(hero,['bkVanCs2171',...extra]),deck('warrior',['bkVanCs1042'])],config:{shuffle:false,handLimit:30,openingHands:[10,10]}}),serial=0;
 const step=a=>{if(!a)throw Error('missing fixture action');const r=core.apply(game,{...a,commandId:'fc8-fixture-'+serial++,expectedRevision:game.revision});if(!r.ok)throw Error(r.error.code);game=r.game;};
 const play=id=>step(core.legalActions(game).find(a=>a.type==='play'&&game.players[game.active].hand.find(h=>h.uid===a.source)?.cardId===id));
 play('bkVanCs2171');step(core.legalActions(game).find(a=>a.type==='end'));if(enemyTaunt)play('bkVanCs1042');while(game.turn<15)step(core.legalActions(game).find(a=>a.type==='end'));
 return {game,step,get current(){return game}};
}

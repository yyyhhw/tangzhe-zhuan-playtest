import {withoutZombieStartDelta} from './zombie-delta.mjs';
/** Exact candidate delta, NOT a general normalizer. Preserve old protection hashes.
 * Any missing/duplicated/edited candidate line fails; all other bytes remain pinned.
 * This is test accounting, not independent approval of the milestone feature.
 */
const TOKEN='yangcheng38-20261015-r1';
export function withoutMilestoneDelta(path,source){
 source=withoutZombieStartDelta(path,source);
 const replace=(from,to='')=>{if(source.split(from).length!==2)throw Error('MILESTONE_DELTA_NOT_EXACT: '+path);source=source.replace(from,to);};
 if(path==='qa-protocol2/vendor/runtime/validator.mjs'){
  replace(`import {validMilestones} from '../../../milestones/domain.mjs?v=${TOKEN}';\n`);
  replace("      if(!validMilestones(s))error('MILESTONES_INVALID');\n");
 }else if(path==='qa-protocol2/vendor/cards/card-coordinator.mjs'){
  replace(`import {recordTransition} from '../../../milestones/domain.mjs?v=${TOKEN}';\n`);
  replace('moonView,planMoon,researchSpend,MOON_RULES','moonView,planMoon,researchSpend');
  replace(`    const next=copy(state);
    // Generate only after every business/opaque guard; callers cannot edit the ledger.
    if(!initializing)next.milestones=recordTransition(previous.state,next,spaceClock(),MOON_RULES);
    next.rev=previous.state.rev+1;`,'    const next=copy(state);next.rev=previous.state.rev+1;');
 }
 return source;
}

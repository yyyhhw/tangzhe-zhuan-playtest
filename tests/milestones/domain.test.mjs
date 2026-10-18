import test from 'node:test';import assert from 'node:assert/strict';
import {EVENTS,evidence,validMilestones,recordTransition,newGameMilestones,recap} from '../../milestones/domain.mjs';
import {MOON_RULES} from '../../space/moon.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const fresh=()=>({created:1000,shops:[{open:true,lv:1,emp:0},...Array.from({length:3},()=>({open:false,lv:0,emp:0}))],ceos:{},gacha:{draws:0},milestones:newGameMilestones(1000)});
test('17 precise events, milliseconds, first wins and existing dates/null never overwritten',()=>{
 const before=fresh(),after=copy(before);after.shops[0].emp=1;
 const m=recordTransition(before,after,3601000,MOON_RULES);assert.equal(EVENTS.length,17);assert.deepEqual(m.events,{firstShop:1000,firstEmployee:3601000});
 after.milestones=m;const replay=recordTransition(after,after,99999999,MOON_RULES);assert.deepEqual(replay,m);
 after.milestones.events.firstBox=null;after.gacha.draws=1;assert.equal(recordTransition(after,after,99999999,MOON_RULES).events.firstBox,null);
 assert.deepEqual(before,fresh());
});
test('legacy migration derives only proven history, no dates from counters/lastSeen; repeat idempotent',()=>{
 const old=fresh();delete old.milestones;old.lastSeen=9999999;old.shops[1]={open:true,lv:10,emp:1};old.gacha.draws=3;
 const m=recordTransition(old,old,99999999,MOON_RULES);assert.deepEqual(m.events,{firstShop:null,firstEmployee:null,firstBox:null,teaShop:null});
 old.milestones=m;assert.deepEqual(recordTransition(old,old,999999999,MOON_RULES),m);assert(!('firstZombie' in m.events));
});
test('all business and space success predicates; Lv34/35 boundary uses current rule',()=>{
 const before=fresh(),after=copy(before);after.shops=Array.from({length:4},()=>({open:true,lv:35,emp:1}));after.ceos.rocket={unlocked:true};after.gacha.draws=1;after.zombie={cleared:1};after.tdCampaign={highestCleared:1};after.space={moonLoop:{sequence:1},cards:{moon:1},alienCards:1,hidden:{moon:true},items:{'tech:1':1},ended:true,earth:true};
 const m=recordTransition(before,after,2000,MOON_RULES,{zombieStarted:true});assert.equal(Object.keys(m.events).length,17);for(const [id]of EVENTS)assert.equal(m.events[id],id==='firstShop'?1000:2000,id);
 assert.equal(MOON_RULES.minShopLevel,35);after.shops[3].lv=34;assert.equal(evidence(after,MOON_RULES).shopsReady,false);
});
test('unstarted/abandoned battles and empty collections do not invent participation',()=>{
 const a=fresh(),b=copy(a);b.zombie={cleared:0,best:0};b.tdCampaign={highestCleared:0};b.space={cards:{},hidden:{moon:false},items:{},alienCards:0,visits:{},voyage:null};
 assert.deepEqual(recordTransition(a,b,2000,MOON_RULES),a.milestones);
});
test('optional schema rejects malformed/unknown extensions; clock reversal never fabricates a date',()=>{
 assert(validMilestones({}));for(const m of [null,[],{}, {schemaVersion:2,events:{}},{schemaVersion:1,events:{unknown:123}},{schemaVersion:1,events:{firstBox:-1}},{schemaVersion:1,events:{firstBox:NaN}},{schemaVersion:1,events:{firstBox:8640000000000001}}])assert(!validMilestones({milestones:m}));
 const a=fresh(),b=copy(a);b.gacha.draws=1;assert.equal(recordTransition(a,b,0,MOON_RULES).events.firstBox,null);
});
test('recap unknown history grey label; elapsed day/hour and earliest-record total, missing Earth date never uses now',()=>{
 const s=fresh();s.milestones.events={firstShop:null,firstBox:3601000,firstEmployee:86401000,earth:90001000};s.space={earth:true};
 const r=recap(s,MOON_RULES);assert.equal(r.rows[0].when,'记录开始之前');assert.equal(r.rows.find(x=>x.id==='firstBox').when,'开局 1 小时');assert.equal(r.rows.find(x=>x.id==='firstEmployee').when,'开局第 2 天');assert.equal(r.duration,86400000);assert.match(r.total,/从有记录起，你用了 1 天，/);assert.doesNotMatch(r.total,/0 小时/);
 s.milestones.events.earth=null;assert.equal(recap(s,MOON_RULES).duration,null);assert.match(recap(s,MOON_RULES).total,/没记时间/);assert(!r.rows.some(x=>x.id==='firstZombie'));
});
test('体验-158：总用时不到 1 天不写「0 天」，不到 1 小时写「不到 1 小时」',()=>{
 const at=ms=>{const s=fresh();s.milestones.events={firstBox:3601000,earth:3601000+ms};s.space={earth:true};return recap(s,MOON_RULES).total;};
 assert.equal(at(5*3600000+59000),'从有记录起，你用了 5 小时，买下了整个地球。');
 assert.equal(at(59*60000),'从有记录起，你用了不到 1 小时，买下了整个地球。');
 assert.equal(at(2*86400000+3*3600000),'从有记录起，你用了 2 天 3 小时，买下了整个地球。');
 assert(!/\b0 天/.test(at(5*3600000)));
});

test('confirmed battle participation records before victory; legacy loss proves participation without a date',()=>{
 const a=fresh(),b=copy(a);const m=recordTransition(a,b,2000,MOON_RULES,{zombieStarted:true});assert.equal(m.events.firstZombie,2000);assert(!m.events.firstTDWin);
 b.milestones=m;b.zombie={cleared:0,best:10};assert.equal(recordTransition(b,b,4000,MOON_RULES).events.firstZombie,2000);
 const old=fresh();old.zombie={cleared:0,best:10};assert.equal(recordTransition(old,old,4000,MOON_RULES).events.firstZombie,null);
});

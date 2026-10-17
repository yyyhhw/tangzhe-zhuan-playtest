import test from 'node:test';import assert from 'node:assert/strict';
import {normalRoomReady,roomRequestCount,isResourceNoise} from './home-evidence.mjs';
test('normal-room prerequisite rejects timeout, missing art, wrong room and altered window table',()=>{
 const good={timedOut:false,loaded:{width:1600,src:'art/home_c77_3.webp?v=12b2',nWins:2}};
 assert.equal(normalRoomReady(good,'c77',3),true);
 for(const bad of [{...good,timedOut:true},{timedOut:true,loaded:null},{...good,loaded:{...good.loaded,width:0}},{...good,loaded:{...good.loaded,nWins:0}},{...good,loaded:{...good.loaded,src:'art/home_pearl_3.webp'}}])assert.equal(!!normalRoomReady(bad,'c77',3),false);
 assert.equal(normalRoomReady({timedOut:false,loaded:{width:2000,src:'art/home_rocket_3.webp',nWins:0}},'rocket',3),true);
});
test('late preceding-room failure and pre-switch current-room request cannot satisfy this room',()=>{
 const events=['http://localhost/art/home_pearl_3.webp?v=old'];const from=events.length;
 events.push('http://localhost/art/home_c77_3.webp?v=late');
 assert.equal(roomRequestCount(events,from,'pearl',3),0);
 events.push('http://localhost/art/home_pearl_3.webp?v=current');
 assert.equal(roomRequestCount(events,from,'pearl',3),1);
 assert.equal(roomRequestCount(events,events.length,'pearl',3),0);
});
test('business cancellation and error wording is never filtered',()=>{
 for(const msg of ['save aborted','cancelled transaction','Load request cancelled','net:: business failure','favicon state corrupt','status of 500 business failure'])assert.equal(isResourceNoise(msg),false,msg);
 assert.equal(isResourceNoise('Failed to load resource: Load request cancelled'),true);
 assert.equal(isResourceNoise('Failed to load resource: net::ERR_FAILED'),true);
});

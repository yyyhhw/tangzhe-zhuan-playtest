// Original procedural effects for this project; no recordings or external assets.
// One short cue per event category, not per target, bounds mass-damage loudness.
export function combatCues(events, {spell=false, impactDelay=0}={}) {
  const has=type=>events.some(e=>e.type===type), cues=[];
  if(has('attack'))cues.push({kind:'attack',at:0});
  if(spell||has('power'))cues.push({kind:'spell',at:0});
  if(events.some(e=>e.type==='damage'&&e.amount>0))cues.push({kind:'hit',at:impactDelay});
  if(has('shieldBreak'))cues.push({kind:'shield',at:impactDelay});
  if(has('death'))cues.push({kind:'death',at:impactDelay+.1});
  return cues;
}
export function createCombatAudio({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext}={}) {
  let ctx=null,master=null,muted=true,paused=true,hidden=false,dead=false,error=null;
  const voices=new Set(), counts={};
  const allowed=()=>!dead&&!muted&&!paused&&!hidden;
  function stop(){
    if(master)master.gain.value=0;
    for(const v of voices){try{v.o.stop();}catch{}v.o.disconnect();v.g.disconnect();}
    voices.clear();
  }
  // No deferred sound queue: a late resume never replays an old combat event.
  function unlock(){
    if(!allowed()||!AudioContext)return;
    try{
      if(!ctx){ctx=new AudioContext();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);}
      if(ctx.state!=='running')void ctx.resume().catch(e=>{error=String(e)});
    }catch(e){error=String(e);}
  }
  function tone(type,f0,f1,at,duration,volume){
    const o=ctx.createOscillator(),g=ctx.createGain(),v={o,g},t=ctx.currentTime+at;
    o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+duration);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(g);g.connect(master);voices.add(v);
    o.onended=()=>{voices.delete(v);o.disconnect();g.disconnect();};
    o.start(t);o.stop(t+duration+.015);
  }
  return {
    unlock,
    resumeExisting(){if(allowed()&&ctx&&ctx.state!=='running')void ctx.resume().catch(e=>{error=String(e)});},
    update(s){({muted,paused,hidden}={muted,paused,hidden,...s});if(!allowed())stop();},
    play(events,options){
      if(!allowed()||ctx?.state!=='running')return false;
      const cues=combatCues(events,options);if(!cues.length)return false;
      // Replace previous tails; repeated inputs cannot accumulate voices.
      stop();master.gain.value=.65;
      try{for(const {kind,at} of cues){
        if(kind==='attack')tone('triangle',430,90,at,.13,.17);
        if(kind==='spell'){tone('sine',620,1240,at,.18,.12);tone('triangle',930,1860,at+.04,.2,.08);}
        if(kind==='hit'){tone('triangle',170,45,at,.16,.27);tone('square',95,40,at,.07,.06);}
        if(kind==='shield')tone('sine',1800,500,at,.2,.15);
        if(kind==='death')tone('triangle',220,38,at,.3,.18);
        counts[kind]=(counts[kind]||0)+1;
      }return true;}catch(e){error=String(e);stop();return false;}
    },
    dispose(){dead=true;stop();void ctx?.close().catch(()=>{});},
    get status(){return {state:ctx?.state||'locked',muted,paused,hidden,dead,voices:voices.size,counts:{...counts},error};},
  };
}

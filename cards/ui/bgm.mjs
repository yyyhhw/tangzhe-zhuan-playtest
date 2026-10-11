// Decoder priming/padding differs across engines. Build the loop from the actual
// decoded PCM; never infer an offset from the UA, encoded duration or frame count.
export const CARD_BGM_CROSSFADE_SECONDS = 0.1;
export function prepareCardBgmLoop(context, decoded) {
  const n=decoded.length,rate=decoded.sampleRate,channels=decoded.numberOfChannels;
  if(!Number.isInteger(n)||n<4||!Number.isFinite(rate)||rate<=0||!Number.isInteger(channels)||channels<1||channels>32)throw Error('BGM_INVALID_PCM');
  const overlap=Math.min(Math.floor(n/2),Math.max(2,Math.round(rate*CARD_BGM_CROSSFADE_SECONDS)));
  const output=context.createBuffer(channels,n-overlap,rate),join=n-2*overlap;
  for(let ch=0;ch<channels;ch++) {
    const input=decoded.getChannelData(ch),dest=output.getChannelData(ch);
    dest.set(input.subarray(overlap,n-overlap));
    for(let i=0;i<overlap;i++) {
      const t=i/(overlap-1);
      dest[join+i]=input[n-overlap+i]*(1-t)+input[i]*t;
    }
  }
  // First blend sample follows the untouched body; the last blend sample is
  // input[overlap-1], naturally followed by input[overlap] on the next loop.
  return output;
}
// One context/source per card iframe. Failed loads retry only after a user gesture
// and bounded backoff; render/update never grants another network attempt.
export function createCardBgm({url,AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,fetch=globalThis.fetch,now=()=>performance.now(),retryDelayMs=1000}) {
  let ctx=null,source=null,gain=null,buffer=null,loading=null,unlocked=false,dead=false;
  let muted=true,paused=true,hidden=false,error=null,created=0,decodedFrames=0;
  let loadPermitted=true,failures=0,retryAt=0,attempts=0;
  const allowed=()=>unlocked&&!dead&&!muted&&!paused&&!hidden;
  function load() {
    if(loading)return loading;
    if(buffer)return Promise.resolve(buffer);
    if(!loadPermitted)return null;
    loadPermitted=false;attempts++;
    loading=Promise.resolve().then(()=>fetch(url)).then(r=>{if(!r.ok)throw Error('BGM_FETCH');return r.arrayBuffer();})
      .then(b=>ctx.decodeAudioData(b)).then(b=>{decodedFrames=b.length;buffer=prepareCardBgmLoop(ctx,b);error=null;failures=0;retryAt=0;return buffer;})
      .catch(e=>{error=String(e);failures++;retryAt=now()+Math.min(30000,retryDelayMs*2**Math.min(failures-1,5));throw e;})
      .finally(()=>{loading=null;});
    return loading;
  }
  // Mute the graph synchronously, before any pending native resume can finish.
  // A single worker orders resume/suspend; every awaited transition rechecks intent.
  let working=false,dirty=false;
  function silence(){if(gain)gain.gain.value=0;}
  function sync(){
    if(!allowed())silence();
    dirty=true;
    if(!ctx||dead||working)return;
    void drain();
  }
  async function drain(){
    working=true;
    try {
      while(dirty&&!dead){
        dirty=false;
        if(!allowed()){
          silence();
          if(ctx.state==='running')await ctx.suspend();
          continue;
        }
        // Called directly from the trusted unlock gesture when possible. No
        // resume is issued by a muted/paused/hidden click.
        if(ctx.state!=='running')await ctx.resume();
        if(!allowed()){silence();dirty=true;continue;}
        if(!buffer){const pending=load();if(!pending)continue;await pending;}
        if(!allowed()){silence();dirty=true;continue;}
        if(!source){
          gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
          source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;
          source.loopStart=0;source.loopEnd=buffer.duration;
          source.connect(gain);source.start();created++;
        }
        gain.gain.value=0.22;
      }
    }catch(e){silence();if(!dead)error=String(e);}
    finally{working=false;if(dirty&&!dead)sync();}
  }
  function unlock(){
    if(dead)return;
    if(!unlocked){unlocked=true;if(AudioContext)ctx=new AudioContext();}
    // The app calls unlock only from a trusted pointer/key gesture. A click while
    // paused may arm one attempt for the following resume, never for each frame.
    if(error&&!loading&&now()>=retryAt)loadPermitted=true;
    sync();
  }
  return {unlock,update(s){({muted,paused,hidden}={muted,paused,hidden,...s});sync();},dispose(){dead=true;silence();source?.stop();void ctx?.close().catch(()=>{});},get status(){return {unlocked,muted,paused,hidden,created,state:ctx?.state||'locked',decoded:!!buffer,duration:buffer?.duration||0,decodedFrames,loopFrames:buffer?.length||0,sampleRate:buffer?.sampleRate||0,loopStart:source?.loopStart||0,loopEnd:source?.loopEnd||0,error,attempts,retryAt,loading:!!loading};}};
}

// Recorded music shares its mode's existing context and output bus. No second
// context, oscillator soundtrack, or background resume is created here.
(function(){
  'use strict';
  function prepare(context,input){
    const n=input.length,k=Math.min(Math.floor(n/2),Math.max(2,Math.round(input.sampleRate*.1)));
    if(n<4)throw Error('MUSIC_INVALID_PCM');
    const out=context.createBuffer(input.numberOfChannels,n-k,input.sampleRate);
    for(let ch=0;ch<input.numberOfChannels;ch++){const a=input.getChannelData(ch),b=out.getChannelData(ch);b.set(a.subarray(k,n-k));for(let i=0;i<k;i++){const t=i/(k-1);b[n-2*k+i]=a[n-k+i]*(1-t)+a[i]*t;}}
    return out;
  }
  function create({context,output,url,isAllowed=()=>true}){
    const gain=context.createGain();gain.gain.value=0;gain.connect(output);
    let wanted=false,dead=false,source=null,buffer=null,loading=null,error=null,retryAt=0,attempts=0,created=0;
    const allowed=()=>wanted&&!dead&&!document.hidden&&isAllowed();
    function sync(){
      if(!allowed()){gain.gain.value=0;return;}
      if(!buffer)return;
      if(!source){source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;source.connect(gain);source.start();created++;}
      gain.gain.value=1;
    }
    function load(){
      if(buffer||loading||dead||!allowed()||performance.now()<retryAt){sync();return;}
      attempts++;
      loading=fetch(url).then(r=>{if(!r.ok)throw Error('MUSIC_HTTP_'+r.status);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>{buffer=prepare(context,b);error=null;sync();}).catch(e=>{error=String(e);gain.gain.value=0;retryAt=performance.now()+1000;}).finally(()=>{loading=null;});
    }
    const api={start(){wanted=true;load();},stop(){wanted=false;gain.gain.value=0;},retry(){if(error)load();},dispose(){dead=true;wanted=false;gain.gain.value=0;source?.stop();source?.disconnect();gain.disconnect();},get status(){return {url:String(url),wanted,dead,created,attempts,loading:!!loading,error,decoded:!!buffer,duration:buffer?.duration||0,gain:gain.gain.value};}};
    addEventListener('pagehide',()=>api.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)gain.gain.value=0;});
    return api;
  }
  window.TzzLoopMusic={create,prepare};
})();

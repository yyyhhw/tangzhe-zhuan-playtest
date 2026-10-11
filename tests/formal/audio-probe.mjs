export function instrument(){
 const Native=window.AudioContext||window.webkitAudioContext;window.__audio=[];
 function Audio(...args){const c=new Native(...args),a=c.createAnalyser(),entry={c,a,starts:0};a.fftSize=2048;window.__audio.push(entry);
 const connect=AudioNode.prototype.connect;if(!window.__audioConnect){window.__audioConnect=connect;AudioNode.prototype.connect=function(dest,...rest){const out=connect.call(this,dest,...rest);if(dest===this.context.destination){const e=window.__audio.find(e=>e.c===this.context);if(e)connect.call(this,e.a);}return out;};}
 const oscillator=c.createOscillator.bind(c);c.createOscillator=()=>{const o=oscillator(),start=o.start.bind(o);o.start=(...args)=>{start(...args);entry.starts++;};return o;};return c;}
 Audio.prototype=Native.prototype;window.AudioContext=Audio;
 window.__measure=()=>window.__audio.map(e=>{const d=new Float32Array(e.a.fftSize);e.a.getFloatTimeDomainData(d);return {state:e.c.state,starts:e.starts,rms:Math.sqrt(d.reduce((n,x)=>n+x*x,0)/d.length)};});
}

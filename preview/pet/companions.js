/* Distinct companion behaviors. Shares only geometry/pathfinding with the dog engine.
   Each species keeps its own versioned pet payload and atlas; no dog-art fallback. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'),require('./art.js'));
  else root.PetCompanions=factory(root.PetEngine,root.PetArt);
})(typeof self!=='undefined'?self:this,function(Geo,Art){
  'use strict';
  const CONFIG=Object.freeze({
    cat:{speed:1.25,toy:'teaser',toyLabel:'🪶 逗猫',play:'扑逗猫玩具',groom:'舔爪理毛',rest:'蜷着睡觉',pet:'眯眼蹭手',recover:1.5},
    red_panda:{speed:0.95,toy:'wood_ball',toyLabel:'🪵 玩木球',play:'抱着木球翻玩',groom:'抱叶啃食',rest:'抱尾休息',pet:'靠过来挠下巴',recover:1.35},
    robot:{speed:0.9,toy:'beacon',toyLabel:'📡 信标',play:'追踪扫描信标',groom:'转头自检',rest:'低功耗充电',pet:'亮起回应灯',recover:2},
    panda_cub:{speed:0.65,toy:'bamboo',toyLabel:'🎋 竹玩具',play:'坐着拨弄竹玩具',groom:'抱竹啃食',rest:'趴着打盹',pet:'靠过来蹭蹭',recover:1.6},
    alpaca:{speed:1.05,toy:'ribbon',toyLabel:'🎀 追彩带',play:'小跑追彩带',groom:'嚼嚼青草',rest:'收腿伏卧',pet:'低头接受抚摸',recover:1.25},
    rabbit:{speed:1.5,toy:'willow',toyLabel:'🌿 柳编球',play:'跳着拨弄柳编球',groom:'竖耳洗脸',rest:'团起身休息',pet:'伏耳接受抚摸',recover:1.4}
  });
  const HABITS={cat:{groom:.6,rest:6,range:2},red_panda:{groom:.55,rest:5,range:2.5},robot:{groom:.25,rest:4,range:4},panda_cub:{groom:.8,rest:9,range:1},alpaca:{groom:.4,rest:6,range:3},rabbit:{groom:.3,rest:3,range:1.2}};
  const CAT_FURNITURE=new Set(['furn_catbed','furn_pearl_tea_cat_hammock','furn_rocket_landing_cat_pod']);
  const finite=Number.isFinite, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function sanitizeSave(s,species){
    if(!s||typeof s!=='object'||s.schema!=='tangzhe-companion-save/1'||s.v!==1||!CONFIG[s.species]||(species&&s.species!==species)||!s.pet||typeof s.pet!=='object'||('v' in s.pet))return null;
    const p=s.pet, n=(v,f)=>finite(v)?v:f;
    const pet={...p,x:n(p.x,null),y:n(p.y,null),dir:['E','W','N','S'].includes(p.dir)?p.dir:'S',energy:clamp(n(p.energy,70),0,100),affinity:clamp(Math.floor(n(p.affinity,40)),40,100),lastGain:n(p.lastGain,-1e9)};
    return {...s,t:Math.max(0,n(s.t,0)),savedAt:n(s.savedAt,null),pet,dog:pet}; // dog alias is internal geometry compatibility only
  }
  function clip(w,base,dir){
    const m=w.manifest,d=w.dog, side=dir||d.dir, real=side==='W'?'E':side;
    let name=m.clips[base+'_'+real]?base+'_'+real:base;
    if(!m.clips[name])name='idle_'+real;
    const c=m.clips[name];
    if(c.inPlace){
      const prefer=c.dir||'E',face=Geo.bodyFree(w,d.x,d.y,prefer)?prefer:prefer==='E'&&Geo.bodyFree(w,d.x,d.y,'W')?'W':null;
      if(!face)name='idle_'+(d.dir==='N'?'N':'S');else d.dir=face;
    }
    if(d.anim.name!==name||d.anim.done)d.anim.play(name);
    return name;
  }
  function createWorld(o){
    const w=Geo.createWorld(o);w.species=o.manifest.species;w.profile=CONFIG[w.species];
    if(!w.profile)throw Error('Unknown companion species');
    w.pet=w.dog;w.toy=null;w.intent=null;w.until=2;w.nextChoice=2;
    w.dog.label='正在熟悉新家';w.dog.activity='idle';return w;
  }
  function begin(w,kind,duration,label){w.intent=null;w.dog.activity=kind;w.dog.label=label;w.until=w.t+duration;clip(w,kind);}
  function route(w,target,kind,label){
    const path=Geo.planPath(w,w.dog,target,1.5);if(!path)return false;
    if(!['E','N','S'].every(d=>w.manifest.clips['walk_'+d]))return false;
    w.intent={path,kind,label};w.dog.label=label;w.dog.activity='walk';return true;
  }
  function gain(w){const d=w.dog;if(w.t-d.lastGain>=3){d.affinity=Math.min(100,d.affinity+1);d.lastGain=w.t;}}
  function call(w){if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    const ok=route(w,{x:w.front.x,y:w.front.y-.65},'attention','听到呼唤，向你走来');if(!ok){begin(w,'attention',1.2,'听到呼唤，原地看向你');return {ok:true,inPlace:true};}return {ok};}
  function pet(w){if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    begin(w,'petted',1.6,w.profile.pet);gain(w);w.fx.push({type:'heart',t:w.t});return {ok:true};}
  function throwBall(w,target){ // compatibility method; distinct species toy, never canine fetch
    if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    const at=Geo.safeSpot(w,target||{x:w.front.x+.6,y:w.front.y-1.2},2);if(!at)return {ok:false};
    if(!route(w,at,'play',w.profile.play)){begin(w,'play',3,w.profile.play);gain(w);at.x=w.dog.x+.2;at.y=w.dog.y;}
    w.toy={kind:w.profile.toy,x:at.x,y:at.y,until:w.t+12};return {ok:true};
  }
  function rand(w){w.rs=(Math.imul(w.rs,1664525)+1013904223)>>>0;return w.rs/4294967296;}
  function update(w,dt){
    if(w.paused||w.noRoom)return;dt=clamp(finite(dt)?dt:0,0,.1);w.t+=dt;
    const d=w.dog;d.z=0;w.fx=w.fx.filter(f=>w.t-f.t<1.4);if(w.toy&&w.t>w.toy.until)w.toy=null;
    if(w.intent){
      const q=w.intent.path[0];if(!q){const i=w.intent;begin(w,i.kind,i.kind==='play'?3:i.kind==='rest'?HABITS[w.species].rest:1.2,i.label);if(i.kind==='play')gain(w);}
      else {const dx=q.x-d.x,dy=q.y-d.y,dist=Math.hypot(dx,dy);
        const dir=Math.abs(dx)>Math.abs(dy)?dx>0?'E':'W':dy>0?'S':'N',moveClip=w.intent.kind==='play'&&w.manifest.clips['run_'+(dir==='W'?'E':dir)]?'run':'walk';
        const step=Math.min(dist,(w.manifest.runtime.walkSpeed||w.profile.speed)*(moveClip==='run'?(w.manifest.runtime.runMultiplier||1.45):1)*dt),x=dist?d.x+dx/dist*step:d.x,y=dist?d.y+dy/dist*step:d.y;
        if(!Geo.segOK(w,d,{x,y})||!Geo.bodyFree(w,x,y,dir)){begin(w,'attention',1,'前面有家具，换条路');}
        else {d.x=x;d.y=y;d.dir=dir;clip(w,moveClip,dir);d.energy=clamp(d.energy-dt*.25,0,100);if(dist<.02||step>=dist)w.intent.path.shift();}
      }
    } else if(w.t>=w.until){
      if(d.energy<25){begin(w,'rest',10,w.profile.rest);}
      else if(w.species==='cat'&&w.items.some(p=>CAT_FURNITURE.has(p.fid))&&rand(w)<.5){
        const item=w.items.find(p=>CAT_FURNITURE.has(p.fid)),at=Geo.safeSpot(w,{x:item.x-.65,y:item.y+1.2},2);
        if(!at||!route(w,at,'rest','走到猫窝旁蜷卧'))begin(w,'rest',6,w.profile.rest);
      }
      else if(rand(w)<HABITS[w.species].groom){begin(w,'groom',3,w.profile.groom);}
      else {const h=HABITS[w.species],q=Geo.safeSpot(w,{x:clamp(d.x+(rand(w)-.5)*2*h.range,.5,w.cols-.5),y:clamp(d.y+(rand(w)-.5)*2*h.range,.5,w.rows-.5)},2);
        if(!q||!route(w,q,'attention','在屋里探索'))begin(w,'rest',HABITS[w.species].rest,w.profile.rest);}
    }
    if(d.activity==='rest'){d.energy=clamp(d.energy+w.profile.recover*dt,0,100);clip(w,'rest');}
    d.anim.tick(dt);
  }
  function step(w,seconds){let left=clamp(seconds,0,3600);while(left>1e-6){const dt=Math.min(left,1/60);update(w,dt);left-=dt;}return w;}
  function serialize(w,stamp){const d=w.dog;return {schema:'tangzhe-companion-save/1',v:1,species:w.species,savedAt:stamp,t:w.t,rs:w.rs,pet:{x:d.x,y:d.y,dir:d.dir,energy:d.energy,affinity:d.affinity,lastGain:d.lastGain},toy:w.toy?{...w.toy}:null};}
  function restore(w,raw,stamp){const s=sanitizeSave(raw,w.species);if(!s)return {ok:false};
    const p=raw.dog||s.pet;const at=Geo.safeSpot(w,p,3);w.noRoom=!at;if(at)Object.assign(w.dog,at);
    const elapsed=s.savedAt===null?0:clamp((stamp-s.savedAt)/1000,0,86400*30);
    Object.assign(w.dog,{energy:clamp(s.pet.energy+elapsed*w.profile.recover,0,100),affinity:s.pet.affinity,lastGain:s.pet.lastGain,dir:s.pet.dir});
    w.t=s.t+elapsed;w.rs=finite(s.rs)?s.rs>>>0:w.rs;w.intent=null;w.toy=null;w.until=w.t+2;clip(w,'idle',w.dog.dir);return {ok:true,elapsed};}
  function setLayout(w,L){Geo.setLayout(w,L);const p=Geo.safeSpot(w,w.dog,3);w.noRoom=!p;if(p)Object.assign(w.dog,p);w.intent=null;}
  function setRearrange(w,on){w.paused=!!on;if(on){w.intent=null;clip(w,'idle');}}
  function snapshot(w){return {species:w.species,t:w.t,noRoom:w.noRoom,pet:{x:w.dog.x,y:w.dog.y,activity:w.dog.activity,label:w.dog.label,energy:w.dog.energy,affinity:w.dog.affinity,clip:w.dog.anim.name},toy:w.toy};}
  function createView(opt){
    const M=opt.manifest;let els=null,atlas=opt.image||null;
    function detach(){if(els){els.dog.remove();els.toy.remove();els=null;}}
    function ensure(floor){if(els&&els.floor===floor&&els.dog.parentNode===floor)return els;detach();
      const dog=document.createElement('div'),cv=document.createElement('canvas'),toy=document.createElement('div');
      dog.className='pet-dog pet-sprite';dog.dataset.uid=opt.uid;dog.dataset.species=M.species;dog.setAttribute('aria-label',opt.name||M.species);dog.appendChild(cv);
      toy.className='pet-ball';toy.dataset.uid=opt.uid;floor.appendChild(toy);floor.appendChild(dog);els={floor,dog,cv,ctx:cv.getContext('2d'),toy};return els;}
    function draw(w,floor){if(!w||!floor||w.noRoom||!atlas){detach();return;}const e=ensure(floor),tile=floor.getBoundingClientRect().width/w.cols;if(tile<1)return;
      const d=w.dog,size=M.runtime.displayTiles*tile,dpr=Math.min(window.devicePixelRatio||1,3),rectMode=M.atlas.mode==='sourceRect';
      const bounds=M.renderBounds||{left:-128,right:128,top:-208,bottom:48},k=size/256,width=(bounds.right-bounds.left)*k,height=(bounds.bottom-bounds.top)*k;
      e.cv.width=Math.ceil(width*dpr);e.cv.height=Math.ceil(height*dpr);e.cv.style.width=width+'px';e.cv.style.height=height+'px';
      e.dog.style.cssText=`left:${d.x/w.cols*100}%;top:${d.y/w.rows*100}%;width:${width}px;height:${height}px;z-index:${10+Math.floor(d.y*10)};transform:translate(${bounds.left*k}px,${bounds.top*k}px)`;
      const ctx=e.ctx,frame=M.clips[d.anim.name].frames[d.anim.frame()];
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(-bounds.left*k,-bounds.top*k);
      if(M.shadow.procedural){ctx.fillStyle='rgba(55,35,23,.18)';ctx.beginPath();ctx.ellipse(0,0,size*.18,size*.04,0,0,Math.PI*2);ctx.fill();}
      else {const cell=M.runtime.cellSize,id=M.shadow.cell;ctx.drawImage(atlas,id%M.atlas.cols*cell,Math.floor(id/M.atlas.cols)*cell,cell,cell,-size/2,-208*k,size,size);}
      ctx.save();if(d.dir==='W')ctx.scale(-1,1);
      if(rectMode){const r=frame.sourceRect,a=frame.anchor,extra=frame.imageKey&&M.atlases[frame.imageKey],source=extra?atlas.companionAtlases[frame.imageKey]:atlas,scale=k*(extra?extra.sourceScale:M.runtime.sourceScale);ctx.drawImage(source,...r,-a[0]*scale,-a[1]*scale,r[2]*scale,r[3]*scale);}
      else {const cell=M.runtime.cellSize,id=frame.cell;ctx.drawImage(atlas,id%M.atlas.cols*cell,Math.floor(id/M.atlas.cols)*cell,cell,cell,-size/2,-208*k,size,size);}
      ctx.restore();
      if(w.toy){e.toy.style.cssText=`left:${w.toy.x/w.cols*100}%;top:${w.toy.y/w.rows*100}%;width:22px;height:22px;background:none;border:0;z-index:${10+Math.floor(w.toy.y*10)}`;e.toy.textContent={teaser:'🪶',wood_ball:'🪵',beacon:'📡',bamboo:'🎋',ribbon:'🎀',willow:'🌿'}[w.toy.kind];}else e.toy.style.display='none';
    }
    function hit(w,floor,x,y){return !!(w&&floor&&!w.noRoom&&els&&Art.canvasHit(els.cv,x,y));}
    return {draw,hit,detach,get els(){return els;},get artMode(){return atlas?'atlas':'unavailable';}};
  }
  return {CONFIG,HABITS,CAT_FURNITURE,createWorld,update,step,call,pet,throwBall,serialize,sanitizeSave,restore,setLayout,setRearrange,snapshot,createView};
});

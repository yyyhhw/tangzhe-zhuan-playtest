/* Distinct companion behaviors. Shares only geometry/pathfinding with the dog engine.
   Each species keeps its own versioned pet payload and atlas; no dog-art fallback. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'),require('./art.js'));
  else root.PetCompanions=factory(root.PetEngine,root.PetArt);
})(typeof self!=='undefined'?self:this,function(Geo,Art){
  'use strict';
  const CONFIG=Object.freeze({
    cat:{speed:1.25,toy:'teaser',toyLabel:'🪶 追羽毛',play:'扑逗猫玩具',groom:'舔爪理毛',rest:'蜷着睡觉',pet:'眯眼蹭手',recover:1.5},
    red_panda:{speed:0.95,toy:'wood_ball',toyLabel:'🪵 推木球',play:'抱着木球翻玩',groom:'抱叶啃食',rest:'抱尾休息',pet:'靠过来挠下巴',recover:1.35},
    robot:{speed:0.9,toy:'beacon',toyLabel:'📡 巡查',play:'追踪扫描信标',groom:'转头自检',rest:'低功耗充电',pet:'亮起回应灯',recover:2},
    panda_cub:{speed:0.65,toy:'bamboo',toyLabel:'🎋 找竹叶',play:'坐着拨弄竹玩具',groom:'抱竹啃食',rest:'趴着打盹',pet:'靠过来蹭蹭',recover:1.6},
    alpaca:{speed:1.05,toy:'ribbon',toyLabel:'💦 跑跑吐水',play:'小跑追彩带',groom:'嚼嚼青草',rest:'收腿伏卧',pet:'低头接受抚摸',recover:1.25},
    rabbit:{speed:1.5,toy:'willow',toyLabel:'🌿 跳跳球',play:'跳着拨弄柳编球',groom:'竖耳洗脸',rest:'团起身休息',pet:'伏耳接受抚摸',recover:1.4}
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
    w.game=null;w.spatialFx=[];w.spatialStats={started:0,completed:0,cancelled:0,legs:0,waterBursts:0,scans:0};
    w.dog.label='正在熟悉新家';w.dog.activity='idle';return w;
  }
  function begin(w,kind,duration,label){w.intent=null;w.dog.activity=kind;w.dog.label=label;w.until=w.t+duration;clip(w,kind);}
  function route(w,target,kind,label){
    const path=Geo.planPath(w,w.dog,target,1.5);if(!path)return false;
    if(!['E','N','S'].every(d=>w.manifest.clips['walk_'+d]))return false;
    w.intent={path,kind,label};w.dog.label=label;w.dog.activity='walk';return true;
  }
  function gain(w){const d=w.dog;if(w.t-d.lastGain>=3){d.affinity=Math.min(100,d.affinity+1);d.lastGain=w.t;}}
  const GAMES=Object.freeze({
    cat:{legs:3,speed:1.65,hold:.25,action:'play',label:'追着羽毛窜过去',finish:'跑回来了，等你再逗它'},
    red_panda:{legs:2,speed:1.05,hold:1.15,action:'play',label:'把木球推到下一处',finish:'木球玩够了，回来挨着你'},
    robot:{legs:3,speed:1.3,hold:.85,action:'play',label:'前往下一个信标',finish:'巡查完成，返回待机位'},
    panda_cub:{legs:2,speed:1.05,hold:1.25,action:'groom',label:'慢慢走去找竹叶',finish:'吃好竹叶，慢慢回来了'},
    alpaca:{legs:2,speed:1.5,hold:.15,action:'attention',label:'边跑边吐水花',finish:'跑了一圈，回来了'},
    rabbit:{legs:2,speed:1.25,hold:.65,action:'play',label:'跳过去拨柳编球',finish:'换个方向，跳回来了'}
  });
  const point=d=>({x:d.x,y:d.y});
  function clearGame(w){w.game=null;w.intent=null;w.toy=null;w.spatialFx=[];w.calling=false;w.dog.z=0;}
  function finishGame(w,cancelled,label){
    const game=w.game;if(!game)return;
    const distance=Math.hypot(w.dog.x-game.origin.x,w.dog.y-game.origin.y);
    w.spatialStats[cancelled?'cancelled':'completed']++;w.spatialStats.returnDistance=distance;
    clearGame(w);begin(w,'attention',2,label||GAMES[w.species].finish);w.captionUntil=w.t+2;
    if(!cancelled)gain(w);
  }
  function returnHome(w,cancelled,label){
    const g=w.game;if(!g)return false;g.cancelled=!!cancelled;g.phase='return';w.toy=null;w.spatialFx=[];
    const target=Geo.safeSpot(w,g.origin,1.5);
    if(!target||!route(w,target,'return',label||'玩好了，沿路回到你身边')){finishGame(w,true,'回路暂时被挡住，先停在安全处');return false;}
    g.returnTarget=target;return true;
  }
  function nextLeg(w){
    const g=w.game;if(g.index>=g.stops.length){returnHome(w,false);return;}
    const target=g.stops[g.index];g.phase='move';g.nextWater=w.t+.25;
    if(!route(w,target,'game',GAMES[w.species].label+' · '+(g.index+1)+'/'+g.stops.length)){returnHome(w,true,'路线变了，先回到你身边');return;}
    w.toy=w.species==='alpaca'?null:{kind:w.profile.toy,x:target.x,y:target.y,until:w.t+120};
    g.visited.push(point(w.dog));
  }
  function gameArrival(w){
    const g=w.game;if(g.phase==='return'){finishGame(w,g.cancelled,g.cancelled?'这一轮结束，回来了':null);return;}
    w.intent=null;g.phase='action';g.until=w.t+GAMES[w.species].hold;w.spatialStats.legs++;
    w.dog.activity=GAMES[w.species].action;
    w.dog.label={cat:'扑到羽毛，再换个方向',red_panda:'停下来，翻玩木球',robot:'扫描信标 · '+(g.index+1)+'/'+g.stops.length,panda_cub:'坐下拨弄竹叶',alpaca:'转个弯，继续小跑',rabbit:'拨一下球，再跳向另一边'}[w.species];
    clip(w,w.dog.activity);
    if(w.species==='robot'){w.spatialFx.push({kind:'scan',...point(w.dog),t:w.t,life:.85});w.spatialStats.scans++;}
    if(w.species==='panda_cub')w.spatialFx.push({kind:'leaves',...point(w.dog),t:w.t,life:1.2});
  }
  function chooseStops(w,target){
    const cfg=GAMES[w.species],origin=point(w.dog),left=origin.x>w.cols/2;
    const xs=left?[.25,.75]:[.75,.25], raw=[{x:w.cols*xs[0],y:w.rows*.3},{x:w.cols*xs[1],y:w.rows*.32},{x:w.cols*xs[0],y:w.rows*.68},{x:w.cols*.5,y:w.rows*.5},{x:w.cols*xs[1],y:w.rows*.72}];
    if(target)raw.unshift(target);
    const stops=[];let from=origin;
    for(let n=0;n<cfg.legs;n++){
      let best=null;
      for(let j=0;j<raw.length;j++){
        const q=Geo.safeSpot(w,raw[(n+j)%raw.length],1.25);if(!q||Math.hypot(q.x-from.x,q.y-from.y)<.7||Math.hypot(q.x-origin.x,q.y-origin.y)<.55)continue;
        const path=Geo.planPath(w,from,q,.5),back=Geo.planPath(w,q,origin,.5);if(!path||!back)continue;
        best=path[path.length-1];break;
      }
      if(!best)return null;stops.push(point(best));from=best;
    }
    return stops;
  }
  function approachOwner(w,target,done){
    if(w.noRoom||w.paused||!Geo.planPath(w,w.dog,target,0))return {ok:false,why:'noRoute'};
    clearGame(w);if(!route(w,target,'attention','走到你身边'))return {ok:false,why:'noRoute'};
    w.intent.ownerDone=done;return {ok:true};
  }
  function cancelOwner(w){clearGame(w);begin(w,'attention',1.2,'你换了位置，再叫我一声吧');w.captionUntil=w.t+1.2;}
  function call(w){if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    clearGame(w);const ok=route(w,w.ownerTarget||{x:w.front.x,y:w.front.y-.65},'attention','听到呼唤，向你走来');if(!ok){begin(w,'attention',1.2,'回来的路被挡住了');w.captionUntil=w.t+1.2;return {ok:false,why:'noRoute'};}w.calling=true;return {ok};}
  function pet(w){if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    clearGame(w);begin(w,'petted',1.6,w.profile.pet);gain(w);w.fx.push({type:'heart',t:w.t});w.captionUntil=w.t+1.6;return {ok:true};}
  function throwBall(w,target){ // Host compatibility name; no companion uses the dog's fetch plan.
    if(w.noRoom)return {ok:false,why:'waiting'};if(w.paused)return {ok:false,why:'paused'};
    if(w.game){if(w.game.phase!=='return')returnHome(w,true,'收到，结束这一轮，回到你身边');return {ok:true,returning:true};}
    if(!['E','N','S'].every(d=>w.manifest.clips['walk_'+d]))return {ok:false,why:'noRoute'};
    const stops=chooseStops(w,target);if(!stops)return {ok:false,why:'noRoute'};
    clearGame(w);w.game={origin:point(w.dog),stops,index:0,phase:'move',cancelled:false,visited:[],hop:0};w.spatialStats.started++;nextLeg(w);return {ok:true,stops:stops.map(point)};
  }
  function water(w,dx,dy){
    const length=Math.hypot(dx,dy)||1,v={x:dx/length,y:dy/length},from=point(w.dog);let to=null;
    for(let distance=.95;distance>=.15;distance-=.1){const q={x:from.x+v.x*distance,y:from.y+v.y*distance};if(Geo.circleFree(w,q.x,q.y,.06)&&Geo.segClear(w,from,q,.06)){to=q;break;}}
    if(to){w.spatialFx.push({kind:'water',from:{x:from.x+v.x*.32,y:from.y+v.y*.12},to,t:w.t,life:.7});w.spatialStats.waterBursts++;}
  }
  function rand(w){w.rs=(Math.imul(w.rs,1664525)+1013904223)>>>0;return w.rs/4294967296;}
  function update(w,dt){
    if(w.paused||w.noRoom)return;dt=clamp(finite(dt)?dt:0,0,.1);w.t+=dt;
    const d=w.dog;d.z=0;w.fx=w.fx.filter(f=>w.t-f.t<1.4);w.spatialFx=w.spatialFx.filter(f=>w.t-f.t<f.life);if(w.toy&&w.t>w.toy.until)w.toy=null;
    if(w.game?.phase==='action'&&w.t>=w.game.until){w.game.index++;nextLeg(w);}
    if(w.intent){
      const q=w.intent.path[0];if(!q){if(w.game)gameArrival(w);else {const i=w.intent,called=w.calling;begin(w,i.kind,i.kind==='play'?3:i.kind==='rest'?HABITS[w.species].rest:1.2,called?'来到你身边了':i.label);if(called){w.calling=false;w.captionUntil=w.t+2;}if(i.kind==='play')gain(w);if(i.ownerDone)i.ownerDone();}}
      else {const dx=q.x-d.x,dy=q.y-d.y,dist=Math.hypot(dx,dy);
        const dir=Math.abs(dx)>Math.abs(dy)?dx>0?'E':'W':dy>0?'S':'N',moveClip=(w.intent.kind==='play'||w.game)&&w.manifest.clips['run_'+(dir==='W'?'E':dir)]?'run':'walk';
        const step=Math.min(dist,(w.manifest.runtime.walkSpeed||w.profile.speed)*(w.game?GAMES[w.species].speed:moveClip==='run'?(w.manifest.runtime.runMultiplier||1.45):1)*dt),x=dist?d.x+dx/dist*step:d.x,y=dist?d.y+dy/dist*step:d.y;
        if(!Geo.segOK(w,d,{x,y})||!Geo.bodyFree(w,x,y,dir)){if(w.game)returnHome(w,true,'前面有家具，绕路回去');else begin(w,'attention',1,'前面有家具，换条路');}
        else {d.x=x;d.y=y;d.dir=dir;clip(w,moveClip,dir);d.energy=clamp(d.energy-dt*.25,0,100);if(w.game){
          if(w.species==='rabbit'){w.game.hop+=dt;d.z=Math.abs(Math.sin(w.game.hop*Math.PI/.3))*.13;}
          if(w.species==='alpaca'&&w.game.phase==='move'&&w.t>=w.game.nextWater){water(w,dx,dy);w.game.nextWater=w.t+.6;}
          if(w.species==='red_panda'&&w.game.phase==='move'&&w.toy){const lead={x:x+(dist?dx/dist*.35:0),y:y+(dist?dy/dist*.35:0)};if(Geo.circleFree(w,lead.x,lead.y,.12))Object.assign(w.toy,lead);}
        }
        if(dist<.02||step>=dist)w.intent.path.shift();}
      }
    } else if(!w.game&&w.t>=w.until){
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
    w.t=s.t+elapsed;w.rs=finite(s.rs)?s.rs>>>0:w.rs;clearGame(w);w.until=w.t+2;clip(w,'idle',w.dog.dir);return {ok:true,elapsed};}
  function setLayout(w,L){Geo.setLayout(w,L);const p=Geo.safeSpot(w,w.dog,3);w.noRoom=!p;if(p)Object.assign(w.dog,p);w.intent=null;if(w.game&&!w.noRoom)returnHome(w,true,'布置变了，绕开家具回去');else if(w.noRoom)clearGame(w);else w.calling=false;}
  function setRearrange(w,on){w.paused=!!on;if(on){clearGame(w);w.until=w.t+2;clip(w,'idle');}}
  function snapshot(w){return {species:w.species,t:w.t,noRoom:w.noRoom,pet:{x:w.dog.x,y:w.dog.y,activity:w.dog.activity,label:w.dog.label,energy:w.dog.energy,affinity:w.dog.affinity,clip:w.dog.anim.name},toy:w.toy,game:w.game?{phase:w.game.phase,index:w.game.index,origin:w.game.origin,stops:w.game.stops}:null,spatialStats:{...w.spatialStats},spatialFx:w.spatialFx};}
  function createView(opt){
    const M=opt.manifest;let els=null,atlas=opt.image||null;
    function detach(){if(els){els.dog.remove();els.toy.remove();els.effects.remove();els.caption.remove();els=null;}}
    function ensure(floor){if(els&&els.floor===floor&&els.dog.parentNode===floor)return els;detach();
      const dog=document.createElement('div'),cv=document.createElement('canvas'),toy=document.createElement('div'),effects=document.createElement('canvas'),caption=document.createElement('div');
      dog.className='pet-dog pet-sprite';dog.dataset.uid=opt.uid;dog.dataset.species=M.species;dog.setAttribute('aria-label',opt.name||M.species);dog.appendChild(cv);
      toy.className='pet-ball';toy.dataset.uid=opt.uid;effects.className='pet-spatial-effects';effects.dataset.uid=opt.uid;effects.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:8';caption.className='pet-spatial-caption';caption.dataset.uid=opt.uid;caption.setAttribute('aria-live','polite');floor.appendChild(effects);floor.appendChild(toy);floor.appendChild(dog);floor.appendChild(caption);els={floor,dog,cv,ctx:cv.getContext('2d'),toy,effects,caption};return els;}
    function drawSpatial(w,e,tile,dpr){
      const canvas=e.effects;canvas.width=Math.ceil(w.cols*tile*dpr);canvas.height=Math.ceil(w.rows*tile*dpr);const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
      if(w.game){
        ctx.strokeStyle=w.game.phase==='return'?'#468e61':'#bc8435';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(w.dog.x*tile,w.dog.y*tile);
        for(const q of w.intent?.path||[])ctx.lineTo(q.x*tile,q.y*tile);ctx.stroke();ctx.setLineDash([]);
        ctx.strokeStyle='#468e61';ctx.beginPath();ctx.ellipse(w.game.origin.x*tile,w.game.origin.y*tile,9,5,0,0,Math.PI*2);ctx.stroke();
      }
      for(const f of w.spatialFx){const t=clamp((w.t-f.t)/f.life,0,1);ctx.save();ctx.globalAlpha=1-t;
        if(f.kind==='water'){
          const x=(f.from.x+(f.to.x-f.from.x)*t)*tile,y=(f.from.y+(f.to.y-f.from.y)*t)*tile-(1-t)*tile*.65-Math.sin(t*Math.PI)*tile*.12;
          ctx.fillStyle='#4daed6';ctx.strokeStyle='#23698e';ctx.lineWidth=1;
          for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(x-i*3,y+i*2,3-i*.5,2-i*.25,-.4,0,Math.PI*2);ctx.fill();ctx.stroke();}
          if(t>.65){ctx.strokeStyle='#69bdd6';ctx.beginPath();ctx.ellipse(f.to.x*tile,f.to.y*tile,3+12*t,2+4*t,0,0,Math.PI*2);ctx.stroke();}
        }else if(f.kind==='scan'){
          ctx.strokeStyle='#39a6c2';ctx.fillStyle='rgba(57,166,194,.1)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(f.x*tile,f.y*tile,8+t*tile*.6,4+t*tile*.3,0,0,Math.PI*2);ctx.fill();ctx.stroke();
        }else if(f.kind==='leaves'){
          ctx.fillStyle='#7d9a3e';for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(f.x*tile+(i-1)*8*t,f.y*tile-8-14*Math.sin(t*Math.PI),4,2,(i-1)*.6,0,Math.PI*2);ctx.fill();}
        }ctx.restore();
      }
      for(const f of w.fx){if(f.type!=='heart')continue;const age=w.t-f.t;if(age<0||age>1.4)continue;ctx.save();ctx.globalAlpha=1-age/1.4;ctx.fillStyle='#dc6681';ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText('♥',w.dog.x*tile,w.dog.y*tile-tile*.75-age*13);ctx.restore();}
      const visible=!!w.game||w.calling||w.captionUntil>w.t;e.caption.hidden=!visible;
      if(visible){e.caption.style.cssText=`position:absolute;left:${clamp(w.dog.x/w.cols*100,18,82)}%;top:${w.dog.y/w.rows*100}%;transform:translate(-50%,12px);max-width:160px;padding:3px 6px;border:1px solid #725c34;border-radius:7px;background:#fff8df;color:#3c3528;font-size:11px;line-height:1.3;text-align:center;pointer-events:none;z-index:90`;if(e.caption.textContent!==w.dog.label)e.caption.textContent=w.dog.label;}
    }
    function draw(w,floor){if(!w||!floor||w.noRoom||!atlas){detach();return;}const e=ensure(floor),tile=floor.getBoundingClientRect().width/w.cols;if(tile<1)return;
      const d=w.dog,size=M.runtime.displayTiles*tile,dpr=Math.min(window.devicePixelRatio||1,3),rectMode=M.atlas.mode==='sourceRect';
      const bounds=M.renderBounds||{left:-128,right:128,top:-208,bottom:48},k=size/256,width=(bounds.right-bounds.left)*k,height=(bounds.bottom-bounds.top)*k;
      e.cv.width=Math.ceil(width*dpr);e.cv.height=Math.ceil(height*dpr);e.cv.style.width=width+'px';e.cv.style.height=height+'px';
      e.dog.style.cssText=`left:${d.x/w.cols*100}%;top:${d.y/w.rows*100}%;width:${width}px;height:${height}px;z-index:${10+Math.floor(d.y*10)};transform:translate(${bounds.left*k}px,${bounds.top*k}px)`;
      const ctx=e.ctx,frame=M.clips[d.anim.name].frames[d.anim.frame()];
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.translate(-bounds.left*k,-bounds.top*k);
      if(M.shadow.procedural){ctx.fillStyle='rgba(55,35,23,.18)';ctx.beginPath();ctx.ellipse(0,0,size*.18,size*.04,0,0,Math.PI*2);ctx.fill();}
      else {const cell=M.runtime.cellSize,id=M.shadow.cell;ctx.drawImage(atlas,id%M.atlas.cols*cell,Math.floor(id/M.atlas.cols)*cell,cell,cell,-size/2,-208*k,size,size);}
      ctx.save();ctx.translate(0,-(d.z||0)*tile);if(d.dir==='W')ctx.scale(-1,1);
      if(rectMode){const r=frame.sourceRect,a=frame.anchor,extra=frame.imageKey&&M.atlases[frame.imageKey],source=extra?atlas.companionAtlases[frame.imageKey]:atlas,scale=k*(extra?extra.sourceScale:M.runtime.sourceScale);ctx.drawImage(source,...r,-a[0]*scale,-a[1]*scale,r[2]*scale,r[3]*scale);}
      else {const cell=M.runtime.cellSize,id=frame.cell;ctx.drawImage(atlas,id%M.atlas.cols*cell,Math.floor(id/M.atlas.cols)*cell,cell,cell,-size/2,-208*k,size,size);}
      ctx.restore();
      if(w.toy){e.toy.style.cssText=`left:${w.toy.x/w.cols*100}%;top:${w.toy.y/w.rows*100}%;width:22px;height:22px;background:none;border:0;z-index:${10+Math.floor(w.toy.y*10)}`;e.toy.textContent={teaser:'🪶',wood_ball:'🪵',beacon:'📡',bamboo:'🎋',ribbon:'🎀',willow:'🌿'}[w.toy.kind];if(['wood_ball','willow'].includes(w.toy.kind)){const wood=w.toy.kind==='wood_ball';e.toy.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="${wood?'#c69053':'#bdd084'}" stroke="#665236" stroke-width="2"/><path d="M5 8q7 4 14 0M4 13q8 4 16 0M7 4q-2 8 4 16M14 3q-2 8 3 16" fill="none" stroke="${wood?'#8c6036':'#738346'}" stroke-width="1.3"/></svg>`;e.toy.style.transform=`translate(-50%,-50%) rotate(${(w.toy.x+w.toy.y)*120}deg)`;}}else e.toy.style.display='none';
      drawSpatial(w,e,tile,dpr);
    }
    function hit(w,floor,x,y){return !!(w&&floor&&!w.noRoom&&els&&Art.canvasHit(els.cv,x,y));}
    return {draw,hit,detach,get els(){return els;},get artMode(){return atlas?'atlas':'unavailable';}};
  }
  return {CONFIG,GAMES,HABITS,CAT_FURNITURE,createWorld,update,step,call,pet,throwBall,approachOwner,cancelOwner,serialize,sanitizeSave,restore,setLayout,setRearrange,snapshot,createView};
});

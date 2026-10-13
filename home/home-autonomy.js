/* 家宅-56：CEO 没人点时在已摆家具之间自主活动（第一步，只用现有动作）。
 * 家宅-57：加吃、用家电、浇水、开灯、看墙、逗宠物六种新动作，坐 / 坐地毯换成每位 CEO 两句专属台词，停留时头顶冒道具小图标。
 *   五类新动作逐件列 ID（共 84 件，家宅-60 修订版 2/2），不在清单里的家具不自动加入；台词取家宅-60 总表原文。
 * 纯决策层：挑去处、停多久、说不说话。不读写存档、不碰 DOM、不影响收益；状态全在调用方内存里。
 * 规则来源：家宅-60 修订版（2026-10-12 22:55）+ 熊大 23:01 / 23:22 复核口径。
 * 只认现有白名单：home-interaction.js 的能躺 / 能坐（含唯一可坐地毯 s77_quilt_island_rug），
 * 以及 economy.furnLiveAct 为 read / dress 的书架、衣柜。其它家具一律不选（新动作归家宅-57）。 */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeAutonomy=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 // 每个动作：停留秒数区间、时段系数（只有拿得到有效时段时才乘，拿不到一律 ×1）、台词用 LIVE_LINES 的哪一组
 const KINDS=Object.freeze({
  lie:  Object.freeze({stay:[25,60],period:{night:3,morning:.5},lines:'rest'}),
  sit:  Object.freeze({stay:[10,25],period:{dusk:2},lines:'sit'}),
  rug:  Object.freeze({stay:[12,30],period:{},lines:'sit'}),
  read: Object.freeze({stay:[15,35],period:{day:1.5},lines:'read'}),
  dress:Object.freeze({stay:[4,8],period:{},lines:'dress'}),
  // 家宅-57 新动作：都站在家具旁边（看墙站在墙饰下面），不摆姿势
  eat:  Object.freeze({stay:[8,18],period:{},lines:'eat'}),
  use:  Object.freeze({stay:[6,15],period:{},lines:'use'}),
  water:Object.freeze({stay:[5,10],period:{morning:3},lines:'water'}),
  lamp: Object.freeze({stay:[4,8],period:{},lines:'lamp',only:['dusk','night']}),   // 只在黄昏、夜晚可选；拿不到时段就不选
  wall: Object.freeze({stay:[5,12],period:{},lines:'wall'}),
  pet:  Object.freeze({stay:[6,15],period:{},lines:'pet'})
 });
 // 家宅-57 五类新动作的家具清单（逐件，84 件）。furn_table / furn_otaku_kotatsu 从「坐」改走「吃」
 const IDS=Object.freeze({
  eat:['furn_table','furn_otaku_kotatsu'],
  water:['furn_plant','furn_s77_watering_stand','furn_s77_olive_planter','furn_s77_mini_greenhouse','furn_otaku_pixel_succulent','furn_otaku_robot_planter','furn_pearl_herb_crate','furn_pearl_tea_bonsai','furn_pearl_terrarium_orb','furn_pearl_tea_tree_screen','furn_otaku_cactus_cartridge','furn_rocket_concrete_succulent','furn_rocket_pipe_vase','furn_rocket_biosphere_dome'],
  lamp:['furn_lamp','furn_s77_lantern_stand','furn_s77_mushroom_lamp','furn_s77_petal_uplight','furn_s77_quilt_shade_lamp','furn_s77_hearth_light','furn_pearl_paper_pear_lamp','furn_pearl_tea_glass_lamp','furn_pearl_boba_globe_lamp','furn_rocket_cage_lamp','furn_rocket_tripod_searchlight','furn_rocket_pipe_valve_lamp','furn_rocket_rocket_nozzle_light','furn_pearl_fan_shade_lamp','furn_pearl_tea_arc_lamp','furn_pearl_fountain_light','furn_otaku_panel_lamp','furn_otaku_gooseneck_stand','furn_otaku_pixel_cube_light','furn_otaku_arcade_marquee_lamp','furn_otaku_orbital_neon_floor','furn_otaku_sleep_timer_totem','furn_rocket_orbital_ring_lamp','furn_rocket_solar_array_lamp'],
  use:['furn_fridge','furn_tv','furn_s77_box_fan','furn_s77_toaster_cart','furn_s77_record_console','furn_s77_sewing_machine_stand','furn_s77_stove_oven','furn_s77_laundry_pair','furn_pearl_tea_kettle_cart','furn_pearl_juice_press','furn_pearl_milk_frother_bar','furn_pearl_tea_brewer','furn_pearl_dessert_chiller','furn_otaku_mini_fridge','furn_otaku_console_station','furn_otaku_arcade_cabinet','furn_otaku_projector_cart','furn_otaku_triple_monitor_station','furn_rocket_industrial_fan','furn_rocket_vacuum_dock','furn_rocket_coffee_pressure_unit','furn_rocket_air_purifier','furn_rocket_hydroponic_unit','furn_rocket_planetarium_console'],
  wall:['furn_painting','furn_s77_embroidery_hoops','furn_s77_wood_cuckoo','furn_s77_quilt_wall','furn_s77_pressed_flower_frame','furn_s77_family_silhouette','furn_pearl_tea_menu_board','furn_pearl_cup_wall_rack','furn_pearl_sunburst_mirror','furn_pearl_tea_leaf_relief','furn_pearl_moon_window_art','furn_otaku_speech_bubble_board','furn_otaku_manga_page_triptych','furn_otaku_controller_wall_mount','furn_otaku_pixel_city_lightbox','furn_rocket_blueprint_frame','furn_rocket_gear_clock','furn_rocket_mission_patch_board','furn_rocket_moon_sample_relief','furn_rocket_orbital_map_panel']
 });
 const KIND_OF_ID=new Map();for(const k of Object.keys(IDS))for(const id of IDS[k])KIND_OF_ID.set(id,k);
 // 家宅-60 总表 7–14 行台词原文（每位 CEO 每个动作 2 句）。看墙那行提到「外头 / 窗外」的 4 句先不触发（WINDOW_LINES 留作资产，等家宅-48 有真实窗位再启用）
 const LINES=Object.freeze({
  c77:   {sit:['坐倒歇口气，腰杆儿舒服。','这凳子安逸，比摊子上的塑料凳强。'],rug:['地上坐起，跟蹲摊子一样自在。','盘腿！烤串师傅的标准坐姿。'],eat:['桌上摆一把串，人生圆满。','先吃一口，再算今天卖了好多。'],use:['电器要擦得亮堂，用起来才顺手。','这个机器咋个开嘛……哦，亮了。'],water:['浇点水，跟守火候一个道理。','长得好，下回拿来摆盘。'],lamp:['天黑了，灯开起，像夜市一样。','灯一亮，就想出摊。'],wall:['这幅画……像不像炭火？'],pet:['来，摸一下，莫抢我的串。','你也饿了嗦？']},
  pearl: {sit:['坐端正，账才算得直。','歇三分钟，刚好一杯茶的时间。'],rug:['地毯软，适合盘点今天的进账。','偶尔不坐椅子，也挺好。'],eat:['点心时间，糖度减半。','桌面要干净，杯垫要对齐。'],use:['机器要常擦，跟茶具一样。','家里这台，手感还是不如店里的。'],water:['叶子跟珍珠一样，要水润。','浇七分，不多不少。'],lamp:['暖光，茶汤显得更好看。','只开这一盏，电费也是成本。'],wall:['这面墙再挂一幅，就齐了。'],pet:['乖，别碰我的账本。','今天表现好，奖励一颗珍珠——不能吃的那种。']},
  otaku: {sit:['这个机位，适合画背影。','坐下来，灵感就来了……大概。'],rug:['地板派，摊开画稿最方便。','盘腿，开会，跟自己开会。'],eat:['赶稿必备：桌上要有零食。','边吃边想下一话的分镜。'],use:['开着当背景音，画得更快。','就玩一会儿。真的就一会儿。'],water:['植物也是背景美术的一部分。','浇水，顺便练一下手部速写。'],lamp:['台灯一开，进入赶稿模式。','夜里的灯光，像漫画最后一页。'],wall:['这张画的构图，我给九十分。'],pet:['你就是这一话的吉祥物。','别跑，我在画你。']},
  rocket:{sit:['座椅已校准，进入待机。','坐下，计算轨道。'],rug:['模拟失重：躺平在地毯上。','地面站，信号良好。'],eat:['补给时间，能量 +10%。','桌面就是指挥台。'],use:['设备自检：正常。','这台家电，能改装成推进器吗？'],water:['火星上也得种这个。','水量 50 毫升，误差 ±1。'],lamp:['照明系统：开启。','这盏灯够亮，能当信号灯。'],wall:['墙上这幅，像一张星图。'],pet:['副驾驶，准备好了吗？','你也想去火星？还剩一个名额。']}
 });
 const WINDOW_LINES=Object.freeze({c77:'看一眼外头，有没有客人路过。',pearl:'看看窗外，排队的人多不多。',otaku:'窗外这一格，可以做扉页。',rocket:'窗外那颗亮的，是火星吗？'});
 // 停留时头顶的道具小图标（app 里对应 SVG 精灵 #ic-<名字>）。吃：77 / 阿宅串串，珍珠姐 / 火箭茶杯
 const ICON=Object.freeze({read:'book',use:'pad',water:'can',lamp:'bulb',wall:'scope',pet:'yarn'});
 const iconFor=(kind,ceo)=>kind==='eat'?(ceo==='pearl'||ceo==='rocket'?'cup':'skewer'):ICON[kind]||null;
 // 57 有专属台词的动作：坐、坐地毯和六种新动作；躺 / 读书 / 换衣服 / 踱步仍用 app 里的 LIVE_LINES
 const linesFor=(kind,ceo)=>{const pack=LINES[ceo]||LINES.c77;return kind&&pack[kind]?pack[kind]:null;};
 const PACE=Object.freeze({walk:[2,5],stay:[3,10]});
 const IDLE=Object.freeze([0,15]);
 const MOVE_MAX_SEC=3, WALK_SPEED=2.8, AFTER_PLAYER_SEC=60, LINE_SEC=3.5, LINE_REPEAT_SEC=600;
 // CEO 偏好 ×1.5（77：桌子、家电；珍珠姐：坐具、绿植；阿宅：书架、床、地毯；火箭：灯、家电、墙上挂件）
 const PREF=Object.freeze({c77:['eat','use'],pearl:['sit','rug','water'],otaku:['read','lie','rug'],rocket:['lamp','use','wall']});
 const RUG_FID='furn_s77_quilt_island_rug';

 function kindOf(fid,capability,liveAct){
  const k57=KIND_OF_ID.get(fid);if(k57)return k57;   // 57 清单优先（桌子、暖桌改走「吃」）
  const cap=capability(fid);
  if(cap==='lie')return 'lie';
  if(cap==='sit')return fid===RUG_FID?'rug':'sit';
  const a=liveAct(fid);
  return a==='read'||a==='dress'?a:null;
 }
 // placed: 房间 placed 数组；地面家具只收白名单内的，墙面只收「看墙」清单里的。
 // 57：period 不是黄昏 / 夜晚（或拿不到）就不选开灯；reachable(p,kind) 返回 false 的不选（墙饰下面没有合法站点等）；
 // pets：在这间房里的宠物 [{uid}]，有就多一个「逗宠物」候选
 function candidates(placed,{capability,liveAct,itemSurf,period,reachable,pets}){
  const out=[];
  for(const p of placed||[]){
   const kind=kindOf(p.fid,capability,liveAct);if(!kind)continue;
   if((itemSurf(p)==='wall')!==(kind==='wall'))continue;
   const only=KINDS[kind].only;if(only&&!only.includes(period))continue;
   if(reachable&&!reachable(p,kind))continue;
   out.push({uid:p.uid,fid:p.fid,kind});
  }
  for(const q of pets||[])out.push({uid:'pet:'+q.uid,pet:q.uid,kind:'pet'});
  return out;
 }
 const between=([a,b],rng)=>a+(b-a)*rng();
 // 规则 2：排除上一件；只有一件时与空地交替；一件都没有只踱步。返回 {pace:true} 或候选项
 function pick(list,{last,ceo,period,rng}){
  if(!list.length)return {pace:true};
  if(list.length===1)return last===list[0].uid?{pace:true}:list[0];
  const pool=list.filter(c=>c.uid!==last),pref=PREF[ceo]||[];
  const w=pool.map(c=>{let v=1;const m=period&&KINDS[c.kind].period[period];if(m)v*=m;if(pref.includes(c.kind))v*=1.5;return v;});
  let r=rng()*w.reduce((a,b)=>a+b,0);
  for(let i=0;i<pool.length;i++){r-=w[i];if(r<0)return pool[i];}
  return pool[pool.length-1];
 }
 const stayFor=(kind,rng)=>between(KINDS[kind].stay,rng);
 const paceWalk=rng=>between(PACE.walk,rng), paceStay=rng=>between(PACE.stay,rng);
 const idleFor=rng=>between(IDLE,rng);
  // 规则 4：太远或被挡就淡出淡入。家具之间单程上限 3 秒；空地踱步上限按 PACE.walk 的 5 秒另算。
 // 没有寻路：直线穿过任何实体家具（非墙面、非地毯层）就算被挡 → 淡入，不穿模。
 function needsFade(dist,reducedMotion,opts){
  const o=opts||{},max=o.pace?PACE.walk[1]:MOVE_MAX_SEC;
  // r3：自主踱步自带本段时长 sec（2–5 秒，已按距离调速），就按 sec 判；不再按 2.8 格/秒换算
  const sec=o.sec!=null?o.sec:dist/WALK_SPEED;
  return !!reducedMotion||!!o.blocked||sec>max;
 }
 // 直线 a→b（格子中心坐标）是否穿过某个家具矩形内部 {x,y,w,h}；贴边不算（Liang–Barsky，矩形内缩 eps）
 function segmentBlocked(a,b,rects,eps){
  const e=eps==null?.02:eps,dx=b.x-a.x,dy=b.y-a.y;
  for(const r of rects||[]){
   const x0=r.x+e,x1=r.x+r.w-e,y0=r.y+e,y1=r.y+r.h-e;if(x1<=x0||y1<=y0)continue;
   let t0=0,t1=1,hit=true;
   for(const [p,q] of [[-dx,a.x-x0],[dx,x1-a.x],[-dy,a.y-y0],[dy,y1-a.y]]){
    if(p===0){if(q<0){hit=false;break;}continue;}
    const t=q/p;if(p<0){if(t>t1){hit=false;break;}if(t>t0)t0=t;}else{if(t<t0){hit=false;break;}if(t<t1)t1=t;}
   }
   if(hit&&t1>t0)return true;
  }
  return false;
 }
 // 空地踱步：先按 PACE.walk（2–5 秒）×步速定一个想走的距离，再在空地里挑最接近的（房间小走不到就取最远的那几格，
 // 所以小屋里有时不足 2 秒——那是房间本身走不了那么远，不会原地）。
 // 永远不选脚下这格（距离 < 1 的一律排除）；没有别的空地就返回 null（调用方原地等）。
 function paceTarget(cells,from,rng){
  const want=paceWalk(rng)*WALK_SPEED;
  const far=(cells||[]).map(c=>({x:c.x,y:c.y,d:Math.hypot(c.x-from.x,c.y-from.y)})).filter(c=>c.d>=1);
  if(!far.length)return null;
  // 想走的比房间里能走的还远 → 只在最远的那几格里挑；否则在「离想走距离 ±0.75 格」里随机，没有就取最接近的
  const maxD=Math.max(...far.map(c=>c.d));
  let top=want>=maxD?far.filter(c=>c.d>=maxD-.01):far.filter(c=>Math.abs(c.d-want)<=.75);
  if(!top.length)top=[far.reduce((p,q)=>Math.abs(q.d-want)<Math.abs(p.d-want)?q:p)];
  const c=top[Math.floor(rng()*top.length)];
  // r3：本段实际走 sec 秒（就是抽到的 2–5 秒），速度按真实距离反推；手动走路、去家具的走路不用这个速度
  const sec=want/WALK_SPEED;
  return {x:c.x,y:c.y,want,dist:c.d,sec,speed:c.d/sec};
 }
 // 规则 5：停下时 50%（空房 25%）冒一句；同一句 10 分钟内不重复；冷却后没有可用句就不说
 function chooseLine(pool,said,{now,rng,emptyRoom}){
  if(rng()>=(emptyRoom?.25:.5))return null;
  const ok=(pool||[]).filter(l=>!(said[l]>now-LINE_REPEAT_SEC));
  if(!ok.length)return null;
  const line=ok[Math.floor(rng()*ok.length)];said[line]=now;return line;
 }
 return Object.freeze({KINDS,IDS,LINES,WINDOW_LINES,ICON,iconFor,linesFor,PACE,IDLE,PREF,MOVE_MAX_SEC,WALK_SPEED,AFTER_PLAYER_SEC,LINE_SEC,LINE_REPEAT_SEC,RUG_FID,kindOf,candidates,pick,stayFor,idleFor,paceWalk,paceStay,needsFade,segmentBlocked,paceTarget,chooseLine});
});

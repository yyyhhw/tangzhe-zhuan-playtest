/* Explicit human furniture capabilities. Catalog categories are not permissions. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HomeInteraction=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const lie=['bed','rocket_capsule_bunk','s77_cloud_canopy','s77_quilt_daybed','s77_drawer_bed','pearl_tea_daybed','pearl_pearl_bed','rocket_field_cot','pearl_canopy_lounge','pearl_capsule_daybed','otaku_floor_futon','otaku_sofa_sleeper','otaku_gaming_pod','otaku_projector_bed','rocket_steel_platform_bed','rocket_observatory_bed','rocket_zero_g_lounger','otaku_cocoon_lounger','s77_book_nook_bed','pearl_tea_loft','rocket_cryo_rest_pod'];
 const sit=['sofa','s77_reading_stool','s77_rocking_chair','s77_heart_bench','s77_quilt_ottoman','s77_window_bench','s77_curved_sectional','pearl_conversation_pit','otaku_floor_chair','otaku_modular_couch','otaku_arcade_bench','rocket_rail_bench','pearl_tea_stool','pearl_cafe_chair','pearl_scallop_sofa','pearl_bar_stool','pearl_egg_swing','otaku_beanbag','otaku_gaming_chair','rocket_bolt_stool','rocket_drafting_chair','rocket_pipe_sofa','rocket_captain_chair','table','s77_quilt_island_rug','otaku_kotatsu'];
 const capabilities=Object.freeze(Object.fromEntries([...lie.map(id=>['furn_'+id,'lie']),...sit.map(id=>['furn_'+id,'sit'])]));
 const pending=new Set(['furn_otaku_bunk_manga']);
 function capability(id){return capabilities[id]||null;}
 function classify(f){return {id:f.id,name:f.name,capability:capability(f.id)||'none',review:pending.has(f.id)||(f.cat==='rug'&&!capability(f.id))?'visual-review':'classified'};}
 // Front-image surface anchors, reviewed against the shipped furniture art.
 // In particular a stool's top and a chair's seat are at different image heights.
 const surfaces={
  table:{location:'beside'},otaku_kotatsu:{location:'beside'},s77_quilt_island_rug:{v:.60,ground:true},
  s77_book_nook_bed:{v:.69},pearl_tea_loft:{u:.51,v:.23,angle:1.46},rocket_cryo_rest_pod:{u:.51,v:.49,angle:-.22},
  s77_reading_stool:{v:.25},s77_rocking_chair:{v:.60},s77_heart_bench:{v:.57},s77_quilt_ottoman:{v:.31},s77_window_bench:{v:.22},
  s77_curved_sectional:{v:.59},pearl_conversation_pit:{u:.2,v:.70},otaku_floor_chair:{v:.81},otaku_arcade_bench:{v:.62},rocket_rail_bench:{v:.35},
  pearl_tea_stool:{v:.28},pearl_cafe_chair:{v:.53},pearl_bar_stool:{v:.29},pearl_egg_swing:{v:.66},otaku_beanbag:{v:.59},
  otaku_gaming_chair:{v:.66},rocket_bolt_stool:{v:.20},rocket_drafting_chair:{v:.35},rocket_pipe_sofa:{v:.64},rocket_captain_chair:{v:.66},
  rocket_capsule_bunk:{v:.59},s77_cloud_canopy:{v:.76},s77_quilt_daybed:{v:.41},pearl_tea_daybed:{v:.56},
  rocket_field_cot:{v:.44,angle:-.22},rocket_zero_g_lounger:{v:.55,angle:-.15},pearl_canopy_lounge:{v:.77},pearl_capsule_daybed:{v:.64},
  otaku_sofa_sleeper:{v:.56,angle:-.15},otaku_gaming_pod:{v:.56,angle:-.15},otaku_projector_bed:{v:.79},otaku_cocoon_lounger:{v:.55,angle:-.15}
 };
 function profile(id){const pose=capability(id);return pose?{pose,u:.5,v:pose==='lie'?.65:.67,angle:pose==='lie'?-1.38:0,...surfaces[id.replace(/^furn_/,'')]}:null;}
 function drawPose(c,drawPerson,look,pose,angle){
  c.clearRect(0,0,240,240);c.save();c.translate(120,120);
  const lying=pose==='lie';
  if(lying){c.rotate(angle==null?-1.38:angle);c.scale(1.6,1.6);c.translate(0,56);}
  else {c.scale(1.4,1.4);c.translate(0,48);}
  // Keep the shipped face, hair, clothes and arms; replace only the leg pose.
  c.save();c.beginPath();c.rect(-60,-140,120,103);c.clip();drawPerson(c,0,0,1,look,{happy:true});c.restore();
  c.lineJoin='round';c.lineCap='round';c.strokeStyle='#171717';c.lineWidth=2.6;c.fillStyle=look.pants||'#3d405b';
  c.beginPath();c.moveTo(-15,-38);c.lineTo(15,-38);
  if(lying){c.lineTo(11,-8);c.lineTo(-10,-8);c.closePath();}
  else {c.quadraticCurveTo(24,-34,22,-25);c.lineTo(30,-12);c.lineTo(18,-9);c.lineTo(8,-22);c.quadraticCurveTo(-12,-24,-15,-38);c.closePath();}
  c.fill();c.stroke();
  // Knees stay together; both feet point naturally in the same direction.
  c.lineWidth=1.6;c.beginPath();c.moveTo(0,-36);if(lying)c.lineTo(0,-10);else{c.quadraticCurveTo(15,-32,15,-25);c.lineTo(24,-12);}c.stroke();
  c.fillStyle=look.shoe||'#2f2a28';c.lineWidth=2;
  for(const dx of lying?[-6,5]:[22,30]){c.beginPath();c.ellipse(dx,lying?-6:-9,5,3.5,lying?0:-.15,0,Math.PI*2);c.fill();c.stroke();}
  c.restore();
 }
 // Ground poses must remain inside the rug and outside every solid footprint.
 // Furniture may overlap rugs, so catalog placement alone is not a sitting permit.
 function rugPoint(E,home,rug,preferred){
  const size=E.furnSize(rug.fid,rug.rot),points=[],margin=.35;
  const solids=home.placed.filter(p=>E.itemSurf(p)!=='wall'&&E.FURN_BY_ID[p.fid]?.layer!=='rug').map(p=>({x:p.x,y:p.y,...E.furnSize(p.fid,p.rot)}));
  for(let y=rug.y;y<rug.y+size.h;y++)for(let x=rug.x;x<rug.x+size.w;x++){
   const cx=x+.5,cy=y+.5;
   if(solids.some(p=>cx+margin>p.x&&cx-margin<p.x+p.w&&cy+margin>p.y&&cy-margin<p.y+p.h))continue;
   points.push({x,y});
  }
  const near=preferred||{x:rug.x+size.w/2-.5,y:rug.y+size.h/2-.5};
  points.sort((a,b)=>Math.hypot(a.x-near.x,a.y-near.y)-Math.hypot(b.x-near.x,b.y-near.y));return points[0]||null;
 }
 // Search by proximity to the owner, accepting only an exact, legal, reachable endpoint.
 // No safeSpot fallback: that may return a free point in a disconnected part of the room.
 function reachableOwnerPoint(Geo,w,owner,avoid){
  if(!owner||!Number.isFinite(owner.x)||!Number.isFinite(owner.y)||w.noRoom)return null;
  const points=[{x:owner.x,y:owner.y+.65}];
  for(let y=.25;y<w.rows;y+=.25)for(let x=.25;x<w.cols;x+=.25)points.push({x,y});
  const score=p=>Math.hypot(p.x-owner.x,p.y-owner.y)+((avoid||[]).some(a=>Math.hypot(p.x-a.x,p.y-a.y)<.8)?2:0);
  points.sort((a,b)=>score(a)-score(b));
  for(const p of points){if(Math.hypot(p.x-owner.x,p.y-owner.y)<.55||!Geo.bodyFree(w,p.x,p.y,'H')||!Geo.bodyFree(w,p.x,p.y,'V'))continue;
   // Tall furniture art extends above its footprint. Wait beside/in front of it,
   // so a pet behind a loft cannot appear to be standing on the upper mattress.
   const f=owner.furniture,b=w.body.H;if(f&&p.y<f.y+f.h+w.body.D&&p.x+b.r>f.x&&p.x-b.l<f.x+f.w)continue;
   const path=Geo.planPath(w,w.dog,p,0),last=path&&path[path.length-1];if(last&&Math.hypot(last.x-p.x,last.y-p.y)<.01)return p;
  }return null;
 }
 return {capabilities,capability,classify,profile,drawPose,rugPoint,reachableOwnerPoint};
});

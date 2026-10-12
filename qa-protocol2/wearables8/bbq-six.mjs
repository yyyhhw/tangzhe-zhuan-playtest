/** Six original BBQ visual candidates. Pure Canvas recipes, no game-state access.
 * Feet y=0; torso -72..-36; head anchor -92. Clothes BEFORE arms/head,
 * hats AFTER hair/face. These are geometry, never flat decals over a face.
 */
const INK='#241e19',TAU=Math.PI*2;
export const VISUAL_IDS=Object.freeze({clothes:Object.freeze(['c_ember_fan_mantle','c_grill_grid_tabard']),hats:Object.freeze(['h_skewer_pinwheel','h_mushroom_parasol']),decor:Object.freeze(['d_charcoal_chime','d_spice_turntable'])});
export const NAMES=Object.freeze({c_ember_fan_mantle:'炭星扇披',c_grill_grid_tabard:'烤格方襟',h_skewer_pinwheel:'串串风车',h_mushroom_parasol:'香菇小阳伞',d_charcoal_chime:'炭篓风铃',d_spice_turntable:'铜边调料转盘'});
const has=(k,id)=>VISUAL_IDS[k].includes(id);
function line(c,pts,color=INK,w=1.4){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function poly(c,pts,color,w=1.8){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();paint(c,color,w);}
function paint(c,color,w=1.8){c.fillStyle=color;c.fill();if(w){c.strokeStyle=INK;c.lineWidth=w;c.stroke();}}
function oval(c,x,y,rx,ry,color,w=1.4){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);paint(c,color,w);}
function box(c,x,y,w,h,r,color,lw=1.4){c.beginPath();c.roundRect(x,y,w,h,r);paint(c,color,lw);}
function safe(c,fn){c.save();try{c.lineJoin='round';c.lineCap='round';fn();}finally{c.restore();}}
export function withCollectibleLook(base,equipment={}){const look={...base};if(has('clothes',equipment.clothes))Object.assign(look,{collectibleClothes:equipment.clothes,top:'#f1dbbb',sleeve:base.sleeve||base.top,apron:null,pattern:null,inner:null,lapel:false,rocketLogo:false,hood:false,tie:false});if(has('hats',equipment.hat))look.hat=equipment.hat;return look;}
export function drawCollectibleClothes(c,id){if(!has('clothes',id))return false;safe(c,()=>{
 if(id==='c_ember_fan_mantle'){
  // Five physically separate scalloped panels, fanning from collar to hem.
  const panels=[[-10,-71,-24,-55,-19,-48,-12,-51],[-7,-71,-15,-49,-8,-43,-3,-48],[0,-71,-7,-47,0,-40,7,-47],[7,-71,3,-48,8,-43,15,-49],[10,-71,12,-51,19,-48,24,-55]];
  panels.forEach((p,i)=>{poly(c,[[p[0],p[1]],[p[2],p[3]],[p[4],p[5]],[p[6],p[7]]],i%2?'#754532':'#57382c',1.7);line(c,[[p[2]+(i<2?1:-1),p[3]],[p[4],p[5]-2],[p[6],p[7]]],'#d76c3b',2.3);});
  for(const s of [-1,1]){line(c,[[s*7,-66],[s*18,-54]],'#f5c98a',.9);line(c,[[s*4,-65],[s*8,-49]],'#dca667',1);}
  // Curved upright collar, two halves retain central opening.
  c.beginPath();c.moveTo(-11,-71);c.quadraticCurveTo(-10,-78,-4,-76);c.lineTo(-1,-67);c.quadraticCurveTo(-7,-66,-11,-71);c.closePath();paint(c,'#d76c3b',1.5);
  c.beginPath();c.moveTo(11,-71);c.quadraticCurveTo(10,-78,4,-76);c.lineTo(1,-67);c.quadraticCurveTo(7,-66,11,-71);c.closePath();paint(c,'#d76c3b',1.5);
  line(c,[[0,-60],[0,-46]],'#191916',1.6);
  poly(c,[[0,-69],[4,-64],[0,-59],[-4,-64]],'#f5c98a',1.3);poly(c,[[0,-66],[1.5,-64],[0,-62],[-1.5,-64]],'#d76c3b',.5);
 }else{
  // Offset rectangular front/rear panels: deliberately unlike a cape or vest.
  poly(c,[[-12,-72],[10,-72],[18,-64],[18,-33],[-11,-33],[-15,-61]],'#c7c9bb',2);
  poly(c,[[-12,-71],[4,-71],[13,-64],[12,-39],[-19,-39],[-17,-63]],'#354247',2);
  poly(c,[[9,-66],[15,-65],[14,-39],[9,-40]],'#253438',0);
  // Four bold grid cells on the outer panel.
  box(c,-13,-62,21,17,1,'#46565a',1.1);
  line(c,[[-2.5,-62],[-2.5,-45]],'#c7c9bb',2);line(c,[[-13,-53.5],[8,-53.5]],'#c7c9bb',2);
  line(c,[[-15,-42],[9,-42]],'#db773e',2);
  poly(c,[[5,-69],[9,-71],[15,-61],[11,-59]],'#db773e',1.1);
  box(c,-12,-72,6,5,1,'#db773e',1);box(c,-10.5,-70.8,3,2.4,.3,'#f7d697',.5);
  for(const y of [-47,-42,-37])line(c,[[15,y],[17,y]],'#7e8b81',.8);
 }
});return true;}
export function drawCollectibleHat(c,id,hy=-92){if(!has('hats',id))return false;if(!Number.isFinite(hy))throw new RangeError('Invalid head anchor');safe(c,()=>{c.translate(0,hy);
 if(id==='h_skewer_pinwheel'){
  // Short stem is fixed above hair; four swept skewer arms leave a central gap.
  box(c,-7,-23,14,4,2,'#815132',1.4);line(c,[[0,-23],[0,-32]],'#241e19',3.5);line(c,[[0,-23],[0,-32]],'#e9c899',1.7);
  c.translate(0,-37);
  for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2);line(c,[[2,0],[10,-1],[16,-8]],INK,2.6);line(c,[[2,0],[10,-1],[16,-8]],'#e9c899',1.3);
   if(i%2===0){poly(c,[[7,-8],[12,-7],[12,-2],[7,-3]],'#b96937',1.1);line(c,[[8,-7],[10,-3]],'#6f3927',.8);poly(c,[[13,-9],[17,-10],[17,-6],[14,-5]],'#5c8b53',.9);}
   else{oval(c,10,-5,4,2.6,'#f4d5a3',1);line(c,[[8,-5],[12,-5]],'#ad8054',.7);c.beginPath();c.arc(15,-8,3,.2,2.7);c.strokeStyle='#5c8b53';c.lineWidth=3;c.stroke();}
   c.restore();}
  oval(c,0,0,3.2,3.2,'#a77343',1.2);oval(c,-.7,-.8,.7,.7,'#e9c899',0);
 }else{
  oval(c,0,-21,7,2.6,'#c2a07d',1.3);
  c.beginPath();c.moveTo(-4,-22);c.lineTo(-3,-32);c.quadraticCurveTo(0,-34,4,-31);c.lineTo(5,-22);c.quadraticCurveTo(0,-19,-4,-22);c.closePath();paint(c,'#f2dcc0',1.4);
  line(c,[[2,-30],[3,-24]],'#c2a07d',.9);
  oval(c,0,-33,17.5,4.4,'#c2a07d',1.5);
  for(const x of [-13,-8,-3,3,8,13])line(c,[[x,-33],[x*.4,-29.7]],'#704b38',.7);
  c.beginPath();c.moveTo(-18,-34);c.bezierCurveTo(-17,-48,-7,-51,1,-50);c.bezierCurveTo(10,-50,17,-43,18,-34);c.quadraticCurveTo(13,-30,7,-32);c.quadraticCurveTo(0,-30,-6,-32);c.quadraticCurveTo(-13,-30,-18,-34);c.closePath();paint(c,'#704b38',1.8);
  c.beginPath();c.moveTo(-14,-38);c.quadraticCurveTo(-10,-46,-4,-47);c.strokeStyle='#a77750';c.lineWidth=2.2;c.stroke();
  // Three broad cream cuts, not mere surface speckles.
  poly(c,[[-1,-45],[1,-42],[-8,-36],[-6,-41]],'#f2dcc0',0);poly(c,[[2,-44],[9,-41],[10,-36],[3,-40]],'#f2dcc0',0);poly(c,[[0,-41],[3,-37],[1,-33],[-1,-36]],'#f2dcc0',0);
 }
});return true;}
export function drawCollectibleDecor(c,id,{x=0,y=0,scale=1}={}){if(!has('decor',id))return false;if(![x,y,scale].every(Number.isFinite)||scale<=0)throw new RangeError('Invalid decor transform');safe(c,()=>{c.translate(x,y);c.scale(scale,scale);
 if(id==='d_charcoal_chime'){
  oval(c,0,-46,9,3.5,'#d5ac67',1.5);oval(c,0,-46,5.4,1.5,'#fff1d6',.7);
  line(c,[[-7,-43],[-13,-32]],'#8d633d',1.7);line(c,[[7,-43],[13,-32]],'#8d633d',1.7);
  // Each chime has a separate cord and visibly different length.
  for(const [x,top,len] of [[-9,-15,20],[0,-13,28],[9,-15,16]]){line(c,[[x,-20],[x,top]],'#3f3b36',1);box(c,x-2,top,4,len,1,'#b8864e',1);line(c,[[x-1,top+2],[x-1,top+len-2]],'#f0d18d',.8);oval(c,x,top+len,2,1,'#6d4c35',.8);}
  line(c,[[4,-17],[4,6]],'#3f3b36',.8);oval(c,4,7,3.4,3.4,'#d5ac67',1.1);
  poly(c,[[-15,-32],[15,-32],[11,-17],[-11,-17]],'#8d633d',1.8);
  c.save();c.beginPath();c.moveTo(-14,-31);c.lineTo(14,-31);c.lineTo(10,-18);c.lineTo(-10,-18);c.closePath();c.clip();for(let x=-25;x<25;x+=5){line(c,[[x,-34],[x+18,-14]],'#d5ac67',1);line(c,[[x,-14],[x+18,-34]],'#d5ac67',1);}c.restore();
  box(c,-16,-33,32,4,1.5,'#d5ac67',1.4);box(c,-12,-20,24,3,1,'#b48b52',1.1);
  for(const [x,y,r] of [[-8,-35,4],[0,-35,5],[8,-35,3.5]]){poly(c,[[x-r,y],[x-r*.4,y-r],[x+r*.5,y-r*.6],[x+r,y+1],[x,y+2]],'#3f3b36',.8);line(c,[[x-r*.3,y-r*.5],[x+r*.4,y-r*.3]],'#747169',.6);}
 }else{
  // Thick elliptical copper tray, separate base and reflective upper rim.
  oval(c,0,0,24,7,'#714d30',1.7);box(c,-24,-5,48,5,1,'#b98249',1.3);oval(c,0,-5,24,7,'#b98249',1.7);oval(c,0,-5,20.5,4.8,'#eee0be',1);
  // Tall rear cylinder.
  box(c,-7,-33,13,24,3,'#eee0be',1.5);oval(c,-.5,-10,6.5,2,'#d2bb87',1);oval(c,-.5,-32,6.5,2.6,'#b98249',1.3);oval(c,-.5,-34,7,2.7,'#a74432',1.2);for(const x of [-3,0,3])oval(c,x,-34,.55,.55,'#eee0be',0);line(c,[[3,-28],[3,-15]],'#fff6dc',1.4);
  // Two squat jars, different heights, with visible lids and collars.
  for(const [x,y,color] of [[-14,-20,'#a74432'],[12,-17,'#d5ac67']]){box(c,x-6,y,12,14,3,color,1.4);oval(c,x,y+13,5.7,1.8,color,1);oval(c,x,y,6.3,2.2,'#eee0be',1.1);oval(c,x,y-2,6.6,2.5,'#b98249',1.1);oval(c,x,y-4,2,1.6,'#714d30',.8);line(c,[[x-3,y+4],[x-3,y+9]],'#f4cf9d',1.2);}
  // Clearly diagonal wooden spoon in front of the jars.
  c.save();c.translate(4,-7);c.rotate(-.48);box(c,-1,-1,19,2.6,1,'#b98249',1);oval(c,-4,.5,5,3,'#d5ac67',1.1);oval(c,-4,.5,3.1,1.6,'#a47143',.5);c.restore();
 }
});return true;}
export const PERSON_BOUNDS=Object.freeze({left:-56,top:-153,right:56,bottom:2});
export function fitPerson(width=140,height=180,padding=8){if(![width,height,padding].every(Number.isFinite)||padding<0||width<=padding*2||height<=padding*2)throw new RangeError('Invalid person preview box');const b=PERSON_BOUNDS,s=Math.min((width-padding*2)/(b.right-b.left),(height-padding*2)/(b.bottom-b.top));return{x:(width-(b.right+b.left)*s)/2,y:(height-(b.bottom+b.top)*s)/2,scale:s};}
/** Candidate positions only; caller explicitly opts in. No legacy P1a layout changed. */
export function decorPlacements(width,height){if(![width,height].every(Number.isFinite)||width<=0||height<=0)throw new RangeError('Invalid scene');const u=Math.min(width/390,height/260);return[{id:'d_charcoal_chime',layer:'awning',x:width*.95,y:height*.55,scale:u},{id:'d_spice_turntable',layer:'counter',x:width*.61,y:height*.60-6*u,scale:u}];}
export function drawShopCollectibles(c,{width,height,ids=[],layer}={}){const chosen=new Set(ids),drawn=[];for(const p of decorPlacements(width,height)){if(chosen.has(p.id)&&(!layer||p.layer===layer)&&drawCollectibleDecor(c,p.id,p))drawn.push(p.id);}return drawn;}
export const CATALOG_BOUNDS=Object.freeze({c_ember_fan_mantle:[-28,-80,28,-35],c_grill_grid_tabard:[-24,-77,23,-28],h_skewer_pinwheel:[-22,-58,22,-17],h_mushroom_parasol:[-23,-56,23,-16],d_charcoal_chime:[-21,-52,21,21],d_spice_turntable:[-28,-41,28,11]});
export function drawCatalog(c,id,width=512,height=512,padding=40){const b=CATALOG_BOUNDS[id];if(!b)return false;if(![width,height,padding].every(Number.isFinite)||padding<0||width<=padding*2||height<=padding*2)throw new RangeError('Invalid catalog box');safe(c,()=>{const s=Math.min((width-2*padding)/(b[2]-b[0]),(height-2*padding)/(b[3]-b[1]));c.translate(width/2-(b[0]+b[2])*s/2,height/2-(b[1]+b[3])*s/2);c.scale(s,s);if(has('clothes',id))drawCollectibleClothes(c,id);else if(has('hats',id))drawCollectibleHat(c,id,0);else drawCollectibleDecor(c,id);});return true;}

/** Blindbox18 second eight. Pure Canvas geometry; no state, DOM, bitmap or timers.
 * Clothes run before arms/head; hats after head. All coordinates include stroke budget.
 */
export const IDS=Object.freeze({clothes:Object.freeze(['c_skewer_loop_tunic','c_smoke_split_bolero','c_pepper_scale_wrap','c_corn_rib_jacket']),hat:Object.freeze(['h_charcoal_crescent','h_grill_press','h_tin_foil_puff','h_corn_sail'])});
const types=Object.freeze(Object.fromEntries(Object.entries(IDS).flatMap(([k,v])=>v.map(id=>[id,k]))));
const INK='#302A27',TAU=Math.PI*2;
export const has=id=>Object.hasOwn(types,id);
function safe(c,fn){c.save();try{c.lineJoin='round';c.lineCap='round';fn();}finally{c.restore();}}
function paint(c,color,w=1.6){c.fillStyle=color;c.fill();if(w){c.strokeStyle=INK;c.lineWidth=w;c.stroke();}}
function line(c,pts,color=INK,w=1.3){c.beginPath();for(let i=0;i<pts.length;i++){const p=pts[i];if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);}c.strokeStyle=color;c.lineWidth=w;c.stroke();}
function poly(c,pts,color,w=1.6){c.beginPath();for(let i=0;i<pts.length;i++){const p=pts[i];if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);}c.closePath();paint(c,color,w);}
function oval(c,x,y,rx,ry,color,w=1.2){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);paint(c,color,w);}
function box(c,x,y,w,h,r,color,lw=1.4){c.beginPath();c.roundRect(x,y,w,h,r);paint(c,color,lw);}
export function withCollectibleLook(base,equipment={}){const look={...base};if(types[equipment.clothes]==='clothes')Object.assign(look,{collectibleClothes:equipment.clothes,top:'#E3D4B8',sleeve:base.sleeve||base.top,apron:null,pattern:null,inner:null,lapel:false,rocketLogo:false,hood:false,tie:false});if(types[equipment.hat]==='hat')look.hat=equipment.hat;return look;}
export function drawCollectibleClothes(c,id){if(types[id]!=='clothes')return false;safe(c,()=>{
 if(id==='c_skewer_loop_tunic'){
  c.beginPath();c.moveTo(-9,-73);c.quadraticCurveTo(-20,-74,-22,-62);c.lineTo(-20,-53);c.lineTo(-23,-33);c.quadraticCurveTo(0,-28,23,-33);c.lineTo(20,-53);c.lineTo(22,-62);c.quadraticCurveTo(20,-74,9,-73);c.quadraticCurveTo(0,-67,-9,-73);c.closePath();paint(c,'#9E4633',1.9);
  poly(c,[[-20,-64],[-25,-61],[-23,-53],[-16,-55]],'#F1B970');poly(c,[[20,-64],[25,-61],[23,-53],[16,-55]],'#F1B970');
  c.beginPath();c.moveTo(8,-71);c.bezierCurveTo(-7,-65,9,-49,-8,-32);c.strokeStyle='#4E342B';c.lineWidth=3;c.stroke();c.strokeStyle='#F1B970';c.lineWidth=1;c.stroke();
  for(const y of [-62,-53,-44]){line(c,[[-7,y],[7,y]],'#4E342B',2.5);oval(c,-4,y,2.3,2.3,'#F1B970',.8);oval(c,4,y,2.3,2.3,'#F1B970',.8);}
  c.beginPath();c.moveTo(-18,-34);c.quadraticCurveTo(0,-31,18,-34);c.strokeStyle='#F1B970';c.lineWidth=1.2;c.stroke();
 }else if(id==='c_smoke_split_bolero'){
  // Curved crescent tails have empty inner notches; no straight swallowtail.
  for(const side of [-1,1])safe(c,()=>{c.scale(side,1);c.beginPath();c.moveTo(7,-57);c.bezierCurveTo(10,-47,9,-37,24,-36);c.bezierCurveTo(20,-32,10,-30,5,-41);c.quadraticCurveTo(0,-52,7,-57);c.closePath();paint(c,'#6B6262',1.8);
   c.beginPath();c.moveTo(7,-54);c.bezierCurveTo(11,-46,9,-39,21,-36);c.strokeStyle='#B9ABA0';c.lineWidth=2;c.stroke();});
  c.beginPath();c.moveTo(-8,-73);c.bezierCurveTo(-18,-75,-24,-65,-23,-55);c.quadraticCurveTo(-16,-49,-8,-53);c.quadraticCurveTo(0,-48,8,-53);c.quadraticCurveTo(16,-49,23,-55);c.bezierCurveTo(24,-65,18,-75,8,-73);c.quadraticCurveTo(0,-69,-8,-73);c.closePath();paint(c,'#6B6262',1.8);
  c.beginPath();c.moveTo(-21,-55);c.quadraticCurveTo(-16,-51,-11,-55);c.quadraticCurveTo(-5,-51,0,-53);c.quadraticCurveTo(5,-51,11,-55);c.quadraticCurveTo(16,-51,21,-55);c.strokeStyle='#B9ABA0';c.lineWidth=2;c.stroke();
  oval(c,0,-70,6,3,'#E3D4B8',1.3);oval(c,0,-70,3.4,1.2,'#6B6262',.7);
 }else if(id==='c_pepper_scale_wrap'){
  poly(c,[[-12,-74],[5,-66],[20,-63],[22,-36],[10,-32],[-19,-38],[-21,-62]],'#4B5940',1.8);
  // Bottom to top: semicircular edges extend past the next layer to form the silhouette.
  for(let row=2;row>=0;row--){for(let col=0;col<3;col++){const x=-13+col*12,y=-67+row*10+col*3;c.beginPath();c.moveTo(x-6,y);c.lineTo(x+6,y);c.lineTo(x+6,y+3);c.quadraticCurveTo(x+5,y+11,x,y+11);c.quadraticCurveTo(x-6,y+9,x-6,y+3);c.closePath();paint(c,'#AC3C2C',1.3);oval(c,x,y+5,1.6,1.6,'#E6BA72',.6);}}
  poly(c,[[-14,-75],[-7,-73],[20,-59],[17,-53]],'#E6BA72',1.5);line(c,[[-10,-71],[16,-57]],'#4B5940',1);
  oval(c,19,-41,4.5,3.3,'#E6BA72',1.4);oval(c,19,-41,1.9,1.2,'#4B5940',.6);
 }else{
  c.beginPath();c.moveTo(-11,-73);c.lineTo(11,-73);c.quadraticCurveTo(22,-72,22,-61);c.lineTo(20,-39);c.quadraticCurveTo(18,-34,14,-34);c.lineTo(-14,-34);c.quadraticCurveTo(-18,-34,-20,-39);c.lineTo(-22,-61);c.quadraticCurveTo(-22,-72,-11,-73);c.closePath();paint(c,'#EDBC4E',1.9);
  for(const side of [-1,1])for(let i=0;i<3;i++){const x=side*(6+i*5);box(c,x-1.8,-63+i,3.6,21-i*2,1.8,'#EDBC4E',.9);}
  line(c,[[0,-67],[0,-36]],'#6A5334',1.3);
  poly(c,[[-11,-73],[-1,-68],[-8,-62]],'#7E9B56',1.4);poly(c,[[11,-73],[1,-68],[8,-62]],'#7E9B56',1.4);
  box(c,-18,-40,36,5,1.4,'#7E9B56',1.3);box(c,-3,-40,6,5,1,'#EDBC4E',1);line(c,[[0,-39],[0,-36]],'#6A5334',.8);
 }
});return true;}
export function drawCollectibleHat(c,id,hy=-92){if(types[id]!=='hat')return false;if(!Number.isFinite(hy))throw new RangeError('Invalid head anchor');safe(c,()=>{c.translate(0,hy);
 if(id==='h_charcoal_crescent'){
  for(const [x,y,r] of [[-10,-37,-.12],[0,-40,.08],[10,-36,.16]])safe(c,()=>{c.translate(x,y);c.rotate(r);box(c,-5,-5,10,9,2,'#24252B',1.4);line(c,[[-3,-2],[0,0],[-1,2],[2,3]],'#E8924A',.9);});
  c.beginPath();c.moveTo(-21,-37);c.quadraticCurveTo(0,-25,21,-37);c.bezierCurveTo(19,-22,7,-21,0,-22);c.bezierCurveTo(-8,-21,-19,-24,-21,-37);c.closePath();paint(c,'#41434A',1.8);
  for(let i=0;i<4;i++)line(c,[[-10+i*1.5,-32+i*2.3],[10-i*1.5,-32+i*2.3]],'#8E969D',1.2);
 }else if(id==='h_grill_press'){
  // Back wider than front, rounded pressure plate; short posts hold a hollow handle.
  c.beginPath();c.moveTo(-16,-36);c.quadraticCurveTo(-20,-36,-19,-32);c.lineTo(-14,-23);c.quadraticCurveTo(-13,-21,-10,-21);c.lineTo(10,-21);c.quadraticCurveTo(13,-21,14,-23);c.lineTo(19,-32);c.quadraticCurveTo(20,-36,16,-36);c.closePath();paint(c,'#747E83',1.8);
  line(c,[[-13,-24],[12,-24]],'#B7BEC1',1.2);for(const x of [-7,0,7])line(c,[[x,-25],[x+2,-22]],'#C77D47',1.6);
  box(c,-11,-39,5,8,1,'#363D43',1.2);box(c,6,-39,5,8,1,'#363D43',1.2);
  c.beginPath();c.moveTo(-8.5,-37);c.lineTo(-8.5,-44);c.bezierCurveTo(-8.5,-54,8.5,-54,8.5,-44);c.lineTo(8.5,-37);c.strokeStyle=INK;c.lineWidth=7;c.stroke();c.strokeStyle='#363D43';c.lineWidth=4.5;c.stroke();
  c.beginPath();c.moveTo(-9,-44);c.quadraticCurveTo(-8,-50,-3,-50);c.strokeStyle='#B7BEC1';c.lineWidth=1;c.stroke();
 }else if(id==='h_tin_foil_puff'){
  c.beginPath();c.moveTo(-15,-24);c.bezierCurveTo(-22,-29,-18,-36,-13,-37);c.bezierCurveTo(-17,-44,-8,-47,-4,-43);c.bezierCurveTo(1,-48,8,-44,10,-40);c.bezierCurveTo(17,-41,21,-34,16,-31);c.bezierCurveTo(20,-26,12,-21,7,-23);c.bezierCurveTo(0,-19,-10,-20,-15,-24);c.closePath();paint(c,'#D9E1E5',1.8);
  poly(c,[[-5,-41],[-9,-49],[-2,-46],[1,-52],[5,-45],[10,-48],[7,-40]],'#D9E1E5',1.5);
  poly(c,[[-14,-35],[-4,-41],[-9,-25]],'#F8FBFC',0);poly(c,[[-4,-41],[0,-24],[-9,-25]],'#8D9EA8',0);poly(c,[[1,-40],[13,-35],[5,-27]],'#F8FBFC',0);poly(c,[[13,-35],[15,-27],[5,-27]],'#66747D',0);
  line(c,[[-3,-45],[1,-40],[5,-44]],'#66747D',1);
  c.beginPath();c.moveTo(-11,-24);c.quadraticCurveTo(0,-21,11,-25);c.strokeStyle='#66747D';c.lineWidth=1.4;c.stroke();
 }else{
  // Narrow high rear leaf and broad outward left leaf; neither descends onto cheeks.
  c.beginPath();c.moveTo(3,-23);c.bezierCurveTo(6,-39,11,-50,16,-55);c.quadraticCurveTo(20,-35,9,-24);c.closePath();paint(c,'#47794D',1.6);line(c,[[8,-28],[15,-48]],'#80A764',1);
  c.beginPath();c.moveTo(-8,-24);c.lineTo(-8,-39);c.bezierCurveTo(-8,-49,8,-49,8,-39);c.lineTo(8,-24);c.quadraticCurveTo(0,-20,-8,-24);c.closePath();paint(c,'#EDBD46',1.6);
  for(let col=0;col<3;col++)for(let row=0;row<4;row++)oval(c,-4.5+col*4.5,-40+row*4.5,1.8,1.7,'#FFE191',.55);
  c.beginPath();c.moveTo(-5,-23);c.bezierCurveTo(-17,-25,-21,-35,-21,-43);c.bezierCurveTo(-9,-40,-6,-32,0,-24);c.closePath();paint(c,'#80A764',1.7);
  c.beginPath();c.moveTo(-16,-37);c.quadraticCurveTo(-13,-29,-5,-25);c.strokeStyle='#47794D';c.lineWidth=1.2;c.stroke();
 }
});return true;}
export const PERSON_BOUNDS=Object.freeze({left:-56,top:-153,right:56,bottom:2});
export const CATALOG_BOUNDS=Object.freeze(Object.fromEntries([...IDS.clothes.map(id=>[id,Object.freeze([-28,-80,28,-28])]),...IDS.hat.map(id=>[id,Object.freeze([-23,-58,23,-17])])]));
export function drawCatalog(c,id,width=512,height=512,padding=40){if(!has(id))return false;const b=CATALOG_BOUNDS[id];if(![width,height,padding].every(Number.isFinite)||padding<0||width<=padding*2||height<=padding*2)throw new RangeError('Invalid catalog box');safe(c,()=>{const s=Math.min((width-2*padding)/(b[2]-b[0]),(height-2*padding)/(b[3]-b[1]));c.translate(width/2-(b[0]+b[2])*s/2,height/2-(b[1]+b[3])*s/2);c.scale(s,s);if(types[id]==='clothes')drawCollectibleClothes(c,id);else drawCollectibleHat(c,id,0);});return true;}

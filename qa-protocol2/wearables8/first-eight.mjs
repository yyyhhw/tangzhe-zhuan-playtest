/** Pure drawing recipes for the first eight collectibles.
 * No DOM, loading, timers, random values, game state, ownership, or persistence.
 * Person-local coordinates match app.js at 90641bc: feet y=0, torso -72..-36,
 * head center y=-92. Call clothes before arms/head; hats after hair/face.
 */
const INK = '#141414';
const TAU = Math.PI * 2;
export const VISUAL_IDS = Object.freeze({
  clothes: Object.freeze(['c_charcoal_vest', 'c_matcha_knit']),
  hats: Object.freeze(['h_guokui', 'h_antenna_clip']),
  decor: Object.freeze(['d_borrow_register', 'd_rocket_piggy', 'd_opening_photo', 'd_ward_charm']),
});
const has = (kind, id) => VISUAL_IDS[kind].includes(id);
function stroke(c, color = INK, width = 1.5) { c.strokeStyle = color; c.lineWidth = width; c.stroke(); }
function fill(c, color, width = 1.8) { c.fillStyle = color; c.fill(); if (width) stroke(c, INK, width); }
function path(c, points, close = false) {
  c.beginPath(); points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); if(close)c.closePath();
}
function ellipse(c,x,y,rx,ry,color,width=1.5,rotation=0) {
  c.beginPath(); c.ellipse(x,y,rx,ry,rotation,0,TAU); fill(c,color,width);
}
function rect(c,x,y,w,h,r,color,width=1.5) {
  c.beginPath(); if(c.roundRect)c.roundRect(x,y,w,h,r);else c.rect(x,y,w,h); fill(c,color,width);
}
function isolated(c, draw) { c.save(); try { c.lineJoin='round'; c.lineCap='round'; draw(); } finally { c.restore(); } }

/** Return a new look, keeping CEO identity, sleeves, trousers and shoes intact.
 * Unknown/legacy equipment is deliberately ignored by this extension.
 * A caller can run the existing legacy resolver first, then this function.
 */
export function withCollectibleLook(base, equipment = {}) {
  const look = {...base};
  if (has('clothes', equipment.clothes)) Object.assign(look, {
    collectibleClothes: equipment.clothes, top:'#f5ebd5', sleeve:base.sleeve || base.top,
    apron:null, pattern:null, inner:null, lapel:false, rocketLogo:false, hood:false, tie:false,
  });
  if (has('hats', equipment.hat)) look.hat = equipment.hat;
  return look;
}

export function drawCollectibleClothes(c, id) {
  if (!has('clothes',id)) return false;
  isolated(c, () => {
    if (id === 'c_charcoal_vest') {
      // Independent short vest silhouette, with a V neck and split lower hem.
      path(c,[[-12,-72],[-7,-70],[0,-58],[7,-70],[12,-72],[17,-64],[16,-57],[20,-37],[6,-35],[0,-39],[-6,-35],[-20,-37],[-16,-57],[-17,-64]],true); fill(c,'#45423d',2.1);
      path(c,[[9,-69],[14,-61],[14,-55],[18,-39],[12,-38],[10,-53]],true); fill(c,'#33332f',0);
      path(c,[[-11,-70],[0,-57],[11,-70]]); stroke(c,'#c4ad87',1.2);
      path(c,[[0,-57],[0,-39]]); stroke(c,'#b59d77',1.1);
      path(c,[[-18,-39],[-6,-37],[0,-41],[6,-37],[18,-39]]); stroke(c,'#ad9673',.8);
      for(const side of [-1,1]) {
        const x=side<0?-15:5;
        rect(c,x,-49,10,10,2,'#595148',1.1);
        path(c,[[x+1,-47],[x+9,-47]]);stroke(c,'#c4ad87',.9);
      }
      for(const y of [-55,-49,-43,-37.8]) { ellipse(c,.2,y,1.7,1.7,'#b67b3e',.8); ellipse(c,.2,y,.38,.38,INK,0); }
    } else {
      // Thick sleeveless knit, distinct ribbed edges and three cable columns.
      path(c,[[-12,-72],[-6,-70],[0,-59],[6,-70],[12,-72],[17,-62],[17,-55],[20,-37],[15,-34],[-15,-34],[-20,-37],[-17,-55],[-17,-62]],true);fill(c,'#869365',2.1);
      path(c,[[12,-68],[15,-58],[17,-38],[11,-37],[9,-56]],true);fill(c,'#6b7a50',0);
      for(const x of [-11,0,11]) {
        const start=x===0?-54:-61;
        for(let y=start;y<-40;y+=6) {
          c.beginPath();c.moveTo(x-1.7,y);c.bezierCurveTo(x+4,y+2,x-4,y+4,x+1.7,y+6);stroke(c,'#617247',3.3);
          c.beginPath();c.moveTo(x-1.7,y);c.bezierCurveTo(x+3,y+2,x-3,y+4,x+1.7,y+6);stroke(c,'#b6bf85',1.6);
        }
      }
      path(c,[[-11,-71],[0,-57],[11,-71]]);stroke(c,INK,5.5);stroke(c,'#e1d8ba',3.8);
      for(const side of [-1,1]) { path(c,[[side*14,-68],[side*15,-59],[side*18,-54]]);stroke(c,'#e1d8ba',2.5); }
      rect(c,-18,-40,36,5.5,1.5,'#e1d8ba',1.3);
      for(let x=-15;x<=15;x+=3) {path(c,[[x,-39],[x,-35.5]]);stroke(c,'#98a371',.9);}
    }
  });
  return true;
}

export function drawCollectibleHat(c,id,hy=-92) {
  if (!has('hats',id)) return false;
  if (!Number.isFinite(hy)) throw new RangeError('Invalid head anchor');
  isolated(c,()=>{
    c.translate(0,hy);
    if(id==='h_guokui') {
      // Puffy, segmented bread cap. Its lowest point stays above the eyes.
      c.translate(0,-2); // Clear the full upper glasses stroke, including antialiasing.
      c.beginPath();c.moveTo(-23,-13);c.bezierCurveTo(-30,-22,-20,-34,-8,-33);c.bezierCurveTo(-3,-39,10,-36,13,-32);c.bezierCurveTo(25,-32,29,-20,24,-12);c.quadraticCurveTo(3,-7,-23,-13);c.closePath();fill(c,'#edd298',2.4);
      c.beginPath();c.moveTo(-23,-13);c.quadraticCurveTo(-7,-21,9,-12);c.quadraticCurveTo(15,-9,20,-10);c.quadraticCurveTo(4,-3,-12,-9);c.quadraticCurveTo(-23,-6,-28,-10);c.closePath();fill(c,'#d2aa64',2);
      for(const x of [-17,-5,12,22]) {c.beginPath();c.moveTo(0,-33);c.quadraticCurveTo(x,-30,x,-15);stroke(c,'#be945d',1.1);}
      ellipse(c,0,-34,3.8,2.2,'#e9c78c',1.2);
      for(const [x,y,a] of [[-18,-23,.4],[-11,-27,-.4],[-4,-24,.3],[7,-26,-.2],[15,-24,.4],[20,-19,-.3],[-10,-18,.2],[6,-18,-.5]])ellipse(c,x,y,1.5,.75,'#b97c43',0,a);
      c.beginPath();c.moveTo(-24,-11);c.quadraticCurveTo(-11,-16,1,-10);stroke(c,'#f8e4b8',1.1);
    }else {
      // Temple clip with a teal circuit plate, curved spring and orange bulb.
      c.save();c.translate(-15,-16);c.rotate(-.36);
      ellipse(c,0,0,10.2,3.8,'#c89851',1.7);
      ellipse(c,1,-1,7.4,3,'#548d8a',1.1);
      path(c,[[-4,-1],[-1,1],[3,-1],[5,0]]);stroke(c,'#e7b974',.9);
      ellipse(c,-4,-1,1,1,'#ec9b46',.5);ellipse(c,3,-1,1,1,'#ec9b46',.5);c.restore();
      c.beginPath();c.moveTo(-16,-20);c.bezierCurveTo(-28,-23,-24,-34,-19,-36);stroke(c,INK,4);stroke(c,'#c89851',2.1);
      for(const [x,y] of [[-20,-23],[-23,-27],[-23,-31]]){path(c,[[x-2,y-.5],[x+2,y+1]]);stroke(c,'#f5d693',1.1);}
      ellipse(c,-17,-39,5.2,5.2,'#e79225',1.7);ellipse(c,-18.5,-40.8,1.5,1.1,'#ffe4a2',0);
    }
  });return true;
}

// A conservative footprint includes raised wave arms, ponytail and antenna.
export const PERSON_BOUNDS=Object.freeze({left:-56,top:-138,right:56,bottom:2});
export function fitPerson(width=140,height=160,padding=8) {
  if(![width,height,padding].every(Number.isFinite)||width<=padding*2||height<=padding*2||padding<0)throw new RangeError('Invalid person preview box');
  const b=PERSON_BOUNDS,scale=Math.min((width-2*padding)/(b.right-b.left),(height-2*padding)/(b.bottom-b.top));
  return {x:(width-(b.right+b.left)*scale)/2,y:(height-(b.bottom+b.top)*scale)/2,scale};
}

function drawRegister(c) {
  path(c,[[-22,-12],[-3,-17],[1,-15],[20,-17],[23,0],[2,3],[-1,1],[-20,3]],true);fill(c,'#4c7163',1.7);
  path(c,[[-20,-13],[-3,-17],[0,-14],[2,-16],[18,-18],[20,-2],[2,1],[0,-1],[-18,1]],true);fill(c,'#e2d3ac',1.1);
  for(let y=-11;y<=-3;y+=3){path(c,[[-17,y],[-3,y-2]]);stroke(c,'#b9a680',.6);path(c,[[4,y-2],[17,y-4]]);stroke(c,'#b9a680',.6);}
  for(const x of [-13,-6,8,13]){path(c,[[x,-13],[x+1,-2]]);stroke(c,'#b9a680',.45);}
  path(c,[[0,-14],[1,0]]);stroke(c,'#957346',1);
  path(c,[[2,1],[3,5],[8,6],[7,9],[1,6],[0,2]],true);fill(c,'#af5147',.7);
  // Pen stays in the center gutter, as in the approved reference image.
  path(c,[[0,-15],[1,-4]]);stroke(c,INK,3);stroke(c,'#bf964c',1.9);
  path(c,[[.2,-13],[.7,-7]]);stroke(c,'#315e51',1.5);
  path(c,[[.8,-4],[1.2,-1],[2,-4]],true);fill(c,'#dbc18c',.5);
}
function drawRocket(c) {
  for(const side of [-1,1]){c.beginPath();c.moveTo(side*6,-15);c.quadraticCurveTo(side*14,-12,side*13,-1);c.lineTo(side*7,-4);c.closePath();fill(c,'#cd6f44',1.5);}
  c.beginPath();c.moveTo(0,-34);c.bezierCurveTo(10,-29,12,-13,9,-4);c.quadraticCurveTo(0,2,-9,-4);c.bezierCurveTo(-12,-13,-10,-29,0,-34);c.closePath();fill(c,'#e4d7b7',1.8);
  c.beginPath();c.moveTo(0,-34);c.quadraticCurveTo(6,-31,7,-25);c.quadraticCurveTo(0,-22,-7,-25);c.quadraticCurveTo(-5,-32,0,-34);c.closePath();fill(c,'#cd6f44',1.3);
  path(c,[[4,-23],[7,-25]]);stroke(c,INK,1.7);
  ellipse(c,0,-17,5.7,5.9,'#c89851',1.2);ellipse(c,0,-17,4.2,4.4,'#638e91',1);ellipse(c,-1.5,-18.5,1,1.5,'#c1dfdb',0);
  path(c,[[-8,-6],[0,-4],[8,-6]]);stroke(c,'#c89851',1.6);
  c.beginPath();c.moveTo(-1,-10);c.quadraticCurveTo(4,-4,1,3);c.quadraticCurveTo(-4,1,-4,-3);c.closePath();fill(c,'#cd6f44',1.2);
}
function drawCharm(c) {
  c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-15,-13,-15,4,0,5);c.quadraticCurveTo(5,3,0,0);stroke(c,INK,3);stroke(c,'#b74e46',1.7);
  ellipse(c,0,6,2.3,2.3,'#c39a54',1);
  path(c,[[0,9],[-5,7],[-4,13],[-10,17],[-9,28],[0,31],[9,28],[10,17],[4,13],[5,7]],true);fill(c,'#4e8f8b',1.6);
  path(c,[[-4,13],[0,9],[4,13]]);stroke(c,'#224b4b',1.3);
  path(c,[[-6,18],[0,15],[6,18],[5,25],[0,28],[-5,25]],true);fill(c,'#c39a54',.9);
  path(c,[[0,25],[0,19],[-3,18]]);stroke(c,'#69522e',.8);path(c,[[2,25],[3,21],[4,20]]);stroke(c,'#69522e',.8);
  for(const side of [-1,1])for(const y of [18,23,27]){path(c,[[side*8,y],[side*6,y-1.5]]);stroke(c,'#dab76c',.75);}
  path(c,[[0,31],[0,34]]);stroke(c,'#b74e46',1.3);ellipse(c,0,36,4.3,4.3,'#c39a54',1.1);
  path(c,[[-3,37],[3,37]]);stroke(c,'#775a2b',.8);
  for(const x of [-4,-2,0,2,4]){path(c,[[0,40],[x,48]]);stroke(c,INK,2.1);stroke(c,'#b74e46',1.2);}
}

/** Draw at item-local anchor. Photo requires the caller's already-loaded image.
 * Image loading and any shared-state decisions remain outside this module.
 */
export function drawCollectibleDecor(c,id,{x=0,y=0,scale=1,photoImage=null}={}) {
  if(!has('decor',id))return false;
  if(![x,y,scale].every(Number.isFinite)||scale<=0)throw new RangeError('Invalid decor transform');
  if(id==='d_opening_photo'&&!photoImage)return false;
  isolated(c,()=>{
    c.translate(x,y);c.scale(scale,scale);
    if(id==='d_borrow_register')drawRegister(c);
    else if(id==='d_rocket_piggy')drawRocket(c);
    else if(id==='d_ward_charm')drawCharm(c);
    else c.drawImage(photoImage,-29,-44,58,58);
  });return true;
}

/** Layout is visual-only. The caller explicitly supplies which IDs to draw. */
export function decorPlacements(width,height) {
  if(![width,height].every(Number.isFinite)||width<=0||height<=0)throw new RangeError('Invalid scene box');
  const u=Math.min(height/260,width/360),cy=height*.6,ground=height*.87;
  return [
    {id:'d_opening_photo',slot:'wall_accent',layer:'wall',x:width*.66,y:cy-28*u,scale:u},
    {id:'d_ward_charm',slot:'awning_accent',layer:'awning',x:width*.94,y:height*.30,scale:u},
    {id:'d_borrow_register',slot:'counter_accent',layer:'counter',x:width*.51,y:cy-8*u,scale:u},
    {id:'d_rocket_piggy',slot:'shelf_accent',layer:'counter-front',x:width*.44,y:ground-25*u,scale:u},
  ];
}

export function drawShopCollectibles(c,{width,height,ids=[],layer,photoImage=null}={}) {
  const chosen=new Set(ids),drawn=[];
  for(const p of decorPlacements(width,height)) {
    if(!chosen.has(p.id)||(layer&&p.layer!==layer))continue;
    if(p.id==='d_rocket_piggy')isolated(c,()=>rect(c,p.x-16*p.scale,p.y+4*p.scale,32*p.scale,4*p.scale,1,'#b18b64',1.2*p.scale));
    if(drawCollectibleDecor(c,p.id,{...p,photoImage}))drawn.push(p.id);
  }
  return drawn;
}

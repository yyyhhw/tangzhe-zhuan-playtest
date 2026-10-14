/** Owned shop presentation; loading is bounded to six images once per page. */
import {DECOR6,HIDDEN_DECOR6} from './decor6-catalog.mjs?v=xingtuv2-4-20261014-r1';
import {hiddenEligibility} from './decor6-grants.mjs?v=xingtuv2-4-20261014-r1';
const byId=Object.fromEntries(DECOR6.map(x=>[x.id,x]));
const descriptions={d_borrow_register:'摊开的绿皮登记本，钢笔放在书页中央。',d_rocket_piggy:'小火箭上部一道投币口，把零钱存进下一次发射。',d_opening_photo:'四家店一起开张，合影留下这一刻。',d_ward_charm:'红绳系着护身符，记下通关第10关的勇气。',d_charcoal_chime:'炭篓下挂着长短不同的铜管，风来时轻轻作响。',d_spice_turntable:'铜边调料转盘，盘上斜放一把小勺。'};
const paths=Object.fromEntries(DECOR6.map(x=>[x.id,new URL('../art/collectibles/'+x.id+(['d_charcoal_chime','d_spice_turntable'].includes(x.id)?'.png':'_catalog_v1.webp')+'?v=xingtuv2-4-20261014-r1',import.meta.url).href]));
const images=new Map();
const has=id=>Object.hasOwn(byId,id);
function iconHTML(id){return `<span class="item-art"><img data-item-art="${id}" src="${paths[id]}" alt="${descriptions[id]}"><span class="item-art-status" hidden>图示暂不可用</span></span>`;}
function hiddenHTML(state){return `<div class="sec-title">隐藏店铺装饰（条件领取，不在随机池）</div>`+HIDDEN_DECOR6.map(item=>{
  const owned=state.gacha.owned.includes(item.id),eligible=hiddenEligibility(state,item.id).eligible;
  return `<div class="card decor-card" data-hidden-decor="${item.id}"><div class="ava sq">${owned?iconHTML(item.id):'❓'}</div><div class="info"><div class="name">${item.name}</div><div class="desc">${item.unlock} · 不扣金币${owned?' · 已拥有':''}</div></div>${owned?'':`<button class="buy" data-act="claimHidden" data-arg="${item.id}" ${eligible?'':'disabled'}>${eligible?'领取':'未达成'}</button>`}</div>`;
}).join('');}
/** Positions use the actual host layout. No separate simplified shop canvas. */
function placements(W,l,U){return [
  // 开业合影挂在招牌左侧的空墙上（旧位置 counterY-78U 正好压在雨棚花边上，混在红白条纹里看不出来）。
  {id:'d_opening_photo',x:W*.075,y:l.signY+l.signH*.47,size:Math.min(34*U,W*.12),frame:true},
  {id:'d_ward_charm',x:W*.94,y:l.counterY-98*U,size:30*U},
  {id:'d_borrow_register',x:W*.48,y:l.counterY-44*U,size:32*U},
  {id:'d_rocket_piggy',x:W*.68,y:l.counterY-54*U,size:34*U},
  {id:'d_charcoal_chime',x:W*.18,y:l.counterY-98*U,size:36*U},
  {id:'d_spice_turntable',x:W*.81,y:l.counterY-90*U,size:32*U},
];}
function draw(c,state,W,l,U){
  if(!state.shops[state.cur]?.open)return;
  for(const p of placements(W,l,U)){
    if(!state.gacha.owned.includes(p.id)||state.decorHidden.includes(p.id))continue;
    let image=images.get(p.id);
    if(!image){image=new Image();images.set(p.id,image);image.src=paths[p.id];}
    if(!(image.complete&&image.naturalWidth))continue;
    if(p.frame){const m=p.size*.09;c.save();c.translate(p.x,p.y);c.rotate(-.05);c.fillStyle='rgba(0,0,0,.18)';c.fillRect(-p.size/2-m+2*U,-p.size/2-m+2*U,p.size+2*m,p.size+2*m);
      c.fillStyle='#fff';c.strokeStyle='#2b2118';c.lineWidth=1.6*U;c.fillRect(-p.size/2-m,-p.size/2-m,p.size+2*m,p.size+2*m);c.strokeRect(-p.size/2-m,-p.size/2-m,p.size+2*m,p.size+2*m);
      c.drawImage(image,-p.size/2,-p.size/2,p.size,p.size);c.restore();continue;}
    c.drawImage(image,p.x-p.size/2,p.y-p.size/2,p.size,p.size);
  }
}
export default Object.freeze({has,iconHTML,hiddenHTML,draw,placements,descriptions});

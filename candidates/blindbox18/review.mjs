import '../../home-interaction.js?v=bb70-launch-notice-20261013-r2';
import display from './display.mjs?v=bb70-launch-notice-20261013-r2';
import baseDisplay from '../../qa-protocol2/wearables8-display.mjs?v=bb70-launch-notice-20261013-r2';
import {ITEMS} from './catalog.mjs?v=bb70-launch-notice-20261013-r2';
import * as render from './render.mjs?v=bb70-launch-notice-20261013-r2';
import {EIGHT_WEARABLES} from '../../qa-protocol2/eight-catalog.mjs?v=bb70-launch-notice-20261013-r2';
const source=await (await fetch('../../app.js')).text();
// Execute the actual shipped person implementation, with only explicit dependency injection.
const looks=source.slice(source.indexOf('const LOOKS ='),source.indexOf('const CLOTHES ='));
const person=source.slice(source.indexOf('function shadeHex('),source.indexOf('// 头像（缓存成图片给卡片用）'));
// Helpers have a stable one-line implementation; do not execute scene/bootstrap code.
const rr=source.match(/function rr\([^\n]+/)[0],ink=source.match(/function inkFill\([^\n]+/)[0];
function renderer(adapter){return new Function('WEARABLES8',`const INK='#141414',RED='#e63946',YELLOW='#ffd23f',TAU=Math.PI*2;${rr}\n${ink}\n${looks}\n${person}\nreturn {drawPerson,drawHead,LOOKS};`)(adapter);}
const actual=renderer(display),old=renderer(baseDisplay);
const E={ITEM_BY_ID:Object.fromEntries([...EIGHT_WEARABLES,...ITEMS].map(it=>[it.id,it]))};
const who=['c77','pearl','otaku','rocket'];
function state(eq){return {gacha:{owned:[...EIGHT_WEARABLES,...ITEMS].map(it=>it.id)},wear:Object.fromEntries(who.map(id=>[id,{...eq}]))};}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function card(parent,title){const node=document.createElement('div');node.className='card';const label=document.createElement('strong');label.textContent=title;node.append(label);parent.append(node);return node;}
function personCanvas(id,eq,pose='wave',w=140,h=160){const c=canvas(w,h),fit=display.fitPerson(w,h,8);actual.drawPerson(c.getContext('2d'),fit.x,fit.y,fit.scale,display.look(actual.LOOKS[id],E,state(eq),id),{pose,t:0});return c;}
for(const it of ITEMS){const node=card(document.querySelector('#catalog'),it.name),c=canvas(512,512);render.drawCatalog(c.getContext('2d'),it.id);c.style.width='180px';node.append(c);const thumbs=document.createElement('div');for(const size of [12,24,32]){const t=canvas(size,size);t.getContext('2d').drawImage(c,0,0,size,size);thumbs.append(t);}node.append(thumbs);
 const people=card(document.querySelector('#wardrobe'),it.name);for(const id of who){const d=document.createElement('div');d.textContent=id;d.append(personCanvas(id,{[it.type]:it.id}));people.append(d);}
 const copy=card(document.querySelector('#copy'),it.id);copy.innerHTML+=display.catalogHTML(E,state({}),it.id)+display.catalogHTML(E,{gacha:{owned:[]}},it.id);
}
const select=document.querySelector('#choice');for(let i=0;i<4;i++){const o=document.createElement('option');o.value=i;o.textContent=ITEMS[i].name+' + '+ITEMS[i+4].name;select.append(o);}
function poses(){const i=Number(select.value),eq={clothes:ITEMS[i].id,hat:ITEMS[i+4].id},root=document.querySelector('#pose');root.replaceChildren();for(const id of who)for(const pose of ['sit','lie']){const c=canvas(352,352);HomeInteraction.drawPose(c.getContext('2d'),actual.drawPerson,display.look(actual.LOOKS[id],E,state(eq),id),pose,undefined,{candidateVisual:true});const d=document.createElement('div');d.textContent=id+' '+pose;d.append(c);root.append(d);}const c=document.querySelector('#scene'),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);for(let j=0;j<4;j++)actual.drawPerson(ctx,(j+.5)*c.width/4,235,1.2,display.look(actual.LOOKS[who[j]],E,state(eq),who[j]),{pose:'work',t:.5});}
select.onchange=poses;poses();
window.review={display,baseDisplay,render,ITEMS,EIGHT_WEARABLES,actual,old,E,state,who,canvas,personCanvas,poses};window.reviewReady=true;

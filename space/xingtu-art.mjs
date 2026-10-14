/** 星途 v2：从王大妈 demo（wangdama/xingtu-demo + xingtu-4post-mock fd614ae）原样搬来的画面与数值。纯函数生成 SVG 字符串，不碰存档。 */
/* eslint-disable */
let S=null;
const SYS = [
  {k:'life', ceo:'77',     abbr:'77', sys:'生活', color:'var(--life)', hex:'#c8743a', stat:'探索点', job:'补给、伙食、舱内环境'},
  {k:'med',  ceo:'珍珠姐', abbr:'珠', sys:'医疗', color:'var(--med)',  hex:'#e58aa8', stat:'坏事件化解', job:'船员状态、突发事件善后'},
  {k:'war',  ceo:'阿宅店长',abbr:'宅', sys:'战斗', color:'var(--war)',  hex:'#6b4fd8', stat:'遭遇战胜率', job:'海盗、陨石、未知生物'},
  {k:'tech', ceo:'火箭老板',abbr:'箭', sys:'科技', color:'var(--tech)', hex:'#2f6fb5', stat:'航程缩短 · 雷达', job:'引擎、扫描、雷达'},
];
const SYSK = {}; SYS.forEach(s => SYSK[s.k] = s);
const LV_COST = [20, 60, 150, 400];                     // 探索点：1→2 … 4→5
const ITEMS = {
  life:['保温饭盒','太空泡面机','舱内小菜园','循环厨房','星际火锅舱'],
  med: ['急救包','珍珠营养液','睡眠舱','纳米医疗床','全息诊疗室'],
  war: ['弹弓炮','漫画护盾','分镜激光','热血主炮','名场面歼星炮'],
  tech:['小推进器','离子引擎','曲率雷达','跃迁核心','人造太阳引擎'],
};
const RING = ['近地轨道','内行星','小行星带','外行星','星系边缘'];
const RING_SUM = [4, 7, 11, 15, 19];
const RING_MIN = [1, 2, 3, 4, 4];   // 杨总 10/14 22:24：出航需要四个岗位科研——每一圈要求四个岗位科研都达到这一级
const POST = {tech:'舰桥',war:'炮舱',med:'医务室',life:'厨房'};
const ORDER = ['tech','war','med','life'];
const ROUTES = [
  {id:'moon', name:'月面基地', ring:0, time:'30 分钟', sec:6, pts:[8,12],
    cards:[['月面第一串','77 在月坑边支起烤架：“低重力，孜然撒得特别匀。”'],['月球车代驾','火箭老板开月球车，珍珠姐坐后座记账。'],['地球升起','四个人坐在月坑边，看地球从地平线上慢慢升起来。']],
    hid:{name:'旧时代的国旗', hint:'带着雷达去，看看月坑背面。', ok:s=>stat(s,'radar')>0}},
  {id:'station', name:'空间站废墟', ring:0, time:'30 分钟', sec:6, pts:[8,12],
    cards:[['废墟里的工位','阿宅在旧工位抽屉里翻出半包薯片。'],['漂浮的便利贴','便利贴上写着：“下班前记得关灯。”没人关。'],['重新通电','珍珠姐按下开关，空间站亮了一整层楼。']],
    hid:{name:'漂浮的工牌', hint:'有人在废墟里受了伤，医疗够好才敢进去。', ok:s=>s.lv.med>=2}},
  {id:'mars', name:'火星峡谷', ring:1, need:['tech',2], time:'1 小时', sec:8, pts:[20,30],
    cards:[['红色峡谷','火箭老板：“我说过，要把小店送上火星。”'],['火星外卖','第一单送到时，风沙把奶茶吹成了沙冰。'],['外星：峡谷里的邻居','峡谷里住着一群圆滚滚的火星人，用矿石包下了全部烤串。']],
    hid:{name:'火星第一串', hint:'在红色的风里，要有人记得带上烤架。', ok:s=>s.lv.life>=3}},
  {id:'venus', name:'金星云城', ring:1, need:['med',2], time:'1 小时', sec:8, pts:[20,30],
    cards:[['云上茶会','珍珠姐在云层上摆开茶席，茶香飘了三公里。'],['酸雨伞','77 撑起烧烤摊的大伞：“下酸雨也要营业。”'],['外星：云城的客人','云城居民点了一千杯奶茶，付的是会发光的珍珠。']],
    hid:{name:'云上的珍珠', hint:'云里很闷，船员状态要好。', ok:s=>s.lv.med>=3}},
  {id:'belt', name:'矿石带', ring:2, need:['life',3], time:'2 小时', sec:10, pts:[45,60],
    cards:[['挖到宝了','77 一镐下去，挖出一块形状像串串的矿石。'],['矿工食堂','补给站的矿工排队吃 77 的宵夜。'],['外星：会唱歌的矿工','石头里的矿工会唱歌，他们想入股烧烤摊。']],
    hid:{name:'会唱歌的矿石', hint:'多来几趟，石头会记住你。', ok:s=>(s.visits.belt||0)>=3}},
  {id:'pirate', name:'海盗出没区', ring:2, need:['war',3], time:'2 小时', sec:10, pts:[45,60],
    cards:[['海盗旗','远处升起一面画着骷髅奶茶杯的旗子。'],['名场面','阿宅开炮前先摆了个姿势：“这一格要画大一点。”'],['外星：船长摘下帽子','海盗船长其实是外星人，打完一架，他想加盟。']],
    hid:{name:'海盗船长的帽子', hint:'要连着赢几场遭遇战。', ok:s=>s.wins>=3}},
  {id:'europa', name:'木卫冰海', ring:3, need:['life',4], time:'4 小时', sec:12, pts:[90,120],
    cards:[['冰上钓鱼','77 在冰面上凿了个洞，钓上来一条发光的鱼。'],['冰下的光','冰层下面有灯，一闪一闪，像在打招呼。'],['外星：唱歌的鲸','冰海里的鲸用歌声下单，一次要一万份烤鱼。']],
    hid:{name:'冰封的奶茶', hint:'冰海太冷，厨房得是最好的。', ok:s=>s.lv.life>=5}},
  {id:'saturn', name:'土星环', ring:3, need:['tech',4], time:'4 小时', sec:12, pts:[90,120],
    cards:[['环上冲浪','火箭老板踩着太阳帆在土星环上冲浪。'],['环里的光盘','冰块里冻着一张光盘，标签写着“第一季”。'],['外星：土星交易所','土星环交易所邀请四家店上市，开盘就涨停。']],
    hid:{name:'土星环光盘', hint:'雷达要能看清冰块里的东西。', ok:s=>s.lv.tech>=5}},
  {id:'signal', name:'未知信号源', ring:4, needAll:4, time:'8 小时', sec:14, pts:[220,300], final:true,
    cards:[['回信','信号是一段漫画，最后一格画着一条亮着灯的街。']],
    hid:{name:'回信', hint:'四个人都要准备好。', ok:s=>true}},
];
const K = '#141414';
function face(cx, cy, mood){
  const m = mood === 'grin' ? `<path d="M${cx-7} ${cy+9} q7 8 14 0" fill="#e63946" stroke="${K}" stroke-width="2.5"/>`
          : mood === 'o' ? `<ellipse cx="${cx}" cy="${cy+10}" rx="3.5" ry="4" fill="${K}"/>`
          : `<path d="M${cx-6} ${cy+9} q6 5 12 0" fill="none" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `<ellipse cx="${cx-10}" cy="${cy}" rx="4" ry="5" fill="${K}"/><ellipse cx="${cx+10}" cy="${cy}" rx="4" ry="5" fill="${K}"/>
    <circle cx="${cx-11.5}" cy="${cy-2}" r="1.5" fill="#fff"/><circle cx="${cx+8.5}" cy="${cy-2}" r="1.5" fill="#fff"/>
    <ellipse cx="${cx-17}" cy="${cy+7}" rx="4.5" ry="2.5" fill="#ff8fab" opacity=".8"/><ellipse cx="${cx+17}" cy="${cy+7}" rx="4.5" ry="2.5" fill="#ff8fab" opacity=".8"/>${m}`;
}
function legs(c){ return `<rect x="36" y="100" width="11" height="14" rx="4" fill="${c}" stroke="${K}" stroke-width="2.5"/><rect x="53" y="100" width="11" height="14" rx="4" fill="${c}" stroke="${K}" stroke-width="2.5"/>`; }
function robot(c, opt){
  opt = opt || {};
  const head = opt.brick
    ? `<rect x="14" y="14" width="72" height="54" rx="8" fill="${c}" stroke="${K}" stroke-width="3"/><path d="M14 32h72M14 50h72M38 14v18M62 14v18M26 32v18M50 32v18M74 32v18M38 50v18M62 50v18" stroke="${K}" stroke-width="1.5" opacity=".35"/>`
    : `<rect x="16" y="12" width="68" height="58" rx="24" fill="${c}" stroke="${K}" stroke-width="3"/>`;
  const ant = opt.horn
    ? `<path d="M50 12 v-4 M44 0 l12 0 l-3 8 h-6z" fill="#ffd23f" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/><path d="M38 -2 l6 3 M62 -2 l-6 3" stroke="${K}" stroke-width="2"/>`
    : opt.brick ? '' : `<path d="M50 12 v-7" stroke="${K}" stroke-width="2.5"/><circle cx="50" cy="4" r="4.5" fill="${opt.tip || '#ffd23f'}" stroke="${K}" stroke-width="2.5"/>`;
  const screen = `<rect x="25" y="${opt.brick ? 24 : 24}" width="50" height="36" rx="13" fill="#fffaf0" stroke="${K}" stroke-width="2.5"/>`;
  return `<ellipse cx="50" cy="116" rx="28" ry="4.5" fill="#000" opacity=".18"/>${ant}${head}<path d="M24 30 q2 -12 14 -15" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".55"/>${screen}${face(50, 40, opt.mood)}
    <rect x="30" y="70" width="40" height="32" rx="11" fill="${c}" stroke="${K}" stroke-width="3"/>
    <path d="M36 76 q4 -3 10 -3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/><circle cx="50" cy="86" r="5" fill="#ffd23f" stroke="${K}" stroke-width="2"/>
    <rect x="18" y="74" width="12" height="20" rx="6" fill="${c}" stroke="${K}" stroke-width="2.5"/><rect x="70" y="74" width="12" height="20" rx="6" fill="${c}" stroke="${K}" stroke-width="2.5"/>
    ${legs('#3a4a6b')}${opt.extra || ''}`;
}
function human(o){
  return `<ellipse cx="50" cy="116" rx="28" ry="4.5" fill="#000" opacity=".18"/>${o.back || ''}<circle cx="50" cy="42" r="31" fill="#ffe0c2" stroke="${K}" stroke-width="3"/>${o.hair}${face(50, 46, o.mood)}${o.glasses || ''}
    <rect x="30" y="72" width="40" height="30" rx="11" fill="${o.body}" stroke="${K}" stroke-width="3"/>${o.chest || ''}
    <rect x="18" y="76" width="12" height="19" rx="6" fill="${o.body}" stroke="${K}" stroke-width="2.5"/><rect x="70" y="76" width="12" height="19" rx="6" fill="${o.body}" stroke="${K}" stroke-width="2.5"/>
    ${legs('#3a4a6b')}${o.extra || ''}`;
}
const CAST = [
  {id:'yang', tint:'#bde0fe', name:'杨总', role:'制作人', line:'躺着，也要把游戏做出来。',
    svg:human({body:'#1d3557', mood:'grin',
      hair:`<path d="M19 40 q0-30 31-30 q31 0 31 30 q-8-12-20-14 q-4 8-22 8 q-12 0-20 6z" fill="${K}"/>`,
      glasses:`<path d="M24 22 h52" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/><rect x="28" y="16" width="18" height="10" rx="4" fill="#2f6fb5" stroke="${K}" stroke-width="2"/><rect x="54" y="16" width="18" height="10" rx="4" fill="#2f6fb5" stroke="${K}" stroke-width="2"/>`,
      chest:`<text x="50" y="92" text-anchor="middle" font-size="11" font-weight="900" fill="#ffd23f">制作人</text>`,
      extra:`<rect x="74" y="66" width="16" height="26" rx="3" fill="#fffaf0" stroke="${K}" stroke-width="2.5"/><rect x="77" y="70" width="10" height="15" fill="#ffd23f"/>`})},
  {id:'xd', tint:'#ffd8b5', name:'熊大', role:'主程序', line:'这个我来写，十分钟。',
    svg:robot('#f4a261', {mood:'grin', extra:`<path d="M8 104 h44 l-6-18 h-32z" fill="#cfd8e3" stroke="${K}" stroke-width="2.5"/><path d="M18 92 h22" stroke="#2f6fb5" stroke-width="3"/><text x="29" y="101" text-anchor="middle" font-size="8" font-weight="900" fill="${K}">&lt;/&gt;</text>`})},
  {id:'xe', tint:'#d8f3dc', name:'熊二', role:'任务发布与回收', line:'新任务来啦，谁认领？',
    svg:robot('#8ac926', {tip:'#e63946', extra:`<rect x="66" y="78" width="26" height="32" rx="3" fill="#fffaf0" stroke="${K}" stroke-width="2.5"/><rect x="73" y="74" width="12" height="6" rx="2" fill="#7a7a72" stroke="${K}" stroke-width="2"/><path d="M71 88 l3 3 l5-6 M71 98 l3 3 l5-6" stroke="#2a9d8f" stroke-width="2.5" fill="none"/><path d="M81 89h7M81 99h7" stroke="${K}" stroke-width="2"/>`})},
  {id:'bz', tint:'#ffd6cc', name:'板砖', role:'上线前验证', line:'等我再验一遍。',
    svg:robot('#c0583d', {brick:true, mood:'o', extra:`<circle cx="82" cy="78" r="12" fill="#bde0fe" fill-opacity=".7" stroke="${K}" stroke-width="3"/><path d="M74 87 l-10 12" stroke="${K}" stroke-width="5" stroke-linecap="round"/>`})},
  {id:'lb', tint:'#e4d4ff', name:'小喇叭', role:'资料调研', line:'我查到了，有三个出处。',
    svg:robot('#9b5de5', {horn:true, extra:`<path d="M6 82 l14 -4 v24 l-14 4z" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/><path d="M20 78 l14 4 v24 l-14 -4z" fill="#fffaf0" stroke="${K}" stroke-width="2.5"/>`})},
  {id:'wdm', tint:'#ffe3ec', name:'王大妈', role:'文案、设计与巡群', line:'群里的事，大妈盯着。',
    svg:human({body:'#e58aa8',
      back:`<g fill="#5a3d22" stroke="${K}" stroke-width="2.5">${[[22,30],[34,16],[50,11],[66,16],[78,30],[18,46],[82,46]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10"/>`).join('')}</g>`,
      hair:`<path d="M22 38 q4-22 28-24 q24 2 28 24 q-14-8-28-8 q-14 0-28 8z" fill="#5a3d22"/><circle cx="72" cy="20" r="5" fill="#ffd23f" stroke="${K}" stroke-width="2"/>`,
      glasses:`<circle cx="40" cy="46" r="8" fill="none" stroke="${K}" stroke-width="2"/><circle cx="60" cy="46" r="8" fill="none" stroke="${K}" stroke-width="2"/><path d="M48 46h4" stroke="${K}" stroke-width="2"/>`,
      chest:`<path d="M38 74 h24 v24 h-24z" fill="#fffaf0" stroke="${K}" stroke-width="2"/><path d="M42 82 h16 M42 88 h12" stroke="${K}" stroke-width="1.5"/>`,
      extra:`<rect x="72" y="70" width="20" height="26" rx="2" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/><path d="M76 78h12M76 84h12M76 90h8" stroke="${K}" stroke-width="1.5"/><path d="M90 64 l-8 22" stroke="#2f6fb5" stroke-width="4" stroke-linecap="round"/>`})},
];
const CASTBY = {}; CAST.forEach(c => CASTBY[c.id] = c);
function defsSvg(){
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#141414"/></pattern><pattern id="dotsw" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#e9f1ff"/></pattern><radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>${CAST.map(c => `<symbol id="c-${c.id}" viewBox="-4 -6 108 126">${c.svg}</symbol>`).join('')}${shipDefs()}${techDefs()}${sceneDefs()}</defs></svg>`;
}
function put(id, x, y, w, flip){ const h = w * 1.17; return `<use href="#c-${id}" x="${x}" y="${y}" width="${w}" height="${h}"${flip ? ` transform="translate(${2*x+w} 0) scale(-1 1)"` : ''}/>`; }
const ROCKET = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M20 0 q16 20 16 52 v20 h-32 v-20 q0-32 16-52z" fill="#fffaf0" stroke="${K}" stroke-width="3"/><circle cx="20" cy="34" r="7" fill="#2f6fb5" stroke="${K}" stroke-width="3"/><path d="M4 56 l-10 20 h10z M36 56 l10 20 h-10z" fill="#e63946" stroke="${K}" stroke-width="3"/><path d="M8 72 h24 l-12 26z" fill="#ffd23f" stroke="${K}" stroke-width="2.5"/></g>`;
const STARS = n => { let s = '', seed = n * 31 + 7; for (let i = 0; i < 26; i++) { seed = (seed * 16807) % 2147483647; const x = seed % 320; seed = (seed * 16807) % 2147483647; const y = seed % 200; s += `<rect x="${x}" y="${y}" width="2" height="2" fill="#e9f1ff" opacity=".8"/>`; } return s; };
const SHOPS4 = `<g stroke="${K}" stroke-width="2.5">${['#c8743a','#e58aa8','#2f6fb5','#7a7a72'].map((c,i) => `<rect x="${150+i*40}" y="${104}" width="36" height="40" fill="#fffaf0"/><path d="M${148+i*40} 104 h40 l-4 -12 h-32z" fill="${c}"/><rect x="${160+i*40}" y="120" width="16" height="24" fill="#ffd23f"/>`).join('')}</g>`;
const CARDS = `<g stroke="${K}" stroke-width="2.5">${[[170,40,-18,'#ffd23f'],[210,30,6,'#fffaf0'],[250,48,22,'#d9d2ff']].map(([x,y,r,c]) => `<g transform="rotate(${r} ${x+18} ${y+26})"><rect x="${x}" y="${y}" width="36" height="52" rx="4" fill="${c}"/><circle cx="${x+18}" cy="${y+22}" r="8" fill="#e63946"/><path d="M${x+8} ${y+40}h20" /></g>`).join('')}</g>`;
const BOARD = `<rect x="96" y="20" width="128" height="78" fill="#c8743a" stroke="${K}" stroke-width="3"/><rect x="102" y="26" width="116" height="66" fill="#fffaf0" stroke="${K}" stroke-width="2"/>${[[108,32,'#ffd23f'],[146,32,'#bde0fe'],[184,32,'#ffc4d6'],[108,62,'#d8f3dc'],[146,62,'#ffd23f'],[184,62,'#e7ffe9']].map(([x,y,c]) => `<rect x="${x}" y="${y}" width="28" height="24" fill="${c}" stroke="${K}" stroke-width="1.5"/><path d="M${x+5} ${y+9}h18M${x+5} ${y+15}h12" stroke="${K}" stroke-width="1.2"/>`).join('')}`;
const EARTHG = (x,y,r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#2f6fb5" stroke="${K}" stroke-width="3"/><path d="M${x-r*.6} ${y-r*.3} q${r*.3} -${r*.5} ${r*.7} -${r*.1} q${r*.2} ${r*.4} -${r*.2} ${r*.6} q-${r*.4} ${r*.1} -${r*.5} -${r*.5}z M${x+r*.2} ${y+r*.2} q${r*.4} -${r*.1} ${r*.5} ${r*.3} q-${r*.2} ${r*.4} -${r*.5} ${r*.2}z" fill="#6fbf73" stroke="${K}" stroke-width="2"/>`;
const CEOU = (k, x, y, w) => `<use href="#ceo-${k}" x="${x}" y="${y}" width="${w}" height="${w*1.17}"/>`;
const GRILL = `<g stroke="${K}" stroke-width="2.5"><path d="M196 150 l-8 40 M290 150 l8 40" /><rect x="186" y="128" width="114" height="22" rx="4" fill="#3a3a3a"/>${[200,222,244,266,288].map(x => `<path d="M${x} 96 v34" stroke="#8a6a4a" stroke-width="2"/><circle cx="${x}" cy="104" r="5" fill="#c0583d"/><circle cx="${x}" cy="116" r="5" fill="#e9c46a"/>`).join('')}</g><path d="M220 90 q-8 -14 2 -26 M248 90 q-8 -14 2 -26" stroke="#fff" stroke-width="4" opacity=".6" fill="none" stroke-linecap="round"/>`;
const GBOX = `<g transform="translate(128 112) rotate(-10)" stroke="${K}" stroke-width="2.5"><rect width="40" height="34" fill="#e63946"/><rect x="-4" y="-10" width="48" height="12" fill="#ffd23f"/><path d="M20 -10 v44" /><text x="20" y="28" text-anchor="middle" font-size="18" font-weight="900" fill="#fff" stroke="none">?</text></g>`;
const HOUSES = `<g stroke="${K}" stroke-width="2.5">${[['#c8743a',150],['#e58aa8',192],['#6b4fd8',234],['#2f6fb5',276]].map(([c,x]) => `<rect x="${x-18}" y="110" width="36" height="40" fill="#fffaf0"/><path d="M${x-24} 112 L${x} 86 L${x+24} 112z" fill="${c}"/><rect x="${x-6}" y="128" width="12" height="22" fill="#ffd23f"/>`).join('')}</g>`;
const PET = `<g transform="translate(232 120)" stroke="${K}" stroke-width="3"><ellipse rx="40" ry="32" fill="#ffd6a5"/><path d="M-30 -22 l-8 -22 l20 12z M30 -22 l8 -22 l-20 12z" fill="#ffd6a5"/><ellipse cx="-13" cy="-4" rx="5" ry="7" fill="${K}"/><ellipse cx="13" cy="-4" rx="5" ry="7" fill="${K}"/><circle cx="-15" cy="-7" r="2" fill="#fff" stroke="none"/><circle cx="11" cy="-7" r="2" fill="#fff" stroke="none"/><path d="M-5 8 q5 5 10 0" fill="none"/><ellipse cx="-24" cy="8" rx="6" ry="3" fill="#ff8fab" stroke="none"/><ellipse cx="24" cy="8" rx="6" ry="3" fill="#ff8fab" stroke="none"/></g><path d="M232 66 c-6 -10 -20 -2 -10 8 l10 9 l10 -9 c10 -10 -4 -18 -10 -8z" fill="#e63946" stroke="${K}" stroke-width="2"/>`;
const ZOMBIE = `<rect x="0" y="160" width="320" height="40" fill="#5a4a3a"/>${[[180,'#6fbf73'],[240,'#80b26a'],[290,'#6fbf73']].map(([x,c]) => `<path d="M${x} 162 v-36 l-8 -10 M${x} 126 v-16 M${x+7} 128 v-18 M${x+13} 132 v-14" stroke="${K}" stroke-width="12" stroke-linecap="round"/><path d="M${x} 162 v-36 l-8 -10 M${x} 126 v-16 M${x+7} 128 v-18 M${x+13} 132 v-14" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`).join('')}`;
const TOWER = `<g transform="translate(220 76)" stroke="${K}" stroke-width="2.5"><rect x="-18" y="40" width="36" height="34" fill="#9aa5b5"/><rect x="-24" y="30" width="48" height="12" fill="#cfd8e3"/><circle cy="20" r="14" fill="#2a9d8f"/><rect x="8" y="14" width="30" height="8" fill="#3a4556"/></g><g transform="translate(286 104)" stroke="${K}" stroke-width="2.5"><path d="M-14 -20 h28 l-4 44 h-20z" fill="#f1dcc0"/><g fill="${K}"><circle cx="-4" cy="16" r="3"/><circle cx="4" cy="18" r="3"/></g><path d="M4 -20 l6 -14"/></g>${[[150,60],[170,90],[140,110]].map(([x,y]) => `<g transform="translate(${x} ${y})"><circle r="9" fill="#80ed99" stroke="${K}" stroke-width="2"/><path d="M-9 0 l-5 -3 M9 0 l5 -3 M0 -9 v-5" stroke="${K}" stroke-width="2"/></g>`).join('')}`;
const COMIC = [
  {date:'10月5日 15:15', title:'第一句话', bg:'#ffe2b8',
   art:`<rect x="0" y="150" width="320" height="50" fill="#f4d29c"/><path d="M20 150 l40 -40 h70 l-10 40" fill="#fffaf0" stroke="${K}" stroke-width="3"/><path d="M40 150 v30 M118 150 v30" stroke="${K}" stroke-width="3"/>${put('yang',38,52,96)}${put('xd',200,78,70)}${put('xe',256,82,62,true)}`,
   bubbles:[{x:3,y:10,w:56,who:'yang',t:'iphone 简单的游戏制作。以挂机为主题。'},{x:62,y:10,w:34,who:'xd',t:'收到！'}],
   quote:'熊大熊二 新工作，iphone简单的游戏制作。以挂机为主题。挂机可以有收益，画面按照2D的漫画风格'},
  {date:'10月5日 15:25', title:'烧烤摊和盲盒', bg:'#fff4d6',
   art:`<rect x="0" y="160" width="320" height="40" fill="#e6e4dc"/>${GRILL}${GBOX}${put('yang',14,62,96)}`,
   bubbles:[{x:3,y:10,w:58,who:'yang',t:'和 77 烧烤来一个梦幻联动。抽盲盒，可以抽到衣服、帽子、店里的装饰品。'}]},
  {date:'10月5日 16:12', title:'第一版能玩了', bg:'#e6f0ff',
   art:`<rect x="0" y="144" width="320" height="56" fill="#cfd8e3"/>${SHOPS4}${put('xe',20,66,92)}<text x="248" y="60" text-anchor="middle" font-size="30" font-weight="900" fill="#e63946" stroke="${K}" stroke-width="1.5" transform="rotate(-8 248 60)">能玩了！</text>`,
   bubbles:[{x:4,y:10,w:44,who:'xe',t:'第一版试玩链接好了！'}]},
  {date:'10月5日 17:37', title:'每人一个家', bg:'#ffe9cc',
   art:`<rect x="0" y="150" width="320" height="50" fill="#d9a46c"/>${HOUSES}${put('yang',14,62,96)}`,
   bubbles:[{x:3,y:10,w:50,who:'yang',t:'每个 CEO 一人一个自己的家。'}]},
  {date:'10月6日 12:28', title:'小宠物', bg:'#fde8ef',
   art:`<rect x="0" y="160" width="320" height="40" fill="#f3c9d6"/>${PET}${put('yang',30,62,96)}`,
   bubbles:[{x:3,y:10,w:56,who:'yang',t:'确实像一只真的小生命，不只是一个动画头像。'}]},
  {date:'10月7日 06:02', title:'烧烤摊打僵尸', bg:'#2a2233', dark:true,
   art:`${STARS(5)}${ZOMBIE}${CEOU('life',70,74,72)}${put('yang',2,70,80)}<text x="250" y="70" text-anchor="middle" font-size="26" font-weight="900" fill="#ffd23f" style="paint-order:stroke" stroke="${K}" stroke-width="4" transform="rotate(6 250 70)">嘿哈！</text>`,
   bubbles:[{x:3,y:10,w:46,who:'yang',t:'这样烧烤店是打僵尸。'}]},
  {date:'10月7日 11:34', title:'保卫奶茶', bg:'#e6f6f4',
   art:`<rect x="0" y="150" width="320" height="50" fill="#c7e6e2"/>${TOWER}${put('bz',10,66,92)}`,
   bubbles:[{x:3,y:10,w:58,who:'yang',t:'塔防游戏板砖给我一个样品，也是公用金币系统。'},{x:66,y:30,w:30,who:'bz',t:'样品来了。'}]},
  {date:'10月8日 20:54', title:'书店要打牌', bg:'#d9d2ff',
   art:`${CARDS}${put('yang',22,62,96)}`,
   bubbles:[{x:3,y:10,w:52,who:'yang',t:'第三个小游戏，我打算在书店安排一个类似炉石传说的卡牌游戏。'}]},
  {date:'10月10日', title:'王大妈来了', bg:'#ffe3ec',
   art:`<rect x="0" y="156" width="320" height="44" fill="#f4c6d4"/>${put('wdm',116,58,100)}<path d="M40 60 l20 10 M36 90 h22 M40 120 l20 -10 M280 60 l-20 10 M284 90 h-22 M280 120 l-20 -10" stroke="${K}" stroke-width="3" stroke-linecap="round"/>`,
   bubbles:[{x:3,y:10,w:44,who:'wdm',t:'群里的事，大妈帮你盯着。'}]},
  {date:'10月12日', title:'任务池开张', bg:'#f4efe2',
   art:`${BOARD}${put('xd',4,108,62)}${put('xe',62,112,58)}${put('bz',196,112,58,true)}${put('lb',248,108,62,true)}${put('wdm',134,118,54)}`,
   bubbles:[{x:68,y:10,w:30,who:'xe',t:'新任务，谁来认领？'},{x:2,y:10,w:22,who:'xd',t:'我！'}]},
  {date:'10月12日', title:'去太空', bg:'#14213d', dark:true,
   art:`${STARS(3)}${EARTHG(60,190,60)}${ROCKET(210,36,1.15)}${put('yang',30,70,84)}`,
   bubbles:[{x:3,y:10,w:52,who:'yang',t:'4 个 CEO 驾驶飞船去太空探索。'}]},
  {date:'最后一站', title:'买下地球', bg:'#14213d', dark:true,
   art:`${STARS(9)}${EARTHG(160,92,52)}<g transform="rotate(-12 222 52)"><rect x="196" y="38" width="56" height="26" rx="4" fill="#ffd23f" stroke="${K}" stroke-width="3"/><text x="224" y="57" text-anchor="middle" font-size="15" font-weight="900" fill="${K}">已售</text></g>${put('xd',2,128,56)}${put('xe',52,132,52)}${put('yang',134,132,58)}${put('bz',214,132,52,true)}${put('lb',262,128,56,true)}`,
   bubbles:[{x:3,y:10,w:40,who:'yang',t:'目标：买下地球。'}]},
];
function burst(cx, cy, r, c){ let d = ''; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, a2 = a + Math.PI / 48; d += `M${cx} ${cy} L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)} L${(cx + Math.cos(a2) * r).toFixed(1)} ${(cy + Math.sin(a2) * r).toFixed(1)}z`; } return `<path d="${d}" fill="${c}"/>`; }
function esc(t){ return String(t).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function comicPanel(p, i){
  const deco = p.dark ? `<rect width="320" height="240" fill="url(#dotsw)" opacity=".12"/><circle cx="${p.glow || 250}" cy="70" r="90" fill="url(#glow)" opacity=".18"/>`
                      : `<rect width="320" height="240" fill="url(#dots)" opacity=".07"/>${burst(p.bx || 160, p.by || 150, 260, 'rgba(255,255,255,.35)')}`;
  return `<figure class="cp${p.dark ? ' dark' : ''}${p.wide === false ? '' : ''}">
    <div class="cp-art"><svg viewBox="0 0 320 240" role="img" aria-label="${esc(p.title)}"><rect width="320" height="240" fill="${p.bg}"/>${deco}<g transform="translate(0 40)">${p.art}</g></svg>
    <span class="cp-date">${esc(p.date)}</span>
    ${p.bubbles.map(b => `<span class="bub" style="left:${b.x}%;top:${b.y}%;width:${b.w}%">${esc(b.t)}</span>`).join('')}
    <figcaption class="cp-cap">${esc(p.title)}</figcaption></div></figure>`;
}
const IC = {
  shop:`<rect x="18" y="24" width="44" height="30" fill="#fffaf0" stroke="${K}" stroke-width="3"/><path d="M14 24 h52 l-6 -14 h-40z" fill="#c8743a" stroke="${K}" stroke-width="3"/><rect x="34" y="34" width="12" height="20" fill="#ffd23f" stroke="${K}" stroke-width="2"/>`,
  staff:`<circle cx="40" cy="22" r="12" fill="#ffe0c2" stroke="${K}" stroke-width="3"/><rect x="28" y="34" width="24" height="20" rx="8" fill="#2a9d8f" stroke="${K}" stroke-width="3"/><circle cx="36" cy="22" r="2" fill="${K}"/><circle cx="44" cy="22" r="2" fill="${K}"/>`,
  box:`<rect x="20" y="24" width="40" height="30" fill="#e63946" stroke="${K}" stroke-width="3"/><rect x="16" y="16" width="48" height="10" fill="#ffd23f" stroke="${K}" stroke-width="3"/><path d="M40 16 v38" stroke="${K}" stroke-width="3"/><text x="40" y="47" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">?</text>`,
  tea:`<path d="M26 18 h28 l-4 36 h-20z" fill="#fffaf0" stroke="${K}" stroke-width="3"/><path d="M44 18 l6 -12" stroke="${K}" stroke-width="3"/><g fill="${K}"><circle cx="34" cy="46" r="3"/><circle cx="42" cy="48" r="3"/><circle cx="46" cy="42" r="3"/></g>`,
  zombie:`<rect x="10" y="44" width="60" height="12" fill="#8a6a4a" stroke="${K}" stroke-width="3"/><path d="M34 44 v-18 l-6 -6 M34 26 l0 -12 M40 26 v-14 M46 26 v-10 M46 30 l6 -6" stroke="#6fbf73" stroke-width="7" stroke-linecap="round"/>`,
  book:`<path d="M10 16 q15 -4 30 4 q15 -8 30 -4 v36 q-15 -4 -30 4 q-15 -8 -30 -4z" fill="#fffaf0" stroke="${K}" stroke-width="3"/><path d="M40 20 v36" stroke="${K}" stroke-width="2"/>`,
  card:`<rect x="18" y="12" width="26" height="38" rx="3" fill="#d9d2ff" stroke="${K}" stroke-width="3" transform="rotate(-10 31 31)"/><rect x="36" y="12" width="26" height="38" rx="3" fill="#ffd23f" stroke="${K}" stroke-width="3" transform="rotate(8 49 31)"/>`,
  office:`<rect x="24" y="8" width="32" height="46" fill="#cfd8e3" stroke="${K}" stroke-width="3"/>${[14,24,34].map(y => `<rect x="30" y="${y}" width="7" height="6" fill="#ffd23f"/><rect x="43" y="${y}" width="7" height="6" fill="#ffd23f"/>`).join('')}`,
  rocket:`<g transform="translate(30 4) scale(.5)">${'<path d="M20 0 q16 20 16 52 v20 h-32 v-20 q0-32 16-52z" fill="#fffaf0" stroke="#141414" stroke-width="5"/><circle cx="20" cy="34" r="7" fill="#2f6fb5" stroke="#141414" stroke-width="4"/><path d="M8 72 h24 l-12 26z" fill="#ffd23f" stroke="#141414" stroke-width="4"/>'}</g>`,
  shield:`<path d="M40 8 l22 8 v14 q0 16 -22 26 q-22 -10 -22 -26 v-14z" fill="#2a9d8f" stroke="${K}" stroke-width="3"/><path d="M40 20 q8 10 0 18 q-8 -8 0 -18z" fill="#fffaf0" stroke="${K}" stroke-width="2"/>`,
  medal:`<path d="M30 6 l10 16 l10 -16" stroke="#e63946" stroke-width="6" fill="none"/><circle cx="40" cy="36" r="16" fill="#ffd23f" stroke="${K}" stroke-width="3"/><text x="40" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="${K}">50</text>`,
  gear:`<circle cx="40" cy="30" r="16" fill="#7a7a72" stroke="${K}" stroke-width="3" stroke-dasharray="8 4"/><circle cx="40" cy="30" r="7" fill="#fffaf0" stroke="${K}" stroke-width="3"/>`,
  story:`<rect x="20" y="8" width="40" height="46" rx="3" fill="#fffaf0" stroke="${K}" stroke-width="3"/><rect x="26" y="14" width="28" height="18" fill="#bde0fe" stroke="${K}" stroke-width="2"/><path d="M26 40h28M26 46h18" stroke="${K}" stroke-width="2"/>`,
  alien:`<path d="M40 4 v8 M30 8 l4 6 M50 8 l-4 6" stroke="${K}" stroke-width="2.5"/><ellipse cx="40" cy="32" rx="20" ry="18" fill="#80ed99" stroke="${K}" stroke-width="3"/><ellipse cx="32" cy="30" rx="5" ry="7" fill="${K}"/><ellipse cx="48" cy="30" rx="5" ry="7" fill="${K}"/><path d="M34 42 q6 4 12 0" stroke="${K}" stroke-width="2.5" fill="none"/>`,
  gift:`<rect x="20" y="26" width="40" height="28" fill="#9b5de5" stroke="${K}" stroke-width="3"/><rect x="16" y="18" width="48" height="10" fill="#ffd23f" stroke="${K}" stroke-width="3"/><path d="M40 18 v36 M40 18 q-12 -14 -14 -2 M40 18 q12 -14 14 -2" stroke="${K}" stroke-width="3" fill="none"/>`,
  stars:`<text x="40" y="40" text-anchor="middle" font-size="22" fill="#ffd23f" stroke="${K}" stroke-width="1.5">★★★</text>`,
  mail:`<rect x="14" y="14" width="52" height="34" fill="#fffaf0" stroke="${K}" stroke-width="3"/><path d="M14 14 l26 20 l26 -20" fill="none" stroke="${K}" stroke-width="3"/><circle cx="58" cy="44" r="7" fill="#e63946" stroke="${K}" stroke-width="2"/>`,
  earth:EARTHG(40,30,22),
};
function icon(k){ return `<svg viewBox="0 0 80 60" aria-hidden="true">${IC[k] || ''}</svg>`; }
function streetPanel(n){
  const lit = n >= 1, all = n >= 3;
  const shops = [['#c8743a', n >= 1], ['#e58aa8', n >= 1], ['#2f6fb5', n >= 2], ['#7a7a72', n >= 2]];
  let s = `<rect width="320" height="200" fill="${all ? '#2b1838' : '#0d1424'}"/>${stars(30,0,0,320,90,5 + n)}`;
  if (all) s += `<rect width="320" height="200" fill="#ffb347" opacity=".12"/>`;
  s += `<rect y="160" width="320" height="40" fill="#2a2f3a"/>`;
  shops.forEach(([c, on], i) => {
    const x = 14 + i*76;
    s += `<rect x="${x}" y="84" width="66" height="76" fill="${on ? '#fffaf0' : '#3a4556'}" stroke="#0b0f17" stroke-width="2"/><path d="M${x-4} 84 h74 l-6 -16 h-62z" fill="${on ? c : '#56647d'}" stroke="#0b0f17" stroke-width="2"/><rect x="${x+20}" y="116" width="26" height="44" fill="${on ? '#ffd23f' : '#1b2433'}" stroke="#0b0f17" stroke-width="1.5"/>`;
    if (on) s += `<rect x="${x-6}" y="110" width="78" height="60" fill="#ffd23f" opacity=".15"/>`;
  });
  if (all) s += `<path d="M0 60 Q80 80 160 60 T320 60" fill="none" stroke="#0b0f17"/>${[20,60,100,140,180,220,260,300].map((x,i) => `<circle cx="${x}" cy="${66 + Math.sin(i)*6}" r="5" fill="${['#ffd23f','#ff8fab','#7df9ff'][i%3]}"/>`).join('')}`;
  return s;
}
const ENDING = [
  {cap:'一条很普通的街，四家店，灯都还没开。', art:() => streetPanel(0)},
  {cap:'77 的烤架冒起烟，珍珠姐煮好第一锅珍珠。', art:() => streetPanel(1) + `<use href="#ceo-life" x="20" y="112" width="52" height="64"/><use href="#ceo-med" x="96" y="112" width="52" height="64"/><path d="M40 100 q-6 -12 2 -22 M52 100 q-6 -12 2 -22" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/>`},
  {cap:'阿宅把书架摆满，火箭老板的服务器亮了。', art:() => streetPanel(2) + `<use href="#ceo-war" x="172" y="112" width="52" height="64"/><use href="#ceo-tech" x="248" y="112" width="52" height="64"/>`},
  {cap:'一条街的灯全亮了。', art:() => streetPanel(3) + ['life','med','war','tech'].map((k,i) => `<use href="#ceo-${k}" x="${22 + i*76}" y="112" width="52" height="64"/>`).join('') + `<g transform="translate(160 30)"><rect x="-62" y="-14" width="124" height="28" rx="4" fill="#fffaf0" stroke="#0b0f17" stroke-width="2"/><text text-anchor="middle" y="6" font-size="15" font-weight="900" fill="#e63946">欢迎回家</text></g>`},
];
const PRE = [
  ['开张第一家店','77烧烤摊', 0, 'shop'],
  ['雇来第一个员工','阿炭', 2*60e3, 'staff'],
  ['第一次开盲盒','', 40*60e3, 'box'],
  ['开张奶茶店','珍珠姐加入', 3*3600e3, 'tea'],
  ['第一次打僵尸','', 9*3600e3, 'zombie'],
  ['开张漫画书店','阿宅店长加入', 26*3600e3, 'book'],
  ['第一次在书店打牌','「书页之间」', 2*86400e3, 'card'],
  ['开张科技公司','', 4*86400e3, 'office'],
  ['火箭老板加入','科技公司 Lv25', 5*86400e3, 'rocket'],
  ['塔防第一关通关','保卫奶茶', 6*86400e3, 'shield'],
  ['四家店都过 Lv50','星途开放', 12*86400e3, 'medal'],
];
function dur(ms){
  ms = Math.max(0, ms); const d = Math.floor(ms/86400e3), h = Math.floor(ms%86400e3/3600e3), m = Math.floor(ms%3600e3/60e3), s = Math.floor(ms%60e3/1000);
  if (d) return `${d} 天 ${h} 小时`; if (h) return `${h} 小时 ${m} 分`; if (m) return `${m} 分 ${s} 秒`; return `${s} 秒`;
}
const CEO_ART = {
  life: human({body:'#d62828', mood:'grin',
    back:`<path d="M66 14 q30 6 24 40 q-4 22 6 34 q-18 -2 -22 -22 q-4 -18 -8 -52z" fill="#5a3a22" stroke="${K}" stroke-width="2.5"/><path d="M60 8 l10 -8 l4 10 l10 -2 l-6 10z" fill="#ff8fab" stroke="${K}" stroke-width="2"/>`,
    hair:`<path d="M19 44 q-2-34 31-34 q33 0 31 34 q-6-16-20-18 q-8 8-28 8 q-8 2-14 10z" fill="#5a3a22"/>`,
    chest:`<path d="M36 74 h28 v26 h-28z" fill="#7a4a2a" stroke="${K}" stroke-width="2"/><path d="M38 74 l-4 -4 M62 74 l4 -4" stroke="#7a4a2a" stroke-width="3"/>`,
    extra:`<path d="M84 64 l-6 26 M90 66 l-8 24" stroke="#9aa5b5" stroke-width="3" stroke-linecap="round"/>`}),
  med: human({body:'#b7e4c7',
    hair:`<path d="M17 50 q-6-40 33-40 q39 0 33 40 q-4 8 -8 4 q2-18-10-24 q-14 6-30 4 q-10 6-10 20 q-4 4-8-4z" fill="#8a5a3a" stroke="${K}" stroke-width="2"/><circle cx="68" cy="22" r="3.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="74" cy="26" r="3" fill="#fff" stroke="${K}" stroke-width="1.5"/>`,
    chest:`<path d="M36 76 h28 v24 h-28z" fill="#d4a373" stroke="${K}" stroke-width="2"/>`,
    extra:`<path d="M72 72 h16 l-2 24 h-12z" fill="#f1dcc0" stroke="${K}" stroke-width="2"/><g fill="${K}"><circle cx="77" cy="91" r="2"/><circle cx="83" cy="92" r="2"/><circle cx="80" cy="87" r="2"/></g><path d="M82 72 l3 -9" stroke="${K}" stroke-width="2"/>`}),
  war: human({body:'#1d3557',
    hair:`<path d="M16 44 q-4-36 34-36 q38 0 34 36 l-6-12 l-5 8 l-6-12 l-7 8 l-6-12 l-7 8 l-6-10 l-6 10 l-5-8z" fill="#1a1a1a"/>`,
    glasses:`<circle cx="40" cy="47" r="8" fill="none" stroke="${K}" stroke-width="2"/><circle cx="60" cy="47" r="8" fill="none" stroke="${K}" stroke-width="2"/><path d="M48 47h4" stroke="${K}" stroke-width="2"/>`,
    chest:`<path d="M40 74 q10 8 20 0" fill="none" stroke="#fffaf0" stroke-width="2"/>`,
    extra:`<rect x="66" y="76" width="22" height="18" rx="2" fill="#2f6fb5" stroke="${K}" stroke-width="2" transform="rotate(-10 77 85)"/><path d="M70 82 l12 -2" stroke="#ffd23f" stroke-width="2"/>`}),
  tech: human({body:'#222831',
    hair:`<path d="M19 40 q-2-30 31-32 q30 0 31 28 q-6-12-18-14 q-12 8-30 8 q-8 2-14 10z" fill="#6b4a33"/>`,
    chest:`<path d="M42 74 h16 l-3 26 h-10z" fill="#141414"/><circle cx="62" cy="80" r="2.5" fill="#f77f00"/>`,
    extra:`<path d="M80 60 q6 8 6 20 v8 h-12 v-8 q0-12 6-20z" fill="#fffaf0" stroke="${K}" stroke-width="2"/><path d="M76 88 l-4 6 h6z M84 88 l4 6 h-6z" fill="#e63946" stroke="${K}" stroke-width="1.5"/><circle cx="80" cy="74" r="2.5" fill="#2f6fb5"/>`}),
};
function shipDefs(){ return Object.keys(CEO_ART).map(k => `<symbol id="ceo-${k}" viewBox="-4 -6 108 126">${CEO_ART[k]}</symbol>`).join(''); }
const IT = {
  life:[
    `<rect x="6" y="30" width="26" height="14" rx="3" fill="#ffd23f"/><rect x="6" y="25" width="26" height="6" rx="2" fill="#e63946"/>`,
    `<rect x="5" y="14" width="28" height="30" rx="3" fill="#fffaf0"/><rect x="10" y="19" width="18" height="10" fill="#bde0fe"/><circle cx="19" cy="37" r="3" fill="#e63946"/><path d="M14 10 q-3-5 0-9 M23 10 q-3-5 0-9" fill="none"/>`,
    `<rect x="1" y="34" width="11" height="10" fill="#c8743a"/><rect x="14" y="34" width="11" height="10" fill="#c8743a"/><rect x="27" y="34" width="11" height="10" fill="#c8743a"/><circle cx="6" cy="28" r="6" fill="#6fbf73"/><circle cx="19" cy="24" r="8" fill="#6fbf73"/><circle cx="32" cy="28" r="6" fill="#6fbf73"/><circle cx="19" cy="22" r="2.5" fill="#e63946"/>`,
    `<rect x="3" y="20" width="32" height="24" fill="#7a7a72"/><rect x="8" y="27" width="22" height="12" fill="#141414"/><path d="M14 34 q5-6 10 0" fill="#ffd23f" stroke="none"/><rect x="9" y="11" width="20" height="9" rx="2" fill="#fffaf0"/>`,
    `<path d="M2 24 h34 q0 20 -17 20 q-17 0 -17 -20z" fill="#c0583d"/><ellipse cx="19" cy="24" rx="17" ry="5" fill="#e63946"/><path d="M19 24 v-4 M2 24 v-4 M36 24 v-4" /><path d="M10 14 q-3-5 0-10 M19 12 q-3-5 0-10 M28 14 q-3-5 0-10" fill="none" stroke="#fffaf0"/>`],
  med:[
    `<rect x="6" y="28" width="26" height="16" rx="2" fill="#fffaf0"/><path d="M19 31 v10 M14 36 h10" stroke="#e63946" stroke-width="3.5"/>`,
    `<path d="M15 6 v38 M7 44 h16" fill="none"/><rect x="18" y="8" width="14" height="18" rx="5" fill="#ffc4d6"/><circle cx="25" cy="17" r="2.5" fill="#fff"/><path d="M25 26 v8 q0 4 -4 4" fill="none"/>`,
    `<rect x="1" y="24" width="36" height="20" rx="10" fill="#e4d4ff"/><path d="M6 30 q13-9 26 0" fill="#bde0fe"/><path d="M28 18 l2 -4 l2 4 M32 12 l1.5 -3 l1.5 3" fill="none"/>`,
    `<rect x="1" y="32" width="36" height="8" fill="#fffaf0"/><path d="M3 40 v4 M35 40 v4" fill="none"/><rect x="22" y="8" width="16" height="14" fill="#2a9d8f"/><path d="M25 16 l3-3 l3 5 l3-4" fill="none" stroke="#fff" stroke-width="2"/><path d="M30 22 v10" fill="none"/>`,
    `<path d="M6 44 h26 l-6 -7 h-14z" fill="#7a7a72"/><path d="M19 37 L3 4 h32z" fill="#bde0fe" fill-opacity=".7"/><path d="M19 24 q-8-6 -4-10 q4-3 4 2 q0-5 4-2 q4 4 -4 10z" fill="#e63946" stroke-width="1.5"/>`],
  war:[
    `<path d="M19 44 v-16 M19 28 l-8 -12 M19 28 l8 -12" fill="none" stroke="#8a6a4a" stroke-width="4.5" stroke-linecap="round"/><path d="M11 16 q8 9 16 0" fill="none" stroke="#e63946"/>`,
    `<circle cx="19" cy="28" r="15" fill="#ffd23f"/><circle cx="19" cy="28" r="7" fill="#e63946"/><path d="M2 10 l6 5 M36 10 l-6 5 M19 6 v5" fill="none"/>`,
    `<rect x="2" y="30" width="28" height="11" rx="5" fill="#cfd8e3"/><rect x="28" y="32" width="9" height="7" fill="#e63946"/><path d="M8 41 v3 M24 41 v3" fill="none"/>`,
    `<rect x="2" y="30" width="20" height="14" fill="#7a7a72"/><g transform="rotate(-24 14 30)"><rect x="12" y="24" width="28" height="11" fill="#3a4a6b"/><rect x="38" y="22" width="5" height="15" fill="#141414"/></g>`,
    `<circle cx="19" cy="26" r="17" fill="#9b5de5"/><circle cx="19" cy="26" r="9" fill="#ffd23f"/><circle cx="19" cy="26" r="3.5" fill="#fff" stroke="none"/><path d="M19 2 v4 M19 46 v-4 M-3 26 h4 M41 26 h-4" fill="none" stroke="#ffd23f"/>`],
  tech:[
    `<path d="M8 28 h22 l-4 16 h-14z" fill="#cfd8e3"/><rect x="12" y="20" width="14" height="8" fill="#7a7a72"/>`,
    `<circle cx="19" cy="30" r="12" fill="#14213d" stroke="#2f6fb5" stroke-width="6"/><circle cx="19" cy="30" r="4" fill="#bde0fe" stroke="none"/>`,
    `<path d="M19 44 v-14" fill="none"/><g transform="rotate(-25 19 22)"><path d="M3 18 q16 20 32 0z" fill="#fffaf0"/><path d="M19 22 v-12" fill="none"/><circle cx="19" cy="9" r="3" fill="#e63946"/></g>`,
    `<rect x="10" y="4" width="18" height="40" rx="7" fill="#80ed99"/><path d="M10 14h18M10 24h18M10 34h18" fill="none"/><circle cx="19" cy="24" r="12" fill="url(#glow)" stroke="none" opacity=".6"/>`,
    `<circle cx="19" cy="24" r="20" fill="url(#glow)" stroke="none"/><circle cx="19" cy="24" r="13" fill="#ffd23f"/><path d="M13 22 q6 -6 12 0" fill="none" stroke="#e63946" stroke-width="2"/>`],
};
const ROOM = {
  tech:{name:'舰桥', en:'BRIDGE', sys:'科技'},
  war: {name:'炮舱', en:'WEAPONS', sys:'战斗'},
  med: {name:'医务室', en:'MED BAY', sys:'医疗'},
  life:{name:'厨房', en:'GALLEY', sys:'生活'},
};
const FLOORS = ['tech','war','med','life'];
const CY = '#7df9ff';
function techDefs(){
  return `<linearGradient id="metal" x1="0" x2="1"><stop offset="0" stop-color="#6f7a8c"/><stop offset=".25" stop-color="#c9d2de"/><stop offset=".5" stop-color="#eef2f7"/><stop offset=".75" stop-color="#aeb8c6"/><stop offset="1" stop-color="#5d6779"/></linearGradient>
  <linearGradient id="metalD" x1="0" x2="1"><stop offset="0" stop-color="#2a3140"/><stop offset=".5" stop-color="#5a6578"/><stop offset="1" stop-color="#232a37"/></linearGradient>
  <radialGradient id="deep" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#1c2b55"/><stop offset=".6" stop-color="#0a1024"/><stop offset="1" stop-color="#04060f"/></radialGradient>
  <radialGradient id="dome" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9fe8ff"/><stop offset=".5" stop-color="#1f4f7a"/><stop offset="1" stop-color="#0a1830"/></radialGradient>
  <linearGradient id="ceil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CY}" stop-opacity=".45"/><stop offset="1" stop-color="${CY}" stop-opacity="0"/></linearGradient>
  <linearGradient id="plasma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".25" stop-color="#bff6ff"/><stop offset=".6" stop-color="#3fb6ff" stop-opacity=".7"/><stop offset="1" stop-color="#3f6bff" stop-opacity="0"/></linearGradient>
  <linearGradient id="view" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1a3a"/><stop offset="1" stop-color="#02050d"/></linearGradient>
  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#3a4760" stroke-width="1"/></pattern>
  <pattern id="grate" width="6" height="10" patternUnits="userSpaceOnUse"><rect width="6" height="10" fill="#2b3446"/><rect x="1" y="1" width="4" height="8" fill="#141a26"/></pattern>`;
}
const STAGES = {
  life:[['临时伙房','一块电炉，一张折叠凳。先吃上饭再说。'],['泡面角','挂上小灯串，泡面也有了仪式感。'],['小餐桌','窗外是地球，墙上挂着全家福。'],['家常厨房','锅碗瓢盆挂满墙，像回到了家。'],['星际烧烤夜市','灯笼一挂，烤架一开，整艘船都闻到了孜然味。']],
  war: [['杂物间','几个箱子，一盏红灯。'],['训练室','靶子挂上墙，先练准头。'],['炮位','炮管伸出舷窗，警报灯随时待命。'],['战术指挥室','战术屏上，敌人一个都跑不掉。'],['名场面','主炮充能完毕，这一格要画成跨页。']],
  tech:[['旧驾驶台','拨杆和老屏幕，能飞就行。'],['导航台','星图亮起，航线一条一条画出来。'],['全息舰桥','全息地球在舰桥中央慢慢转。'],['量子计算室','数据环悬在半空，计算从不停。'],['曲率舰桥','舷窗外是曲率隧道，星光被拉成了线。']],
  med: [['急救角','一个药箱，一盏灯。'],['诊疗室','帘子拉上，心电图滴滴响。'],['疗养舱','有阳光，有绿植，适合慢慢好起来。'],['生物实验室','DNA 在全息屏上一圈一圈地转。'],['珍珠疗愈中心','珍珠光泡着每一位船员，累了就来躺一会儿。']],
};
const W0 = 280, H0 = 104, FY = 94;
const Z = '#0b0f17';
function stars(n, x0, y0, w, h, seed){ let s = '', q = seed; for (let i = 0; i < n; i++) { q = q * 16807 % 2147483647; const x = x0 + q % w; q = q * 16807 % 2147483647; const y = y0 + q % h; s += `<rect x="${x}" y="${y}" width="1.6" height="1.6" fill="#fff" opacity=".85"/>`; } return s; }
function porthole(x, y, r, inner){ return `<circle cx="${x}" cy="${y}" r="${r+4}" fill="url(#metalD)" stroke="${Z}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="${r}" fill="#081226"/>${inner || ''}<path d="M${x-r*.6} ${y-r*.5} q${r*.4} -${r*.35} ${r} -${r*.3}" stroke="#fff" stroke-width="1.6" opacity=".4" fill="none"/>`; }
function metalWall(c){ return `<rect width="${W0}" height="${H0}" fill="${c}"/><rect width="${W0}" height="${H0}" fill="url(#grid)" opacity=".6"/>`; }
function grate(){ return `<rect y="${FY}" width="${W0}" height="10" fill="url(#grate)"/>`; }
function woodFloor(c1, c2){ let s = `<rect y="${FY}" width="${W0}" height="10" fill="${c1}"/>`; for (let x = 0; x < W0; x += 28) s += `<path d="M${x} ${FY} v10" stroke="${c2}" stroke-width="1.2"/>`; return s + `<rect y="${FY}" width="${W0}" height="1.5" fill="#000" opacity=".25"/>`; }
const SCENE = {
  life:[
    // 1 临时伙房
    () => metalWall('#252b37') + `<path d="M150 0 v12" stroke="${Z}" stroke-width="1.5"/><circle cx="150" cy="16" r="4" fill="#ffcf7a"/><circle cx="150" cy="16" r="18" fill="#ffcf7a" opacity=".12"/>
      <rect x="196" y="28" width="60" height="6" fill="#56647d" stroke="${Z}" stroke-width="1.2"/><rect x="204" y="18" width="10" height="10" fill="#c8743a" stroke="${Z}"/><rect x="226" y="20" width="8" height="8" fill="#e9eef2" stroke="${Z}"/>` + grate(),
    // 2 泡面角
    () => metalWall('#2f2c33') + `<path d="M0 10 Q70 26 140 10 T280 10" fill="none" stroke="${Z}" stroke-width="1"/>${[14,40,66,96,122,152,180,208,236,262].map((x,i) => `<circle cx="${x}" cy="${12 + Math.sin(i*1.1)*5 + 5}" r="2.6" fill="${['#ffd23f','#ff8fab','#7df9ff'][i%3]}"/>`).join('')}
      <rect x="186" y="34" width="76" height="5" fill="#8a5a3a" stroke="${Z}" stroke-width="1.2"/>${[192,206,220,234,248].map((x,i) => `<path d="M${x} 34 l1 -12 h9 l1 12z" fill="${['#fffaf0','#e63946','#ffd23f','#fffaf0','#2a9d8f'][i]}" stroke="${Z}" stroke-width="1"/>`).join('')}
      <circle cx="140" cy="40" r="40" fill="#ffcf7a" opacity=".08"/>` + grate(),
    // 3 小餐桌
    () => `<rect width="${W0}" height="${H0}" fill="#6b4a33"/>${Array.from({length:14},(_,i) => `<rect x="${i*20}" y="0" width="20" height="${FY}" fill="${i%2 ? '#7a5539' : '#6b4a33'}"/>`).join('')}
      ${porthole(232, 34, 20, `<circle cx="240" cy="44" r="14" fill="#2f6fb5"/><path d="M232 38 q6-6 12 0 q-2 6-8 4z" fill="#6fbf73"/>${stars(6,214,18,30,14,5)}`)}
      <rect x="118" y="16" width="34" height="26" fill="#fffaf0" stroke="${Z}" stroke-width="2"/><rect x="122" y="20" width="26" height="18" fill="#bde0fe"/><circle cx="130" cy="30" r="3" fill="#c8743a"/><circle cx="138" cy="29" r="3" fill="#e58aa8"/><circle cx="144" cy="31" r="3" fill="#6b4fd8"/>
      <circle cx="160" cy="40" r="60" fill="#ffcf7a" opacity=".12"/>` + woodFloor('#8a5a3a','#5a3a22'),
    // 4 家常厨房
    () => `<rect width="${W0}" height="${H0}" fill="#7a5539"/><rect x="64" y="40" width="216" height="${FY-40}" fill="#f4efe2"/>${Array.from({length:18},(_,i) => `<path d="M${64 + i*12} 40 v${FY-40}" stroke="#d9d2c4" stroke-width="1"/>`).join('')}${[52,64,76].map(y => `<path d="M64 ${y} H280" stroke="#d9d2c4" stroke-width="1"/>`).join('')}
      <path d="M150 12 H270" stroke="${Z}" stroke-width="2"/>${[[160,10,'#7a7a72'],[186,8,'#c0583d'],[214,9,'#7a7a72'],[244,7,'#ffd23f']].map(([x,r,c]) => `<path d="M${x} 12 v6" stroke="${Z}" stroke-width="1.5"/><circle cx="${x}" cy="${20+r}" r="${r}" fill="${c}" stroke="${Z}" stroke-width="1.5"/>`).join('')}
      ${[100,128].map(x => `<path d="M${x} 0 v8" stroke="${Z}" stroke-width="1.5"/><path d="M${x-8} 16 h16 l-3 -8 h-10z" fill="#e63946" stroke="${Z}" stroke-width="1.2"/><path d="M${x-8} 16 l-14 40 h44 l-14 -40z" fill="#ffcf7a" opacity=".18"/>`).join('')}` + woodFloor('#a0522d','#6b3a1f') + `<rect x="70" y="${FY}" width="200" height="10" fill="#e63946" opacity=".75"/><path d="M70 ${FY+5} h200" stroke="#ffd23f" stroke-width="1.5" stroke-dasharray="6 4"/>`,
    // 5 星际烧烤夜市
    () => `<rect width="${W0}" height="${H0}" fill="#2b1838"/><rect width="${W0}" height="60" fill="#3d1f4f" opacity=".7"/>${stars(14,0,0,280,40,9)}
      <path d="M0 8 Q70 30 140 8 T280 8" fill="none" stroke="${Z}" stroke-width="1.2"/>${[18,46,74,104,132,160,190,218,246].map((x,i) => { const y = 14 + Math.abs(Math.sin((x/280)*Math.PI*2))*10; return `<path d="M${x} ${y-5} v3" stroke="${Z}"/><ellipse cx="${x}" cy="${y+3}" rx="6" ry="7" fill="#e63946" stroke="${Z}" stroke-width="1.2"/><ellipse cx="${x}" cy="${y+3}" rx="10" ry="10" fill="#ff6b6b" opacity=".25"/><path d="M${x-4} ${y-2}h8M${x-4} ${y+8}h8" stroke="#ffd23f" stroke-width="1.5"/>`; }).join('')}
      <g transform="translate(176 32)"><rect width="88" height="22" rx="4" fill="#1a0f22" stroke="#ff8fab" stroke-width="2"/><text x="44" y="16" text-anchor="middle" font-size="13" font-weight="900" fill="#ffd1e0" style="paint-order:stroke" stroke="#ff4f8b" stroke-width="2.5">77 星际烧烤</text></g>
      <path d="M120 50 q-6 -10 2 -18 q8 -8 0 -18 M136 52 q-6 -10 2 -18 q8 -8 0 -18" stroke="#fff" stroke-width="3" opacity=".2" fill="none" stroke-linecap="round"/>
      <rect y="60" width="${W0}" height="${FY-60}" fill="#ffb347" opacity=".14"/>` + woodFloor('#6b3a1f','#3d2010') + `<rect y="${FY}" width="${W0}" height="2" fill="#ffd23f" opacity=".7"/>`,
  ],
  war:[
    () => metalWall('#1b1820') + `<g stroke="${Z}" stroke-width="1.5"><rect x="194" y="54" width="34" height="40" fill="#5a4a3a"/><rect x="230" y="64" width="30" height="30" fill="#6b5844"/><rect x="204" y="30" width="26" height="24" fill="#4a3c30"/></g><path d="M194 70 h34 M230 78 h30" stroke="${Z}"/>
      <circle cx="150" cy="14" r="5" fill="#ff3b3b"/><circle cx="150" cy="14" r="22" fill="#ff3b3b" opacity=".12"/>` + grate(),
    () => metalWall('#1c1626') + `<rect y="38" width="${W0}" height="6" fill="#ff3b3b" opacity=".75"/>
      <g transform="translate(222 30)">${[18,13,8,3].map((r,i) => `<circle r="${r}" fill="${i%2 ? '#fff' : '#ff3b3b'}" stroke="${Z}" stroke-width="1.2"/>`).join('')}</g>
      <rect x="110" y="12" width="70" height="4" fill="#56647d"/>${[118,132,146,160,172].map(x => `<rect x="${x}" y="16" width="5" height="26" rx="2" fill="#3a4556" stroke="${Z}"/>`).join('')}` + grate(),
    () => `<rect width="${W0}" height="${H0}" fill="#1d1a24"/>${Array.from({length:8},(_,i) => `<rect x="${i*36}" y="0" width="34" height="${FY}" fill="#262230" stroke="#3a3446" stroke-width="1.5"/><circle cx="${i*36+5}" cy="6" r="1.5" fill="#56647d"/><circle cx="${i*36+29}" cy="6" r="1.5" fill="#56647d"/>`).join('')}
      <rect x="182" y="10" width="92" height="44" rx="6" fill="url(#view)" stroke="url(#metalD)" stroke-width="4"/>${stars(10,186,14,84,36,4)}<path d="M200 46 L270 22" stroke="#4a5466" stroke-width="9" stroke-linecap="round"/><path d="M200 46 L270 22" stroke="#8a95a8" stroke-width="3" stroke-linecap="round"/>
      <rect y="${FY-8}" width="${W0}" height="8" fill="url(#hazard)"/>${[150,170].map(x => `<circle cx="${x}" cy="14" r="5" fill="#ff3b3b"/><circle cx="${x}" cy="14" r="16" fill="#ff3b3b" opacity=".18"/>`).join('')}` + grate(),
    () => `<rect width="${W0}" height="${H0}" fill="#140f22"/>${Array.from({length:10},(_,i) => `<path d="M${i*30} 70 l15 -10 l15 10" fill="none" stroke="#2c2340" stroke-width="5"/>`).join('')}
      <g transform="translate(112 10)"><rect width="160" height="54" rx="4" fill="#0d0a1a" stroke="#9b5de5" stroke-width="2"/><rect x="4" y="4" width="152" height="46" fill="#9b5de5" opacity=".14"/>
        <circle cx="40" cy="27" r="20" fill="none" stroke="#c9a7ff" stroke-width="1" opacity=".7"/><circle cx="40" cy="27" r="10" fill="none" stroke="#c9a7ff" stroke-width="1" opacity=".7"/><path d="M40 27 L58 16" stroke="#c9a7ff" stroke-width="2"/><path d="M40 27 L58 16 A20 20 0 0 1 60 27z" fill="#c9a7ff" opacity=".35"/>
        ${[[52,12],[28,38],[48,40]].map(([x,y]) => `<path d="M${x} ${y-3} l3 5 h-6z" fill="#ff3b3b"/>`).join('')}
        <path d="M76 12 h70 M76 20 h50 M76 28 h60 M76 36 h40" stroke="#c9a7ff" stroke-width="2" opacity=".7"/><rect x="76" y="42" width="${40}" height="4" fill="#ff3b3b"/></g>
      <rect y="70" width="${W0}" height="24" fill="#9b5de5" opacity=".1"/>` + grate() + `<rect y="${FY}" width="${W0}" height="1.5" fill="#9b5de5"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="#1a0b1f"/><rect width="${W0}" height="${H0}" fill="url(#redsky)"/>
      <g opacity=".5">${Array.from({length:22},(_,i) => { const a = -Math.PI*0.95 + i*Math.PI*0.9/21; return `<path d="M236 40 L${236 + Math.cos(a)*320} ${40 + Math.sin(a)*320} L${236 + Math.cos(a+0.03)*320} ${40 + Math.sin(a+0.03)*320}z" fill="${i%2 ? '#ff3b3b' : '#9b5de5'}"/>`; }).join('')}</g>
      <circle cx="236" cy="40" r="30" fill="url(#glow)"/><circle cx="236" cy="40" r="14" fill="#fff"/><circle cx="236" cy="40" r="20" fill="none" stroke="#c9a7ff" stroke-width="3"/>
      <path d="M150 62 L220 46" stroke="#2c2340" stroke-width="16" stroke-linecap="round"/><path d="M150 62 L220 46" stroke="#5a4a78" stroke-width="6" stroke-linecap="round"/>
      <g transform="translate(110 14)"><path d="M0 0 h22 v14 l-11 8 l-11 -8z" fill="#ffd23f" stroke="${Z}" stroke-width="1.5"/><path d="M11 4 l2 4 h4 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 h4z" fill="#e63946"/></g>` + grate() + `<rect y="${FY}" width="${W0}" height="2" fill="#ff3b3b"/>`,
  ],
  tech:[
    () => metalWall('#20262f') + `<g transform="translate(180 16)"><rect width="84" height="46" rx="3" fill="#3a4556" stroke="${Z}" stroke-width="1.5"/><rect x="6" y="6" width="34" height="24" rx="5" fill="#0f2a1a" stroke="${Z}"/><path d="M10 20 q6 -8 12 0 t12 0" stroke="#39ff88" stroke-width="1.5" fill="none"/>
      ${[46,56,66,76].map(x => `<rect x="${x}" y="8" width="5" height="12" fill="#56647d"/><rect x="${x}" y="8" width="5" height="4" fill="${x % 20 ? '#e63946' : '#ffd23f'}"/>`).join('')}${[48,60,72].map(x => `<circle cx="${x}" cy="32" r="3" fill="#ffd23f"/>`).join('')}</g>
      <path d="M120 0 q8 30 0 50 M134 0 q-6 22 4 40" stroke="${Z}" stroke-width="2" fill="none"/>` + grate(),
    () => metalWall('#16202e') + `<g transform="translate(150 10)"><rect width="124" height="52" rx="4" fill="#06101e" stroke="#2f6fb5" stroke-width="2"/>${stars(16,154,14,116,44,12)}
      <path d="M14 40 L40 24 L70 30 L100 12" stroke="${CY}" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>${[[14,40],[40,24],[70,30],[100,12]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${CY}"/>`).join('')}</g>` + grate() + `<rect y="${FY}" width="${W0}" height="1.5" fill="${CY}" opacity=".6"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="#1a2433"/><path d="M0 ${FY} Q140 -30 280 ${FY}" fill="#c9d2de" opacity=".12"/><path d="M20 ${FY} Q140 0 260 ${FY}" fill="none" stroke="#c9d2de" stroke-width="1.5" opacity=".35"/>
      <g transform="translate(150 40)"><circle r="26" fill="${CY}" opacity=".1"/><circle r="22" fill="none" stroke="${CY}" stroke-width="1.5"/><ellipse rx="22" ry="8" fill="none" stroke="${CY}" stroke-width="1"/><ellipse rx="10" ry="22" fill="none" stroke="${CY}" stroke-width="1"/><path d="M-22 0 H22" stroke="${CY}"/><path d="M-12 -6 q8 -6 14 2 q-4 6 -10 4z" fill="${CY}" opacity=".6"/></g>
      ${[[200,12],[236,22]].map(([x,y]) => `<rect x="${x}" y="${y}" width="34" height="22" rx="2" fill="${CY}" opacity=".12" stroke="${CY}" stroke-width="1"/><path d="M${x+4} ${y+8} h20 M${x+4} ${y+14} h14" stroke="${CY}" stroke-width="1.2"/>`).join('')}
      <path d="M150 ${FY} l-18 -28 h36z" fill="${CY}" opacity=".12"/>` + grate() + `<ellipse cx="150" cy="${FY}" rx="22" ry="3" fill="${CY}" opacity=".7"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="#07101f"/>${[[90,'#3fb6ff'],[200,'#7df9ff'],[262,'#9b5de5']].map(([x,c]) => `<rect x="${x-5}" y="0" width="10" height="${FY}" fill="${c}" opacity=".12"/><rect x="${x-1}" y="0" width="2" height="${FY}" fill="${c}" opacity=".6"/>`).join('')}
      <g transform="translate(160 42)">${[30,22,14].map((r,i) => `<ellipse rx="${r}" ry="${r*0.3}" cy="${-i*10}" fill="none" stroke="${CY}" stroke-width="1.6" stroke-dasharray="${6+i*2} 3"/>`).join('')}<circle cy="-24" r="5" fill="#fff"/><circle cy="-24" r="12" fill="url(#glow)"/></g>
      ${Array.from({length:6},(_,i) => `<text x="${206 + (i%2)*30}" y="${16 + i*8}" font-size="6" fill="${CY}" opacity=".7" font-family="ui-monospace,monospace">${['0x7F3A','01101','Δv=3.2','λ 0.92','qbit:8','∑ OK'][i]}</text>`).join('')}` + grate() + `<rect y="${FY}" width="${W0}" height="1.5" fill="${CY}"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="url(#whitesci)"/>
      <g transform="translate(182 8)"><rect width="92" height="56" rx="12" fill="#030713" stroke="#e8fbff" stroke-width="3"/><g opacity=".9">${Array.from({length:26},(_,i) => { const a = i/26*Math.PI*2; return `<path d="M46 28 L${(46 + Math.cos(a)*52).toFixed(1)} ${(28 + Math.sin(a)*34).toFixed(1)}" stroke="${['#fff','#7df9ff','#c9a7ff'][i%3]}" stroke-width="${i%3 ? 1 : 1.6}"/>`; }).join('')}</g><circle cx="46" cy="28" r="6" fill="#fff"/><circle cx="46" cy="28" r="14" fill="url(#glow)"/></g>
      ${[[96,14,44,26],[140,30,34,20]].map(([x,y,w,h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#7df9ff" opacity=".18" stroke="#3fb6ff" stroke-width="1"/><path d="M${x+5} ${y+8} h${w-14} M${x+5} ${y+14} h${w-20}" stroke="#3fb6ff" stroke-width="1.2"/>`).join('')}
      ${[0,1,2].map(i => `<ellipse cx="150" cy="${FY - 2 - i*3}" rx="${60 - i*16}" ry="${5 - i}" fill="none" stroke="#3fb6ff" stroke-width="1.2" opacity="${.8 - i*.2}"/>`).join('')}
      <rect y="${FY}" width="${W0}" height="10" fill="#d6f4ff"/><rect y="${FY}" width="${W0}" height="2" fill="#3fb6ff"/>`,
  ],
  med:[
    () => metalWall('#262c37') + `<g transform="translate(200 18)"><rect width="44" height="40" rx="3" fill="#e9eef2" stroke="${Z}" stroke-width="1.5"/><path d="M22 10 v20 M12 20 h20" stroke="#e63946" stroke-width="5"/></g><circle cx="150" cy="14" r="4" fill="#e9eef2"/><circle cx="150" cy="14" r="20" fill="#fff" opacity=".1"/>` + grate(),
    () => `<rect width="${W0}" height="${H0}" fill="#e3e9ef"/><rect y="0" width="${W0}" height="8" fill="#c9d2de"/>
      <path d="M86 8 q6 30 0 60 q6 10 0 26 h-6 V8z" fill="#ffc4d6" stroke="${Z}" stroke-width="1.2"/><path d="M86 8 H280" stroke="#7a7a72" stroke-width="2"/>
      <g transform="translate(196 14)"><rect width="66" height="38" rx="3" fill="#0f1c24" stroke="${Z}" stroke-width="1.5"/><path d="M4 22 h14 l4 -10 l5 18 l4 -12 l3 4 h30" stroke="#39ff88" stroke-width="1.6" fill="none"/></g>` + `<rect y="${FY}" width="${W0}" height="10" fill="#b8c4d2"/><rect y="${FY}" width="${W0}" height="1.5" fill="#7a8899"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="#fde8ef"/>${porthole(226, 34, 20, `<circle cx="226" cy="34" r="20" fill="#ffd6a5"/><circle cx="234" cy="28" r="6" fill="#fff6c2"/>`)}
      <path d="M226 34 l-60 60 h-40 l80 -80z" fill="#fff6c2" opacity=".35"/>
      ${[100,140].map(x => `<path d="M${x} 0 v10" stroke="${Z}" stroke-width="1.2"/><path d="M${x-9} 10 h18 l-3 10 h-12z" fill="#c8743a" stroke="${Z}" stroke-width="1.2"/><path d="M${x-8} 20 q-4 10 0 18 M${x} 20 q2 12 -2 20 M${x+7} 20 q5 8 2 16" stroke="#2a9d8f" stroke-width="3" fill="none" stroke-linecap="round"/>`).join('')}` + `<rect y="${FY}" width="${W0}" height="10" fill="#f3c9d6"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="#e6f6f4"/><rect width="${W0}" height="${H0}" fill="url(#grid)" opacity=".15"/>
      <g transform="translate(150 6)">${Array.from({length:12},(_,i) => { const y = i*6, x1 = Math.sin(i*0.7)*14, x2 = -x1; return `<path d="M${x1.toFixed(1)} ${y} H${x2.toFixed(1)}" stroke="#9fb0cc" stroke-width="1.2"/><circle cx="${x1.toFixed(1)}" cy="${y}" r="2.4" fill="#e58aa8"/><circle cx="${x2.toFixed(1)}" cy="${y}" r="2.4" fill="#3fb6ff"/>`; }).join('')}</g>
      <g transform="translate(200 24)"><rect width="66" height="5" fill="#9fb0cc" stroke="${Z}"/>${[6,18,30,42,54].map((x,i) => `<rect x="${x}" y="-18" width="7" height="18" rx="3" fill="#fff" stroke="${Z}" stroke-width="1"/><rect x="${x}" y="${-8 + i}" width="7" height="${8 - i}" fill="${['#e58aa8','#3fb6ff','#80ed99','#ffd23f','#9b5de5'][i]}"/>`).join('')}</g>` + `<rect y="${FY}" width="${W0}" height="10" fill="#c7e6e2"/>`,
    () => `<rect width="${W0}" height="${H0}" fill="url(#pearlsky)"/>${[0,1,2].map(i => `<path d="M${60 + i*6} ${FY} A${120 - i*14} ${80 - i*12} 0 0 1 ${300 - i*6} ${FY}" fill="none" stroke="${['#ffc4d6','#c9a7ff','#a5f3ff'][i]}" stroke-width="5" opacity=".55"/>`).join('')}
      ${[[100,14],[208,10],[244,18]].map(([x,y]) => `<rect x="${x}" y="${y}" width="22" height="${FY-y-8}" rx="11" fill="#ffffff" fill-opacity=".45" stroke="#e58aa8" stroke-width="1.5"/>${[0,1,2,3].map(j => `<circle cx="${x + 6 + (j%2)*9}" cy="${y + 14 + j*12}" r="${3 + (j%2)}" fill="#fff" stroke="#e58aa8" stroke-width="1"/>`).join('')}<circle cx="${x+11}" cy="${y+8}" r="16" fill="url(#glow)" opacity=".5"/>`).join('')}
      <text x="150" y="26" font-size="12" fill="#e58aa8">✦</text><text x="178" y="16" font-size="9" fill="#c9a7ff">✦</text>` + `<rect y="${FY}" width="${W0}" height="10" fill="#ffd6e5"/><rect y="${FY}" width="${W0}" height="1.5" fill="#e58aa8"/>`,
  ],
};
function sceneDefs(){
  return `<pattern id="hazard" width="12" height="8" patternUnits="userSpaceOnUse" patternTransform="skewX(-30)"><rect width="12" height="8" fill="#141414"/><rect width="6" height="8" fill="#ffd23f"/></pattern>
  <linearGradient id="redsky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d0b1f" stop-opacity=".8"/><stop offset="1" stop-color="#1b0b38" stop-opacity=".9"/></linearGradient>
  <linearGradient id="whitesci" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4fdff"/><stop offset="1" stop-color="#b6ecff"/></linearGradient>
  <linearGradient id="pearlsky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0f6"/><stop offset=".6" stop-color="#f3e8ff"/><stop offset="1" stop-color="#e0f7ff"/></linearGradient>`;
}
function roomInner(k, lv, opt){
  opt = opt || {};
  let g = SCENE[k][lv-1]();
  if (!opt.bare) {
    IT[k].forEach((svg, i) => {
      const owned = !!S.items[k + ':' + (i+1)];
      g += `<g transform="translate(${70 + i*40} ${FY-44})" class="${owned ? 'own' : 'ghost'}" stroke="#0b0f17" stroke-width="2.2" stroke-linejoin="round">${owned ? `<ellipse cx="19" cy="44" rx="16" ry="3" fill="#7df9ff" opacity=".35" stroke="none"/>` : ''}${svg}</g>`;
    });
  }
  g += `<use href="#ceo-${k}" x="2" y="${FY-70}" width="58" height="72"/>`;
  return g;
}
function roomSvg(k, y, sel){
  const lv = S.lv[k], R = ROOM[k], c = SYSK[k].hex, W = W0, H = H0;
  let g = `<g transform="translate(30 ${y})" data-room="${k}" class="room"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" overflow="hidden">${roomInner(k, lv)}</svg>`;
  g += `<g transform="translate(${W-12} 60)">${[0,1,2,3,4].map(i => `<rect x="0" y="${-i*8}" width="6" height="5" fill="${i < lv ? '#39ff88' : '#3a4556'}" stroke="#0b0f17" stroke-width=".8"/>`).join('')}</g>`;
  g += `<rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="${lv >= 5 ? c : '#5a6578'}" stroke-width="${lv >= 5 ? 2.5 : 2}"/>`;
  if (sel) g += `<path d="M2 16 V2 H16 M${W-16} 2 H${W-2} V16 M${W-2} ${H-16} V${H-2} H${W-16} M16 ${H-2} H2 V${H-16}" fill="none" stroke="${CY}" stroke-width="3.5"/>`;
  const label = `${R.en} · ${R.name}`;
  g += `<g transform="translate(6 4)"><rect width="${label.length*7 + 40}" height="16" fill="#0a1424" fill-opacity=".85" stroke="${CY}" stroke-width="1"/><rect width="3" height="16" fill="${c}"/><text x="8" y="11.5" font-size="9.5" font-weight="700" fill="${CY}" font-family="ui-monospace,Menlo,Consolas,monospace" letter-spacing=".5">${label}  LV${lv}</text></g>`;
  return g + `</g>`;
}
function shipSvg(sel){
  const flame = 30 + stat(S,'speed') * 160, Ht = 600 + Math.ceil(flame);
  let s = `<svg class="ship" viewBox="0 0 340 ${Ht}" role="img" aria-label="飞船内部"><rect width="340" height="${Ht}" fill="url(#deep)"/>`;
  let seed = 11; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 70; i++) s += `<circle cx="${(r()*340).toFixed(1)}" cy="${(r()*Ht).toFixed(1)}" r="${r() < .12 ? 1.4 : .7}" fill="#fff" opacity="${(.3 + r()*.6).toFixed(2)}"/>`;
  s += `<circle cx="340" cy="${Ht - 40}" r="90" fill="#24406e" opacity=".55"/><circle cx="340" cy="${Ht - 40}" r="90" fill="none" stroke="#7fb4ff" stroke-width="2" opacity=".35"/>`;
  // 侧翼
  s += `<path d="M22 430 L0 520 L0 560 L22 548z M318 430 L340 520 L340 560 L318 548z" fill="url(#metalD)" stroke="#0b0f17" stroke-width="2"/><path d="M4 532 h14 M322 532 h14" stroke="#e63946" stroke-width="4"/>`;
  // 船体
  s += `<path d="M20 86 Q170 -40 320 86 V552 H20z" fill="url(#metal)" stroke="#0b0f17" stroke-width="2.5"/>`;
  s += `<path d="M20 86 Q170 -40 320 86" fill="none" stroke="#fff" stroke-width="1.5" opacity=".6"/>`;
  for (let yy = 100; yy < 550; yy += 22) s += `<circle cx="25" cy="${yy}" r="1.6" fill="#4a5466"/><circle cx="315" cy="${yy}" r="1.6" fill="#4a5466"/>`;
  // 驾驶舱玻璃罩
  s += `<path d="M110 70 Q170 2 230 70z" fill="url(#dome)" stroke="#0b0f17" stroke-width="2.5"/><path d="M128 56 Q150 26 178 22" stroke="#fff" stroke-width="3" opacity=".5" fill="none" stroke-linecap="round"/>`;
  s += `<rect x="150" y="74" width="40" height="6" rx="3" fill="#0b111c"/><rect x="152" y="75.5" width="${6 + sum(S)*1.6}" height="3" fill="#39ff88"/>`;
  FLOORS.forEach((k, i) => s += roomSvg(k, 88 + i*114, sel === k));
  // 引擎段
  s += `<rect x="20" y="546" width="300" height="16" fill="url(#metalD)" stroke="#0b0f17" stroke-width="2"/>`;
  [100, 170, 240].forEach(x => {
    const big = x === 170, w = big ? 36 : 24, f = big ? flame : flame * .7;
    s += `<path d="M${x - w/2 + 4} 562 L${x - w/2 - 4} ${582} H${x + w/2 + 4} L${x + w/2 - 4} 562z" fill="url(#metalD)" stroke="#0b0f17" stroke-width="2"/>`;
    s += `<path d="M${x - w/2} 582 Q${x} ${582 + f*2} ${x + w/2} 582z" fill="url(#plasma)"/><ellipse cx="${x}" cy="583" rx="${w/2}" ry="3" fill="#fff" opacity=".9"/>`;
  });
  return s + `</svg>`;
}
function sum(s){ return s.lv.life + s.lv.med + s.lv.war + s.lv.tech; }
function itemPower(tier, star){ return tier * 0.04 * (1 + 0.5*(star-1)); }
function stat(s, which){
  const map = {cargo:'life', med:'med', shield:'war', speed:'tech', radar:'tech'};
  let v = 0;
  Object.keys(s.items).forEach(id => { const [k,t] = id.split(':'); if (k === map[which]) v += itemPower(+t, s.items[id]); });
  if (which === 'radar' || which === 'speed') v *= 0.6;
  return Math.min(0.6, v);
}
function pct(x){ return Math.round(x*100) + '%'; }
function unlocked(r){
  if (ORDER.some(k => S.lv[k] < RING_MIN[r.ring])) return false;
  if (sum(S) < RING_SUM[r.ring]) return false;
  if (r.need && S.lv[r.need[0]] < r.need[1]) return false;
  if (r.needAll && SYS.some(s => S.lv[s.k] < r.needAll)) return false;
  return true;
}
const REAL_STYLE = '画风与现有 CEO 头像（art/ceo_*.webp）一致：日系手绘、柔和暖光、细腻写实、米白纸感；横版 4:3，1200×900；人物就是这位 CEO，发型服装参照头像；画面里不出现文字和标志。';
const REAL = {
  life:['飞船狭小的金属储物间，便携电炉上煮着一小锅面，77 坐在折叠凳上捧着碗吹气，头顶一盏昏黄小灯，舱壁有铆钉和管线。',
        '金属舱壁上挂起彩色小灯串，木搁板上排着一排泡面杯，77 掀开泡面盖子闻香味，表情满足，暖光。',
        '木纹墙板的小餐厅，圆形舷窗外是蓝色地球，墙上挂着四位 CEO 的合影，77 端着一锅热汤放到小方桌上。',
        '白瓷砖墙，挂杆上挂满铜锅铁勺，两盏红色吊灯，红色地毯，77 系着围裙在灶台前翻炒，锅里冒出热气。',
        '飞船里布置成夜市：一串串红灯笼、发着粉光的霓虹招牌（不画字）、烤架上的肉串冒着烟，77 双手拿夹子翻串，窗外是星空，热闹又温暖。'],
  war: ['昏暗的货舱，堆着几个旧木箱，一盏红色警示灯，阿宅坐在箱子上翻漫画。',
        '墙上挂着红白靶子和一排训练武器架，阿宅戴着耳机举着训练光枪瞄准，表情认真。',
        '装甲板墙面、黄黑警戒条，炮管从舷窗伸向星空，阿宅坐在炮手座椅上握着操纵杆，红色警报灯亮着。',
        '巨大的紫色全息战术屏，雷达扫过，红色三角标出敌舰，阿宅站在屏前推了推眼镜，嘴角带笑。',
        '红紫色放射光，主炮在窗外充能发出耀眼白光，阿宅侧身站立、外套被气流吹起、一只手指向前方，漫画跨页式的帅气构图。'],
  tech:['老式驾驶台，满是拨杆、按钮和绿色老显示器，垂下几根电缆，火箭老板拿着扳手在修。',
        '深蓝色舰桥，大屏上是星图和一条条青色航线，火箭老板用手指在屏幕上画航线。',
        '弧形白色控制台，中央悬浮着青色全息地球，火箭老板张开手转动全息地球。',
        '黑暗空间里几根发光光柱，空中悬浮着一圈圈数据环，火箭老板仰头看数据环，脸被蓝光照亮。',
        '通体白色与青色发光的未来舰桥，前方巨大舷窗外是星光被拉成线的曲率隧道，火箭老板站在舰长位，手里拿着小火箭模型，超未来感。'],
  med: ['狭小舱室里一个白色急救箱和一盏灯，珍珠姐踮脚从柜子里取药箱。',
        '浅色诊疗室，粉色帘子半拉，心电监护仪显示绿色波形，珍珠姐拿着记录板微笑。',
        '粉色调的房间，圆窗外阳光照进来，吊着几盆绿植，珍珠姐给植物浇水。',
        '浅青色实验室，全息屏上旋转着 DNA 双螺旋，试管架里五种颜色的液体，珍珠姐举起一支试管对着光看。',
        '粉紫渐变的梦幻空间，几根透明玻璃舱里漂着发光的珍珠，彩虹光弧，珍珠姐端着一杯珍珠奶茶坐在疗愈舱边。'],
};
const ROUTE_INFO = {
  moon:   {desc:'离地球最近的一站，月坑边适合烤串。', ceo:'life'},
  station:{desc:'一座废弃的空间站，灯还亮着一半。', ceo:'war'},
  mars:   {desc:'红色峡谷，风很大，听说有人住。', ceo:'tech'},
  venus:  {desc:'浓云上面漂着一座城。', ceo:'med'},
  belt:   {desc:'满天的石头，有的会发光。', ceo:'life'},
  pirate: {desc:'雷达经常收到奇怪的求救。', ceo:'war'},
  europa: {desc:'冰层下面有光在动。', ceo:'life'},
  saturn: {desc:'光环是冰和石头，还有别的东西。', ceo:'tech'},
  signal: {desc:'一个重复了很多年的信号，第一次有人回应。', ceo:'med'},
};
function planet(id, r){
  const sh = `<circle r="${r}" fill="url(#pshade)"/>`;
  switch (id) {
    case 'moon': return `<circle r="${r}" fill="#c9ccd3"/>${[[-.35,-.2,.22],[.3,.25,.16],[.1,-.45,.1],[-.1,.4,.12],[.45,-.15,.08]].map(([x,y,s]) => `<circle cx="${x*r}" cy="${y*r}" r="${s*r}" fill="#a3a8b2"/><circle cx="${x*r+s*r*.2}" cy="${y*r+s*r*.2}" r="${s*r*.75}" fill="#b4b8c1"/>`).join('')}${sh}`;
    case 'station': return `<ellipse rx="${r*1.35}" ry="${r*.45}" fill="none" stroke="#9aa5b5" stroke-width="${r*.22}"/><ellipse rx="${r*1.35}" ry="${r*.45}" fill="none" stroke="#dfe6ee" stroke-width="${r*.08}" stroke-dasharray="${r*.5} ${r*.2}"/><rect x="${-r*.28}" y="${-r*.7}" width="${r*.56}" height="${r*1.4}" rx="${r*.15}" fill="#cfd8e3" stroke="#56647d" stroke-width="1"/><rect x="${-r*1.2}" y="${-r*.95}" width="${r*.7}" height="${r*.35}" fill="#2f6fb5" stroke="#9fe8ff" stroke-width=".8" transform="rotate(-12)"/><rect x="${r*.5}" y="${r*.55}" width="${r*.6}" height="${r*.3}" fill="#2f6fb5" stroke="#9fe8ff" stroke-width=".8" transform="rotate(20)"/><circle cx="0" cy="${-r*.3}" r="${r*.1}" fill="#ffd23f"/>`;
    case 'mars': return `<circle r="${r}" fill="#c8553d"/><path d="M${-r*.9} ${r*.1} q${r*.5} ${-r*.3} ${r} ${r*.05} t${r*.8} ${-r*.1}" stroke="#7a2e1f" stroke-width="${r*.12}" fill="none"/><ellipse cx="${r*.1}" cy="${-r*.82}" rx="${r*.45}" ry="${r*.16}" fill="#f6efe8"/><circle cx="${-r*.4}" cy="${r*.45}" r="${r*.18}" fill="#a94431"/>${sh}`;
    case 'venus': return `<circle r="${r}" fill="#e9c46a"/>${[-.5,-.15,.2,.55].map((y,i) => `<path d="M${-r} ${y*r} q${r*.5} ${(i%2?-1:1)*r*.18} ${r} 0 t${r} 0" stroke="${i%2 ? '#f6e2a8' : '#d4a94a'}" stroke-width="${r*.16}" fill="none" opacity=".8"/>`).join('')}<circle r="${r}" fill="none" stroke="#fff3c4" stroke-width="${r*.12}" opacity=".35"/>${sh}`;
    case 'belt': return [[-.7,-.3,.38,'#8a7766'],[.2,-.5,.3,'#a08b77'],[.6,.2,.42,'#7a6a5c'],[-.2,.45,.3,'#94816f'],[.95,-.55,.16,'#a08b77'],[-1.05,.35,.18,'#7a6a5c']].map(([x,y,s,c],i) => `<path d="M${(x-s)*r} ${y*r} l${s*r*.6} ${-s*r*.9} l${s*r*1.1} ${s*r*.2} l${s*r*.3} ${s*r*.9} l${-s*r} ${s*r*.6}z" fill="${c}" stroke="#4a3f36" stroke-width="1"/>${i===2 ? `<circle cx="${x*r}" cy="${y*r}" r="${r*.07}" fill="#7df9ff"/><circle cx="${x*r}" cy="${y*r}" r="${r*.25}" fill="#7df9ff" opacity=".25"/>` : ''}`).join('');
    case 'pirate': return `<circle r="${r*1.2}" fill="#6b2d5c" opacity=".55"/><circle cx="${r*.4}" cy="${-r*.3}" r="${r*.8}" fill="#9b2c3c" opacity=".45"/><circle cx="${-r*.5}" cy="${r*.3}" r="${r*.7}" fill="#3d1f6b" opacity=".6"/><g transform="translate(${-r*.1} ${r*.05})"><path d="M${-r*.55} 0 h${r*1.1} l${-r*.2} ${r*.3} h${-r*.7}z" fill="#1a1020" stroke="#ff3b3b" stroke-width=".8"/><path d="M0 0 v${-r*.7}" stroke="#ddd" stroke-width="1"/><path d="M0 ${-r*.7} h${r*.45} v${r*.3} h${-r*.45}z" fill="#141414" stroke="#ddd" stroke-width=".6"/><circle cx="${r*.22}" cy="${-r*.55}" r="${r*.07}" fill="#fff"/></g>`;
    case 'europa': return `<circle r="${r}" fill="#e3edf5"/><path d="M${-r*.8} ${-r*.3} l${r*.5} ${r*.2} l${r*.4} ${-r*.3} l${r*.6} ${r*.3} M${-r*.6} ${r*.4} l${r*.4} ${-r*.2} l${r*.5} ${r*.4} l${r*.4} ${-r*.2} M${-r*.1} ${-r*.8} l${r*.15} ${r*.5}" stroke="#b5654a" stroke-width="${r*.05}" fill="none" opacity=".75"/><circle cx="${r*.2}" cy="${r*.1}" r="${r*.18}" fill="#7df9ff" opacity=".35"/>${sh}`;
    case 'saturn': return `<ellipse rx="${r*1.75}" ry="${r*.5}" fill="none" stroke="#c9b48a" stroke-width="${r*.22}" opacity=".9" transform="rotate(-16)"/><circle r="${r}" fill="#e0c68f"/>${[-.4,0,.35].map(y => `<path d="M${-r} ${y*r} h${2*r}" stroke="#c9a96b" stroke-width="${r*.12}" opacity=".7"/>`).join('')}${sh}<path d="M${-r*1.68} ${r*.2} A${r*1.75} ${r*.5} 0 0 0 ${r*1.68} ${-r*.2}" fill="none" stroke="#d9c69c" stroke-width="${r*.22}" transform="rotate(-16)"/>`;
    case 'signal': return `<g class="pulse">${[1.3,.95,.6].map((s,i) => `<circle r="${r*s}" fill="none" stroke="#7df9ff" stroke-width="${1.6 - i*.3}" opacity="${.35 + i*.2}"/>`).join('')}</g><circle r="${r*.32}" fill="#fff"/><circle r="${r*.9}" fill="url(#glow)"/><path d="M${-r*1.5} 0 h${r*.6} M${r*.9} 0 h${r*.6} M0 ${-r*1.5} v${r*.6} M0 ${r*.9} v${r*.6}" stroke="#7df9ff" stroke-width="1.2"/>`;
  }
  return '';
}
function spaceDefs(){
  return `<radialGradient id="pshade" cx=".35" cy=".32" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <radialGradient id="earthG" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#4f9de0"/><stop offset=".7" stop-color="#1f5fa8"/><stop offset="1" stop-color="#0e2f63"/></radialGradient>
  <radialGradient id="atmo" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#7fd0ff" stop-opacity="0"/><stop offset=".93" stop-color="#7fd0ff" stop-opacity=".55"/><stop offset="1" stop-color="#7fd0ff" stop-opacity="0"/></radialGradient>
  <symbol id="shipic" viewBox="-10 -14 20 28"><path d="M0 -13 q7 8 7 18 v5 h-14 v-5 q0-10 7-18z" fill="#eef2f7" stroke="#0b0f17" stroke-width="1.5"/><circle cy="-3" r="2.6" fill="#3fb6ff" stroke="#0b0f17"/><path d="M-7 4 l-3 6 h3z M7 4 l3 6 h-3z" fill="#e63946" stroke="#0b0f17" stroke-width="1"/><path d="M-4 10 q4 8 8 0z" fill="#7df9ff"/></symbol>`;
}
const MAP_W = 340, MAP_H = 470, MCX = 170, MCY = 500, MR = [128, 196, 262, 328, 398];
function nodePos(rt){
  const same = ROUTES.filter(x => x.ring === rt.ring), idx = same.indexOf(rt);
  const a = same.length === 1 ? 0 : (idx === 0 ? -1 : 1) * (rt.ring === 0 ? .52 : rt.ring === 3 ? .4 : .44);
  const R = MR[rt.ring];
  return [MCX + R * Math.sin(a), MCY - R * Math.cos(a)];
}
let VOYPATH = null;
function voyPoint(p){
  if (!VOYPATH) return [0,0,0];
  const {x0,y0,cx,cy,x1,y1} = VOYPATH, q = 1 - p;
  const x = q*q*x0 + 2*q*p*cx + p*p*x1, y = q*q*y0 + 2*q*p*cy + p*p*y1;
  const dx = 2*q*(cx-x0) + 2*p*(x1-cx), dy = 2*q*(cy-y0) + 2*p*(y1-cy);
  return [x, y, Math.atan2(dy, dx) * 180 / Math.PI + 90];
}
function mapSvg(){
  let s = `<svg class="mapsvg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="星图"><rect width="${MAP_W}" height="${MAP_H}" fill="url(#deep)"/>`;
  let seed = 23; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 110; i++) s += `<circle cx="${(r()*MAP_W).toFixed(1)}" cy="${(r()*MAP_H).toFixed(1)}" r="${r() < .1 ? 1.3 : .6}" fill="#fff" opacity="${(.25 + r()*.65).toFixed(2)}"/>`;
  s += `<ellipse cx="250" cy="120" rx="120" ry="40" fill="#6b4fd8" opacity=".08" transform="rotate(-25 250 120)"/>`;
  MR.forEach((R, i) => {
    const open = sum(S) >= RING_SUM[i];
    s += `<circle cx="${MCX}" cy="${MCY}" r="${R}" fill="none" stroke="${open ? '#7df9ff' : '#5a6578'}" stroke-width="${open ? 1.2 : 1}" opacity="${open ? .45 : .5}" ${open ? '' : 'stroke-dasharray="4 6"'}/>`;
  });
  // 地球
  s += `<circle cx="${MCX}" cy="${MCY + 34}" r="104" fill="url(#atmo)"/><circle cx="${MCX}" cy="${MCY + 34}" r="92" fill="url(#earthG)"/><path d="M${MCX - 60} ${MCY - 30} q20 -22 46 -14 q18 6 10 22 q-26 10 -56 -8z M${MCX + 18} ${MCY - 50} q22 -6 34 8 q-8 14 -30 6z" fill="#5fae6a" opacity=".9"/><path d="M${MCX - 70} ${MCY - 34} q40 -30 120 -20" stroke="#fff" stroke-width="5" opacity=".25" fill="none" stroke-linecap="round"/>`;
  // 航线 + 飞船
  VOYPATH = null;
  if (S.voyage) {
    const [x1, y1] = nodePos(RBY[S.voyage.route]), x0 = MCX, y0 = MCY - 58;
    VOYPATH = {x0, y0, cx:(x0 + x1)/2 + (x1 > x0 ? -40 : 40), cy:(y0 + y1)/2, x1, y1};
    s += `<path d="M${x0} ${y0} Q${VOYPATH.cx} ${VOYPATH.cy} ${x1} ${y1}" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-dasharray="4 4" opacity=".85"/>`;
  }
  ROUTES.forEach(rt => {
    const [x, y] = nodePos(rt), open = unlocked(rt), sel = S.sel === rt.id, R = rt.final ? 20 : rt.ring >= 3 ? 17 : 15;
    s += `<g class="pnode" data-r="${rt.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${rt.name}">
      <circle r="${R + 12}" fill="transparent"/>
      <g${open ? '' : ' class="plock"'}>${planet(rt.id, R)}</g>
      ${sel ? `<g class="reticle"><circle r="${R + 9}" fill="none" stroke="#7df9ff" stroke-width="1.5" stroke-dasharray="6 5"/><path d="M${-R-14} 0 h6 M${R+8} 0 h6 M0 ${-R-14} v6 M0 ${R+8} v6" stroke="#7df9ff" stroke-width="2"/></g>` : ''}
      ${open ? '' : `<g transform="translate(${R*.55} ${-R*.75})"><rect x="-5" y="-2" width="10" height="8" rx="1.5" fill="#cfd8e3" stroke="#0b0f17"/><path d="M-3 -2 v-3 a3 3 0 0 1 6 0 v3" fill="none" stroke="#cfd8e3" stroke-width="1.8"/></g>`}
      <g transform="translate(0 ${R + 15})"><rect x="${-rt.name.length*6.2 - 6}" y="-9" width="${rt.name.length*12.4 + 12}" height="14" rx="2" fill="#0a1424" fill-opacity=".8" stroke="${sel ? '#7df9ff' : '#3a4760'}" stroke-width="1"/><text text-anchor="middle" y="2" font-size="10.5" font-weight="700" fill="${open ? (rt.final ? '#ff8fab' : '#e9f1ff') : '#7a869c'}">${rt.name}</text></g>
    </g>`;
  });
  if (VOYPATH) { const [x, y, a] = voyPoint(Math.min(1, (Date.now() - S.voyage.start) / S.voyage.dur)); s += `<use id="mapship" href="#shipic" x="-10" y="-14" width="20" height="28" transform="translate(${x} ${y}) rotate(${a})"/>`; }
  return s + `</svg>`;
}
export function use(state){S=state;}
export {CAST,SYS,SYSK,LV_COST,ITEMS,RING,RING_SUM,RING_MIN,POST,ORDER,ROUTES as DEMO_ROUTES,ROOM,FLOORS,STAGES,W0,H0,REAL,REAL_STYLE,ROUTE_INFO,IT,COMIC,ENDING,PRE,comicPanel,esc,icon,dur,sum,stat,unlocked,itemPower,planet,mapSvg,shipSvg,roomInner,nodePos,stars};
export function allDefs(){return defsSvg().replace('</defs>',spaceDefs()+'</defs>');}

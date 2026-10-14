/** 星途-114（星途-08 王大妈稿 1/2+2/2）：剧情卡 25 张 + 隐藏物 9 件。纯数据 + 纯函数：不读写 Storage、不取时钟/随机数。
 * 规则：每条航线第 n 次返航（含失败返航）发第 n 张，发完不再发；隐藏物一件只给一次，没拿到只显示线索。
 * 存档只用 schema 1 里早就有的 space.cards[routeId]（已发张数）/ space.hidden[routeId]（true=已得）/ space.alienCards；不加新字段。
 * 外星卡「产速 +25%」角标等星途-09 上线再加（这里不出现任何加成文字）。 */
export const ALBUM_VERSION=1;
export const ROUTES=Object.freeze([
 {id:'moon',name:'月面基地',ring:'近地轨道',cards:[['月面第一串','77 在月坑边支起烤架：“低重力，孜然撒得特别匀。”'],['月球车代驾','火箭老板开月球车，珍珠姐坐后座记账。'],['地球升起','四个人坐在月坑边，看地球从地平线上慢慢升起来。']],
  hid:{name:'旧时代的国旗',clue:'带着雷达去，看看月坑背面。',intro:'插在月坑背面，比我们来得早多了。'}},
 {id:'station',name:'空间站废墟',ring:'近地轨道',cards:[['废墟里的工位','阿宅在旧工位抽屉里翻出半包薯片。'],['漂浮的便利贴','便利贴上写着：“下班前记得关灯。”没人关。'],['重新通电','珍珠姐按下开关，空间站亮了一整层楼。']],
  hid:{name:'漂浮的工牌',clue:'有人在废墟里受了伤，医疗够好才敢进去。',intro:'工牌上的人笑得很累，照片背面写着“明天见”。'}},
 {id:'mars',name:'火星峡谷',cards:[['红色峡谷','火箭老板：“我说过，要把小店送上火星。”'],['火星外卖','第一单送到时，风沙把奶茶吹成了沙冰。'],['外星来客：峡谷里的邻居','峡谷里住着一群圆滚滚的火星人，用矿石包下了全部烤串。']],
  hid:{name:'火星第一串',clue:'在红色的风里，要有人记得带上烤架。',intro:'风沙里烤出来的第一串，77 说这串不卖。'}},
 {id:'venus',name:'金星云城',cards:[['云上茶会','珍珠姐在云层上摆开茶席，茶香飘了三公里。'],['酸雨伞','77 撑起烧烤摊的大伞：“下酸雨也要营业。”'],['外星来客：云城的客人','云城居民点了一千杯奶茶，付的是会发光的珍珠。']],
  hid:{name:'云上的珍珠',clue:'云里很闷，船员状态要好。',intro:'从云里捞上来的珍珠，泡进奶茶会自己发光。'}},
 {id:'belt',name:'矿石带',cards:[['挖到宝了','77 一镐下去，挖出一块形状像串串的矿石。'],['矿工食堂','补给站的矿工排队吃 77 的宵夜。'],['外星来客：会唱歌的矿工','石头里住着会唱歌的矿工，他们想入股烧烤摊。']],
  hid:{name:'会哼歌的石头',clue:'多来几趟，石头会记住你。',intro:'来第三趟时，它哼起了 77 烤串时哼的调子。'}},
 {id:'pirate',name:'海盗出没区',cards:[['海盗旗','远处升起一面画着骷髅奶茶杯的旗子。'],['名场面','阿宅开炮前先摆了个姿势：“这一格要画大一点。”'],['外星来客：船长摘下帽子','海盗船长其实是外星人。打完一架，他想加盟。']],
  hid:{name:'海盗船长的帽子',clue:'要连着赢几场遭遇战。',intro:'船长加盟前留下的，帽檐里缝着一张优惠券。'}},
 {id:'europa',name:'木卫冰海',cards:[['冰上钓鱼','77 在冰面上凿了个洞，钓上来一条发光的鱼。'],['冰下的光','冰层下面有灯，一闪一闪，像在打招呼。'],['外星来客：唱歌的鲸','冰海里的鲸用歌声下单，一次要一万份烤鱼。']],
  hid:{name:'冰封的奶茶',clue:'冰海太冷，厨房得是最好的。',intro:'冻了不知道多少年，珍珠还是 Q 的。'}},
 {id:'saturn',name:'土星环',cards:[['环上冲浪','火箭老板踩着太阳帆，在土星环上冲浪。'],['环里的光盘','冰块里冻着一张光盘，标签写着“第一季”。'],['外星来客：土星交易所','土星环交易所请四家店上市，开盘就涨停。']],
  hid:{name:'土星环光盘',clue:'雷达要能看清冰块里的东西。',intro:'“第一季”只有一集，阿宅已经看了二十遍。'}},
 {id:'signal',name:'未知信号源',cards:[['回信','信号是一段漫画，最后一格画着一条亮着灯的街。']],
  hid:{name:'回信的信封',clue:'信封上写着：给那条街的四个人。',intro:'信封是空的，信已经在册子里了。'}}
].map(r=>Object.freeze({...r,cards:Object.freeze(r.cards.map(([t,x])=>Object.freeze({tag:t,alien:t.startsWith('外星来客：')||t==='回信',title:t.replace(/^外星来客：/,''),text:x})))})));
export const ROUTE_BY_ID=Object.freeze(Object.fromEntries(ROUTES.map(r=>[r.id,r])));
export const TOTAL_CARDS=ROUTES.reduce((a,r)=>a+r.cards.length,0);// 25
export const ALIEN_DENOM=7;// 杨总 2026-10-15 01:30 拍板：第 7 张外星卡 = 未知信号源「回信」
/** 现在开放的航线（只有月面基地）。别的航线「还没开航」：不露卡名、不露隐藏物线索。 */
export const OPEN_ROUTES=Object.freeze(['moon','station','mars','venus','belt','pirate','europa','saturn','signal']);// 星途 v2-A：除「未知信号源」（结局批）外都开航
/** 隐藏物条件。月面「旧时代的国旗」要雷达（星途-06 科研/道具还没做）→ 现在谁都拿不到；条件数值不显示给玩家。
 * 其余航线没开航，条件留空（false）。上线新条件只改这里 + 测试。 */
// 星途 v2-A：照 demo 条件（在本趟领取前的存档上判断）。月面要雷达、土星要雷达/科技 5、海盗要连胜——雷达和遭遇战胜场等科研成果批再接，现在月面/海盗还拿不到。
const L=(s,k)=>s.lv?.[k]??1;
export const HIDDEN_RULES=Object.freeze({moon:s=>s.items?.['tech:3']>=1,// v2-B：「曲率雷达」（科技 3 级成果）就是雷达
 station:s=>L(s,'med')>=2,mars:s=>L(s,'life')>=3,venus:s=>L(s,'med')>=3,belt:s=>(s.visits?.belt??0)>=2,pirate:s=>s.wins>=3,europa:s=>L(s,'life')>=5,saturn:s=>L(s,'tech')>=5,signal:()=>true});
const own=(x,k)=>Object.hasOwn(x,k),int=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
/** 册子读档校验：已发张数不能超过该航线卡数；隐藏物只能是 true/false（domain 已校验类型）。坏档只读，不修。 */
export function albumOk(space){
 for(const [k,v] of Object.entries(space.cards??{}))if(ROUTE_BY_ID[k]&&!(int(v)&&v<=ROUTE_BY_ID[k].cards.length))return false;
 const alien=ROUTES.reduce((a,r)=>a+r.cards.slice(0,space.cards?.[r.id]??0).filter(c=>c.alien).length,0);
 return int(space.alienCards)&&space.alienCards>=alien;// alienCards 是旧字段，可能比册子多（demo 留下的），只要求不少
}
/** 这趟返航会发什么（返航报告预览和 claim 写入共用同一个函数，保证显示即所得）。 */
export function awardFor(space,routeId,rules=HIDDEN_RULES){
 const r=ROUTE_BY_ID[routeId];if(!r)return {card:null,hidden:null};
 const n=space.cards?.[routeId]??0,card=int(n)&&n<r.cards.length?n+1:null;
 const ok=rules[routeId];const hidden=space.hidden?.[routeId]!==true&&typeof ok==='function'&&ok(space)===true?routeId:null;
 return {card,hidden};
}
/** 把奖励落到 space 上（纯函数，返回新 space）。一张卡只发一次（按张数推进），隐藏物 true 之后永不再发。 */
export function applyAward(space,routeId,award){
 const s=JSON.parse(JSON.stringify(space)),r=ROUTE_BY_ID[routeId];
 if(award.card!==null){s.cards[routeId]=award.card;if(r.cards[award.card-1].alien){if(s.alienCards>=Number.MAX_SAFE_INTEGER)return null;s.alienCards+=1;}}
 if(award.hidden!==null)s.hidden[award.hidden]=true;
 return s;
}
export const cardOf=(routeId,n)=>ROUTE_BY_ID[routeId]?.cards[n-1]??null;

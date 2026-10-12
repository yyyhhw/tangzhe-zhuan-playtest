/** QA-only eight-wearable catalog registration. No storage, random draws or grants.
 * The existing Economy arrays/maps remain authoritative; its draw implementation
 * is unmodified. Activation is permitted only before protocol2 gameplay mounts. */
export const EIGHT_WEARABLES = Object.freeze([
  {
    "id": "c_charcoal_vest",
    "shop": "烧烤摊",
    "flavor": "耐脏又精神，烤到收摊也板板正正。",
    "desc": "炭灰色 V 领马甲，四颗木扣两个口袋。口袋下那几点深色，是火星子留的签名。",
    "hint": "烧烤摊 · 一件耐脏的衣服",
    "name": "炭灰小马甲",
    "type": "clothes"
  },
  {
    "id": "c_matcha_knit",
    "shop": "奶茶店",
    "flavor": "抹茶色麻花纹，看着就是半糖。",
    "desc": "抹茶绿针织背心，竖织麻花纹。珍珠姐说颜色要像刚打好的奶盖，不能深一分。",
    "hint": "奶茶店 · 一件织出来的衣服",
    "name": "抹茶针织背心",
    "type": "clothes"
  },
  {
    "id": "c_ember_fan_mantle",
    "shop": "烧烤摊",
    "flavor": "一扇一片火星，炭火越扇越旺。",
    "desc": "五片扇形披肩从领口散开，边上一圈炭火红。77 扇炭的手艺，这回穿在了身上。",
    "hint": "烧烤摊 · 一件能扇风的衣服",
    "name": "炭星扇披",
    "type": "clothes"
  },
  {
    "id": "c_grill_grid_tabard",
    "shop": "烧烤摊",
    "flavor": "前后错开一格，像刚翻面的烤网。",
    "desc": "一浅一深两片方襟错开叠穿，纹路像烤网。不是穿歪了，是翻面翻得刚刚好。",
    "hint": "烧烤摊 · 一件方方正正的衣服",
    "name": "烤格方襟",
    "type": "clothes"
  },
  {
    "id": "h_guokui",
    "shop": "烧烤摊",
    "flavor": "圆鼓鼓、香喷喷，像刚出炉。",
    "desc": "米金色软帽，带烤色斑和芝麻点。戴上它，客人总以为今天有锅盔卖。",
    "hint": "烧烤摊 · 一顶圆鼓鼓的帽子",
    "name": "锅盔软帽",
    "type": "hat"
  },
  {
    "id": "h_antenna_clip",
    "shop": "科技公司",
    "flavor": "信号满格，灵感也满格。",
    "desc": "金色发卡顶着弹簧天线和橙色小球。火箭老板说能收到灵感，目前只收到过外卖电话。",
    "hint": "科技公司 · 一件会晃的头饰",
    "name": "天线发卡",
    "type": "hat"
  },
  {
    "id": "h_skewer_pinwheel",
    "shop": "烧烤摊",
    "flavor": "串签拼成小风车，把烧烤香气戴上。",
    "desc": "串签围着圆轴，拼成一只小风车。风往哪边吹，烤串的香味就往哪边跑。",
    "hint": "烧烤摊 · 一顶串签拼成的帽子",
    "name": "串串风车",
    "type": "hat"
  },
  {
    "id": "h_mushroom_parasol",
    "shop": "烧烤摊",
    "flavor": "撑开一朵香菇，晒不着也烤不焦。",
    "desc": "香菇伞盖做的小阳伞帽。烤香菇是素菜区招牌，熊猫监工点名表扬过。",
    "hint": "烧烤摊 · 一顶能遮阳的帽子",
    "name": "香菇小阳伞",
    "type": "hat"
  }
].map(item=>Object.freeze(item)));
const OLD_IDS = Object.freeze(['c_apron','c_flower','c_work','c_panda','c_qipao','c_hoodie','c_space','c_suit','h_chili','h_bamboo','h_flame','h_panda','h_boba','h_beret','h_helmet','h_crown','d_stool','d_lights','d_neon','d_board','d_balloon','d_poster','d_cat','d_plant','k_1','k_2','k_3','k_4','k_5','k_6','k_7','k_8','s_panda','s_fountain','s_portal','s_sun']);
const installed=new WeakSet();
export function prepareEightWearableCatalog(E){
  if(!E||installed.has(E)||E.ITEMS?.map(item=>item.id).join('|')!==OLD_IDS.join('|')||E.REGULAR_ITEMS?.length!==32||E.SUPER_ITEMS?.length!==4||E.CARD_COUNT!==8||E.CFG?.GACHA_PRICE!==200000||E.CFG.GACHA_GROWTH!==1||E.CFG.SUPER_P!==0.1||E.CFG.SUPER_PITY!==15)throw Error('EIGHT_CATALOG_BASELINE_MISMATCH');
  for(const item of E.ITEMS)if(E.ITEM_BY_ID[item.id]!==item)throw Error('EIGHT_CATALOG_MAP_MISMATCH');
  for(const item of EIGHT_WEARABLES)if(Object.hasOwn(E.ITEM_BY_ID,item.id))throw Error('EIGHT_CATALOG_ID_COLLISION');
  const originalItems=E.ITEMS.slice(),originalRegular=E.REGULAR_ITEMS.slice();
  let active=false;installed.add(E);
  function setActive(value){
    if(typeof value!=='boolean')throw Error('EIGHT_CATALOG_BOOLEAN_REQUIRED');
    if(value===active)return;
    const expected=active?[...originalItems,...EIGHT_WEARABLES]:originalItems;
    if(E.ITEMS.length!==expected.length||E.ITEMS.some((item,i)=>item!==expected[i]))throw Error('EIGHT_CATALOG_CHANGED');
    if(value){
      for(const item of EIGHT_WEARABLES){E.ITEMS.push(item);E.REGULAR_ITEMS.push(item);E.ITEM_BY_ID[item.id]=item;}
    }else{
      E.ITEMS.splice(originalItems.length);E.REGULAR_ITEMS.splice(originalRegular.length);
      for(const item of EIGHT_WEARABLES)delete E.ITEM_BY_ID[item.id];
    }
    active=value;
  }
  return Object.freeze({setActive,get active(){return active;},items:EIGHT_WEARABLES});
}

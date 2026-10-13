/** Six-decoration registration for the explicitly reviewed production candidate.
 * Theme is descriptive; every item is a shop decoration, never home furniture.
 * Hidden entries belong to the catalog but never to the random pool. */
export const DECOR6 = Object.freeze([
  {id:'d_borrow_register',name:'借阅登记本',type:'decor',shop:'漫画书店',hidden:false},
  {id:'d_rocket_piggy',name:'迷你火箭存钱罐',type:'decor',shop:'科技公司',hidden:false},
  {id:'d_opening_photo',name:'开业合影',type:'decor',shop:'街区',hidden:true,unlock:'四家店全部开张'},
  {id:'d_ward_charm',name:'退散护身符',type:'decor',shop:'科技公司',hidden:true,unlock:'打僵尸通关第10关'},
  {id:'d_charcoal_chime',name:'炭篓风铃',type:'decor',shop:'烧烤摊',hidden:false},
  {id:'d_spice_turntable',name:'铜边调料转盘',type:'decor',shop:'烧烤摊',hidden:false},
].map(Object.freeze));
export const RANDOM_DECOR6=Object.freeze(DECOR6.filter(x=>!x.hidden));
export const HIDDEN_DECOR6=Object.freeze(DECOR6.filter(x=>x.hidden));
const BASE_IDS='c_apron c_flower c_work c_panda c_qipao c_hoodie c_space c_suit h_chili h_bamboo h_flame h_panda h_boba h_beret h_helmet h_crown d_stool d_lights d_neon d_board d_balloon d_poster d_cat d_plant k_1 k_2 k_3 k_4 k_5 k_6 k_7 k_8 s_panda s_fountain s_portal s_sun c_charcoal_vest c_matcha_knit c_ember_fan_mantle c_grill_grid_tabard h_guokui h_antenna_clip h_skewer_pinwheel h_mushroom_parasol';
const installed=new WeakSet();
export function prepareDecor6Catalog(E){
  if(!E||installed.has(E)||E.ITEMS?.map(x=>x.id).join(' ')!==BASE_IDS||E.REGULAR_ITEMS?.length!==40||E.SUPER_ITEMS?.length!==4||E.CARD_COUNT!==8||E.CFG?.GACHA_PRICE!==200000||E.CFG.GACHA_GROWTH!==1||E.CFG.SUPER_P!==.1||E.CFG.SUPER_PITY!==15)throw Error('DECOR6_BASELINE_MISMATCH');
  for(const item of E.ITEMS)if(E.ITEM_BY_ID[item.id]!==item)throw Error('DECOR6_MAP_MISMATCH');
  for(const item of DECOR6)if(Object.hasOwn(E.ITEM_BY_ID,item.id))throw Error('DECOR6_ID_COLLISION');
  const originalItems=E.ITEMS.slice(),originalRegular=E.REGULAR_ITEMS.slice();
  let active=false;
  installed.add(E);
  function setActive(value){
    if(typeof value!=='boolean')throw Error('DECOR6_BOOLEAN_REQUIRED');
    if(value===active)return;
    const items=active?[...originalItems,...DECOR6]:originalItems;
    const regular=active?[...originalRegular,...RANDOM_DECOR6]:originalRegular;
    if(E.ITEMS.length!==items.length||E.ITEMS.some((x,i)=>x!==items[i])||E.REGULAR_ITEMS.length!==regular.length||E.REGULAR_ITEMS.some((x,i)=>x!==regular[i])||items.some(x=>E.ITEM_BY_ID[x.id]!==x))throw Error('DECOR6_CATALOG_CHANGED');
    if(value){
      for(const item of DECOR6){E.ITEMS.push(item);E.ITEM_BY_ID[item.id]=item;}
      E.REGULAR_ITEMS.push(...RANDOM_DECOR6);
    }else{
      E.ITEMS.splice(originalItems.length);E.REGULAR_ITEMS.splice(originalRegular.length);
      for(const item of DECOR6)delete E.ITEM_BY_ID[item.id];
    }
    active=value;
  }
  return Object.freeze({setActive,get active(){return active;},items:DECOR6});
}

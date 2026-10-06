/* 宠物原型 p1 — 测试房间：家具全部来自正式目录（../economy.js 的 FURNITURE，占地 w×h 用目录里的），只挑一组摆样。
   坐标：地板格，x 向右、y 向前（y=0 靠后墙），单位 = 1 格。家具 (x,y) 是占地左上角。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PetRoom = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const ROOM = {
    cols: 10, rows: 8, wallRows: 2,
    front: { x: 5, y: 7.5 },              // 「你」站的位置：呼唤点 / 抛球起点 / 叼回放球点
    bed: { x: 0.25, y: 3.15, w: 1.5, h: 1.05 },   // 小狗自己的窝（平的，能走上去躺）
    bowl: { x: 9.0, y: 5.45, w: 0.62, h: 0.42 },  // 小狗自己的碗（算障碍）
    items: [
      { fid: 'furn_s77_curved_sectional', x: 0, y: 0 },
      { fid: 'furn_pearl_tea_glass_lamp', x: 3, y: 0 },
      { fid: 'furn_pearl_tea_cat_hammock', x: 5, y: 0 },
      { fid: 'furn_otaku_bunk_manga', x: 6, y: 0 },
      { fid: 'furn_rocket_steel_locker', x: 8, y: 0 },
      { fid: 'furn_otaku_disc_tower', x: 9, y: 2 },
      { fid: 'furn_s77_patchwork_flower_rug', x: 2, y: 4 },
      { fid: 'furn_otaku_kotatsu', x: 4, y: 3 },
      { fid: 'furn_catbed', x: 9, y: 4 },
      { fid: 'furn_rocket_oil_drum_table', x: 6, y: 4 },
      { fid: 'furn_s77_rocking_chair', x: 2, y: 5 },
      { fid: 'furn_otaku_beanbag', x: 3, y: 6 },
      { fid: 'furn_plant', x: 0, y: 6 },
      { fid: 'furn_rocket_landing_cat_pod', x: 9, y: 7 },
    ],
    wall: [   // 墙饰挂在后墙（墙面 2 行），不占地板，不挡路
      { fid: 'furn_rocket_gear_clock', x: 4, y: 0 },
      { fid: 'furn_otaku_manga_page_triptych', x: 0, y: 0 },
    ],
  };
  // 只有这里配了「站位 / 朝向 / 动作」的家具才有专门互动；其余家具只当障碍。
  // spot = 相对占地左上角的站位（格）；face = 站好后面朝哪边（原地动作只画东向，所以站在侧面）
  const INTERACT = {
    pet_bed:  { spot: [0.75, 0.55], face: 'E', action: 'sleep', label: '小窝' },
    pet_bowl: { spot: [-0.38, 0.24], face: 'E', action: 'eat', label: '饭碗' },
    furn_catbed: { spot: [-0.36, 0.55], face: 'E', action: 'sniff', stay: 0.6, label: '猫窝' },
    furn_pearl_tea_cat_hammock: { spot: [-0.36, 0.62], face: 'E', action: 'sniff', stay: 0.5, label: '茶篮猫吊床' },
    furn_rocket_landing_cat_pod: { spot: [-0.36, 0.55], face: 'E', action: 'sniff', stay: 0.6, label: '着陆舱猫窝' },
  };
  return { ROOM, INTERACT };
});

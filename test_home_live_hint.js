// 家宅-90：生活模式提示只列屋里真有的互动；空屋只给一条提示（node test_home_live_hint.js）
const assert = require('assert'), fs = require('fs');
const E = require('./economy.js'), HomeInteraction = require('./home-interaction.js');
let n = 0;
for (const file of ['app.js', 'pet/game/app.js']) {
  const src = fs.readFileSync(file, 'utf8'), i = src.indexOf('function homeLiveHint('), j = src.indexOf('function renderRoom()', i);
  assert(i > 0 && j > i, file);
  let placed = [];
  const hint = new Function('E', 'HomeInteraction', 'state', src.slice(i, j) + '\nreturn homeLiveHint;')({ ...E, homeOf:() => ({ placed }) }, HomeInteraction, {});
  const P = (fid, surf) => ({ uid:fid, fid, x:0, y:0, rot:0, ...(surf ? { surf } : {}) });
  const cases = [
    [[], '屋里还空着，去商城挑第一件家具吧。'],
    [[P('furn_bed')], '生活：点空地走过去 · 点床躺下'],
    [[P('furn_sofa')], '生活：点空地走过去 · 点座椅坐下'],
    [[P('furn_bookshelf'), P('furn_wardrobe')], '生活：点空地走过去 · 点书架看书 · 点衣柜换装'],
    [[P('furn_bed'), P('furn_sofa'), P('furn_bookshelf'), P('furn_wardrobe')], '生活：点空地走过去 · 点床躺下 · 点座椅坐下 · 点书架看书 · 点衣柜换装'],
    [[P('furn_plant')], '生活：点空地走过去'],
    [[P('furn_painting', 'wall')], '生活：点空地走过去'],
    [[P('furn_s77_quilt_island_rug')], '生活：点空地走过去 · 点座椅坐下'],
  ];
  for (const [items, want] of cases) { placed = items; assert.strictEqual(hint('c77'), want, file + ' ' + items.map(p => p.fid).join(',')); n++; }
}
console.log(n + '/' + n + ' PASS');

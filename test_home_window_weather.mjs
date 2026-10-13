// 家宅-81：home-status 适配器把游戏内天气写成 .room 的 data-room-weather（node test_home_window_weather.mjs）
import assert from 'assert';
import {createRequire} from 'module';
import {createHomeStatusAdapter} from './home/home-status.mjs';
import {homeWeatherForGameDay} from './home/home-ambience.mjs';
const E = createRequire(import.meta.url)('./economy.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('PASS', name); };
function env(ts) {
  const room = {dataset:{}}, node = {hidden:true, textContent:'', isConnected:true, closest:sel => sel === '.room' ? room : null};
  const timers = [];
  const win = {setTimeout:(f, ms) => (timers.push(f), timers.length), clearTimeout(){}, addEventListener(){}, removeEventListener(){}};
  const doc = {hidden:false, addEventListener(){}, removeEventListener(){}};
  let now = ts;
  const a = createHomeStatusAdapter({document:doc, window:win, now:() => now, gameDayAt:E.dayKey});
  return {room, node, a, set:t => { now = t; }, tick:() => timers.shift()?.()};
}
const ctx = {roomId:'c77', level:1, unlocked:true, mode:'live', hasArt:true};
// 找出 2026 年 10–12 月里各一天晴 / 雨 / 雪（按游戏日 E.dayKey 判，和 65 同一份口径）
const find = kind => { for (let d = Date.UTC(2026, 9, 1, 3); d < Date.UTC(2027, 0, 1); d += 864e5) if (homeWeatherForGameDay(E.dayKey(d)) === kind) return d; };
const T = {clear:find('clear'), rain:find('rain'), snow:find('snow')};
ok('晴 / 雨 / 雪三种游戏日都找得到', () => { for (const k in T) assert(T[k], k); });
ok('写 data-room-weather，和状态牌上的天气一致', () => {
  for (const [kind, ts] of Object.entries(T)) {
    const e = env(ts); e.a.sync(e.node, ctx);
    assert.strictEqual(e.room.dataset.roomWeather, kind);
    assert(e.node.textContent.includes({clear:'晴', rain:'雨', snow:'雪'}[kind]), e.node.textContent);
    assert(e.room.dataset.roomTone, 'tone 仍照 65 写');
  }
});
ok('5 分钟刷新时换天，属性跟着换', () => {
  const e = env(T.clear); e.a.sync(e.node, ctx); assert.strictEqual(e.room.dataset.roomWeather, 'clear');
  e.set(T.rain); e.tick(); assert.strictEqual(e.room.dataset.roomWeather, 'rain');
  e.set(T.snow); e.tick(); assert.strictEqual(e.room.dataset.roomWeather, 'snow');
});
ok('卸载 / 不符合条件（布置模式、别的房间）时清掉属性', () => {
  const e = env(T.rain); e.a.sync(e.node, ctx); assert.strictEqual(e.room.dataset.roomWeather, 'rain');
  e.a.unmount(); assert.strictEqual(e.room.dataset.roomWeather, undefined); assert.strictEqual(e.room.dataset.roomTone, undefined);
  const f = env(T.rain); f.a.sync(f.node, {...ctx, mode:'decor'}); assert.strictEqual(f.room.dataset.roomWeather, undefined);
  const g = env(T.rain); g.a.sync(g.node, {...ctx, roomId:'pearl'}); assert.strictEqual(g.room.dataset.roomWeather, undefined);
});
console.log(n + '/' + n + ' PASS');

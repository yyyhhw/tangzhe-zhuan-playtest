import {localMinuteAt, resolveHomeAmbience, HOME_AMBIENCE_REFRESH_MS} from './home-ambience.mjs?v=home35-td46-home22-copy52-20261012-r1';

// Readonly text + 家宅-65 room tone + 家宅-81 window weather. Both are only data-* attributes on
// the existing .room: data-room-tone (CSS tints room-art and the window glass block) and
// data-room-weather (CSS draws rain / snow inside the window glass box only). No audio, no poses,
// never furniture / people / controls, nothing saved.
// The host passes scalars for an already-existing room; no state object or
// mutating homeOf helper is accepted. The clock is read once per refresh.
const WEATHER_LABEL = Object.freeze({clear:'晴', rain:'雨', snow:'雪'});
export function isHomeStatusEligible(context) {
  return !!context && context.roomId === 'c77' && context.level === 1 &&
    context.unlocked === true && context.mode === 'live' && context.hasArt === true;
}

export function createHomeStatusAdapter({document, window, now, gameDayAt}) {
  let node = null, context = null, timer = null, generation = 0, suspended = false, room = null;

  function stopTimer() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  }
  function unmount() {
    generation++;
    stopTimer();
    document.removeEventListener('visibilitychange', visibilityChanged);
    window.removeEventListener('pagehide', pageHidden);
    window.removeEventListener('pageshow', pageShown);
    if (node) { node.hidden = true; node.textContent = ''; }
    if (room) { delete room.dataset.roomTone; delete room.dataset.roomWeather; }
    node = context = room = null;
    suspended = false;
  }
  function refresh() {
    stopTimer();
    if (!node || !node.isConnected || !isHomeStatusEligible(context)) {
      unmount();
      return;
    }
    if (document.hidden || suspended) return;
    const timestamp = now();
    const value = resolveHomeAmbience({
      minuteOfDay:localMinuteAt(timestamp), gameDay:gameDayAt(timestamp),
      mode:'live', reducedMotion:true
    });
    const text = `${value.periodLabel} · ${WEATHER_LABEL[value.weather]}`;   // 文案-89：标签不带句号，不写「时段」「游戏内」
    if (node.textContent !== text) node.textContent = text;
    node.hidden = false;
    room = node.closest('.room');
    if (room && room.dataset.roomTone !== value.roomTone) room.dataset.roomTone = value.roomTone;   // 家宅-65
    if (room && room.dataset.roomWeather !== value.windowTone) room.dataset.roomWeather = value.windowTone;   // 家宅-81：clear / rain / snow
    const current = generation;
    timer = window.setTimeout(() => {
      if (current !== generation) return;
      timer = null;
      refresh();
    }, HOME_AMBIENCE_REFRESH_MS);
  }
  function visibilityChanged() { if (document.hidden) stopTimer(); else refresh(); }
  function pageHidden() { suspended = true; stopTimer(); }
  function pageShown() { suspended = false; refresh(); }

  function sync(nextNode, nextContext) {
    unmount();
    if (!nextNode || !isHomeStatusEligible(nextContext)) return;
    node = nextNode;
    // Snapshot only presentation scalars, never retain the caller's object.
    context = {roomId:nextContext.roomId, level:nextContext.level,
      unlocked:nextContext.unlocked, mode:nextContext.mode, hasArt:nextContext.hasArt};
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('pageshow', pageShown);
    refresh();
  }
  return Object.freeze({sync, unmount, destroy:unmount});
}

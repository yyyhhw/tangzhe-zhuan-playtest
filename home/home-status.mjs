import {localMinuteAt, resolveHomeAmbience, HOME_AMBIENCE_REFRESH_MS} from './home-ambience.mjs?v=home35-td46-home22-copy52-20261012-r1';

// Readonly text only. No room tint, weather overlay, particles, audio or poses.
// The host passes scalars for an already-existing room; no state object or
// mutating homeOf helper is accepted. The clock is read once per refresh.
const WEATHER_LABEL = Object.freeze({clear:'晴', rain:'雨', snow:'雪'});
export function isHomeStatusEligible(context) {
  return !!context && context.roomId === 'c77' && context.level === 1 &&
    context.unlocked === true && context.mode === 'live' && context.hasArt === true;
}

export function createHomeStatusAdapter({document, window, now, gameDayAt}) {
  let node = null, context = null, timer = null, generation = 0, suspended = false;

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
    node = context = null;
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
    const text = `时段：${value.periodLabel} · 游戏内天气：${WEATHER_LABEL[value.weather]}。 `;
    if (node.textContent !== text) node.textContent = text;
    node.hidden = false;
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

// Fixed visual contract: absence of a room asset/window is not evidence of a windowless room.
export const EXPECTED_WINS = Object.freeze({ c77_1: 1, c77_2: 1, c77_3: 2, otaku_1: 1, pearl_2: 1, pearl_3: 1, rocket_1: 1 });
export const expectedWindows = (who, lv) => EXPECTED_WINS[`${who}_${lv}`] || 0;
export function normalRoomReady(result, who, lv) {
  return !result.timedOut && result.loaded?.width > 0 &&
    result.loaded.src?.includes(`home_${who}_${lv}.webp`) &&
    result.loaded.nWins === expectedWindows(who, lv);
}
export function roomRequestCount(events, from, who, lv) {
  const file = `/art/home_${who}_${lv}.webp`;
  return events.slice(from).filter(url => new URL(url).pathname.endsWith(file)).length;
}
// Browser-generated resource errors only. Application errors mentioning abort/cancel must survive.
export const isResourceNoise = text => /^Failed to load resource(?::|$)/i.test(text);

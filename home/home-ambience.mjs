/**
 * Home-22: deterministic presentation calculations only. No clock writes,
 * system-time changes, timers, network, saved fields, income, pose or inventory.
 * Local time chooses the period; the EXISTING Economy.dayKey(now) chooses the
 * game date supplied to weather. Do not substitute the local calendar date.
 */
export const HOME_AMBIENCE_VERSION = 'home-ambience-readonly-v1';
export const HOME_WEATHER_VERSION = 'game-day-weather-v1-rain5-winter-snow2';
export const HOME_AMBIENCE_REFRESH_MS = 5 * 60 * 1000;
export const HOME_AMBIENCE_TRANSITION_MS = 1500;
const PERIODS = Object.freeze([
  Object.freeze({id:'morning',label:'早晨',startMinute:300,endMinute:600}),
  Object.freeze({id:'day',label:'白天',startMinute:600,endMinute:1020}),
  Object.freeze({id:'dusk',label:'黄昏',startMinute:1020,endMinute:1140}),
  Object.freeze({id:'night',label:'夜晚',startMinute:1140,endMinute:300})
]);
export const HOME_PERIODS = PERIODS;
function fail(code) { const error = new TypeError(code); error.code = code; throw error; }
const leap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysIn = (year, month) => [31,leap(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
function calendarKey(value, monthOnly=false) {
  if (typeof value !== 'string') fail('INVALID_GAME_DAY');
  const match = (monthOnly ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/).exec(value);
  if (!match) fail('INVALID_GAME_DAY');
  const year=Number(match[1]), month=Number(match[2]), day=monthOnly?1:Number(match[3]);
  if(year<1 || month<1 || month>12 || day<1 || day>daysIn(year,month)) fail('INVALID_GAME_DAY');
  return {year,month,day,monthKey:value.slice(0,7)};
}
function hash32(text) {
  let value=2166136261;
  for(let i=0;i<text.length;i++){value^=text.charCodeAt(i);value=Math.imul(value,16777619);}
  value^=value>>>16;value=Math.imul(value,0x85ebca6b);value^=value>>>13;value=Math.imul(value,0xc2b2ae35);value^=value>>>16;
  return value>>>0;
}

/** Exact approved boundaries: 05:00 / 10:00 / 17:00 / 19:00, device-local. */
export function homePeriodForMinute(minuteOfDay) {
  if(!Number.isInteger(minuteOfDay)||minuteOfDay<0||minuteOfDay>=1440)fail('INVALID_LOCAL_MINUTE');
  const period = PERIODS.find(p => p.startMinute < p.endMinute ? minuteOfDay>=p.startMinute&&minuteOfDay<p.endMinute : minuteOfDay>=p.startMinute||minuteOfDay<p.endMinute);
  return period;
}

/** Timestamp is injected. Reads device-local hours, never Date.now or system time setters. */
export function localMinuteAt(timestampMs) {
  if(typeof timestampMs!=='number'||!Number.isFinite(timestampMs))fail('INVALID_TIMESTAMP');
  const date=new Date(timestampMs);
  if(Number.isNaN(date.getTime()))fail('INVALID_TIMESTAMP');
  return date.getHours()*60+date.getMinutes();
}
export function homePeriodAt(timestampMs) { return homePeriodForMinute(localMinuteAt(timestampMs)); }

/**
 * Fixed v1 choice inside the reviewed design ranges: five rainy days/month;
 * two snowy days in Dec–Feb, none otherwise. Snow and rain are disjoint.
 * Stable hash ranking avoids runtime RNG and doesn't touch the draw generator.
 * This is GAME weather, not a forecast. Its recurrence is not a reward condition.
 */
export function monthlyHomeWeather(gameMonth) {
  const {year,month,monthKey}=calendarKey(gameMonth,true);
  const days=Array.from({length:daysIn(year,month)},(_,i)=>i+1);
  const ranked=(kind,available)=>[...available].sort((a,b)=>hash32(`${HOME_WEATHER_VERSION}:${monthKey}:${kind}:${a}`)-hash32(`${HOME_WEATHER_VERSION}:${monthKey}:${kind}:${b}`)||a-b);
  const snowDays=[12,1,2].includes(month)?ranked('snow',days).slice(0,2).sort((a,b)=>a-b):[];
  const snow=new Set(snowDays);
  const rainDays=ranked('rain',days.filter(day=>!snow.has(day))).slice(0,5).sort((a,b)=>a-b);
  return Object.freeze({version:HOME_WEATHER_VERSION,gameMonth:monthKey,daysInMonth:days.length,
    rainDays:Object.freeze(rainDays),snowDays:Object.freeze(snowDays)});
}
export function homeWeatherForGameDay(gameDay) {
  const {day,monthKey}=calendarKey(gameDay);
  const plan=monthlyHomeWeather(monthKey);
  return plan.snowDays.includes(day)?'snow':plan.rainDays.includes(day)?'rain':'clear';
}

/** UI-facing value object; rendering is deliberately NOT included in this candidate. */
export function resolveHomeAmbience({minuteOfDay,gameDay,reducedMotion=false,mode='live'}={}) {
  if(typeof reducedMotion!=='boolean'||!['live','decor'].includes(mode))fail('INVALID_HOME_PRESENTATION_MODE');
  const period=homePeriodForMinute(minuteOfDay),weather=homeWeatherForGameDay(gameDay);
  const visible=mode==='live';
  return Object.freeze({version:HOME_AMBIENCE_VERSION,weatherVersion:HOME_WEATHER_VERSION,
    period:period.id,periodLabel:period.label,weather,gameDay,mode,overlayEnabled:visible,
    particles:visible&&!reducedMotion&&weather!=='clear'?weather:'none',
    transitionMs:visible&&!reducedMotion?HOME_AMBIENCE_TRANSITION_MS:0,
    // Deliberately no animation instructions or pose changes. These tokens are
    // scoped only to the future room-art/window layers, never controls/people.
    roomTone:visible?period.id:'none',windowTone:visible?weather:'none'});
}

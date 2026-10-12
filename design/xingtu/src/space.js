/* ========== 星球（以 0,0 为中心，半径 r） ========== */
const ROUTE_INFO = {
  moon:   {desc:'离地球最近的一站，月坑边适合烤串。', ceo:'life'},
  station:{desc:'一座废弃的空间站，灯还亮着一半。', ceo:'war'},
  mars:   {desc:'红色峡谷，风很大，听说有人住。', ceo:'tech'},
  venus:  {desc:'浓云上面漂着一座城。', ceo:'med'},
  belt:   {desc:'满天的石头，有的会发光。', ceo:'life'},
  pirate: {desc:'雷达经常收到奇怪的求救。', ceo:'war'},
  europa: {desc:'冰层下面有光在动。', ceo:'life'},
  saturn: {desc:'光环是冰和石头，还有别的东西。', ceo:'tech'},
  signal: {desc:'一个重复了很多年的信号，第一次有人回应。', ceo:'med'},
};
function planet(id, r){
  const sh = `<circle r="${r}" fill="url(#pshade)"/>`;
  switch (id) {
    case 'moon': return `<circle r="${r}" fill="#c9ccd3"/>${[[-.35,-.2,.22],[.3,.25,.16],[.1,-.45,.1],[-.1,.4,.12],[.45,-.15,.08]].map(([x,y,s]) => `<circle cx="${x*r}" cy="${y*r}" r="${s*r}" fill="#a3a8b2"/><circle cx="${x*r+s*r*.2}" cy="${y*r+s*r*.2}" r="${s*r*.75}" fill="#b4b8c1"/>`).join('')}${sh}`;
    case 'station': return `<ellipse rx="${r*1.35}" ry="${r*.45}" fill="none" stroke="#9aa5b5" stroke-width="${r*.22}"/><ellipse rx="${r*1.35}" ry="${r*.45}" fill="none" stroke="#dfe6ee" stroke-width="${r*.08}" stroke-dasharray="${r*.5} ${r*.2}"/><rect x="${-r*.28}" y="${-r*.7}" width="${r*.56}" height="${r*1.4}" rx="${r*.15}" fill="#cfd8e3" stroke="#56647d" stroke-width="1"/><rect x="${-r*1.2}" y="${-r*.95}" width="${r*.7}" height="${r*.35}" fill="#2f6fb5" stroke="#9fe8ff" stroke-width=".8" transform="rotate(-12)"/><rect x="${r*.5}" y="${r*.55}" width="${r*.6}" height="${r*.3}" fill="#2f6fb5" stroke="#9fe8ff" stroke-width=".8" transform="rotate(20)"/><circle cx="0" cy="${-r*.3}" r="${r*.1}" fill="#ffd23f"/>`;
    case 'mars': return `<circle r="${r}" fill="#c8553d"/><path d="M${-r*.9} ${r*.1} q${r*.5} ${-r*.3} ${r} ${r*.05} t${r*.8} ${-r*.1}" stroke="#7a2e1f" stroke-width="${r*.12}" fill="none"/><ellipse cx="${r*.1}" cy="${-r*.82}" rx="${r*.45}" ry="${r*.16}" fill="#f6efe8"/><circle cx="${-r*.4}" cy="${r*.45}" r="${r*.18}" fill="#a94431"/>${sh}`;
    case 'venus': return `<circle r="${r}" fill="#e9c46a"/>${[-.5,-.15,.2,.55].map((y,i) => `<path d="M${-r} ${y*r} q${r*.5} ${(i%2?-1:1)*r*.18} ${r} 0 t${r} 0" stroke="${i%2 ? '#f6e2a8' : '#d4a94a'}" stroke-width="${r*.16}" fill="none" opacity=".8"/>`).join('')}<circle r="${r}" fill="none" stroke="#fff3c4" stroke-width="${r*.12}" opacity=".35"/>${sh}`;
    case 'belt': return [[-.7,-.3,.38,'#8a7766'],[.2,-.5,.3,'#a08b77'],[.6,.2,.42,'#7a6a5c'],[-.2,.45,.3,'#94816f'],[.95,-.55,.16,'#a08b77'],[-1.05,.35,.18,'#7a6a5c']].map(([x,y,s,c],i) => `<path d="M${(x-s)*r} ${y*r} l${s*r*.6} ${-s*r*.9} l${s*r*1.1} ${s*r*.2} l${s*r*.3} ${s*r*.9} l${-s*r} ${s*r*.6}z" fill="${c}" stroke="#4a3f36" stroke-width="1"/>${i===2 ? `<circle cx="${x*r}" cy="${y*r}" r="${r*.07}" fill="#7df9ff"/><circle cx="${x*r}" cy="${y*r}" r="${r*.25}" fill="#7df9ff" opacity=".25"/>` : ''}`).join('');
    case 'pirate': return `<circle r="${r*1.2}" fill="#6b2d5c" opacity=".55"/><circle cx="${r*.4}" cy="${-r*.3}" r="${r*.8}" fill="#9b2c3c" opacity=".45"/><circle cx="${-r*.5}" cy="${r*.3}" r="${r*.7}" fill="#3d1f6b" opacity=".6"/><g transform="translate(${-r*.1} ${r*.05})"><path d="M${-r*.55} 0 h${r*1.1} l${-r*.2} ${r*.3} h${-r*.7}z" fill="#1a1020" stroke="#ff3b3b" stroke-width=".8"/><path d="M0 0 v${-r*.7}" stroke="#ddd" stroke-width="1"/><path d="M0 ${-r*.7} h${r*.45} v${r*.3} h${-r*.45}z" fill="#141414" stroke="#ddd" stroke-width=".6"/><circle cx="${r*.22}" cy="${-r*.55}" r="${r*.07}" fill="#fff"/></g>`;
    case 'europa': return `<circle r="${r}" fill="#e3edf5"/><path d="M${-r*.8} ${-r*.3} l${r*.5} ${r*.2} l${r*.4} ${-r*.3} l${r*.6} ${r*.3} M${-r*.6} ${r*.4} l${r*.4} ${-r*.2} l${r*.5} ${r*.4} l${r*.4} ${-r*.2} M${-r*.1} ${-r*.8} l${r*.15} ${r*.5}" stroke="#b5654a" stroke-width="${r*.05}" fill="none" opacity=".75"/><circle cx="${r*.2}" cy="${r*.1}" r="${r*.18}" fill="#7df9ff" opacity=".35"/>${sh}`;
    case 'saturn': return `<ellipse rx="${r*1.75}" ry="${r*.5}" fill="none" stroke="#c9b48a" stroke-width="${r*.22}" opacity=".9" transform="rotate(-16)"/><circle r="${r}" fill="#e0c68f"/>${[-.4,0,.35].map(y => `<path d="M${-r} ${y*r} h${2*r}" stroke="#c9a96b" stroke-width="${r*.12}" opacity=".7"/>`).join('')}${sh}<path d="M${-r*1.68} ${r*.2} A${r*1.75} ${r*.5} 0 0 0 ${r*1.68} ${-r*.2}" fill="none" stroke="#d9c69c" stroke-width="${r*.22}" transform="rotate(-16)"/>`;
    case 'signal': return `<g class="pulse">${[1.3,.95,.6].map((s,i) => `<circle r="${r*s}" fill="none" stroke="#7df9ff" stroke-width="${1.6 - i*.3}" opacity="${.35 + i*.2}"/>`).join('')}</g><circle r="${r*.32}" fill="#fff"/><circle r="${r*.9}" fill="url(#glow)"/><path d="M${-r*1.5} 0 h${r*.6} M${r*.9} 0 h${r*.6} M0 ${-r*1.5} v${r*.6} M0 ${r*.9} v${r*.6}" stroke="#7df9ff" stroke-width="1.2"/>`;
  }
  return '';
}
function spaceDefs(){
  return `<radialGradient id="pshade" cx=".35" cy=".32" r=".75"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
  <radialGradient id="earthG" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#4f9de0"/><stop offset=".7" stop-color="#1f5fa8"/><stop offset="1" stop-color="#0e2f63"/></radialGradient>
  <radialGradient id="atmo" cx=".5" cy=".5" r=".5"><stop offset=".86" stop-color="#7fd0ff" stop-opacity="0"/><stop offset=".93" stop-color="#7fd0ff" stop-opacity=".55"/><stop offset="1" stop-color="#7fd0ff" stop-opacity="0"/></radialGradient>
  <symbol id="shipic" viewBox="-10 -14 20 28"><path d="M0 -13 q7 8 7 18 v5 h-14 v-5 q0-10 7-18z" fill="#eef2f7" stroke="#0b0f17" stroke-width="1.5"/><circle cy="-3" r="2.6" fill="#3fb6ff" stroke="#0b0f17"/><path d="M-7 4 l-3 6 h3z M7 4 l3 6 h-3z" fill="#e63946" stroke="#0b0f17" stroke-width="1"/><path d="M-4 10 q4 8 8 0z" fill="#7df9ff"/></symbol>`;
}

/* ========== 星图 ========== */
const MAP_W = 340, MAP_H = 470, MCX = 170, MCY = 500, MR = [128, 196, 262, 328, 398];
function nodePos(rt){
  const same = ROUTES.filter(x => x.ring === rt.ring), idx = same.indexOf(rt);
  const a = same.length === 1 ? 0 : (idx === 0 ? -1 : 1) * (rt.ring === 0 ? .52 : rt.ring === 3 ? .4 : .44);
  const R = MR[rt.ring];
  return [MCX + R * Math.sin(a), MCY - R * Math.cos(a)];
}
let VOYPATH = null;
function voyPoint(p){
  if (!VOYPATH) return [0,0,0];
  const {x0,y0,cx,cy,x1,y1} = VOYPATH, q = 1 - p;
  const x = q*q*x0 + 2*q*p*cx + p*p*x1, y = q*q*y0 + 2*q*p*cy + p*p*y1;
  const dx = 2*q*(cx-x0) + 2*p*(x1-cx), dy = 2*q*(cy-y0) + 2*p*(y1-cy);
  return [x, y, Math.atan2(dy, dx) * 180 / Math.PI + 90];
}
function mapSvg(){
  let s = `<svg class="mapsvg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="星图"><rect width="${MAP_W}" height="${MAP_H}" fill="url(#deep)"/>`;
  let seed = 23; const r = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  for (let i = 0; i < 110; i++) s += `<circle cx="${(r()*MAP_W).toFixed(1)}" cy="${(r()*MAP_H).toFixed(1)}" r="${r() < .1 ? 1.3 : .6}" fill="#fff" opacity="${(.25 + r()*.65).toFixed(2)}"/>`;
  s += `<ellipse cx="250" cy="120" rx="120" ry="40" fill="#6b4fd8" opacity=".08" transform="rotate(-25 250 120)"/>`;
  MR.forEach((R, i) => {
    const open = sum(S) >= RING_SUM[i];
    s += `<circle cx="${MCX}" cy="${MCY}" r="${R}" fill="none" stroke="${open ? '#7df9ff' : '#5a6578'}" stroke-width="${open ? 1.2 : 1}" opacity="${open ? .45 : .5}" ${open ? '' : 'stroke-dasharray="4 6"'}/>`;
  });
  // 地球
  s += `<circle cx="${MCX}" cy="${MCY + 34}" r="104" fill="url(#atmo)"/><circle cx="${MCX}" cy="${MCY + 34}" r="92" fill="url(#earthG)"/><path d="M${MCX - 60} ${MCY - 30} q20 -22 46 -14 q18 6 10 22 q-26 10 -56 -8z M${MCX + 18} ${MCY - 50} q22 -6 34 8 q-8 14 -30 6z" fill="#5fae6a" opacity=".9"/><path d="M${MCX - 70} ${MCY - 34} q40 -30 120 -20" stroke="#fff" stroke-width="5" opacity=".25" fill="none" stroke-linecap="round"/>`;
  // 航线 + 飞船
  VOYPATH = null;
  if (S.voyage) {
    const [x1, y1] = nodePos(RBY[S.voyage.route]), x0 = MCX, y0 = MCY - 58;
    VOYPATH = {x0, y0, cx:(x0 + x1)/2 + (x1 > x0 ? -40 : 40), cy:(y0 + y1)/2, x1, y1};
    s += `<path d="M${x0} ${y0} Q${VOYPATH.cx} ${VOYPATH.cy} ${x1} ${y1}" fill="none" stroke="#ffd23f" stroke-width="1.6" stroke-dasharray="4 4" opacity=".85"/>`;
  }
  ROUTES.forEach(rt => {
    const [x, y] = nodePos(rt), open = unlocked(rt), sel = S.sel === rt.id, R = rt.final ? 20 : rt.ring >= 3 ? 17 : 15;
    s += `<g class="pnode" data-r="${rt.id}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" tabindex="0" role="button" aria-label="${rt.name}">
      <circle r="${R + 12}" fill="transparent"/>
      <g${open ? '' : ' class="plock"'}>${planet(rt.id, R)}</g>
      ${sel ? `<g class="reticle"><circle r="${R + 9}" fill="none" stroke="#7df9ff" stroke-width="1.5" stroke-dasharray="6 5"/><path d="M${-R-14} 0 h6 M${R+8} 0 h6 M0 ${-R-14} v6 M0 ${R+8} v6" stroke="#7df9ff" stroke-width="2"/></g>` : ''}
      ${open ? '' : `<g transform="translate(${R*.55} ${-R*.75})"><rect x="-5" y="-2" width="10" height="8" rx="1.5" fill="#cfd8e3" stroke="#0b0f17"/><path d="M-3 -2 v-3 a3 3 0 0 1 6 0 v3" fill="none" stroke="#cfd8e3" stroke-width="1.8"/></g>`}
      <g transform="translate(0 ${R + 15})"><rect x="${-rt.name.length*6.2 - 6}" y="-9" width="${rt.name.length*12.4 + 12}" height="14" rx="2" fill="#0a1424" fill-opacity=".8" stroke="${sel ? '#7df9ff' : '#3a4760'}" stroke-width="1"/><text text-anchor="middle" y="2" font-size="10.5" font-weight="700" fill="${open ? (rt.final ? '#ff8fab' : '#e9f1ff') : '#7a869c'}">${rt.name}</text></g>
    </g>`;
  });
  if (VOYPATH) { const [x, y, a] = voyPoint(Math.min(1, (Date.now() - S.voyage.start) / S.voyage.dur)); s += `<use id="mapship" href="#shipic" x="-10" y="-14" width="20" height="28" transform="translate(${x} ${y}) rotate(${a})"/>`; }
  return s + `</svg>`;
}
function paneMap(pane){
  const r = RBY[S.sel], info = ROUTE_INFO[r.id], open = unlocked(r);
  const reqs = [`<span class="${sum(S) >= RING_SUM[r.ring] ? 'y' : 'n'}">四人等级合计 ${sum(S)} / ${RING_SUM[r.ring]}</span>`];
  if (r.need) reqs.push(`<span class="${S.lv[r.need[0]] >= r.need[1] ? 'y' : 'n'}">${SYSK[r.need[0]].sys} ≥ ${r.need[1]}（短板）</span>`);
  if (r.needAll) reqs.push(`<span class="${SYS.every(s => S.lv[s.k] >= r.needAll) ? 'y' : 'n'}">四个系统都 ≥ ${r.needAll}</span>`);
  const got = S.cards[r.id] || 0, dsec = Math.round(r.sec * (1 - stat(S,'speed')));
  pane.innerHTML = `<div class="box mapbox">${mapSvg()}</div>
  <div class="box pdetail">
    <div class="pd-top"><svg class="pd-art" viewBox="-50 -50 100 100" aria-hidden="true"><rect x="-50" y="-50" width="100" height="100" fill="url(#deep)"/>${stars(14,-50,-50,100,100,r.id.length*7)}<g${open ? '' : ' class="plock"'}>${planet(r.id, 26)}</g></svg>
      <div class="pd-txt"><span class="hudline">◢ ${RING[r.ring]} · 航程 ${r.time}</span><h3>${r.name}</h3><div class="pd-desc">${info.desc}</div></div></div>
    <div class="req">${reqs.join('')}</div>
    <div class="pd-stats"><span><b>${r.pts[0]}–${r.pts[1]}</b>探索点</span><span><b>${got}/${r.cards.length}</b>剧情卡</span><span><b>${dsec}s</b>演示航程</span>${r.ring >= 1 && !r.final ? '<span class="alienchip"><b>👽</b>有外星剧情</span>' : ''}</div>
    <div class="hint">${S.hidden[r.id] ? `🎁 已找到隐藏物「${r.hid.name}」` : `🔍 隐藏物线索：${r.hid.hint}`}</div>
    <button class="btn launch" id="launch" ${open && !S.voyage ? '' : 'disabled'}>${S.voyage ? '飞船还在路上' : open ? '出航 →' : '还没解锁'}</button>
  </div>`;
  pane.querySelectorAll('[data-r]').forEach(g => g.addEventListener('click', () => { S.sel = g.dataset.r; save(); render(); }));
  const lb = document.getElementById('launch'); if (lb) lb.onclick = () => launch(r);
}

/* ========== 航行条 ========== */
function voyageBox(){
  const v = S.voyage; if (!v) return '';
  const r = RBY[v.route], p = Math.min(1, (Date.now() - v.start) / v.dur);
  const left = Math.max(0, Math.ceil((v.dur - (Date.now() - v.start)) / 1000));
  return `<div class="box voy2"><svg viewBox="0 0 300 54" aria-hidden="true"><rect width="300" height="54" fill="url(#deep)"/>${stars(26,0,0,300,54,41)}
      <circle cx="-6" cy="27" r="26" fill="url(#earthG)"/><path d="M24 27 H272" stroke="#7df9ff" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>
      <g transform="translate(278 27)">${planet(r.id, 13)}</g>
      <g id="voyship" transform="translate(${24 + p*240} 27) rotate(90)"><use href="#shipic" x="-9" y="-13" width="18" height="26"/></g></svg>
    <div class="voy-row"><span>正在前往 <b>${r.name}</b></span><span class="num" id="voyleft">${left} 秒</span></div>
    <span class="voy-note">正式版航程 ${r.time}，按手机本地时间返航，离线也会到。</span></div>`;
}

/* ========== 事件插图（320×150） ========== */
function scn(bg, inner){ return `<svg class="evart" viewBox="0 0 320 150" aria-hidden="true"><rect width="320" height="150" fill="${bg}"/>${inner}</svg>`; }
function cockpit(k){ return `<path d="M0 150 V112 Q160 84 320 112 V150z" fill="#1b2433" stroke="#0b0f17" stroke-width="2"/><path d="M0 112 Q160 84 320 112" stroke="#7df9ff" stroke-width="1.5" opacity=".6" fill="none"/>${[40,70,250,280].map(x => `<rect x="${x}" y="${116 - (x>160 ? (320-x) : x)*.05}" width="16" height="5" rx="1" fill="${x%20 ? '#39ff88' : '#ffd23f'}" opacity=".85"/>`).join('')}<use href="#ceo-${k}" x="10" y="52" width="82" height="100"/>`; }
const EV_ART = {
  pod:   () => scn('url(#deep)', stars(30,0,0,320,110,3) + `<g transform="translate(210 50) rotate(-18)"><rect x="-30" y="-16" width="60" height="32" rx="16" fill="#e9eef2" stroke="#0b0f17" stroke-width="2"/><circle cx="-10" r="7" fill="#3fb6ff" stroke="#0b0f17"/><circle cx="20" cy="-14" r="4" fill="#ff3b3b"/><circle cx="20" cy="-14" r="11" fill="#ff3b3b" opacity=".25"/></g>${[18,30,42].map(rr => `<path d="M${236 + rr} 26 a${rr} ${rr} 0 0 1 0 ${rr}" stroke="#ff8fab" stroke-width="1.5" fill="none" opacity=".7"/>`).join('')}` + cockpit('med')),
  rock:  () => scn('url(#deep)', stars(24,0,0,320,110,7) + [[150,30,14],[210,58,20],[262,22,11],[120,74,9],[290,70,15]].map(([x,y,r]) => `<path d="M${x+r*2} ${y-r} L${x+r*5} ${y-r*2.4}" stroke="#ffb347" stroke-width="${r*.5}" opacity=".35" stroke-linecap="round"/><g transform="translate(${x} ${y})">${planet('belt', r*.9)}</g>`).join('') + cockpit('war')),
  pirate:() => scn('#12081c', stars(20,0,0,320,110,9) + `<g transform="translate(220 52)"><path d="M-70 6 h140 l-24 22 h-92z" fill="#1a1020" stroke="#ff3b3b" stroke-width="1.5"/><path d="M-40 6 v-40 M20 6 v-30" stroke="#cfd8e3" stroke-width="2"/><path d="M-40 -34 h30 v20 h-30z" fill="#141414" stroke="#cfd8e3"/><circle cx="-25" cy="-26" r="4" fill="#fff"/><path d="M-29 -20 h8" stroke="#fff" stroke-width="2"/>${[-50,-20,10,40].map(x => `<circle cx="${x}" cy="16" r="3" fill="#ff3b3b"/>`).join('')}</g><rect width="320" height="150" fill="#ff3b3b" opacity=".08"/>` + cockpit('war')),
  food:  () => scn('#2f2c33', `<rect width="320" height="150" fill="url(#grid)" opacity=".4"/><g transform="translate(170 14)"><rect width="110" height="96" rx="4" fill="#e9eef2" stroke="#0b0f17" stroke-width="2"/><rect x="6" y="6" width="98" height="84" fill="#cfe9ff"/><rect x="6" y="48" width="98" height="3" fill="#9fb0cc"/><path d="M28 36 l1 -14 h12 l1 14z" fill="#fffaf0" stroke="#0b0f17"/><path d="M50 36 l1 -14 h12 l1 14z" fill="#e63946" stroke="#0b0f17"/><rect x="74" y="64" width="10" height="22" rx="2" fill="#e63946" stroke="#0b0f17"/><path d="M110 0 l40 10 v86 l-40 -0z" fill="#cfd8e3" stroke="#0b0f17" stroke-width="2"/></g>` + cockpit('life')),
  beep:  () => scn('url(#deep)', stars(24,0,0,320,110,13) + `<g transform="translate(230 50)">${[14,26,38,50].map((r,i) => `<path d="M${-r*.7} ${-r*.7} a${r} ${r} 0 0 1 0 ${r*1.4}" transform="scale(-1 1)" stroke="#7df9ff" stroke-width="2" fill="none" opacity="${1 - i*.2}"/>`).join('')}<rect x="-6" y="-6" width="12" height="12" fill="#ffd23f" stroke="#0b0f17"/></g><g transform="translate(120 30)">${[0,1,2,3,4,5,6,7].map(i => `<rect x="${i*8}" y="${20 - (i%3+1)*6}" width="5" height="${(i%3+1)*6}" fill="#39ff88"/>`).join('')}</g>` + cockpit('tech')),
  alien: () => scn('#0a1a2a', stars(26,0,0,320,110,17) + `<g transform="translate(220 52)"><ellipse rx="70" ry="16" fill="#9aa5b5" stroke="#0b0f17" stroke-width="2"/><ellipse cy="-8" rx="34" ry="18" fill="#7df9ff" opacity=".5" stroke="#0b0f17"/>${[-18,0,18].map(x => `<g transform="translate(${x} -12)"><ellipse rx="7" ry="7" fill="#80ed99" stroke="#0b0f17" stroke-width="1.2"/><ellipse cx="-2.5" cy="-1" rx="1.6" ry="2.4" fill="#0b0f17"/><ellipse cx="2.5" cy="-1" rx="1.6" ry="2.4" fill="#0b0f17"/></g>`).join('')}${[-52,-30,30,52].map(x => `<circle cx="${x}" cy="6" r="3" fill="#ffd23f"/>`).join('')}<path d="M-40 16 l-10 40 h100 l-10 -40z" fill="#80ed99" opacity=".12"/><rect x="-60" y="18" width="18" height="12" fill="#c8743a" stroke="#0b0f17"/><rect x="44" y="18" width="18" height="12" fill="#9b5de5" stroke="#0b0f17"/></g>` + cockpit('tech')),
};

/* ========== 剧情卡（漫画卡） ========== */
function storyArt(r, i){
  const card = r.cards[i], alien = card[0].startsWith('外星'), k = ROUTE_INFO[r.id].ceo;
  return `<svg class="scart" viewBox="0 0 160 110" aria-hidden="true"><rect width="160" height="110" fill="url(#deep)"/>${stars(12,0,0,160,110,r.id.length*3 + i*11)}
    <g transform="translate(116 ${36 + i*4})">${planet(r.id, 24)}</g>
    ${alien ? `<g transform="translate(104 78)"><ellipse rx="13" ry="12" fill="#80ed99" stroke="#0b0f17" stroke-width="1.5"/><ellipse cx="-4.5" cy="-1" rx="3" ry="4.5" fill="#0b0f17"/><ellipse cx="4.5" cy="-1" rx="3" ry="4.5" fill="#0b0f17"/><path d="M-4 -12 l-3 -7 M4 -12 l3 -7" stroke="#0b0f17" stroke-width="1.5"/><path d="M14 -4 l8 -6" stroke="#80ed99" stroke-width="4" stroke-linecap="round"/></g>` : ''}
    <use href="#ceo-${k}" x="8" y="${30 - (i%2)*4}" width="62" height="78"/>
    <rect x="1" y="1" width="158" height="108" fill="none" stroke="#0b0f17" stroke-width="2"/></svg>`;
}
function storyCard(r, i){
  const c = r.cards[i], alien = c[0].startsWith('外星');
  return `<div class="sc2${alien ? ' alien' : ''}">${storyArt(r, i)}<b>${c[0].replace('外星：','')}</b><span>${c[1]}</span>${alien ? '<em>外星剧情 · 产速 +25%</em>' : ''}</div>`;
}

/* ========== 出航 / 事件 / 结算（覆盖旧版） ========== */
function arrive(){
  const v = S.voyage; S.voyage = null; save();
  const r = RBY[v.route];
  if (r.final) { showEnding(); return; }
  const ev = v.ev === 'alien' ? ALIEN_EVENT : EVENTS.find(e => e.id === v.ev);
  const sy = SYSK[ev.sys];
  modal(`${EV_ART[ev.id]()}<span class="hudline dark">◢ 航行事件 · 返航途中 · ${r.name}</span><h3>${ev.title}</h3><div>${ev.text}</div>
    <div class="choices"><button class="btn" data-c="a">${ev.a[0]}<small>${ev.a[1]}${ev.id === 'alien' ? '' : ` · ${sy.ceo} 的${sy.sys}越高越稳`}</small></button>
    <button class="btn ghost" data-c="b">${ev.b[0]}<small>${ev.b[1]}</small></button></div>`, el => {
    el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => settle(r, ev, b.dataset.c));
  });
}
function settle(r, ev, c){
  let mult = 1, coinGain = 0, line = '', ok = true;
  if (ev.id === 'alien') {
    if (c === 'a') { coinGain = BASE_RATE * 3600 * (r.ring); line = ev.win; } else { mult = 1.3; line = '四个人和外星人拍了张合影，照片背面写着一串坐标。'; }
  } else if (c === 'a') {
    const base = {med:stat(S,'med'), war:stat(S,'shield'), life:stat(S,'cargo'), tech:stat(S,'radar')}[ev.sys];
    const p = Math.min(0.95, 0.35 + 0.1 * S.lv[ev.sys] + base);
    if (Math.random() < p) { mult = 1.5; line = ev.win; if (ev.fight) S.wins++; }
    else { ok = false; mult = 0.75; line = ev.lose; if (ev.fight) S.wins = 0; }
    line += `（成功率 ${pct(p)}）`;
  } else {
    if (ev.id === 'rock') { mult = 0.9; line = '绕了一大圈，平安到达。'; }
    else if (ev.id === 'pirate' || ev.id === 'food') { const fee = BASE_RATE * 600; S.coins = Math.max(0, S.coins - fee); line = `花了 ${fmt(fee)} 金币，平安无事。`; }
    else line = '什么也没发生，飞船继续往前。';
  }
  const pts = Math.round(rint(r.pts[0], r.pts[1]) * mult * (1 + stat(S,'cargo')) * (1 + 0.1*(S.lv.tech-1)));
  S.pts += pts; S.coins += coinGain;
  S.visits[r.id] = (S.visits[r.id]||0) + 1;
  const chips = [`<div class="rw"><b class="num">+${pts}</b><span>探索点</span></div>`];
  if (coinGain) chips.push(`<div class="rw gold"><b class="num">+${fmt(coinGain)}</b><span>外星生意金币</span></div>`);
  let cardHtml = '', extra = '';
  const n = S.cards[r.id] || 0;
  if (n < r.cards.length) {
    const card = r.cards[n]; S.cards[r.id] = n + 1; mark('card');
    cardHtml = `<div class="newcard"><span class="nc-tag">新剧情卡</span>${storyCard(r, n)}</div>`;
    if (card[0].startsWith('外星')) {
      S.alienCards++; mark('alien');
      const wf = BASE_RATE * 3600 * WINDFALL_H[r.ring];
      S.coins += wf;
      chips.push(`<div class="rw alien"><b class="num">×${alienMult().toFixed(2)}</b><span>四家店产速（永久 +25%）</span></div>`, `<div class="rw gold"><b class="num">+${fmt(wf)}</b><span>外星见面礼</span></div>`);
    }
  }
  if (!S.hidden[r.id] && r.hid.ok(S)) { S.hidden[r.id] = 1; mark('hidden'); extra = `<div class="hidfound">🎁 发现隐藏物「${r.hid.name}」</div>`; }
  S.coins = Math.min(S.coins, EARTH);
  save();
  modal(`<span class="hudline dark">◢ 返航报告 · ${r.name}</span><h3>${ok ? '平安返航' : '有点狼狈地返航'}</h3><div class="muted">${line}</div>
    <div class="rws">${chips.join('')}</div>${cardHtml}${extra}<button class="btn" data-close>收下</button>`);
}

/* ========== 科研：成果卡与抽取揭晓 ========== */
const TIER_C = ['#9aa5b5', '#2a9d8f', '#2f6fb5', '#9b5de5', '#f4b400'];
const TIER_N = ['普通', '精良', '稀有', '史诗', '传说'];
function itemArt(k, t, size){ return `<svg viewBox="-6 -4 50 52" width="${size || 56}" height="${size || 56}" aria-hidden="true"><g stroke="#0b0f17" stroke-width="2.2" stroke-linejoin="round">${IT[k][t-1]}</g></svg>`; }
function paneLab(pane){
  const s = SYSK[S.gsys], lv = S.lv[s.k];
  if (S.gtier > lv) S.gtier = lv;
  const cards = ITEMS[s.k].map((n, i) => { const t = i + 1, id = s.k + ':' + t, st = S.items[id];
    return st ? `<div class="ic2" style="--tc:${TIER_C[i]}"><span class="ic2-t">${TIER_N[i]}</span>${itemArt(s.k, t)}<b>${n}</b><span class="stars">${'★'.repeat(st)}${'☆'.repeat(3-st)}</span><span class="ic2-e">${s.stat} +${pct(itemPower(t, st))}</span></div>`
              : `<div class="ic2 off" style="--tc:${TIER_C[i]}"><span class="ic2-t">${t} 级</span><div class="ghost">${itemArt(s.k, t)}</div><b>？？？</b><span class="ic2-e">${t > lv ? `科研 ${t} 级可抽` : '还没抽到'}</span></div>`; }).join('');
  pane.innerHTML = `<div class="box lab">
    <div class="sysbar" role="tablist">${SYS.map(x => `<button role="tab" aria-selected="${S.gsys===x.k}" data-g="${x.k}" style="${S.gsys===x.k ? `background:${x.hex}` : ''}">${x.sys}</button>`).join('')}</div>
    <div class="lab-head"><svg viewBox="-4 -6 108 126" width="54" height="64" aria-hidden="true"><use href="#ceo-${s.k}"/></svg><div><b>${s.ceo} 的研究台</b><div class="muted">科研 ${lv} 级 · 能抽 ${lv} 级及以下的成果</div></div></div>
    <div class="tiers">${[1,2,3,4,5].map(t => `<button data-t="${t}" aria-selected="${S.gtier===t}" ${t > lv ? 'disabled' : ''} style="--tc:${TIER_C[t-1]}">${TIER_N[t-1]}<br><span class="num">${fmt(TIER_PRICE[t-1])}</span></button>`).join('')}</div>
    <button class="btn" id="roll" ${S.coins >= TIER_PRICE[S.gtier-1] ? '' : 'disabled'}>花 ${fmt(TIER_PRICE[S.gtier-1])} 金币研发一次</button>
    <div class="muted">出货：本档 70%，低一档 25%，低两档 5%。重复的会升星，最多 3 星。</div>
    <div class="inv2">${cards}</div>
    <div class="stats"><span>探索点 +${pct(stat(S,'cargo'))}</span><span>坏事件化解 +${pct(stat(S,'med'))}</span><span>遭遇战胜率 +${pct(stat(S,'shield'))}</span><span>航程 −${pct(stat(S,'speed'))} · 雷达 +${pct(stat(S,'radar'))}</span></div>
  </div>`;
  pane.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { S.gsys = b.dataset.g; save(); render(); });
  pane.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.gtier = +b.dataset.t; save(); render(); });
  document.getElementById('roll').onclick = roll;
}
function roll(){
  const t = S.gtier, price = TIER_PRICE[t-1];
  if (S.coins < price) return;
  S.coins -= price;
  const x = Math.random(); let got = x < 0.7 ? t : x < 0.95 ? t-1 : t-2; got = Math.max(1, got);
  const k = S.gsys, id = k + ':' + got, name = ITEMS[k][got-1];
  let msg, isNew = false;
  mark('tech');
  if (!S.items[id]) { S.items[id] = 1; isNew = true; msg = '新成果'; }
  else if (S.items[id] < 3) { S.items[id]++; msg = `升到 ${S.items[id]} 星`; }
  else { S.coins += price/2; msg = '已满星，退回一半金币'; }
  save(); render();
  modal(`<div class="reveal" style="--tc:${TIER_C[got-1]}"><div class="rv-rays"></div><div class="rv-card"><span class="ic2-t">${TIER_N[got-1]}</span>${itemArt(k, got, 110)}<b>${name}</b><span class="stars">${'★'.repeat(S.items[id])}${'☆'.repeat(3-S.items[id])}</span></div></div>
    <h3 style="text-align:center">${isNew ? '研发成功！' : msg}</h3><div class="muted" style="text-align:center">${SYSK[k].ceo} 的${SYSK[k].sys}系统 · ${got} 级成果${isNew ? '，已经摆进飞船里了' : ''}</div>
    <div style="display:flex;gap:8px;justify-content:center"><button class="btn ghost" data-close>好</button><button class="btn" id="again" ${S.coins >= price ? '' : 'disabled'}>再来一次</button></div>`, el => {
    el.querySelector('#again').onclick = () => { closeModal(); roll(); };
  });
}

/* ========== 收藏 ========== */
const HID_ART = {
  moon:`<rect x="18" y="8" width="3" height="40" fill="#cfd8e3" stroke="#0b0f17"/><path d="M21 9 h22 v14 h-22z" fill="#e9eef2" stroke="#0b0f17"/><path d="M21 13 h22 M21 17 h22" stroke="#e63946" stroke-width="1.5"/>`,
  station:`<rect x="10" y="12" width="30" height="22" rx="3" fill="#fffaf0" stroke="#0b0f17" stroke-width="1.5"/><circle cx="19" cy="22" r="5" fill="#bde0fe"/><path d="M27 19 h9 M27 25 h7" stroke="#0b0f17"/><path d="M25 12 v-6" stroke="#0b0f17"/>`,
  mars:`<path d="M8 36 L40 10" stroke="#8a6a4a" stroke-width="2.5"/>${[0,1,2].map(i => `<rect x="${14 + i*8}" y="${26 - i*7}" width="8" height="8" rx="2" fill="${['#c8553d','#e9c46a','#c8553d'][i]}" stroke="#0b0f17" transform="rotate(-38 ${18 + i*8} ${30 - i*7})"/>`).join('')}`,
  venus:`<circle cx="25" cy="24" r="12" fill="#fff" stroke="#e58aa8" stroke-width="2"/><circle cx="21" cy="20" r="4" fill="#fff6c2"/><circle cx="25" cy="24" r="18" fill="url(#glow)" opacity=".4"/>`,
  belt:`<path d="M12 34 l6 -18 l14 -4 l8 14 l-10 14z" fill="#7a6a5c" stroke="#0b0f17"/><circle cx="24" cy="26" r="4" fill="#7df9ff"/><path d="M38 10 q4 4 0 8 M42 6 q7 8 0 16" stroke="#7df9ff" fill="none"/>`,
  pirate:`<path d="M8 30 q17 -26 34 0z" fill="#141414" stroke="#0b0f17"/><path d="M6 30 h38" stroke="#141414" stroke-width="4"/><circle cx="25" cy="20" r="4" fill="#fff"/><path d="M21 26 h8" stroke="#fff" stroke-width="2"/><path d="M36 14 l6 -6" stroke="#ffd23f" stroke-width="2"/>`,
  europa:`<path d="M15 10 h20 l-3 30 h-14z" fill="#bde0fe" stroke="#0b0f17" stroke-width="1.5"/><rect x="15" y="22" width="20" height="18" fill="#d4a373" opacity=".8"/><g fill="#0b0f17"><circle cx="21" cy="34" r="2"/><circle cx="28" cy="36" r="2"/></g><path d="M12 8 h26" stroke="#e3edf5" stroke-width="5"/>`,
  saturn:`<circle cx="25" cy="25" r="14" fill="#cfd8e3" stroke="#0b0f17" stroke-width="1.5"/><circle cx="25" cy="25" r="4" fill="#0b0f17"/><path d="M14 20 a12 12 0 0 1 10 -8" stroke="#c9a7ff" stroke-width="2.5" fill="none"/><path d="M36 30 a12 12 0 0 1 -10 8" stroke="#7df9ff" stroke-width="2.5" fill="none"/>`,
  signal:`<rect x="10" y="14" width="30" height="20" fill="#fffaf0" stroke="#0b0f17" stroke-width="1.5"/><path d="M10 14 l15 11 l15 -11" fill="none" stroke="#0b0f17" stroke-width="1.5"/><circle cx="36" cy="32" r="5" fill="#e63946" stroke="#0b0f17"/>`,
};
function paneAlbum(pane){
  const totalCards = ROUTES.reduce((a,r) => a + r.cards.length, 0);
  const gotCards = ROUTES.reduce((a,r) => a + (S.cards[r.id]||0), 0);
  const gotHid = Object.keys(S.hidden).length;
  pane.innerHTML = `<div class="box albumhead"><div><b class="num">${gotCards}/${totalCards}</b><span>剧情卡</span></div><div><b class="num">${gotHid}/${ROUTES.length}</b><span>隐藏物</span></div><div><b class="num">${S.alienCards}/7</b><span>外星剧情</span></div></div>
  <div class="box hidshelf"><b>隐藏物展柜</b><div class="shelf">${ROUTES.map(r => S.hidden[r.id]
      ? `<div class="hs on" title="${r.hid.name}"><svg viewBox="0 0 50 50" aria-hidden="true">${HID_ART[r.id]}</svg><span>${r.hid.name}</span></div>`
      : `<div class="hs"><svg viewBox="0 0 50 50" aria-hidden="true"><text x="25" y="32" text-anchor="middle" font-size="22" fill="#9aa5b5">?</text></svg><span>${r.name}</span></div>`).join('')}</div></div>
  <div class="album">${ROUTES.map(r => `<div class="box route-row"><div class="rr-head"><svg viewBox="-30 -30 60 60" width="34" height="34" aria-hidden="true">${planet(r.id, 17)}</svg><b>${r.name}</b><span class="muted">${RING[r.ring]}</span></div>
    <div class="cards2">${r.cards.map((c,i) => i < (S.cards[r.id]||0) ? storyCard(r, i)
      : `<div class="sc2 lock"><div class="scart lockart"><span>第 ${i+1} 张</span></div><b>？？？</b><span>${c[0].startsWith('外星') ? '外星剧情 · 产速 +25%' : '出航解锁'}</span></div>`).join('')}</div></div>`).join('')}</div>`;
}

/* ========== 结局四格 ========== */
function streetPanel(n){
  const lit = n >= 1, all = n >= 3;
  const shops = [['#c8743a', n >= 1], ['#e58aa8', n >= 1], ['#2f6fb5', n >= 2], ['#7a7a72', n >= 2]];
  let s = `<rect width="320" height="200" fill="${all ? '#2b1838' : '#0d1424'}"/>${stars(30,0,0,320,90,5 + n)}`;
  if (all) s += `<rect width="320" height="200" fill="#ffb347" opacity=".12"/>`;
  s += `<rect y="160" width="320" height="40" fill="#2a2f3a"/>`;
  shops.forEach(([c, on], i) => {
    const x = 14 + i*76;
    s += `<rect x="${x}" y="84" width="66" height="76" fill="${on ? '#fffaf0' : '#3a4556'}" stroke="#0b0f17" stroke-width="2"/><path d="M${x-4} 84 h74 l-6 -16 h-62z" fill="${on ? c : '#56647d'}" stroke="#0b0f17" stroke-width="2"/><rect x="${x+20}" y="116" width="26" height="44" fill="${on ? '#ffd23f' : '#1b2433'}" stroke="#0b0f17" stroke-width="1.5"/>`;
    if (on) s += `<rect x="${x-6}" y="110" width="78" height="60" fill="#ffd23f" opacity=".15"/>`;
  });
  if (all) s += `<path d="M0 60 Q80 80 160 60 T320 60" fill="none" stroke="#0b0f17"/>${[20,60,100,140,180,220,260,300].map((x,i) => `<circle cx="${x}" cy="${66 + Math.sin(i)*6}" r="5" fill="${['#ffd23f','#ff8fab','#7df9ff'][i%3]}"/>`).join('')}`;
  return s;
}
const ENDING = [
  {cap:'一条很普通的街，四家店，灯都还没开。', art:() => streetPanel(0)},
  {cap:'77 的烤架冒起烟，珍珠姐煮好第一锅珍珠。', art:() => streetPanel(1) + `<use href="#ceo-life" x="20" y="112" width="52" height="64"/><use href="#ceo-med" x="96" y="112" width="52" height="64"/><path d="M40 100 q-6 -12 2 -22 M52 100 q-6 -12 2 -22" stroke="#fff" stroke-width="3" opacity=".5" fill="none"/>`},
  {cap:'阿宅把书架摆满，火箭老板的服务器亮了。', art:() => streetPanel(2) + `<use href="#ceo-war" x="172" y="112" width="52" height="64"/><use href="#ceo-tech" x="248" y="112" width="52" height="64"/>`},
  {cap:'一条街的灯全亮了。', art:() => streetPanel(3) + ['life','med','war','tech'].map((k,i) => `<use href="#ceo-${k}" x="${22 + i*76}" y="112" width="52" height="64"/>`).join('') + `<g transform="translate(160 30)"><rect x="-62" y="-14" width="124" height="28" rx="4" fill="#fffaf0" stroke="#0b0f17" stroke-width="2"/><text text-anchor="middle" y="6" font-size="15" font-weight="900" fill="#e63946">欢迎回家</text></g>`},
];
function showEnding(){
  S.hidden.signal = 1; S.cards.signal = 1; mark('reply'); save();
  modal(`<span class="hudline dark">◢ 未知信号源 · 已解码</span><h3>回信</h3><div class="muted">信号是一段漫画。四个人一格一格看下去。</div>
    <div class="endcomic">${ENDING.map((p, i) => `<figure><svg viewBox="0 0 320 200" aria-hidden="true">${p.art()}</svg><figcaption>${i + 1} · ${p.cap}</figcaption></figure>`).join('')}</div>
    <button class="btn" data-credits>看制作手记 →</button>`, el => {
    el.querySelector('[data-credits]').onclick = () => { closeModal(); S.ended = true; save(); screen = 'credits'; render(); };
  });
}

/* ========== 街道入口 ========== */
function renderStreet(){
  const shops = [['烧烤摊',110,82,'#c8743a'],['奶茶店',93,71,'#e58aa8'],['漫画书店',79,63,'#2f6fb5'],['科技公司',69,55,'#7a7a72']];
  app.innerHTML = hud() + `
  <div class="street">${shops.map(([n,max,lv,c]) => `<div class="box shop" style="border-top:8px solid ${c}"><b>${n}</b><span class="muted num">Lv ${lv} / ${max}</span><span class="ok">已过 Lv50 ✓</span></div>`).join('')}</div>
  <button class="pad2" id="enter" aria-label="进入星途">
    <svg viewBox="0 0 360 300" aria-hidden="true"><rect width="360" height="300" fill="url(#deep)"/>${stars(60,0,0,360,220,77)}
      <path d="M296 300 L150 30 L190 30z" fill="#7df9ff" opacity=".07"/><path d="M296 300 L360 20 L330 20z" fill="#ffd23f" opacity=".07"/>
      <circle cx="190" cy="52" r="20" fill="#c9ccd3"/><circle cx="190" cy="52" r="20" fill="url(#pshade)"/>
      <rect y="250" width="360" height="50" fill="#1b2433"/><path d="M0 250 H360" stroke="#7df9ff" stroke-width="1.5" opacity=".6"/>
      <g transform="translate(236 70)"><rect x="0" y="0" width="12" height="180" fill="url(#metalD)" stroke="#0b0f17" stroke-width="1.5"/>${[30,70,110,150].map(y => `<path d="M12 ${y} h40" stroke="#56647d" stroke-width="4"/><path d="M0 ${y-20} L12 ${y}" stroke="#56647d" stroke-width="2"/>`).join('')}<circle cx="6" cy="-4" r="4" fill="#ff3b3b"/></g>
      <g transform="translate(266 30)"><path d="M30 0 q30 40 30 120 v60 h-60 v-60 q0-80 30-120z" fill="url(#metal)" stroke="#0b0f17" stroke-width="2.5"/><circle cx="30" cy="70" r="12" fill="url(#dome)" stroke="#0b0f17" stroke-width="2.5"/><path d="M0 150 l-22 40 h22z M60 150 l22 40 h-22z" fill="#e63946" stroke="#0b0f17" stroke-width="2.5"/><path d="M0 120 h60" stroke="#e63946" stroke-width="5"/><path d="M10 180 q20 40 40 0z" fill="url(#plasma)"/></g>
      <text x="22" y="54" font-size="12" font-weight="900" fill="#ffd23f" letter-spacing="3">科技公司 · 发射台</text>
      <text x="20" y="112" font-size="54" font-weight="400" fill="#fff" class="padtitle" style="paint-order:stroke" stroke="#e63946" stroke-width="6">星途</text>
      <text x="22" y="140" font-size="12.5" font-weight="700" fill="#dbe7ff">四位 CEO 开飞船去太空。</text><text x="22" y="160" font-size="12.5" font-weight="700" fill="#dbe7ff">最后一站，是一个没人去过的信号。</text></svg>
    <span class="btn go">登船 →</span>
  </button>
  <div class="box" style="padding:10px 12px;font-size:12px">
    <b>开放条件（提议）</b>：四家店都开张，并且都升过 Lv50（最后一个里程碑）。没达到时，这块发射台是灰的，写着还差哪家店几级。
  </div>`;
  document.getElementById('enter').onclick = () => { screen = 'hub'; render(); };
}

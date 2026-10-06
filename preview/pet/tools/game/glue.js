/* ================= 宠物 p4：小狗（PetGame / PetEngine；存档只占 state.pet，一个键都不加） ================= */
const PG = window.PetGame, PET_LIBS = !!(PG && window.PetEngine && window.PetArt && window.PetPuppy);
let petRt = null, petView = null, petM = null, petHiddenAt = 0, petManual = false, petShown = '', petWaitShown = null;   // petWaitShown（p4b）：上一帧是不是「等待安置」，变了就重画家宅条
function petInit(tryN) {
  if (!PET_LIBS) return;
  fetch('../art/manifest.json?v=p4b').then(r => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json(); }).then(m => {
    const v = window.PetArt.validateManifest(m); if (!v.ok) throw new Error(v.errors.join('；'));
    petM = m; petRt = PG.createRuntime({ E, manifest: m }); petView = PG.createView({ manifest: m, PA: window.PetArt, PP: window.PetPuppy, atlasBase: '../art/', ver: 'p4b' });
    document.body.dataset.petReady = '1'; dirty = true;
  }).catch(e => { if ((tryN || 0) < 3) setTimeout(() => petInit((tryN || 0) + 1), 600 * ((tryN || 0) + 1)); else console.warn('小狗没加载到：' + e.message); });
}
const petOwned = () => !!(PG && PG.owned(state));
const petHere = () => petOwned() && state.pet.home === homeWho;
function petBeforePersist() { if (petRt && state) petRt.beforePersist(state); }
function petFrame(dt) {
  if (!petRt) return;
  const room = tab === 'home' && homeSub === 'room' && !!$('#roomFloor') && E.homeOpen(state, homeWho);
  const w = petManual ? petRt.sync(state) : petRt.frame(dt, state, { decorHere: room && homeMode === 'decor' && petHere() });
  const show = !!(w && room && petHere());
  // p4b：等待安置 ↔ 出来了：重画家宅条（提示 / 按钮）；正看着这个家时，腾出空地出来了给个提示
  const wt = !!(w && w.noRoom) + '|' + (w ? petRt.homeId : '');
  if (wt !== petWaitShown) { const was = petWaitShown; petWaitShown = wt; dirty = true; if (was && was.startsWith('true|') && wt === 'false|' + was.slice(5) && show) toast('腾出空地了，小狗跑出来啦', 2200); }
  petView.draw(show ? w : null, show ? $('#roomFloor') : null);
  if (!show) return;
  const lb = $('#petLabel'), af = $('#petAff');
  if (lb && lb.textContent !== w.dog.label) lb.textContent = w.dog.label;
  if (af) { const s = '亲密 ' + w.dog.affinity; if (af.textContent !== s) af.textContent = s; }
  const bb = $('#petBallBtn'); if (bb) { const busy = w.ball.state === 'carried' || w.ball.state === 'air'; if (bb.disabled !== busy) bb.disabled = busy; }
}
function petResume() {
  if (!petRt || !petHiddenAt) return;
  const away = now() - petHiddenAt; petHiddenAt = 0;
  if (away < 3000 || !petOwned()) return;
  const ev = petRt.resume(state);
  if (ev === 'slept' && tab === 'home' && homeSub === 'room' && petHere()) toast(`你不在的 ${Math.max(1, Math.round(away / 60000))} 分钟，小狗在窝里睡了一觉`, 2400);
}
function petMallCard() {
  if (!PG) return '';
  const P = PG.PET, own = petOwned(), open = E.homeOpen(state, homeWho), nm = E.CEO_BY_ID[homeWho].name;
  let b, line;
  const full = !own && open && petM && !PG.hasRoom(state, E, homeWho, petM);   // p4b：购买前就查有没有地方站
  if (full) { b = '<button class="buy no" disabled id="petNoRoom">暂时无法<br>入宅</button>'; line = `<b>${nm}</b> 的家摆满了，没有小狗能站的空地；收起或挪开家具、或升级房子后再来（不会扣钱）`; }
  else if (!own) { b = open ? btn('homePetBuy', homeWho, '购买', P.price) : '<button class="buy no" disabled>未加入</button>'; line = open ? `买了住进 <b>${nm}</b> 的家（只能养一只）` : `${homeWho === 'rocket' ? '这位 CEO' : nm} 还没加入，先切到已加入的 CEO`; }
  else if (state.pet.home === homeWho) { b = '<button class="buy no" disabled>住这儿</button>'; line = petRt && petRt.waiting && petRt.homeId === homeWho ? `住在 <b>${nm}</b> 的家，<b>等待安置</b>：屋里摆满了，腾出 1 格空地它就出来` : `已经住在 <b>${nm}</b> 的家，去家宅看看它`; }
  else { b = open ? `<button class="buy alt" data-act="homePetMove" data-arg="${homeWho}">搬过来</button>` : '<button class="buy no" disabled>未加入</button>'; line = `现在住在 <b>${E.CEO_BY_ID[state.pet.home].name}</b> 的家；搬家不花钱`; }
  return `<div class="card mall-card pet-card" id="petCard" data-pet="${own ? 'owned' : 'none'}" data-room="${full ? 'full' : 'ok'}"><div class="ava sq furn-ico pet-ico"><span>${P.emoji}</span></div><div class="info"><div class="name">${P.name}<span class="tag match">宠物 · 新</span></div>
    <div class="desc">${P.desc}<br>${line}</div></div>${b}</div>`;
}
function petRoomBar(id) {
  if (!PG || !petRt) return '';
  if (!petOwned()) return `<div class="note pet-note" id="petNote">商城新到：${PG.PET.emoji} ${PG.PET.name}（${fmt(PG.PET.price)} 金币），买了就住进来。<button class="buy alt" data-act="homeSub" data-arg="mall">去看看</button></div>`;
  if (state.pet.home !== id) return `<div class="note pet-note" id="petNote">${PG.PET.emoji} 小狗住在 ${E.CEO_BY_ID[state.pet.home].name} 的家。<button class="buy alt" data-act="homePetMove" data-arg="${id}">接过来</button></div>`;
  const w = petRt.sync(state);
  if (w && w.noRoom) return `<div class="note pet-note pet-wait" id="petWait">${PG.PET.emoji} <b>小狗等待安置</b>：屋里摆满了，没有它能站的空地。收起或挪开一件家具（留出 1 格）、或升级房子，它会自己出来。</div>`;   // p4b
  if (homeMode === 'decor') return `<div class="note pet-note" id="petNote">${PG.PET.emoji} 小狗在旁边等你摆完；摆好切回「生活」，它会自己绕开新家具。</div>`;
  return `<div class="pet-bar" id="petBar"><div class="pet-lb">${PG.PET.emoji} <b id="petLabel">${w ? w.dog.label : ''}</b><small id="petAff">${w ? '亲密 ' + w.dog.affinity : ''}</small></div>
    <button class="buy alt" data-act="homePetCall" id="petCallBtn">📣 呼唤</button><button class="buy alt" data-act="homePetPat" id="petPatBtn">✋ 摸摸</button><button class="buy alt" data-act="homePetBall" id="petBallBtn">🎾 抛球</button></div>`;
}
function confirmPetBuy(home) {
  if (!PG) return;
  const P = PG.PET, bal = state.coins, can = bal >= P.price, nm = E.CEO_BY_ID[home] ? E.CEO_BY_ID[home].name : '';
  if (petOwned()) { toast('已经有小狗了（只能养一只）'); return; }
  if (!petM) { toast('小狗还没准备好，稍后再试'); return; }
  if (!PG.hasRoom(state, E, home, petM)) { sfx('no'); toast(PG.NO_ROOM, 2600); dirty = true; return; }   // p4b：满屋不弹购买窗、不扣钱
  openModal(`<div class="mbubble">商城 · 宠物</div><div class="buy-prev"><div class="furn-ico big pet-ico"><span>${P.emoji}</span></div></div>
    <div class="mtitle">${P.name}</div>
    <table class="pv-table"><tr><td>价格</td><td>${fmt(P.price)}</td></tr><tr><td>当前余额</td><td>${fmt(bal)}</td></tr><tr><td>住进</td><td>${nm} 的家</td></tr><tr class="total"><td>买后余额</td><td class="${can ? '' : 'down'}">${can ? fmt(bal - P.price) : '还差 ' + fmt(P.price - bal)}</td></tr></table>
    <div class="mnote">${P.desc}以后想换个家，在商城或家宅里点「搬过来」，不花钱。</div>
    <div class="mbtns two"><button class="buy ghost" id="mNo">再想想</button><button class="buy red" id="pbYes" ${can ? '' : 'disabled'}>${can ? '确认购买' : '金币不够'}</button></div>`, false);
  $('#mNo').addEventListener('click', closeModal, { once:true });
  $('#pbYes').addEventListener('click', () => {
    const r = atomic(() => PG.buy(state, E, home, now(), petM)); closeModal();   // 确认时再查一次（弹窗开着时不会变，但不赌）
    if (!r.ok) { if (r.why !== 'saveFailed') failBuy(null, r.why); return; }
    homeWho = home; homeSub = 'room'; homeMode = 'live'; homeSel = null; pageFlip('prev'); $('#panel').scrollTop = 0;
    afterBuy(null, `${P.name} 住进 ${nm} 的家啦！点它摸摸`);
  }, { once:true });
}
function petMoveHere(home) {
  petBeforePersist();
  const r = atomic(() => PG.move(state, E, home));
  if (!r.ok) { if (r.why !== 'saveFailed') { sfx('no'); toast(r.why); } return; }
  homeWho = home; homeSub = 'room'; homeMode = 'live'; homeSel = null;
  const wt = petRt && petRt.sync(state) && petRt.waiting;
  sfx('tap'); toast(wt ? `小狗搬到 ${E.CEO_BY_ID[home].name} 的家了，但屋里摆满了：先等待安置，腾出空地它就出来` : `小狗搬到 ${E.CEO_BY_ID[home].name} 的家了`, wt ? 2800 : 1900); dirty = true;
}
function petDo(k) {
  if (!petRt || !petHere()) return;
  const r = k === 'call' ? petRt.call(state) : k === 'pet' ? petRt.pet(state, 'button') : petRt.throwBall(state);
  if (!r.ok) { sfx('no'); toast(r.why === 'carried' ? '球在它嘴里呢' : r.why === 'flying' ? '球还在飞' : r.why === 'rearrange' ? '先把家具摆好' : r.why === 'waiting' ? '屋里没地方站，先腾出空地' : '现在不行'); return; }
  sfx('tap'); if (r.ignored === 'asleep') toast('它睡着了，球先放那儿'); else if (r.ignored === 'tired') toast('它太困了，想回窝');
}
function petTap(e) {
  if (!petRt || !petView || !petHere() || !petRt.w) return false;
  if (!petView.hit(petRt.w, $('#roomFloor'), e.clientX, e.clientY)) return false;
  petRt.pet(state, 'tap'); sfx('tap'); return true;
}
const petHooks = {
  get rt() { return petRt; }, get w() { return petRt && petRt.w; }, get waiting() { return !!(petRt && petRt.waiting); }, get view() { return petView; }, get M() { return petM; }, PG,
  manual(on) { petManual = !!on; },
  advance(sec) { const w = petRt && petRt.sync(state); if (w) window.PetEngine.step(w, sec); return w ? window.PetEngine.snapshot(w) : null; },
  snapshot() { const w = petRt && petRt.sync(state); return w ? window.PetEngine.snapshot(w) : null; },
  resume(ms) { petHiddenAt = now() - (ms || 60000); petResume(); }, persist() { return persist(); },
};

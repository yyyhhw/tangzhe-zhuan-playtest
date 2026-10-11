// 打僵尸音效：短音效 WebAudio 现场合成，BGM 加载 audio/CREDITS.md 记录的 CC0 曲目。iPhone 要在点按里 unlock() 才能出声；静音跟经营页（state.muted）或暂停页开关。
(function () {
  'use strict';
  const BPM_MIN = 100, BPM_MAX = 150;
  const S = { ctx: null, master: null, music: null, sfx: null, muted: false, on: false, bpm: BPM_MIN, step: 0, next: 0, timer: 0, last: {}, count: {}, noiseBuf: null };
  const now = () => S.ctx ? S.ctx.currentTime : 0;
  const ready = () => S.ctx && S.ctx.state === 'running' && !S.muted;
  function unlock() {
    if (!S.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      try { S.ctx = new C(); } catch (e) { return; }
      S.master = S.ctx.createGain(); S.master.connect(S.ctx.destination); S.master.gain.value = S.muted ? 0 : 1;
      S.music = S.ctx.createGain(); S.music.gain.value = 0.16; S.music.connect(S.master);
      S.recorded=TzzLoopMusic.create({context:S.ctx,output:S.music,url:new URL('../audio/zombies-march.m4a',document.baseURI),isAllowed:()=>!S.muted&&!S.paused&&S.on});
      S.sfx = S.ctx.createGain(); S.sfx.gain.value = 0.5; S.sfx.connect(S.master);
      const n = S.ctx.sampleRate; S.noiseBuf = S.ctx.createBuffer(1, n, n); const d = S.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (S.ctx.state !== 'running' && !S.muted && !document.hidden) S.ctx.resume().catch(() => {});
    S.recorded?.retry();
  }
  function setMuted(m) { S.muted = !!m; if (S.master) S.master.gain.value = S.muted ? 0 : 1; if (S.muted) stopBgm(); }
  // 同一种声音最短间隔，免得一帧几十下打击声糊成一片
  function gate(name, gap) { const t = performance.now(); if (t - (S.last[name] || -1e9) < gap) return false; S.last[name] = t; S.count[name] = (S.count[name] || 0) + 1; return true; }
  function tone(type, f0, f1, dur, vol, at, out) {
    const t = at || now(), o = S.ctx.createOscillator(), g = S.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || S.sfx); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, fType, f0, f1, at, out) {
    const t = at || now(), src = S.ctx.createBufferSource(), fl = S.ctx.createBiquadFilter(), g = S.ctx.createGain();
    src.buffer = S.noiseBuf; fl.type = fType || 'bandpass'; fl.frequency.setValueAtTime(f0 || 1200, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(out || S.sfx); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const SHOT = {
    c77: () => noise(0.07, 0.10, 'highpass', 2500),                                   // 飞串：短促“嗖”
    pearl: () => tone('sine', 900, 1400, 0.06, 0.10),                                 // 珍珠弹：清脆“啵”
    otaku: () => noise(0.09, 0.09, 'bandpass', 700, 1800),                            // 回旋漫画：翻纸“唰”
    rocket: () => { tone('sawtooth', 300, 700, 0.08, 0.05); noise(0.08, 0.06, 'highpass', 1800); }   // 迷你火箭
  };
  const ULT = {
    c77: () => { noise(1.2, 0.5, 'lowpass', 400, 2400); tone('sawtooth', 70, 140, 1.0, 0.25); },                     // 火圈：轰燃
    pearl: () => { const t = now(); [1568, 1976, 2349, 3136].forEach((f, i) => tone('triangle', f, f, 0.5, 0.18, t + i * 0.08)); noise(1.4, 0.18, 'highpass', 5000); },   // 冰沙：冰晶叮当+风声
    otaku: () => { const t = now(); for (let i = 0; i < 5; i++) { noise(0.12, 0.35, 'bandpass', 500, 300, t + i * 0.3); tone('square', 160, 80, 0.12, 0.15, t + i * 0.3); } },   // 分镜：五下拍砸
    rocket: () => { const t = now(); tone('sawtooth', 120, 900, 0.5, 0.2, t); noise(1.0, 0.6, 'lowpass', 1500, 120, t + 0.45); tone('sine', 90, 40, 0.9, 0.5, t + 0.45); }   // 星舰：升空+爆冲
  };
  const sfx = {
    shot(ceo) { if (ready() && gate('shot', 90)) (SHOT[ceo] || SHOT.c77)(); },
    hit() { if (ready() && gate('hit', 55)) tone('square', 220 + Math.random() * 60, 120, 0.05, 0.07); },
    kill(boss) { if (ready() && gate(boss ? 'boss' : 'kill', boss ? 0 : 70)) { if (boss) { tone('sawtooth', 200, 40, 0.8, 0.3); noise(0.8, 0.4, 'lowpass', 900, 100); } else noise(0.12, 0.16, 'lowpass', 900, 200); } },
    ult(ceo) { if (ready() && gate('ult', 0)) (ULT[ceo] || ULT.c77)(); },
    hurt() { if (ready() && gate('hurt', 120)) { tone('square', 180, 60, 0.22, 0.22); noise(0.15, 0.2, 'lowpass', 700); } },
    win() { if (!ready() || !gate('win', 0)) return; const t = now(); [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.3, 0.2, t + i * 0.12)); },
    lose() { if (!ready() || !gate('lose', 0)) return; const t = now(); [392, 330, 262].forEach((f, i) => tone('triangle', f, f * 0.98, 0.35, 0.2, t + i * 0.18)); }
  };
  // 背景乐：16 步循环（低音 + 军鼓 + 旋律）；难度越高越快，BPM 封顶 150
  const BASS = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0], LEAD = [440, 0, 523, 0, 0, 494, 0, 440, 392, 0, 440, 0, 0, 523, 587, 0];
  function bpmFor(d) { return Math.round(Math.min(BPM_MAX, BPM_MIN + Math.max(0, d - 1) * 1.2)); }
  function setTempo(d) { S.bpm = bpmFor(d); }
  function tick() {
    if (!S.on || !ready()) return;
    const spb = 60 / S.bpm / 4;
    if (S.next < now()) S.next = now() + 0.05;
    while (S.next < now() + 0.15) {
      const i = S.step % 16, t = S.next;
      if (BASS[i]) tone('triangle', BASS[i], BASS[i], spb * 1.6, 0.5, t, S.music);
      if (LEAD[i] && (S.step >> 4) % 2) tone('square', LEAD[i], LEAD[i], spb * 0.9, 0.12, t, S.music);
      if (i % 4 === 0) tone('sine', 120, 45, 0.12, 0.6, t, S.music);
      if (i % 8 === 4) noise(0.1, 0.35, 'highpass', 1500, 0, t, S.music);
      S.step++; S.next += spb;
    }
  }
  function startBgm(d) { setTempo(d); if (S.on || S.muted) return; S.on = true; S.recorded?.start(); }
  function stopBgm() { S.on = false; S.recorded?.stop(); clearInterval(S.timer); }
  document.addEventListener('visibilitychange', () => { if (!S.ctx) return; if (document.hidden) S.ctx.suspend().catch(() => {}); else if (!S.muted) S.ctx.resume().catch(() => {}); });
  window.ZBSfx = Object.assign(sfx, { unlock, setMuted, startBgm, stopBgm, setTempo, bpmFor, BPM_MIN, BPM_MAX, state: S });
})();

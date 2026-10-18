import {withoutHome43Delta} from '../home43/exact-delta.mjs';
/** Exact r3 lifecycle delta; all other bytes must retain the r2/main baseline. */
const delta={
  "app.js": [
    [
      "if (!zbRun || zbRun.started || zbRun.settled || d.runId !== zbRun.runId || d.ceo !== zbRun.ceoId || zbBlocked() || document.hidden || !COLLECTION.ownsLock()) return;\n    // A matching receipt is insufficient: the current child must still be in this live start.\n    let live = false;\n    try { live = performance.now() <= zbRun.startDeadline && $('#zbFrame').contentWindow.__zbStartIsLive?.(d.runId, d.ceo) === true; } catch {}\n    if (!live) { zbRun = null; return; }",
      "if (!zbRun || zbRun.settled || d.runId !== zbRun.runId || d.ceo !== zbRun.ceoId || zbBlocked() || document.hidden || !COLLECTION.ownsLock()) return;"
    ],
    [
      "zbRun = { runId, ceoId: ceo, startedAt: now(), startDeadline: performance.now() + 4000, settled: false };",
      "zbRun = { runId, ceoId: ceo, startedAt: now(), settled: false };"
    ],
    [
      "  if (d.zb === 'hello') return zbReply();\n  if (d.zb === 'startInvalidated') {\n    if (zbRun && d.runId === zbRun.runId && !zbRun.started) zbRun = null;\n    return;\n  }",
      "  if (d.zb === 'hello') return zbReply();"
    ],
    [
      "    zbRun = null; if (zbPort) { zbPort.close(); zbPort = null; }\n    if (!zbOpen || !/\\/zombie\\//.test(f.src)) return;\n    const ch = new MessageChannel(), childDocument = f.contentDocument; zbPort = ch.port1;\n    zbPort.onmessage = e => { if (zbPort === ch.port1 && f.contentDocument === childDocument) zbMsg(e.data); };",
      "    if (!zbOpen || zbPort || !/\\/zombie\\//.test(f.src)) return;\n    const ch = new MessageChannel(); zbPort = ch.port1; zbPort.onmessage = e => zbMsg(e.data);"
    ]
  ],
  "preview/app.js": [
    [
      "if (!zbRun || zbRun.started || zbRun.settled || d.runId !== zbRun.runId || d.ceo !== zbRun.ceoId || zbBlocked() || document.hidden || !COLLECTION.ownsLock()) return;\n    // A matching receipt is insufficient: the current child must still be in this live start.\n    let live = false;\n    try { live = performance.now() <= zbRun.startDeadline && $('#zbFrame').contentWindow.__zbStartIsLive?.(d.runId, d.ceo) === true; } catch {}\n    if (!live) { zbRun = null; return; }",
      "if (!zbRun || zbRun.settled || d.runId !== zbRun.runId || d.ceo !== zbRun.ceoId || zbBlocked() || document.hidden || !COLLECTION.ownsLock()) return;"
    ],
    [
      "zbRun = { runId, ceoId: ceo, startedAt: now(), startDeadline: performance.now() + 4000, settled: false };",
      "zbRun = { runId, ceoId: ceo, startedAt: now(), settled: false };"
    ],
    [
      "  if (d.zb === 'hello') return zbReply();\n  if (d.zb === 'startInvalidated') {\n    if (zbRun && d.runId === zbRun.runId && !zbRun.started) zbRun = null;\n    return;\n  }",
      "  if (d.zb === 'hello') return zbReply();"
    ],
    [
      "    zbRun = null; if (zbPort) { zbPort.close(); zbPort = null; }\n    if (!zbOpen || !/\\/zombie\\//.test(f.src)) return;\n    const ch = new MessageChannel(), childDocument = f.contentDocument; zbPort = ch.port1;\n    zbPort.onmessage = e => { if (zbPort === ch.port1 && f.contentDocument === childDocument) zbMsg(e.data); };",
      "    if (!zbOpen || zbPort || !/\\/zombie\\//.test(f.src)) return;\n    const ch = new MessageChannel(); zbPort = ch.port1; zbPort.onmessage = e => zbMsg(e.data);"
    ]
  ],
  "zombie/zombie.js": [
    [
      "$('#menuBtn').addEventListener('click', () => { invalidateStart(); G = null;",
      "$('#menuBtn').addEventListener('click', () => { G = null;"
    ],
    [
      "if (!canPlay()) { invalidateStart(); G = null;",
      "if (!canPlay()) { G = null;"
    ],
    [
      "function abortStart(why) {\n  invalidateStart();\n  SFX.stopBgm();",
      "function abortStart(why) {\n  SFX.stopBgm();"
    ],
    [
      "    if (!startDocumentActive || performance.now() > G.startDeadline || d.ok !== true || !ZB.CEO_IDS.includes(d.ceo))",
      "    if (d.ok !== true || !ZB.CEO_IDS.includes(d.ceo))"
    ],
    [
      "  invalidateStart();\n  resize(); G = newRun(mode, n); G.runId = newRunId(); G.startDeadline = performance.now() + 4000;",
      "  resize(); G = newRun(mode, n); G.runId = newRunId();"
    ],
    [
      "let G = null, raf = 0, last = 0, paused = false;\nlet startDocumentActive = true;\nObject.defineProperty(window, '__zbStartIsLive', { value: (runId, ceo) => startDocumentActive && !!G && !G.pendStart && !G.over && G.runId === runId && G.ceo === ceo && performance.now() <= G.startDeadline });\nfunction invalidateStart() { if (EMBED && G) host({ zb:'startInvalidated', runId:G.runId }); }\nwindow.addEventListener('pagehide', () => { startDocumentActive = false; invalidateStart(); });",
      "let G = null, raf = 0, last = 0, paused = false;"
    ]
  ],
  "preview/zombie/zombie.js": [
    [
      "$('#menuBtn').addEventListener('click', () => { invalidateStart(); G = null;",
      "$('#menuBtn').addEventListener('click', () => { G = null;"
    ],
    [
      "if (!canPlay()) { invalidateStart(); G = null;",
      "if (!canPlay()) { G = null;"
    ],
    [
      "function abortStart(why) {\n  invalidateStart();\n  SFX.stopBgm();",
      "function abortStart(why) {\n  SFX.stopBgm();"
    ],
    [
      "    if (!startDocumentActive || performance.now() > G.startDeadline || d.ok !== true || !ZB.CEO_IDS.includes(d.ceo))",
      "    if (d.ok !== true || !ZB.CEO_IDS.includes(d.ceo))"
    ],
    [
      "  invalidateStart();\n  resize(); G = newRun(mode, n); G.runId = newRunId(); G.startDeadline = performance.now() + 4000;",
      "  resize(); G = newRun(mode, n); G.runId = newRunId();"
    ],
    [
      "let G = null, raf = 0, last = 0, paused = false;\nlet startDocumentActive = true;\nObject.defineProperty(window, '__zbStartIsLive', { value: (runId, ceo) => startDocumentActive && !!G && !G.pendStart && !G.over && G.runId === runId && G.ceo === ceo && performance.now() <= G.startDeadline });\nfunction invalidateStart() { if (EMBED && G) host({ zb:'startInvalidated', runId:G.runId }); }\nwindow.addEventListener('pagehide', () => { startDocumentActive = false; invalidateStart(); });",
      "let G = null, raf = 0, last = 0, paused = false;"
    ]
  ]
};
export function withoutStartLifecycleDelta(path,source){
  source=withoutHome43Delta(path,source); // 家宅-43 叠在最上面：先撤 43（撤过的原样返回）
 for(const [after,before] of delta[path]??[]){if(source.split(after).length!==2)throw Error("LIFECYCLE_DELTA_NOT_EXACT: "+path);source=source.replace(after,before);}
 return source;
}

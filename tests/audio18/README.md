# Audio18 source-record candidate

Base: 349c0e6186172dcac5cee2ed0134018e9ef4a90b. Only audio/CREDITS.md and tests/audio18 change. No game code/audio bytes changed.

Run offline: `node --test tests/audio18/*.test.mjs` (6/6 pass, includes four negative controls).
Run official byte comparison: `node tests/audio18/verify-source.mjs` (network opt-in). 2026-10-18T03:56:13Z: official download and local asset identical, 7979070 bytes, SHA256 07cc9cd797c8ea6738b1bd740526f2610fd2ec0115774294ebda3a5ed8e62a30.

Full same-machine baseline and candidate: `node --experimental-vm-modules --test`. Failure-name multiset: added 0, removed 0. Existing failures remain; this is not an all-green repository claim. Node v24.19.0 on Mac arm64.

Source pages reviewed: https://opengameart.org/content/tower-defense-theme (DST, CC0, displayed filename vs actual link); https://opengameart.org/content/zombies-march (yd, CC0). Commenter bart is not the author. Tests pin bytes and mapping, not legal conclusions.

Scope limits: no new audio playback/browser test (runtime unchanged); no new proof of historical zombie transcode; Old Tower Inn path absent in current base, historical license not reverified; task117 original requirement not independently found. Existing Carefree attribution retained. No CI/Actions/checks/logs/artifacts access, no new Kenney integration, no card restoration, no main merge/deployment.

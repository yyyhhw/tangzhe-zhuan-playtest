# Toast priority and expiry

This local candidate covers all four entry points. It does not change wallet, save, game or TD algorithms.

Priority: **error > operation feedback > ambient event**. Existing calls default to feedback; storage/data error phrases retain error classification, and an explicit fourth argument `error` is also supported. Automatic arrivals, super events and pet-room availability notifications explicitly use `ambient`. Paid actions, placement feedback and input rejection remain feedback.

- Errors immediately replace other messages, including older errors, and restart their existing display duration. Error messages use `role=alert`; other messages use `role=status`.
- While an error is visible, retain the newest three distinct feedback messages in FIFO order, plus the newest ambient message. Repeated identical feedback replaces its older queued copy. Capacity is four pending messages total. Ambient messages never evict feedback.
- Queued feedback expires eight seconds after enqueue; ambient expires after three seconds. An expired entry never starts displaying. Once started, a message gets its existing display duration. Expiry checks both monotonic and wall time, protecting against clock suspension and backward wall-clock changes.
- Feedback interrupts ambient. Fresh feedback outside an error hold replaces older feedback, including pending feedback from older operations. Ambient cannot interrupt displayed feedback.
- Before new input, synchronize any expired active message even if its timeout is late. Canceled callbacks carry generation guards. This prevents an old queue from appearing after a newer action.
- On hidden/pagehide, clear ordinary pending messages and hide ordinary active messages; ignore ordinary events while hidden. An unexpired error can remain until its original deadline. On visible/pageshow after an observed suspension, or a pageshow with persisted=true (BFCache), clear the queue and dismiss expired active messages. Initial pageshow with persisted=false does not discard boot feedback. Backup recovery notices explicitly use error priority so ordinary migration messages cannot replace them. No toast state is persisted or transported across navigation.

Cache labels: formal root/pet `15c-rc2`; preview root/pet `15c-rc2-preview`. The published formal TD iframe and its module references retain `15-td-balance1` unchanged. See INTEGRATION.md for rebase scope; these are local candidate labels, not a deployment claim.

## Tests

`node test_toast_queue.mjs` exercises the exact four production blocks, checks they are identical, and covers queue bounds, priority, expiration, consecutive errors, timer replacement, delayed callbacks, wall-clock changes, visibility and page lifecycle. The DOM and clock are deterministic fakes, not a physical-device test.

`TOAST_EXTENDED=1 PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test_toast_regression.mjs` uses installed Chromium, isolated contexts and synthetic saves, and starts its own temporary loopback HTTP server. Set PLAYWRIGHT_BROWSERS_PATH if the installed browser cache requires it. No installation or live-site access is needed. Output defaults to `/tmp/toast-regression-results.json`; override TOAST_OUTPUT. TOAST_CASE_MATCH can select case-name substrings.

The browser suite inserts accessors into responses only, without replacing toast logic. Super-event tests use the real forceSupers path. Background tests use simulated visibility/timing and do not certify OS suspension, iPhone or WebKit.

Wallet fault-injection rows are separately classified: rolling backup is expected to become the previous valid main before attempting a new main write. The preview's pre-existing injected silent-main-write behavior is explicitly checked and labelled `known-preview-injected-silent-write`, never presented as successful persistence. Formal entries reject this injection. This candidate does not repair or alter storage behavior.

The supplied `test_toast_hold.mjs` is retained as author evidence; the independent suites above cover this candidate. Author-reported broad regression failures were not independently rerun in this task. Review this candidate before any integration, and reconcile version labels with the release being integrated.

`test_toast_lifecycle.mjs` holds a local image response until boot completes, then checks the browser's trusted first pageshow (persisted=false), plus real missing-main/bad-main recovery paths. It does not synthesize pageshow. BFCache/visibility behavior is additionally covered by the deterministic queue suite.

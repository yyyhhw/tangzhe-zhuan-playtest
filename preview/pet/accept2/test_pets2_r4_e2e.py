"""Current browser regression entrypoint for the superseded r4 dog draft.

Runs purchase uniqueness, legacy compatibility swap/save rollback, reload and
real two-tab guards from test_dogs2_e2e.py. Full-room floor, malformed/readonly
storage and multi-species rollback are executable in test_pet_portal_regressions.js;
normal-host seven-species UI/cancel/replacement is test_pet_portal_e2e.mjs.
The old repeated-dog purchase success assertions are intentionally replaced.
"""
from test_dogs2_e2e import main
if __name__ == '__main__':
    raise SystemExit(main())

"""Compatibility entrypoint for the current one-per-species dog acceptance.

The old three-new-dog purchase assertions were superseded. This runs the same
current suite as test_dogs2_e2e.py, including blocked repeat purchase with no debit,
old duplicate retention, explicit activation, failed save rollback and refresh.
Mixed-species coverage is in test_pet_portal_e2e.mjs.
"""
from test_dogs2_e2e import main
if __name__ == '__main__':
    raise SystemExit(main())

// Product trial approved; technical release remains subject to tests + independent review.
export const WALLET_BRIDGE_APPROVED = true;
export const EXPECTED_TRIAL_SHA256 = '84e1ed25071d2e5719cdc0b4a668388864655ddae979fc96c1a3b89c630b018c';
// Public configuration reference only; authorization records are retained outside runtime.
export const APPROVAL_EVIDENCE = Object.freeze([
  'release-config-sha256:84e1ed25071d2e5719cdc0b4a668388864655ddae979fc96c1a3b89c630b018c'
]);

export const CARDS_ENTRY_ENABLED = true; // rollback: false; keep this save runtime deployed

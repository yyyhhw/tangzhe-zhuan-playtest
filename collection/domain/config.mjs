import { canonical, clone, exact, freeze, identifier, integer, add } from './json.mjs?v=formal-cards-candidate-7';
import { CATALOG_VERSION, PLAYABLE_CARDS, playable } from './catalog.mjs?v=formal-cards-candidate-7';
export const RARITIES = freeze(['common', 'rare', 'epic', 'legendary']);
export const GOLD_DUPLICATE_POLICY = 'upgrade-normal-and-dust';
/** No economy defaults. Every number and every card's rarity must be supplied. */
export function validateConfig(input) {
  canonical(input);
  exact(input, ['schemaVersion','configVersion','purpose','catalogVersion','poolVersion','drawPriceGold','dustBalanceCap','probabilityScale','goldDuplicatePolicy','pityPolicy','rarities','pool'], 'CONFIG');
  if (input.schemaVersion !== 3) throw new Error('UNSUPPORTED_CONFIG_SCHEMA');
  identifier(input.configVersion, 'CONFIG_VERSION');
  identifier(input.poolVersion, 'POOL_VERSION');
  if (!['test-fixture','integration'].includes(input.purpose)) throw new Error('INVALID_CONFIG_PURPOSE');
  if (input.catalogVersion !== CATALOG_VERSION) throw new Error('UNSUPPORTED_CATALOG_VERSION');
  integer(input.drawPriceGold, 1, Number.MAX_SAFE_INTEGER, 'DRAW_PRICE');
  integer(input.dustBalanceCap, 1, Number.MAX_SAFE_INTEGER, 'DUST_CAP');
  integer(input.probabilityScale, 1, Number.MAX_SAFE_INTEGER, 'PROBABILITY_SCALE');
  if (input.goldDuplicatePolicy !== GOLD_DUPLICATE_POLICY) throw new Error('UNSUPPORTED_GOLD_DUPLICATE_POLICY');
  if (input.pityPolicy !== 'none') throw new Error('UNSUPPORTED_PITY_POLICY');
  if (!Array.isArray(input.rarities) || input.rarities.length !== 4) throw new Error('INVALID_RARITIES');
  const seen = new Set(); let sum = 0;
  for (const rarity of input.rarities) {
    exact(rarity, ['id','weight','duplicateDust','craftDustCost','goldenWeight','goldenDuplicateDust','ownershipCap','deckCap'], 'RARITY');
    if (!RARITIES.includes(rarity.id) || seen.has(rarity.id)) throw new Error('INVALID_RARITY_ID');
    seen.add(rarity.id);
    sum = add(sum, integer(rarity.weight, 0, input.probabilityScale, 'RARITY_WEIGHT'));
    integer(rarity.duplicateDust, 0, Number.MAX_SAFE_INTEGER, 'DUPLICATE_DUST');
    integer(rarity.craftDustCost, 1, Number.MAX_SAFE_INTEGER, 'CRAFT_COST');
    integer(rarity.goldenWeight,0,input.probabilityScale,'GOLDEN_WEIGHT');
    integer(rarity.goldenDuplicateDust,0,Number.MAX_SAFE_INTEGER,'GOLDEN_DUST');
    integer(rarity.ownershipCap, 1, 2, 'OWNERSHIP_CAP');
    integer(rarity.deckCap, 1, 2, 'DECK_CAP');
    if (rarity.ownershipCap !== rarity.deckCap) throw new Error('OWNERSHIP_AND_DECK_CAPS_MUST_MATCH');
  }
  if (sum !== input.probabilityScale) throw new Error('PROBABILITIES_MUST_SUM_TO_SCALE');
  if (!Array.isArray(input.pool) || input.pool.length === 0) throw new Error('EMPTY_DRAW_POOL');
  const ids = new Set();
  for (const entry of input.pool) {
    exact(entry, ['cardId','rarity'], 'POOL_ENTRY'); playable(entry.cardId);
    if (ids.has(entry.cardId)) throw new Error('DUPLICATE_CARD_ID');
    ids.add(entry.cardId);
    if (!RARITIES.includes(entry.rarity)) throw new Error('INVALID_POOL_RARITY');
  }
  for (const rarity of input.rarities) if (rarity.weight > 0 && !input.pool.some(c => c.rarity === rarity.id)) throw new Error('EMPTY_WEIGHTED_RARITY');
  return freeze(clone(input));
}
/**
 * Deployment gate, NOT an authentication primitive. The host must construct this
 * record from authenticated owner approval; never accept a client-supplied claim.
 * Exact canonical config binding prevents reusing approval after any value changes.
 */
export function admitIntegrationConfig(input, approval) {
  const config = validateConfig(input);
  canonical(approval);
  exact(approval, ['schemaVersion','approvedConfigCanonical','evidenceRefs','walletBridgeApproved'], 'APPROVAL');
  if (config.purpose !== 'integration' || approval.schemaVersion !== 1 || approval.approvedConfigCanonical !== canonical(config) || approval.walletBridgeApproved !== true || !Array.isArray(approval.evidenceRefs) || approval.evidenceRefs.length === 0 || approval.evidenceRefs.some(v => typeof v !== 'string' || !v.trim())) throw new Error('UNAPPROVED_INTEGRATION_CONFIG');
  return config;
}

/** Product-trial boundary only. A trusted host supplies verified evidence; never a UI self-approval. */
export function admitApprovedTrialConfig(input, approval) {
  const config = validateConfig(input);
  canonical(approval);
  exact(approval, ['schemaVersion','approvedConfigCanonical','evidenceRefs','walletBridgeApproved'], 'APPROVAL');
  if (config.purpose !== 'integration' || approval.schemaVersion !== 1 || approval.approvedConfigCanonical !== canonical(config) || approval.walletBridgeApproved !== false || !Array.isArray(approval.evidenceRefs) || approval.evidenceRefs.length === 0 || approval.evidenceRefs.some(v => typeof v !== 'string' || !v.trim())) throw new Error('UNAPPROVED_TRIAL_CONFIG');
  return config;
}

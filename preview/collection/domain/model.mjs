import { canonical, clone, exact, freeze, identifier, integer, add } from './json.mjs';
import { PLAYABLE_CARDS, CATALOG_VERSION, playable, isDeckEligible, CLASSES } from './catalog.mjs';
import { validateConfig, admitIntegrationConfig, admitApprovedTrialConfig } from './config.mjs';

const MAX = Number.MAX_SAFE_INTEGER;
const same = (a, b) => canonical(a) === canonical(b);
const emptyCopies = () => ({ normal: 0, golden: 0 });
const commandIdentity = command => { const copy = { ...command }; delete copy.expectedRevision; delete copy.eventId; return canonical(copy); };

/** Creates a deliberately nonintegrable sandbox model. Economy fixtures are never production defaults. */
export function createFixtureModel(input) {
  const config = validateConfig(input);
  if (config.purpose !== 'test-fixture') throw new Error('FIXTURE_CONFIG_REQUIRED');
  return createModel(config, 'test-fixture');
}
/** No wallet or storage implementation is installed by this function. */
export function createIntegrationModel(input, approval) {
  return createModel(admitIntegrationConfig(input, approval), 'approved-integration-boundary');
}

/** Pure approved-trial domain model. Does not grant technical wallet approval or perform I/O. */
export function createApprovedTrialModel(input, approval) {
  return createModel(admitApprovedTrialConfig(input, approval), 'approved-trial-no-wallet');
}

function createModel(config, mode) {
  const configCanonical = canonical(config);
  const rarityById = Object.fromEntries(config.rarities.map(r => [r.id, r]));
  const poolByRarity = Object.fromEntries(config.rarities.map(r => [r.id, config.pool.filter(c => c.rarity === r.id)]));
  const poolById = Object.fromEntries(config.pool.map(c => [c.cardId, c]));
  const trustedStates = new WeakSet();
  const trusted = state => { freeze(state); trustedStates.add(state); return state; };

  function cardPolicy(cardId) {
    const card = playable(cardId);
    if (!Object.hasOwn(poolById, cardId)) throw new Error('CARD_NOT_IN_CONFIGURED_POOL');
    const rarity = poolById[cardId].rarity, policy = rarityById[rarity];
    return freeze({ cardId, name: card.name, classId: card.classId, rarity,
      ownershipCap: policy.ownershipCap, deckCap: policy.deckCap });
  }
  function copies(holdings, cardId) { playable(cardId); return holdings[cardId] ?? emptyCopies(); }
  function checkHoldings(holdings) {
    if (!holdings || typeof holdings !== 'object' || Array.isArray(holdings)) throw new Error('INVALID_HOLDINGS');
    for (const [id, value] of Object.entries(holdings)) {
      const cap = cardPolicy(id).ownershipCap; exact(value, ['normal','golden'], 'COPIES');
      integer(value.normal, 0, 2, 'NORMAL_COPIES'); integer(value.golden, 0, 2, 'GOLDEN_COPIES');
      if (value.normal + value.golden > cap) throw new Error('OWNERSHIP_COPY_LIMIT');
    }
  }
  function makeInitial(genesis) {
    canonical(genesis); exact(genesis, ['holdings','dust','preferences'], 'GENESIS');
    checkHoldings(genesis.holdings); integer(genesis.dust, 0, config.dustBalanceCap, 'DUST_BALANCE');
    exact(genesis.preferences, ['suppressOverflowWarning'], 'PREFERENCES');
    if (typeof genesis.preferences.suppressOverflowWarning !== 'boolean') throw new Error('INVALID_PREFERENCE');
    return trusted({ schemaVersion: 2, configVersion: config.configVersion, configCanonical,
      genesis: clone(genesis), revision: 0, collectionRevision: 0, holdings: clone(genesis.holdings),
      dust: genesis.dust, preferences: clone(genesis.preferences), activeTxId: null, transactions: {}, events: [] });
  }
  /** Explicit genesis only; no new-player rewards, reset, migration, or invented wallet. */
  function createState(genesis) { return makeInitial(genesis); }

  /** Replay-check all persisted fields, including outcomes, receipts, consent and revision. */
  function restore(input) {
    if (trustedStates.has(input)) return input;
    canonical(input);
    exact(input, ['schemaVersion','configVersion','configCanonical','genesis','revision','collectionRevision','holdings','dust','preferences','activeTxId','transactions','events'], 'STATE');
    if (input.schemaVersion === 1) throw new Error('LEGACY_STATE_REQUIRES_EXPLICIT_MIGRATION_KEEP_ORIGINAL');
    if (input.schemaVersion !== 2) throw new Error('UNSUPPORTED_STATE_SCHEMA_KEEP_ORIGINAL');
    if (input.configVersion !== config.configVersion || input.configCanonical !== configCanonical) throw new Error('STATE_CONFIG_MISMATCH_KEEP_ORIGINAL');
    if (!Array.isArray(input.events)) throw new Error('INVALID_EVENT_LOG');
    let replay = makeInitial(input.genesis);
    for (const command of input.events) {
      const next = apply(replay, command);
      if (next === replay) throw new Error('NONCANONICAL_DUPLICATE_EVENT');
      replay = next;
    }
    if (!same(input, replay)) throw new Error('STATE_REPLAY_MISMATCH_KEEP_ORIGINAL');
    return replay;
  }

  /** Enumerate potential duplicate dust, without randomness or any wallet call. */
  function drawQuote(state) {
    let maximumEarned = 0;
    for (const entry of config.pool) {
      if (rarityById[entry.rarity].weight === 0) continue;
      const owned = copies(state.holdings, entry.cardId);
      if (owned.normal + owned.golden === rarityById[entry.rarity].ownershipCap) maximumEarned = Math.max(maximumEarned, rarityById[entry.rarity].duplicateDust);
    }
    const maximumCredited = Math.min(config.dustBalanceCap - state.dust, maximumEarned);
    return { goldCost: config.drawPriceGold, dustCost: 0, maximumDustEarned: maximumEarned,
      maximumDustCredited: maximumCredited, maximumDustDiscarded: maximumEarned - maximumCredited,
      requiresOverflowConfirmation: maximumEarned > maximumCredited && !state.preferences.suppressOverflowWarning };
  }
  function gildQuote(state, cardId) {
    if (!Object.hasOwn(poolById, cardId)) throw new Error('CARD_NOT_IN_CONFIGURED_POOL');
    const owned = copies(state.holdings, cardId);
    if (owned.normal < 1) throw new Error('NO_NORMAL_COPY_TO_GILD');
    const cost = rarityById[poolById[cardId].rarity].gildDustCost;
    if (state.dust < cost) throw new Error('INSUFFICIENT_DUST');
    return { goldCost: 0, dustCost: cost, maximumDustEarned: 0, maximumDustCredited: 0,
      maximumDustDiscarded: 0, requiresOverflowConfirmation: false };
  }
  function quote(input, request) {
    const state = restore(input); canonical(request); checkRequest(request);
    return freeze(request.kind === 'draw' ? drawQuote(state) : gildQuote(state, request.cardId));
  }
  function checkRequest(request) {
    if (request?.kind === 'draw') exact(request, ['kind'], 'REQUEST');
    else if (request?.kind === 'gild') { exact(request, ['kind','cardId'], 'REQUEST'); playable(request.cardId); }
    else throw new Error('INVALID_REQUEST_KIND');
  }
  function selectedCard(tickets) {
    exact(tickets, ['rarity','card','golden'], 'TICKETS');
    integer(tickets.rarity, 0, config.probabilityScale - 1, 'RARITY_TICKET');
    integer(tickets.golden, 0, config.probabilityScale - 1, 'GOLDEN_TICKET');
    let cursor = 0, selected;
    for (const rarity of config.rarities) {
      cursor = add(cursor, rarity.weight);
      if (tickets.rarity < cursor) { selected = rarity; break; }
    }
    const pool = poolByRarity[selected.id];
    integer(tickets.card, 0, pool.length - 1, 'CARD_TICKET');
    return { cardId: pool[tickets.card].cardId, rarity: selected.id,
      finish: selected.id === 'legendary' && tickets.golden < config.goldenLegendaryWeight ? 'golden' : 'normal' };
  }
  function drawOutcome(state, tickets) {
    const result = selectedCard(tickets);
    const before = clone(copies(state.holdings, result.cardId)), after = clone(before);
    let dustEarned = 0, action = 'collected';
    if (before.normal + before.golden < rarityById[result.rarity].ownershipCap) after[result.finish]++;
    else {
      dustEarned = rarityById[result.rarity].duplicateDust;
      if (result.finish === 'golden' && before.normal > 0) {
        after.normal--; after.golden++; action = 'upgraded-and-dusted';
      } else action = 'dusted';
    }
    const dustCredited = Math.min(config.dustBalanceCap - state.dust, dustEarned);
    return { ...result, action, before, after, dustEarned, dustCredited,
      dustDiscarded: dustEarned - dustCredited, dustSpent: 0 };
  }
  function gildOutcome(state, cardId) {
    const before = clone(copies(state.holdings, cardId));
    const q = gildQuote(state, cardId);
    return { cardId, rarity: poolById[cardId].rarity, finish: 'golden', action: 'gilded', before,
      after: { normal: before.normal - 1, golden: before.golden + 1 },
      dustEarned: 0, dustCredited: 0, dustDiscarded: 0, dustSpent: q.dustCost };
  }
  function checkCommand(command) {
    canonical(command);
    const extras = { BEGIN: ['request'], DECIDE: ['decision','allowDustOverflow','suppressFutureOverflowWarnings'],
      SELECT: ['tickets'], SET_PREFERENCE: ['suppressOverflowWarning'], RECORD_DEBIT: ['walletReceipt'], RECORD_DEBIT_FAILURE: ['failureId','reason'], COMMIT: [] };
    if (typeof command?.type !== 'string' || !Object.hasOwn(extras, command.type)) throw new Error('UNKNOWN_COMMAND');
    exact(command, ['type','eventId','txId','expectedRevision', ...extras[command.type]], 'COMMAND');
    identifier(command.eventId, 'EVENT_ID'); identifier(command.txId, 'TX_ID');
    integer(command.expectedRevision, 0, MAX, 'EXPECTED_REVISION');
    if (command.type === 'BEGIN') checkRequest(command.request);
    if (command.type === 'SET_PREFERENCE' && command.suppressOverflowWarning !== false) throw new Error('SUPPRESSION_REQUIRES_DRAW_CONTINUE');
    if (command.type === 'DECIDE' && (!['continue','cancel'].includes(command.decision) ||
      typeof command.allowDustOverflow !== 'boolean' || typeof command.suppressFutureOverflowWarnings !== 'boolean')) throw new Error('INVALID_DECISION');
    if (command.type === 'SELECT') selectedCard(command.tickets);
    if (command.type === 'RECORD_DEBIT_FAILURE') {
      identifier(command.failureId, 'FAILURE_ID');
      if (!['insufficient-funds','unavailable','unknown'].includes(command.reason)) throw new Error('INVALID_FAILURE_REASON');
    }
  }
  function intentFor(tx) {
    return freeze({ schemaVersion: 1, txId: tx.txId, configVersion: config.configVersion,
      poolVersion: config.poolVersion, configCanonical,
      idempotencyKey: 'card-collection-v1:' + tx.txId, currency: 'game-gold', amount: config.drawPriceGold,
      resultCanonical: canonical({ tickets: tx.tickets, outcome: tx.outcome }) });
  }
  function checkWalletReceipt(receipt, tx) {
    exact(receipt, ['schemaVersion','debitId','intent','walletRevision'], 'WALLET_RECEIPT');
    if (receipt.schemaVersion !== 1) throw new Error('UNSUPPORTED_WALLET_RECEIPT_SCHEMA');
    identifier(receipt.debitId, 'DEBIT_ID');
    integer(receipt.walletRevision, 0, MAX, 'WALLET_REVISION');
    if (!same(receipt.intent, intentFor(tx))) throw new Error('WALLET_RECEIPT_MISMATCH');
  }
  function apply(state, command) {
    checkCommand(command);
    const existingEvent = state.events.find(e => e.eventId === command.eventId);
    if (existingEvent) {
      if (commandIdentity(existingEvent) !== commandIdentity(command)) throw new Error('EVENT_ID_CONFLICT');
      return state;
    }
    // A fresh event ID for an already applied semantic operation is durably reserved.
    // This acknowledgment changes the journal revision, never the economic result.
    const acceptAlias = () => {
      if (command.expectedRevision !== state.revision) throw new Error('REVISION_CONFLICT');
      const acknowledged = clone(state);
      acknowledged.revision = add(state.revision, 1);
      acknowledged.events.push(clone(command));
      return trusted(acknowledged);
    };
    if (command.type === 'SET_PREFERENCE') {
      const prior = state.events.find(e => e.txId === command.txId);
      if (prior) {
        if (prior.type !== 'SET_PREFERENCE' || commandIdentity(prior) !== commandIdentity(command)) throw new Error('TX_ID_CONFLICT');
        return acceptAlias();
      }
      if (command.expectedRevision !== state.revision) throw new Error('REVISION_CONFLICT');
      if (state.activeTxId !== null) throw new Error('ACTIVE_TRANSACTION_PENDING');
      const changed = clone(state);
      changed.preferences.suppressOverflowWarning = false;
      changed.revision = add(state.revision, 1);
      changed.events.push(clone(command));
      return trusted(changed);
    }
    if (command.type === 'BEGIN' && state.events.some(e => e.txId === command.txId && e.type === 'SET_PREFERENCE')) throw new Error('TX_ID_CONFLICT');
    const previous = Object.hasOwn(state.transactions, command.txId) ? state.transactions[command.txId] : undefined;
    // Transaction-key retries remain idempotent even if a caller lost its event ID.
    if (command.type === 'BEGIN' && previous) {
      if (!same(previous.request, command.request)) throw new Error('TX_ID_CONFLICT');
      return acceptAlias();
    }
    if (command.type !== 'BEGIN' && !previous) throw new Error('UNKNOWN_TX');
    if (command.type === 'SELECT' && previous.tickets !== null) {
      if (!same(previous.tickets, command.tickets)) throw new Error('TX_RESULT_CONFLICT_NO_REROLL');
      return acceptAlias();
    }
    if (command.type === 'DECIDE' && previous.decision !== null) {
      const d = { decision: command.decision, allowDustOverflow: command.allowDustOverflow,
        suppressFutureOverflowWarnings: command.suppressFutureOverflowWarnings };
      if (!same(previous.decision, d)) throw new Error('TX_DECISION_CONFLICT');
      return acceptAlias();
    }
    if (command.type === 'RECORD_DEBIT' && previous.walletReceipt !== null) {
      if (!same(previous.walletReceipt, command.walletReceipt)) throw new Error('TX_DEBIT_CONFLICT');
      return acceptAlias();
    }
    if (command.type === 'RECORD_DEBIT_FAILURE' && previous.debitFailures.some(f => f.failureId === command.failureId)) {
      if (previous.debitFailures.find(f => f.failureId === command.failureId).reason !== command.reason) throw new Error('FAILURE_ID_CONFLICT');
      return acceptAlias();
    }
    if (command.type === 'COMMIT' && previous.stage === 'committed') return acceptAlias();
    if (command.expectedRevision !== state.revision) throw new Error('REVISION_CONFLICT');
    const next = clone(state);
    let tx = next.transactions[command.txId];
    if (command.type === 'BEGIN') {
      if (state.activeTxId !== null) throw new Error('ACTIVE_TRANSACTION_PENDING');
      tx = { txId: command.txId, configVersion: config.configVersion, request: clone(command.request),
        baseCollectionRevision: state.collectionRevision, quote: clone(quote(state, command.request)),
        stage: 'awaiting-decision', decision: null, overflowConsented: false, tickets: null,
        outcome: null, walletReceipt: null, debitFailures: [], receipt: null };
      next.transactions[command.txId] = tx; next.activeTxId = command.txId;
    } else {
      if (next.activeTxId !== command.txId || tx.baseCollectionRevision !== state.collectionRevision) throw new Error('TX_LOCK_OR_COLLECTION_CONFLICT');
      if (command.type === 'DECIDE') {
        if (tx.stage !== 'awaiting-decision') throw new Error('INVALID_TX_STAGE');
        tx.decision = { decision: command.decision, allowDustOverflow: command.allowDustOverflow,
          suppressFutureOverflowWarnings: command.suppressFutureOverflowWarnings };
        if (command.decision === 'cancel') { tx.stage = 'cancelled'; next.activeTxId = null; }
        else {
          if (tx.quote.requiresOverflowConfirmation && !command.allowDustOverflow) throw new Error('OVERFLOW_CONFIRMATION_REQUIRED');
          if (command.suppressFutureOverflowWarnings && !tx.quote.requiresOverflowConfirmation) throw new Error('NO_OVERFLOW_PROMPT_TO_SUPPRESS');
          tx.overflowConsented = state.preferences.suppressOverflowWarning || command.allowDustOverflow;
          if (command.suppressFutureOverflowWarnings) next.preferences.suppressOverflowWarning = true;
          tx.stage = 'confirmed';
          if (tx.request.kind === 'gild') { tx.outcome = gildOutcome(state, tx.request.cardId); tx.stage = 'selected'; }
        }
      } else if (command.type === 'SELECT') {
        if (tx.request.kind !== 'draw' || tx.stage !== 'confirmed') throw new Error('CONFIRM_BEFORE_RANDOM_SELECTION');
        tx.tickets = clone(command.tickets); tx.outcome = drawOutcome(state, tx.tickets);
        if (tx.outcome.dustDiscarded > 0 && !tx.overflowConsented) throw new Error('UNCONSENTED_DUST_OVERFLOW');
        tx.stage = 'selected';
      } else if (command.type === 'RECORD_DEBIT') {
        if (tx.request.kind !== 'draw' || tx.stage !== 'selected') throw new Error('SELECT_BEFORE_DEBIT');
        checkWalletReceipt(command.walletReceipt, tx);
        if (Object.values(state.transactions).some(t => t.walletReceipt?.debitId === command.walletReceipt.debitId)) throw new Error('DEBIT_ID_REUSE');
        tx.walletReceipt = clone(command.walletReceipt); tx.stage = 'debited';
      } else if (command.type === 'RECORD_DEBIT_FAILURE') {
        if (tx.request.kind !== 'draw' || tx.stage !== 'selected') throw new Error('INVALID_TX_STAGE');
        tx.debitFailures.push({ failureId: command.failureId, reason: command.reason });
        // The original outcome remains locked. Unknown status is never treated as unpaid.
      } else if (command.type === 'COMMIT') {
        if (tx.request.kind === 'draw' ? tx.stage !== 'debited' : tx.stage !== 'selected') throw new Error('PAYMENT_NOT_CONFIRMED');
        const o = tx.outcome;
        if (!same(copies(state.holdings, o.cardId), o.before)) throw new Error('COLLECTION_CONFLICT');
        next.holdings[o.cardId] = clone(o.after);
        next.dust = add(next.dust - o.dustSpent, o.dustCredited);
        integer(next.dust, 0, config.dustBalanceCap, 'DUST_BALANCE');
        next.collectionRevision = add(next.collectionRevision, 1);
        tx.receipt = { schemaVersion: 1, txId: tx.txId, kind: tx.request.kind,
          configVersion: config.configVersion, collectionRevision: next.collectionRevision,
          goldSpent: tx.request.kind === 'draw' ? config.drawPriceGold : 0,
          walletDebitId: tx.walletReceipt?.debitId ?? null, outcome: clone(o) };
        tx.stage = 'committed'; next.activeTxId = null;
      }
    }
    next.revision = add(next.revision, 1);
    next.events.push(clone(command));
    return trusted(next);
  }
  function reduce(input, command) { return apply(restore(input), command); }
  /** Host must durably save SELECT first, then use the idempotent shared-wallet adapter. */
  function walletIntent(input, txId) {
    const state = restore(input); identifier(txId, 'TX_ID');
    const tx = Object.hasOwn(state.transactions, txId) ? state.transactions[txId] : undefined;
    if (!tx || tx.request.kind !== 'draw' || !['selected','debited','committed'].includes(tx.stage)) throw new Error('NO_CONFIRMED_SELECTED_DRAW');
    return intentFor(tx);
  }
  function recovery(input) {
    const state = restore(input);
    if (state.activeTxId === null) return freeze({ action: 'idle', txId: null });
    const tx = state.transactions[state.activeTxId];
    const action = { 'awaiting-decision': 'restore-confirmation', confirmed: 'resolve-durable-entropy-once',
      selected: tx.request.kind === 'draw' ? 'reconcile-wallet-by-tx-id' : 'commit-collection', debited: 'commit-collection' }[tx.stage];
    return freeze({ action, txId: tx.txId });
  }
  /** Original names and cosmetic reveal hints. No source names, source mappings or gameplay stats. */
  function publicResult(input, txId) {
    identifier(txId, 'TX_ID');
    const state = restore(input); const tx = Object.hasOwn(state.transactions, txId) ? state.transactions[txId] : undefined;
    if (!tx || tx.stage !== 'committed') throw new Error('NO_COMMITTED_REVEAL');
    const { cardId, rarity, finish, action, dustEarned, dustCredited, dustDiscarded, dustSpent } = tx.outcome;
    const card = playable(cardId);
    return freeze({ name: card.name, classId: card.classId, rarity, finish, action,
      dustEarned, dustCredited, dustDiscarded, dustSpent,
      reveal: finish === 'golden' && rarity === 'legendary' ? 'golden-legendary-spotlight' : rarity === 'legendary' ? 'legendary-spotlight' : 'standard',
      reducedMotion: 'static-emphasis' });
  }
  /** Eligibility and ownership are independent checks; cosmetics do not change deck counts. */
  function inspectDeck(input, entries, classId, requiredSize) {
    const state = restore(input);
    if (!CLASSES.includes(classId)) throw new Error('INVALID_CLASS');
    integer(requiredSize, 1, 100, 'DECK_SIZE');
    canonical(entries);
    if (!Array.isArray(entries)) throw new Error('INVALID_DECK');
    const counts = {}, problems = [];
    if (entries.length !== requiredSize) problems.push({ kind: 'size', expected: requiredSize, actual: entries.length });
    for (const cardId of entries) {
      playable(cardId); counts[cardId] = (counts[cardId] ?? 0) + 1;
      if (!isDeckEligible(cardId, classId)) problems.push({ kind: 'class', cardId });
    }
    for (const [cardId, count] of Object.entries(counts)) {
      if (!Object.hasOwn(poolById, cardId)) problems.push({ kind: 'pool', cardId });
      else if (count > cardPolicy(cardId).deckCap) problems.push({ kind: 'copy-limit', cardId });
      const owned = copies(state.holdings, cardId);
      if (count > owned.normal + owned.golden) problems.push({ kind: 'ownership', cardId });
    }
    return freeze({ valid: problems.length === 0, problems });
  }
  /** Read-only display odds derived from this exact validated immutable configuration.
   * Decimals are presentation approximations; integer ticket thresholds remain authoritative. */
  function probabilities() {
    const legendaryTotal = rarityById.legendary.weight / config.probabilityScale;
    const goldGivenLegendary = config.goldenLegendaryWeight / config.probabilityScale;
    const goldLegendaryOverall = legendaryTotal * goldGivenLegendary;
    return freeze({ configVersion: config.configVersion, poolVersion: config.poolVersion,
      legendaryTotal, goldGivenLegendary, goldLegendaryOverall,
      normalLegendaryOverall: legendaryTotal - goldLegendaryOverall,
      rarities: config.rarities.map(r => ({ rarity: r.id, weight: r.weight, scale: config.probabilityScale,
        probability: r.weight / config.probabilityScale, cardCount: poolByRarity[r.id].length })) });
  }
  return freeze({ mode, config, createState, restore, quote, reduce, walletIntent, recovery, publicResult, inspectDeck, probabilities, cardPolicy });
}

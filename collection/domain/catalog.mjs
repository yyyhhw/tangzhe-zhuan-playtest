import data from './playable-cards.mjs?v=formal-cards-candidate-7';
import { freeze } from './json.mjs?v=formal-cards-candidate-7';
/** Original presentation names only. Stable IDs remain internal identity, not UI labels. */
export const CATALOG_VERSION = data.catalogVersion;
export const PLAYABLE_CARDS = freeze(data.cards);
export const CLASSES = freeze(['warrior', 'mage', 'paladin', 'warlock']);
export const CARD_BY_ID = freeze(Object.fromEntries(PLAYABLE_CARDS.map(card => [card.cardId, card])));
export function playable(cardId) {
  if (typeof cardId !== 'string' || !Object.hasOwn(CARD_BY_ID, cardId)) throw new Error('UNKNOWN_OR_NONPLAYABLE_CARD');
  return CARD_BY_ID[cardId];
}
export function isDeckEligible(cardId, classId) {
  if (!CLASSES.includes(classId)) throw new Error('INVALID_CLASS');
  const card = playable(cardId);
  return card.classId === 'neutral' || card.classId === classId;
}
/** Separates public/neutral and each class, independently of what the player owns. */
export function catalogGroups() {
  return freeze(Object.fromEntries(['neutral', ...CLASSES].map(id => [id, PLAYABLE_CARDS.filter(card => card.classId === id)])));
}

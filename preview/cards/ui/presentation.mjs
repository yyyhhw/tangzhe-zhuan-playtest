/** Presentation only. Never changes a card definition, runtime admission, or snapshot. */
export const PRESENTATION_VERSION = 'bookspine-art-ui-4';
export const ART_BY_SOURCE_ID = Object.freeze({
  VAN_CS2_106: Object.freeze({
    src: './assets/original/VAN_CS2_106_redwood_charcoal_tongs_v1.png',
    width: 1122, height: 1402, name: '红柄炭火夹',
  }),
  VAN_CS2_065: Object.freeze({
    src: './assets/original/VAN_CS2_065_ink_contract_doorkeeper_v1.png',
    width: 1122, height: 1402, name: '墨契门卫',
  }),
  VAN_NEW1_011: Object.freeze({
    src: './assets/original/VAN_NEW1_011_street_corner_courier_v1.png',
    width: 1122, height: 1402, name: '街口快送员',
  }),
  VAN_CS2_062: Object.freeze({
    src: './assets/original/VAN_CS2_062_whole_bookstore_ink_burst_v1.png',
    width: 1122, height: 1402, name: '整店熏墨',
  }),
});
// Deliberately no entry for freeze or divine-shield artwork: those cards are unsupported.
export function artForSource(sourceId) {
  return Object.hasOwn(ART_BY_SOURCE_ID, sourceId) ? ART_BY_SOURCE_ID[sourceId] : null;
}
export function presentationClass(metadata) {
  return ['warrior', 'mage', 'paladin', 'warlock'].includes(metadata?.class) ? metadata.class : 'neutral';
}

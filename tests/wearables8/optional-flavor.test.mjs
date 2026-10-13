import test from 'node:test';
import assert from 'node:assert/strict';
import display from '../../qa-protocol2/wearables8-display.mjs';
import {EIGHT_WEARABLES} from '../../qa-protocol2/eight-catalog.mjs';

// Only isolated records: no real economy registration or persisted user state.
function fixture(item) {
  return [{ITEM_BY_ID: {[item.id]: Object.freeze(item)}},
    Object.freeze({gacha: Object.freeze({owned: Object.freeze([item.id])})})];
}
test('approved first-eight flavor output is byte-for-byte unchanged', () => {
  for (const item of EIGHT_WEARABLES) {
    const [economy, state] = fixture({...item});
    assert.equal(display.revealFlavorHTML(economy, state, item.id), item.flavor + '<br>');
  }
});
test('absent, blank or invalid flavor omits the entire optional segment', () => {
  const original = EIGHT_WEARABLES[0];
  const {flavor: ignored, ...withoutFlavor} = original;
  for (const item of [withoutFlavor, ...[undefined, null, '', ' \n ', 0, {}].map(flavor => ({...original, flavor}))]) {
    const [economy, state] = fixture(item);
    assert.equal(display.revealFlavorHTML(economy, state, item.id), '');
  }
});
test('flavor keeps escaping and ownership/type gates', () => {
  const item = {...EIGHT_WEARABLES[0], flavor: '<b>&"\''};
  const [economy, state] = fixture(item);
  assert.equal(display.revealFlavorHTML(economy, state, item.id), '&lt;b&gt;&amp;&quot;&#39;<br>');
  assert.equal(display.revealFlavorHTML(economy, {gacha: {owned: []}}, item.id), '');
  assert.equal(display.revealFlavorHTML({ITEM_BY_ID: {[item.id]: {...item, type: 'hat'}}}, state, item.id), '');
  assert.equal(display.revealFlavorHTML(economy, state, 'unknown'), '');
});

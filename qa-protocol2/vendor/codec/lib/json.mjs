/** Strict, acyclic JSON only. In particular never invoke user supplied getters/toJSON. */
export function canonical(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (!value || typeof value !== 'object' || seen.has(value)) throw new Error('INVALID_JSON');
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype) || Object.getOwnPropertySymbols(value).length) throw new Error('INVALID_JSON');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, d] of Object.entries(descriptors)) {
    if (!(array && key === 'length') && (!d.enumerable || !Object.hasOwn(d, 'value'))) throw new Error('INVALID_JSON');
  }
  seen.add(value);
  let result;
  if (array) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, i) => key !== String(i))) throw new Error('INVALID_JSON');
    result = '[' + value.map(v => canonical(v, seen)).join(',') + ']';
  } else result = '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(descriptors[k].value, seen)).join(',') + '}';
  seen.delete(value);
  return result;
}
export const clone = value => JSON.parse(canonical(value));
export function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
export function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error('INVALID_' + label);
}
export function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('INVALID_' + label);
  return value;
}
export function identifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value) || ['constructor', 'prototype', '__proto__'].includes(value)) throw new Error('INVALID_' + label);
  return value;
}
export function add(a, b) { return integer(a + b, 0, Number.MAX_SAFE_INTEGER, 'INTEGER_OVERFLOW'); }

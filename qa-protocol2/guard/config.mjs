/** Exact QA-only names derived from pinned application sources. No storage access. */
const frozen = value => Object.freeze(value);
const fail = code => { throw new Error(code); };
const configs = new Map();
const hostKeys = {
  formal: [
    'tangzhe-formal-collection-v1-save', 'tangzhe-formal-collection-v1-save-bak',
    'tangzhe-formal-collection-v1-tab-lock', 'tangzhe-save', 'tangzhe-save-bak',
    'tangzhe-formal-collection-v1-original', 'tangzhe-upgrade-v15-original',
    'tangzhe-formal-collectibles-v2-original',
  ],
  preview: [
    'tangzhe-preview-collection-v1-save', 'tangzhe-preview-collection-v1-save-bak',
    'tangzhe-preview-collection-v1-tab-lock', 'tangzhe-preview-save',
    'tangzhe-preview-save-bak', 'tangzhe-preview-collectibles-v2-original',
  ],
};
for (const scope of ['formal', 'preview']) {
  // The current preview prefix is intentionally not renamed.
  const prefix = scope === 'formal' ? 'qa-formal-collection-v1:' : 'qa-collection-trial-v1:';
  const match = `tangzhe-${scope}-card-save`;
  const deckKey = `tangzhe-${scope}-card-decks-v1`;
  for (const realm of ['host', 'cards']) {
    const logicalKeys = frozen(realm === 'host' ? hostKeys[scope].slice()
      : [match, match + '-tmp', match + '-bak', match + '-quarantine', deckKey]);
    configs.set(`${scope}:${realm}`, frozen({scope, realm, prefix, logicalKeys,
      physicalKeys: frozen(logicalKeys.map(key => prefix + key)),
      lockNames: frozen(realm === 'host' ? [`qa:tangzhe:${scope}:collection-v1:writer`]
        : [prefix + match + ':write', prefix + deckKey + ':write']),
      ...(realm === 'cards' ? {deckKey} : {}),
    }));
  }
}
export function getRealPageQAConfig(scope, realm = 'host') {
  if (!['formal', 'preview'].includes(scope) || !['host', 'cards'].includes(realm)) {
    fail('QA_SCOPE_INVALID');
  }
  return configs.get(`${scope}:${realm}`);
}

/** collectionQA=1 is opt-in. Explicit localhost spelling only, no URL aliases.
 * Host routing intentionally excludes preview/pet/game in this first candidate.
 * Version/UI query parameters may coexist but cannot alias or duplicate QA.
 */
export function validateRealPageQAGate(location, {scope, realm = 'host'} = {}) {
  const denied = reason => frozen({ok: false, reason});
  let url, href;
  try {
    getRealPageQAConfig(scope, realm);
    href = typeof location === 'string' ? location : location?.href;
    if (typeof href !== 'string' || href.trim() !== href) return denied('QA_URL_INVALID');
    url = new URL(href);
  } catch { return denied('QA_URL_INVALID'); }
  if (!/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::[1-9][0-9]{0,4})?(?=\/|\?|#|$)/.test(href) ||
      url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username || url.password) return denied('QA_LOCAL_ORIGIN_REQUIRED');
  if (href.includes('#')) return denied('QA_FRAGMENT_FORBIDDEN');
  const prefix = scope === 'preview' ? '/preview' : '';
  const paths = realm === 'cards' ? [`${prefix}/cards/ui/`, `${prefix}/cards/ui/index.html`]
    : scope === 'formal' ? ['/', '/index.html', '/pet/game/', '/pet/game/index.html']
      : ['/preview/', '/preview/index.html'];
  if (!paths.includes(url.pathname)) return denied('QA_PATH_SCOPE_MISMATCH');
  const parameters = url.search.slice(1).split('&');
  if (url.searchParams.getAll('collectionQA').length !== 1 ||
      url.searchParams.get('collectionQA') !== '1' ||
      parameters.filter(part => part === 'collectionQA=1').length !== 1 ||
      parameters.some(part => part.split('=')[0] !== 'collectionQA' &&
        (() => { try { return decodeURIComponent(part.split('=')[0]) === 'collectionQA'; }
          catch { return true; } })())) return denied('QA_EXPLICIT_QUERY_REQUIRED');
  return frozen({ok: true, scope, realm, origin: url.origin, pathname: url.pathname});
}

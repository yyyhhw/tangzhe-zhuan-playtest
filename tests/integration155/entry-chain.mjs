import assert from 'node:assert/strict';
export const TOKEN='copy04-20261018-r1';
export function assertEntryChain(read){
  for(const prefix of ['','pet/game/','preview/','preview/pet/game/']){
    const version=(prefix.startsWith('preview/')?'preview-':'formal-')+TOKEN;
    assert.equal(JSON.parse(read(prefix+'version.json')).v,version);
    assert(read(prefix+'index.html').includes("var B='"+version+"'"));
    if(!prefix.startsWith('preview/')){
      for(const asset of ['style.css','economy.js'])assert(read(prefix+'index.html').includes(asset+'?v='+TOKEN));
      const app=read(prefix+'app.js');
      assert(app.includes("url.searchParams.get('v')!=='"+version+"'"));
      assert(app.includes("url.searchParams.set('v','"+version+"')"));
    }
    assert(read(prefix+'index.html').includes((prefix==='preview/pet/game/'?'app.js':'collection/bootstrap.mjs')+'?v='+TOKEN));
  }
  for(const file of ['collection/bootstrap.mjs','preview/collection/bootstrap.mjs']){
    for(const resource of ['host-save.mjs','collectibles/entry.mjs','qa-protocol2/entry.mjs'])assert(read(file).includes(resource+'?v='+TOKEN),file+' '+resource);
  }
  assert(read('collectibles/entry.mjs').includes('space/overlay.mjs?v='+TOKEN));
  assert(read('collectibles/entry.mjs').includes("'./legacy-entry.mjs?v="+TOKEN+"'"));
  assert(read('collectibles/entry.mjs').includes("+'?v='+ '"+TOKEN+"',sourceBase)"));
  assert(read('qa-protocol2/entry.mjs').includes('app.js?qaProtocol2=1&v='+TOKEN));
  // Unchanged economy/domain keep their separately pinned legacy URLs.
  assert(read('collectibles/release.mjs').includes("COLLECTIBLES_RELEASE = 'xingtu135-20261015-r1'"));
  for(const file of ['qa-protocol2/vendor/cards/card-coordinator.mjs','collection/host-save.mjs','preview/collection/host-save.mjs'])assert(read(file).includes('space/domain.mjs?v=xingtu135-20261015-r1'));
}

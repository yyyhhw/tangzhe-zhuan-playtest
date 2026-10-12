/** Exact existing production namespaces. Inject Storage only from the reviewed entry.
 * Pure synthetic tests use in-memory Storage; this module never seeds or clears. */
const layouts=Object.freeze({
 formal:Object.freeze({main:'tangzhe-formal-collection-v1-save',backup:'tangzhe-formal-collection-v1-save-bak',tab:'tangzhe-formal-collection-v1-tab-lock',source:'tangzhe-save',sourceBackup:'tangzhe-save-bak',original:'tangzhe-formal-collection-v1-original',v15:'tangzhe-upgrade-v15-original',snapshot:'tangzhe-formal-collectibles-v2-original'}),
 preview:Object.freeze({main:'tangzhe-preview-collection-v1-save',backup:'tangzhe-preview-collection-v1-save-bak',tab:'tangzhe-preview-collection-v1-tab-lock',source:'tangzhe-preview-save',sourceBackup:'tangzhe-preview-save-bak',snapshot:'tangzhe-preview-collectibles-v2-original'})
});
export function createCollectibleStorage({scope,keys,nativeStorage}){
 const layout=Object.hasOwn(layouts,scope)?layouts[scope]:null;if(!layout||typeof nativeStorage?.getItem!=='function'||typeof nativeStorage?.setItem!=='function')throw Error('COLLECTIBLE_STORAGE_DEPENDENCIES_REQUIRED');
 const roles=Object.keys(layout).filter(k=>k!=='snapshot');if(!keys||Object.keys(keys).sort().join('|')!==roles.sort().join('|'))throw Error('COLLECTIBLE_STORAGE_KEY_MISMATCH');
 for(const [role,key]of Object.entries(keys))if(layout[role]!==key)throw Error('COLLECTIBLE_STORAGE_KEY_MISMATCH');
 const allowed=new Set(Object.values(layout)),ordinary=new Set([layout.main,layout.backup,layout.tab]),immutable=new Set([layout.original,layout.snapshot].filter(Boolean));
 const check=key=>{if(typeof key!=='string'||!allowed.has(key))throw Error('COLLECTIBLE_STORAGE_SCOPE');return key;};
 return Object.freeze({
  getItem:key=>nativeStorage.getItem(check(key)),
  setItem(key,value){check(key);if(typeof value!=='string')throw Error('COLLECTIBLE_STORAGE_VALUE');
   if(immutable.has(key)){const prior=nativeStorage.getItem(key);if(prior!==null&&prior!==value)throw Error('COLLECTIBLE_ORIGINAL_IMMUTABLE');if(prior===value)return;}
   else if(!ordinary.has(key))throw Error('COLLECTIBLE_SOURCE_IMMUTABLE');
   nativeStorage.setItem(key,value);
  },
  logicalKey:key=>typeof key==='string'&&allowed.has(key)?key:null,
  dump:()=>Object.fromEntries([...allowed].map(key=>[key,nativeStorage.getItem(key)]))
 });
}

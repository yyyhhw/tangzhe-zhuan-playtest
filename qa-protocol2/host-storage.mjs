/** Logical host keys mapped only to the fixed, current synthetic QA namespace. */
import {getRealPageQAConfig} from './guard/config.mjs?v=albumfix-20261014-r1';
export function createRealPageQAStorage({scope,nativeStorage}) {
  const config=getRealPageQAConfig(scope,'host'),allowed=new Set(config.logicalKeys);
  const writable=new Set(config.logicalKeys.filter(k=>k.endsWith('-collection-v1-save')||k.endsWith('-collection-v1-save-bak')||k.endsWith('-collection-v1-tab-lock')||k.endsWith('-collectibles-v2-original')));
  const audit=[];let fault=null,count=0;
  function selected(phase,key){if(fault?.phase!==phase||fault.key!==key)return false;if(++count!==fault.nth)return false;fault=null;return true;}
  function check(key){if(typeof key!=='string'||!allowed.has(key))throw Error('QA_LOGICAL_KEY_DENIED');return config.prefix+key;}
  function getItem(key){const physical=check(key);audit.push({operation:'getItem',key,physical});if(selected('read',key))throw Error('QA_INJECTED_READ_FAILED');const raw=nativeStorage.getItem(physical);return selected('readMismatch',key)?'QA_INJECTED_MISMATCH':raw;}
  function setItem(key,value){const physical=check(key);if(!writable.has(key)||typeof value!=='string')throw Error('QA_EVIDENCE_WRITE_DENIED');audit.push({operation:'setItem',key,physical});if(selected('beforeWrite',key))throw Error('QA_INJECTED_WRITE_FAILED');nativeStorage.setItem(physical,value);if(selected('afterWrite',key))throw Error('QA_INJECTED_AFTER_WRITE');}
  return Object.freeze({getItem,setItem,prefix:config.prefix,
    logicalKey:physical=>typeof physical==='string'&&physical.startsWith(config.prefix)&&allowed.has(physical.slice(config.prefix.length))?physical.slice(config.prefix.length):null,
    audit:()=>audit.map(x=>({...x})),dump:()=>Object.fromEntries(config.logicalKeys.map(k=>[k,getItem(k)])),
    setFault(value){if(!value||!['read','readMismatch','beforeWrite','afterWrite'].includes(value.phase)||!allowed.has(value.key)||!Number.isSafeInteger(value.nth)||value.nth<1)throw Error('QA_FAULT_INVALID');fault={...value};count=0;},clearFault(){fault=null;count=0;},
  });
}

/** Version-pinned catalogue admission; no dynamic definitions or partial fallback. */
import source from './catalog-data.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(freeze);}return o;};
// Reject non-JSON objects before reading values: no toJSON, getters, prototypes or cycles.
function canonical(value,seen=new Set()) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(!value||typeof value!=='object'||seen.has(value))throw new Error('Catalog requires finite, acyclic plain JSON data');
  const array=Array.isArray(value),expected=array?Array.prototype:Object.prototype;
  if(Object.getPrototypeOf(value)!==expected||Object.getOwnPropertySymbols(value).length)throw new Error('Catalog requires plain JSON prototypes/keys');
  const descriptors=Object.getOwnPropertyDescriptors(value);
  for(const [key,d] of Object.entries(descriptors))if(!(array&&key==='length')&&(!d.enumerable||!Object.hasOwn(d,'value')))throw new Error('Catalog does not accept accessors or hidden properties');
  seen.add(value);let result;
  if(array) {
    if(Object.keys(value).length!==value.length||Object.keys(value).some((key,i)=>key!==String(i)))throw new Error('Catalog arrays must be dense JSON arrays');
    result='['+value.map(v=>canonical(v,seen)).join(',')+']';
  } else result='{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(descriptors[k].value,seen)).join(',')+'}';
  seen.delete(value);return result;
}
export const CATALOG=freeze(source);
export const CATALOG_VERSION='bk-cards-static-v2';
// Admission is an explicit audit, never inferred from requiredMechanisms tags.
export const CARD_SCHEMA_VERSION='urn:bookstore:cardcore:card-definition:0.6.0';
export const BASE_SOURCE_IDS=freeze(['VAN_CS2_106','VAN_CS2_112','VAN_CS2_023','VAN_CS2_029','VAN_CS2_091','VAN_CS2_089','VAN_CS2_168','VAN_CS2_172','VAN_CS2_120','VAN_CS2_118','VAN_CS2_182','VAN_CS2_119','VAN_CS2_200','VAN_CS2_201','VAN_CS2_186']);
export const PURE_TAUNT_AUDIT=freeze({
  VAN_CS1_042:{cost:1,attack:1,health:2,class:'neutral',tribe:null},
  VAN_CS2_121:{cost:2,attack:2,health:2,class:'neutral',tribe:null},
  VAN_CS2_125:{cost:3,attack:3,health:3,class:'neutral',tribe:'beast'},
  VAN_CS2_179:{cost:4,attack:3,health:5,class:'neutral',tribe:null},
  VAN_CS2_162:{cost:6,attack:6,health:5,class:'neutral',tribe:null},
  VAN_CS2_127:{cost:3,attack:1,health:4,class:'neutral',tribe:'beast'},
  VAN_CS2_187:{cost:5,attack:5,health:4,class:'neutral',tribe:null},
  VAN_CS2_065:{cost:1,attack:1,health:3,class:'warlock',tribe:'demon'}
});
// These exact six literal effects were audited against the frozen raw 83-card source.
// Granting Charge and compound effects are deliberately NOT admitted by mechanism tags.
export const PURE_CHARGE_AUDIT=freeze({
  VAN_NEW1_011:{cost:4,attack:4,health:3,class:'warrior',tribe:null},
  VAN_CS2_171:{cost:1,attack:1,health:1,class:'neutral',tribe:'beast'},
  VAN_CS2_173:{cost:2,attack:2,health:1,class:'neutral',tribe:'murloc'},
  VAN_CS2_124:{cost:3,attack:3,health:1,class:'neutral',tribe:null},
  VAN_CS2_131:{cost:4,attack:2,health:5,class:'neutral',tribe:null},
  VAN_CS2_213:{cost:6,attack:5,health:2,class:'neutral',tribe:null}
});
// Five independently audited single-clause spells. No generic aoe-tag admission.
export const FIXED_AOE_AUDIT=freeze({
  VAN_EX1_400:{cost:1,class:'warrior',n:1,scope:'allMinions',text:'对所有随从造成1点伤害。'},
  VAN_CS2_025:{cost:2,class:'mage',n:1,scope:'enemyMinions',text:'对所有敌方随从造成1点伤害。'},
  VAN_CS2_032:{cost:7,class:'mage',n:4,scope:'enemyMinions',text:'对所有敌方随从造成4点伤害。'},
  VAN_CS2_093:{cost:4,class:'paladin',n:2,scope:'enemyCharacters',text:'对所有敌人造成2点伤害。'},
  VAN_CS2_062:{cost:4,class:'warlock',n:3,scope:'allCharacters',text:'对所有角色造成3点伤害。'}
});
// Four exact single-clause, neutral, tribeless +1 sources. No compound-tag admission.
export const PURE_SPELL_DAMAGE_AUDIT=freeze({
  VAN_CS2_142:{cost:2,attack:2,health:2,class:'neutral',tribe:null},
  VAN_EX1_582:{cost:3,attack:1,health:4,class:'neutral',tribe:null},
  VAN_CS2_197:{cost:4,attack:4,health:4,class:'neutral',tribe:null},
  VAN_CS2_155:{cost:6,attack:4,health:7,class:'neutral',tribe:null}
});
export const SUPPORTED_SOURCE_IDS=freeze([...BASE_SOURCE_IDS,...Object.keys(PURE_TAUNT_AUDIT),...Object.keys(PURE_CHARGE_AUDIT),...Object.keys(FIXED_AOE_AUDIT),...Object.keys(PURE_SPELL_DAMAGE_AUDIT)]);
const pinned=new Map(CATALOG.cards.map(c=>[c.sourceId,c]));
export const runtimeIdFor=entry=>'bk'+entry.sourceId.toLowerCase().split('_').map(p=>p[0].toUpperCase()+p.slice(1)).join('');
export function assertRuntimeEntry(entry) {
  canonical(entry);
  if(!entry||!SUPPORTED_SOURCE_IDS.includes(entry.sourceId))throw new Error('Unsupported runtime entry');
  if(canonical(entry)!==canonical(pinned.get(entry.sourceId)))throw new Error('Runtime entry does not match version-pinned source metadata/definition');
  return true;
}
function deriveDefinition(entry) {
  assertRuntimeEntry(entry);
  if(BASE_SOURCE_IDS.includes(entry.sourceId))return clone(entry.runtimeDefinition);
  if(Object.hasOwn(FIXED_AOE_AUDIT,entry.sourceId)) {
    const audit=FIXED_AOE_AUDIT[entry.sourceId];
    if(entry.type!=='spell'||entry.cost!==audit.cost||entry.class!==audit.class||entry.sourceEffectText!==audit.text||entry.attack!==null||entry.health!==null||entry.durability!==null||entry.tribe!==null||entry.runtimeDefinition!==null||entry.implementationStatus!=='unsupported'||entry.effects.length!==1||entry.effects[0].clause!==audit.text)throw new Error('Fixed area-damage audit mismatch');
    return {id:runtimeIdFor(entry),name:entry.name,type:'spell',cost:entry.cost,text:entry.sourceEffectText,art:'placeholder',effect:{kind:'areaDamage',n:audit.n,scope:audit.scope,target:'none'}};
  }
  if(Object.hasOwn(PURE_SPELL_DAMAGE_AUDIT,entry.sourceId)) {
    const audit=PURE_SPELL_DAMAGE_AUDIT[entry.sourceId];
    if(entry.type!=='minion'||entry.sourceEffectText!=='法术伤害+1'||entry.durability!==null||entry.runtimeDefinition!==null||entry.implementationStatus!=='unsupported'||entry.effects.length!==1||entry.effects[0].clause!=='法术伤害+1'||Object.entries(audit).some(([k,v])=>entry[k]!==v))throw new Error('Pure spell damage audit mismatch');
    return {id:runtimeIdFor(entry),name:entry.name,type:'minion',cost:entry.cost,attack:entry.attack,health:entry.health,text:entry.sourceEffectText,art:'placeholder',spellDamage:1};
  }
  const charge=Object.hasOwn(PURE_CHARGE_AUDIT,entry.sourceId);
  const audit=charge?PURE_CHARGE_AUDIT[entry.sourceId]:PURE_TAUNT_AUDIT[entry.sourceId];
  const keyword=charge?'charge':'taunt',text=charge?'冲锋':'嘲讽';
  if(entry.type!=='minion'||entry.sourceEffectText!==text||entry.durability!==null||entry.runtimeDefinition!==null||entry.implementationStatus!=='unsupported'||Object.entries(audit).some(([k,v])=>entry[k]!==v))throw new Error('Pure '+keyword+' audit mismatch');
  return {id:runtimeIdFor(entry),name:entry.name,type:'minion',cost:entry.cost,attack:entry.attack,health:entry.health,text:entry.sourceEffectText,art:'placeholder',keywords:[keyword]};
}
export function compileCatalog(catalog) {
  canonical(catalog);
  if(!catalog||catalog.catalogVersion!==CATALOG_VERSION||!Array.isArray(catalog.cards)||catalog.cards.length!==83)throw new Error('Unsupported catalog version or count');
  if(canonical({...catalog,cards:[]})!==canonical({...CATALOG,cards:[]}))throw new Error('Catalog source/schema metadata mismatch');
  const cards={},metadata={},classification={},seen=new Set();
  for(const entry of catalog.cards) {
    if(!entry||seen.has(entry.sourceId)||!pinned.has(entry.sourceId))throw new Error('Unknown or duplicate catalog source ID');
    seen.add(entry.sourceId);
    if(canonical(entry)!==canonical(pinned.get(entry.sourceId)))throw new Error('Catalog source metadata/definition must remain intact');
    if(SUPPORTED_SOURCE_IDS.includes(entry.sourceId)) {
      const definition=deriveDefinition(entry),id=definition.id;
      if(Object.hasOwn(cards,id))throw new Error('Duplicate runtime ID');
      cards[id]=definition;metadata[id]=clone(entry);
      const auditedKeyword=PURE_CHARGE_AUDIT[entry.sourceId]?'charge':PURE_TAUNT_AUDIT[entry.sourceId]?'taunt':null;
      classification[entry.sourceId]={sourceId:entry.sourceId,implementationStatus:'supported',runtimeDefinition:clone(definition),statusReason:PURE_SPELL_DAMAGE_AUDIT[entry.sourceId]?'Explicit four-card pure spell-damage +1 audit; project per-cast snapshot contract, no official historical-patch guarantee':FIXED_AOE_AUDIT[entry.sourceId]?'Explicit five-card fixed-area-damage audit; community-derived batching, project deterministic event order, no historical-patch guarantee':auditedKeyword?`Explicit ${auditedKeyword==='charge'?'six-card pure-Charge':'eight-card pure-Taunt'} audit; community-derived, unplayed, no historical-patch guarantee`:'Existing version-pinned simple-card definition',expected:PURE_SPELL_DAMAGE_AUDIT[entry.sourceId]?{spellDamage:1,attack:entry.attack,health:entry.health,cost:entry.cost}:FIXED_AOE_AUDIT[entry.sourceId]?clone(definition.effect):auditedKeyword?{keywords:[auditedKeyword],attack:entry.attack,health:entry.health,cost:entry.cost}:clone(entry.expected),schemaVersion:CARD_SCHEMA_VERSION};
    } else {
      if(entry.runtimeDefinition!==null||entry.expected!==null)throw new Error('Unsupported card supplied runtime behavior');
      classification[entry.sourceId]={sourceId:entry.sourceId,implementationStatus:'unsupported',runtimeDefinition:null,expected:null,statusReason:entry.statusReason,schemaVersion:CARD_SCHEMA_VERSION};
    }
  }
  if(Object.keys(cards).length!==38)throw new Error('Expected exactly 38 supported definitions');
  return freeze({cards,metadata,classification});
}
const compiled=compileCatalog(CATALOG);
export const RUNTIME_CARDS=compiled.cards;
// Every metadata value is the untouched raw source entry, including historical status.
export const CARD_METADATA=compiled.metadata;
export const RUNTIME_CLASSIFICATION=compiled.classification;

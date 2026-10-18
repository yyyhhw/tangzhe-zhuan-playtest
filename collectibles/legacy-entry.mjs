/** Pure injected legacy onboarding, called only after entry has classified raw main.
 * Existing P2 bypasses this helper. Any P2 snapshot bypasses it too: a prepared
 * P1 goes to the migration facade; an orphan snapshot remains read-only.
 * No storage selection, lock acquisition, protocol installation or app import.
 */
const fail=code=>({ok:false,code});
const expectedKeys={
  formal:{main:'tangzhe-formal-collection-v1-save',source:'tangzhe-save',sourceBackup:'tangzhe-save-bak',original:'tangzhe-formal-collection-v1-original',v15:'tangzhe-upgrade-v15-original'},
  preview:{main:'tangzhe-preview-collection-v1-save',source:'tangzhe-preview-save',sourceBackup:'tangzhe-preview-save-bak'}
};

export async function ensureLegacyReady({scope,legacy,keys,crypto,consent,alive,now,snapshotRaw=null}={}){
  if(!Object.hasOwn(expectedKeys,scope)||!legacy||!keys||typeof consent!=='function'||typeof alive!=='function'||typeof now!=='function'||
    !['inspect','initialize','adopt'].every(k=>typeof legacy[k]==='function'))return fail('LEGACY_ENTRY_DEPENDENCIES_REQUIRED');
  if(Object.entries(expectedKeys[scope]).some(([k,v])=>keys[k]!==v))return fail('LEGACY_ENTRY_SCOPE_MISMATCH');
  const live=()=>alive()===true;
  try{
    if(!live())return fail('SESSION_INVALIDATED');
    // Original legacy destinationArtifacts does not know this newer evidence key.
    if(snapshotRaw!==null)return fail('LEGACY_ENTRY_SNAPSHOT_PRESENT');
    const inspected=legacy.inspect();
    if(!live())return fail('SESSION_INVALIDATED');
    if(!inspected?.ok)return inspected??fail('LEGACY_INSPECT_FAILED');
    if(scope==='formal'&&inspected.sourceEvidence?.[keys.v15]!==null&&inspected.sourceEvidence?.[keys.v15]!==undefined){
      // Keep the original bootstrap's independent WebCrypto check. The legacy
      // coordinator also validates and rechecks all three raw evidence values.
      try{
        if(!crypto?.subtle||typeof crypto.subtle.digest!=='function')return fail('SECURE_CONTEXT_REQUIRED');
        const archive=JSON.parse(inspected.sourceEvidence[keys.v15]),payload=JSON.parse(archive.payload);
        if(!live())return fail('SESSION_INVALIDATED');
        const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(archive.payload));
        if(!live())return fail('SESSION_INVALIDATED');
        const digest=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
        if(payload.format!==1||payload.release!=='15'||!Object.hasOwn(payload,'main')||!Object.hasOwn(payload,'backup')||
          ![payload.main,payload.backup].every(v=>v===null||typeof v==='string')||digest!==archive.sha256)return fail('V15_SNAPSHOT_INVALID');
      }catch{return fail(live()?'V15_SNAPSHOT_INVALID':'SESSION_INVALIDATED');}
    }
    if(inspected.needsConfigConsent){
      // Preview never supported this migration. Do not invent it in composition.
      if(scope!=='formal'||typeof legacy.upgradeConfig!=='function')return fail('LEGACY_CONFIG_UPGRADE_UNSUPPORTED');
      const prompt=Object.freeze({kind:'legacy-config',title:'升级卡牌收藏规则',
        body:'保留当前经营余额、已有普通/金卡、星尘及全部历史回执；启用已确认的新抽卡与普通卡合成规则。取消不会写入。',
        accept:'同意升级',cancel:'暂不升级'});
      if(!live())return fail('SESSION_INVALIDATED');
      const approved=await consent(prompt);
      if(!live())return fail('SESSION_INVALIDATED');
      if(approved!==true)return fail('CONSENT_CANCELLED');
      const result=legacy.upgradeConfig(inspected.approvedRaw);
      return live()?result:fail('SESSION_INVALIDATED');
    }
    if(inspected.needsConsent){
      const s=inspected.sourceState,formal=scope==='formal';
      const balance=s?`${s.coins.toLocaleString('zh-CN')} 金币（零头 ${s.coinFrac} 保留）`:'正常新游戏初始余额 0 金币';
      const body=formal?
        `${s?'将复制旧正式经营进度：':'未找到旧正式存档，将建立正常新游戏：'}${balance}。只有点击继续才会写入新版正式存档；旧正式原档、备份与 v15 快照会保留，新版经营进度写入独立主档。旧页面之后的进度与新版分开，不能自动合并；以后切回旧版也不会自动带回新版进度。卡牌收藏从空白开始，不赠送卡或金币；采用已确认的抽卡与普通卡合成规则。`:
        `${s?'将保留并复制你原来的预览进度：':'没有找到原来的预览存档，将从新游戏开始：'}${balance}。点击「同意并继续」才会建立新版预览存档，取消不会写入。原预览存档和备份会保留，正式版进度不受影响。新版和旧版之后的进度分别保存，不会同步或自动合并；切回旧版也不会带回新版进度。卡牌收藏从空白开始，不赠送卡或金币。`;
      const prompt=Object.freeze({kind:'legacy-initialize',title:formal?'建立新版正式存档':'建立新版预览存档',body,accept:'同意并继续',cancel:'暂不进入'});
      if(!live())return fail('SESSION_INVALIDATED');
      const approved=await consent(prompt);
      if(!live())return fail('SESSION_INVALIDATED');
      if(approved!==true)return fail('CONSENT_CANCELLED');
      const timestamp=now();
      if(!live())return fail('SESSION_INVALIDATED');
      const parameters={approvedSourceRaw:inspected.sourceRaw,approvedEmpty:!s,now:timestamp};
      if(formal)parameters.approvedSourceEvidence=inspected.sourceEvidence;
      const result=legacy.initialize(parameters);
      return live()?result:fail('SESSION_INVALIDATED');
    }
    if(!live())return fail('SESSION_INVALIDATED');
    const result=legacy.adopt();
    return live()?result:fail('SESSION_INVALIDATED');
  }catch(error){return fail(error?.message||'LEGACY_ENTRY_FAILED_READ_ONLY');}
}

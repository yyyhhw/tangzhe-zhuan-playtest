"""Import authorized local prototype metadata; copy pixels unchanged, retain source manifests."""
import json,pathlib,shutil,hashlib,sys
src=pathlib.Path(sys.argv[1]);dest=pathlib.Path(__file__).resolve().parents[1]/'art'
index=json.loads((src/'pet_prototypes_manifest.json').read_text());shared=json.loads((src/'remaining_pets_source_rects_manifest_packaged_v1.json').read_text())
# Explicit semantic mappings to the supplied poses, never dog frame indices.
seq={
 'red_panda':{'idle_E':[0],'idle_N':[4],'idle_S':[6],'walk_E':[1,2,3],'walk_N':[4,5],'walk_S':[6,7],'attention':[8,9],'groom':[12,13],'play':[10,11],'rest':[14,15],'petted':[8,9]},
 'panda_cub':{'idle_E':[0],'idle_N':[4],'idle_S':[6],'walk_E':[1,2,3],'walk_N':[4,5],'walk_S':[6,7],'attention':[10,11],'groom':[8,9],'play':[12,13],'rest':[14,15],'petted':[10,11]},
 'robot':{'idle_E':[0],'idle_N':[4],'idle_S':[7],'walk_E':[1,2,3],'walk_N':[5,6],'walk_S':[8,9],'attention':[10,11],'groom':[10,11],'play':[12,13],'rest':[14,15],'petted':[12,13]},
 'alpaca':{'idle_E':[0],'idle_N':[4],'idle_S':[6],'walk_E':[1,2,3],'walk_N':[4,5],'walk_S':[6,7],'attention':[8,9],'groom':[12,13],'play':[10,11],'rest':[14,15],'petted':[8,9]},
 'rabbit':{'idle_E':[0],'idle_N':[3],'idle_S':[5],'walk_E':[1,2],'walk_N':[3,4],'walk_S':[5,6],'attention':[7],'groom':[11,12],'play':[8,9,10],'rest':[15],'petted':[11,12]}}
records=[]
for entry in index['species']:
 species='panda_cub' if entry['id']=='giant_panda_cub' else entry['id'];out=dest/species;out.mkdir(exist_ok=True)
 original=json.loads((src/entry['manifest']).read_text())
 if 'manifestSelector' in entry:original=next(a for a in shared['atlases'] if a['species']==entry['id'])
 image=src/entry['image'];shutil.copy2(image,out/image.name);(out/'source-manifest.json').write_text(json.dumps(original,ensure_ascii=False,indent=2)+'\n')
 m={'schema':'tangzhe-companion-art/1','species':species,'placeholder':False,'releaseReady':False,'prototype':True,'source':{'frameSize':[256,256],'origin':[128,208],'perFrameCrop':False,'shadow':'separate'},'runtime':{'cellSize':128,'origin':[64,104],'displayTiles':{'red_panda':1.65,'robot':1.65,'panda_cub':1.6,'alpaca':1.65,'rabbit':1.5}.get(species,1.15),'sourceScale':2 if species=='cat' else .5},'atlas':{'image':image.name,'size':original.get('atlasSize',[1254,1254]),'mode':'sourceRect'},'directions':{'drawn':['E','N','S'],'mirror':{'W':'E'}},'shadow':{'procedural':True},'clips':{},'sourceManifest':'source-manifest.json','sourceImageSHA256':hashlib.sha256(image.read_bytes()).hexdigest(),'limitations':entry.get('limitationsZh',[])}
 frames={}
 for f in original['frames']:
  if species=='cat':r=f['atlasRect'];anchor={'x':64,'y':104};direction=f['name'].split('_')[1].upper()
  else:
   rr=f['sourceRect'];r=[rr['x'],rr['y'],rr['width'],rr['height']];anchor=f['anchor'];direction={'east':'E','north':'N','south':'S','southeast':'S'}.get(f['direction'],f['direction'])
  frames[f['index']]={'sourceIndex':f['index'],'sourceRect':r,'anchor':[anchor['x'],anchor['y']],'dir':direction}
 if species=='cat':
  mappings={'idle_E':'idle_e','idle_N':'idle_n','idle_S':'idle_s','attention':'idle_e','groom':'groom_e','play':'pounce_e','rest':'sleep_e','petted':'pet_e'}
  mapping={k:original['animations'][v]['frames'] for k,v in mappings.items()};durations={k:original['animations'][v]['durationsMs'] for k,v in mappings.items()}
 else:mapping=seq[species];durations={}
 for name,ids in mapping.items():
  direction=name[-1] if name.startswith(('idle_','walk_')) else frames[ids[0]]['dir']
  m['clips'][name]={'dir':direction,'inPlace':not name.startswith(('idle_','walk_')),'loop':name.startswith(('idle_','walk_')) or name in ['groom','rest'],'frames':[{**frames[i],'ms':durations.get(name,[180 if name.startswith('walk_') else 700 if name=='rest' else 240]*len(ids))[j]} for j,i in enumerate(ids)]}
 # Conservative body widths in logical 256-pixel coordinates; derived from supplied rectangles/anchors.
 scale=m['runtime']['sourceScale'];m['body']={}
 for d in ['E','N','S']:
  selected=[f for f in frames.values() if f['dir']==d]
  lo=min([128-f['anchor'][0]*scale for f in selected]+[120]);hi=max([128+(f['sourceRect'][2]-f['anchor'][0])*scale for f in selected]+[136]);m['body'][d]=[max(0,lo),min(256,hi)]
  if species=='cat':
   raw=[f for f in original['frames'] if frames[f['index']]['dir']==d]
   m['body'][d]=[max(0,min(128+(f['rawBodyBBox'][0]-f['rawGroundAnchor'][0])*f['scale'] for f in raw)),min(256,max(128+(f['rawBodyBBox'][2]-f['rawGroundAnchor'][0])*f['scale'] for f in raw))]
 m['renderBounds']={'left':-max(max(f['anchor'][0]*scale,(f['sourceRect'][2]-f['anchor'][0])*scale) for f in frames.values()),'right':max(max(f['anchor'][0]*scale,(f['sourceRect'][2]-f['anchor'][0])*scale) for f in frames.values()),'top':min(-f['anchor'][1]*scale for f in frames.values()),'bottom':max((f['sourceRect'][3]-f['anchor'][1])*scale for f in frames.values())}
 m['poseCatalog']={}
 for name,c in m['clips'].items():
  for f in c['frames']:
   key=f.get('imageKey','primary')+':'+str(f['sourceIndex']);pose=m['poseCatalog'].setdefault(key,{'dir':c['dir'],'clips':[]})
   if name not in pose['clips']:pose['clips'].append(name)
 (out/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');records.append({'species':species})
 print(species,len(frames),'source poses copied unchanged',m['body'],m['renderBounds'])
(dest/'species.json').write_text(json.dumps(records,indent=2)+'\n')

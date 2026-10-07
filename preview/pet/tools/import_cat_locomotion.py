"""Adapt the authorized locomotion package without changing any source pixels."""
import pathlib,json,shutil,hashlib,sys
src=pathlib.Path(sys.argv[1]);dst=pathlib.Path(__file__).resolve().parents[1]/'art'/'cat'
source=json.loads((src/'cat-locomotion-manifest.json').read_text());m=json.loads((dst/'manifest.json').read_text())
m['atlases']={}
for key,a in source['images'].items():
 p=src/a['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'];shutil.copy2(p,dst/a['file'])
 scales={f['scaleTo256'] for c in source['animations'].values() for f in c['frames'] if f['image']==key}
 if key==source['groomPatch']['frame']['image']:scales.add(source['groomPatch']['frame']['scaleTo256'])
 assert len(scales)==1
 m['atlases'][key]={'image':a['file'],'size':a['size'],'sourceScale':scales.pop(),'sha256':a['sha256']}
def frame(f,ms):return {'sourceIndex':f['sourcePoseIndex'],'imageKey':f['image'],'sourceRect':f['sourceRect'],'anchor':f['anchor'],'ms':ms}
for name,c in source['animations'].items():
 key=name[:-1]+name[-1].upper();m['clips'][key]={'dir':key[-1],'inPlace':False,'loop':True,'frames':[frame(f,1000/c['fps']) for f in c['frames']]}
for f in m['clips']['groom']['frames']:
 if f['sourceIndex']==source['groomPatch']['replacesPrototypePoseIndex']:f.update(frame(source['groomPatch']['frame'],f['ms']))
frames=[(f,m['atlases'][f['imageKey']]['sourceScale'] if f.get('imageKey') else m['runtime']['sourceScale']) for c in m['clips'].values() for f in c['frames']]
radius=max(max(f['anchor'][0]*s,(f['sourceRect'][2]-f['anchor'][0])*s) for f,s in frames)
m['renderBounds']={'left':-radius,'right':radius,'top':min(-f['anchor'][1]*s for f,s in frames),'bottom':max((f['sourceRect'][3]-f['anchor'][1])*s for f,s in frames)}
for d in ['E','N','S']:
 values=[(f,m['atlases'][f['imageKey']]['sourceScale']) for c in m['clips'].values() if c['dir']==d for f in c['frames'] if f.get('imageKey')]
 m['body'][d]=[max(0,min([m['body'][d][0]]+[128-f['anchor'][0]*s for f,s in values])),min(256,max([m['body'][d][1]]+[128+(f['sourceRect'][2]-f['anchor'][0])*s for f,s in values]))]
for f,ms in zip(m['clips']['walk_E']['frames'],[105,135,145,105,105,135,165,105]):f['ms']=ms
m['runtime']['walkSpeed']=.78;m['runtime']['runMultiplier']=1.5
m['locomotionSourceManifest']='locomotion-source-manifest.json';m['limitations']=source['limitations'];m['releaseReady']=False
m['poseCatalog']={}
for name,c in m['clips'].items():
 for f in c['frames']:
  key=f.get('imageKey','primary')+':'+str(f['sourceIndex']);pose=m['poseCatalog'].setdefault(key,{'dir':c['dir'],'clips':[]})
  if name not in pose['clips']:pose['clips'].append(name)
shutil.copy2(src/'cat-locomotion-manifest.json',dst/'locomotion-source-manifest.json');(dst/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Imported E8 N4 S4 E-run6; S uses two source images; replaced groom06 only. Six PNG hashes match.')

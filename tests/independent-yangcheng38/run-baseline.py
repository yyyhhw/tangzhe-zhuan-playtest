#!/usr/bin/env python3
"""Run existing tests only; target defaults to pinned main. No network/browser install."""
import subprocess, pathlib, json, sys, os
base=pathlib.Path(__file__).resolve().parent
root=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else base/'main'
out=pathlib.Path(sys.argv[2]).resolve() if len(sys.argv)>2 else base/'reports'
out.mkdir(parents=True,exist_ok=True)
files=sorted(root.glob('test_*.js'))+sorted(root.glob('test_home*.mjs'))
folders=['blindbox18','gacha-daily5','decor6','box83','wearables8','lifecycle-save','autosave15','formal','copy98','lockfix']
files+= [p for d in folders for p in sorted((root/'tests'/d).glob('*.test.mjs'))]
results=[]
for p in files:
 rel=str(p.relative_to(root)); cmd=['node','--experimental-vm-modules',str(p)]
 try:
  r=subprocess.run(cmd,cwd=root,capture_output=True,text=True,timeout=100)
  code=r.returncode; log=r.stdout+r.stderr
 except subprocess.TimeoutExpired as e: code=124; log=str(e)
 name=rel.replace('/','__')+'.log'; (out/name).write_text(log)
 results.append({'file':rel,'exit':code,'log':name})
 print(('PASS' if code==0 else 'FAIL')+' '+rel,flush=True)
(out/'existing-tests.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print('TOTAL',len(results),'PASS',sum(x['exit']==0 for x in results),'FAIL',sum(x['exit']!=0 for x in results))
sys.exit(any(x['exit']!=0 for x in results))

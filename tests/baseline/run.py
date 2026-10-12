"""Fixed-manifest Node comparison. Browser entries are NOT_RUN, never implicit passes."""
import argparse,concurrent.futures,json,pathlib,platform,subprocess,sys
p=argparse.ArgumentParser();p.add_argument('--root',required=True);p.add_argument('--out',required=True);p.add_argument('--timeout',type=int,default=25);a=p.parse_args()
root=pathlib.Path(a.root).resolve();out=pathlib.Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
manifest=json.loads(pathlib.Path(__file__).with_name('manifest.json').read_text());entries=manifest['entries']
assert len(entries)==82 and len({x['file'] for x in entries})==82
assert sum(x['kind']=='node' for x in entries)==57 and sum(x['kind']=='browser' for x in entries)==25
assert all(not pathlib.PurePosixPath(x['file']).is_absolute() and '..' not in pathlib.PurePosixPath(x['file']).parts for x in entries)
def run(entry):
 name=entry['file'];row={'file':name,'command':['node',name],'cwd':str(root),'kind':entry['kind']}
 if entry['kind']=='browser':return {**row,'status':'not-run','reason':'browser execution requires separate supported environment; not launched'}
 try:
  r=subprocess.run(row['command'],cwd=root,capture_output=True,text=True,timeout=a.timeout);log=r.stdout+r.stderr;row.update(status='pass' if r.returncode==0 else 'fail',exit=r.returncode)
 except subprocess.TimeoutExpired as e:log=(e.stdout or b'').decode()+(e.stderr or b'').decode();row.update(status='not-run',reason='timeout; incomplete, not a pass')
 except OSError as e:log=str(e);row.update(status='fail',reason='execution error',exit=None)
 (out/(name.replace('/','_')+'.log')).write_text(log)
 row['stage_count_error']="reading 'STAGE_COUNT'" in log
 row['evidence_head']=log.splitlines()[:16]
 return row
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:rows=list(pool.map(run,entries))
summary={'total':len(rows),**{k:sum(x['status']==k for x in rows) for k in ['pass','fail','not-run']}}
version=subprocess.run(['node','--version'],capture_output=True,text=True)
result={'manifestBase':manifest['base'],'environment':{'node':version.stdout.strip(),'python':platform.python_version(),'timeoutSeconds':a.timeout,'workers':3},'summary':summary,'rows':rows}
(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary))
# Failure or incomplete coverage must propagate to the caller. No preview-to-formal remapping.
sys.exit(1 if summary['fail'] else 2 if summary['not-run'] else 0)

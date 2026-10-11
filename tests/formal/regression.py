import subprocess,json,pathlib,os
root=pathlib.Path(__file__).resolve().parents[2]
node=os.environ.get('NODE','node')
tests=['test_economy.js','test_zbtop_preserve.js','td/test_tdproto.js','td/test_td_scores.js','pet/test_engine.js','pet/game/test_petgame.js','td/test_balance_contract.js','td/test_td_endless_host.js','td/test_td_protocol.js','td/test_formal_candidate.js','preview/cards/tests/save.test.mjs']
rows=[]
for test in tests:
 row={'test':test}
 for label,path in [('baseline',pathlib.Path('/tmp/formal-baseline')),('candidate',root)]:
  actual='cards/tests/save.test.mjs' if label=='candidate' and test.startswith('preview/cards/') else test
  p=subprocess.run([node,str(path/actual)],cwd=path,capture_output=True,text=True)
  (root/'evidence'/f'{label}-{test.replace("/","_")}.log').write_text(p.stdout+p.stderr)
  row[label]=p.returncode
 rows.append(row)
(root/'evidence'/'regression-comparison.json').write_text(json.dumps(rows,indent=2));print(json.dumps(rows,indent=2))

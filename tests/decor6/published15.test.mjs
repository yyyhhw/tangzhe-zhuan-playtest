import {withoutStoryFrameDelta} from '../integration155/exact-delta.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const rows=JSON.parse(fs.readFileSync(new URL('./published15-integrity.json',import.meta.url)));
test('all three entry persist/petSave/frame bodies exactly retain published 7ce857d autosave15 r2',()=>{
 for(const x of rows){const s=fs.readFileSync(new URL('../../'+x.file,import.meta.url),'utf8'),fn=s.match(new RegExp(`function ${x.name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}`))[0];assert.equal(createHash('sha256').update(withoutStoryFrameDelta(x.file,x.name,fn)).digest('hex'),x.sha256,x.file+':'+x.name);}
});

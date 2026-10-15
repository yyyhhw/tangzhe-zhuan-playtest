// Explicit TODOs, never treated as executed evidence. No mocked game oracle.
const test=require('node:test');
for(const c of require('./scenarios.json').cases)
 test(c.id+': '+c.assertion,{todo:c.blocked_by});

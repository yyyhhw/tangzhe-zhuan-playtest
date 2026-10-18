import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const tower = Object.freeze({page:'https://opengameart.org/content/tower-defense-theme',display:'DST-TowerDefenseTheme.mp3',url:'https://opengameart.org/sites/default/files/DST-TowerDefenseTheme_1.mp3',path:'audio/tower-defense-theme.mp3',bytes:7979070,sha256:'07cc9cd797c8ea6738b1bd740526f2610fd2ec0115774294ebda3a5ed8e62a30'});
export function verify(bytes,mapping=tower){
 assert.deepEqual(mapping,tower,'source/file mapping changed');
 assert.equal(bytes.length,tower.bytes,'byte length');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),tower.sha256,'SHA256');
 return {bytes:bytes.length,sha256:tower.sha256};
}

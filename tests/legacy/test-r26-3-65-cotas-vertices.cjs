const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const src = fs.readFileSync(path.join(root, 'assets/js/features/mapas/app.js'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'dist/surveyor-frontend/assets/js/features/mapas/app.js'), 'utf8');
function assert(v, m) { if (!v) throw new Error(m); }
assert(src === dist, 'fonte e dist divergem');
assert(src.includes('continuousOutsideJoints'), 'cadeia contínua de cotas ausente');
assert(src.includes("!(options.lockNormalOffset === true && placement === 'outside')"), 'compactação externa ainda pode quebrar a cadeia');
assert(!src.includes("pointFill: '#ffffff'"), 'vértice branco ainda presente');
assert(!src.includes('fill="#111827" stroke="#fff" stroke-width="0.8"'), 'aro branco ainda presente no vértice da prancha');
console.log('PASS R26.3.65 — cotas contínuas e vértices sem branco');

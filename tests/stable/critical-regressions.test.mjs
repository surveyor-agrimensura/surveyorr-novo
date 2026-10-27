import { spawnSync } from 'node:child_process';
const tests=[
  'test-map-direct-edit-live-sync-20260824.cjs',
  'test-map-card-edit-real-20260830.cjs',
  'test-map-vertex-native-drag-20260904.cjs',
  'test-map-undo-redo-toolbar-20260904.cjs',
  'test-project-persistence-hardening-20260824.cjs'
];
for(const test of tests){const r=spawnSync(process.execPath,[`tests/legacy/${test}`],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
console.log(`PASS regressions: ${tests.length} fluxos históricos críticos preservados.`);

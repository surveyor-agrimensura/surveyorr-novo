import fs from 'node:fs';
import assert from 'node:assert/strict';
const m=JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json','utf8')).commercialPlans;
assert.equal(m.billingPolicy,'annual-only');
assert.equal(m.projectsPolicy,'unlimited-storage-bounded');
assert.equal(m.basic.projects,null); assert.equal(m.plus.projects,null); assert.equal(m.pro.projects,null);
assert.equal(m.basic.includedStorageBytes,200*1024*1024); assert.equal(m.basic.maxStorageBytes,2*1024*1024*1024);
assert.equal(m.plus.includedStorageBytes,500*1024*1024); assert.equal(m.plus.maxStorageBytes,5*1024*1024*1024);
assert.equal(m.pro.includedStorageBytes,1*1024*1024*1024); assert.equal(m.pro.maxStorageBytes,10*1024*1024*1024);
assert.equal(m.basic.downloadsPerDay,5); assert.equal(m.plus.downloadsPerDay,20); assert.equal(m.pro.downloadsPerDay,null);
assert.equal(m.addons.storageBlockBytes,500*1024*1024); assert.equal(m.addons.storageBlockCents,1500);
// Na arquitetura 1.0 as regras comerciais saíram do monolito main.js e vivem no módulo de domínio.
const commercial=fs.readFileSync('functions/surveyor-api/src/domain/commercial.js','utf8');
for(const needle of ['storageBaseBytes: 200 * MB_BYTES','storageMaxBytes: 2 * GB_BYTES','storageBaseBytes: 500 * MB_BYTES','storageMaxBytes: 5 * GB_BYTES','storageBaseBytes: 1 * GB_BYTES','storageMaxBytes: 10 * GB_BYTES']) assert.ok(commercial.includes(needle),`backend sem regra comercial: ${needle}`);
const permissions=fs.readFileSync('functions/surveyor-api/src/domain/permissions.js','utf8');
assert.ok(permissions.includes('company:settings'),'backend sem Personalização Pro (company:settings)');
console.log('PASS commercial: matriz oficial anual, projetos ilimitados, storage/franquias e Personalização Pro conferidos na arquitetura modular.');

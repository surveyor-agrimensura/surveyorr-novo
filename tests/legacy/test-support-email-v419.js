import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'suporte/index.html',
  'sobre/index.html',
  'assets/js/admin/documents.js',
  'functions/surveyor-support/src/main.js',
  'functions/surveyor-support/.env.example',
  'functions/surveyor-api/src/main.js',
  'config/.env.example'
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('suporte@surveyorr.com.br'), `${file} não contém o novo e-mail.`);
  assert.ok(!text.includes('suporte@surveyoragrimensura.tech'), `${file} ainda contém o e-mail antigo.`);
}

assert.equal(fs.readFileSync('CNAME', 'utf8').trim(), 'surveyorr.com.br');
console.log('OK: novo e-mail oficial e CNAME validados.');

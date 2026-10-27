import fs from 'node:fs';
console.log(`Suíte histórica arquivada: ${fs.readdirSync('tests/legacy').filter(f=>/^test-/.test(f)).length} testes.`);
console.log('Ela é mantida para investigação de regressões antigas e não é gate da release 1.0.');
console.log('Os fluxos históricos ainda relevantes são chamados pela suíte tests/stable/critical-regressions.test.mjs.');

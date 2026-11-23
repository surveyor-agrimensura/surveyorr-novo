import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const base = new URL(process.argv[2] || 'http://127.0.0.1:5500');
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('Este teste aceita somente localhost/loopback; não execute contra produção.');
}

const script = fileURLToPath(new URL('./loadtest.mjs', import.meta.url));
for (const concurrency of [10, 25, 50]) {
  const total = concurrency * 20;
  console.log(`\n=== Ensaio HTTP local: ${concurrency} concorrentes, ${total} requisicoes ===`);
  const result = spawnSync(process.execPath, [script, String(concurrency), String(total), base.origin], {
    encoding: 'utf8',
    stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\nEnsaios HTTP concluidos. Eles nao medem renderizacao, GIS ou desempenho de producao.');

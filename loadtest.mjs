import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const [concurrencyArg = '10', totalArg = '100', baseArg = 'http://127.0.0.1:5500'] = process.argv.slice(2);
const CONCURRENCY = Number(concurrencyArg);
const TOTAL = Number(totalArg);
const BASE = new URL(baseArg);
const ROUTES = [
  '/',
  '/login/',
  '/nuvem/',
  '/mapa/',
  '/mapas/',
  '/memorial/',
  '/pranchas/',
  '/confrontacao/',
  '/ods/',
  '/ambiental/',
  '/planialtimetria/',
  '/perimetro-azimute/',
  '/loteamento-reurb/',
  '/central-lotes/',
  '/customizacao/',
  '/mapa/trabalho/',
  '/publico/imovel/'
];

if (!Number.isInteger(CONCURRENCY) || CONCURRENCY < 1 || !Number.isInteger(TOTAL) || TOTAL < 1) {
  throw new Error('Use: node loadtest.mjs <concorrencia positiva> <total positivo> [URL local]');
}
if (!['http:', 'https:'].includes(BASE.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(BASE.hostname)) {
  throw new Error('Este teste aceita somente localhost/loopback; não execute contra produção.');
}

async function fetchOnce(path) {
  const started = performance.now();
  try {
    const requestUrl = new URL(path, BASE);
    const response = await fetch(requestUrl, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
    const body = Buffer.from(await response.arrayBuffer());
    const location = response.headers.get('location');
    let externalRedirect = false;
    if (response.status >= 300 && response.status < 400 && location) {
      try { externalRedirect = new URL(location, requestUrl).origin !== BASE.origin; } catch {}
    }
    return {
      path,
      status: response.status,
      bytes: body.length,
      contentType: response.headers.get('content-type') || '',
      hash: createHash('sha256').update(body).digest('hex').slice(0, 12),
      externalRedirect,
      ms: performance.now() - started
    };
  } catch (error) {
    return { path, status: 0, bytes: 0, contentType: '', hash: '', ms: performance.now() - started, err: error.cause?.code || error.name };
  }
}

const results = [];
const started = performance.now();
for (let offset = 0; offset < TOTAL; offset += CONCURRENCY) {
  const count = Math.min(CONCURRENCY, TOTAL - offset);
  const batch = Array.from({ length: count }, (_, index) => fetchOnce(ROUTES[(offset + index) % ROUTES.length]));
  results.push(...await Promise.all(batch));
}

const elapsedMs = performance.now() - started;
const latencies = results.map((result) => result.ms).sort((a, b) => a - b);
const percentile = (q) => latencies[Math.max(0, Math.ceil(latencies.length * q) - 1)];
const isOk = (result) => result.status >= 200 && result.status < 300;
const ok = results.filter(isOk);
const errors = results.filter((result) => !isOk(result));
const routeStats = new Map();
for (const result of results) {
  const stats = routeStats.get(result.path) || { requests: 0, errors: 0, totalMs: 0, hashes: new Set() };
  stats.requests += 1;
  stats.errors += isOk(result) ? 0 : 1;
  stats.totalMs += result.ms;
  if (result.hash) stats.hashes.add(result.hash);
  routeStats.set(result.path, stats);
}

console.log(`HTTP local: ${TOTAL} requisicoes; concorrencia maxima ${CONCURRENCY}; destino ${BASE.origin}`);
console.log(`HTTP 2xx: ${ok.length}; erros HTTP/transporte: ${errors.length}; duracao ${elapsedMs.toFixed(1)} ms`);
console.log(`Latencia HTTP (ms): p50=${percentile(0.50).toFixed(1)} p95=${percentile(0.95).toFixed(1)} p99=${percentile(0.99).toFixed(1)}`);
console.log(`Respostas: ${new Set(results.map((result) => result.hash).filter(Boolean)).size} hashes de corpo distintos`);
for (const [path, stats] of routeStats) {
  console.log(`${path} requests=${stats.requests} errors=${stats.errors} avg=${(stats.totalMs / stats.requests).toFixed(1)}ms bodies=${stats.hashes.size}`);
}
for (const result of errors.filter((item) => item.externalRedirect)) {
  console.log(`Redirecionamento externo bloqueado para ${result.path} (HTTP ${result.status}); nenhum destino foi seguido.`);
}
if (errors.length) process.exitCode = 1;

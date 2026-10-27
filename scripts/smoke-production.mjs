const targets = [
  { name: 'Frontend', url: process.env.SURVEYOR_WEB_URL || 'https://surveyorr.com.br/', type: 'html' },
  { name: 'Login', url: `${String(process.env.SURVEYOR_WEB_URL || 'https://surveyorr.com.br').replace(/\/+$/, '')}/login/`, type: 'html' },
  { name: 'API live', url: `${String(process.env.SURVEYOR_API_URL || 'https://api.surveyorr.com.br').replace(/\/+$/, '')}/api/live`, type: 'json' },
  { name: 'API ready', url: `${String(process.env.SURVEYOR_API_URL || 'https://api.surveyorr.com.br').replace(/\/+$/, '')}/api/ready`, type: 'json' },
  { name: 'Save live', url: `${String(process.env.SURVEYOR_SAVE_URL || 'https://6a7bce66000fc9c90d88.nyc.appwrite.run').replace(/\/+$/, '')}/api/live`, type: 'json' },
  { name: 'Save ready', url: `${String(process.env.SURVEYOR_SAVE_URL || 'https://6a7bce66000fc9c90d88.nyc.appwrite.run').replace(/\/+$/, '')}/api/ready`, type: 'json' },
  { name: 'Support', url: `${String(process.env.SURVEYOR_SUPPORT_URL || 'https://6a46d3d0003091f98222.nyc.appwrite.run').replace(/\/+$/, '')}/api/health`, type: 'json' },
  { name: 'GeoServices', url: `${String(process.env.SURVEYOR_GEOSERVICES_URL || 'https://tiny-king-d719georural-geoservices.kaualucasfrancasantos.workers.dev').replace(/\/+$/, '')}/health`, type: 'json' }
];

const timeoutMs = Math.max(2000, Number(process.env.SMOKE_TIMEOUT_MS || 12000));
const failures = [];
const rows = [];

for (const target of targets) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'User-Agent': 'Surveyor-Production-Smoke/1.0' },
      signal: controller.signal
    });
    const elapsed = Date.now() - started;
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    let semanticOk = true;
    let detail = '';
    if (target.type === 'json' && contentType.includes('json')) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload === 'object') {
        const state = String(payload.status || payload.state || '').toLowerCase();
        if (state && ['error', 'failed', 'unhealthy', 'not_ready'].includes(state)) semanticOk = false;
        detail = state || (payload.ok === true ? 'ok' : 'json');
      }
    } else if (target.type === 'html') {
      const text = await response.text();
      semanticOk = /Surveyor/i.test(text) && text.length > 300;
      detail = semanticOk ? 'html-ok' : 'html-unexpected';
    }
    const ok = response.ok && semanticOk;
    rows.push({ name: target.name, status: response.status, ms: elapsed, ok, detail });
    if (!ok) failures.push(`${target.name}: HTTP ${response.status}${detail ? ` (${detail})` : ''}`);
  } catch (error) {
    const elapsed = Date.now() - started;
    const message = error?.name === 'AbortError' ? `timeout>${timeoutMs}ms` : String(error?.message || error);
    rows.push({ name: target.name, status: '-', ms: elapsed, ok: false, detail: message });
    failures.push(`${target.name}: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

console.table(rows);
if (failures.length) {
  console.error(`\nSMOKE FALHOU (${failures.length}/${targets.length}):`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`\nOK: ${targets.length} verificações públicas de produção responderam corretamente.`);

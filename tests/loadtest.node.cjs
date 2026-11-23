const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const loadtest = path.join(root, 'loadtest.mjs');
const serverSource = `
  const http = require('node:http');
  const paths = [];
  const server = http.createServer((req, res) => {
    paths.push(req.url);
    res.setHeader('content-type', 'text/html');
    res.end('<!doctype html><title>local test</title>');
  });
  server.listen(0, '127.0.0.1', () => console.log('PORT=' + server.address().port));
  process.on('message', (message) => {
    if (message === 'stop') {
      process.send({ paths });
      server.close(() => process.exit(0));
    }
  });
`;

function collect(child) {
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  return () => output;
}

function waitForPort(child, getOutput) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Local test server did not start')), 5000);
    const check = () => {
      const match = getOutput().match(/PORT=(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    };
    child.stdout.on('data', check);
    child.once('error', reject);
    child.once('exit', (code) => reject(new Error(`Local test server exited early (${code})`)));
  });
}

function runLoadtest(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [loadtest, ...args], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function testRedirectIsNotFollowed() {
  let redirectTargetHits = 0;
  const target = http.createServer((_req, res) => {
    redirectTargetHits += 1;
    res.end('target must not receive this request');
  });
  const targetUrl = await listen(target);
  const source = http.createServer((_req, res) => {
    res.writeHead(302, { location: `${targetUrl}/should-not-be-requested` });
    res.end();
  });
  const sourceUrl = await listen(source);
  try {
    const result = await runLoadtest(['1', '1', sourceUrl]);
    assert.equal(result.code, 1, result.stdout);
    assert.match(result.stdout, /HTTP 2xx: 0; erros HTTP\/transporte: 1/);
    assert.match(result.stdout, /Redirecionamento externo bloqueado/);
    assert.equal(redirectTargetHits, 0, 'Redirect destination must receive no request');
  } finally {
    await close(source);
    await close(target);
  }
}

async function main() {
  const server = spawn(process.execPath, ['-e', serverSource], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const getServerOutput = collect(server);
  let serverPaths = null;
  server.on('message', (message) => { serverPaths = message.paths; });
  let result;
  try {
    const port = await waitForPort(server, getServerOutput);
    result = await runLoadtest(['3', '11', `http://127.0.0.1:${port}`]);
  } finally {
    if (server.connected) server.send('stop');
  }
  await new Promise((resolve, reject) => {
    server.once('close', resolve);
    server.once('error', reject);
  });
  const serverOutput = getServerOutput();
  assert.equal(result.code, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /11 requisicoes/);
  assert.match(result.stdout, /HTTP 2xx: 11; erros HTTP\/transporte: 0/);
  assert.ok(Array.isArray(serverPaths), `Expected captured local routes; output: ${serverOutput}`);
  assert.equal(serverPaths.length, 11);
  assert.ok(serverPaths.includes('/'));
  assert.ok(serverPaths.includes('/login/'));
  await testRedirectIsNotFollowed();
  console.log('Local load harness: 11 local requests passed; a cross-origin redirect was blocked without contacting its destination.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

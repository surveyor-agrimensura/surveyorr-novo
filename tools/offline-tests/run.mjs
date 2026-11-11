// Runner offline dos testes TypeScript do SURVEYOR.
//
// Por que existe: o fluxo oficial é `npm run test` (vitest) + `npm run build` (vite).
// Em um ambiente sem rede (ou sem os binários nativos do sistema atual) esses comandos
// não iniciam. Este runner reproduz o suficiente para executar a suíte TS:
//   1. compila src/ e tests/**/*.test.ts com o TypeScript já instalado no projeto;
//   2. executa cada arquivo de teste no Node com um shim mínimo da API do vitest.
//
// Uso:
//   node tools/offline-tests/run.mjs                # suíte completa
//   node tools/offline-tests/run.mjs confrontant    # filtra por parte do caminho
//   node tools/offline-tests/run.mjs --list         # apenas lista os arquivos
//   node tools/offline-tests/run.mjs --no-compile   # reusa a compilação anterior
//
// Nada é escrito dentro do projeto: a compilação vai para o diretório temporário do
// sistema. Isto NÃO substitui `npm run check:release`; é um portão rápido de regressão.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..');
const workRoot = join(tmpdir(), 'surveyor-offline-tests');
const buildRoot = join(workRoot, 'build');
const shimUrl = pathToFileURL(join(here, 'vitest-shim.mjs')).href;
const hooksUrl = pathToFileURL(join(here, 'hooks.mjs')).href;
const tscBin = join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');

// Valores de `import.meta.env` equivalentes ao modo de teste do Vite.
globalThis.__VITE_ENV__ = { MODE: 'test', DEV: true, PROD: false, SSR: false, BASE_URL: '/' };

// Os hooks de módulo rodam em outra thread, sem acesso a este `globalThis`. O mapa de
// mocks do arquivo de teste em execução é comunicado pelo arquivo abaixo.
const activeMocksFile = join(here, '.active-mocks.json');
function writeActiveMocks(mocks) {
  writeFileSync(activeMocksFile, JSON.stringify(Object.fromEntries(mocks)));
}

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const noCompile = args.includes('--no-compile');
const filter = args.filter((arg) => !arg.startsWith('--')).join(' ');
const filterRegex = filter ? new RegExp(filter, 'i') : null;

register(hooksUrl);

// ---------------------------------------------------------------------------- compilar

function newestMtime(directory) {
  if (!existsSync(directory)) return 0;
  let newest = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const mtime = statSync(full).mtimeMs;
        if (mtime > newest) newest = mtime;
      }
    }
  };
  walk(directory);
  return newest;
}

function compile() {
  const marker = join(workRoot, 'last-compile');
  const sourcesMtime = Math.max(
    newestMtime(join(projectRoot, 'src')),
    newestMtime(join(projectRoot, 'tests')),
    newestMtime(here),
  );
  if (noCompile || (existsSync(marker) && existsSync(buildRoot) && Number(readFileSync(marker, 'utf8')) >= sourcesMtime)) {
    if (existsSync(buildRoot)) return { ok: true, skipped: true };
  }

  rmSync(workRoot, { recursive: true, force: true });
  mkdirSync(workRoot, { recursive: true });

  const configPath = join(workRoot, 'tsconfig.emit.json');
  const config = {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      strict: false,
      skipLibCheck: true,
      resolveJsonModule: true,
      noEmit: false,
      noUnusedLocals: false,
      noUnusedParameters: false,
      declaration: false,
      sourceMap: false,
      rootDir: projectRoot,
      outDir: buildRoot,
      types: [],
    },
    include: [join(projectRoot, 'src', '**', '*'), join(projectRoot, 'tests', '**', '*.test.ts')],
    exclude: [join(projectRoot, 'node_modules')],
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2));

  const result = spawnSync(process.execPath, [tscBin, '-p', configPath], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 600_000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0) return { ok: false, output };

  writeFileSync(marker, String(Date.now()));
  return { ok: true, skipped: false };
}

// ------------------------------------------------------------------------------ rodar

function collectTestFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.test.ts')) files.push(full);
    }
  };
  for (const base of ['tests', 'src']) {
    const dir = join(projectRoot, base);
    if (existsSync(dir)) walk(dir);
  }
  return files.sort();
}

function toCompiledPath(sourceFile) {
  return join(buildRoot, relative(projectRoot, sourceFile).replace(/\.ts$/, '.js'));
}

// ------------------------------------------------------------------------- vi.mock

// O vitest içaria (`hoist`) as chamadas `vi.mock` para que valessem antes dos imports.
// Como não fazemos transformação de código, pré-registramos os mocks aqui: avaliamos cada
// fábrica e geramos um módulo temporário com os mesmos nomes de exportação. Assim a
// substituição já existe quando o grafo de imports do teste começa a carregar.
globalThis.__VITEST_MOCKS__ = new Map();

function extractMockCalls(source) {
  const calls = [];
  const searchToken = 'vi.mock(';
  let index = source.indexOf(searchToken);

  while (index !== -1) {
    const open = index + searchToken.length - 1;
    let depth = 0;
    let position = open;
    let quote = null;

    for (; position < source.length; position += 1) {
      const character = source[position];
      if (quote) {
        if (character === '\\') position += 1;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') { quote = character; continue; }
      if (character === '(') depth += 1;
      else if (character === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const argumentText = source.slice(open + 1, position);
    calls.push(argumentText);
    index = source.indexOf(searchToken, position);
  }
  return calls;
}

function splitTopLevelArguments(argumentText) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let current = '';

  for (let position = 0; position < argumentText.length; position += 1) {
    const character = argumentText[position];
    if (quote) {
      current += character;
      if (character === '\\') { current += argumentText[position + 1] ?? ''; position += 1; }
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') { quote = character; current += character; continue; }
    if ('([{'.includes(character)) depth += 1;
    if (')]}'.includes(character)) depth -= 1;
    if (character === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
    current += character;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function registerMocksFor(testFile, compiledFile, vi) {
  const source = readFileSync(compiledFile, 'utf8');
  const calls = extractMockCalls(source);

  for (const [sequence, argumentText] of calls.entries()) {
    const [specifierExpression, factoryExpression] = splitTopLevelArguments(argumentText);
    const specifier = specifierExpression?.replace(/^['"`]|['"`]$/g, '');
    if (!specifier || !factoryExpression || !specifier.startsWith('.')) continue;

    const targetPath = resolve(dirname(compiledFile), specifier);
    const targetFile = [targetPath, `${targetPath}.js`, `${targetPath}.json`, join(targetPath, 'index.js')]
      .find((candidate) => existsSync(candidate));
    if (!targetFile) continue;

    let moduleExports;
    try {
      const factory = new Function('vi', `return (${factoryExpression});`)(vi);
      moduleExports = await factory();
    } catch (error) {
      console.error(`  ! vi.mock ignorado em ${relative(projectRoot, testFile)}: ${error?.message ?? error}`);
      continue;
    }

    const mockDirectory = join(workRoot, 'mocks');
    mkdirSync(mockDirectory, { recursive: true });
    const mockFile = join(mockDirectory, `${relative(projectRoot, testFile).replace(/[\\/]/g, '_')}-${sequence}.mjs`);
    const names = Object.keys(moduleExports ?? {});
    // Índice fixo (não `pop`): a ordem de carregamento dos mocks não é garantida.
    globalThis.__VITEST_MOCK_VALUES__ = globalThis.__VITEST_MOCK_VALUES__ ?? [];
    const valueIndex = globalThis.__VITEST_MOCK_VALUES__.push(moduleExports) - 1;

    const lines = [`const __values = globalThis.__VITEST_MOCK_VALUES__[${valueIndex}];`];
    for (const name of names.filter((name) => /^[A-Za-z_$][\w$]*$/.test(name))) {
      lines.push(`export const ${name} = __values[${JSON.stringify(name)}];`);
    }
    lines.push('export default __values;');
    writeFileSync(mockFile, lines.join('\n'));

    globalThis.__VITEST_MOCKS__.set(targetFile, mockFile);
  }
}

async function main() {
  if (!existsSync(tscBin)) {
    console.error('TypeScript não encontrado em node_modules. Rode `npm install` antes.');
    process.exit(1);
  }

  const testFiles = collectTestFiles().filter(
    (file) => !filterRegex || filterRegex.test(relative(projectRoot, file)),
  );

  if (!testFiles.length) {
    console.error('Nenhum arquivo de teste encontrado com esse filtro.');
    process.exit(1);
  }

  if (listOnly) {
    for (const file of testFiles) console.log(relative(projectRoot, file));
    return;
  }

  const compiled = compile();
  if (!compiled.ok) {
    console.error('Falha ao compilar os testes:');
    console.error(compiled.output);
    process.exit(1);
  }

  const shim = await import(shimUrl);
  shim.resetState();

  let loadFailures = 0;
  for (const sourceFile of testFiles) {
    const compiledFile = toCompiledPath(sourceFile);
    if (!existsSync(compiledFile)) {
      console.error(`  ✗ ${relative(projectRoot, sourceFile)} — não foi compilado`);
      loadFailures += 1;
      continue;
    }
    try {
      // Cada arquivo de teste tem seu próprio conjunto de mocks.
      const mocks = new Map();
      globalThis.__VITEST_MOCKS__ = mocks;
      globalThis.__VITEST_MOCK_VALUES__ = [];
      writeActiveMocks(mocks);
      await registerMocksFor(sourceFile, compiledFile, shim.vi);
      writeActiveMocks(mocks);
      await import(pathToFileURL(compiledFile).href);
    } catch (error) {
      console.error(`  ✗ ${relative(projectRoot, sourceFile)} — falha ao carregar: ${error?.message ?? error}`);
      loadFailures += 1;
    }
  }

  const { passes, failures, failureDetails } = await shim.runAll();

  if (failureDetails.length) {
    console.error('\nFalhas:');
    for (const { name, error } of failureDetails) {
      const message = String(error?.message ?? error).split('\n')[0];
      console.error(`  ✗ ${name}`);
      console.error(`      ${message}`);
      if (error?.name !== 'AssertionError' && error?.stack) {
        const frame = error.stack
          .split('\n')
          .find((line) => line.includes('.build') || line.includes(projectRoot));
        if (frame) console.error(`      ${frame.trim()}`);
      }
    }
  }

  const total = passes + failures;
  const cacheNote = compiled.skipped ? ' (compilação reaproveitada)' : '';
  console.log(
    `\n${total} testes · ${passes} passaram · ${failures} falharam · ${loadFailures} arquivo(s) não carregado(s)${cacheNote}`,
  );

  if (failures > 0 || loadFailures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

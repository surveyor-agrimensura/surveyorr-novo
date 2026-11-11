// Hooks de resolução/carregamento do runner offline.
//
// Reproduz o mínimo que o Vite faz e que o Node não faz sozinho:
//   - resolve './foo' para './foo.js' (moduleResolution: Bundler);
//   - resolve 'vitest' para o shim local;
//   - entrega o conteúdo de imports `?raw` como string (templates SVG oficiais);
//   - troca imports de CSS por módulo vazio;
//   - substitui `import.meta.env` por `globalThis.__VITE_ENV__`;
//   - resolve pacotes de `node_modules` a partir da raiz do projeto (a compilação
//     acontece em diretório temporário, fora da árvore do projeto).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, '..', '..');
const projectUrl = pathToFileURL(join(projectRoot, 'package.json')).href;
const shimUrl = pathToFileURL(join(here, 'vitest-shim.mjs')).href;
const workRoot = join(dirname(here), '..', '..', '..'); // não usado; mantido para clareza
const EXTENSIONS = ['.js', '.json', '.mjs'];

void workRoot;

function splitQuery(specifier) {
  const index = specifier.indexOf('?');
  return index === -1 ? [specifier, ''] : [specifier.slice(0, index), specifier.slice(index)];
}

const activeMocksFile = join(here, '.active-mocks.json');
let activeMocksCache = { mtime: -1, value: null };

function readActiveMocks() {
  try {
    const { mtimeMs } = statSync(activeMocksFile);
    if (mtimeMs !== activeMocksCache.mtime) {
      const parsed = JSON.parse(readFileSync(activeMocksFile, 'utf8'));
      activeMocksCache = { mtime: mtimeMs, value: parsed && Object.keys(parsed).length ? parsed : null };
    }
    return activeMocksCache.value;
  } catch {
    return null;
  }
}

// Assets que o Vite resolve por plugin e que o Node não conhece.
const ASSET_EXTENSIONS = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff', '.woff2'];
const RAW_SUFFIXES = ['?raw', '?url', '?inline'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'vitest' || specifier === 'vitest/globals') {
    return { url: shimUrl, shortCircuit: true, format: 'module' };
  }

  // Módulos substituídos por `vi.mock` no arquivo de teste em execução.
  // Os hooks rodam em uma thread separada, sem acesso ao `globalThis` do runner:
  // o mapa de mocks chega por um arquivo JSON gravado antes de cada arquivo de teste.
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const activeMocks = readActiveMocks();
    if (activeMocks) {
      const [path] = splitQuery(specifier);
      const parentDirectory = dirname(fileURLToPath(context.parentURL));
      for (const extension of ['', '.js', '.json']) {
        const candidate = join(parentDirectory, path).split('\\').join('/') + extension;
        const mockFile = activeMocks[candidate];
        if (mockFile) {
          return { url: pathToFileURL(mockFile).href, shortCircuit: true, format: 'module' };
        }
      }
    }
  }

  const [bareSpecifier, query] = splitQuery(specifier);
  const wantsRaw = RAW_SUFFIXES.some((suffix) => query.startsWith(suffix));
  const isAsset = ASSET_EXTENSIONS.some((extension) => bareSpecifier.endsWith(extension));
  const isRelative = bareSpecifier.startsWith('./') || bareSpecifier.startsWith('../');

  // Assets (`?raw`, `?url`, svg/png...): resolve o arquivo original do projeto.
  if ((wantsRaw || isAsset) && isRelative && context.parentURL) {
    const parentDirectory = dirname(fileURLToPath(context.parentURL));
    const fromBuild = resolveSourceAsset(parentDirectory, bareSpecifier);
    const target = fromBuild ?? join(parentDirectory, bareSpecifier);
    if (existsSync(target)) {
      return {
        url: pathToFileURL(target).href + (wantsRaw ? '?raw' : ''),
        shortCircuit: true,
        format: 'module',
      };
    }
    throw new Error(`Asset não encontrado: ${bareSpecifier} (a partir de ${parentDirectory})`);
  }

  // Relativos sem extensão: tenta .js/.json/.mjs e index.
  if (isRelative && context.parentURL) {
    const hasExtension = EXTENSIONS.some((extension) => bareSpecifier.endsWith(extension));
    if (!hasExtension) {
      for (const extension of [...EXTENSIONS, '']) {
        const candidate = extension ? `${bareSpecifier}${extension}${query}` : `${bareSpecifier}/index.js${query}`;
        try {
          return await nextResolve(candidate, context);
        } catch {
          // próximo candidato
        }
      }
    }
  }

  // Pacotes externos: resolve a partir da raiz do projeto, não do diretório temporário.
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (bareSpecifier.startsWith('.') || bareSpecifier.startsWith('/') || bareSpecifier.startsWith('node:')) {
      throw error;
    }
    return nextResolve(specifier, { ...context, parentURL: projectUrl });
  }
}

// Traduz ".../build/src/features/memorial/x.svg" para ".../src/features/memorial/x.svg".
function resolveSourceAsset(parentDirectory, relativeSpecifier) {
  const marker = `${join('build')}`;
  const index = parentDirectory.indexOf(marker);
  if (index === -1) return null;
  const projectSourceDirectory = join(projectRoot, parentDirectory.slice(index + marker.length + 1));
  const candidate = join(projectSourceDirectory, relativeSpecifier);
  return existsSync(candidate) ? candidate : null;
}

export async function load(url, context, nextLoad) {
  // Imports `?raw`: devolve o arquivo como string.
  if (url.includes('?raw')) {
    const filePath = fileURLToPath(url.split('?')[0]);
    if (!existsSync(filePath)) throw new Error(`Arquivo ?raw não encontrado: ${filePath}`);
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(readFileSync(filePath, 'utf8'))};`,
    };
  }

  // CSS: nos testes o Vite apenas ignora o conteúdo.
  if (url.endsWith('.css')) {
    return { format: 'module', shortCircuit: true, source: 'export default {};' };
  }

  const result = await nextLoad(url, context);

  // `import.meta.env` não existe no Node. Troca pelo objeto global controlado pelo runner.
  if (url.endsWith('.js') && result.source) {
    const source = result.source.toString();
    if (source.includes('import.meta.env')) {
      return { ...result, source: source.replaceAll('import.meta.env', '(globalThis.__VITE_ENV__??{})') };
    }
  }

  return result;
}

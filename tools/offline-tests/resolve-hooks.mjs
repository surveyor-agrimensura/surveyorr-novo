// Hooks de módulo usados apenas pelo runner offline (tools/offline-tests).
//
// Motivo: o projeto usa `moduleResolution: Bundler`, então o código-fonte importa
// './foo' sem extensão e usa `import.meta.env.VITE_*`. O Node não resolve nada disso
// sozinho. O Vite faz esse trabalho no fluxo normal; aqui reproduzimos o mínimo
// necessário para executar os testes fora do Vite/vitest.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const EXTENSIONS = ['.js', '.json', '.mjs'];

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    if (!relative || !context.parentURL) throw error;

    for (const extension of EXTENSIONS) {
      if (specifier.endsWith(extension)) continue;
      try {
        return await nextResolve(specifier + extension, context);
      } catch {
        // tenta a próxima extensão
      }
    }
    // Diretório com index
    for (const extension of EXTENSIONS) {
      try {
        return await nextResolve(`${specifier}/index${extension}`, context);
      } catch {
        // ignora
      }
    }
    throw error;
  }
}

export function registerHooks() {
  register(new URL('./resolve-hooks.mjs', pathToFileURL(import.meta.url)));
}

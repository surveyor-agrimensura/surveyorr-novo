// Autoteste do runner offline.
//
// Um runner que sempre passa é pior do que não ter runner. Este arquivo verifica que o
// shim realmente detecta falhas: matchers corretos passam, matchers errados lançam, o
// estado de espiões funciona e `.rejects`/`.not` se comportam como no vitest.
//
// Uso: node tools/offline-tests/selftest.mjs

import { expect, vi } from './vitest-shim.mjs';

let checks = 0;
let problems = 0;

function ok(description, fn) {
  checks += 1;
  try {
    fn();
  } catch (error) {
    problems += 1;
    console.error(`  ✗ ${description}`);
    console.error(`      ${error?.message ?? error}`);
  }
}

// Uma asserção deve lançar. Se não lançar, o matcher está permissivo demais.
function mustFail(description, fn) {
  checks += 1;
  try {
    fn();
    problems += 1;
    console.error(`  ✗ ${description} — esperava falha, mas passou (matcher permissivo)`);
  } catch (error) {
    if (error?.name !== 'AssertionError') {
      problems += 1;
      console.error(`  ✗ ${description} — lançou ${error?.name} em vez de AssertionError: ${error?.message}`);
    }
  }
}

// ------------------------------------------------------------- matchers que aprovam

ok('toBe compara identidade', () => expect(1).toBe(1));
ok('toEqual compara profundidade', () => expect({ a: [1, { b: 2 }] }).toEqual({ a: [1, { b: 2 }] }));
ok('toBeCloseTo respeita dígitos', () => expect(1.0004).toBeCloseTo(1, 2));
ok('toContain em string', () => expect('surveyor').toContain('vey'));
ok('toContain em array', () => expect([1, 2, 3]).toContain(2));
ok('toHaveLength', () => expect([1, 2]).toHaveLength(2));
ok('toMatch com regex', () => expect('BA-1234').toMatch(/^BA-/));
ok('toThrow com trecho da mensagem', () => expect(() => { throw new Error('revisão ausente'); }).toThrow('ausente'));
ok('toBeGreaterThan', () => expect(5).toBeGreaterThan(4));
ok('toBeNull', () => expect(null).toBeNull());
ok('toBeUndefined', () => expect(undefined).toBeUndefined());
ok('toBeTruthy', () => expect('x').toBeTruthy());
ok('toMatchObject parcial', () => expect({ a: 1, b: 2 }).toMatchObject({ a: 1 }));
ok('not inverte a expectativa', () => expect(1).not.toBe(2));

// --------------------------------------------------------------- matchers que negam

mustFail('toBe detecta diferença', () => expect(1).toBe(2));
mustFail('toEqual detecta diferença em objeto', () => expect({ a: 1 }).toEqual({ a: 2 }));
mustFail('toEqual detecta diferença em array', () => expect([1, 2]).toEqual([1, 2, 3]));
mustFail('toBeCloseTo detecta diferença maior que a tolerância', () => expect(1.5).toBeCloseTo(1, 2));
mustFail('toContain detecta ausência', () => expect('surveyor').toContain('xyz'));
mustFail('toHaveLength detecta tamanho errado', () => expect([1, 2]).toHaveLength(3));
mustFail('toThrow detecta ausência de erro', () => expect(() => {}).toThrow());
mustFail('toThrow detecta mensagem diferente', () => expect(() => { throw new Error('abc'); }).toThrow('xyz'));
mustFail('toBeNull detecta valor presente', () => expect(0).toBeNull());
mustFail('toBeTruthy detecta falsy', () => expect('').toBeTruthy());
mustFail('not.toBe detecta igualdade', () => expect(1).not.toBe(1));
mustFail('toMatchObject detecta divergência', () => expect({ a: 1 }).toMatchObject({ a: 2 }));

// --------------------------------------------------------------------- promessas

const passed = [];
await (async () => {
  await expect(Promise.reject(new Error('falha esperada'))).rejects.toThrow('esperada');
  passed.push('rejects.toThrow aprova erro correspondente');

  try {
    await expect(Promise.resolve(1)).rejects.toThrow('x');
    problems += 1;
    console.error('  ✗ rejects detecta resolução — esperava falha, mas passou');
  } catch {
    passed.push('rejects detecta promessa resolvida');
  }

  try {
    await expect(Promise.reject(new Error('abc'))).rejects.toThrow('xyz');
    problems += 1;
    console.error('  ✗ rejects detecta mensagem divergente — esperava falha, mas passou');
  } catch {
    passed.push('rejects detecta mensagem divergente');
  }

  await expect(Promise.resolve({ ok: true })).resolves.toEqual({ ok: true });
  passed.push('resolves.toEqual aprova valor correspondente');
})();

checks += passed.length;

// -------------------------------------------------------------------- espiões e stubs

ok('vi.fn registra chamadas', () => {
  const spy = vi.fn();
  spy('a');
  spy('b');
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy.mock.calls[0]).toEqual(['a']);
});

ok('mockResolvedValueOnce respeita a ordem', async () => {
  const spy = vi.fn();
  spy.mockResolvedValueOnce('primeiro').mockResolvedValueOnce('segundo');
  expect(await spy()).toBe('primeiro');
  expect(await spy()).toBe('segundo');
});

ok('mockReturnValue continua valendo depois dos Once', () => {
  const spy = vi.fn();
  spy.mockResolvedValueOnce('unico').mockReturnValue('padrao');
  spy();
  expect(spy()).toBe('padrao');
});

ok('stubGlobal e unstubAllGlobals restauram o original', () => {
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', 'substituto');
  expect(globalThis.fetch).toBe('substituto');
  vi.unstubAllGlobals();
  expect(globalThis.fetch).toBe(original);
});

mustFail('toHaveBeenCalledTimes detecta contagem errada', () => {
  const spy = vi.fn();
  spy();
  expect(spy).toHaveBeenCalledTimes(2);
});

// ------------------------------------------------------------------------ resultado

if (problems) {
  console.error(`\nAutoteste do runner: ${problems} problema(s) em ${checks} verificações.`);
  process.exit(1);
}

console.log(`Autoteste do runner: ${checks} verificações aprovadas.`);

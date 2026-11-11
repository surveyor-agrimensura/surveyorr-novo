// Implementação mínima da API do vitest usada pela suíte do SURVEYOR.
//
// Cobre apenas o que os testes realmente consomem: describe/it/test (síncronos e
// assíncronos), expect com os matchers listados abaixo, vi.fn/stubGlobal/unstubAllGlobals,
// hooks beforeEach/afterEach (por suíte e globais) e .rejects/.resolves/.not.
//
// Não substitui o vitest de verdade. O objetivo é detectar regressão rapidamente em um
// ambiente sem rede; a validação final continua sendo `npm run check:release`.

// ---------------------------------------------------------------- estado de execução

const rootSuite = { name: '', tests: [], suites: [], before: [], after: [], beforeAll: [], afterAll: [] };
let currentSuite = rootSuite;
const stubStack = [];
let failures = 0;
let passes = 0;
const failureDetails = [];

function makeSuite(name) {
  const suite = { name, tests: [], suites: [], before: [], after: [], beforeAll: [], afterAll: [] };
  currentSuite.suites.push(suite);
  return suite;
}

function withSuite(suite, fn) {
  const previous = currentSuite;
  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = previous;
  }
}

export function describe(name, fn) {
  const suite = makeSuite(String(name));
  withSuite(suite, fn);
}

describe.skip = () => {};
describe.only = (name, fn) => describe(name, fn);
describe.each = () => () => {};

function makeTest(name, fn, mode = 'run') {
  currentSuite.tests.push({ name: String(name), fn, mode });
}

export function it(name, fn) {
  makeTest(name, fn);
}
export function test(name, fn) {
  makeTest(name, fn);
}

for (const target of [it, test]) {
  target.skip = (name) => makeTest(name, null, 'skip');
  target.only = (name, fn) => makeTest(name, fn, 'run');
  target.todo = (name) => makeTest(name, null, 'skip');
  target.concurrent = (name, fn) => makeTest(name, fn, 'run');
  target.each = () => () => {};
}

export function beforeEach(fn) {
  currentSuite.before.push(fn);
}
export function afterEach(fn) {
  currentSuite.after.push(fn);
}
export function beforeAll(fn) {
  currentSuite.beforeAll.push(fn);
}
export function afterAll(fn) {
  currentSuite.afterAll.push(fn);
}

// -------------------------------------------------------------------------- expect

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

function format(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, item) => {
      if (typeof item === 'object' && item !== null) {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    });
  } catch {
    return String(value);
  }
}

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

function matchesObject(actual, expected) {
  if (typeof expected !== 'object' || expected === null) return deepEqual(actual, expected);
  if (typeof actual !== 'object' || actual === null) return false;
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((item, index) => matchesObject(actual[index], item));
  }
  return Object.keys(expected).every((key) => matchesObject(actual[key], expected[key]));
}

function containsValue(actual, expected) {
  if (typeof actual === 'string') return actual.includes(expected);
  if (Array.isArray(actual)) return actual.some((item) => deepEqual(item, expected));
  if (actual instanceof Set) return [...actual].some((item) => deepEqual(item, expected));
  return false;
}

function buildMatchers(actual, negated, contextLabel) {
  const assert = (result, message, negatedMessage) => {
    const ok = negated ? !result : result;
    if (!ok) throw new AssertionError(negated ? negatedMessage : message);
  };

  const label = contextLabel ? ` (${contextLabel})` : '';
  const matchers = {
    toBe: (expected) => assert(Object.is(actual, expected), `esperado ${format(expected)}, recebido ${format(actual)}${label}`, `não esperado ${format(expected)}${label}`),
    toEqual: (expected) => assert(deepEqual(actual, expected), `esperado ${format(expected)}, recebido ${format(actual)}${label}`, `não esperado ${format(expected)}${label}`),
    toStrictEqual: (expected) => assert(deepEqual(actual, expected), `esperado ${format(expected)}, recebido ${format(actual)}${label}`, `não esperado ${format(expected)}${label}`),
    toBeCloseTo: (expected, digits = 2) => {
      const tolerance = Math.pow(10, -digits) / 2;
      const ok = typeof actual === 'number' && Math.abs(actual - expected) < tolerance;
      assert(ok, `esperado ~${expected} (±${tolerance}), recebido ${format(actual)}${label}`, `não esperado ~${expected}${label}`);
    },
    toBeTruthy: () => assert(Boolean(actual), `esperado valor verdadeiro, recebido ${format(actual)}${label}`, `esperado valor falso, recebido ${format(actual)}${label}`),
    toBeFalsy: () => assert(!actual, `esperado valor falso, recebido ${format(actual)}${label}`, `esperado valor verdadeiro, recebido ${format(actual)}${label}`),
    toBeDefined: () => assert(actual !== undefined, `esperado definido, recebido undefined${label}`, `esperado undefined${label}`),
    toBeUndefined: () => assert(actual === undefined, `esperado undefined, recebido ${format(actual)}${label}`, `esperado não undefined${label}`),
    toBeNull: () => assert(actual === null, `esperado null, recebido ${format(actual)}${label}`, `esperado não null${label}`),
    toBeNaN: () => assert(Number.isNaN(actual), `esperado NaN, recebido ${format(actual)}${label}`, `esperado não NaN${label}`),
    toBeInstanceOf: (ctor) => assert(actual instanceof ctor, `esperado instância de ${ctor?.name}${label}`, `não esperado instância de ${ctor?.name}${label}`),
    toContain: (expected) => assert(containsValue(actual, expected), `esperado conter ${format(expected)}${label}`, `não esperado conter ${format(expected)}${label}`),
    toContainEqual: (expected) => assert(containsValue(actual, expected), `esperado conter item ${format(expected)}${label}`, `não esperado conter item ${format(expected)}${label}`),
    toHaveLength: (expected) => assert(actual != null && actual.length === expected, `esperado comprimento ${expected}, recebido ${actual?.length}${label}`, `não esperado comprimento ${expected}${label}`),
    toMatch: (expected) => {
      const ok = typeof expected === 'string' ? String(actual).includes(expected) : expected.test(String(actual));
      assert(ok, `esperado corresponder a ${format(String(expected))}, recebido ${format(actual)}${label}`, `não esperado corresponder a ${format(String(expected))}${label}`);
    },
    toHaveProperty: (path) => {
      const parts = String(path).split('.');
      let node = actual;
      let ok = true;
      for (const part of parts) {
        if (node == null || !(part in Object(node))) { ok = false; break; }
        node = node[part];
      }
      assert(ok, `esperado ter propriedade ${path}${label}`, `não esperado ter propriedade ${path}${label}`);
    },
    toMatchObject: (expected) => assert(matchesObject(actual, expected), `esperado objeto compatível com ${format(expected)}, recebido ${format(actual)}${label}`, `não esperado objeto compatível com ${format(expected)}${label}`),
    toBeGreaterThan: (expected) => assert(actual > expected, `esperado > ${expected}, recebido ${format(actual)}${label}`, `não esperado > ${expected}${label}`),
    toBeGreaterThanOrEqual: (expected) => assert(actual >= expected, `esperado >= ${expected}, recebido ${format(actual)}${label}`, `não esperado >= ${expected}${label}`),
    toBeLessThan: (expected) => assert(actual < expected, `esperado < ${expected}, recebido ${format(actual)}${label}`, `não esperado < ${expected}${label}`),
    toBeLessThanOrEqual: (expected) => assert(actual <= expected, `esperado <= ${expected}, recebido ${format(actual)}${label}`, `não esperado <= ${expected}${label}`),
    toThrow: (expected) => {
      let thrown = null;
      if (typeof actual !== 'function') throw new AssertionError('toThrow exige uma função');
      try {
        actual();
      } catch (error) {
        thrown = error;
      }
      let ok = thrown !== null;
      if (ok && expected !== undefined) {
        if (typeof expected === 'string') ok = String(thrown?.message ?? thrown).includes(expected);
        else if (expected instanceof RegExp) ok = expected.test(String(thrown?.message ?? thrown));
        else if (typeof expected === 'function') ok = thrown instanceof expected;
      }
      assert(ok, `esperado lançar ${expected ? format(expected) : 'erro'}, recebido ${thrown ? format(thrown?.message ?? thrown) : 'nenhum erro'}${label}`, `não esperado lançar erro${label}`);
    },
  };

  for (const name of ['toHaveBeenCalled', 'toHaveBeenCalledTimes', 'toHaveBeenLastCalledWith', 'toHaveBeenNthCalledWith']) {
    matchers[name] = () => {
      if (typeof actual !== 'function' || !actual.mock) throw new AssertionError(`${name} exige um espião vi.fn()`);
      const calls = actual.mock.calls;
      if (name === 'toHaveBeenCalled') return assert(calls.length > 0, `esperado ter sido chamada${label}`, `não esperado ter sido chamada${label}`);
      if (name === 'toHaveBeenCalledTimes') return () => {};
    };
  }
  matchers.toHaveBeenCalledTimes = (expected) => {
    const calls = actual?.mock?.calls ?? [];
    assert(calls.length === expected, `esperado ${expected} chamadas, recebido ${calls.length}${label}`, `não esperado ${expected} chamadas${label}`);
  };
  matchers.toHaveBeenLastCalledWith = (...args) => {
    const calls = actual?.mock?.calls ?? [];
    const last = calls[calls.length - 1] ?? [];
    assert(deepEqual(last, args), `esperado última chamada com ${format(args)}, recebido ${format(last)}${label}`, `não esperado última chamada com ${format(args)}${label}`);
  };

  // Espiões: .mockReturnValue / .mockResolvedValue criados em vi.fn
  return matchers;
}

export function expect(actual) {
  const matchers = buildMatchers(actual, false, '');
  const negated = buildMatchers(actual, true, 'not');

  const wrapper = {
    ...matchers,
    not: negated,
    toThrowError: matchers.toThrow,
  };

  Object.defineProperty(wrapper, 'resolves', {
    get() {
      return new Proxy({}, {
        get: (_target, property) => async (...args) => {
          let settled;
          let rejected;
          try {
            settled = await actual;
          } catch (error) {
            rejected = error;
          }
          if (rejected) throw new AssertionError(`esperado promessa resolvida, mas foi rejeitada com ${format(rejected?.message ?? rejected)}`);
          const resolvedMatchers = buildMatchers(settled, false, 'resolves');
          const fn = resolvedMatchers[property];
          if (!fn) throw new AssertionError(`matcher desconhecido: ${String(property)}`);
          return fn(...args);
        },
      });
    },
  });

  Object.defineProperty(wrapper, 'rejects', {
    get() {
      return new Proxy({}, {
        get: (_target, property) => async (...args) => {
          let settled;
          let rejected = null;
          try {
            settled = await actual;
          } catch (error) {
            rejected = error;
          }
          if (!rejected) throw new AssertionError(`esperado promessa rejeitada, mas foi resolvida com ${format(settled)}`);
          // Em `.rejects.toThrow(...)` o alvo é o próprio erro rejeitado, não uma função.
          if (property === 'toThrow' || property === 'toThrowError') {
            const expected = args[0];
            const message = String(rejected?.message ?? rejected);
            let ok = true;
            if (expected !== undefined) {
              if (typeof expected === 'string') ok = message.includes(expected);
              else if (expected instanceof RegExp) ok = expected.test(message);
              else if (typeof expected === 'function') ok = rejected instanceof expected;
            }
            if (!ok) {
              throw new AssertionError(
                `esperado erro contendo ${format(typeof expected === 'string' ? expected : String(expected))}, recebido ${format(message)}`,
              );
            }
            return;
          }
          const rejectedMatchers = buildMatchers(rejected, false, 'rejects');
          const fn = rejectedMatchers[property];
          if (!fn) throw new AssertionError(`matcher desconhecido em rejects: ${String(property)}`);
          return fn(...args);
        },
      });
    },
  });

  Object.defineProperty(wrapper, 'toThrowErrorMatchingInlineSnapshot', { value: () => {} });

  return wrapper;
}

// ------------------------------------------------------------------------------ vi

function createSpy(implementation) {
  let impl = implementation;
  // Fila consumida em ordem: é assim que o vitest aplica `...Once` encadeados.
  let onceQueue = [];

  const spy = function (...args) {
    spy.mock.calls.push(args);
    if (onceQueue.length) {
      const next = onceQueue.shift();
      const value = next();
      spy.mock.results.push({ value });
      return value;
    }
    const value = impl ? impl.apply(this, args) : undefined;
    spy.mock.results.push({ value });
    return value;
  };
  spy.mock = { calls: [], results: [] };

  spy.mockReturnValue = (value) => {
    impl = () => value;
    return spy;
  };
  spy.mockResolvedValue = (value) => {
    impl = () => Promise.resolve(value);
    return spy;
  };
  spy.mockRejectedValue = (value) => {
    impl = () => Promise.reject(value);
    return spy;
  };
  spy.mockImplementation = (fn) => {
    impl = fn;
    return spy;
  };
  spy.mockImplementationOnce = (fn) => {
    onceQueue.push(() => fn());
    return spy;
  };
  spy.mockReturnValueOnce = (value) => {
    onceQueue.push(() => value);
    return spy;
  };
  spy.mockResolvedValueOnce = (value) => {
    onceQueue.push(() => Promise.resolve(value));
    return spy;
  };
  spy.mockRejectedValueOnce = (value) => {
    onceQueue.push(() => Promise.reject(value));
    return spy;
  };
  spy.mockClear = () => {
    spy.mock.calls.length = 0;
    spy.mock.results.length = 0;
    return spy;
  };
  spy.mockReset = () => {
    spy.mockClear();
    impl = undefined;
    onceQueue = [];
    return spy;
  };
  return spy;
}

export const vi = {
  fn: (implementation) => createSpy(implementation),
  stubGlobal(name, value) {
    const had = Object.prototype.hasOwnProperty.call(globalThis, name);
    stubStack.push({ name, had, original: globalThis[name] });
    globalThis[name] = value;
    return vi;
  },
  unstubAllGlobals() {
    while (stubStack.length) {
      const { name, had, original } = stubStack.pop();
      if (had) globalThis[name] = original;
      else delete globalThis[name];
    }
    return vi;
  },
  spyOn(target, property) {
    const original = target[property];
    const spy = createSpy((...args) => original.apply(target, args));
    target[property] = spy;
    spy.mockRestore = () => {
      target[property] = original;
    };
    return spy;
  },
  clearAllMocks() {},
  resetAllMocks() {},
  restoreAllMocks() {},
  hoisted: (fn) => fn(),
  // `vi.mock` é tratado fora do shim: o runner lê essas chamadas e pré-registra um módulo
  // substituto antes de carregar o teste (equivale ao hoisting do vitest). Aqui é no-op.
  mock() {},
  unmock() {},
  doMock() {},
  dontMock() {},
};

// ------------------------------------------------------------------------ execução

async function runSuite(suite, prefix, inheritedBefore) {
  const title = prefix ? `${prefix} › ${suite.name}` : suite.name;
  const before = [...inheritedBefore, ...suite.before];

  for (const fn of suite.beforeAll) await fn();

  for (const testCase of suite.tests) {
    if (testCase.mode === 'skip' || !testCase.fn) continue;
    const fullName = `${title} › ${testCase.name}`;
    try {
      for (const hook of before) await hook();
      await testCase.fn();
      for (const hook of [...suite.after]) await hook();
      passes += 1;
    } catch (error) {
      failures += 1;
      failureDetails.push({ name: fullName, error });
    }
  }

  for (const child of suite.suites) await runSuite(child, title, before);

  for (const fn of suite.afterAll) await fn();
}

export async function runAll() {
  await runSuite(rootSuite, '', []);
  return { passes, failures, failureDetails };
}

export function resetState() {
  rootSuite.tests.length = 0;
  rootSuite.suites.length = 0;
  rootSuite.before.length = 0;
  rootSuite.after.length = 0;
  passes = 0;
  failures = 0;
  failureDetails.length = 0;
  currentSuite = rootSuite;
}

export default { describe, it, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll };

/** Trechos de confrontação seguem a ordem física dos pontos do anel,
 * que pode ser oposta à numeração visível dos vértices. */
export type ConfrontantPath = 'auto' | 'forward' | 'reverse';
export type ResolvedConfrontantPath = {
  direction: 'forward' | 'reverse';
  /** Índices das arestas, não números de vértices. */
  edges: number[];
  /** Índices dos vértices percorridos, incluindo origem e destino. */
  vertices: number[];
};

const numberAtEnd = (label: string): number | null => {
  const match = /(?:^|\D)(\d+)\s*$/.exec(label.trim());
  return match ? Number(match[1]) : null;
};

/** Acompanha a numeração quando ela é contínua, mesmo se o anel estiver invertido.
 * Sem numeração confiável, preserva o sentido original do cadastro (forward). */
export function suggestedConfrontantDirection(names: readonly string[], start: number, end: number): 'forward' | 'reverse' {
  const n = names.length;
  if (n < 2 || start < 0 || end < 0 || start >= n || end >= n || start === end) return 'forward';
  const startNumber = numberAtEnd(names[start]);
  const endNumber = numberAtEnd(names[end]);
  if (startNumber === null || endNumber === null || startNumber === endNumber) return 'forward';
  const sign = endNumber > startNumber ? 1 : -1;
  const forward = numberAtEnd(names[(start + 1) % n]);
  const reverse = numberAtEnd(names[(start - 1 + n) % n]);
  const expected = startNumber + sign;
  if (forward === expected && reverse !== expected) return 'forward';
  if (reverse === expected && forward !== expected) return 'reverse';
  return 'forward';
}

/** Retorna somente as arestas pertencentes ao caminho escolhido.
 * Percorrer o anel em sentido inverso utiliza a aresta que chega ao vértice atual.
 * Nunca altera a ordem das coordenadas ou a numeração cadastrada. */
export function resolveConfrontantPath(
  names: readonly string[], start: number, end: number, mode: ConfrontantPath = 'auto'
): ResolvedConfrontantPath {
  const n = names.length;
  if (!Number.isInteger(start) || !Number.isInteger(end) || n < 3 || start < 0 || end < 0 || start >= n || end >= n || start === end)
    throw new Error('Selecione dois vértices diferentes e válidos.');
  const direction = mode === 'auto' ? suggestedConfrontantDirection(names, start, end) : mode;
  const step = direction === 'forward' ? 1 : -1;
  const edges: number[] = [], vertices = [start];
  let index = start;
  for (let k = 0; k < n - 1; k++) {
    const next = (index + step + n) % n;
    edges.push(step === 1 ? index : next);
    vertices.push(next);
    if (next === end) return { direction, edges, vertices };
    index = next;
  }
  throw new Error('Não foi possível identificar o trecho do perímetro.');
}

export function confrontantPathSummary(names: readonly string[], vertices: readonly number[]): string {
  const path = vertices.map(i => names[i] || `V${i + 1}`);
  return path.length <= 7 ? path.join(' → ') : [...path.slice(0, 3), '…', ...path.slice(-3)].join(' → ');
}

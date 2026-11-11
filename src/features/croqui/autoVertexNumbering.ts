/** Numeração somente nominal, sem modificar os pontos nem a ordem geométrica do imóvel. */
import type { Vertex } from '../memorial/memorialEngine';

export type NumberingDirection = 'sequence' | 'clockwise' | 'counterclockwise';
export type VertexKind = 'V' | 'M' | 'P';
export type NumberingOptions = {
  code: string;
  kind: VertexKind;
  firstNumber: number;
  digits: number;
  startingVertex: number;
  direction: NumberingDirection;
};
export type NumberingPreview = { names: string[]; orderedIndices: number[] };

/** Retorna o sentido do caminhamento cartográfico, com longitude no eixo X e latitude no Y. */
export function polygonOrientation(vertices: Vertex[]): 'clockwise' | 'counterclockwise' | null {
  if (vertices.length < 3) return null;
  const [x0, y0] = vertices[0];
  let doubleArea = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    if (![...a, ...b].every(Number.isFinite) || Math.abs(b[0] - a[0]) > 180) return null;
    doubleArea += (a[0] - x0) * (b[1] - y0) - (b[0] - x0) * (a[1] - y0);
  }
  if (Math.abs(doubleArea) < 1e-16) return null;
  return doubleArea < 0 ? 'clockwise' : 'counterclockwise';
}

export function autoNumberVertices(vertices: Vertex[], options: NumberingOptions): NumberingPreview {
  const count = vertices.length;
  if (count < 3) throw new Error('Selecione um polígono com três ou mais vértices.');
  const code = options.code.trim().toUpperCase();
  if (code && !/^[A-Z0-9]{2,15}$/.test(code)) throw new Error('O código deve ter 2 a 15 letras ou números, sem espaços.');
  if (!['V', 'M', 'P'].includes(options.kind)) throw new Error('Selecione um tipo de identificação válido.');
  if (!Number.isInteger(options.firstNumber) || options.firstNumber < 1 || options.firstNumber + count - 1 > 999999999)
    throw new Error('Informe uma numeração inicial válida.');
  if (!Number.isInteger(options.digits) || options.digits < 2 || options.digits > 8)
    throw new Error('Escolha de 2 a 8 dígitos para a numeração.');
  if (!Number.isInteger(options.startingVertex) || options.startingVertex < 0 || options.startingVertex >= count)
    throw new Error('Selecione um vértice inicial válido.');
  if (!['sequence', 'clockwise', 'counterclockwise'].includes(options.direction))
    throw new Error('Selecione um sentido válido.');

  const storedDirection = polygonOrientation(vertices);
  if (options.direction !== 'sequence' && !storedDirection)
    throw new Error('Não foi possível determinar o sentido do perímetro. Confira as coordenadas.');
  const step = options.direction === 'sequence' || options.direction === storedDirection ? 1 : -1;
  const names = Array<string>(count);
  const orderedIndices: number[] = [];
  for (let k = 0; k < count; k++) {
    const i = (options.startingVertex + step * k + count) % count;
    const name = `${code ? `${code}-` : ''}${options.kind}-${String(options.firstNumber + k).padStart(options.digits, '0')}`;
    names[i] = name;
    orderedIndices.push(i);
  }
  return { names, orderedIndices };
}

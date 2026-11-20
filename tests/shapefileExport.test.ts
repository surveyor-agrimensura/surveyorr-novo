import { describe, expect, it, vi } from 'vitest';
import type { Feature, Geometry } from 'geojson';
import { downloadBlob } from '../src/features/map/mapFormats';
import { toShapefileZip } from '../src/features/map/shapefileExport';

const polygon: Feature<Geometry, Record<string, unknown>> = {
  type: 'Feature',
  id: 'lote-ba-1',
  properties: { name: 'Fazenda Boa Vista', category: 'Imóvel rural', municipio: 'Amargosa', uf: 'BA' },
  geometry: { type: 'Polygon', coordinates: [[[-39.65, -13.05], [-39.64, -13.05], [-39.64, -13.04], [-39.65, -13.05]]] },
};

function unzipStored(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('ZIP central directory is missing.');
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('Invalid ZIP entry.');
    const method = view.getUint16(cursor + 10, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (method !== 0 || view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Unsupported ZIP encoding.');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const size = view.getUint32(localOffset + 22, true);
    const dataAt = localOffset + 30 + localNameLength + localExtraLength;
    files.set(name, bytes.slice(dataAt, dataAt + size));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

describe('exportação Shapefile', () => {
  it('gera um pacote SEIA/CEFIR com os quatro arquivos vetoriais e os campos de imóvel', () => {
    const files = unzipStored(toShapefileZip([polygon], 'seia-cefir-ba'));
    expect([...files.keys()].sort()).toEqual([
      'shapeImovelRural.dbf', 'shapeImovelRural.prj', 'shapeImovelRural.shp', 'shapeImovelRural.shx',
    ]);
    const dbf = files.get('shapeImovelRural.dbf')!;
    const dbfView = new DataView(dbf.buffer, dbf.byteOffset, dbf.byteLength);
    expect(dbfView.getUint32(4, true)).toBe(1);
    const fieldNames = Array.from({ length: 8 }, (_, index) => new TextDecoder().decode(dbf.subarray(32 + index * 32, 32 + index * 32 + 11)).replace(/\0.*$/, ''));
    expect(fieldNames).toEqual(['ID', 'NOME', 'CATEGORIA', 'MUNICIPIO', 'UF', 'AREA_HA', 'PERIM_M', 'VERTICES']);
    const prj = new TextDecoder().decode(files.get('shapeImovelRural.prj'));
    expect(prj).toContain('SIRGAS 2000');
    expect(files.get('shapeImovelRural.shp')!.byteLength).toBeGreaterThan(100);
  });

  it('recusa geometria multipart no perfil SEIA e permite exportá-la em perfil SIG', () => {
    const multipart = { ...polygon, geometry: { type: 'MultiPolygon', coordinates: [polygon.geometry.type === 'Polygon' ? polygon.geometry.coordinates : [], polygon.geometry.type === 'Polygon' ? polygon.geometry.coordinates : []] } } as Feature<Geometry, Record<string, unknown>>;
    expect(() => toShapefileZip([multipart], 'seia-cefir-ba')).toThrow(/perímetro poligonal simples/i);
    expect(unzipStored(toShapefileZip([multipart], 'qgis-arcgis')).has('poligonos.shp')).toBe(true);
  });

  it('não inicia um download Shapefile vazio ou de uma geometria incompatível', () => {
    const point: Feature<Geometry, Record<string, unknown>> = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [-39.65, -13.05] } };
    expect(() => toShapefileZip([point], 'seia-cefir-ba')).toThrow(/Selecione um polígono/i);
  });

  it('aciona o link de download anexado e mantém a URL viva até o navegador iniciar o arquivo', () => {
    vi.useFakeTimers();
    const sequence: string[] = [];
    const anchor = { href: '', download: '', style: { display: '' }, click: vi.fn(() => sequence.push('click')), remove: vi.fn(() => sequence.push('remove')) };
    const body = { appendChild: vi.fn(() => { sequence.push('append'); return anchor; }) };
    vi.stubGlobal('document', { body, documentElement: body, createElement: vi.fn(() => anchor) });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const blob = new Blob(['valid zip bytes']);

    downloadBlob('arquivo.zip', blob);

    expect(sequence).toEqual(['append', 'click', 'remove']);
    expect(anchor.download).toBe('arquivo.zip');
    vi.advanceTimersByTime(9_999);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith('blob:test');
  });
});

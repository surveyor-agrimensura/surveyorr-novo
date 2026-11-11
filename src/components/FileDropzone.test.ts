import { describe, expect, it } from 'vitest';
import { formatFileSize, validateUploadFile } from './FileDropzone';

function file(name: string, size: number, type: string) {
  return { name, size, type } as File;
}

describe('FileDropzone validation helpers', () => {
  it('accepts allowed extensions and exact MIME types', () => {
    expect(validateUploadFile(file('perimetro.GEOJSON', 20, ''), '.geojson,.json,application/json', 100)).toBeNull();
    expect(validateUploadFile(file('imagem.bin', 20, 'image/png'), 'image/png,image/jpeg', 100)).toBeNull();
  });

  it('supports MIME wildcards and rejects unsupported formats', () => {
    expect(validateUploadFile(file('mapa.webp', 20, 'image/webp'), 'image/*', 100)).toBeNull();
    expect(validateUploadFile(file('mapa.pdf', 20, 'application/pdf'), '.geojson,.json', 100)).toContain('Formato não aceito');
  });

  it('rejects files larger than the configured byte limit', () => {
    expect(validateUploadFile(file('grande.csv', 101, 'text/csv'), '.csv,text/csv', 100)).toContain('100 B');
    expect(validateUploadFile(file('no-limite.csv', 100, 'text/csv'), '.csv,text/csv', 100)).toBeNull();
  });

  it('formats sizes without inventing decimal precision', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1_572_864)).toBe('1,5 MB');
  });
});

import { describe, expect, it } from 'vitest';
import { formatFileSize, validateUploadFiles } from '../src/components/fileUploadValidation';

const file = (name: string, type: string, size = 12) => new File(['x'.repeat(size)], name, { type });

describe('validação dos arquivos selecionados', () => {
  it('aceita extensão permitida mesmo quando o navegador não informa MIME', () => {
    expect(validateUploadFiles([file('levantamento.KML', '')], { accept: '.kml' })).toEqual([]);
  });

  it('rejeita tipo MIME e extensão fora da lista', () => {
    expect(validateUploadFiles([file('levantamento.txt', 'text/plain')], { accept: '.kml,application/geo+json' })[0]?.message)
      .toBe('Formato de arquivo não permitido.');
  });

  it('rejeita arquivos acima do limite configurado', () => {
    expect(validateUploadFiles([file('dados.json', 'application/json', 9)], { accept: '.json', maxBytes: 8 })[0]?.message)
      .toContain('excede o limite');
  });

  it('aplica quantidade máxima e modo de arquivo único', () => {
    const files = [file('a.png', 'image/png'), file('b.png', 'image/png')];
    expect(validateUploadFiles(files, { accept: 'image/*', multiple: true, maxFiles: 1 })).toHaveLength(1);
    expect(validateUploadFiles(files, { accept: 'image/*' })).toHaveLength(2);
  });

  it('formata tamanhos sem divulgar percentuais de progresso', () => {
    expect(formatFileSize(320)).toBe('320 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
  });
});

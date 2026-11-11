import { describe, expect, it } from 'vitest';
import { buildConfrontationLettersHtml, safeLetterLogoSource } from '../src/features/documents/confrontationLetterHtml';

describe('HTML das cartas de confrontação em lote', () => {
  it('escapa campos editáveis e recusa origem de logotipo executável', () => {
    const html = buildConfrontationLettersHtml({
      choices: [{
        name: '</strong><img src=x onerror="alert(1)">',
        cpf: '',
        from: 'V-01',
        to: 'V-02',
        boundary: '<svg onload="alert(2)">',
        polygonName: '<script>alert(3)</script>'
      }],
      polygonCount: 2,
      baseTitle: '<script>alert(4)</script>',
      fields: {
        location: '<img src=x onerror="alert(5)">',
        date: 'data',
        name: 'nome manual',
        cpf: '',
        from: '',
        to: '',
        boundary: '',
        notes: '</p><script>alert(6)</script><p>',
        owner: '<b>proprietário</b>',
        property: '<i>imóvel</i>',
        technician: '<svg onload="alert(7)">',
        registry: 'registro',
        company: '<img src=x onerror="alert(8)">',
        companyAddress: '<script>alert(9)</script>'
      },
      logo: 'javascript:alert(10)',
      docCss: 'body{}',
      formatDate: () => '<svg onload="alert(11)">'
    });

    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/<img\s+src=x/i);
    expect(html).not.toMatch(/<svg\b/i);
    expect(html).toContain('&lt;script&gt;alert(3)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(5)&quot;&gt;');
    expect(html).toContain('src="/brand/agr-logo-referencia.png"');
  });

  it('mantém logos raster locais e em data URL permitidos', () => {
    expect(safeLetterLogoSource('data:image/png;base64,aGVsbG8=')).toBe('data:image/png;base64,aGVsbG8=');
    expect(safeLetterLogoSource('/brand/logo-projeto.webp')).toBe('/brand/logo-projeto.webp');
    expect(safeLetterLogoSource('/../fora.png')).toBe('/brand/agr-logo-referencia.png');
  });
});

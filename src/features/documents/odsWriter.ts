/** Escrita ODF mínima, totalmente client-side e sem conversão de XLSX. */
export type OdsSheet = { name: string; rows: (string | number | null)[][] };
export type OdsAppearance = {
  headerColor: string;
  cellColor: string;
  borderColor: string;
  cellColors: Record<string, string>;
};

const escape = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const text = new TextEncoder();
const safeColor = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

function zipStore(items: { name: string; data: Uint8Array }[]): Blob {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const checksum = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const pack = (size: number, write: (view: DataView) => void) => {
    const bytes = new Uint8Array(size);
    write(new DataView(bytes.buffer));
    return bytes;
  };

  for (const item of items) {
    const filename = text.encode(item.name);
    const size = item.data.length;
    const crc = checksum(item.data);
    const header = pack(30, view => {
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true); view.setUint32(14, crc, true); view.setUint32(18, size, true);
      view.setUint32(22, size, true); view.setUint16(26, filename.length, true);
    });
    parts.push(header, filename, item.data);
    const directory = pack(46, view => {
      view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true); view.setUint32(16, crc, true); view.setUint32(20, size, true);
      view.setUint32(24, size, true); view.setUint16(28, filename.length, true); view.setUint32(42, offset, true);
    });
    central.push(directory, filename);
    offset += header.length + filename.length + size;
  }

  const centralLength = central.reduce((sum, item) => sum + item.length, 0);
  const footer = pack(22, view => {
    view.setUint32(0, 0x06054b50, true); view.setUint16(8, items.length, true); view.setUint16(10, items.length, true);
    view.setUint32(12, centralLength, true); view.setUint32(16, offset, true);
  });
  const chunks = [...parts, ...central, footer];
  const result = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let cursor = 0;
  for (const chunk of chunks) { result.set(chunk, cursor); cursor += chunk.byteLength; }
  return new Blob([result.buffer], { type: 'application/vnd.oasis.opendocument.spreadsheet' });
}

export function generateOds(sheets: OdsSheet[], appearance?: OdsAppearance): Blob {
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="META-INF/manifest.xml" manifest:media-type="text/xml"/></manifest:manifest>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2"><office:styles><style:style style:name="Default" style:family="table-cell"><style:text-properties fo:font-family="Arial" fo:font-size="10pt"/></style:style></office:styles></office:document-styles>`;

  const styleNames = new Map<string, string>();
  const styleXml: string[] = [];
  const styleFor = (sheetIndex: number, rowIndex: number, columnIndex: number) => {
    if (!appearance) return '';
    const key = `${sheetIndex}:${rowIndex}:${columnIndex}`;
    const fill = safeColor(appearance.cellColors[key] || (rowIndex === 0 ? appearance.headerColor : appearance.cellColor), '#ffffff');
    const border = safeColor(appearance.borderColor, '#dbe4ed');
    const isHeader = rowIndex === 0;
    const signature = `${fill}|${border}|${isHeader}`;
    let name = styleNames.get(signature);
    if (!name) {
      name = `SurveyorCell${styleNames.size + 1}`;
      styleNames.set(signature, name);
      styleXml.push(`<style:style style:name="${name}" style:family="table-cell"><style:table-cell-properties fo:background-color="${fill}" fo:border="0.5pt solid ${border}" fo:padding="0.06in"/><style:text-properties fo:font-weight="${isHeader ? 'bold' : 'normal'}"/></style:style>`);
    }
    return name;
  };

  const tables = sheets.map((sheet, sheetIndex) => `<table:table table:name="${escape(sheet.name)}">${sheet.rows.map((row, rowIndex) => `<table:table-row>${row.map((cell, columnIndex) => {
    const style = styleFor(sheetIndex, rowIndex, columnIndex);
    const styleAttribute = style ? ` table:style-name="${style}"` : '';
    return typeof cell === 'number' && Number.isFinite(cell)
      ? `<table:table-cell${styleAttribute} office:value-type="float" office:value="${cell}"><text:p>${escape(cell.toLocaleString('pt-BR', { maximumFractionDigits: 8 }))}</text:p></table:table-cell>`
      : `<table:table-cell${styleAttribute} office:value-type="string"><text:p>${escape(cell)}</text:p></table:table-cell>`;
  }).join('')}</table:table-row>`).join('')}</table:table>`).join('');
  const automaticStyles = styleXml.join('');
  const content = `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:automatic-styles>${automaticStyles}</office:automatic-styles><office:body><office:spreadsheet>${tables}</office:spreadsheet></office:body></office:document-content>`;
  return zipStore([
    { name: 'mimetype', data: text.encode('application/vnd.oasis.opendocument.spreadsheet') },
    { name: 'content.xml', data: text.encode(content) },
    { name: 'styles.xml', data: text.encode(styles) },
    { name: 'META-INF/manifest.xml', data: text.encode(manifest) }
  ]);
}

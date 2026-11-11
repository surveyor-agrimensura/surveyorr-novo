import { formatBrazilianDocument } from '../../lib/documentIdentity';

export type ConfrontationLetterChoice = {
  name: string;
  cpf: string;
  from: string;
  to: string;
  boundary: string;
  polygonName?: string;
};

export type ConfrontationLetterFields = {
  location: string;
  date: string;
  name: string;
  cpf: string;
  from: string;
  to: string;
  boundary: string;
  notes: string;
  owner: string;
  property: string;
  technician: string;
  registry: string;
  company: string;
  companyAddress: string;
};

export function escapeLetterHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] || character);
}

export function safeLetterLogoSource(value: unknown): string {
  const source = String(value ?? '').trim();
  if (source.length <= 2_800_000 && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+={0,2}$/i.test(source)) return source;
  if (source.startsWith('/') && !source.startsWith('//') && !source.split('/').includes('..') && /^\/[a-z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(source)) return source;
  return '/brand/agr-logo-referencia.png';
}

export function buildConfrontationLettersHtml({
  choices,
  polygonCount,
  baseTitle,
  fields,
  logo,
  docCss,
  formatDate
}: {
  choices: readonly ConfrontationLetterChoice[];
  polygonCount: number;
  baseTitle: string;
  fields: ConfrontationLetterFields;
  logo: string;
  docCss: string;
  formatDate: (raw: string) => string;
}): string {
  const safeLogo = escapeLetterHtml(safeLetterLogoSource(logo));
  const pages = choices.map(choice => {
    const propertyName = polygonCount > 1 && choice.polygonName
      ? `${baseTitle} — ${choice.polygonName}`
      : fields.property || baseTitle;
    const cpfPart = choice.cpf.trim()
      ? `, inscrito(a) no CPF/CNPJ sob o nº <strong>${escapeLetterHtml(formatBrazilianDocument(choice.cpf))}</strong>,`
      : ',';
    const boundary = choice.boundary === 'Não informado' ? fields.boundary : choice.boundary;
    const technician = fields.technician.trim()
      ? `<strong>Responsável técnico:</strong> ${escapeLetterHtml(fields.technician)} ${fields.registry ? `— ${escapeLetterHtml(fields.registry)}` : ''}`
      : '';

    return `<div class="letter-page">
      <header class="letter-header"><img alt="Logotipo da empresa" src="${safeLogo}"/><div class="letter-company">${escapeLetterHtml(fields.company || 'SURVEYOR')}<div class="letter-address">${escapeLetterHtml(fields.companyAddress)}</div></div></header>
      <div class="letter-title">CARTA DE CONFRONTAÇÃO</div>
      <section class="letter-text">
        <p>Eu, <strong>${escapeLetterHtml(choice.name || '________________________________')}</strong>${cpfPart} declaro, para os devidos fins, que fui cientificado(a) acerca dos limites do imóvel rural <strong>${escapeLetterHtml(propertyName)}</strong>, de responsabilidade de <strong>${escapeLetterHtml(fields.owner)}</strong>, situado em <strong>${escapeLetterHtml(fields.location)}</strong>.</p>
        <p>O trecho confrontado corresponde a <strong>${escapeLetterHtml(choice.from)} a ${escapeLetterHtml(choice.to)}</strong>, tendo como referência de limite: <strong>${escapeLetterHtml(boundary)}</strong>.</p>
        ${fields.notes ? `<p class="letter-notes">${escapeLetterHtml(fields.notes)}</p>` : ''}
      </section>
      <div class="letter-date">${escapeLetterHtml(fields.location || 'Local da emissão')}, ${escapeLetterHtml(formatDate(fields.date))}.</div>
      <div class="letter-sign"><div class="line"></div><strong>${escapeLetterHtml(choice.name || 'Nome do confrontante')}</strong><div>Confrontante</div></div>
      <footer class="letter-footer">${technician}</footer>
    </div>`;
  }).join('');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Cartas de Confrontação — 1 por 1</title><style>${docCss}</style></head><body>${pages}</body></html>`;
}

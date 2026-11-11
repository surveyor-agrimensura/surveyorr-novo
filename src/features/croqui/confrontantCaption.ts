import {formatBrazilianDocument} from '../../lib/documentIdentity';
/** Apresentação visual de confrontantes: um nome e um documento por linha. */
export type CaptionDetails={property?:string;owner?:string;cpf?:string};
export function confrontantCaption(raw:string,details:CaptionDetails={}):{name:string;cpf:string;text:string}{
 const original=String(raw||'').trim();
 const cpfPattern=/\b(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{14})\b/;
 const discovered=original.match(cpfPattern)?.[0]||'';
 const cpf=formatBrazilianDocument(String(details.cpf||'').trim()||discovered);
 const parts=[String(details.property||'').trim(),String(details.owner||'').trim()].filter(Boolean);
 const name=parts.length?parts.join(' · '):original
  .replace(/\s*·?\s*CPF\/CNPJ:?\s*(?:\d[.\/\-]?)+/gi,'')
  .replace(/\s*·\s*(?:\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11}|\d{14})/g,'').trim();
 return {name,cpf,text:[name,cpf?`CPF/CNPJ: ${cpf}`:''].filter(Boolean).join('\n')};
}

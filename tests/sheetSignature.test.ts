import {describe,expect,it} from 'vitest';
import {defaultSheet,normalizeSheet} from '../src/features/documents/technicalSheet';
import {isSheetSignatureImage,resolveSheetSignature} from '../src/features/documents/sheetSignature';

const accountA='data:image/png;base64,YWJjZA==';
const accountB='data:image/png;base64,YWJjZGU=';
const replacement='data:image/jpeg;base64,Zm9v';

describe('assinatura da conta nas pranchas',()=>{
 it('adota a assinatura da conta inclusive em pranchas antigas sem imagem',()=>{
  const old=normalizeSheet({title:'Prancha antiga',signatureEnabled:false,signature:''});
  expect(old.signatureSource).toBe('account');
  const sheet=resolveSheetSignature(old,accountA);
  expect(sheet.signature).toBe(accountA);
  expect(sheet.signatureEnabled).toBe(true);
 });
 it('usa sempre a assinatura atualizada do perfil, sem copiar para o rascunho',()=>{
  const original=defaultSheet();
  expect(resolveSheetSignature(original,accountA).signature).toBe(accountA);
  expect(resolveSheetSignature(original,accountB).signature).toBe(accountB);
  expect(original.signature).toBe('');
 });
 it('respeita a assinatura exclusiva de uma prancha',()=>{
  const sheet=normalizeSheet({signature:replacement,signatureEnabled:true});
  expect(sheet.signatureSource).toBe('custom');
  expect(resolveSheetSignature(sheet,accountA).signature).toBe(replacement);
 });
 it('respeita a decisão de ocultar assinatura só nesta prancha',()=>{
  const sheet=normalizeSheet({signatureSource:'none',signatureEnabled:false,signature:''});
  expect(resolveSheetSignature(sheet,accountA).signatureEnabled).toBe(false);
  expect(resolveSheetSignature(sheet,accountA).signature).toBe('');
 });
 it('não mostra assinatura inexistente nem URL não verificada',()=>{
  const sheet=defaultSheet();
  expect(resolveSheetSignature(sheet,'https://example.com/image.png').signatureEnabled).toBe(false);
  expect(isSheetSignatureImage(accountA)).toBe(true);
  expect(isSheetSignatureImage('javascript:alert(1)')).toBe(false);
 });
});

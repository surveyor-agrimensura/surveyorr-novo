import {describe,expect,it} from 'vitest';
import {defaultSheet,sheetSignatureBox,clampSheetSignatureOffset,normalizeSheet} from '../src/features/documents/technicalSheet';

describe('assinatura técnica acima da prancha',()=>{
 it('calcula o mesmo retângulo para prévia e exportação SVG',()=>{
  const settings={...defaultSheet(),signatureSize:110,signatureOffsetX:-380,signatureOffsetY:310};
  const box=sheetSignatureBox(settings);
  expect(box.x).toBeCloseTo(1240-110*2.3/2-380);
  expect(box.y).toBe(790);
  expect(box.height).toBeCloseTo(99);
 });
 it('não corta o deslocamento vertical antigo em 240 unidades',()=>{
  const sheet=normalizeSheet({...defaultSheet(),signatureOffsetY:310,signatureOffsetX:-700});
  expect(sheet.signatureOffsetY).toBe(310);
  expect(sheet.signatureOffsetX).toBe(-700);
 });
 it('mantém a assinatura na folha, inclusive junto à planta de situação',()=>{
  const settings={...defaultSheet(),signatureSize:130};
  const off=clampSheetSignatureOffset(settings,-1000,500);
  const box=sheetSignatureBox({...settings,...off});
  expect(box.x).toBeGreaterThanOrEqual(18);
  expect(box.y).toBeGreaterThanOrEqual(18);
  expect(box.x+box.width).toBeLessThanOrEqual(1582);
  expect(box.y+box.height).toBeLessThanOrEqual(974);
 });
});

import {describe,expect,it} from 'vitest';
import {qrCodeDataUrl} from '../src/lib/qrCode';

describe('QR de compartilhamento local',()=>{
 it('gera imagem QR em memória sem chamar serviço externo',()=>{
  expect(qrCodeDataUrl('https://surveyor.example/publico/imovel/?dados=coordenadas')).toMatch(/^data:image\/gif;base64,/);
 });
 it('devolve vazio para links maiores que a capacidade do padrão QR',()=>{
  expect(qrCodeDataUrl('x'.repeat(10000))).toBe('');
 });
});

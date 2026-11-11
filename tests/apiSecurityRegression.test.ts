import {describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {googleDriveConnectErrorPage} from '../functions/surveyor-api/src/security/html.js';
import {publicCustomizationView} from '../functions/surveyor-api/src/projects/public-share.js';
import {attemptPasswordResetDelivery, passwordResetRequestMessage, passwordResetSubject, transientAuthBodyPayload} from '../functions/surveyor-api/src/security/auth-messages.js';

describe('regressões de segurança da API',()=>{
 it('não interpreta como HTML o erro recebido no callback OAuth',()=>{
  const page=googleDriveConnectErrorPage('</p><script>steal()</script><p>');
  expect(page).not.toContain('<script>');
  expect(page).toContain('&lt;/p&gt;&lt;script&gt;steal()&lt;/script&gt;&lt;p&gt;');
 });

 it('limita a personalização entregue por link público a identidade visual básica',()=>{
  const view=publicCustomizationView({
   companyName:'Empresa Exemplo',responsibleTechnician:'Técnico Exemplo',professionalRegistry:'Registro Exemplo',
   logoDataUrl:'data:image/png;base64,logo',addressText:'Endereço privado',phoneNumber:'Telefone privado',
   emailAddress:'Email privado',planDocumentSignatureDataUrl:'Assinatura privada',baseTemplateContent:'Modelo privado',
   options:{croquiDraftsByFeature:{private:'Rascunhos privados'},personalData:'Dados privados'}
  });
  expect(view).toEqual({companyName:'Empresa Exemplo',responsibleTechnician:'Técnico Exemplo',professionalRegistry:'Registro Exemplo',logoDataUrl:'data:image/png;base64,logo'});
 });

 it('não confirma publicamente a existência da conta durante a recuperação',()=>{
  expect(passwordResetRequestMessage('kau***@example.com')).toBe('Se existir uma conta para kau***@example.com, um código será enviado.');
 });

 it('não propaga falhas de envio de recuperação como resposta da rota',async()=>{
  const onFailure=vi.fn(async()=>{throw new Error('falha interna');});
  const delivered=await attemptPasswordResetDelivery(async()=>{throw new Error('SMTP indisponível');},onFailure);
  expect(delivered).toBe(false);
  expect(onFailure).toHaveBeenCalledOnce();
  const api=readFileSync(new URL('../functions/surveyor-api/src/main.js',import.meta.url),'utf8');
  const request=api.slice(api.indexOf("if (path === '/api/auth/password-reset/request'"),api.indexOf("if (path === '/api/auth/password-reset/verify'"));
  expect(request).toContain('await attemptPasswordResetDelivery(');
  expect(request).toContain('return send(response, request, 200');
 });

 it('não entrega tokens diferentes de recuperação em respostas sem Origin',()=>{
  const options={cookieFlag:'resetCookie',payloadKey:'resetToken',origin:'',allowBodyTokenWithoutOrigin:false};
  expect(transientAuthBodyPayload('token-conta-existente',options)).toEqual({resetCookie:false});
  expect(transientAuthBodyPayload('token-conta-inexistente',options)).toEqual({resetCookie:false});
 });

 it('aplica a mesma entrega sem token nos três caminhos de recuperação de senha',()=>{
  const api=readFileSync(new URL('../functions/surveyor-api/src/main.js',import.meta.url),'utf8');
  expect(api.match(/allowBodyTokenWithoutOrigin:\s*false/g)).toHaveLength(2);
 });

 it('usa um identificador pseudônimo igual para uma mesma conta informada, sem claim decoy',()=>{
  const subject=passwordResetSubject(' Kaual@Example.com ','secret-for-test');
  expect(subject).toBe(passwordResetSubject('kaual@example.com','secret-for-test'));
  expect(subject).not.toBe('kaual@example.com');
  const api=readFileSync(new URL('../functions/surveyor-api/src/main.js',import.meta.url),'utf8');
  const request=api.slice(api.indexOf("if (path === '/api/auth/password-reset/request'"),api.indexOf("if (path === '/api/auth/password-reset/verify'"));
  expect(request).toContain('sub: resetSubject');
  expect(request).not.toContain('decoy: true');
  expect(request).not.toContain('sub: userId');
  expect(request.match(/signJwt\(/g)).toHaveLength(1);
 });

 it('mantém o token de recuperação disponível no fluxo local com Origin',()=>{
  expect(transientAuthBodyPayload('token-local',{cookieFlag:'resetCookie',payloadKey:'resetToken',origin:'http://localhost:5173',allowBodyTokenWithoutOrigin:false}))
   .toEqual({resetToken:'token-local',resetCookie:false});
 });
});

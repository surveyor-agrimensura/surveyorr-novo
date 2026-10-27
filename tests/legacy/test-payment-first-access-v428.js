import fs from 'node:fs';
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const auth = fs.readFileSync('assets/js/core/auth.js', 'utf8');
const login = [fs.readFileSync('login/index.html', 'utf8'), fs.readFileSync('assets/js/core/login.js', 'utf8'), fs.readFileSync('assets/js/core/login-support.js', 'utf8')].join('\n');
const firstAccess = [fs.readFileSync('primeiro-acesso/index.html', 'utf8'), fs.readFileSync('assets/js/core/first-access.js', 'utf8')].join('\n');
for (const item of ['/api/integrations/payments/provision','/api/auth/first-access/password','requiresPasswordChange','processedPaymentIds']) {
  if (!api.includes(item)) throw new Error(`API sem ${item}`);
}
for (const item of ['confirmFirstAccessPassword','requiresPasswordChange']) {
  if (!auth.includes(item)) throw new Error(`Auth sem ${item}`);
}
if (!login.includes('SURVEYOR_FIRST_ACCESS') || !login.includes('result.requiresPasswordChange')) throw new Error('Login não redireciona o primeiro acesso.');
if (!firstAccess.includes('Nova senha') || !firstAccess.includes('Confirmar nova senha') || firstAccess.includes('Código de 6 dígitos')) throw new Error('Tela de primeiro acesso incorreta.');
console.log('OK: integração de pagamento e troca obrigatória de senha presentes.');

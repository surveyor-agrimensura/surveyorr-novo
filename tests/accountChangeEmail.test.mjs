import { describe, expect, it } from 'vitest';
import { buildAccountChangeEmail } from '../functions/surveyor-support/src/main.js';

describe('admin account change email', () => {
  it('builds a plan update with escaped content and plain text', () => {
    const mail = buildAccountChangeEmail({
      to: 'User@Example.com', name: '<Ana>', kind: 'plan',
      title: 'Plano atualizado', message: 'Plano <Pro>\nValidade nova'
    });
    expect(mail.to).toBe('user@example.com');
    expect(mail.subject).toContain('plano');
    expect(mail.htmlContent).toContain('&lt;Ana&gt;');
    expect(mail.htmlContent).toContain('Plano &lt;Pro&gt;<br>');
    expect(mail.textContent).toContain('Plano <Pro>\nValidade nova');
  });

  it('never includes a temporary password in the email contract', () => {
    const mail = buildAccountChangeEmail({
      to: 'user@example.com', kind: 'password_admin',
      message: 'Senha redefinida pelo administrador; crie uma nova senha ao entrar.'
    });
    expect(mail.subject).toContain('alterada pelo administrador');
    expect(mail.textContent).not.toMatch(/senha tempor.ria|password=/i);
  });

  it('rejects invalid destinations, kinds, and empty messages', () => {
    expect(() => buildAccountChangeEmail({ to: 'bad', kind: 'plan', message: 'x' })).toThrow();
    expect(() => buildAccountChangeEmail({ to: 'a@b.com', kind: 'arbitrary', message: 'x' })).toThrow();
    expect(() => buildAccountChangeEmail({ to: 'a@b.com', kind: 'maintenance' })).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { normalizeNotice } from '../functions/surveyor-api/src/main.js';

describe('contrato dos avisos do sistema', () => {
  it('converte campos legados do painel sem ativar um aviso inativo', () => {
    const notice = normalizeNotice({
      id: 'aviso-legado',
      title: 'Manutenção',
      message: 'Indisponibilidade programada.',
      displayMode: 'maintenance',
      audience: 'active',
      status: 'inactive',
    });

    expect(notice.deliveryMode).toBe('banner');
    expect(notice.audience).toBe('users');
    expect(notice.isActive).toBe(false);
    expect(notice.status).toBe('inactive');
  });

  it('preserva os campos canônicos de público específico e bloqueio de manutenção', () => {
    const notice = normalizeNotice({
      id: 'aviso-plano',
      title: 'Aviso do plano',
      message: 'Comunicado para um plano.',
      audience: 'plan',
      targetPlanSlug: 'PRO-MENSAL',
      blocksApp: true,
      isActive: true,
    });

    expect(notice.targetPlanSlug).toBe('pro-mensal');
    expect(notice.deliveryMode).toBe('banner');
    expect(notice.blocksApp).toBe(true);
    expect(notice.isActive).toBe(true);
  });

  it('mantém os dados atuais ao aplicar uma edição parcial', () => {
    const notice = normalizeNotice(
      { id: 'aviso-1', message: 'Mensagem revisada.' },
      { id: 'aviso-1', title: 'Aviso original', audience: 'admins', isActive: true },
    );

    expect(notice.title).toBe('Aviso original');
    expect(notice.message).toBe('Mensagem revisada.');
    expect(notice.audience).toBe('admins');
    expect(notice.isActive).toBe(true);
  });
});

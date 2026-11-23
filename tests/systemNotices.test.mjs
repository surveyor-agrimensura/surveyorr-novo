import { describe, expect, it } from 'vitest';
import { hasMaintenanceNoticeEmailChanges, isMaintenanceNoticeEmailCandidate, maintenanceNoticeRecipients, normalizeNotice, pendingPlanExpiryEmailDays } from '../functions/surveyor-api/src/main.js';

describe('contrato dos avisos do sistema', () => {
  it('seleciona destinatários por público mesmo quando a manutenção está agendada', () => {
    const notice = normalizeNotice({ type: 'maintenance', audience: 'users', startsAt: '2099-01-01T00:00:00.000Z' });
    expect(maintenanceNoticeRecipients(notice, [
      { id: 'u1', email: 'a@example.com', role: 'user' },
      { id: 'u2', email: 'A@example.com', role: 'technician' },
      { id: 'a1', email: 'admin@example.com', role: 'admin' },
      { id: 'bad', email: 'not-an-email', role: 'user' },
    ])).toEqual([{ id: 'u1', email: 'a@example.com', name: 'a@example.com' }]);
  });

  it('só aciona e-mail em avisos ativos de manutenção e detecta mudanças materiais', () => {
    const current = normalizeNotice({ id: 'm1', type: 'maintenance', title: 'Manutenção', message: 'Janela', audience: 'all', startsAt: '2030-01-01T10:00:00.000Z' });
    expect(isMaintenanceNoticeEmailCandidate(current)).toBe(true);
    expect(isMaintenanceNoticeEmailCandidate({ ...current, isActive: false })).toBe(false);
    expect(isMaintenanceNoticeEmailCandidate({ ...current, type: 'info' })).toBe(false);
    expect(hasMaintenanceNoticeEmailChanges(current, { ...current, updatedAt: '2030-01-01T00:00:00Z' })).toBe(false);
    expect(hasMaintenanceNoticeEmailChanges(current, { ...current, startsAt: '2030-01-02T10:00:00.000Z' })).toBe(true);
  });

  it('deduplica lembretes em 7 e 1 dia por data de vencimento', () => {
    const expiry = '2030-05-15';
    expect(pendingPlanExpiryEmailDays(7, expiry, {})).toEqual([7]);
    expect(pendingPlanExpiryEmailDays(1, expiry, { '20300515': { '1': { sentAt: '2030-05-14T00:00:00Z' } } })).toEqual([]);
    expect(pendingPlanExpiryEmailDays(2, expiry, {})).toEqual([]);
    expect(pendingPlanExpiryEmailDays(1, '', {})).toEqual([]);
  });

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

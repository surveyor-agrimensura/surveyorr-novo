import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';
import { IDLE_TIMEOUT_MS, isSessionIdleExpired, normalizeSession } from '../src/features/auth/authService';

describe('normalização da API oficial', () => {
  it('aceita o formato de login do SURVEYOR', () => {
    const result = normalizeSession({ user: { name: 'Exemplo' }, accessToken: 'token-exemplo', refreshToken: 'refresh-exemplo' });
    expect(result.user.name).toBe('Exemplo');
    expect(result.accessToken).toBe('token-exemplo');
    expect(result.refreshToken).toBe('refresh-exemplo');
  });
  it('não aceita autenticação sem usuário ou token', () => {
    expect(() => normalizeSession({ user: { name: 'Exemplo' } })).toThrow(ApiError);
    expect(() => normalizeSession({ accessToken: 'token' })).toThrow(ApiError);
  });
  it('não armazena refresh token quando o servidor responde com cookie', () => {
    const result = normalizeSession({ user: { name: 'Exemplo' }, token: 'token', refreshCookie: true, refreshToken: 'não persistir' });
    expect(result.refreshToken).toBeUndefined();
  });
});

describe('expiração por inatividade', () => {
  it('mantém a sessão antes de 30 minutos e expira ao atingir o limite', () => {
    const lastActivity = 1_000_000;
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60 * 1000);
    expect(isSessionIdleExpired(lastActivity, lastActivity + IDLE_TIMEOUT_MS - 1)).toBe(false);
    expect(isSessionIdleExpired(lastActivity, lastActivity + IDLE_TIMEOUT_MS)).toBe(true);
  });

  it('trata a ausência de um horário de atividade como sessão expirada', () => {
    expect(isSessionIdleExpired(null, 1_000_000)).toBe(true);
  });
});

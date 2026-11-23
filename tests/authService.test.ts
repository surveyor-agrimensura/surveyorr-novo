import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';
import { completeRefreshCookieMigration, normalizeSession } from '../src/features/auth/authService';

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
  it('migrates the legacy refresh token only from exact app origins', async () => {
    const response = { user: { id: 'u1' }, refreshToken: 'refresh-legacy', refreshCookieMigration: true };
    const migrated = await completeRefreshCookieMigration(response, 'https://www.surveyorr.com.br', async (token) => ({
      user: response.user, accessToken: 'access-new', refreshCookie: true, refreshToken: token
    }));
    expect(migrated.accessToken).toBe('access-new');
    expect(migrated.refreshCookie).toBe(true);

    let exchanged = false;
    const adminResult = await completeRefreshCookieMigration(response, 'https://admin.surveyorr.com.br', async () => {
      exchanged = true;
      return {};
    });
    expect(exchanged).toBe(false);
    expect(adminResult).toEqual(response);
  });
  it('keeps the JSON refresh fallback when cookie exchange fails', async () => {
    const response = { user: { id: 'u1' }, refreshToken: 'refresh-body', refreshCookieMigration: true };
    const result = await completeRefreshCookieMigration(response, 'https://surveyorr.com.br', async () => {
      throw new Error('exchange unavailable');
    });
    expect(result).toEqual(response);
  });
});

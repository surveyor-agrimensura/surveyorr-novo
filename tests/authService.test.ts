import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/lib/api';
import { normalizeSession } from '../src/features/auth/authService';

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

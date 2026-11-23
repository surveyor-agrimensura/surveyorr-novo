import { describe, expect, it } from 'vitest';
import { resolveEnvironment } from '../src/lib/config';

describe('isolamento de endpoints por ambiente', () => {
  it('usa local por padrão em dev e não herda URLs de produção', () => {
    expect(resolveEnvironment({}, true)).toMatchObject({ environment: 'local', api: '', save: '', support: '', geo: '' });
  });
  it('recusa endpoint remoto em local sem opt-in', () => {
    expect(() => resolveEnvironment({ VITE_SURVEYOR_API_URL: 'https://api.example.test' }, true)).toThrow(/remoto bloqueado/);
  });
  it('bloqueia modo production em dev sem opt-in explícito', () => {
    expect(() => resolveEnvironment({ VITE_SURVEYOR_ENV: 'production' }, true)).toThrow(/remoto bloqueado no dev/);
  });
  it('aceita localhost em local', () => {
    expect(resolveEnvironment({ VITE_SURVEYOR_API_URL: 'http://localhost:3000' }, true).api).toBe('http://localhost:3000');
  });
  it('permite remoto em local somente com opt-in explícito', () => {
    expect(resolveEnvironment({ VITE_SURVEYOR_API_URL: 'https://api.example.test', VITE_SURVEYOR_ALLOW_REMOTE_LOCAL: 'true' }, true).api).toBe('https://api.example.test');
  });
  it('exige endpoints completos em staging e mantém defaults de produção', () => {
    expect(() => resolveEnvironment({ VITE_SURVEYOR_ENV: 'staging' }, false)).toThrow(/Staging requer/);
    expect(resolveEnvironment({}, false).api).toBe('https://api.surveyorr.com.br');
  });
  it('recusa hosts de produção em staging', () => {
    expect(() => resolveEnvironment({ VITE_SURVEYOR_ENV: 'staging', VITE_SURVEYOR_API_URL: 'https://api.surveyorr.com.br', VITE_SURVEYOR_SAVE_API_URL: 'https://save.staging.test', VITE_SURVEYOR_SUPPORT_API_URL: 'https://support.staging.test', VITE_GEOSERVICES_URL: 'https://geo.staging.test' }, false)).toThrow(/produção bloqueado em staging/);
  });
});

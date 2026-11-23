// Endpoints públicos do frontend. Nunca inclua chaves administrativas aqui.
export type SurveyorEnvironment = 'local' | 'staging' | 'production';
type Inputs = Record<string, string | undefined>;
const production = {
  api: 'https://api.surveyorr.com.br',
  save: 'https://6a7bce66000fc9c90d88.nyc.appwrite.run',
  support: 'https://6a46d3d0003091f98222.nyc.appwrite.run',
  geo: 'https://tiny-king-d719georural-geoservices.kaualucasfrancasantos.workers.dev',
};
const trimUrl = (value?: string) => (value || '').trim().replace(/\/+$/, '');

export function resolveEnvironment(env: Inputs, isDev: boolean) {
  const selected = env.VITE_SURVEYOR_ENV?.trim().toLowerCase() || (isDev ? 'local' : 'production');
  if (!['local', 'staging', 'production'].includes(selected)) throw new Error('VITE_SURVEYOR_ENV deve ser local, staging ou production.');
  const environment = selected as SurveyorEnvironment;
  const urls = {
    api: trimUrl(env.VITE_SURVEYOR_API_URL) || (environment === 'production' ? production.api : ''),
    save: trimUrl(env.VITE_SURVEYOR_SAVE_API_URL) || (environment === 'production' ? production.save : ''),
    support: trimUrl(env.VITE_SURVEYOR_SUPPORT_API_URL) || (environment === 'production' ? production.support : ''),
    geo: trimUrl(env.VITE_GEOSERVICES_URL) || (environment === 'production' ? production.geo : ''),
  };
  if (isDev && env.VITE_SURVEYOR_ALLOW_REMOTE_LOCAL !== 'true') {
    for (const [service, value] of Object.entries(urls)) {
      if (value && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
        throw new Error(`Endpoint ${service} remoto bloqueado no dev; configure localhost ou VITE_SURVEYOR_ALLOW_REMOTE_LOCAL=true para autorizar conscientemente.`);
      }
    }
  }
  if (environment === 'staging') {
    const productionHosts = new Set(Object.values(production).map(value => new URL(value).hostname));
    for (const [service, value] of Object.entries(urls)) {
      if (value && productionHosts.has(new URL(value).hostname)) throw new Error(`Endpoint ${service} de produção bloqueado em staging.`);
    }
  }
  if (environment === 'staging' && Object.values(urls).some(value => !value)) {
    throw new Error('Staging requer URLs explícitas para API, Save, suporte e geosserviços.');
  }
  return { environment, ...urls };
}

const runtime = resolveEnvironment(import.meta.env, import.meta.env.DEV);
export const SURVEYOR_ENV = runtime.environment;
export const REMOTE_LOCAL_OPT_IN = import.meta.env.DEV && import.meta.env.VITE_SURVEYOR_ALLOW_REMOTE_LOCAL === 'true';
export const API_BASE_URL = runtime.api;
export const SAVE_API_BASE_URL = runtime.save;
export const SUPPORT_API_BASE_URL = runtime.support;
export const GEOSERVICES_BASE_URL = runtime.geo;
export const OFFICIAL_SITE = 'https://surveyorr.com.br';
export const STORE_URL = 'https://loja.surveyorr.com.br/';
export const SUPPORT_EMAIL = 'suporte@surveyorr.com.br';

// Somente endpoint público. Nunca inclua chaves administrativas no frontend.
export const API_BASE_URL = (import.meta.env.VITE_SURVEYOR_API_URL || 'https://api.surveyorr.com.br').replace(/\/+$/, '');
export const SAVE_API_BASE_URL = (import.meta.env.VITE_SURVEYOR_SAVE_API_URL || 'https://6a7bce66000fc9c90d88.nyc.appwrite.run').replace(/\/+$/, '');
export const OFFICIAL_SITE = 'https://surveyorr.com.br';
export const STORE_URL = 'https://loja.surveyorr.com.br/';
export const SUPPORT_EMAIL = 'suporte@surveyorr.com.br';

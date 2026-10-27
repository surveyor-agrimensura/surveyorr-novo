const serviceArg = process.argv.find((arg) => arg.startsWith('--service='));
const service = (serviceArg ? serviceArg.split('=')[1] : 'api').toLowerCase();
const env = process.env;
const errors = [];
const warnings = [];
const required = (name, min = 1) => {
  const value = String(env[name] || '').trim();
  if (!value || value.length < min || /troque|cole_|sua_|seu_|example|exemplo|changeme/i.test(value)) errors.push(`${name} ausente, curto ou placeholder`);
  return value;
};
const mustFalse = (name) => {
  if (String(env[name] || 'false').trim().toLowerCase() !== 'false') errors.push(`${name} deve ser false em produção`);
};
const officialCors = () => {
  const value = String(env.CORS_ORIGINS || '');
  if (!value) return;
  const origins = value.split(',').map((v) => v.trim()).filter(Boolean);
  const bad = origins.filter((origin) => !/^https:\/\/(?:[a-z0-9-]+\.)?surveyorr\.com\.br$/i.test(origin));
  if (bad.length) warnings.push(`CORS_ORIGINS contém origem fora de surveyorr.com.br: ${bad.join(', ')}`);
};

if (service === 'api') {
  required('APPWRITE_PROJECT_ID');
  required('APPWRITE_API_KEY', 24);
  required('JWT_SECRET', 32);
  required('PAYMENT_INTERNAL_SECRET', 32);
  mustFalse('ALLOW_LEGACY_AUTH_HEADERS');
  mustFalse('ENABLE_LEGACY_CORS_ORIGINS');
  mustFalse('ALLOW_LOCAL_DEV_ORIGINS');
  mustFalse('ENABLE_BOOTSTRAP_ROUTES');
  mustFalse('LOGIN_RATE_LIMIT_FAIL_OPEN');
  mustFalse('SHARE_RATE_LIMIT_FAIL_OPEN');
  mustFalse('PAYMENT_ALLOW_SANDBOX');
  officialCors();
} else if (service === 'save') {
  required('APPWRITE_PROJECT_ID');
  required('SURVEYOR_SAVE_APPWRITE_API_KEY', 24);
  mustFalse('ALLOW_DYNAMIC_APPWRITE_KEY');
  mustFalse('ENABLE_LEGACY_CORS_ORIGINS');
  mustFalse('ALLOW_LOCAL_DEV_ORIGINS');
  officialCors();
} else if (service === 'support') {
  required('APPWRITE_PROJECT_ID');
  required('SUPPORT_EMAIL');
  if (!String(env.BREVO_API_KEY || env.RESEND_API_KEY || env.SUPPORT_WEBHOOK_URL || '').trim()) errors.push('Configure um provedor real de e-mail/suporte.');
  mustFalse('ENABLE_LEGACY_CORS_ORIGINS');
  mustFalse('ALLOW_LOCAL_DEV_ORIGINS');
  officialCors();
} else if (service === 'geoservices') {
  required('APPWRITE_PROJECT_ID');
  required('GEOSERVICES_INTERNAL_TOKEN', 32);
  mustFalse('ENABLE_LEGACY_CORS_ORIGINS');
  mustFalse('ALLOW_LOCAL_DEV_ORIGINS');
  mustFalse('GEOSERVICES_ALLOW_INSECURE_INEMA_HTTP');
  mustFalse('GEOSERVICES_ALLOW_INSECURE_INEMA_TLS');
  officialCors();
} else {
  errors.push(`Serviço desconhecido: ${service}`);
}

if (warnings.length) {
  console.warn('Avisos:');
  warnings.forEach((item) => console.warn(`- ${item}`));
}
if (errors.length) {
  console.error(`Configuração de produção inválida para ${service}:`);
  errors.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}
console.log(`OK: configuração crítica de ${service} compatível com produção comercial.`);

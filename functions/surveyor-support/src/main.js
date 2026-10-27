import crypto from 'node:crypto';

const APP_VERSION = '1.0.0-rc.185.74';

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function safeSecretEqual(received = '', expected = '') {
  const a = Buffer.from(String(received || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function requestIp(request) {
  return String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '')
    .split(',')[0].trim().slice(0, 80);
}

function requestId(request) {
  const incoming = String(request.headers.get('x-request-id') || '').trim();
  return /^[a-z0-9._:-]{8,120}$/i.test(incoming) ? incoming : crypto.randomUUID();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 12000));
  return fetch(url, { ...options, signal: controller.signal }).catch((error) => {
    if (error?.name === 'AbortError') throw statusError(504, 'O provedor externo demorou além do limite para responder.');
    throw error;
  }).finally(() => clearTimeout(timer));
}

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function sanitizeText(value, max = 4000) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function corsOrigins() {
  const defaults = [
    'https://surveyorr.com.br',
    'https://www.surveyorr.com.br',
    'https://admin.surveyorr.com.br'
  ];
  if (String(env('ENABLE_LEGACY_CORS_ORIGINS', 'false')).toLowerCase() === 'true') {
    defaults.push('https://surveyoragrimensura.tech', 'https://www.surveyoragrimensura.tech', 'https://admin.surveyoragrimensura.tech');
  }
  const configured = String(env('CORS_ORIGINS', ''))
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item && item !== '*');
  return [...new Set([...defaults, ...configured])];
}

function isLocalDevelopmentOrigin(origin) {
  if (String(env('ALLOW_LOCAL_DEV_ORIGINS', 'false')).toLowerCase() !== 'true') return false;
  try {
    const parsed = new URL(String(origin || ''));
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return false;
  }
}

function corsHeaders(request) {
  const origin = String(request.headers.get('origin') || '').trim().replace(/\/+$/, '');
  const allowed = corsOrigins();
  const allowOrigin = origin && (allowed.includes(origin) || isLocalDevelopmentOrigin(origin)) ? origin : '';

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Surveyor-Internal-Secret',
    'Access-Control-Expose-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(request, status, payload, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Cross-Origin-Resource-Policy': 'same-site',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Permitted-Cross-Domain-Policies': 'none',
      'X-Request-ID': requestId(request),
      ...extra
    }
  });
}

function statusError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}


async function readJson(request, maxBytes = 128 * 1024) {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('application/json')) throw statusError(415, 'Envie o corpo da requisição em application/json.');
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw statusError(413, 'A requisição excede o limite permitido.');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw statusError(413, 'A requisição excede o limite permitido.');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw statusError(400, 'JSON inválido.');
  }
}

function supportEmail() {
  return normalizeEmail(env('SUPPORT_EMAIL', 'suporte@surveyorr.com.br')) || 'suporte@surveyorr.com.br';
}

function fromEmail() {
  return normalizeEmail(env('SUPPORT_FROM_EMAIL', supportEmail())) || supportEmail();
}

function fromName() {
  return sanitizeText(env('SUPPORT_FROM_NAME', 'Surveyor Suporte'), 120) || 'Surveyor Suporte';
}

function typeLabel(value) {
  const labels = {
    ajuda: 'Preciso de ajuda / suporte',
    erro: 'Reportar erro ou bug',
    acesso: 'Problema de acesso ou login',
    renovacao: 'Renovação de plano / acesso bloqueado',
    privacidade: 'Privacidade / solicitação sobre meus dados',
    nova_funcao: 'Pedir função nova',
    outro: 'Outro assunto'
  };
  return labels[String(value || '').trim()] || 'Outro assunto';
}

function buildEmailContent(payload, request) {
  const maxDetails = Number(env('MAX_DETAILS_LENGTH', '8000')) || 8000;
  const name = sanitizeText(payload.name, 180) || 'Não informado';
  const email = normalizeEmail(payload.email);
  const type = String(payload.type || 'ajuda').trim();
  const label = typeLabel(type);
  const details = sanitizeText(payload.details || payload.message, maxDetails);
  const page = sanitizeText(payload.page || payload.origin || request.headers.get('referer') || '', 600);
  const createdAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Bahia' });
  const userAgent = sanitizeText(request.headers.get('user-agent') || '', 500);
  // Valores vindos do navegador nunca entram diretamente no HTML do e-mail.
  // Mantemos a forma textual sanitizada para o corpo plain-text e uma forma
  // explicitamente escapada para qualquer interpolação HTML.
  const safePageHtml = escapeHtml(page);
  const safeUserAgentHtml = escapeHtml(userAgent);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw statusError(400, 'Informe um e-mail válido para retorno.');
  }
  if (!details || details.length < 12) {
    throw statusError(400, 'Descreva sua solicitação com mais detalhes.');
  }
  const minFeature = Number(env('MIN_FEATURE_DETAILS_LENGTH', '30')) || 30;
  if (type === 'nova_funcao' && details.length < minFeature) {
    throw statusError(400, 'Detalhe a função que deseja solicitar para implementação.');
  }

  const subject = `[Surveyor] ${label} — ${name || email}`.slice(0, 180);

  const htmlContent = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:720px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
    <div style="background:#0f5bdc;color:#fff;padding:22px 26px">
      <h1 style="margin:0;font-size:22px">Nova solicitação de suporte</h1>
      <p style="margin:6px 0 0;opacity:.9">${escapeHtml(label)}</p>
    </div>
    <div style="padding:24px 26px">
      <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
      <p><strong>E-mail do usuário:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      <p><strong>Tipo:</strong> ${escapeHtml(label)}</p>
      <p><strong>Data:</strong> ${escapeHtml(createdAt)}</p>
      ${page ? `<p><strong>Página:</strong> ${safePageHtml}</p>` : ''}
      <hr style="border:0;border-top:1px solid #dbe4f0;margin:20px 0">
      <h2 style="font-size:18px;margin:0 0 10px">Mensagem</h2>
      <div style="white-space:pre-wrap;line-height:1.6;background:#f8fbff;border:1px solid #dbe4f0;border-radius:12px;padding:16px">${escapeHtml(details)}</div>
      <p style="font-size:12px;color:#64748b;margin-top:20px">User-Agent: ${safeUserAgentHtml}</p>
    </div>
  </div>
</body>
</html>`;

  const textContent = [
    'Nova solicitação de suporte - Surveyor',
    '',
    `Nome: ${name}`,
    `E-mail: ${email}`,
    `Tipo: ${label}`,
    `Data: ${createdAt}`,
    page ? `Página: ${page}` : '',
    '',
    'Mensagem:',
    details,
    '',
    `User-Agent: ${userAgent}`
  ].filter(Boolean).join('\n');

  return { name, email, type, label, details, page, subject, htmlContent, textContent };
}

async function sendWithBrevo({ to, subject, replyTo, htmlContent, textContent, senderName, senderEmail, attachments = [] }) {
  const apiKey = env('BREVO_API_KEY') || env('SENDINBLUE_API_KEY');
  if (!apiKey) return null;

  const response = await fetchWithTimeout('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: senderName || fromName(), email: senderEmail || fromEmail() },
      to: [{ email: to }],
      replyTo: replyTo ? { email: replyTo } : undefined,
      subject,
      htmlContent,
      textContent,
      attachment: attachments.length ? attachments.map((item) => ({ name: item.filename || item.name, content: item.contentBase64 || item.content })) : undefined
    })
  }, Number(env('EMAIL_PROVIDER_TIMEOUT_MS', '12000')) || 12000);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw statusError(502, data?.message || data?.error || `Brevo recusou o envio (${response.status}).`, data);
  }

  return { provider: 'brevo', id: data?.messageId || data?.messageIds?.[0] || null };
}

async function sendWithResend({ to, subject, replyTo, htmlContent, textContent, attachments = [] }) {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey) return null;

  const response = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${fromName()} <${fromEmail()}>`,
      to: [to],
      reply_to: replyTo ? [replyTo] : undefined,
      subject,
      html: htmlContent,
      text: textContent,
      attachments: attachments.length ? attachments.map((item) => ({ filename: item.filename || item.name, content: item.contentBase64 || item.content })) : undefined
    })
  }, Number(env('EMAIL_PROVIDER_TIMEOUT_MS', '12000')) || 12000);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw statusError(502, data?.message || data?.error || `Resend recusou o envio (${response.status}).`, data);
  }

  return { provider: 'resend', id: data?.id || null };
}

async function sendWebhook(payload) {
  const url = normalizeUrl(env('SUPPORT_WEBHOOK_URL'));
  if (!url) return null;

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env('SUPPORT_WEBHOOK_TOKEN') ? { 'Authorization': `Bearer ${env('SUPPORT_WEBHOOK_TOKEN')}` } : {})
    },
    body: JSON.stringify(payload)
  }, Number(env('SUPPORT_WEBHOOK_TIMEOUT_MS', '10000')) || 10000);

  const text = await response.text();
  if (!response.ok) {
    throw statusError(502, `Webhook de suporte recusou o envio (${response.status}).`, text.slice(0, 500));
  }

  return { provider: 'webhook', id: null };
}


function securityFromEmail() {
  return normalizeEmail(env('BREVO_SENDER_EMAIL', fromEmail())) || fromEmail();
}

function securityFromName() {
  return sanitizeText(env('BREVO_SENDER_NAME', 'Surveyor Segurança'), 120) || 'Surveyor Segurança';
}

function requireInternalSecret(request) {
  const expected = env('EMAIL_FUNCTION_SECRET');
  if (!expected) throw statusError(503, 'EMAIL_FUNCTION_SECRET não configurado na Function de suporte.');
  const received = request.headers.get('x-surveyor-internal-secret') || request.headers.get('X-Surveyor-Internal-Secret') || '';
  if (!received || !safeSecretEqual(received, expected)) throw statusError(403, 'Acesso não autorizado.');
}

function buildLoginCodeEmail(payload) {
  const to = normalizeEmail(payload.to || payload.email);
  const name = sanitizeText(payload.name || '', 160) || 'usuário';
  const code = String(payload.code || '').replace(/\D/g, '').slice(0, 12);
  const expiresInMinutes = Math.min(Math.max(Number(payload.expiresInMinutes || 10) || 10, 1), 60);
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  if (!/^\d{4,12}$/.test(code)) throw statusError(400, 'Código de verificação inválido.');

  const purpose = String(payload.purpose || 'login_verification').trim().toLowerCase();
  const passwordReset = purpose === 'password_reset';
  const subject = passwordReset ? 'Código para redefinir sua senha do Surveyor' : 'Código de verificação do Surveyor';
  const title = passwordReset ? 'Redefina sua senha do Surveyor' : 'Confirme seu acesso ao Surveyor';
  const subtitle = passwordReset ? 'Recuperação segura de acesso' : 'Verificação de conta no primeiro acesso';
  const instruction = passwordReset ? 'Use o código abaixo para criar uma nova senha:' : 'Use o código abaixo para confirmar sua conta e acessar o Surveyor:';
  const htmlContent = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
    <div style="background:#0f5bdc;color:#fff;padding:24px 28px">
      <h1 style="margin:0;font-size:22px">${escapeHtml(title)}</h1>
      <p style="margin:8px 0 0;opacity:.92">${escapeHtml(subtitle)}</p>
    </div>
    <div style="padding:28px">
      <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Olá, ${escapeHtml(name)}.</p>
      <p style="font-size:16px;line-height:1.6;margin:0 0 18px">${escapeHtml(instruction)}</p>
      <div style="font-size:36px;letter-spacing:8px;font-weight:800;text-align:center;background:#eef5ff;border:1px solid #cfe0ff;border-radius:16px;padding:20px;margin:22px 0;color:#0f5bdc">${escapeHtml(code)}</div>
      <p style="font-size:14px;color:#475569;line-height:1.6">Este código expira em ${expiresInMinutes} minutos. Se você não tentou entrar no sistema, ignore este e-mail.</p>
    </div>
  </div>
</body>
</html>`;
  const textContent = [
    title,
    '',
    `Olá, ${name}.`,
    `${passwordReset ? 'Código de recuperação' : 'Código de verificação'}: ${code}`,
    `Este código expira em ${expiresInMinutes} minutos.`,
    '',
    'Se você não tentou entrar no sistema, ignore este e-mail.'
  ].join('\n');

  return { to, name, code, expiresInMinutes, subject, htmlContent, textContent, purpose };
}

async function handleLoginCodeRequest(request) {
  requireInternalSecret(request);
  const payload = await readJson(request);
  const content = buildLoginCodeEmail(payload);

  let sent = await sendWithBrevo({
    to: content.to,
    subject: content.subject,
    htmlContent: content.htmlContent,
    textContent: content.textContent,
    senderName: securityFromName(),
    senderEmail: securityFromEmail()
  });

  if (!sent) {
    sent = await sendWithResend({
      to: content.to,
      subject: content.subject,
      htmlContent: content.htmlContent,
      textContent: content.textContent
    });
  }

  if (!sent) throw statusError(501, 'Function de suporte sem provedor de e-mail configurado. Configure BREVO_API_KEY.');

  return {
    ok: true,
    sent: true,
    provider: sent.provider,
    id: sent.id || null,
    type: content.purpose,
    to: maskEmailForResponse(content.to),
    expiresInMinutes: content.expiresInMinutes
  };
}

function maskEmailForResponse(email = '') {
  const [name = '', domain = ''] = String(email || '').split('@');
  if (!domain) return email;
  const visible = name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${visible}@${domain}`;
}

const supportRateBuckets = new Map();

function consumeSupportRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = supportRateBuckets.get(key) || [];
  const active = bucket.filter((timestamp) => now - timestamp < windowMs);
  if (active.length >= limit) throw statusError(429, 'Muitas solicitações de suporte. Aguarde alguns minutos antes de tentar novamente.', { code: 'SUPPORT_RATE_LIMITED', retryAfterSeconds: Math.ceil(windowMs / 1000) });
  active.push(now);
  supportRateBuckets.set(key, active);
  if (supportRateBuckets.size > 2000) {
    for (const [entryKey, timestamps] of supportRateBuckets) {
      if (!timestamps.some((timestamp) => now - timestamp < windowMs)) supportRateBuckets.delete(entryKey);
      if (supportRateBuckets.size <= 1500) break;
    }
  }
}

function assertPublicSupportOrigin(request) {
  const origin = String(request.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (!origin) return;
  if (!corsOrigins().includes(origin) && !isLocalDevelopmentOrigin(origin)) throw statusError(403, 'Origem não autorizada para enviar suporte.');
}

async function verifyTurnstileIfConfigured(payload, request) {
  const secret = String(env('TURNSTILE_SECRET_KEY', '') || '').trim();
  if (!secret) return;
  const token = sanitizeText(payload.turnstileToken || payload['cf-turnstile-response'] || '', 4096);
  if (!token) throw statusError(400, 'Confirme a verificação de segurança antes de enviar.');
  const body = new URLSearchParams({ secret, response: token, remoteip: requestIp(request) });
  const response = await fetchWithTimeout('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }, 8000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success !== true) throw statusError(403, 'A verificação de segurança não foi confirmada.');
}

async function handleSupportRequest(request) {
  assertPublicSupportOrigin(request);
  const payload = await readJson(request, 64 * 1024);
  if (sanitizeText(payload.website || payload.companyWebsite || payload.fax || '', 300)) {
    return { ok: true, sent: true, provider: 'filtered', id: null, supportEmail: supportEmail(), type: 'filtered', typeLabel: 'Solicitação recebida' };
  }
  const email = normalizeEmail(payload.email);
  const ip = requestIp(request) || 'unknown';
  consumeSupportRateLimit(`ip:${ip}`, Number(env('SUPPORT_RATE_LIMIT_IP', '6')) || 6, 15 * 60 * 1000);
  if (email) consumeSupportRateLimit(`email:${email}`, Number(env('SUPPORT_RATE_LIMIT_EMAIL', '4')) || 4, 15 * 60 * 1000);
  const fingerprint = crypto.createHash('sha256').update(`${email}:${sanitizeText(payload.details || payload.message || '', 2000)}`).digest('hex').slice(0, 32);
  consumeSupportRateLimit(`dup:${fingerprint}`, 2, 30 * 60 * 1000);
  await verifyTurnstileIfConfigured(payload, request);
  const content = buildEmailContent(payload, request);
  const to = supportEmail();

  let sent = await sendWithBrevo({
    to,
    subject: content.subject,
    replyTo: content.email,
    htmlContent: content.htmlContent,
    textContent: content.textContent
  });

  if (!sent) {
    sent = await sendWithResend({
      to,
      subject: content.subject,
      replyTo: content.email,
      htmlContent: content.htmlContent,
      textContent: content.textContent
    });
  }

  if (!sent) {
    sent = await sendWebhook({
      ...payload,
      normalized: content,
      to,
      supportEmail: to
    });
  }

  if (!sent) {
    throw statusError(501, 'Function de suporte criada, mas falta configurar o provedor de e-mail. Configure BREVO_API_KEY e SUPPORT_FROM_EMAIL.');
  }

  return {
    ok: true,
    sent: true,
    provider: sent.provider,
    id: sent.id || null,
    supportEmail: to,
    type: content.type,
    typeLabel: content.label
  };
}


function buildPlanDocumentEmail(payload) {
  const to = normalizeEmail(payload.to || payload.email);
  const name = sanitizeText(payload.name || '', 180) || 'cliente';
  const planName = sanitizeText(payload.planName || 'Plano Surveyor', 180);
  const documentType = String(payload.documentType || 'term') === 'receipt' ? 'receipt' : 'term';
  const filename = sanitizeText(payload.filename || (documentType === 'receipt' ? 'Comprovante_Surveyor.pdf' : 'Termo_Surveyor.pdf'), 240).replace(/[\\/:*?"<>|]/g, '_');
  const contentBase64 = String(payload.contentBase64 || '').replace(/^data:application\/pdf;base64,/, '').trim();
  const maxAttachmentBytes = Number(env('PLAN_DOCUMENT_MAX_ATTACHMENT_BYTES', String(8 * 1024 * 1024))) || 8 * 1024 * 1024;
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  if (!contentBase64) throw statusError(400, 'PDF não informado.');
  let bytes;
  try { bytes = Buffer.from(contentBase64, 'base64'); } catch { throw statusError(400, 'PDF em Base64 inválido.'); }
  if (!bytes.length || bytes.slice(0, 4).toString() !== '%PDF') throw statusError(400, 'O anexo enviado não é um PDF válido.');
  if (bytes.length > maxAttachmentBytes) throw statusError(413, `O PDF excede o limite de ${Math.round(maxAttachmentBytes / 1024 / 1024)} MB.`);

  const welcomeEmail = payload.welcomeEmail === true;
  const documentLabel = documentType === 'receipt'
    ? (welcomeEmail ? 'Comprovante de Contratação, Ativação e Ciência do Termo de Adesão' : 'Comprovante de Contratação e Ativação')
    : 'Termo de Adesão e Ciência';
  const subject = welcomeEmail
    ? `Bem-vindo ao Surveyor — ${planName}`
    : documentType === 'receipt'
      ? `Comprovante da sua assinatura — ${planName}`
      : `Parabéns pela assinatura do ${planName}`;
  const startDate = sanitizeText(payload.startDate || '', 40);
  const endDate = sanitizeText(payload.endDate || '', 40);
  const accessEmail = normalizeEmail(payload.accessEmail || to);
  const requestedFirstAccessUrl = sanitizeText(payload.firstAccessUrl || '', 2400);
  const firstAccessUrl = welcomeEmail && /^https:\/\//i.test(requestedFirstAccessUrl) && requestedFirstAccessUrl.includes('/primeiro-acesso/') ? requestedFirstAccessUrl : '';
  const code = sanitizeText(payload.documentCode || '', 100);
  const requestedLoginUrl = normalizeUrl(payload.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/'));
  const loginUrl = /^https:\/\//i.test(requestedLoginUrl) ? requestedLoginUrl : 'https://surveyorr.com.br/login/';
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
<div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
<div style="background:#0f5bdc;color:#fff;padding:24px 28px"><h1 style="margin:0;font-size:23px">${welcomeEmail ? 'Bem-vindo ao Surveyor!' : 'Parabéns pela assinatura do Surveyor!'}</h1><p style="margin:8px 0 0;opacity:.92">${escapeHtml(planName)}</p></div>
<div style="padding:28px"><p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>${welcomeEmail ? 'Sua conta foi criada e o acesso está pronto.' : 'Sua contratação foi registrada com sucesso.'} Encaminhamos em anexo o <strong>${escapeHtml(documentLabel)}</strong> referente ao plano <strong>${escapeHtml(planName)}</strong>.</p>
<div style="background:#f8fbff;border:1px solid #dbe4f0;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0 0 8px"><strong>Plano:</strong> ${escapeHtml(planName)}</p>
${startDate ? `<p style="margin:0 0 8px"><strong>Início:</strong> ${escapeHtml(startDate)}</p>` : ''}
${endDate ? `<p style="margin:0 0 8px"><strong>Validade:</strong> ${escapeHtml(endDate)}</p>` : ''}
<p style="margin:0 0 8px"><strong>E-mail de acesso:</strong> ${escapeHtml(accessEmail)}</p>
${welcomeEmail ? `<p style="margin:0"><strong>Primeiro acesso:</strong> crie sua própria senha pelo link seguro abaixo.</p>` : ''}</div>
${welcomeEmail && firstAccessUrl ? `<p style="text-align:center;margin:22px 0"><a href="${escapeHtml(firstAccessUrl)}" style="display:inline-block;background:#0f5bdc;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Criar minha senha</a></p><p style="font-size:13px;color:#64748b">Por segurança, o Surveyor não envia senhas por e-mail. Este link é temporário e deixa de funcionar após a criação da sua senha.</p>` : welcomeEmail ? `<p style="text-align:center;margin:22px 0"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f5bdc;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Acessar o Surveyor</a></p>` : ''}
<p>Guarde o documento para futuras consultas. Em caso de dúvida, responda este e-mail ou utilize os canais oficiais de suporte.</p>
<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe Surveyor</strong><br>Georreferenciamento e Agrimensura</p>
${code ? `<p style="font-size:12px;color:#64748b;margin-top:22px">Documento: ${escapeHtml(code)}</p>` : ''}
</div></div></body></html>`;
  const textContent = [
    `Olá, ${name}.`, '', welcomeEmail ? 'Bem-vindo ao Surveyor. Sua conta foi criada e o acesso está pronto.' : `Parabéns pela assinatura do ${planName}.`,
    `Em anexo está o ${documentLabel}.`, '', `Plano: ${planName}`,
    startDate ? `Início: ${startDate}` : '', endDate ? `Validade: ${endDate}` : '',
    `E-mail de acesso: ${accessEmail}`, welcomeEmail ? 'Primeiro acesso: crie sua própria senha pelo link seguro.' : '', welcomeEmail && firstAccessUrl ? `Criar senha: ${firstAccessUrl}` : (welcomeEmail ? `Acesse: ${loginUrl}` : ''),
    welcomeEmail ? 'Por segurança, o Surveyor não envia senhas por e-mail.' : '', '', 'Atenciosamente,', 'Equipe Surveyor'
  ].filter(Boolean).join('\n');
  return { to, name, planName, documentType, documentLabel, subject, htmlContent, textContent, attachment: { filename, contentBase64 }, bytes: bytes.length };
}


function buildFirstAccessEmail(payload = {}) {
  const to = normalizeEmail(payload.to || payload.email);
  const name = sanitizeText(payload.name || '', 180) || 'cliente';
  const planName = sanitizeText(payload.planName || 'Plano Surveyor', 180);
  const requestedUrl = sanitizeText(payload.firstAccessUrl || '', 2400);
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  if (!/^https:\/\//i.test(requestedUrl) || !requestedUrl.includes('/primeiro-acesso/')) throw statusError(400, 'Link de primeiro acesso inválido.');
  const firstAccessUrl = requestedUrl;
  const subject = `Crie sua senha do Surveyor — ${planName}`;
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
<div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
<div style="background:#0f5bdc;color:#fff;padding:24px 28px"><h1 style="margin:0;font-size:23px">Bem-vindo ao Surveyor</h1><p style="margin:8px 0 0;opacity:.92">${escapeHtml(planName)}</p></div>
<div style="padding:28px"><p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>Sua conta foi criada. Por segurança, o Surveyor não envia uma senha pronta: você mesmo define a senha no primeiro acesso.</p>
<p style="text-align:center;margin:24px 0"><a href="${escapeHtml(firstAccessUrl)}" style="display:inline-block;background:#0f5bdc;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Criar minha senha</a></p>
<p style="font-size:13px;color:#64748b">O link é temporário e deixa de funcionar após a criação da senha. Se você não solicitou esta conta, ignore esta mensagem e avise o suporte.</p>
<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe Surveyor</strong></p></div></div></body></html>`;
  const textContent = `Olá, ${name}.\n\nSua conta Surveyor foi criada (${planName}).\nPor segurança, o Surveyor não envia senha pronta. Crie sua senha pelo link temporário:\n${firstAccessUrl}\n\nEquipe Surveyor`;
  return { to, name, planName, subject, htmlContent, textContent };
}

async function handleFirstAccessEmail(request) {
  requireInternalSecret(request);
  const payload = await readJson(request, 128 * 1024);
  const content = buildFirstAccessEmail(payload);
  let sent = await sendWithBrevo({ to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent, senderName: 'Equipe Surveyor', senderEmail: securityFromEmail() });
  if (!sent) sent = await sendWithResend({ to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent });
  if (!sent) throw statusError(501, 'Nenhum provedor de e-mail configurado para primeiro acesso.');
  return { ok: true, sent: true, provider: sent.provider, id: sent.id || null, to: maskEmailForResponse(content.to) };
}

async function handlePlanDocumentEmail(request) {
  requireInternalSecret(request);
  const payload = await readJson(request, 12 * 1024 * 1024);
  const content = buildPlanDocumentEmail(payload);
  let sent = await sendWithBrevo({
    to: content.to, subject: content.subject, htmlContent: content.htmlContent,
    textContent: content.textContent, senderName: 'Equipe Surveyor', senderEmail: securityFromEmail(),
    attachments: [content.attachment]
  });
  if (!sent) sent = await sendWithResend({ to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent, attachments: [content.attachment] });
  if (!sent) throw statusError(501, 'Nenhum provedor de e-mail configurado para envio de documentos.');
  return { ok: true, sent: true, provider: sent.provider, id: sent.id || null, to: maskEmailForResponse(content.to), filename: content.attachment.filename, bytes: content.bytes };
}


function buildAccountEmailChangedEmail(payload = {}) {
  const to = normalizeEmail(payload.to || payload.email);
  const name = sanitizeText(payload.name || '', 180) || 'cliente';
  const oldEmail = normalizeEmail(payload.oldEmail);
  const newEmail = normalizeEmail(payload.newEmail);
  const audience = String(payload.audience || 'new').toLowerCase() === 'old' ? 'old' : 'new';
  const requestedLoginUrl = normalizeUrl(payload.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/'));
  const loginUrl = /^https:\/\//i.test(requestedLoginUrl) ? requestedLoginUrl : 'https://surveyorr.com.br/login/';
  if (!to || !oldEmail || !newEmail) throw statusError(400, 'Dados inválidos para notificação da alteração de e-mail.');
  const subject = audience === 'old' ? 'Aviso de segurança: e-mail de acesso alterado — Surveyor' : 'Seu novo e-mail de acesso ao Surveyor';
  const title = audience === 'old' ? 'O e-mail de acesso da conta foi alterado' : 'Seu novo login do Surveyor está ativo';
  const introduction = audience === 'old'
    ? `Este endereço deixou de ser o login da conta de ${name}.`
    : `O administrador atualizou o e-mail de acesso da sua conta.`;
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
<div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
<div style="background:#0f5bdc;color:#fff;padding:24px 28px"><h1 style="margin:0;font-size:22px">${escapeHtml(title)}</h1><p style="margin:8px 0 0;opacity:.92">Surveyor — segurança da conta</p></div>
<div style="padding:28px"><p>Olá, <strong>${escapeHtml(name)}</strong>.</p><p>${escapeHtml(introduction)}</p>
<div style="background:#f8fbff;border:1px solid #dbe4f0;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0 0 8px"><strong>E-mail anterior:</strong> ${escapeHtml(oldEmail)}</p>
<p style="margin:0"><strong>Novo e-mail de acesso:</strong> ${escapeHtml(newEmail)}</p></div>
<p>A senha da conta continua a mesma. Os projetos, arquivos, plano, acessos e histórico foram preservados.</p>
${audience === 'new' ? `<p style="text-align:center;margin:22px 0"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#0f5bdc;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Entrar com o novo e-mail</a></p>` : ''}
<p style="font-size:13px;color:#64748b">Se você não reconhece esta alteração, entre em contato imediatamente com o suporte oficial do Surveyor.</p>
<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe Surveyor</strong></p></div></div></body></html>`;
  const textContent = [
    title, '', `Olá, ${name}.`, introduction, '', `E-mail anterior: ${oldEmail}`, `Novo e-mail de acesso: ${newEmail}`,
    'A senha continua a mesma e todos os dados foram preservados.', audience === 'new' ? `Acesse: ${loginUrl}` : '', '',
    'Se você não reconhece esta alteração, entre em contato com o suporte oficial do Surveyor.'
  ].filter(Boolean).join('\n');
  return { to, subject, htmlContent, textContent };
}

async function handleAccountEmailChangedEmail(request) {
  requireInternalSecret(request);
  const content = buildAccountEmailChangedEmail(await readJson(request));
  let sent = await sendWithBrevo({
    to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent,
    senderName: 'Equipe Surveyor', senderEmail: securityFromEmail()
  });
  if (!sent) sent = await sendWithResend({ to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent });
  if (!sent) throw statusError(501, 'Nenhum provedor de e-mail configurado para a notificação.');
  return { ok: true, sent: true, provider: sent.provider, id: sent.id || null, to: maskEmailForResponse(content.to) };
}

function buildWorkspaceWelcomeEmail(payload = {}) {
  const to = normalizeEmail(payload.to || payload.email);
  const name = sanitizeText(payload.name || '', 180) || 'colaborador';
  const ownerName = sanitizeText(payload.ownerName || '', 180) || 'titular da assinatura';
  const planName = sanitizeText(payload.planName || 'Plano Surveyor', 180);
  const accessEmail = normalizeEmail(payload.accessEmail || to);
  const memberRole = String(payload.memberRole || 'collaborator').toLowerCase();
  const roleLabel = ({ collaborator: 'Colaborador', technician: 'Técnico', manager: 'Gestor' }[memberRole] || 'Colaborador');
  const requestedLoginUrl = normalizeUrl(payload.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/'));
  const loginUrl = /^https:\/\//i.test(requestedLoginUrl) ? requestedLoginUrl : 'https://surveyorr.com.br/login/';
  const requestedFirstAccessUrl = sanitizeText(payload.firstAccessUrl || '', 2400);
  const firstAccessUrl = /^https:\/\//i.test(requestedFirstAccessUrl) && requestedFirstAccessUrl.includes('/primeiro-acesso/') ? requestedFirstAccessUrl : '';
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  const subject = `Seu acesso compartilhado ao Surveyor foi criado — ${ownerName}`.slice(0, 180);
  const htmlContent = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fc;margin:0;padding:24px;color:#0f172a">
<div style="max-width:680px;margin:auto;background:#fff;border:1px solid #dbe4f0;border-radius:18px;overflow:hidden">
<div style="background:#0f5bdc;color:#fff;padding:24px 28px"><h1 style="margin:0;font-size:23px">Bem-vindo ao acesso compartilhado do Surveyor!</h1><p style="margin:8px 0 0;opacity:.92">Acesso simultâneo — ${escapeHtml(planName)}</p></div>
<div style="padding:28px"><p>Olá, <strong>${escapeHtml(name)}</strong>.</p>
<p>O administrador criou seu acesso vinculado à assinatura de <strong>${escapeHtml(ownerName)}</strong>.</p>
<div style="background:#f8fbff;border:1px solid #dbe4f0;border-radius:12px;padding:16px;margin:20px 0">
<p style="margin:0 0 8px"><strong>Plano compartilhado:</strong> ${escapeHtml(planName)}</p>
<p style="margin:0 0 8px"><strong>Titular:</strong> ${escapeHtml(ownerName)}</p>
<p style="margin:0 0 8px"><strong>E-mail de acesso:</strong> ${escapeHtml(accessEmail)}</p>
<p style="margin:0"><strong>Perfil de acesso:</strong> ${escapeHtml(roleLabel)}</p></div>
<p>Os projetos, documentos e o armazenamento pertencem ao mesmo espaço da assinatura principal. Todos os membros utilizam a mesma franquia do titular.</p>
<p>Seu perfil possui permissões operacionais reduzidas. Somente o administrador do Surveyor pode criar, alterar, bloquear ou remover acessos dos acessos simultâneos.</p>
<p style="text-align:center;margin:22px 0"><a href="${escapeHtml(firstAccessUrl || loginUrl)}" style="display:inline-block;background:#0f5bdc;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">${firstAccessUrl ? 'Criar minha senha' : 'Acessar o Surveyor'}</a></p>
<p style="font-size:13px;color:#64748b">${firstAccessUrl ? 'Por segurança, o Surveyor não envia senhas por e-mail. Crie sua própria senha pelo link temporário acima.' : 'Se precisar definir ou redefinir a senha, use o fluxo seguro de recuperação de acesso.'}</p>
<p style="margin-top:24px">Atenciosamente,<br><strong>Equipe Surveyor</strong><br>Georreferenciamento e Agrimensura</p>
</div></div></body></html>`;
  const textContent = [
    `Olá, ${name}.`, '', `Seu acesso compartilhado ao Surveyor foi criado e vinculado à assinatura de ${ownerName}.`,
    `Plano compartilhado: ${planName}`, `Titular: ${ownerName}`, `E-mail de acesso: ${accessEmail}`, `Perfil de acesso: ${roleLabel}`,
    firstAccessUrl ? `Criar senha: ${firstAccessUrl}` : `Acesse: ${loginUrl}`, '', 'Os projetos e o armazenamento são compartilhados entre os acessos simultâneos da conta.',
    'Você utiliza a mesma franquia de armazenamento e os mesmos projetos da equipe.',
    'Somente o administrador do Surveyor gerencia os acessos dos acessos simultâneos.',
    firstAccessUrl ? 'Por segurança, o Surveyor não envia senhas prontas.' : 'Use a recuperação segura de acesso caso precise definir uma nova senha.', '', 'Atenciosamente,', 'Equipe Surveyor'
  ].join('\n');
  return { to, subject, htmlContent, textContent };
}

async function handleWorkspaceWelcomeEmail(request) {
  requireInternalSecret(request);
  const content = buildWorkspaceWelcomeEmail(await readJson(request));
  let sent = await sendWithBrevo({
    to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent,
    senderName: 'Equipe Surveyor', senderEmail: securityFromEmail()
  });
  if (!sent) sent = await sendWithResend({ to: content.to, subject: content.subject, htmlContent: content.htmlContent, textContent: content.textContent });
  if (!sent) throw statusError(501, 'Nenhum provedor de e-mail configurado para boas-vindas de subusuários.');
  return { ok: true, sent: true, provider: sent.provider, id: sent.id || null, to: maskEmailForResponse(content.to) };
}

async function handler(request) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (method === 'GET' && (url.pathname === '/' || url.pathname === '/api/health' || url.pathname === '/health')) {
    return jsonResponse(request, 200, {
      ok: true,
      service: 'Surveyor Support Function',
      status: 'ready',
      version: APP_VERSION
    });
  }

  if (method === 'POST' && (url.pathname === '/api/security/send-first-access' || url.pathname === '/security/send-first-access')) {
    const result = await handleFirstAccessEmail(request);
    return sendJson(result, 200, corsHeaders(request));
  }

  if (method === 'POST' && (url.pathname === '/api/admin/send-plan-document' || url.pathname === '/admin/send-plan-document')) {
    const result = await handlePlanDocumentEmail(request);
    return jsonResponse(request, 200, result);
  }

  if (method === 'POST' && (url.pathname === '/api/admin/send-account-email-changed' || url.pathname === '/admin/send-account-email-changed')) {
    const result = await handleAccountEmailChangedEmail(request);
    return jsonResponse(request, 200, result);
  }

  if (method === 'POST' && (url.pathname === '/api/admin/send-subuser-welcome' || url.pathname === '/admin/send-subuser-welcome')) {
    const result = await handleWorkspaceWelcomeEmail(request);
    return jsonResponse(request, 200, result);
  }

  if (method === 'POST' && (url.pathname === '/api/security/send-login-code' || url.pathname === '/security/send-login-code')) {
    const result = await handleLoginCodeRequest(request);
    return jsonResponse(request, 200, result);
  }

  if (method === 'POST' && (url.pathname === '/' || url.pathname === '/api/support/request' || url.pathname === '/support/request')) {
    const result = await handleSupportRequest(request);
    return jsonResponse(request, 200, result);
  }

  return jsonResponse(request, 404, {
    ok: false,
    error: 'Rota não encontrada.',
    routes: ['GET /api/health', 'POST /api/support/request', 'POST /api/security/send-login-code', 'POST /api/security/send-first-access', 'POST /api/admin/send-plan-document', 'POST /api/admin/send-account-email-changed', 'POST /api/admin/send-subuser-welcome']
  });
}

function getRequestBody(req, method) {
  if (['GET', 'HEAD'].includes(String(method || '').toUpperCase())) return undefined;

  // Appwrite pode entregar o corpo como string, Buffer, ArrayBuffer ou objeto já parseado.
  // O runtime Node 25 gera 500 vazio se um objeto puro for passado direto ao construtor Request.
  if (typeof req.bodyText === 'string') return req.bodyText;
  if (typeof req.bodyRaw === 'string') return req.bodyRaw;
  if (typeof req.body === 'string') return req.body;
  if (req.body instanceof ArrayBuffer) return req.body;
  if (ArrayBuffer.isView(req.body)) return req.body;
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return undefined;
}

export default async ({ req, res }) => {
  let request;

  try {
    const method = String(req.method || 'GET').toUpperCase();
    const headers = new Headers(req.headers || {});
    const url = new URL(req.url || '/', 'https://surveyor-support.local').toString();

    request = new Request(url, {
      method,
      headers,
      body: getRequestBody(req, method)
    });
  } catch (error) {
    console.error('Erro ao montar Request da Function de suporte:', error);
    const fallbackRequest = new Request('https://surveyor-support.local/api/support/request', { method: 'POST' });
    const response = jsonResponse(fallbackRequest, 400, {
      ok: false,
      error: 'Não foi possível interpretar a requisição recebida pela Function de suporte.',
      details: error?.message || null
    });
    const body = await response.text();
    const outHeaders = {};
    response.headers.forEach((value, key) => { outHeaders[key] = value; });
    return res.send(body, response.status, outHeaders);
  }

  const response = await handler(request).catch((error) => {
    const incidentId = crypto.randomUUID();
    console.error(`[${incidentId}] Erro na Function de suporte:`, error);
    const status = Number(error.status || 500);
    const safeStatus = Number.isFinite(status) ? status : 500;
    const publicError = safeStatus >= 500 ? 'Não foi possível concluir o envio agora. Tente novamente em alguns instantes.' : (error.message || 'Requisição inválida.');
    const safeDetails = safeStatus < 500 && error.details && typeof error.details === 'object'
      ? Object.fromEntries(Object.entries(error.details).filter(([key]) => ['code', 'retryAfterSeconds', 'field'].includes(key)))
      : undefined;
    return jsonResponse(request, safeStatus, {
      ok: false,
      error: publicError,
      requestId: incidentId,
      details: safeDetails
    }, safeStatus === 429 ? { 'Retry-After': String(safeDetails?.retryAfterSeconds || 60), 'X-Request-ID': incidentId } : { 'X-Request-ID': incidentId });
  });

  const body = await response.text();
  const outHeaders = {};
  response.headers.forEach((value, key) => { outHeaders[key] = value; });
  return res.send(body, response.status, outHeaders);
};

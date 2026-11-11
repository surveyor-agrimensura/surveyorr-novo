// Validação única dos anexos PDF de planos. Sem dependências externas.
export function createPlanDocumentValidator({ normalizeEmail, env, statusError }) {
function normalizePlanDocumentAttachment(input = {}) {
  const to = normalizeEmail(input.to || input.email);
  const name = String(input.name || '').trim().slice(0, 180);
  const planName = String(input.planName || '').trim().slice(0, 180);
  const documentType = String(input.documentType || 'receipt') === 'receipt' ? 'receipt' : 'term';
  const filename = String(input.filename || '').trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 240);
  const contentBase64 = String(input.contentBase64 || '').replace(/^data:application\/pdf;base64,/, '').trim();
  const maxBytes = Number(env('PLAN_DOCUMENT_MAX_ATTACHMENT_BYTES', String(8 * 1024 * 1024))) || 8 * 1024 * 1024;
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) throw statusError(400, 'E-mail de destino inválido.');
  if (!name) throw statusError(400, 'Nome do cliente não informado.');
  if (!planName) throw statusError(400, 'Plano não informado.');
  if (!filename.toLowerCase().endsWith('.pdf')) throw statusError(400, 'Nome do arquivo PDF inválido.');
  if (!contentBase64) throw statusError(400, 'Conteúdo do PDF não informado.');
  let pdfBuffer;
  try { pdfBuffer = Buffer.from(contentBase64, 'base64'); } catch { throw statusError(400, 'PDF em Base64 inválido.'); }
  if (!pdfBuffer.length || pdfBuffer.slice(0, 4).toString() !== '%PDF') throw statusError(400, 'O anexo não é um PDF válido.');
  if (pdfBuffer.length > maxBytes) throw statusError(413, `O PDF excede o limite de ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  return {
    to, name, planName, documentType, filename, contentBase64, pdfBuffer,
    startDate: String(input.startDate || '').slice(0, 40),
    endDate: String(input.endDate || '').slice(0, 40),
    accessEmail: normalizeEmail(input.accessEmail || to),
    amountCents: Number(input.amountCents || 0),
    documentCode: String(input.documentCode || '').slice(0, 100),
    welcomeEmail: input.welcomeEmail === true,
    firstAccessUrl: String(input.firstAccessUrl || '').trim().slice(0, 2500),
    loginUrl: String(input.loginUrl || env('SURVEYOR_LOGIN_URL', 'https://surveyorr.com.br/login/')).slice(0, 500)
  };
}

  return normalizePlanDocumentAttachment;
}

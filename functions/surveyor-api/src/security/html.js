export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function googleDriveConnectErrorPage(errorCode) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Google Drive não conectado</title></head><body style="font-family:Arial;padding:28px"><h2>Google Drive não conectado</h2><p>${escapeHtml(errorCode)}</p><p>Você pode fechar esta janela e tentar novamente.</p></body></html>`;
}

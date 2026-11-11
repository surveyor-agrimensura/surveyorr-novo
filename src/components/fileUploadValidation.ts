export interface UploadValidationIssue { file: File; message: string }

export function validateUploadFiles(
  files: File[],
  options: { accept?: string; multiple?: boolean; maxFiles?: number; maxBytes?: number } = {}
): UploadValidationIssue[] {
  const { accept = '', multiple = false, maxFiles = multiple ? Infinity : 1, maxBytes = Infinity } = options;
  const allowed = accept.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  return files.flatMap((file, index) => {
    let message = '';
    if (!multiple && files.length > 1) message = 'Selecione apenas um arquivo.';
    else if (index >= maxFiles) message = `O limite é de ${maxFiles} ${maxFiles === 1 ? 'arquivo' : 'arquivos'}.`;
    else if (file.size > maxBytes) message = `O arquivo excede o limite de ${formatFileSize(maxBytes)}.`;
    else if (allowed.length && !allowed.some((rule) => {
      if (rule.startsWith('.')) return file.name.toLowerCase().endsWith(rule);
      if (rule.endsWith('/*')) return file.type.toLowerCase().startsWith(rule.slice(0, -1));
      return file.type.toLowerCase() === rule;
    })) message = 'Formato de arquivo não permitido.';
    return message ? [{ file, message }] : [];
  });
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'tamanho desconhecido';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  for (const unit of units) {
    if (size < 1024 || unit === units.at(-1)) return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${unit}`;
    size /= 1024;
  }
  return `${bytes} B`;
}

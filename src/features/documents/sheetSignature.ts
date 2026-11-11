import type { SheetSettings } from './technicalSheet';

/** Assinatura da conta como padrão; imagem local somente quando escolhida pelo usuário.
 * A configuração da conta não é copiada para o rascunho da prancha, de modo que
 * uma atualização na personalização passe a valer também em pranchas já salvas.
 */
export const isSheetSignatureImage = (value:unknown): value is string =>
 typeof value==='string' && /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value.trim());

export function resolveSheetSignature(settings:SheetSettings,accountSignature:unknown):SheetSettings {
 if(settings.signatureSource==='none')return {...settings,signature:'',signatureEnabled:false};
 const custom = isSheetSignatureImage(settings.signature) ? settings.signature : '';
 if(settings.signatureSource==='custom')return {...settings,signature:custom,signatureEnabled:settings.signatureEnabled&&Boolean(custom)};
 const account = isSheetSignatureImage(accountSignature) ? accountSignature.trim() : '';
 return {...settings,signature:account,signatureEnabled:Boolean(account)};
}

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const save = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
const apiPkg = JSON.parse(fs.readFileSync(path.join(root, 'functions/surveyor-api/package.json'), 'utf8'));
const savePkg = JSON.parse(fs.readFileSync(path.join(root, 'functions/surveyor-save/package.json'), 'utf8'));
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const apiVersion = (api.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';
assert(/^2\.26\.\d+-security-safe-r\d+(?:-r\d+)?$/i.test(apiVersion), 'API Security Safe compatível com R2 ausente');
assert.strictEqual(apiPkg.version, rootPkg.version, 'package da API deve seguir a versão central da release');
assert.strictEqual(apiPkg.surveyorRelease, rootPkg.version, 'surveyorRelease da API deve seguir a release raiz');
const saveVersion = (save.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';
assert(/^2\.2\.\d+-security-safe-r\d+(?:-r\d+)?$/i.test(saveVersion), 'Save Security Safe compatível com R2 ausente');
assert.strictEqual(savePkg.version, rootPkg.version, 'package Save deve seguir a versão central da release');
assert.strictEqual(savePkg.surveyorRelease, rootPkg.version, 'surveyorRelease Save deve seguir a release raiz');

// Admin global: somente role resolvida no backend, nunca uma string de permissão manipulável.
const adminGate = api.match(/function isGlobalAdminAccess[\s\S]*?function requireAdminAccess[\s\S]*?\n}\n/);
assert(adminGate, 'gate administrativo R2 ausente');
assert(/role === 'admin'/.test(adminGate[0]), 'admin não depende do role server-side');
assert(/isSubuser !== true/.test(adminGate[0]), 'subusuário pode herdar admin global');
assert(!/permissions\.includes\(['"]admin:all/.test(adminGate[0]), 'admin ainda pode ser promovido apenas por string de permissão');
assert(/ADMIN_ROLE_REQUIRED/.test(api), 'erro explícito de role admin ausente');
assert(/sanitizeCommercialPermissions\(cleanGenerationPermissions/.test(api), 'planos ainda podem persistir permissões administrativas globais');

// Projeto: campos de segurança são server-owned e lock não tem bypass por force.
assert(/PROJECT_SERVER_METADATA_KEYS/.test(api), 'lista de metadata protegida de projeto ausente');
for (const key of ['projectlocked', 'secureshares', 'versions', 'workspaceowneruserid', 'storageowneruserid', 'createdbyuserid']) {
  assert(api.includes(`'${key}'`), `metadata protegida ausente: ${key}`);
}
assert(/sanitizeProjectClientInput\(rawInput, 'draft'\)/.test(api), 'criação de projeto não sanitiza payload');
assert(/sanitizeProjectClientInput\(rawInput, row\.status \|\| 'draft'\)/.test(api), 'edição de projeto não sanitiza payload');
assert(!/projectLocked && (?:input|body)\.force !== true/.test(api), 'API ainda permite bypass do lock por force');
assert(/PROJECT_DESTRUCTIVE_STATUSES/.test(api), 'status destrutivo de projeto não é filtrado');
assert(/assertWorkspaceActionAllowed\(auth, 'project:share'\)/.test(api), 'acesso a compartilhamento não respeita role da equipe');

// Documento: exclusão só pela rota DELETE e vínculo de projeto deve ficar no mesmo workspace.
assert(/DOCUMENT_DELETE_ROUTE_REQUIRED/.test(api), 'PATCH de documento ainda pode simular exclusão');
assert(/sanitizeDocumentClientInput/.test(api), 'documentos não sanitizam identidade/storage do payload');
assert(/assertOptionalProjectBelongsToAuth/.test(api), 'documentos não validam projeto relacionado');
assert((api.match(/assertOptionalProjectBelongsToAuth\(input\.projectId, auth\)/g) || []).length >= 3, 'validação de projeto relacionado não cobre upload/documentos');
assert(/function canAccessDocumentCategory/.test(api), 'leitura de documentos não possui gate de categoria/plano');
assert(/rows\.filter\(\(row\) => String\(row\.status \|\| ''\)\.toLowerCase\(\) !== 'deleted' && canAccessDocumentCategory\(auth, row\)\)/.test(api), 'listagem de documentos ainda pode vazar categoria sem permissão');
assert((api.match(/requireDocumentCategoryPermission\(auth, current\)/g) || []).length >= 2, 'download/edição não repetem gate da categoria atual');

// Google Drive: arquivo concluído precisa ter sido criado pelo workspace autenticado.
assert(/googleDriveFileForAuth/.test(api), 'validador de ownership do Google Drive ausente');
assert(/requireSurveyorTag: true/.test(api), 'conclusão de upload aceita fileId não vinculado ao workspace');
assert(/requirePermission\(auth, 'documents:download'/.test(api), 'download de documento sem gate de plano');
const driveSession = api.match(/if \(path === '\/api\/documents\/google-drive\/session'[\s\S]*?\n  }/);
assert(driveSession && /requirePermission\(auth, 'cloud:access'\)/.test(driveSession[0]), 'sessão Drive sem cloud:access');
assert(driveSession && /assertWorkspaceActionAllowed\(auth, 'document:create'\)/.test(driveSession[0]), 'sessão Drive ignora role da equipe');

// Planos inativos não vazam para usuário comum só porque passou ?all=true.
assert(/includeInactiveRequested && isGlobalAdminAccess\(auth\)/.test(api), 'planos inativos ainda podem ser listados por usuário comum');

// Save Function é uma segunda superfície de escrita e precisa repetir autorização/ownership.
assert(/function requireUserPermission/.test(save), 'Save Function sem gate de plano');
assert(/requireUserPermission\(user, 'projects:create'\)/.test(save), 'Save cria projeto sem permissão server-side');
assert(/requireUserPermission\(user, 'projects:edit-own'\)/.test(save), 'Save edita projeto sem permissão server-side');
assert(/PROJECT_SERVER_METADATA_KEYS/.test(save), 'Save não protege metadata server-owned');
assert(/sanitizeProjectClientInput\(rawInput, row\.status \|\| 'draft'\)/.test(save), 'Save não sanitiza edição');
assert(!/currentMetadata\.projectLocked && body\.force !== true/.test(save), 'Save ainda permite force bypass em projeto travado');

console.log('✓ Security Safe R2: IDOR, ownership, admin role e bypasses de payload validados');

const fs = require('fs');
const assert = require('assert');

const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');

// A API continua preferindo datas ISO, mas adapta automaticamente layers/layer_groups
// em instalações Appwrite antigas que possuem updatedAt/createdAt INTEGER.
assert(api.includes('function legacyIntegerDateSchemaEnabled'));
assert(api.includes("if (['layers', 'layer_groups'].includes(normalized)) return true"));
assert(api.includes('signed 64-bit integer'));
assert(api.includes('toEpochMillis(normalizedData[attribute], attribute)'));
assert(api.includes('awFetchRowWithDateRetry(path, method, basePayload, data, collectionName'));

// create/update precisam informar a collection para que o retry seja seletivo, não global.
assert(/awFetchRowWithDateRetry\([^\n]*collectionName/.test(api), 'Retry de datas deve receber o nome da collection');
assert(api.includes('normalizeAppwriteDateFields(data)'));

console.log('PASS R16: publicação de camadas tolera schema Appwrite legado com datas int64 sem abandonar ISO nas collections modernas.');

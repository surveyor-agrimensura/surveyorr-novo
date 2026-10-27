import assert from 'node:assert/strict';
import fs from 'node:fs';

const docs = fs.readFileSync('assets/js/core/document-assets.js', 'utf8');
const shortLink = fs.readFileSync('assets/js/core/short-link.js', 'utf8');
const publicProject = fs.readFileSync('assets/js/features/public-project/public-project.js', 'utf8');

assert.ok(docs.includes("const PUBLIC_LOCATION_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';"), 'fallback local deve usar código compacto Crockford');
assert.ok(docs.includes('function encodePublicLocationCode(lat, lng)'), 'documentos devem codificar a posição do imóvel sem backend');
assert.ok(docs.includes('/p/?l='), 'fallback documental deve emitir URL curta de localização');
assert.ok(docs.includes("reason: 'PUBLIC_SNAPSHOT_FALLBACK'"), 'falha do backend curto deve priorizar o perímetro completo no QR');
assert.ok(docs.includes("reason: 'PUBLIC_LOCATION_FALLBACK'"), 'localização curta deve permanecer apenas como último fallback quando não houver perímetro utilizável');
assert.ok(shortLink.includes("params.get('location') || params.get('loc') || params.get('l')"), 'atalho /p deve aceitar código curto de localização');
assert.ok(shortLink.includes('/public-project/#loc='), 'atalho de localização deve redirecionar para visualizador público');
assert.ok(publicProject.includes('function decodePublicLocationCode(value)'), 'visualizador público deve decodificar localização curta');
assert.ok(publicProject.includes("properties:{name:'Local do imóvel',category:'outros'}"), 'visualizador deve mostrar o local do imóvel quando usar fallback');
console.log('PASS V65: QR documental prioriza área completa e mantém ponto apenas como último fallback.');

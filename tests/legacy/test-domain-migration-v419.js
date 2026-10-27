import assert from 'node:assert/strict';
import fs from 'node:fs';

const cname = fs.readFileSync('CNAME', 'utf8').trim();
const manifest = JSON.parse(fs.readFileSync('RELEASE_MANIFEST.json', 'utf8'));
const apiConfig = fs.readFileSync('assets/js/core/api.js', 'utf8');
const api = fs.readFileSync('functions/surveyor-api/src/main.js', 'utf8');
const support = fs.readFileSync('functions/surveyor-support/src/main.js', 'utf8');
const geoFallback = fs.readFileSync('functions/surveyor-geoservices/src/main.js', 'utf8');

assert.equal(cname, 'surveyorr.com.br');
assert.equal(manifest.frontend.domain, 'https://surveyorr.com.br');
assert.equal(manifest.frontend.legacyDomain, 'https://surveyoragrimensura.tech');
assert.match(apiConfig, /PRIMARY_SITE_URL = 'https:\/\/surveyorr\.com\.br'/);
assert.match(apiConfig, /LEGACY_SITE_URL = 'https:\/\/surveyoragrimensura\.tech'/);
assert.match(api, /https:\/\/surveyorr\.com\.br/);
assert.match(api, /https:\/\/www\.surveyorr\.com\.br/);
assert.match(api, /\.\.\.defaults, \.\.\.configured/);
assert.match(support, /https:\/\/surveyorr\.com\.br/);
assert.match(support, /\.\.\.defaults, \.\.\.configured/);
assert.match(geoFallback, /https:\/\/surveyorr\.com\.br/);
assert.match(geoFallback, /\.\.\.defaults, \.\.\.configured/);
assert.match(api, /SURVEYOR_LOGIN_URL', 'https:\/\/surveyorr\.com\.br\/login\/'/);
assert.match(support, /SURVEYOR_LOGIN_URL', 'https:\/\/surveyorr\.com\.br\/login\/'/);
console.log('OK: domínio principal surveyorr.com.br com transição segura do domínio anterior.');

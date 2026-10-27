const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');

const required = [
  'lastLoginAt: loginAt',
  'lastLogoutAt: logoutAt',
  'authSessions: []',
  "const lastSessionCreatedAt = activeRefreshSessions",
  "const lastLoginAt = [explicitLogin?.createdAt, prefsLoginAt, lastSessionCreatedAt]",
  "!['refresh_rotated', 'session_resumed', 'presence'].includes",
  "const lastActivityAt = realActivity?.createdAt || null",
  'lastLogoutAt: coherentLogoutAt',
  'lastSessionCreatedAt, lastSessionRotatedAt'
];
for (const needle of required) {
  if (!api.includes(needle)) {
    console.error('FALHA R24.1: ausente:', needle);
    process.exit(1);
  }
}
if (api.includes("const accessEvents = userEvents.filter((event) => ['login_success', 'session_resumed', 'refresh_rotated']")) {
  console.error('FALHA R24.1: login ainda mistura refresh/session_resumed.');
  process.exit(1);
}
console.log('PASS R24.1: login, atividade, saída e timeline usam fontes coerentes.');

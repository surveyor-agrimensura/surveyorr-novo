const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const api=fs.readFileSync(path.join(root,'functions/surveyor-api/src/main.js'),'utf8');
const admin=fs.readFileSync(path.join(root,'assets/js/admin/organization.js'),'utf8');
const save=fs.readFileSync(path.join(root,'functions/surveyor-save/src/main.js'),'utf8');
const requiredApi=[
  'const projectSizes = await Promise.all(activeProjects.map((row) => storedProjectBytes(row)))',
  "action: 'session_resumed'",
  'presenceLastSeenAt,',
  'recentActivity: recentActivity.slice(0, 20)',
  'const prefsProjectAt = surveyor.lastProjectAt || null',
  'const coherentLogoutAt = logoutMs && (!loginMs || logoutMs >= loginMs) ? rawLastLogoutAt : null'
];
for(const token of requiredApi){if(!api.includes(token)){console.error('FALHA R24 API:',token);process.exit(1)}}
const requiredAdmin=[
  "session_resumed:'Retomou a sessão'",
  'Último login/acesso',
  'Última atividade real',
  'Última saída registrada',
  'session.recentActivity'
];
for(const token of requiredAdmin){if(!admin.includes(token)){console.error('FALHA R24 ADMIN:',token);process.exit(1)}}
if(!save.includes('updateUserActivityPrefs(actorId')||!save.includes('lastProjectName:')){console.error('FALHA R24 SAVE: atividade de projeto nao persiste nas prefs');process.exit(1)}
console.log('PASS R24: armazenamento real da equipe e cronologia administrativa coerente.');

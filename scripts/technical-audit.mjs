import fs from 'node:fs';

const files = [
  'assets/js/core/ui.js',
  'assets/js/features/mapa/app.js',
  'assets/css/core/ui.css',
  'assets/css/features/mapa/app.css'
];

const metrics = {};
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  metrics[file] = {
    lines: text.split('\n').length,
    bytes: Buffer.byteLength(text),
    important: (text.match(/!important/g) || []).length
  };
}

console.log('Surveyor — auditoria técnica de consolidação');
for (const [file, data] of Object.entries(metrics)) {
  console.log(`${file}: ${data.lines} linhas · ${data.bytes} bytes${data.important ? ` · ${data.important} !important` : ''}`);
}

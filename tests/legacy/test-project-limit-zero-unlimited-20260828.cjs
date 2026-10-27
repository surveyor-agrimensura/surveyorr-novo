const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const api = fs.readFileSync(path.join(root, 'functions/surveyor-api/src/main.js'), 'utf8');
const save = fs.readFileSync(path.join(root, 'functions/surveyor-save/src/main.js'), 'utf8');
const ok = (condition, message) => { if (!condition) throw new Error(message); };

ok(/function planLimitNumber[\s\S]*value > 0 \? value : null/.test(api), 'surveyor-api ainda trata projectLimit 0 como limite real');
ok(/function planLimit\(user, key\)[\s\S]*value > 0 \? value : null/.test(save), 'surveyor-save ainda trata projectLimit 0 como limite real');
ok(/projectLimit: officialRule \? null : \(row\.projectLimit == null \|\| row\.projectLimit === '' \|\| Number\(row\.projectLimit\) <= 0 \? null/.test(api), 'planos persistidos com projectLimit 0 não são normalizados para ilimitado');
ok(/projectLimit: officialRule \? null : \(input\.projectLimit == null \|\| input\.projectLimit === '' \|\| Number\(input\.projectLimit\) <= 0 \? null/.test(api), 'edição de plano ainda pode persistir projectLimit 0 como bloqueio total');
ok(/featuresInput\.map/.test(api), 'criação de projeto deixou de aceitar múltiplas feições no mesmo projeto');
ok(/await assertProjectCapacity\(auth, 1\)/.test(api), 'capacidade deve ser contabilizada por projeto, não por número de feições');
console.log('PASS: limite 0 não bloqueia projeto; múltiplas áreas continuam contando como um único projeto.');

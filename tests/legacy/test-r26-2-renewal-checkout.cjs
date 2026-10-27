const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const main=fs.readFileSync(path.join(root,'functions/surveyor-api/src/main.js'),'utf8');
const portal=fs.readFileSync(path.join(root,'assets/js/core/portal.js'),'utf8');
function ok(v,m){if(!v)throw new Error(m)}
ok(main.includes("/api/billing/renewal-login"),'rota de login exclusivo de renovação ausente');
ok(main.includes("/api/billing/renewal-handoff/verify"),'rota de verificação do handoff ausente');
ok(main.includes("/api/billing/renewal-handoff"),'rota autenticada de handoff ausente');
ok(main.includes("/api/integrations/payments/account-lookup"),'lookup interno de conta para nova assinatura ausente');
ok(main.includes("type: 'payment-renewal-handoff'"),'token curto de renovação ausente');
ok(main.includes("renewal: true") && main.includes("actionLabel: 'Renovar plano'"),'notificação automática não aponta para renovação');
ok(portal.includes('data-plan-renewal') && portal.includes("/api/billing/renewal-handoff"),'sininho não abre checkout inteligente');
ok(!main.includes('RENEWAL_ANNUAL_DISCOUNT_PERCENT'),'aviso de renovação não deve prometer desconto automático antigo');
console.log('PASS R26.2: nova assinatura desacoplada de conta e renovação inteligente por handoff curto.');

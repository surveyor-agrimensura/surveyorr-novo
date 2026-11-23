# Lembretes de vencimento por e-mail

O envio de lembretes não tem agendador configurado neste repositório. Um agendador externo confiável pode chamar:

```http
POST /api/integrations/conecta-plus/notifications/plan-expiry-email
Authorization: Bearer <CONECTA_PLUS_API_KEY>
```

A rota exige a chave de integração `CONECTA_PLUS_API_KEY` (mínimo de 32 caracteres), processa somente usuários não administradores com conta ativa cujo plano vence em 7 ou 1 dia, e retorna contagens agregadas. Chamadas repetidas após entrega confirmada não reenviam o mesmo lembrete para a mesma data de vencimento. O histórico fica nas preferências privadas da conta; a chave nunca deve ser colocada no frontend.

O endpoint não agenda execuções por conta própria. A equipe deve configurar o serviço externo com uma frequência diária e guardar a chave em um cofre de segredos. A configuração do agendador e a execução de produção permanecem pendentes. Se a Function de e-mail não estiver configurada, o resultado contabiliza falhas sem modificar a data ou o acesso do usuário.

O lembrete orienta a pessoa a usar a área de renovação ou procurar o suporte; ele não inicia pagamento Pix nem cria QR Code.

---
description: Executa o ciclo universal multiagente para uma solicitação de software, da especificação ao gate final.
---

# /software-cycle

Ao receber `/software-cycle <pedido>`, use **coordenador-tecnico-geral** como líder e trate `<pedido>` como a solicitação original do usuário.

## Sequência obrigatória
1. Engenheiro de Prompt: normalize o pedido sem ampliar escopo.
2. Analista de Requisitos: produza critérios de aceite e não-objetivos.
3. Coordenador: classifique risco/superfícies e crie matriz ACTIVE/N/A.
4. Para projeto novo, domínio desconhecido ou tecnologia especializada: Analista de Lacunas; se necessário, Arquiteto de Agentes cria especialista temporário.
5. Arquiteto de Software/Guardião entram em mudança estrutural ou de médio+ risco.
6. Invoque especialistas técnicos ACTIVE. Trabalhos de leitura independentes podem rodar em paralelo; não permita edição concorrente do mesmo arquivo.
7. Programador/especialistas implementam somente após escopo e contratos estarem claros.
8. Qualidade e Manutenibilidade revisa/organiza o código modificado.
9. Auditor de Código faz revisão independente.
10. QA Funcional + QA de Regressão + Testes Automatizados entram proporcionalmente ao risco.
11. Segurança/Privacidade/Supply Chain/Pentest entram conforme superfície; autenticação, autorização, dados sensíveis, filesystem, IPC, pagamentos e internet-facing são de alta prioridade.
12. Build/Atualização/Backup/Cloud/SRE entram quando aplicáveis ao artefato ou operação.
13. Analista de Dados e Mudanças consolida relatório real do diff e evidências.
14. Arquiteto de Documentação atualiza documentação/ADR se necessário.
15. Release Manager emite GO/NO-GO. Se NO-GO, volte para correção e repita gates afetados.
16. Coordenador responde ao usuário com: o que mudou, arquivos principais, testes reais, riscos/pendências e status final.

## Regra de autonomia
Não obrigue o usuário a chamar agentes manualmente. Só faça pergunta quando um dado ausente impedir execução segura; caso contrário, use hipótese conservadora explícita.

## Regra de honestidade
Nunca diga que um agente/teste/build foi executado se não foi. Para agentes não pertinentes, marque `N/A` com motivo em vez de simular trabalho.

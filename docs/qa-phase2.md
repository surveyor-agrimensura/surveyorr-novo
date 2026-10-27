# SURVEYORR — roteiro integrado de homologação da Fase 2

**Versão preparada:** `1.0.0-rc.185.63` • **base:** `rc.185.62`

## Princípios

- Usar **conta Appwrite de QA, projeto de teste e cópia de segurança**. Nunca testar concorrência ou falhas de rede sobre imóveis únicos de clientes.
- Publicar **frontend e os serviços alterados em conjunto**, mantendo caminho de rollback.
- Verificar com DevTools (Network/Console), um PDF real e um Word real. `npm run verify` não substitui isso.
- Registrar por teste: resultado, navegador/versão, projeto sintético, ações e erro observado (sem senhas/tokens).

## A. Integridade dos dados

1. Criar perímetro sintético e 3 confrontantes com nomes diferentes, CPF/CNPJ e cores distintas; salvar. Reabrir em outra aba e conferir propriedades.
2. Desligar somente Cotas; salvar; reabrir. Os confrontantes permanecem e cotas ocultas não reaparecem.
3. Bloquear a rede antes de salvar uma mudança. O sistema não deve dizer «salvo na nuvem»; deve sinalizar rascunho pendente.
4. Duas abas: A salva primeiro; B tenta salvar versão anterior. Deve apresentar conflito em vez de sobrescrever A (depende do Appwrite; avaliar atomicidade real).
5. Quando a leitura da nuvem falhar e houver cache local, exibir aviso explícito de dados não confirmados.
6. Testar conta bloqueada e sessão revogada. Tentativas de POST/PATCH no backend devem ser recusadas após verificação atual.

## B. Documentos técnicos e cache

7. Editar nome, CPF e cor do confrontante; gerar prévia, SVG, Word e PDF. Conferir que todos usam a mesma escolha.
8. Gerar PDF A4, trocar para A3 e baixar de novo. O sistema deve gerar PDF correspondente ao formato atual.
9. Trocar de projeto enquanto um PDF está sendo preparado. Não deve baixar conteúdo misturado.
10. Alterar uma coordenada do perímetro no mesmo projeto, salvar e abrir Memorial. O mapa precisa refletir a nova geometria.
11. Alterar somente o estilo/nome de um confrontante e repetir Memorial com o mesmo zoom. O cache não pode mostrar nome antigo.
12. Abrir Memorial com mapa habilitado; gerar Word e PDF, confirmar que não reutiliza imagem antiga de outro estado.
13. Cadastrar 3 confrontantes distintos e simular prévia com rótulo ausente. Exportação não deve entregar documento incompleto sem aviso.
14. Verificar assinaturas e servidões: nenhum ponto de manipulação deve aparecer na exportação.

## C. Backend e estabilidade

15. Simular indisponibilidade temporária do Storage durante avaliação da quota; operação de escrita deve falhar de forma conservadora, não registrar 0 bytes.
16. Testar franquia e quantidade de downloads em duas sessões e, se possível, duas instâncias reais do serviço. **Contador entre instâncias ainda não possui transação distribuída homologada.**
17. Testar conjunto com mais de 100 projetos sintéticos: comparar tempos de uso de armazenamento, erros e carga no servidor.
18. Medir tempo de abrir Memorial, trocar aba, editar confrontante e gerar PDF (p50/p95, memória no Chrome/Brave); observar travamento com documentos longos.
19. Testar em janela desktop, notebook estreito e celular: ferramentas devem permanecer acessíveis sem cortar ações de salvar/baixar.
20. Testar alternância rápida entre projetos com gravações, rascunhos e downloads pendentes; nenhum documento pode pertencer ao projeto anterior.

## Critérios

- **Aprovado:** reprodução do cenário com resultado correto, arquivos e estado persistido conferidos.
- **Falhou:** erro reproduzido e registrado com versão e passos.
- **Bloqueado/não homologado:** dependência de ambiente ou credencial de QA. Não marcar como aprovado.

## Limitações conhecidas antes de produção

- Controle de revisão exige verificação de **compare-and-set atômico** entre instâncias do Appwrite; verificar e implementar infraestrutura transacional caso haja concorrência real.
- Contador diário permanece protegido **dentro de uma instância**, mas ainda exige armazenamento/contador atômico distribuído para garantia entre instâncias.
- O navegador/servidor Appwrite autenticado não foi homologado neste ambiente de análise.
- Geração com tiles Google diretos ainda depende de permissões/CORS/licenciamento do provedor e do contexto de exportação.

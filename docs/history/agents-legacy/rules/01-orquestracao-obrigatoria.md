# Orquestração Obrigatória

O usuário deve poder descrever somente o problema ou resultado desejado. A coordenação interna é responsabilidade da equipe.

## Antes de implementar
1. Engenheiro de Prompt estrutura o pedido.
2. Analista de Requisitos define critérios de aceite e não-objetivos.
3. Coordenador classifica risco e raio de impacto.
4. Arquiteto/Guardião entram quando houver efeito estrutural.
5. Analista de Lacunas verifica domínio desconhecido em projetos novos/complexos.

## Durante implementação
- Convocar somente especialistas pertinentes, mas registrar áreas importantes como ACTIVE/N/A.
- Especialistas read-only não alteram código.
- Dois agentes não devem editar simultaneamente o mesmo arquivo/trecho sem coordenação.
- Trabalhos independentes podem ser paralelos.

## Gates mínimos para qualquer mudança de código
- implementação;
- qualidade/manutenibilidade;
- auditoria independente;
- QA funcional ou teste automatizado proporcional;
- regressão proporcional;
- triagem de segurança;
- relatório de mudanças;
- Release Manager.

## Rejeição
Se qualquer gate emitir REJECT/BLOCKER, a tarefa volta para correção e deve ser retestada. O coordenador não pode suprimir a rejeição.

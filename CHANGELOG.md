## 1.0.0-rc.185.74 — Download SVG vetorial da prancha técnica

- Corrigido o download do SVG na área de Pranchas técnicas e Mapas/Croquis: o link agora é anexado ao DOM e sua URL Blob só é liberada após 180 segundos, evitando falhas de transferência por liberação em 1 segundo.
- O SVG continua sendo obtido diretamente da cena documental atual e preserva as edições de geometria, rótulos, cotas e confrontantes; nenhuma geometria foi inventada ou alterada.
- Quando o navegador interromper ou bloquear uma tentativa, o menu oferece **SVG pronto: Salvar novamente**, sem consultar a nuvem ou regenerar o arquivo. O comando verifica imóvel e versão da cena antes de reutilizar o SVG.
- Teste dinâmico cobre arquivo vazio, clique com âncora anexada, janela de validade Blob, retentativa pelo usuário, mudança de projeto e cena, e liberação final de recursos.
- Homologação visual no Chrome e verificação do download em instalação pública ainda pendentes.

## 1.0.0-rc.185.73 — Início das automações seguras no editor

- O botão Organizar preserva deslocamentos antigos e manuais de vértices, cotas e confrontantes; somente rótulos sem posicionamento prévio podem ser reorganizados.
- O histórico ativo recebe cada operação do organizador e aplicação de perfil como uma única alteração reversível.
- Perfis visuais deixam de disparar reposicionamento automático de elementos.
- Mantidos cadastros, geometrias, servidões, personalização e Copiloto removido.
- Esta etapa NÃO introduz ainda detecção de colisões, revisão técnica consolidada nem preenchimento em lote.

## 1.0.0-rc.185.72 — Restauração da bancada de pranchas após remover o Copiloto

- **Correção comprovada:** o encerramento do editor técnico ainda acessava `aiConversationHistory`, `aiVoiceActive` e `aiVoiceRecognition`, excluídos na RC185.71. O `ReferenceError` interrompia a troca/encerramento da bancada de pranchas.
- Removidas exclusivamente as quatro instruções obsoletas do ciclo de fechamento, sem modificar o editor manual, o layout, os dados dos projetos, o motor geométrico ou a IA administrativa.
- Teste de regressão executa `close()` real em contextos de Pranchas, Mapas e Planialtimetria e impede o retorno dessas referências; mantém a validação de ausência do Copiloto.
- Homologação do fluxo completo em Chrome na hospedagem oficial permanece pendente.

## 1.0.0-rc.185.71 — Remoção do Copiloto IA no editor

- Removida a aba do Copiloto (chat, voz, comandos e CSS) da edição técnica de pranchas, mapas, perímetros, planialtimetria e loteamentos.
- Eliminadas as cargas da biblioteca do Copiloto, rotas `/api/editor/ai/*`, permissões e controles de cota no painel de usuários.
- Preservadas as ferramentas manuais, os confrontantes, a edição técnica, a IA **administrativa independente** e as preferências de usuários já cadastradas (sem exclusão de dados persistidos).
- A implantação completa exige publicar tanto o site quanto a Function `surveyor-api`; a atualização do site remove a interface do Copiloto independentemente da Function.

## 1.0.0-rc.185.70 — Copiloto: respostas válidas e tratamento de falhas

- Corrige o backend do Copiloto para exigir JSON com `message` e `actions`, rejeitando classificações de segurança ou textos livres recebidos como se fossem respostas do assistente.
- Solicita JSON ao OpenRouter, valida a estrutura devolvida e permite uma retentativa controlada, com erro explicativo caso o modelo continue incompatível.
- Cumprimentos simples são respondidos localmente sem consumo de chamada de IA nem alteração na prancha.
- Testes funcionais cobrem respostas válidas, saídas inválidas, cumprimentos e contrato da API; pranchas e demais funcionalidades permanecem intactas.
- Homologação da integração real com a chave OpenRouter/Appwrite e publicação da Function permanece necessária.

## 1.0.0-rc.185.69 — Copiloto: comandos locais e carregamento compatível

- Substitui a importação dinâmica do módulo `.mjs` pelo motor clássico carregado antes do editor, sem depender da compatibilidade MIME dos servidores estáticos.
- Roteamento local determinístico de comandos inequívocos para motores já existentes: organização geral, vértices/cotas, ajustar à tela, desfazer/refazer, listar confrontantes, atualização do nome por vértices e presets regulatórios.
- Consultas de ajuda locais e comandos simples não precisam de consulta a modelos externos; comandos não reconhecidos mantêm o serviço de IA existente e exigem autorização do servidor.
- Bloqueia execução parcial automática em pedidos compostos/ambíguos; o editor confirma falhas e resultados efetivos.
- Testes funcionais do executor e testes de carregamento nas páginas que compartilham o editor. Homologação real em Chrome com Appwrite continua necessária.

## 1.0.0-rc.185.68 — Copiloto: comandos verificáveis e confrontantes reais

- Inventário de confrontantes lido do documento aberto, organizado por vértices e lados do perímetro, incluindo intervalos sem cadastro.
- Leitura local de solicitações de listagem, sem gerar respostas imaginárias ou consumir chamadas ao modelo.
- O comando `set_confrontante` resolve ID e intervalos reais, aplica o mesmo renderizador SVG do cadastro manual e verifica o texto apresentado antes de confirmar.
- Erros, ações desconhecidas e respostas sem execução são apresentados ao usuário; ações executadas exibem que ainda precisam ser salvas.
- Evita aplicar respostas antigas da IA quando o documento ou confrontantes são alterados durante a solicitação.
- Backend passa a fornecer contrato explícito ao modelo, sem afirmar que uma sugestão já foi executada. Novos testes de comportamento.

## 1.0.0-rc.185.67 — Revisão do pacote enviado e estabilidade do editor IA/FSM

- Máquina de estados (JS/TypeScript): rejeita ferramentas inexistentes sem cancelar a ativa; contratos de ciclo de vida obrigatórios e bloqueio de transições se `deactivate()` falhar.
- Copiloto IA: status de permissão indisponível mantém controles bloqueados (servidor já valida); reabertura do editor religa eventos, encerramento limpa sessão de voz e conversa para evitar contexto cruzado.
- Copiloto: executa `set_confrontante` somente em confrontante cadastrado, para nome e imóvel; remove promessa de editar matrícula inexistente nesse modelo.
- Testes estáveis adicionados para FSM e contratos de Copiloto; distribuição gerada apenas pelo build.
- Arquivo de entrega de código-fonte exclui `.git` para preservar o histórico Git local do usuário e impedir sobrescrita de metadados no atualizador.

## 1.0.0-rc.185.65 — Download somente com ícone

- Corrigida a prioridade dos estilos do rodapé de Mapas/Croquis e Pranchas técnicas: o botão Download agora mostra apenas o ícone Lucide, sem o texto visual ao lado.
- Mantidos o tooltip ao passar o mouse, `aria-label` e as opções PDF, SVG e Word, sem mudança na implementação de geração ou salvamento.
- Regressão de especificidade de CSS e acessibilidade do botão Download; nenhum modelo cartográfico foi modificado.

## 1.0.0-rc.185.64 — Controles compactos com ícones reais

- Aplicação do estilo icon-only aprovado nas ações e abas técnicas de Mapas/Croquis e Pranchas; SVGs Lucide/Tabler locais, com licença mantida.
- Salvamento de rascunho distinguido visualmente do salvamento final, sem alterar seu armazenamento ou sua lógica.
- Navegação entre etapas por setas, rótulos em title/aria-label para mouse e teclado.
- Ajustes pontuais de tipografia da interface sem alterar os modelos de documento nem os geradores cartográficos.
- Regressão específica para ícones, tooltips e preservação dos nomes acessíveis.

## 1.0.0-rc.185.63 — Fase 2: consistência de documentos e armazenamento

- Memorial: chave de cache considera geometria, atributos, personalização, zoom, fundo e modo de renderização; elimina reaproveitamento de PNG de outro snapshot.
- Pranchas: cache da cena inclui conteúdo geográfico e visual, não apenas data de atualização; nomes de confrontantes são confrontados com o SVG antes de exportar.
- Mapas e Pranchas: SVG, Word e PDF chamam a mesma preparação assíncrona; o PDF só reutiliza o Blob se fonte e formato corresponderem.
- Backend: quota falha conservadoramente em leituras indisponíveis; contagem de uso utiliza metadados do Storage com cache limitado, evitando downloads sequenciais; limpeza corrigida das travas diárias em memória.
- Segurança de gravação: API confirma conta, perfil e revogação atual em mutações; função de Save consulta situação da conta e versão da sessão antes de criar/atualizar projetos.
- Recuperação de projetos: ao usar cache após falha da nuvem, avisa o usuário e emite evento explícito de dados não confirmados.
- Testes de regressão com funções reais da base e verificações de sintaxe. Homologação Appwrite/Chrome/Brave e concorrência distribuída pendentes.

## 1.0.0-rc.185.62 — Fase 2, bloco 1: integridade do salvamento

- **Editor técnico:** falha na nuvem mantém alterações pendentes, emite evento de falha, não anuncia sucesso e não libera download do documento como salvo; gravação na nuvem ausente é tratada como erro.
- **Rascunhos locais:** layout técnico identifica `pending` ou `confirmed`, e alterações pendentes reaparecem como tal quando a personalização é reaberta.
- **Salvamento dos documentos:** o botão principal reage ao erro do editor sem esperar o timeout completo e não inicia outras gravações após falha técnica.
- **Confirmação de projeto:** usa a mesma rotina para Mapa e cadastro e editores técnicos, verificando geometrias, nomes, categorias, ordem, cores, propriedades, CPF e metadados editáveis, desconsiderando apenas metadados de controle regenerados pelo servidor.
- **Revisão obrigatória:** gravações de bundle na Save Function e alterações de projeto/feições na API exigem revisão anterior. O módulo CAR, Mapa e cadastro e os clientes de salvamento foram adaptados.
- **Regressão:** novo teste funcional com falha/sucesso simulados, alterações somente cadastrais e de estilo, revisão ausente/antiga e preservação de rascunho; `npm run verify` obrigatório.
- **Pendência de homologação:** nenhuma instância Appwrite de QA nem sessão autenticada foi usada para validar simultaneidade distribuída; antes de produção, testar implantação coordenada do frontend e das Functions e confirmar migração de clientes antigos (HTTP 428).

## 1.0.0-rc.185.61 — Preto padrão para confrontantes

- Confrontantes com branco herdado de layouts anteriores e sem personalização explícita agora usam preto (#111827) nas pranchas, croquis e PDF/SVG.
- Cores escolhidas individualmente (inclusive branco explícito) continuam preservadas no renderizador e no editor.
- O SVG transmite o marcador de personalização para evitar interpretar cor herdada como escolha deliberada.
- Acrescentado teste funcional de regressão; sem alterações em geometria, satélite ou posicionamento.

## 1.0.0-rc.185.60

- **Pranchas / PDF / confrontantes:** remove a tarja preta introduzida pela RC185.59. A camada de contraste agora usa texto SVG com `fill="none"` e apenas `stroke` fino (<= 1 unidade SVG), sem pintar uma segunda cópia inteira das letras de preto.
- A fonte original, sua cor por confrontante, CPF, coordenadas, posição e exportação vetorial permanecem inalteradas. A alteração fica restrita ao conversor de PDF dos documentos vetoriais.
- Atualiza testes de regressão para proibir preenchimento de fundo escuro e exigir que o contorno continue visível.

## 1.0.0-rc.185.59

- **Pranchas e croquis / PDF:** os nomes dos confrontantes continuam presentes no SVG, mas o antigo normalizador removia o contorno de contraste na conversão vetorial. Para nomes claros sobre a prancha branca isso tornava o texto quase invisível.
- **Correção de renderização:** contorno contrastante como texto SVG de fundo separado, antes do texto original na cor personalizada; não depende de `paint-order` do svg2pdf e não modifica o editor/salvamento.
- **Regressão:** testes de confrontantes claros e escuros, CPF e idempotência do preparador, além dos testes estáveis existentes.

## 1.0.0-rc.185.58

- **Pranchas técnicas / confrontantes:** impede que o salvamento de aparência, imagens ou visibilidade de cotas sobrescreva com uma coleção vazia os confrontantes cadastrados e seus trechos. Registros legados existentes permanecem intactos quando o editor não materializa segmentos.
- **PDF/SVG:** se confrontantes estão habilitados e cadastrados mas faltam na cena exportável, tenta recuperar a versão completa da fonte oficial; na impossibilidade, interrompe o download com aviso, em vez de entregar documento técnico incompleto.
- Adiciona testes de regressão para salvamento não destrutivo e proteção do PDF.

## 1.0.0-rc.185.57

- **Pranchas técnicas / Mapas e croquis:** corrige a desativação de Cotas, Cotas da gleba, Vértices, Confrontantes, Norte, Grade técnica e Escala gráfica ao ouvir alterações dos checkboxes criados dinamicamente pelo módulo de documentos (delegação do evento `change`). Antes, o botão do editor mudava de cor, mas o módulo técnico já havia tentado registrar eventos quando os checkboxes ainda não existiam.
- **Exportação:** reafirma a visibilidade atual dos elementos sobre o SVG antes do download, inclusive após reutilização do cache ou edição inline, preservando dados técnicos do projeto.
- Adiciona regressão que reproduz a criação tardia de `mapShowCotas` e a alteração via botão da Personalização.

## 1.0.0-rc.185.56

- Pranchas técnicas e Mapas/Croquis: visibilidade de Cotas, Cotas da gleba, Vértices, Confrontantes, Norte, Grade técnica e Escala gráfica agora integra o estado de personalização salvo por projeto.
- O clique nos cartões de elementos atualiza a prévia do SVG imediatamente e registra a escolha no editor para reabertura posterior.
- A troca de projeto restaura apenas suas próprias preferências de elementos, sem reaproveitar configurações de outro imóvel.
- Novo teste de regressão em `tests/stable/prancha-element-visibility-persistence.test.mjs` e atualização dos contratos legados.
- Instalador AGR Gerador Automático / Swift não incluído: binários originais não estavam disponíveis neste ambiente.

## 1.0.0-rc.185.55

- Memorial: cache de páginas da prévia e reaproveitamento da DOM entre trocas de abas, sem ocultar atualizações de assinaturas; preserva posição da rolagem.
- Memorial: atualização automática amortecida durante digitação, evitando iniciar geração pesada a cada tecla e reduzindo recálculos consecutivos.
- Interface documental: elevação localizada de fontes de formulários e mensagens, controles de tamanho mais confortável, foco de teclado visível e tamanho uniforme dos ícones.
- Responsividade: personalização e prévias com colunas flexíveis e alturas adaptativas em janelas menores, evitando mínimos rígidos de 760/520px na bancada.
- Correções restritas à interface: modelo A4, geometrias, assinaturas exportadas e componentes do mapa não foram modificados.

## 1.0.0-rc.185.54

- Mapas/Croquis e Pranchas: mantém URLs temporárias do PDF por tempo suficiente para concluir o download no Chromium/Brave, usando link anexado ao DOM.
- Mapas/Croquis e Pranchas: acrescenta "PDF pronto: salvar novamente" no menu de download, que reutiliza o PDF já gerado sem nova renderização.
- Exportação de PDF: falhas de geração ou salvamento apresentam mensagem explícita.

## 1.0.0-rc.185.53

- Memorial descritivo: o quadro de identificação agora utiliza **PROPRIETÁRIOS:** quando existem dois titulares, com cada nome, CPF/CNPJ e RG em uma linha própria, sem barras separando pessoas diferentes.
- Com apenas um titular, permanece **PROPRIETÁRIO:** e não são exibidos campos extras vazios.
- A correção é compartilhada entre o modelo padrão, modelos personalizados, Word e TXT; o RG do segundo proprietário agora é lido diretamente dos metadados do cadastro, sem misturá-lo com o RG do principal.
- Teste de regressão específico para identificação de coproprietários incluído na suíte estável.

## 1.0.0-rc.185.52

- Mapas e Croquis / Pranchas técnicas: menu de clique direito em cada confrontante agora permite definir Cor da fonte.
- A cor de cada confrontante tem precedência sobre a cor geral; texto branco recebe contorno escuro para legibilidade.
- A escolha individual é guardada no layout do projeto e aplicada novamente à prévia e ao SVG/PDF gerado.
- Atualizada a validação de regressão da cor individual de confrontantes.

## 1.0.0-rc.185.50

- Pranchas e Mapas/Croquis: exportações PDF/SVG removem as alças de edição da servidão (círculos, eixo de seleção, hitbox e rascunho temporário), inclusive em cenas antigas.
- O editor mantém os pontos de controle durante a edição; apenas o SVG publicado/exportado é limpo. A geometria, as duas bordas e os identificadores técnicos permanecem.
- Fonte Google observada no mapa público: não transplantada para PDF por depender de integração e licenciamento oficiais. Satélite atual e fontes já existentes preservados.

## 1.0.0-rc.185.49

- Mapas/Croquis e Pranchas: o modo Satélite usa por padrão o mosaico EOX Sentinel-2 cloudless 2016/2017, CC BY 4.0, com crédito de origem no SVG e sem fallback silencioso para fotos atuais com nuvens.
- Opção separada Satélite atual (Esri World Imagery) preservada para quem precisa de maior nitidez/atualidade, ciente da presença de nuvens.
- Minimapas e cenas compartilhadas respeitam o mesmo fornecedor e os limites Mercator do imóvel, inclusive nas atualizações assíncronas.
- Limitações explícitas: imagens antigas e com menor resolução, acesso ao serviço externo necessário, não garantido 100% livre de nuvens. Homologação visual e cobertura regional pendentes.

## 1.0.0-rc.185.48

- Mapas/Croquis e Pranchas: círculos auxiliares do polígono deixam de ser impressos, mas permanecem âncoras semânticas invisíveis para a edição; rótulos técnicos P/M/V seguem visíveis quando ativados.
- Mapas/Croquis: nova opção manual de imagem histórica Esri Wayback 2023-12-07, com cache próprio e sem fallback automático para a fotografia atual com nuvens.
- Preserve imagens existentes dos projetos; imagens históricas dependem de cobertura regional, conectividade e condições do provedor. Nenhuma garantia automática de cena sem nuvens.

## 1.0.0-rc.185.46

- Pranchas e croquis: os pontos GPS independentes deixam de integrar as plantas técnicas (perímetro e vértices desenhados preservados).
- Prancha técnica: minimapa usa os limites do perímetro cadastrado e um único enquadramento Web Mercator para imagem e contorno, inclusive nas atualizações assíncronas.
- Prancha técnica: troca de fundo limpa temporariamente a imagem anterior para não misturar satélite antigo com a escolha vetorial.
- Marcar pontos: pontos digitados ou importados podem ser classificados explicitamente como P (ponto) ou M (marco); V mantém-se como vértice virtual de desenho e é reconhecido nos cadastros legados.
- Quadros de assinaturas da Prancha e Memorial: linhas separadas para dois proprietários, incluindo modelos padrão e personalizado, além de Word e DOCX exato; um único proprietário mantém o modelo anterior.
- Escopo pendente: importar e salvar imagens independentes de assinatura de dois proprietários, aplicar a todos os modelos de Memorial e investigar controles de Cotas/Vértices em navegador autenticado; evitar armazenamento local como fonte única dessas imagens.

## 1.0.0-rc.185.45

- Mapa/GPS: encerra explicitamente a sessão de edição/desenho antes de criar um perímetro a partir de pontos importados; limpa somente os indicadores temporários da seleção automática, preservando os vértices P/M/V e a geometria salva. Editar continua apresentando os controles quando solicitado.
- Mapas/Croquis: opção experimental de imagem de satélite histórica Esri World Imagery Clarity para tentar evitar cenas com nuvens na base padrão. Não substitui automaticamente a fonte atual, não garante ausência de nuvens e depende da disponibilidade/termos do serviço.

## 1.0.0-rc.185.44 — Segundo proprietário opcional

- Mapa e cadastro: inclusão e remoção de segundo proprietário, com nome e documentos opcionais, persistido em `metadata.additionalOwner` do projeto na nuvem.
- Compatibilidade: sem segundo nome preenchido, não há coproprietário nem campos adicionais nas gerações; projetos existentes continuam válidos.
- Documentos: dois titulares são exibidos quando cadastrados nas gerações de Memorial, Mapas/Croquis, Pranchas, Planialtimetria, ODS e Perímetros; dados incluídos em exportações cartográficas.

## 1.0.0-rc.185.43

- Ícones: corrige as abas da personalização de Pranchas/Croquis que podiam aparecer como quadrados vazios; as abas "Prancha/Croqui" e "Elementos" agora mantêm rótulo visível no próprio botão, com ícone apenas complementar.
- Ícones: melhora o fallback visual das abas técnicas quando o SVG/máscara do navegador não renderiza.

## 1.0.0-rc.185.43

- Corrige a primeira integração de ícones: botões técnicos sem ícone novo deixam de exibir quadrados vazios.
- Completa o mapeamento visual para sheet, elements, miniMap e map nas telas técnicas.
- Mantém fallback seguro do SVG original quando um botão não tiver ícone mapeado.

## 1.0.0-rc.185.42 — ícones de interface (primeira integração)

- Integração local e seletiva de SVGs de Lucide e Tabler no workspace documental (Memorial, Mapas/Croquis, Pranchas, Planialtimetria e Loteamentos/REURB).
- Ícones nos comandos de salvar, restaurar rascunho, baixar, navegar e em ferramentas técnicas e abas do Memorial. Textos, ações, cores e dados foram preservados.
- Adicionados CSS canônico `action-icons.css`, SVGs selecionados, atribuições e teste de integração. Sem dependências externas de runtime.

## 1.0.0-rc.185.41 — Memorial: exportação PDF sem renderização redundante

- Memorial: reutiliza a geração já salva para o download do PDF, sem reconstruir o projeto e o croqui quando não houve alterações posteriores; mantém geração atualizada para mudanças pendentes.
- Memorial: cache de rasterização por página A4 com comparação exata do HTML. Uma assinatura movida continua sendo sobreposta na posição atual e não obriga a rasterizar novamente páginas inalteradas.
- Memorial: não espera oito segundos extras por imagens que já terminaram com erro (`complete=true`).
- Novo teste executável cobre cache de páginas, alteração de assinatura, invalidação seletiva, exportação de documento salvo e carregamento de imagens com falha.

## 1.0.0-rc.185.40

- Memorial: editor de assinatura preserva a geometria impressa da folha A4 durante a escala responsiva, alinhando a linha e a imagem com o PDF.
- Memorial: escala do editor recalculada ao redimensionar a bancada, sem alterar a posição persistida nem o gerador de PDF.

## 1.0.0-rc.185.39

- Memorial: a posição/página/tamanho da assinatura movida ou redimensionada são persistidos antes de regenerar e exportar; elimina retorno às coordenadas antigas do PDF.
- Memorial: uma única função de geometria A4 determina a posição da assinatura tanto na prévia responsiva (%) quanto no PDF (mm), inclusive com duas assinaturas.
- Memorial: Salvar em Projeto/outras abas não substitui a página da assinatura pelas coordenadas iniciais de um editor não ativo.
- Novo teste executável compara a posição após arrasto, salvamento, prévia HTML e chamadas de geração do PDF.

## 1.0.0-rc.185.38

- Memorial: a prévia do documento agora aplica a assinatura na mesma posição configurada para a exportação, removendo o desencontro entre tela e PDF.
- Memorial: assinaturas posicionadas na prévia deixam de usar o encaixe fixo do modelo quando a Personalização define posição/tamanho próprios.

## 1.0.0-rc.185.37

- Memorial: remoção individual de assinatura da conta e importada, sem apagar os respectivos arquivos.
- Memorial PDF: elimina imagens embutidas antes da composição para evitar assinaturas duplicadas; PDF e impressão aguardam geração atualizada.
- Memorial: invalidação imediata de PDF em cache quando uma assinatura muda; salvamento não confirma sucesso se a geração falhar.

## 1.0.0-rc.185.36 — Memorial: remover assinatura do documento

- Corrigido o botão de remoção na aba Assinatura: ele retira do Memorial a assinatura habilitada (importada ou da conta) e atualiza a prévia sem apagar o cadastro global da conta.
- Excluir importada é uma ação separada, mostrada somente quando há arquivo importado e com verificação do armazenamento antes de limpar o estado em tela.
- Seleção/remoção de assinaturas passa a persistir antes da atualização automática do modelo, evitando que o gerador restaure as preferências anteriores.
- Editor de assinatura não desenha cópia duplicada da assinatura da conta sobre a assinatura móvel; o documento exportado mantém sua própria renderização.
- Testes de comportamento asseguram remoção, persistência, alteração da prévia e proteção da assinatura da conta. Homologação com sessão autenticada permanece pendente.

## 1.0.0-rc.185.35 — Memorial: download sem travar a prévia

- Exportação de PDF e impressão deixam de apagar o conteúdo do Memorial e de manter um indicador de carregamento indefinidamente enquanto o arquivo é preparado.
- Geração do PDF apresenta andamento, tratamento de erros e proteção contra cliques simultâneos; não altera os modelos nem os dados técnicos.
- PDF pronto ganha link de download nativo no menu como alternativa se o navegador bloquear o início automático após a geração assíncrona.
- Downloads de Memorial (PDF, HTML, TXT e Word) utilizam âncora conectada ao DOM com janela segura de revogação para arquivos maiores; modelos DOCX personalizados recebem a mesma proteção.
- Testes de execução simulam exportação de PDF sem apagar a prévia, falha visível e download real dos formatos. Homologação visual em sessão autenticada do navegador permanece pendente.

## 1.0.0-rc.185.34 — Mapas/Croquis: Croqui e Elementos unificados

- Personalização: incorporado o conteúdo de Croqui no painel Mapa, antes de Elementos, eliminando a aba Croqui concorrente. Permanecem apenas Mapa, Aparência e Assinatura; os controles mantêm os vínculos existentes com o projeto.
- Reentrada no editor reaproveita o painel Mapa consolidado, sem recriar o painel removido e sem duplicar seus proxies.
- Interface provisória do editor é mantida oculta até terminar a montagem dos controles; HTML documental de origem não aparece antes do workspace oficial.
- Nos dois modelos de Mapas/Croquis, aumentado o tamanho mínimo dos nomes dos confrontantes para leitura na folha reduzida. Não se alteram os nomes, posições salvas, geometrias, módulos CAR/WFS ou outros modelos documentais.
- Adicionada auditoria estática específica do layout. Comprovação visual e de desempenho no navegador autenticado com SÍTIO JÓ permanece pendente.

## 1.0.0-rc.185.33 — Mapas/Croquis: rótulos na prévia e retorno mais leve ao Projeto

- Corrigido CSS exclusivo da prévia de Projeto para respeitar o contorno claro dos textos SVG, recuperando contraste e legibilidade dos nomes de confrontantes sobre imagem de satélite. O estilo do Memorial permanece inalterado.
- No retorno de Personalização para Projeto, reaproveitado o SVG final publicado pelo editor, incluindo rótulos e edições, sem recompor o mapa/satélite quando apenas campos ou elementos não estruturais mudaram. Mudanças estruturais de fundo, zoom e folha continuam provocando geração completa.
- Evitada remontagem do mesmo SVG caso a cena já esteja no DOM; observador de restauração monitora apenas substituições diretas no host da prévia, evitando inspeção de mutações internas no SVG.
- Uma seleção dos elementos por checkbox/radio agora aciona um único patch por alteração, preservando a visibilidade na cena e nos exports.
- Incluído teste comportamental de retorno e preservação dos rótulos. Mantidas geometrias, CAR/WFS, demais documentos e backend. Homologação autenticada com projeto real e medição de travamentos no navegador do usuário ainda pendentes.

## 1.0.0-rc.185.32 — Exclusividade da prévia e controles únicos em Mapas/Croquis

- Removido do DOM o SVG pesado da etapa Projeto enquanto a Personalização está ativa; apenas o SVG do editor permanece montado. O SVG original é preservado em memória para reabrir a etapa Projeto e exportar.
- O observador da etapa Projeto não recria a prévia quando a Personalização controla a tela nem durante a restauração após fechar o editor.
- Observador de tamanho da prévia suspenso durante a edição e reiniciado quando Projeto volta a mostrar a prévia.
- Controles espelhados: checkbox/radio/select geram um evento por alteração; eliminado segundo patch de SVG redundante, mantendo controles canônicos e os modelos exportados.
- Adicionado teste que executa o proxy duas vezes, comprova que os espelhos não se acumulam, e verifica que o proxy só envia um evento; a validação completa de navegador autenticado continua pendente.

## 1.0.0-rc.185.31 — Mapas/Croquis: custo de renderização durante edição

- Eliminadas reconstruções da prévia da etapa Projeto desencadeadas por alterações textuais enquanto o SVG técnico está aberto na Personalização. Os campos visíveis são atualizados diretamente no editor; a prévia adiada é atualizada ao voltar para Projeto.
- Timer de reconstrução de Projeto que esteja pendente é cancelado ao iniciar o editor; timers atrasados deixam de reconstruir o croqui durante a edição.
- Seletores estruturais deixam de agendar a mesma renderização duas vezes por `input` e `change`; seguem atualizando ao confirmar a escolha.
- Os arrastos de rótulos de confrontantes passam a processar o último movimento por quadro de animação, preservando a posição exata ao soltar e cancelando quadros pendentes ao encerrar.
- O estado de alteração pendente do editor passa a disparar eventos de mudança apenas quando realmente muda, reduzindo observações de DOM e controle do rodapé repetidos.
- Exportação SVG aplica campos textuais atuais quando a prévia da etapa Projeto estiver adiada; não utiliza valores antigos silenciosamente.
- Novos testes executáveis de reconstrução suprimida, eventos de edição e último movimento do arrasto. Não altera geometrias, CAR, modelos técnicos ou mecanismos de salvamento. A fluidez na sessão autenticada ainda precisa ser medida no navegador.

## 1.0.0-rc.185.30 — Mapas/Croquis: abertura única, desempenho e rótulos por trecho

- Evitada segunda geração da mesma prévia ao entrar em Personalização e chamadas concorrentes ao iniciar o editor.
- Eliminado novo GET remoto forçado da geometria quando o projeto completo já está carregado na própria tela.
- Fundo SVG/satélite da edição agora utiliza URL temporária de Blob, sem codificação FileReader/base64 redundante; revogação da URL ao fechar.
- Corrigidas coordenadas ausentes de rótulos manuais: valores nulos não são mais interpretados como posição (0,0); nomes voltam a ser posicionados no centro do trecho.
- Removido duplo ajuste inicial de zoom no editor integrado.
- Mantida a base cartográfica, os modelos técnicos e a exportação. O comportamento visual com sessão real ainda precisa de homologação.

## 1.0.0-rc.185.29 — Resposta da edição de Mapas e Croquis

- Reduzido o trabalho durante a digitação de confrontantes na personalização: o texto do rótulo existente muda imediatamente, mas o recálculo de sua geometria, caixas de interação e cadastro de opções Auto ocorre na confirmação do campo (`change`). A criação inicial de um novo rótulo permanece imediata.
- Estado de alteração pendente é sinalizado uma vez durante a sequência de teclas, preservando histórico e confirmação do campo.
- Reconstruções estruturais de prévia vetorial/satélite passam a aguardar pelo menos 180 ms sem novos eventos, eliminando regenerações sucessivas geradas por eventos `input`/`change` rápidos. Atualizações diretas no SVG continuam instantâneas.
- Removida aplicação duplicada de configurações visuais no mesmo evento de controle para evitar duas varreduras completas do SVG no mesmo ciclo.
- Adicionado teste de execução com campos de confrontantes simulados e verificação real do agendador de redraw; mantidas geometrias, exportação, arquivos de modelo e as demais ferramentas.
- Homologação autenticada e medição de FPS/long tasks no navegador do usuário permanecem pendentes; esta atualização corrige fontes identificadas de trabalho redundante, não comprova por si só ausência total de lag.

## 1.0.0-rc.185.28 — Central de Lotes: erro ODS e isolamento de falhas

- Corrigida a falha reproduzida `Cannot set properties of null (setting 'href')` no renderer de Planilha ODS quando a reorganização da interface remove o atalho `Editar vértices` do DOM. O link agora é opcional e sua ausência não invalida a planilha.
- Cada documento do lote é processado independentemente. Uma falha na ODS ou em outro gerador não descarta PDFs e arquivos auxiliares concluídos anteriormente.
- Lotes com resultado incompleto são rotulados como **parcial**, com mensagem na interface, `ERROS_GERACAO.txt` na pasta do lote e detalhes em `RELATORIO_GERACAO.json` dentro do ZIP. Nenhum arquivo simplificado é utilizado como substituto de documento oficial.
- Incluído teste de execução em VM reproduzindo a exceção ODS na versão anterior e testando a sobrevivência de documentos quando um dos geradores falha.
- Sem novos recursos de recuperação offline ou alterações da geometria, CAR, modelos de documentos e personalização.

## 1.0.0-rc.185.27 — Central de Lotes e modelos oficiais

- Central deixa de gerar Memorial, Prancha, Croqui e ODS por meio dos PDFs simplificados do dossiê. Agora utiliza os motores oficiais de cada módulo em contexto temporário e somente leitura por lote, preservando os modelos e a personalização da conta.
- A geometria de cada lote é isolada sem modificar o projeto na nuvem. Geração ocorre sequencialmente e reporta erros individuais; não entrega documento simplificado em caso de falha do gerador oficial.
- Geração isolada não cria links públicos do imóvel original para lotes. QR ligado ao projeto inteiro é omitido para não indicar endereço incorreto da gleba.
- CSV, GeoJSON, KML e quadro auxiliar de confrontantes permanecem pelo gerador de dados técnicos; não são anunciados como modelos documentais oficiais.
- Teste do contexto temporário, bloqueio de escrita e preservação dos confrontantes na exportação por lote.
- Limitação: homologação visual autenticada de geração PDF no navegador ainda necessária.

## 1.0.0-rc.185.26 — Central de Lotes: layout compacto aprovado

- Removidos do cabeçalho da Central o selo de teste experimental e o texto de apresentação redundante, mantendo título e botão Abrir mapa.
- Removido o aviso longo de primeira versão no painel de peças técnicas, sem alterar os rótulos transparentes de prancha preliminar e ODS não oficial nem os avisos técnicos internos do ZIP exportado.
- Neutralizados apenas na Central os estilos globais de `input` que ampliavam checkboxes para largura de 100% e altura mínima de 42 px: caixas de seleção de lotes e peças agora têm 16×16 px.
- Painéis alinhados, opções documentais com caixas compactas e coluna dupla em desktop; empilhamento preservado em telas menores.
- Preservados projeto, lotes, menu, geração de ZIP, permissões, geometria, documentos e demais módulos.
- Adicionado teste de regressão de layout e preservação dos controles.

## 1.0.0-rc.185.25 — Central de Lotes visível no menu Ferramentas

- Corrigido o agrupamento real do menu Ferramentas em `assets/js/core/ui.js`: o segundo construtor eliminava a Central de Lotes já inserida por `layout.js`.
- Central de Lotes agora aparece em **Análise e campo**, imediatamente após **Projetos**, quando o usuário dispõe de `projects:export-zip`.
- Preservadas as regras existentes de plano e as rotas; plano sem essa permissão não recebe o link.
- Adicionado teste que reproduz a reconstrução do menu em um DOM simulado, falha na RC185.24 e confirma a integração, sem duplicar entradas.
- Cache de assets sincronizado com a nova release; os geradores, a geometria e o backend não foram alterados.

## 1.0.0-rc.185.24 — Central de Lotes experimental

- Nova tela /central-lotes/ para selecionar projeto salvo e um ou vários polígonos, gerando ZIP organizado por lote.
- Reuso de PDF/ODS/CSV/GeoJSON/KML do motor de dossiê, com prancha preliminar claramente identificada.
- Seleção automática de glebas quando o projeto já possui subdivisões; relatório por lote e resumo CSV.
- Validação de geometrias antes de gerar; nenhuma alteração no projeto da nuvem e nenhum novo mecanismo offline.
- Funcionalidade experimental: peças não equivalem aos modelos profissionais personalizados e dependem de homologação autenticada.

## 1.0.0-rc.185.23 — Correções operacionais após auditoria Antigravity

- Memorial e documentos: conferência de geração com limite de tempo, tratamento de falhas e mensagem explícita (sem confirmar dados não verificados).
- Pranchas e Mapas/Croquis: limites de tempo na preparação e abertura, liberação de overlays e saída de erro visível.
- Planilha: campos opcionais resistentes a ausência no DOM, proteção contra mudança rápida de projeto, bloqueio de exportação inválida e botão ODS agora conectado a geração OpenDocument via XLSX.
- Salvamento: estado “salvo localmente” apenas após sucesso confirmado pela rotina de recuperação já existente; nenhum novo mecanismo offline.
- Navegação: menu lateral fecha com clique externo em fase de captura e Escape; `/projetos/` passa a redirecionar para `/nuvem/`.
- Segurança local: servidor de desenvolvimento serve somente recursos públicos e páginas do frontend; arquivos internos não expostos por URL.

## RC185.22 — marca circular oficial integral
- Substituído `assets/logo.png` pelo arquivo PNG oficial enviado, preservando **exatamente os bytes originais** (SHA-256: `d45b6077f6993dfa140f1dac0eb22f57ad597b5bc18b11a855c9460eb5ec2e1c`). O arquivo anterior terminava com a borda inferior cortada.
- Atualizados os ícones instaláveis da PWA (192 e 512 px), derivados da marca completa com margem transparente para preservar a circunferência.
- Ajustado o enquadramento da imagem do hero da Home para exibir a marca completa sem o respiro transparente extra abaixo do círculo. O cabeçalho textual `nome.png` não foi modificado.
- Criado teste estável de regressão que falha para a imagem antiga e valida a marca oficial e as referências principais.
- Cache de assets sincronizado com a RC185.22 por `npm run version`; distribuição atualizada exclusivamente pelo processo de build.

## RC185.21 — continuidade da auditoria de personalização e módulos compactos
- Corrigida a especificidade da regra de até 900 px da bancada documental compacta. A versão anterior conservava as colunas do desktop porque o seletor base tinha `:not(...)` e prevalecia mesmo após o `@media`.
- Melhorada a leitura dos campos e comandos compactos de Projeto/Personalização (Mapas/Croquis, Memorial, Pranchas, Planialtimetria e módulos que usam a bancada): fontes operacionais de 8,5–9 px passam a 11 px, sem modificar a tipografia da prancha/PDF.
- Melhorada a legibilidade das ações de rascunho e do menu de download da Prancha.
- A personalização integrada do Memorial passa a empilhar painel e prévia até 900 px, com rodapé e zoom ajustados; os rótulos/abas deixam de usar 8,5–10 px. A janela modal antiga e a exportação do Memorial não foram alteradas.
- Incluídos testes estáveis de regressão para a cascata, o Memorial e os tamanhos de controles; preservados os rótulos acessíveis adicionados na RC185.20.
- A validação real de renderização nas telas autenticadas permanece separada dos testes automatizados de código.

## RC185.20 — legibilidade e responsividade do editor integrado
- Corrigida a cascata do editor de personalização: abaixo de 900 px a coluna de ferramentas fica acima da prévia, sem ser anulada pela regra canônica posterior. O rodapé acompanha o layout compacto.
- As abas das ferramentas da personalização usam texto de verdade no DOM (incluindo abas dinâmicas), em vez de texto no `::after` CSS. Teclado recebe contorno de foco visível.
- Aumentada a legibilidade dos controles do editor integrado e dos campos de confrontantes, sem mudar fontes e coordenadas do desenho exportado.
- Teste de regressão específico de ordem CSS, texto visível e tamanho dos controles. Homologação visual autenticada em navegador ainda pendente.

## RC185.19 — bordas da gleba e confrontantes por intervalo
- Glebas que tocam o perímetro original são validadas pela conservação da área no recorte real, sem rejeição de `booleanWithin` para limites compartilhados.
- Desenhos com área realmente fora do imóvel continuam rejeitados, preservando o perímetro.
- Editor técnico preenche os campos dos lados cobertos por um único confrontante V-inicial a V-final, com um só rótulo e sem excluir confrontantes de outros trechos.
- Adicionado teste de regressão com execução dos fluxos geométrico e intervalar.

## 1.0.0-rc.185.16 — Gleba manual separada e linhas técnicas por confrontante

- No editor de linhas técnicas, o botão **Auto** só aparece quando há confrontantes cadastrados com vértices válidos. Ao abri-lo, o usuário seleciona o confrontante; são geradas duas linhas editáveis, uma em cada vértice extremo, sem duplicações.
- A ferramenta **Desenhar gleba manual** pode ser finalizada pelo novo botão, por Enter ou por duplo clique após três pontos, sem exigir clique preciso sobre um marcador.
- Ao concluir, a geometria desenhada é recortada do polígono original com `turf.difference`; a área remanescente passa a ser uma camada independente com metragem recalculada, preservando metadados e desfazer da operação. Operações que não conseguem recortar a geometria com segurança são recusadas sem alteração.
- Incluídos testes de regressão executáveis para controle Auto, quantidade de linhas, finalização livre, corte e interface do editor.

## RC185.14 — Bandeja de ferramentas alinhada à barra do mapa

- Expansão de ferramentas alinhada dinamicamente à divisória Camadas/Polígono (esquerda) e à divisória depois de Verificar (direita).
- Elimina largura fixa de 720px; a malha compacta distribui botões de 42px com até 13 colunas, sem ultrapassar as divisas.
- Ajuste automático em resize, scroll e largura reduzida, com fallback dentro da tela; mantém todos os botões e handlers originais.
- Incluído teste de geometria de posicionamento e regressão da barra.

## RC185.13 — Estados reais da fila de imóveis

- Lista compacta com indicadores dinâmicos de **Na fila**, **Pronto**, **Selecionado** e **Tentar**, derivados da fila e da geometria verificadas, sem simulação visual.
- A seleção permanece marcada enquanto a pesquisa estiver aberta; a busca seguinte cancela apenas trabalhos pendentes, sem apagar geometrias confirmadas.
- Os primeiros três resultados são antecipados e a fila avança após os cliques, até duas consultas em paralelo.
- Teste de regressão do estado de fila e da atualização de seleção.

## RC185.12 — Pré-carregamento progressivo de geometrias por janela móvel

- Ao exibir resultados de imóveis por nome, a fila de pré-carregamento prepara **os três primeiros** (ou todos, se houver um a três resultados), com **até duas consultas de geometria simultâneas em segundo plano**.
- Ao clicar em um resultado, a próxima posição é agendada imediatamente, sem esperar a localização atual terminar. Exemplo: janela inicial 1–3; ao clicar no 1º, agenda o 4º; ao clicar no 2º, agenda o 5º.
- O clique reaproveita uma requisição WFS em andamento, como já ocorria na RC185.11. O hover prioriza o imóvel apontado na fila. Quando a pesquisa/município muda, tarefas pendentes da pesquisa anterior são descartadas.
- A pesquisa com 1.000 imóveis **não dispara 1.000 geometrias**, para não sobrecarregar os serviços oficiais; a antecipação acompanha a navegação. Preservada a validação por CAR e o cache persistente de geometria verificada.
- Adicionado `tests/stable/property-progressive-prefetch-rc18512.test.mjs`, incluindo cenário de 1.000 resultados, limite de concorrência, avanço sequencial, buscas curtas e troca de pesquisa.
- Limite: primeiro acesso a geometria ainda não armazenada depende de resposta WFS; sem garantia de instantaneidade online.

## RC185.11 — menor espera em Localizar, sem alterar CAR/geometria

- Corrigida a preparação da lista: agora **os dois primeiros imóveis** podem ter a geometria antecipada, em vez de preparar somente o primeiro. Para buscas genéricas o início é adiado brevemente, com limite de 2 pré-carregamentos simultâneos e 4 por pesquisa. O cursor também antecipa a consulta após 75 ms (antes 250 ms).
- Ao falhar um gateway WFS, a próxima rota candidata pode ser acionada **sem esperar o timeout de outra rota ainda pendente**, preservando no máximo duas requisições simultâneas e três rotas por chave CAR. Rotas com HTTP 502/503/504 recebem pausa temporária, e rotas comprovadamente rápidas passam a ter preferência durante a sessão.
- Toda geometria continua sujeita à correspondência exata de CAR/identidade oficial. Cache persistente e busca local permanecem intactos.
- Novos testes de execução simulam rota indisponível, rota lenta, rota alternativa rápida, geometria incorreta e pré-carregamento do segundo item.
- A primeira localização de imóvel ainda não armazenado depende de uma resposta WFS; **não existe garantia de tempo fixo sem o serviço oficial**.

## RC185.10 — localização mais responsiva e geometrias verificadas persistentes

- Na localização de imóveis pesquisados pelo índice municipal, a mesma consulta WFS pode usar até **dois gateways em paralelo**, aceitando exclusivamente a geometria cujo CAR/ID oficial coincida com o resultado escolhido. Isso evita aguardar 10 segundos por uma rota lenta antes de tentar outra.
- Geometrias confirmadas são salvas em um **IndexedDB separado** do índice de pesquisa (`surveyor-property-verified-geometry-v1`), para serem reutilizadas mesmo após recarregar a página. O cache é limitado a 120 entradas, com validade de 90 dias e proteção contra geometrias muito grandes.
- Pesquisas específicas (até três resultados) antecipam a recuperação do primeiro polígono sem varrer a base inteira. Mantida a antecipação por hover e a deduplicação das requisições.
- Acrescentado diagnóstico de tempo no Console (`[Surveyor] Localizar`) e teste de regressão com uma rota lenta, outra rápida, cache persistente e rejeição de CAR divergente.
- A primeira localização ainda depende da resposta WFS; esta revisão não garante tempo fixo de rede e não modifica os serviços externos.

## RC185.9 — Navegação para imóvel após análise de vídeo (39 segundos)

- O vídeo demonstrou períodos de mapa sem imagens durante os saltos de localização: aproximadamente 9,97–10,23s, 21,70–22,77s e 37,50–37,77s. Trata-se do carregamento de tiles após mudar o enquadramento, não necessariamente de espera WFS.
- Pré-aquecimento conservador da geometria ao manter o ponteiro 250ms sobre um resultado (máximo de quatro por pesquisa, um pré-carregamento de cada vez); o clique reutiliza a mesma requisição WFS, sem duplicação.
- O botão apresenta imediatamente “Localizando…” enquanto aguarda, com restauração do estado após sucesso ou falha.
- Saltos distantes de imóveis usam `fitBounds` sem animação, evitando atraso adicional de câmera. Consultas oficiais e identidade pelo CAR permanecem protegidas.
- Adicionado teste de regressão `property-navigation-video-rc1859.test.mjs`, incluído na suíte estável.
- Limite: os tiles de satélite ainda necessitam de resposta de rede; não foi prometida eliminação de sua latência, nem feita medição real do WFS externo.

## RC185.8 — Pesquisa por nome mais precisa e consulta de detalhes mais rápida

- O índice municipal passa a exigir **todos os termos significativos** do nome do imóvel, em vez de aceitar qualquer palavra isolada. Exemplo: buscar `Sítio Riu Bahia` deixa de retornar indevidamente `Sítio Bahia`.
- Busca genérica por `Sítio` continua funcionando; consulta por CAR e o filtro municipal permanecem intactos.
- Com índice municipal instalado, resultado vazio é exibido imediatamente, sem consulta online lenta e desnecessária. A consulta online continua funcionando quando não existe índice municipal instalado.
- A consulta online também exige todos os termos relevantes na pontuação final do resultado.
- Ao abrir informações de uma geometria CEFIR já identificada, elimina consulta WFS por ponto redundante e evita aguardar SICAR para exibir os dados disponíveis; SIGEF e os enriquecimentos de CAR seguem disponíveis conforme o fluxo existente.
- Novo teste de execução `tests/stable/property-search-precision-speed-rc1858.test.mjs` cobre pesquisas com termos ausentes, consulta genérica, índice sem resultados e ausência de consultas duplicadas no painel.
- Não foram alterados CAR/geometria, regras comerciais, estruturas de armazenamento ou cálculo cartográfico. A velocidade real de geometrias não armazenadas ainda depende dos serviços WFS.

## RC185.7 — Correção da associação CAR ↔ geometria WFS

- Busca rápida em IndexedDB preservada.
- Geometrias de resultados com CAR são solicitadas por filtro CQL exato do CAR, com variantes compacta e pontuada, e nunca por FEATUREID sequencial.
- Mesmo FID não autoriza associar feição sem CAR ou com CAR diferente. Para registros sem CAR, somente identificadores cadastrais explícitos podem validar a geometria.
- Cache da geometria usa CAR ou código oficial, não ID transitório do WFS; resultados armazenados também são revalidados.
- Teste de execução com WFS simulado reproduz a colisão de FIDs, bloqueia Fazenda Jericó e confirma seleção por CAR do sítio correto.
- Sem alterações de regras comerciais, cálculos de área ou filtros da pesquisa local.

## RC185.6 — recuperação de geometria com fallback limitado e seleção real

- Corrigida regressão da RC185.5: falha da consulta inicial WFS por `FEATUREID` não pode encerrar automaticamente a tentativa exata pela chave CAR. A seleção mantém **limite de duas consultas** e a comparação estrita de identidade.
- Botão **Localizar** só marca o imóvel como **Visualizando** quando a geometria foi obtida e renderizada com sucesso.
- Novo teste de execução (`tests/stable/property-geometry-retry-runtime-v186.test.mjs`) com respostas simuladas: primeiro gateway falhando e segundo respondendo, CAR divergente e indisponibilidade total. O teste novo falhou antes da correção e passou depois dela.
- Preservado o índice local sem geometria, a filtragem municipal e o restante do projeto. **Limite operacional:** caso nenhuma consulta WFS retorne uma geometria, a aplicação não pode reconstruir um polígono apenas com nome/CAR do índice. A RC185.6 não comprova disponibilidade do serviço externo em tempo real.

## RC185.5 — recuperação WFS sem avalanche de erros 502

- Mantida a busca instantânea pelo índice local e a identidade estrita entre candidato e geometria oficial.
- Recuperação WFS limitada aos identificadores oficiais relevantes (máximo de três consultas); sem consultas indiscriminadas por campos de cadastro.
- Ao falhar o gateway, interrompe novas consultas do mesmo imóvel e mantém dados locais intactos.
- Tentativa direta à fonte como último recurso, sujeita a CORS e disponibilidade do servidor.
- Novo teste estável de orçamento de requisições e identidade.
- **Limite:** o frontend não pode corrigir um gateway remoto HTTP 502; a disponibilidade real exige teste do serviço e eventualmente manutenção no backend.

## RC185.4 — Associação segura entre resultado da busca e geometria oficial

- O hidratador de resultados da pesquisa local não escolhe mais a primeira geometria retornada pelo WFS: exige correspondência verificável por CAR ou identificador oficial.
- O cache de geometrias também passa a revalidar a identidade antes de reutilizar polígonos.
- A montagem do imóvel localizado deixa de mesclar nome, CAR e município do índice com atributos oficiais de outra geometria.
- O índice compacto preserva separadamente o município original quando presente; a cidade escolhida para baixar o índice deixa de ser apresentada como atributo oficial do imóvel.
- Mantida a pesquisa rápida local e o filtro municipal já implementado. Um resultado sem geometria correspondente apresenta aviso de indisponibilidade, em vez de desenhar um imóvel diferente.
- Incluído teste `property-identity-hydration-regression.test.mjs`.

## RC185.3 — Busca municipal filtrada sem perder pesquisa rápida

- Filtra resultados do índice local pelo município codificado no CAR original, sem confiar no município associado à instalação do índice.
- Filtra os resultados online pelos atributos municipais originais, com correspondência exata do código IBGE ou nome do município.
- Mantém o funcionamento original do botão Localizar e da recuperação de geometrias, sem novas barreiras nessa operação.
- Registros sem município verificável não são exibidos como pertencentes à cidade escolhida.
- Incluído teste `property-city-scope-regression.test.mjs` com exemplos de Amargosa e outro município.

## RC185.2 — Recuperação do fluxo original da pesquisa rápida de imóveis

- Restaurado o mecanismo de busca e seleção de imóveis a partir da base anterior às intervenções no filtro municipal (`MEMORIAL_MAPA_LAYOUT_CORRIGIDO`), mantendo as demais funcionalidades recentes.
- Restaurado o índice local compatível com downloads preexistentes: removidas exigências posteriores de selo municipal e validação de geometria que impediam o botão Localizar.
- Retirados da suíte os testes introduzidos exclusivamente para as validações revertidas. Os testes preexistentes de busca local continuam ativos.
- ATENÇÃO: esta recuperação não é uma solução definitiva de filtragem municipal. Resultados antigos podem abranger imóveis de outras cidades; é necessária futura correção independente, sem comprometer a busca instantânea.
- Release diferenciada para evitar confusão com conteúdo em cache.

## RC185.1 — Identificação exclusiva e validação da atualização local

- Release identificada como `1.0.0-rc.185.1` para diferenciar o JavaScript das entregas anteriores que usavam o mesmo cache-buster.
- Arquivos HTML, versões internas, manifesto, PWA e distribuição sincronizados pelo mecanismo oficial.
- Acrescentado `node scripts/check-local-release.mjs`, que compara o SHA-256 do `mapa/app.js` da fonte e da distribuição e exige a presença do diagnóstico municipal.
- Não há alteração de filtro ou lógica comercial nesta revisão.

## RC185/V272 — Diagnóstico verificável da rejeição municipal

- Corrigida a associação de geometria quando IDs internos coincidem mas os CARs oficiais são diferentes: CAR divergente prevalece e a geometria incorreta é rejeitada.
- A rejeição municipal passa a registrar qual município consta na lista e na geometria, se as identidades coincidem e os últimos oito caracteres dos CARs, sem expor os identificadores completos.
- O diagnóstico fica em `window.SurveyorPropertySearchLastRejection` para inspeção local, sem depender de nova tentativa de alterações às cegas.
- Os índices locais, geometrias e validação de município não foram relaxados. O comportamento real depende dos atributos fornecidos pelo WFS.

## RC185/V272 — Identidade do imóvel e município pelo CAR oficial

- Reconhece o código IBGE do município em números CAR completos e válidos, mesmo em registros compactados antigos sem campo municipal separado.
- Ao carregar geometria WFS, rejeita a primeira feição sem identidade compatível; aceita somente o mesmo CAR ou ID oficial da seleção.
- Resultados legados com CAR completo de outro município são excluídos do contexto selecionado, sem descartar o índice local instalado.
- Mantém bloqueio de atributos municipais explicitamente divergentes; registros sem identidade verificável continuam bloqueados.
- Acrescentado teste `property-car-municipality-identity.test.mjs`; testes antigos de identidade adaptados ao helper único.

## Busca local: restaurada seleção de imóveis legados (RC185/V272)

- Removido bloqueio automático na seleção da geometria de candidato de índice antigo sem metadado municipal.
- A hidratação mantém conferência da identidade pelo ID oficial ou CAR; município explicitamente divergente continua recusado.
- Separada a etapa de sugestão local da confirmação possível dos dados oficiais, sem atribuir município inventado ao registro.
- Testes atualizados para este fluxo e build sincronizado. Registros oficiais sem informação territorial completa continuam exigindo cautela na homologação.

## RC185/V272 — Busca rápida compatível com índices antigos

- Reativada busca local em manifestos instalados de gerações antigas sem `municipalityValidated`, como candidatos de pesquisa instantânea.
- Índices antigos não atribuem artificialmente município a cada imóvel; a lista indica `Município a confirmar`.
- Na localização desses candidatos, município e identidade precisam ser confirmados pela geometria oficial. Em caso de insuficiência de dados, a seleção é bloqueada com segurança.
- Adicionado teste executável com imóvel fictício e instruções em `docs/EXEMPLO_TESTE_BUSCA_RAPIDA_MUNICIPAL.md`.
- Sem exclusão de dados do navegador, mudanças comerciais ou migração de arquitetura.

## RC185/V272 — Correção de procedência do índice municipal de imóveis

- O índice local agora exige município real confirmado nos atributos oficiais de cada imóvel antes de incluir o registro; não atribui município apenas por escopo de download.
- Índices locais antigos, sem comprovação de procedência (`municipalityValidated`), deixam de alimentar resultados de busca; a consulta online permanece como fallback.
- Falha ao localizar geometria não marca o item como "Visualizando".
- Adicionado teste de regressão `property-local-municipality-source.test.mjs`. Observação: provedores que não fornecem atributos de município podem não permitir construir o índice local verificado; é necessário homologar contra o serviço real.

## RC185/V272 — Seleção municipal sem falso bloqueio de geometria

- Corrigida a segunda verificação municipal ao localizar imóvel do índice local: os atributos de busca já confirmados não são descartados se a resposta WFS de geometria omite o município.
- Geometria sem código/nome municipal somente é aceita quando o ID oficial ou CAR corresponde exatamente ao imóvel validado na lista.
- Municípios explicitamente divergentes continuam bloqueados. A confirmação municipal da lista continua obrigatória.
- Novo teste `property-hydration-municipality.test.mjs`; `npm run verify` aprovado.

## RC185/V272 — Busca de imóveis com município estrito

- Resultado do CEFIR/SICAR agora requer coincidência exata de código IBGE ou nome municipal oficialmente declarado. Não são aceitos prefixos parciais, nomes parcialmente coincidentes nem municípios ausentes.
- A lista de resultados e a seleção de imóvel verificam novamente o município escolhido, impedindo exibir imóvel de outra cidade.
- A hidratação de geometria do cache municipal valida os dados originais da fonte antes de mesclar informações locais, evitando rotular imóvel externo como se fosse da cidade escolhida.
- Teste de regressão específico adicionado. Resultados sem atributos oficiais municipais podem deixar de aparecer até a fonte fornecer dados confirmáveis.

## RC185/V272 — Finalização de Mapas/Croquis sem rótulos em negrito/halo branco

- A exportação/finalização de Mapas e Croquis agora normaliza os rótulos sobre a imagem com `preserveAreaNameHalo:false` e `preserveConfrontanteHalo:false`, eliminando o contorno branco e a aparência de negrito artificial no arquivo final.
- Mantida a prévia de edição sem regressão e preservada a política tipográfica compartilhada do editor nativo.
- Adicionado teste estável cobrindo a finalização dos rótulos sobre foto.

## Memorial: mapa dos modelos alternativos sem sobreposição de cabeçalho (RC185/V272)

- Corrigida a causa da regressão nos modelos Ciano, Dourado, Verde, Amarelo e Agro+: a página cartográfica agora recebe espaçamento inline próprio, inclusive quando o layout `agroExact` zera o padding das páginas narrativas.
- Consolidada a estrutura do mapa alternativo em `customTemplateMapBody()`, usada pelos modelos coloridos e Agro+, com título e legenda centralizados na prévia e no documento exportado.
- Mantido o espaço técnico de 45 mm antes do conteúdo do mapa e preservadas as páginas do modelo Padrão, sem alteração em sua renderização.
- Atualizados os testes de regressão para validar a fonte única e a exceção da página de mapa. Verificação completa aprovada; validação visual final fica para homologação local.

## RC185/V272 — Ajuste do mapa nos modelos alternativos do Memorial
- Nas páginas de mapa de modelos personalizados, o conteúdo passa a iniciar abaixo do cabeçalho decorativo e da logo para impedir sobreposição com “MAPA DE LOCALIZAÇÃO”.
- Regra equivalente aplicada tanto na prévia CSS quanto no estilo embutido para exportação.
- Modelo Padrão preservado, sem alterações.

## RC185/V272 — Correções do mapa e formulários

- Painel lateral fechado agora remove a coluna reservada e respeita o estado visual oculto.
- Ao entrar em um município pelo mapa territorial, a visualização operacional aproxima para zoom 13 no centro dos limites municipais, em vez de enquadrar toda a área.
- Campos de CPF/CNPJ e RG do proprietário, técnico e Memorial recebem máscaras em digitação no mecanismo comum de formulários; RG mantém flexibilidade por diferenças estaduais.
- Cartões do painel de detalhes usam área com duas casas, perímetro e tarefas com uma casa decimal, além de tipografia compacta. Os cálculos técnicos e dados salvos não são arredondados.
- A janela aberta pelo botão Importar omite a aba Catálogo; o catálogo permanece acessível no botão Camadas.

## Correção do modal involuntário do Memorial (RC185/V272)

- Corrigida a regra de exibição de `.memorial-sign-modal` que sobrepunha `hidden` após a remoção dos `!important`, mostrando o pop-up vazio na página do Memorial mesmo sem o usuário abrir o editor.
- A regra de exibição do modal independente passa a exigir `:not([hidden])`, preservando tanto a abertura deliberada quanto o fechamento.
- Adicionado teste estável verificando os contratos CSS e JS de visibilidade do editor.

## Auditoria de interferências — consolidação de cascata (RC185/V272)

- Consolidadas 389 declarações CSS substituídas por uma posterior do mesmo seletor, propriedade e contexto de media/supports; uma combinação do inventário pode ter várias redefinições. Os estilos finais permanecem nos arquivos canônicos.
- Atualizada a linha de base CSS para zero `!important`, impedindo novos usos nas 28 folhas monitoradas sem revisão.
- Corrigidos dois testes que exigiam estilos intermediários já sobrepostos pela cascata: a marca do cabeçalho (`258px`) e o painel territorial (`minmax(360px,1fr) minmax(280px,380px) 300px`).
- Gerado o registro `docs/css-cascade-consolidation.json` com as declarações efetivamente removidas por arquivo.
- Auditadas chamadas de prioridade CSS via JS: usos em PDF, ocultação documental e desenho/posicionamento foram preservados por serem regras dinâmicas; substituir depende de validação funcional específica.
- A verificação estática não confirma equivalência visual no navegador nem ausência universal de inicializadores concorrentes.

## Auditoria de interferências internas (continuidade RC185/V272)
- Inventariadas em `docs/css-cascade-audit.json` 237 redefinições conflitantes de seletor/propriedade no contexto global das folhas CSS (candidatas a revisão, **não** 237 bugs comprovados).
- Adicionado teste estável que bloqueia carregamento duplicado da mesma URL de script por página HTML (ignorando a query de versão).
- Inspeção estática: não foram detectados scripts `src` literalmente duplicados nas páginas HTML auditadas.
- Esta etapa não modifica a cascata nem controladores de aplicação para não introduzir mudanças visuais sem homologação. A remoção generalizada anterior de `!important` ainda exige comparação visual local.

## Limpeza ampla de cascata CSS (continuidade RC185/V272)

- Removidas as ocorrências remanescentes de `!important` das folhas CSS versionadas em `assets/`, reduzindo a contagem do projeto de **5.090 para 0**.
- A base passa a depender da ordem canônica de carregamento e da especificidade natural dos seletores, em vez de sobreposições forçadas espalhadas pela cascata.
- Ajustado o teste estável `technical-consolidation-v50` para aceitar corretamente o cenário consolidado com zero ocorrências, mantendo os tetos máximos de regressão.
- Mantidas as proteções de auditoria (`scripts/css-integrity.mjs`) e a sincronização `source/dist`; backend, regras comerciais e persistência não foram alterados nesta etapa.


### Auditoria de estabilização adicional (RC185/V272)
- Removidas declarações CSS redundantes comprovadas no mesmo seletor do editor de confrontantes, sem alterar seus valores efetivos.
- Incluído teste E2E opt-in com Chromium/Playwright para rotas públicas e isolamento de armazenamento entre contextos. Em ambientes sem acesso a localhost, o teste de navegador deve ser executado localmente.
- Persistência real entre contas/dispositivos continua dependendo de homologação conectada ao backend e não é comprovada pelo teste de isolamento.

## Estabilização CSS — inventário fechado de folhas (continuidade RC185/V272)

- A auditoria recusa folhas CSS novas sem registro, inclusive quando ainda não contêm `!important`.
- Inclui `assets/css/core/documents.css` no inventário com orçamento zero, para que o estilo documental permaneça fiscalizado.
- Teste negativo cria uma folha temporária, exige bloqueio da verificação e remove o artefato após o teste.
- Não altera estilos visuais, geometria, dados comerciais ou mecanismos de persistência.

## Estabilização de gravação documental (RC185/V272)

- Não sinalizar sucesso quando o editor técnico exceder o tempo de confirmação ou não tiver ação de salvar.
- Preservar alterações pendentes quando houver erro de salvamento ou sincronização do perfil compartilhado.
- Cobertura de regressão para confirmação de gravação.

## Continuação da estabilização RC185 / V272 (sem mudança de versão)
- Corrigida lacuna no monitoramento de `!important`: a auditoria passa a cobrir também `assets/home-hero.css` e `assets/home-showcase.css`, fora de `assets/css`.
- Incluídas as 98 ocorrências existentes dessas folhas na linha de base, com proteção contra novas declarações não autorizadas.
- Adicionado teste de regressão na suíte estável para verificar cobertura real da página inicial e execução da auditoria CSS.
- Nenhum estilo, dado comercial ou comportamento cartográfico foi modificado.

## Auditoria de estabilização da RC185 / V272 (sem alteração de versão)
- Auditoria CSS reforçada: detecta substituições silenciosas de `!important` sem alterar a contagem, com inventário de declarações em `scripts/css-important-baseline.json`.

- Publicação no GitHub Pages agora exige `npm run verify` completo antes do envio do artefato, bloqueando deploys quando verificações de segurança, integridade, CSS, Functions, testes, build ou source/dist falharem.
- O controle de regressão do CSS cobre todos os arquivos em `assets/css`, impedindo o aumento de `!important` em qualquer folha, inclusive novas folhas. A linha de base é a RC185; regras antigas não foram removidas em massa sem validação visual para evitar regressão.
- Mantidos os limites mais rigorosos já existentes para `core/ui.css`, `features/mapa/app.css` e `core/documents.css`.
- Os fluxos cartográficos, dados comerciais e backend não foram modificados nesta etapa.

## 1.0.0-rc.185 — V272 — Scroll permanente no painel lateral direito do mapa

- O painel **Detalhes do elemento**, exibido à direita ao selecionar um polígono/elemento, passa a manter scrollbar vertical própria e permanentemente reservada.
- Conteúdos longos da aba **Editar**, incluindo **Confrontantes por trecho**, permanecem acessíveis sem ultrapassar a altura útil do mapa.
- A barra usa o mesmo padrão visual dos demais menus roláveis do mapa e mantém `overscroll-behavior: contain`, evitando que a rolagem seja transferida para o mapa.
- Remove o reparo JavaScript que reescrevia `overflow` em runtime; o CSS do painel passa a ser a fonte única de verdade para a rolagem.
- Adiciona regressão estável para garantir scrollbar visível no painel direito.

## 1.0.0-rc.184 — V271 — Rolagem interna dos menus do mapa

- Corrige o painel **Marcar pontos** para manter rolagem vertical própria quando a quantidade de pontos/campos exceder a altura disponível, sem cortar **Salvar pontos**.
- Corrige **Informações do imóvel**: a rolagem externa do painel CAR/SIGEF/Coordenadas deixa de ser anulada por uma regra `overflow:hidden` concorrente.
- O cadastro de confrontante passa a respeitar a altura útil da janela e ganha rolagem vertical quando necessário.
- Menus variáveis do mapa — mapa base, downloads, projetos, busca inteligente e modos/subtipos de coordenadas — recebem limite de altura pelo viewport e rolagem interna estável, evitando opções inacessíveis.
- Mantém a gaveta compacta de ferramentas do desktop sem scrollbar interno, preservando o layout homologado.
- Adiciona regressão estável do contrato de rolagem dos menus do mapa.

## 1.0.0-rc.183 — V270 — Classificação técnica V/P/M ao marcar pontos

- A ferramenta **Marcar ponto** passa a usar três classes técnicas persistentes: `V` para ponto virtual criado por coordenada/clique no mapa, `P` para ponto proveniente de arquivo importado e `M` para ponto importado confirmado com marco físico.
- Cada linha do painel exibe o código técnico calculado (`V-01`, `P-01`, `M-01`) e pontos importados recebem a opção **Possui marco**, que promove imediatamente `P` para `M`.
- A origem do ponto deixa de ser perdida ao importar para o formulário: KML/ZIP/CSV/TXT/XLSX preservam a fonte importada e são persistidos como `P` por padrão.
- O mapa grava `surveyPointType`, `pointCode` e `hasPhysicalMark` no projeto; os marcadores passam a identificar visualmente a letra V/P/M.
- Polígonos montados a partir desses pontos persistem `importedPointNames`, `importedPointTypes` e nomes de origem, fazendo Pranchas/Mapas reutilizarem os códigos V/P/M nos vértices técnicos.
- Adiciona regressão estável cobrindo o fluxo manual → V, importação → P e **Possui marco** → M.

## 1.0.0-rc.182 — V269 — Preview vazio centralizado pela altura útil

- Mantém a Prancha Técnica como referência visual canônica sem alterar seu enquadramento homologado.
- Memorial, Mapas/Croquis, Planialtimetria/MDT e demais gerações passam a dimensionar a folha vazia pela altura real do viewport do módulo, preservando a borda inferior integralmente visível.
- Remove o corte vertical causado pelo cálculo anterior baseado na altura global da janela.
- Adiciona regressão para garantir centralização e enquadramento completo nas gerações que reutilizam o preview técnico.

## 1.0.0-rc.181 — V268 — Preview técnico unificado nas gerações

- usa o estado vazio da Prancha Técnica como fonte única para as pré-visualizações sem projeto nas demais telas de geração;
- remove o placeholder pequeno/vertical que aparecia no Memorial e o shell alternativo criado na tentativa anterior;
- Memorial, Planialtimetria, Perímetros, Loteamentos/REURB, Ambiental e demais páginas cobertas pelo workspace documental passam a exibir a mesma folha técnica horizontal, centralizada e dimensionada como em Pranchas;
- mantém a mensagem central sobre a própria folha e impede o visualizador PDF de interpretar esse estado vazio como documento real.


## 1.0.0-rc.179 — V266 — Pré-visualização vazia unificada

- padroniza o estado sem projeto nas telas de geração com uma folha técnica central dentro da bancada;
- impede o visualizador PDF nativo de interpretar o placeholder como documento renderizável;
- restaura automaticamente o placeholder quando Memorial, Planialtimetria ou outro gerador limpam a prévia sem projeto selecionado;
- preserva a correção da grade cartográfica das extremidades para evitar coordenadas grudadas nos quadros adjacentes.

## 1.0.0-rc.176 — V263
## 1.0.0-rc.179 — V264 — Zoom documental centrado na prancha

- corrige o zoom da Personalização para ampliar efetivamente a prancha/mapa, sem usar a margem lateral vazia como base de escala;
- redefine 100% como a largura útil real da bancada e deixa `Ajustar à tela` calcular apenas o percentual necessário para a folha inteira caber;
- preserva o ponto central atualmente visível nos dois eixos durante `+` e `−`, evitando que a folha fuja para um dos lados;
- recalcula o scroll pela posição real da folha dentro do viewport somente depois que o novo tamanho entrou no layout;
- amplia a faixa útil do editor para 50%–300%, mantendo a mesma implementação compartilhada entre Pranchas, Mapas/Croquis, Planialtimetria e demais gerações técnicas.

- Corrige a transição **Projeto → Personalização** em Mapas/Croquis: a cena vetorial já carregada para o projeto selecionado passa a ser reutilizada, sem um segundo loading nem nova renderização ao clicar em Próximo.
- A troca efetiva de projeto continua sendo o único caminho normal que exibe loading e reconstrói a cena; voltar e avançar entre Projeto e Personalização para o mesmo projeto apenas alterna a apresentação do editor.
- A primeira carga e as atualizações vivas de Mapas/Croquis passam a produzir uma cena `fastPreview` editor-ready, preservando as camadas controláveis mesmo quando começam ocultas.
- O modelo rural de Mapas/Croquis passa a marcar confrontantes, cotas, cotas de gleba, vértices, norte e escala com `data-live-element`, eliminando a necessidade de uma segunda geração para abrir o editor.
- O namespace do cache SVG ao vivo sobe para `v3`, invalidando cenas antigas que não possuíam a estrutura editor-ready.
- Adiciona regressão específica garantindo que o mesmo projeto não seja regenerado na passagem para Personalização e que o fallback de preparação só execute quando a cena realmente estiver ausente.
- Release passa para `1.0.0-rc.176`.

## 1.0.0-rc.175 — V262

- Corrige exclusivamente a cadeia de cotas do perímetro em geometrias densas: todos os segmentos voltam a participar de uma única cadeia contínua, sem lacunas entre arestas vizinhas.
- Remove o workaround que desligava a continuidade acima de 24 vértices; a união passa a usar interseção local das paralelas deslocadas com limite de miter e fallback bevel no próprio vértice.
- Mantém a cota a uma distância limitada da geometria real, impedindo espículas em cantos agudos/quase paralelos e preservando 100% da cobertura perimetral.
- Adiciona regressão geométrica com 59 vértices que exige continuidade entre todos os segmentos e limite de distância das junções.
- Release passa para `1.0.0-rc.175`.

## RC173 / V260 — mapa documental limpo, assinatura unificada e Personalização consolidada

## 1.0.0-rc.174 — V261

- Unifica o loading de troca de projeto em Memorial, Mapas/Croquis e Pranchas com o overlay integral da aplicação.
- Memorial passa a exibir todas as páginas em rolagem contínua durante a edição de assinatura, permitindo selecionar e posicionar a assinatura diretamente em qualquer página.
- Rótulos de vértices deixam de usar redistribuição/anti-colisão automática e permanecem geometricamente junto aos vértices reais.
- Cotas externas em geometrias densas limitam a cadeia contínua a 24 vértices e usam junções por bissetriz limitada para impedir espículas e deformações.

- Remove o hitbox imprimível de `Nome no mapa`: a caixa de interação deixa de fazer parte do SVG de geração e passa a existir somente quando o editor técnico está aberto, eliminando o retângulo indesejado no Memorial, Mapas/Croquis e demais saídas que reutilizam o renderer compartilhado.
- Ajusta a escala-base dos rótulos de vértices para reduzir poluição em imóveis densos, preservando o controle de tamanho do usuário e o motor automático de colisões.
- Mantém a correção de cotas densas da V259: perímetros extensos continuam usando deslocamento independente por trecho em vez de mitras contínuas degeneradas.
- Memorial remove definitivamente a aba vazia `Aparência`, mantendo somente Memorial, Mapa e Assinatura.
- A aba Assinatura do Memorial passa a usar o mesmo cartão compacto das demais gerações, com Assinatura da conta, assinatura externa importável, Remover, Tamanho e Restaurar posição.
- Assinatura externa do Memorial usa IndexedDB por projeto no mesmo namespace documental, evitando o limite do `localStorage`; PDF final aceita a assinatura importada juntamente com a assinatura da conta.
- Controles `Zoom do mapa`, `Mapa de fundo`, `Confrontantes no mapa` e `Mapa no final do memorial` passam a disparar reconstrução viva imediata com o loading unificado.
- `Ajustar à tela` do editor técnico passa a calcular a largura-base pela menor dimensão real disponível da viewport, estabilizando zoom e scroll entre documentos horizontais e verticais.
- Atualiza regressões históricas para refletir a remoção intencional da aba Aparência do Memorial e o novo equilíbrio de vértices.
- Release passa para `1.0.0-rc.173`.

## RC172 / V259 — consolidação das gerações, Planialtimetria e dados compartilhados
- Corrige a cadeia de cotas em perímetros densos: polígonos com muitos vértices deixam de forçar mitras contínuas externas e passam a usar deslocamentos independentes, evitando cotas deformadas no trecho inferior/lateral de imóveis irregulares.
- Cadastro de confrontantes passa a usar checkboxes visuais isoladas para Nome da propriedade e CPF/CNPJ, sem repetir o texto “Exibir na prancha”.
- Reescreve a ancoragem do zoom da bancada: a folha alterna corretamente entre centralização e origem alcançável, preserva o topo quando cabe verticalmente e recalcula o foco somente após o layout estabilizar.
- Aparência da tabela técnica ganha controles independentes Horizontal e Vertical usando `coordinateTableX/Y`, sem criar um segundo modelo de posição.
- Dados de geração passam a ser sincronizados no próprio projeto em `metadata.documentProfile`, com atualização pela API e hidratação ao selecionar o projeto; Memorial reaproveita Proprietário, CPF/CNPJ, RG, matrícula, INCRA, CIB/CNIB e comarca cadastrados no mapa/projeto.
- Memorial e geradores automáticos abandonam o card antigo de loading e passam a usar o mesmo overlay limpo da tela de entrada: fundo opaco/blur e spinner único.
- A troca Projeto/Personalização passa a ocultar explicitamente editores inline residuais, impedindo menus/rodapés de edição por trás da tela Projeto.
- Mapas/Croquis reorganiza o quadro de sistema de coordenadas em linhas próprias e suaviza o peso tipográfico técnico sem reduzir a identificação dos vértices protegida pela suíte estável.
- Planialtimetria carrega e renderiza automaticamente o projeto selecionado sob loading único, recorta os rótulos de vértices ao quadro cartográfico e limita suas coordenadas para impedir vértices soltos no topo da folha.
- Planialtimetria, Perímetros e Loteamentos/REURB passam a usar a mesma organização compacta da Personalização: Prancha, Mapa, Aparência e Assinatura; ferramentas de vértices, confrontantes, linhas, servidões e cotas ficam consolidadas em Mapa.
- Adiciona regressão V259 cobrindo cotas densas, zoom, checkboxes, persistência compartilhada, loading, limpeza de editor residual, rodapé técnico e Planialtimetria.
- Release passa para `1.0.0-rc.172`.

## RC171 / V258 — CPF/CNPJ com máscara automática e identificação correta
- O cadastro de confrontante passa a declarar a máscara `cpfcnpj` no campo dinâmico, permitindo que a infraestrutura central de formulários formate o documento enquanto o usuário digita, inclusive em modais criados depois do carregamento da página.
- A normalização documental ganha fonte única para CPF/CNPJ: 11 dígitos viram `000.000.000-00` e são exibidos como `CPF: ...`; 14 dígitos viram `00.000.000/0000-00` e são exibidos como `CNPJ: ...`.
- Valores antigos salvos sem pontuação também são formatados ao renderizar Pranchas/Mapas e passam a ser gravados já normalizados quando o cadastro é aplicado.
- A máscara dinâmica é registrada no `ui.js`, evitando que o campo de CPF/CNPJ do editor técnico fique fora do padrão usado no restante do sistema.
- Release passa para `1.0.0-rc.171`.

## RC170 / V257 — zoom estável e Download com hitbox integral
- Corrige o comportamento demonstrado no primeiro vídeo de homologação: o zoom deixava de usar a prancha como referência e preservava o foco pela razão do `scrollWidth/scrollHeight`, causando deslocamento visual conforme o documento crescia. O foco passa a ser calculado sobre a geometria real da folha e o topo é preservado quando a prancha ainda cabe verticalmente no quadro.
- O reposicionamento do scroll aguarda dois frames de layout após a mudança de largura e a animação de `width` é removida somente no editor inline, eliminando salto/interpolação entre o tamanho antigo e o novo.
- Corrige o segundo vídeo de homologação: o Download deixa de usar `details/summary` como superfície clicável e passa a usar um botão real de largura integral, com `pointer-events`, `z-index`, estado `aria-expanded` e lista completamente retirada do hit-test quando fechada.
- Mantém PDF/SVG/Word nos mesmos handlers oficiais; a mudança é exclusivamente de interação e estabilidade do rodapé.
- Adiciona regressão específica para os dois comportamentos observados nos vídeos.
- Release passa para `1.0.0-rc.170`.

## RC169 / V256 — halo branco do confrontante eliminado no PDF vetorial
- O PDF real enviado em homologação confirmou que o artefato branco restante não vinha mais do hitbox: o normalizador tipográfico compartilhado preservava deliberadamente o halo (`stroke` branco + `paint-order`) de `.sv-confrontante-name-text` durante a conversão SVG→PDF.
- A política tipográfica passa a aceitar contexto de exportação; no PDF, o halo de Nome/Propriedade/CPF-CNPJ do confrontante é desligado sem alterar o comportamento visual/interativo do editor.
- O exportador aplica ainda uma neutralização explícita de `stroke`, `stroke-width` e `paint-order` nos textos do confrontante antes do `svg2pdf`, evitando artefatos do PDFium/Chromium em zoom elevado.
- A correção é limitada ao rótulo do confrontante e preserva halos semânticos de outros elementos no editor.
- Adiciona regressão específica para a causa real observada no PDF homologado.
- Release passa para `1.0.0-rc.169`.

## RC168 / V255 — rótulos de confrontantes limpos no PDF
- Corrige a causa do retângulo/faixa branca que aparecia atrás de Nome/Propriedade/CPF-CNPJ dos confrontantes no PDF vetorial: o `sv-confrontante-hitbox` é uma geometria exclusiva de interação do editor e estava sendo serializada para o SVG final com preenchimento branco transparente, que o conversor SVG→PDF podia rasterizar como branco opaco.
- Hitboxes de confrontantes e nomes cartográficos passam a nascer com `fill="none"`, preservando o clique/seleção no editor por `pointer-events` e pelo CSS do modo de edição, sem carregar tinta para a saída documental.
- O exportador vetorial adiciona uma sanitização central antes do `svg2pdf`, removendo hitboxes, alças e âncoras exclusivas da interface; PDF passa a conter somente a arte técnica imprimível.
- A correção vale para Nome, Nome da propriedade e CPF/CNPJ do confrontante, inclusive quando rotacionados ou redimensionados.
- Adiciona regressão para impedir que geometria de interação volte a entrar em PDF/SVG documental.
- Release passa para `1.0.0-rc.168`.

## RC167 / V254 — clique direito real no interior do polígono
- Corrige a causa raiz da V252: a camada `sv-document-perimeter-fill` ainda herdava `pointer-events:none`, portanto o menu contextual existia no código, mas o navegador nunca entregava o clique direito feito no preenchimento do polígono ao editor.
- O preenchimento editável passa a participar do hit-test SVG com `pointer-events:fill`, enquanto a borda usa `pointer-events:stroke`, sem criar camada visual paralela.
- Adiciona resolução geométrica de fallback (`isPointInFill`) para abrir o menu mesmo quando grade técnica, cota ou outro elemento SVG estiver sobre o ponto clicado.
- Mantém o menu contextual já definido com Cor da borda, Espessura da borda, Cor interna e Opacidade.
- Adiciona regressão específica para impedir retorno do bloqueio de eventos no perímetro.
- Release passa para `1.0.0-rc.167`.

## RC166 / V253 — CPF/CNPJ e propriedade opcionais no rótulo do confrontante
- O cadastro completo do confrontante ganha checkbox `Exibir na prancha` ao lado de `Nome da propriedade`, permitindo manter o dado cadastrado sem obrigar sua impressão no rótulo cartográfico.
- `CPF/CNPJ` ganha checkbox próprio `Exibir na prancha`; por privacidade, o documento permanece oculto por padrão e só é impresso quando houver opt-in explícito.
- Quando habilitado, o CPF/CNPJ aparece em uma segunda linha logo abaixo de `Nome — Propriedade`, acompanhando o mesmo arraste, escala, rotação e cor do rótulo do confrontante.
- As preferências `showPropertyInLabel` e `showCpfCnpjInLabel` passam a integrar a mesma fonte de verdade dos segmentos, sendo persistidas no layout visual, em `confrontanteTrechos` e na coleção por aresta do projeto.
- Projetos antigos preservam a exibição já existente do nome da propriedade quando ele já estava preenchido; CPF/CNPJ antigo não passa a ser exposto automaticamente.
- O renderer de Pranchas/Mapas respeita as duas preferências tanto no modo de rótulo sobre a divisa quanto nos callouts alternativos, sem duplicar o motor de confrontantes.
- Adiciona regressão estável específica para as checkboxes, persistência e linha secundária de CPF/CNPJ.
- Release passa para `1.0.0-rc.166`.

## RC165 / V252 — contexto direto para rótulos e aparência do polígono
- Remove `Tamanho do nome` e `Giro do nome` do cadastro completo de confrontantes. Esses dois ajustes deixam de existir no formulário cadastral e passam a pertencer exclusivamente à edição visual direta da prancha.
- O menu de clique direito de confrontantes ganha `Tamanho` com slider de 20% a 400%, preservando `Rotacionar`, `Zerar rotação` e `Excluir confrontante`.
- O menu contextual de `Nomes no mapa` também recebe `Tamanho`, mantendo rotação e exclusão no mesmo ponto de interação direta.
- O clique direito sobre qualquer polígono editável passa a abrir uma única janela de aparência com `Cor da borda`, `Espessura da borda`, `Cor interna` e `Opacidade`, aplicando a alteração imediatamente à cena vetorial.
- A persistência de `polygonStyles` passa a separar `fillColor`, `strokeColor` e `strokeWidth`, com migração compatível do antigo campo único `color`; a geração final e a prévia usam a mesma fonte de verdade.
- Remove da aba Aparência o cartão global `Preenchimento dos polígonos`, que ficou redundante após a edição direta por clique direito. `Tabela técnica de coordenadas` e o tratamento individual de múltiplos polígonos permanecem preservados.
- A espessura é armazenada como fator relativo e reaplicada sobre a largura-base de cada renderer, evitando multiplicação acumulativa ao salvar, reabrir ou regenerar a prancha.
- Adiciona regressão estável para cadastro sem controles visuais duplicados, tamanho contextual de rótulos e edição contextual completa do polígono.
- Release passa para `1.0.0-rc.165`.

## RC164 / V251 — assinaturas simultâneas, seleção direta e salvamento clicável
- Corrige o hitbox do botão `Salvar alterações` no rodapé da Personalização: quando o documento está sujo, o slot de Download é retirado explicitamente do fluxo e do hit-test, impedindo que um controle invisível intercepte o clique no centro do botão.
- A assinatura externa deixa de depender do limite do `localStorage`: o arquivo passa a usar IndexedDB por projeto, com migração do formato legado e fallback de sessão caso a persistência do navegador esteja indisponível. A importação continua utilizável mesmo se o navegador negar armazenamento persistente.
- Assinatura da conta e assinatura importada deixam de ser mutuamente exclusivas. As duas podem permanecer visíveis ao mesmo tempo na prancha; os checkboxes laterais controlam somente visibilidade.
- A assinatura que pode ser movida/redimensionada passa a ser selecionada diretamente pelo clique na própria imagem da prancha. A seleção é transitória do editor e não apaga, oculta nem substitui a outra assinatura.
- O controle `Tamanho` e `Restaurar posição` atuam exclusivamente sobre a assinatura selecionada na pré-visualização; sem seleção, o ajuste fica bloqueado.
- Reorganiza a aba Assinatura conforme a referência: `Assinatura da conta` fica ao lado de `Usar assinatura importada`; `Importar assinatura` é movido para a linha inferior ao lado de `Remover`.
- Mantém as duas assinaturas como objetos independentes do modelo técnico nativo, preservando posição e escala separadas.
- Adiciona regressão estável para persistência IndexedDB, coexistência das assinaturas, seleção direta na prévia, layout do painel e hitbox integral de Salvar.
- Release passa para `1.0.0-rc.164`.

## RC163 / V250 — assinatura externa editável, Aparência sem duplicidade e menu de contexto dos confrontantes
- A aba Assinatura passa a separar explicitamente a assinatura cadastrada na conta de uma assinatura externa importada para o projeto/documento. A assinatura externa fica armazenada em espaço próprio por projeto no navegador e não altera nem substitui a assinatura da conta.
- A seleção é mutuamente exclusiva: ao ativar a assinatura da conta, a externa é desativada; ao selecionar/importar a externa, a assinatura da conta é desativada. O mesmo controle de tamanho atua sobre a assinatura atualmente selecionada.
- A assinatura externa entra na cena SVG como objeto editável real, pode ser arrastada diretamente sobre a prancha, ampliada/reduzida e reposicionada, e também passa a ser representada no modelo técnico nativo.
- A Aparência deixa de exibir duas vezes o mesmo polígono quando a prancha possui somente um polígono editável. Nesse caso, `Preenchimento dos polígonos` é a única fonte visual de opacidade/cor; o bloco individual `Polígonos da prancha` aparece somente quando existem duas ou mais áreas distintas.
- O clique com o botão direito sobre um confrontante desenhado na prancha agora abre menu contextual com rotação ao vivo, zerar rotação e exclusão direta do confrontante, no mesmo padrão já aplicado aos nomes do mapa.
- Preserva a persistência existente de rotação dos confrontantes e a exclusão continua usando a única coleção de segmentos, sem criar rótulo ou renderer paralelo.
- Adiciona regressão estável dedicada aos três fluxos e mantém `documents.css` sem `!important`.
- Release passa para `1.0.0-rc.163`.

## RC162 / V249 — troca de projeto com loading, nomes rotacionáveis e vértices fiéis à planilha
- A troca de projeto em Pranchas Técnicas e Mapas/Croquis passa a usar um overlay de carregamento opaco com spinner, no mesmo padrão visual da entrada do sistema, bloqueando a interação até a nova cena terminar de carregar.
- Remove a opção redundante `Mapa de fundo` da aba Prancha. O estilo cartográfico do minimapa permanece concentrado na seção Mapa/Minimapa, que continua sendo a fonte única desse ajuste visual.
- O menu de contexto dos nomes do mapa ganha rotação ao vivo de -180° a 180° e ação para zerar o giro, preservando a exclusão já existente e persistindo a rotação no mesmo `areaNames` do documento.
- Corrige `Vértices > Tamanho geral`: o slider passa a sincronizar também `elementVisuals.vertices.scale`, eliminando a divergência que fazia o controle alterar `vertexScale` sem efeito visual.
- Os confrontantes passam a exibir os identificadores reais dos vértices (`Do V1 ao V2`, `Do P1 ao P2`, etc.) quando esses nomes vierem da planilha/importação. A importação de planilhas preserva os rótulos originais no perímetro e Prancha/Mapa/Tabela técnica reutilizam essa mesma fonte.
- Mantém fallback compatível para projetos antigos sem nomes de vértices, usando a nomenclatura técnica padrão existente.
- Release passa para `1.0.0-rc.162`.

## RC161 / V247 — troca de projeto isolada e cartões de Elementos sem herança legada
- Corrige a troca de projeto em Pranchas Técnicas para impedir que a sessão inline anterior continue publicando ou reaplicando o SVG do projeto antigo após o usuário escolher outro projeto.
- Cada prévia passa a carregar identidade explícita (`lastSvgProjectId` / `lastNativeDocumentProjectId`) e o editor mantém `editorSessionProjectId`; callbacks de uma sessão antiga são descartados quando o `projectSelect` já aponta para outro projeto.
- A fila de atualização viva preserva `projectSwitch` e o id selecionado. Uma atualização enfileirada não perde mais o contexto de troca e, portanto, não executa `commitPreviewState()` sobre o projeto recém-selecionado usando o overlay anterior.
- Ao trocar o projeto, a sessão inline ativa é desmontada antes da nova geração, o SVG/documento nativo anterior é desvinculado e a bancada entra no estado de carregamento do novo projeto até a nova cena estar efetivamente pronta.
- O montador compacto de Elementos remove a classe legada `sv-doc-options-grid` depois da conversão. Essa classe estilava todos os `label` descendentes como cartões e era a causa do layout comprimido observado nos controles `Tamanho` e `Cor`.
- Os cartões de Elementos permanecem em duas colunas, com título azul quando ativo e neutro quando desligado, mas `Tamanho` volta a exibir o percentual completo e `Cor` usa um controle compacto com amostra de cor + indicador de abertura, no mesmo padrão visual da referência aprovada.
- O ajuste é feito na implementação canônica existente de `mapas/app.js` e `documents.css`; não cria hotfix, CSS paralelo nem novo renderer.
- Adiciona regressão estável para isolamento da troca de projeto e amplia os testes dos cartões compactos contra retorno da classe legada.
- Release passa para `1.0.0-rc.161`.

## RC160 / V246 — cartões de Mapa alinhados e Aparência compacta
- Corrige o redimensionamento dos cartões compactos da aba Mapa: rótulos `Tamanho` e `Cor` deixam de quebrar verticalmente, selects e seletores de cor passam a ter altura uniforme e os cartões permanecem alinhados nas duas colunas.
- Mantém o padrão visual de estado já aprovado: título azul quando o elemento está ativo e título neutro/cinza quando está desativado.
- Reorganiza a aba Aparência para o mesmo padrão compacto: `Preenchimento dos polígonos` e `Tabela técnica de coordenadas` tornam-se cartões de ativação, sem checkbox solto no layout.
- O cartão `Preenchimento dos polígonos` concentra Opacidade e Cor globais; alterações são propagadas aos polígonos existentes pela mesma fonte de estado já usada pelo editor, sem renderer paralelo.
- `Tabela técnica de coordenadas` mostra os controles dependentes somente quando ativada.
- `Polígonos da prancha` passa a apresentar cada área como cartão: título azul quando o preenchimento individual está ativo, categoria abaixo e Opacidade/Cor alinhadas na mesma linha.
- O estado ativo do cartão individual acompanha `polygonStyles.fill` imediatamente e continua persistido pelo `documentVisualSettings` existente.
- Não reintroduz o painel `Editar cotas`, não cria arquivo de hotfix e mantém `documents.css` sem `!important`.
- Adiciona regressão estável para alinhamento dos elementos e para a nova Aparência compacta.
- Release passa para `1.0.0-rc.160`.

## RC159 / V245 — ferramentas compactas do Mapa e confrontantes diretos por lado
- Reorganiza a aba Mapa da Personalização em cartões compactos para Cotas, Cotas da gleba, Vértices, Confrontantes, Norte, Grade técnica e Escala gráfica. O título do cartão funciona como o próprio comando: azul quando ativo e neutro quando desativado.
- Cada cartão concentra seus controles de tamanho e cor no mesmo ponto, eliminando a necessidade do bloco duplicado `Editar cotas` na parte inferior do painel.
- Remove o painel lateral independente `Editar cotas` da Personalização de Pranchas e Mapas/Croquis; escala/cor das cotas continuam persistidas pelo mesmo `documentVisualSettings` e pela política compartilhada do renderer.
- Integra Confrontantes diretamente ao bloco Vértices: cada lado do perímetro recebe uma linha `Do X ao Y` com campo `Nome do confrontante` e menu de três pontos apenas para cadastro complementar/ajustes avançados.
- O nome digitado no lado é aplicado imediatamente ao SVG ativo, no ponto correspondente do confrontante, sem exigir Gerar, Salvar ou reabrir a Personalização.
- Preserva propriedade, CPF/CNPJ, orientação, tipo de limite, observação, intervalo avançado, tamanho e giro no cadastro dos três pontos, sem poluir a lista principal.
- Adiciona `elementVisuals` ao modelo visual persistente e ao `SurveyorTechnicalMapBridge`, mantendo tamanho/cor dos cartões após salvar e reabrir o projeto.
- Consolida a política de escala das cotas no bridge compartilhado para a prévia e o renderer final consumirem a mesma fonte de verdade; cotas perimetrais e cotas de gleba podem manter visuais distintos.
- Remove regras CSS concorrentes do editor inline durante a implantação do layout compacto e mantém `documents.css` sem `!important`.
- Adiciona regressão estável específica para cartões compactos, confrontantes diretos por lado, persistência visual e ausência do painel duplicado `Editar cotas`.
- Release passa para `1.0.0-rc.159`.

## RC158 / V244 — modelo único no Memorial, QR/link persistente e ação Salvar → Download
- Corrige a aba Assinatura do Memorial para reutilizar exatamente as páginas do modelo atualmente selecionado. A lista de páginas e a prévia da assinatura são sincronizadas sempre que o Memorial é regenerado ou o usuário troca de modelo, impedindo retorno visual para um modelo anterior.
- A assinatura continua sendo posicionável, mas deixa de possuir uma fonte documental paralela: ela opera sobre as mesmas páginas HTML do Memorial ativo.
- Mapas/Croquis passa a resolver o acesso público do projeto também nas prévias automáticas/rápidas. O link público e o QR Code são obtidos pelo `SurveyorDocumentAssets.publicProjectAccess()` e mantidos em cache por projeto para não repetir chamadas durante cada atualização viva.
- O rodapé técnico identifica explicitamente `Link do mapa:` e usa o link público persistente/snapshot geométrico do próprio projeto; URL institucional genérica deixa de ser usada como substituto quando existe projeto editável.
- Consolida a política global de ação documental: os botões manuais `Gerar croqui`, `Gerar memorial` e equivalentes permanecem apenas como gatilhos internos; a interface mostra `Download` quando o documento está limpo e troca para `Salvar alterações` quando há edição pendente.
- Após `Salvar alterações`, o documento retorna ao estado limpo e o Download reaparece no mesmo grupo de ações. Em editores técnicos inline, o botão nativo de salvamento continua sendo a única autoridade e publica o estado para o rodapé global.
- Memorial persiste assinatura/modelo no salvamento e refaz silenciosamente a saída atual antes de liberar o Download, garantindo que a exportação corresponda à prévia exibida.
- Perímetros e Loteamentos/REURB reutilizam a mesma política através de suas ações internas de salvamento, sem manter dois botões de salvar concorrentes.
- Nenhum bloco CSS paralelo foi criado para esta regra; o fluxo foi consolidado em `documents.js`, com eventos de estado emitidos pelo editor técnico.
- Adiciona regressão específica para modelo do Memorial, QR/link real e política `Salvar alterações → Download`.
- Release passa para `1.0.0-rc.158`.

## RC157 / V243 — pré-visualização estável sem efeito de vai-e-volta
- Corrige a oscilação visual observada após a recuperação do fundo satélite em Mapas/Croquis: a folha alternava continuamente entre dois tamanhos porque a largura era calculada com a proporção fixa `1.414` (A4) enquanto o SVG rural usa `viewBox 1600 × 1180`; a diferença criava overflow, scrollbar e realimentação de layout.
- A pré-visualização passa a calcular o encaixe a partir do `viewBox` real de cada SVG e das dimensões efetivas do host, preservando a proporção de qualquer modelo documental sem depender de uma razão fixa.
- `ResizeObserver` observa somente o contêiner estável e reaplica o fit quando a bancada realmente muda de tamanho; o SVG filho deixa de controlar a dimensão do viewport.
- O viewport de Mapas/Croquis passa a usar `overflow:hidden` e `contain:layout paint`, eliminando o ciclo scrollbar → redução da largura → remoção da scrollbar → expansão da folha.
- O elemento raiz das telas documentais recebe uma classe canônica com `overflow:hidden`, garantindo que a rolagem externa do navegador não dispute espaço com os scrolls internos da bancada.
- Nenhum bloco paralelo de correção foi criado: as regras existentes de `#mapPreview.is-live-svg-preview` foram substituídas na fonte canônica.
- Adiciona regressão específica contra retorno da proporção fixa A4 e contra scrollbar externa oscilante.
- Release passa para `1.0.0-rc.157`.

## RC156 / V242 — Satélite real sem tiles cinza de indisponibilidade
- Corrige a causa do fundo cinza com a mensagem repetida `Map data not yet available` em Mapas/Croquis: a prévia satélite deixava o ArcGIS escolher LOD acima da cobertura realmente publicada para a região.
- `World_Imagery` passa a usar teto seguro de LOD 18 para a composição documental, evitando solicitar níveis sem cobertura mesmo quando o quadro SVG exige resolução maior.
- O mosaico ArcGIS agora valida cada raster antes de desenhá-lo; tiles predominantemente cinza de indisponibilidade são rejeitados em vez de entrarem na prancha.
- Quando um nível não possui cobertura suficiente, o renderer recua automaticamente para o nível imediatamente inferior até encontrar imagem utilizável.
- A exportação raster também limita a dimensão solicitada à resolução efetivamente disponível no LOD seguro, evitando que o endpoint `export` sintetize placeholders por excesso de resolução.
- Satélite e híbrido deixam de inserir URL ArcGIS direta não validada no SVG; a cena só recebe raster incorporado depois da validação de cobertura.
- Mantém a atualização viva sem botão `Gerar croqui`: a cena anterior continua na tela enquanto o novo fundo é resolvido e substituído.
- Adiciona regressão específica para impedir retorno de LOD excessivo, URL direta não validada ou tiles cinza de indisponibilidade.
- Release passa para `1.0.0-rc.156`.

## RC155 / V241 — Elementos de Mapas/Croquis realmente vivos na Personalização
- Corrige a causa pela qual os checkboxes da aba Mapa em Mapas/Croquis pareciam não funcionar: o patch visual era bloqueado por uma guarda exclusiva de `pranchas.html`, então o evento chegava ao controle oficial mas nunca atingia o SVG inline de Mapas.
- A cena rápida de Mapas/Croquis passa a carregar todas as camadas alternáveis — cotas, cotas da gleba, vértices, confrontantes e norte — mesmo quando alguma delas começa desmarcada; cada camada recebe `data-live-element` e apenas sua visibilidade inicial é aplicada.
- Ao entrar na Personalização de Mapas/Croquis, o sistema garante uma cena `fastPreview` completa antes de abrir o editor. Uma prévia herdada da etapa Projeto que não possua camadas vivas é substituída silenciosamente pela cena correta.
- `patchPranchaLiveElements` é substituído por `patchDocumentLiveElements`, uma única rotina compartilhada entre Pranchas e Mapas/Croquis. Os proxies da Personalização e os controles oficiais passam a atingir o editor inline real, não uma prévia escondida.
- Checkboxes de Elementos deixam de disparar uma regeneração estrutural concorrente em Mapas/Croquis; ligar/desligar é instantâneo no SVG já montado e o mesmo estado é refletido em `lastSvg` para exportação.
- Adiciona regressão específica para impedir que `Cotas da gleba` volte a depender de regeneração ou que o patch de elementos seja novamente restrito à Prancha.
- Release passa para `1.0.0-rc.155`.

## RC154 / V240 — faixa de coordenadas restaurada e Projeto da Prancha isolado
- Mapas/Croquis volta a exibir uma faixa técnica legível no rodapé do quadro principal, com estado do fundo, `COORDENADAS DD`, `SIRGAS 2000` e nível de zoom; a caixa não fica mais vazia.
- O texto dessa faixa recebe cor e peso explícitos para não depender de herança visual da interface.
- A etapa Projeto de Pranchas Técnicas passa a ocultar de forma determinística o rail/drawer da Personalização enquanto o modo Projeto estiver ativo.
- O painel `Prancha` (`Tipo de prancha`, `Mapa de fundo` e demais opções) deixa de vazar para baixo do formulário Projeto e volta a existir somente na Personalização.
- Ao retornar para Personalização, o chrome técnico é restaurado no mesmo fluxo, sem segunda implementação paralela.

## V239 — hidratação geométrica definitiva, prévia sem loader concorrente e satélite nítido


- Corrige a falsa mensagem `O projeto não possui um perímetro válido com feição geométrica` em Pranchas/Mapas quando o seletor cache-first ainda continha apenas o resumo do projeto: o renderer agora só recebe o projeto depois de confirmar uma feição poligonal completa, reutilizando primeiro o cache/in-flight central e forçando atualização remota apenas se a geometria continuar ausente.
- Remove o watcher/loader genérico de troca de projeto de Memorial, Mapas/Croquis e Pranchas. Esses três módulos já possuem renderizadores vivos próprios; o watcher genérico disparava `change` repetido em 320/720/1400 ms e criava corrida entre resumo e projeto completo.
- O Memorial deixa de mostrar o overlay `Preparando documento…` durante seleção do projeto e edição comum. A prévia continua sendo atualizada silenciosamente pelo renderer dedicado.
- Alterações comuns do Memorial passam a usar atualização viva com debounce curto e, durante a prévia, deixam de rasterizar o mapa para PNG a cada mudança. O SVG real permanece como fonte da tela; PNG é produzido somente quando uma geração/exportação final exige compatibilidade raster.
- Mapas/Croquis atualiza título, elementos, zoom e fundo com debounce reduzido e sem depender do botão `Gerar croqui`. A cena atual permanece visível até a substituta estar pronta.
- O fundo Satélite/Topográfico da prévia viva passa a usar imediatamente o raster ArcGIS em resolução 2×; a geração final mantém incorporação resiliente em `data:`.
- O fallback por tiles calcula automaticamente o nível de zoom necessário para a resolução de saída, permite até 64 tiles e eleva o limite útil até zoom 21, eliminando o forte desfoque causado pelo antigo teto de zoom 19.
- A composição de satélite em canvas aumenta a qualidade JPEG para 0,96 e solicita raster maior sem alterar a escala geométrica do documento.
- QA passa a validar hidratação geométrica antes do renderer, ausência do loader genérico nos três documentos vivos, atualização cartográfica imediata e seleção cache-first sem chamadas remotas duplicadas.
- Release passa para `1.0.0-rc.153`.

## V238 — Personalização sem dupla montagem e tipografia cartográfica consolidada

- Remove a tela intermediária genérica `Editor integrado` dos módulos que possuem Personalização runtime própria (Memorial, Mapas/Croquis e Pranchas); a aba passa a montar diretamente a interface definitiva, sem trocar de painel alguns instantes depois.
- Os controles-fonte de Personalização continuam no DOM apenas como estado técnico oculto, preservando a ligação com os inputs oficiais sem expor um segundo layout ao usuário.
- Remove a mensagem de fallback transitória do Memorial que aparecia antes da hidratação dos controles e causava a impressão de interface quebrada.
- Consolida os blocos top-level repetidos do editor técnico inline em `documents.css`, mantendo uma única regra canônica por seletor no escopo principal e preservando somente overrides responsivos dentro de `@media`.
- Consolida também `memorial-personalization-live`, removendo a segunda regra concorrente usada apenas para `position:relative`.
- Mapas/Croquis ganha política tipográfica exclusiva de tela equivalente à Prancha Técnica: remove halo/contorno branco herdado dos textos, impede síntese artificial de peso e suaviza pesos 700/800 apenas na pré-visualização, sem alterar SVG/PDF exportados.
- O mesmo tratamento de tela é aplicado ao SVG vetorial usado no mapa de localização do Memorial, mantendo a fonte cartográfica única e evitando títulos/rodapé com aparência esbranquiçada ou pesada.
- Consolida os últimos seletores exatos duplicados de `documents.css` — janela/linhas/handles do editor técnico e compactação de Loteamentos/REURB — deixando zero seletores idênticos repetidos no mesmo escopo CSS, sem criar outra camada de override.
- Mapas/Croquis passa a usar `server.arcgisonline.com` como origem cartográfica principal e ganha fallback por mosaico de tiles ArcGIS embutido em `data:` quando o endpoint de exportação raster falhar; a atualização ao vivo usa o mosaico primeiro e mantém a cena anterior até o fundo novo estar pronto.
- O rodapé técnico de Mapas/Croquis passa a declarar cor escura e tipografia `Segoe UI` diretamente no SVG, reduz pesos excessivos e aumenta os menores textos do quadro para eliminar o aspecto esbranquiçado/contornado observado na pré-visualização.
- QA passa a validar montagem runtime sem placeholder, ausência da mensagem transitória do Memorial, tipografia sem halo e manutenção de `documents.css` sem `!important`.
- Release passa para `1.0.0-rc.152`.

## V237 — Personalização documental consolidada, mapa vetorial e atualizações instantâneas

- Consolida o CSS do editor técnico removendo blocos-base concorrentes de toolbar, viewport e área principal; `documents.css` mantém uma única regra canônica para cada estrutura e continua sem `!important`.
- Reorganiza o rodapé da Personalização do Memorial em três zonas fixas: `Cancelar/Aplicar` à esquerda, zoom `− / % / +` no centro e `Gerar/Download` à direita; rascunhos permanecem fora da Personalização para evitar segunda linha de botões.
- O controle `− / +` deixa de alterar tipografia/documento e passa a ser somente zoom visual da prévia, sem gerar uma nova versão a cada clique.
- Trocar o modelo do Memorial executa uma reconstrução completa e exclusiva do documento com loading dedicado; alterações comuns de campos, zoom do mapa, fundo e confrontantes atualizam silenciosamente sem o overlay global piscando a cada edição.
- O mapa de localização do Memorial passa a incorporar o SVG técnico real produzido pela fonte única de Mapas/Croquis. PNG fica apenas como fallback de exportação compatível, eliminando a prévia cartográfica borrada.
- O CSS do próprio documento Memorial passa a enquadrar o SVG vetorial dentro da página de mapa, impedindo invasão de cabeçalho/rodapé nos modelos padrão e personalizados.
- Mapas/Croquis ganha atualização ao vivo debounceada e silenciosa para título, elementos, fundo e zoom, mantendo a cena anterior visível até a nova estar pronta.
- Fundo satélite/topográfico usa a URL oficial ArcGIS como fallback quando a conversão local para `data:` não estiver disponível; o minimapa rápido da Prancha aplica a mesma política e deixa de ficar branco enquanto o cache ainda não foi preenchido.
- QA adiciona guarda para loading exclusivo de troca de modelo, zoom sem regeneração, mapa vetorial, atualização silenciosa, fundo cartográfico resiliente e ausência de blocos-base CSS duplicados.
- Release passa para `1.0.0-rc.151`.

## V236 — Memorial reconstruído na prévia viva + projetos cache-first

- Corrige a Personalização do Memorial sem empilhar outro editor: a área direita passa a reutilizar o documento HTML vivo completo, com as páginas reais empilhadas; a página isolada de assinatura fica restrita exclusivamente à aba `Assinatura`.
- A pré-visualização do Memorial em `Projeto` ganha um viewport interno próprio (`memorial-live-scroll`) com rolagem vertical permanente. O mapa do Memorial permanece como página real abaixo do texto e pode ser alcançado pela mesma rolagem.
- O mapa passa a iniciar incluído no Memorial. A opção `Mapa no final do memorial` continua disponível para desligamento explícito na Personalização.
- A aba `Mapa` do Memorial mantém somente opções de visualização — zoom, fundo, confrontantes e inclusão do mapa — e deixa de carregar o `SurveyorTechnicalDocumentEditor`; edição técnica de confrontantes/vértices continua exclusiva dos documentos cartográficos apropriados.
- Remove concorrência de CSS entre o modal de assinatura standalone e a Personalização inline: o CSS legado da assinatura passa a atuar somente no modo standalone, enquanto a bancada inline possui uma única regra canônica em `documents.css`.
- Consolida o shell de preparação de Pranchas e Mapas/Croquis, removendo o segundo bloco CSS que repetia as mesmas regras de layout.
- Corrige o carregamento tardio do seletor de projetos em todas as gerações: a lista local é exibida imediatamente quando disponível, `Carregando projetos…` é mostrado quando o cache ainda está vazio e a atualização da nuvem ocorre em segundo plano sem bloquear o select.
- `GeoRuralProjects.list()` passa a oferecer `cacheOnly`, permitindo leitura local imediata sem disparar rede. Mapas/Pranchas deixam de baixar todos os projetos completos apenas para preencher a lista; o projeto completo é buscado somente após a seleção.
- Ao abrir Mapas/Pranchas sem `?project=`, o seletor permanece em `Selecione um projeto`; somente uma escolha explícita ou um projeto informado na URL inicia a pré-visualização.
- QA passa a validar prévia integral do Memorial, scroll real, isolamento da assinatura, ausência do editor técnico no Memorial, carregamento cache-first e preservação da seleção explícita.
- Release passa para `1.0.0-rc.150`.

## V235 — Memorial com scroll real e Personalização consolidada

- Corrige a causa da Personalização estreita/quebrada no Memorial: o layout compacto não sobrescreve mais a grade de uma Personalização ativa.
- Corrige o fallback dos controles de Personalização do Memorial, que tratava seletores `#id` como IDs literais e por isso exibia a mensagem de opções indisponíveis.
- Consolida as regras do Memorial em um único bloco canônico de `documents.css`, removendo as regras duplicadas de scroll, workspace e página que haviam sido acumuladas.
- A pré-visualização viva do Memorial passa a manter `overflow-y: scroll`, páginas empilhadas e área própria de rolagem, permitindo alcançar a página cartográfica abaixo do texto.
- O modelo Agro+ mantém a página de mapa quando `Mapa no final do memorial` estiver habilitado, e o carregamento inicial deixa de desligar essa opção silenciosamente por uma preferência antiga.
- Mantém a Personalização em `Memorial / Mapa / Aparência / Assinatura`, com a bancada ocupando 100% da largura disponível e sem criar um editor técnico paralelo.
- Adiciona teste estrutural específico para impedir retorno de CSS duplicado, perda do scroll ou regressão do fallback de controles.
- Release passa para `1.0.0-rc.149` para renovar os cache-busters da homologação.

## V234 — Mapas/Croquis com prévia vetorial nativa também na etapa Projeto

- Elimina o visualizador PDF escuro da etapa **Projeto** de Mapas e Croquis.
- A pré-visualização inicial passa a usar diretamente o mesmo SVG técnico vivo que alimenta a etapa **Personalização**, preservando a folha branca e a mesma composição cartográfica.
- Adiciona uma guarda de runtime para impedir que qualquer renderizador PDF intermediário volte a substituir a cena vetorial na etapa Projeto.
- Centraliza a folha SVG dentro da área direita e mantém o fundo claro, visualmente coerente com a Personalização.
- A etapa Projeto continua exibindo seus campos à esquerda; somente o mecanismo de pré-visualização é unificado com o editor técnico.
- Release passa para `1.0.0-rc.148` para renovar cache-busters e impedir carregamento de assets antigos.

## V231 — Gerações com prévia viva, loader real e Memorial editável

- Consolida o fluxo documental iniciado na V230: ao selecionar um projeto, os módulos compatíveis exibem um **loader real dentro da área de pré-visualização** e só o removem quando o documento efetivamente estiver montado ou houver erro.
- **Mapas e Croquis** deixa de manter a mensagem antiga “Selecione um projeto para gerar a prancha” após a seleção; o projeto já selecionado dispara a geração do croqui automaticamente e publica o SVG técnico real na bancada.
- **Memorial Descritivo** é reduzido para `Projeto → Personalização`: tipo/número do documento, proprietário e comarca passam para Projeto, eliminando etapas separadas redundantes.
- O Memorial passa a usar **HTML técnico vivo** como pré-visualização e como base visual da Personalização. PDF deixa de ser a fonte da edição e é gerado apenas quando necessário para exportação/impressão.
- Alterações dos campos do Memorial regeneram a prévia automaticamente; a Personalização continua reunindo Memorial, Mapa, Aparência e Assinatura na mesma bancada.
- **Planialtimetria / MDT**, **Perímetros por azimute**, **Carta de confrontação** e **Relatório ambiental** passam a publicar a prévia diretamente na bancada e a participar do mesmo ciclo de conclusão de geração.
- **Loteamentos / REURB** mantém Projeto, Feições e lotes e Personalização; as múltiplas exportações são consolidadas em um único menu `Download` no rodapé.
- Corrige o menu global de **Download** da bancada compacta: abre para cima, acima do rodapé, permanece clicável e encaminha cada item ao exportador real sem ficar cortado pela área inferior.
- A **Planilha ODS** permanece no fluxo próprio já validado, sem migração estrutural.
- Mensagens estáticas antigas de geração manual foram atualizadas nos módulos que agora possuem prévia automática, evitando instruções contraditórias durante o carregamento.
- QA passa a validar o modelo de prévia viva, o loader inicial, o Memorial sem PDF intermediário, a unificação dos downloads e a preservação do fluxo ODS.
- Release passa para `1.0.0-rc.145` para renovar os cache-busters da homologação.

## V230 — Personalização unificada em todos os documentos editáveis

- Elimina o fluxo concorrente de botões independentes `Editar croqui`, `Editar memorial`, `Editar mapa` e equivalentes nos módulos documentais que já usam o motor técnico.
- **Mapas e Croquis** passam a seguir o mesmo fluxo estrutural da Prancha Técnica: `Projeto → Personalização`, com Croqui, Mapa, Aparência, Assinatura e ferramentas técnicas concentradas na própria bancada inline.
- **Memorial Descritivo** concentra edição do memorial, mapa, aparência e assinatura dentro da etapa `Personalização`, sem manter o antigo botão externo `Editar memorial`.
- **Planialtimetria / MDT** ganha etapa `Personalização` e abre o `SurveyorTechnicalDocumentEditor` diretamente na prévia, sem criar controles independentes de edição.
- **Perímetros por azimute** ganha etapa `Personalização` e usa o mesmo editor inline para a planta técnica.
- **Loteamentos / REURB** remove os botões independentes de editar/restaurar o croqui e passa a abrir o editor técnico pela etapa `Personalização`, mantendo o zoom do lote dentro desse contexto.
- O `SurveyorTechnicalDocumentEditor` passa a operar nesses fluxos com `standaloneControls:false`, preservando uma única fonte de verdade e impedindo duplicidade de ações.
- A integração visual é compartilhada pelo workspace documental central, mantendo a mesma lógica de coluna de configuração, prévia à direita e rodapé persistente usada pela Prancha Técnica.
- QA adiciona guarda estrutural específica para impedir o retorno dos botões externos e exigir Personalização integrada em todos os módulos documentais com editor técnico.
- Release passa para `1.0.0-rc.144` para renovar os cache-busters da homologação.

## V229 — Memorial e Mapas/Croquis no modelo compacto + minimapa centralizado

- Corrige definitivamente o posicionamento do minimapa da prancha lateral: o quadro interno passa a usar margens horizontais simétricas e fica abaixo do título `PLANTA DE SITUAÇÃO`, sem sobreposição no topo do quadro.
- Migra **Memorial descritivo** para a mesma bancada visual compacta usada pela Prancha Técnica: coluna estreita de configuração à esquerda, prévia exclusiva à direita e rodapé único de ações.
- O Memorial passa a manter somente as etapas `Projeto`, `Dados do documento`, `Proprietário`, `Comarca` e `Personalização`; gerar, editar memorial, editar mapa, restaurar mapa e baixar ficam no rodapé da bancada.
- Migra **Mapas e Croquis** para o mesmo modelo: `Projeto`, `Mapa`, `Dados do imóvel` e `Elementos da geração`, mantendo gerar croqui, editar croqui, restaurar posições e download no rodapé.
- Remove o cabeçalho/cartão redundante de pré-visualização nesses dois módulos, preservando a área direita inteira para o documento.
- A implementação é centralizada em `assets/js/core/documents.js` e `assets/css/core/documents.css`; não foram criadas telas paralelas nem CSS com `!important`.
- Release passa para `1.0.0-rc.143` para renovar os cache-busters da homologação.

## V228 — Projeto abre sempre na bancada compacta da prancha

- Corrige a regressão visual da etapa **Projeto** que, quando nenhuma propriedade estava selecionada, voltava ao layout legado de dois cartões largos com cabeçalho de pré-visualização.
- A etapa Projeto agora monta imediatamente a mesma bancada compacta usada depois da seleção: formulário estreito à esquerda e área exclusiva da prancha à direita, preservando as mesmas proporções durante todo o fluxo.
- O estado sem projeto usa uma folha técnica vazia de proporção horizontal como placeholder, sem trocar de estrutura quando o usuário seleciona a propriedade.
- O seletor de projetos clonado para a bancada passa a sincronizar também as opções carregadas assincronamente da nuvem; a tela pode abrir antes da lista terminar sem ficar com o select desatualizado.
- Ao desmarcar/trocar para “Selecione um projeto”, o sistema permanece na bancada compacta em vez de regressar à interface antiga.
- Release passa para `1.0.0-rc.142` para renovar os cache-busters da homologação.

## V227 — Confrontantes compactos, zoom real, sliders completos e vértices uniformes

- Remove definitivamente o destaque vermelho do lado selecionado no perímetro; a seleção de vértice continua servindo apenas para controlar as linhas automáticas reais.
- Simplifica o card de confrontante para quatro blocos úteis: nome editável, intervalo V-inicial/V-final, tamanho do nome e giro. Dados complementares permanecem exclusivamente no menu de três pontos.
- Corrige o zoom da Prancha Técnica para alterar a dimensão real do documento em pixels, preservar o foco do viewport e impedir o grande vazio branco que aparecia acima da prancha ao ampliar.
- Padroniza todos os sliders do editor com progresso visual completo até 100% do trilho, mantendo os limites funcionais próprios de cada controle.
- Elimina a escala individual legada dos vértices. `Tamanho geral` passa a ser a única fonte de verdade e todos os rótulos V-xx mantêm proporção uniforme, inclusive em projetos que possuíam ajustes individuais antigos.
- Remove controles e estilos mortos ligados ao antigo redimensionamento individual de vértices e ao antigo painel de destaque do lado.
- Release passa para `1.0.0-rc.141` para atualizar os cache-busters de JS/CSS durante a homologação.

## V226 — Ações do editor, servidão persistente e controles condicionais

- Corrige a causa estrutural que fazia o destaque de lado e a servidão recém-finalizada desaparecerem quando os elementos de referência estavam dentro de grupos SVG aninhados: novas camadas passam a ser inseridas sempre no filho direto correto do overlay técnico.
- Vértices voltam a acionar linhas automáticas reais por checkbox usando a fonte única `technicalLines`, com IDs `vertex-auto-line-*`; marcar adiciona a linha externa do vértice e desmarcar remove a mesma linha sem ressuscitar `vertex-guide-*`.
- As ações de Linhas Técnicas e Servidões ganham binding direto além da delegação do modal, evitando perda de clique após a consolidação do painel Mapa.
- Servidão finalizada por duplo clique é normalizada imediatamente, permanece visível na prancha e marca o documento como alterado para salvamento/exportação.
- O botão de concluir servidão respeita `hidden` de verdade e o ícone de confirmação permanece visível sobre o fundo azul; o antigo estado branco/invisível é eliminado.
- Em Aparência, Linhas/Tamanho/Ajuda da tabela só aparecem quando **Tabela técnica de coordenadas** estiver ativada; a cor dos nomes só aparece quando houver nome cartográfico ativo.
- Linhas Técnicas recebem feedback visual de modo ativo sem substituir o SVG do botão por texto, preservando a barra compacta de ícones.
- Release passa para `1.0.0-rc.140`, forçando atualização dos cache-busters da aplicação para impedir carregamento de JS/CSS antigo durante a homologação.

## V223 — Mapa compacto, minimapa personalizável e confrontante por lado

- Pranchas técnicas remove os cartões brancos de largura total do título e da navegação, mantendo apenas os blocos compactos necessários.
- O painel **Mapa** elimina títulos internos duplicados e instruções redundantes; cada função passa a ter uma única identificação visual.
- Vértices passam a ser listados em cartões compactos contendo somente `V-xx` e checkbox. O checkbox seleciona o lado do perímetro correspondente, sem criar a antiga linha externa automática.
- O lado selecionado é destacado em vermelho e recebe edição direta do nome do confrontante e da distância do rótulo em centímetros.
- O modelo descarta automaticamente linhas antigas `vertex-guide-*`, removendo a implementação anterior da fonte de verdade.
- Novo bloco **Minimapa** dentro de Mapa permite alternar entre Vetorial, Satélite, Topográfico e Relevo, ajustar opacidade e mostrar/ocultar o perímetro.
- Estilo, opacidade e perímetro do minimapa passam a integrar `documentVisualSettings`, o cache da prancha e a cena/exportação técnica.
- Mudança de estilo do minimapa atualiza o ativo cartográfico ao vivo sem substituir o motor de edição.

## V222 — Layout em faixas, scroll definitivo e ações compactas

- O workspace de **Pranchas técnicas** passa a usar quatro faixas visuais independentes: cabeçalho, navegação, área principal de edição/prévia e rodapé de ações.
- O rodapé deixa de sobrepor a coluna esquerda; confrontantes, polígonos, servidões e demais controles permanecem acessíveis até o fim do scroll.
- A coluna de ferramentas recebe scrollbar permanente e visível, com trilho próprio e padding final.
- As ações de **Linhas técnicas** e **Servidão** ficam compactadas em barras de ícones, preservando os handlers e a acessibilidade por `title`/`aria-label`.
- A higienização visual permanece sem `!important` em `documents.css`.

## V221 — Colapsos, rolagens e limpeza visual do editor

- O painel esquerdo do mapa volta a iniciar recolhido por padrão, evitando a faixa branca permanente; a abertura continua ocorrendo sob demanda pelas ferramentas de contexto.
- O card direito **Detalhes do elemento** ganha rolagem vertical estável no próprio container, preservando o acesso às seções inferiores e ações fixas.
- Em **Pranchas técnicas**, o modo inline mantém o painel **Mapa** com rolagem própria e o rodapé persistente visível, facilitando acesso a salvar e baixar.
- As **cotas** passam a continuar editáveis mesmo quando a função está consolidada dentro do painel **Mapa**, sem depender da aba superior antiga.
- Textos de ajuda redundantes e estados vazios desnecessários do editor integrado foram removidos para deixar a interface mais limpa.

## V220 — Scroll do painel Mapa e cotas integradas

- O painel único **Mapa** passa a ter scroll vertical próprio na coluna esquerda, com altura limitada ao workspace e scrollbar estável na borda direita.
- **Editar cotas** deixa de existir como aba superior: o botão concorrente é removido fisicamente do rail e a função permanece somente como seção interna de **Mapa**.
- A consolidação do painel Mapa fica idempotente, impedindo recriação de Elementos ou perda de seções quando a apresentação inline é montada novamente.
- Remove o CSS órfão da antiga subnavegação de ferramentas do Mapa e mantém `documents.css` sem `!important`.
- QA: nova guarda estrutural valida scroll interno, ausência da aba Editar cotas no topo e manutenção das cotas dentro do painel Mapa.

## V219 — Correções de navegação, download e alinhamento do editor de Pranchas

- Corrige a navegação superior **Prancha / Mapa / Aparência / Assinatura** com ativação direta pelo editor, eliminando cliques que não trocavam de painel.
- **Mapa** passa a ser um único painel contínuo com Elementos, Nomes no mapa, Vértices e linhas, Linhas técnicas, Servidões, Confrontantes e Editar cotas.
- Corrige o menu **Baixar** no rodapé: ele abre para cima e para dentro da viewport, sem escapar para a direita nem ficar recortado pelo shell inline.
- Consolida o estado principal **Baixar ↔ Salvar alterações**: qualquer edição torna o documento pendente; após salvar, o botão de download volta a ocupar a ação principal.
- O estado de rascunho passa a ser exibido no próprio botão **Salvar rascunho** com marca verde, sem texto lateral redundante.
- O modo Projeto monta imediatamente um shell com a mesma proporção visual da Personalização enquanto a primeira cena é preparada, evitando troca brusca de layout.
- Vértices ganham contagem automática, linha técnica automática por checkbox, destaque vermelho do lado selecionado e ajuste de distância do confrontante entre 1 e 10 cm.
- Barra superior global: ícones compactos ficam geometricamente centralizados dentro dos círculos fechados, incluindo Ferramentas e Instalar/Download.
- QA: suíte estável ampliada para 113 grupos com guarda específica da V219.

## V217 — Reorganização cirúrgica do editor de Pranchas

- A etapa superior **Baixar** deixa de existir em Pranchas: os downloads passam ao rodapé persistente e reutilizam os handlers oficiais de PDF técnico, SVG vetorial e Word editável.
- O controle **Visualização/Zoom** sai do painel lateral; zoom `− / percentual / +` passa ao centro do rodapé do editor, sem regenerar a prancha.
- A barra superior é consolidada em **Prancha / Mapa / Aparência / Assinatura**. **Mapa** agrupa Elementos, Nomes no mapa, Vértices, Linhas, Servidões, Confrontantes e Editar cotas em uma subnavegação única.
- **Desfazer/Refazer** deixam a barra de ferramentas e passam ao rodapé, junto às ações persistentes do documento.
- A exportação continua partindo da cena vetorial corrente (`SurveyorPranchaExportSource`), sem captura de tela e sem etapa de regeração.
- O layout responsivo do rodapé reorganiza ações e zoom em duas linhas em larguras menores, preservando a cascata natural e mantendo `documents.css` sem `!important`.
- QA: nova guarda estrutural valida a ausência do passo final Baixar, a composição do grupo Mapa, o rodapé de zoom/histórico/download e a exportação vetorial da cena atual.

## V216 — Higienização canônica do workspace documental

- `assets/js/core/documents.js`: removeu a limpeza redundante do rodapé já pertencente a `layout.js`, eliminou nomenclatura de compatibilidade e passou a marcar semanticamente workspace, configuração e preview por `data-*`/ARIA.
- `assets/css/core/documents.css`: removeu seletores sem produtor no runtime, comentários históricos de versões e toda dependência de `!important`, mantendo a cascata natural como autoridade.
- Preview documental: shell, cabeçalho e corpo ficam estruturalmente isolados do mapa principal; o card/corpo não dependem de `mapa/app.js` e a superfície real mantém a responsabilidade pelo scroll interno.
- QA: `test:css` agora exige zero `!important` em `documents.css` e a suíte estável inclui uma guarda específica do workspace documental.

# V215 — Consolidação CSS canônica e erradicação de resíduos

- `assets/css/features/mapa/workspace.css` foi incorporado integralmente ao `mapa/app.css` e removido fisicamente.
- Seletores top-level idênticos foram consolidados em uma única regra, preservando a autoridade visual mais recente.
- `mapa/index.html` deixa de importar a folha removida; `app.css` passa a ser a fonte canônica da interface principal do mapa.
- Removidos `SurveyorRuntimeHotfix2115g`, o marcador de hotfix em `auth.js` e o runtime global `SurveyorLegacyLayerCatalog` com seu fallback legado.
- O artefato `audit-v208.html` foi excluído e o build passou a bloqueá-lo explicitamente.
- Testes e auditorias foram atualizados para a nova fonte única de estilos.

## V214 MEGA — consolidação estrutural, precisão geodésica e CSS canônico

- Corrige a interpretação de números brasileiros com três casas decimais, impedindo que valores como `500,250` sejam convertidos para `500250`.
- Consolida CRS/UTM para o Brasil: SIRGAS 2000 zonas 18S–25S (EPSG:31978–31985), equivalentes WGS84 e SAD69, com projeção centralizada em uma única autoridade.
- Corrige anéis GeoJSON abertos para não descartar o último vértice legítimo.
- Exportação DXF passa a usar coordenadas UTM reais, metros e `LWPOLYLINE` fechada, removendo a projeção local arbitrária em torno de `(0,0)`.
- Links públicos/QR passam a usar código estável independente de `JWT_SECRET` e índice direto no Storage; a varredura global fica somente como migração compatível de códigos antigos e retroalimenta o índice.
- Proxy Cloudflare deixa de usar CORS `*` e passa a responder apenas às origens oficiais/configuradas.
- Corrigido ciclo de vida do mini-mapa do catálogo: timers são cancelados e instâncias Leaflet removidas ao trocar/fechar a prévia.
- Caminhos estáticos relativos `../assets/...` foram normalizados para `/assets/...`.
- CSS principal consolidado: histórico de patches removido, declarações superseded eliminadas e `!important` reduzido de mais de 14.000 ocorrências para apenas exceções semânticas de visibilidade (`hidden`).
- `workspace.css` fica sem `!important`; `ui.css` e `mapa/app.css` mantêm somente regras de ocultação necessárias.
- Nova guarda `test:css` impede retorno de patch stacks/HOTFIX e crescimento de especificidade forçada.
- Testes antigos foram ajustados para validar comportamento canônico, e não comentários/versionamentos ou a presença histórica de `!important`.
- A responsabilidade de exportação DXF sai do monólito do mapa e fica centralizada em `property-export.js`; a limpeza do catálogo também reduz estado órfão no runtime principal.

## V213 BETA — Download direto da cena atual

- A etapa **Baixar** de Pranchas Técnicas não participa mais do fluxo de geração/consentimento/loading.
- PDF, SVG e Word usam diretamente a cena vetorial atual publicada pelo editor nativo.
- Entrar em **Baixar** não solicita gerar novamente nem recria a prancha.
- O SVG corrente é consolidado antes de exportar para preservar a última edição visível.
- Mensagens de exportação de Pranchas deixam de usar a expressão “gere a prancha primeiro”.


## V212 BETA — downloads explícitos em Pranchas Técnicas

- A etapa **Baixar** passa a exibir diretamente as três saídas já suportadas: **PDF técnico**, **SVG vetorial** e **Word editável**.
- Os botões reaproveitam as rotas/handlers oficiais existentes (`printPreviewV19`, `downloadSvgV19` e `downloadMapWordV197`), sem criar uma segunda implementação de exportação.
- O menu de download deixa de ser deslocado para o cabeçalho da pré-visualização em Pranchas, evitando duplicidade e mantendo todas as ações de saída na etapa **Baixar**.
- A prancha atual continua sendo a fonte da exportação; entrar em **Baixar** não força nova geração.

## V211 BETA — cor em tempo real e tipografia sem falso negrito

- Remove a regra CSS legada que travava os nomes do mapa em preto e anulava o seletor de cor.
- A cor individual e a cor global dos nomes atualizam diretamente o SVG nativo no evento `input`, sem reconstruir a prancha.
- Cores claras são preservadas; somente o halo alterna automaticamente entre claro/escuro para manter contraste.
- Textos técnicos comuns passam a neutralizar explicitamente `stroke` e `paint-order` herdados, eliminando contorno SVG que simulava negrito.
- A bancada reduzida usa peso visual 300 apenas na tela; SVG/PDF continuam com a tipografia documental.
- Corrige testes antigos que ainda obrigavam o comportamento legado de nome sempre preto.

## RC139 / V209 — BETA Tipografia Vetorial Preservada

- Corrige regressão visual da V208 que fazia títulos e textos do carimbo desaparecerem na cena nativa.
- Remove a regra CSS antiga que impunha `font-weight: 500` por herança nos previews de documentos.
- Centraliza a tipografia vetorial em `technical-svg-typography.js`, sem CSS concorrente sobrescrevendo `stroke`, `paint-order` ou peso.
- Todo texto/tspan passa a receber `fill` explícito quando antes dependia do valor implícito do navegador, preservando títulos, cabeçalhos, escala e carimbo.
- Mantém peso 400 para texto normal e 700 para destaques técnicos; halos são preservados apenas para nomes semânticos que realmente precisam deles.
- Mantém o Editor Vetorial Nativo e o `SurveyorEditorEngine` sem alterações de geometria, snapping, histórico ou persistência.

## V208 BETA — Auditoria tipográfica + política única Editor/PDF

- Auditoria da V207 confirmou que o `SurveyorEditorEngine` e o documento semântico nativo estavam ativos, porém o SVG visual inicial ainda era produzido pelo renderer técnico existente; portanto, a V207 ainda não tinha um renderer 100% model-first para todos os textos estáticos da moldura, grade e carimbo.
- Identificada divergência concreta entre a bancada e o PDF: o PDF já removia `stroke`/`paint-order` dos textos e reduzia pesos 800/900 para a família suportada pelo exportador, enquanto o editor nativo montava o SVG bruto. Isso fazia cotas com halo, títulos/carimbo e textos pequenos aparecerem artificialmente mais pesados na bancada.
- Novo `technical-svg-typography.js` vira a política tipográfica única de Pranchas: editor nativo e exportação PDF aplicam a mesma normalização vetorial, família Arial, pesos compatíveis, sem halo residual nos textos comuns e com `text-rendering: geometricPrecision`.
- O documento nativo passa a capturar um `renderModel` de todos os elementos `<text>` realmente montados na prancha, com posição, transformação, peso, tamanho, preenchimento e vínculo semântico; esses primitivos também entram na `Scene` do `SurveyorEditorEngine` como nós de diagnóstico/renderização.
- O runtime `SurveyorEditorEngineRuntime.inspect()` agora expõe auditoria tipográfica antes da normalização, depois da normalização e após montagem no DOM, incluindo contagem de textos, assinaturas duplicadas, strokes, paint-order, pesos e faixa de tamanhos.
- Mantido o caminho de migração gradual: campos/camadas/objetos editáveis seguem nativos; moldura e textos estáticos ainda nascem do renderer técnico atual e agora são explicitamente registrados no `renderModel`, sem fingir que essa etapa já foi concluída.

## V207 BETA — Documento técnico nativo + SurveyorEditorEngine

- Inicia a migração oficial da edição de Pranchas para um **modelo técnico nativo**, sem usar PDF como fonte de objetos editáveis.
- Novo `native-technical-document.js` mantém campos, camadas, geometria, vértices, nomes, linhas, servidões, confrontantes, assinatura e tabela como objetos estruturados do documento.
- A bancada inline de **Pranchas Técnicas** passa a montar um único SVG vetorial como cena visual/editável; não existe mais, nesse caminho, a composição `fundo <img> + overlay SVG` que podia duplicar ou alterar visualmente textos.
- O `SurveyorEditorEngine` continua sendo o motor oficial e recebe o documento nativo e seus objetos dentro da `Scene`, preservando `GeometryKernel`, `SnapEngine`, `CommandStack`, seleção, arraste e Undo/Redo.
- Campos e camadas em tempo real atualizam simultaneamente o modelo nativo, a `Scene` do engine e o SVG visível.
- O modelo nativo passa a ser a autoridade semântica de campos/camadas/objetos editáveis; a V207 ainda reutiliza o SVG gerado pelo renderer técnico como projeção visual inicial para moldura e textos estáticos, enquanto o PDF permanece somente como saída final.
- Salvar no modo nativo publica a cena corrente e não chama a regeneração legada; `parseSvg()` e o fluxo anterior continuam preservados apenas como fallback de homologação para outros documentos/modos.
- Exportação continua consumindo o `lastSvg`, agora sincronizado diretamente da cena nativa editada, evitando uma nova conversão PDF→SVG ou reconstrução visual antes do PDF final.

## V205 BETA — Tipografia fiel e overlay sem duplicação

- Identificada a causa real do “negrito” na bancada inline: o editor clonava seletores editáveis aninhados separadamente (por exemplo, `[data-live-field-row]` e o `[data-live-field]` filho), desenhando alguns textos duas vezes exatamente na mesma posição.
- `parseSvg()` passa a extrair somente as raízes editáveis de nível superior; descendentes já contidos em uma raiz não são mais clonados novamente no overlay.
- O fundo da bancada inline deixa de ser um SVG carregado dentro de `<img>`/data URL e passa a ser o próprio SVG nativo no DOM, evitando reamostragem de textos pequenos em zoom fracionário.
- O motor próprio `SurveyorEditorEngine` permanece ativo e inalterado: Scene, GeometryKernel, SnapEngine, CommandStack e runtime de diagnóstico continuam montados pelo `technical-document-editor.js`.
- Nenhuma regra de geometria, confrontantes, cotas, vértices ou persistência foi alterada nesta correção.

## V204 BETA — Tipografia normal na edição técnica

- Corrigida apenas a apresentação tipográfica da bancada inline de Pranchas, sem alterar lógica de edição ou persistência.
- O fundo técnico da edição inline passa a permanecer em SVG vetorial em vez de ser rasterizado em PNG, evitando o efeito visual de textos pequenos aparentarem negrito durante a edição.
- O overlay editável agora inicia explicitamente com `font-weight: 400` e sem síntese artificial de peso, preservando os `font-weight` que já são intencionais no documento.
- O editor/modal legado continua usando a rasterização anterior; a mudança fica restrita ao modo inline beta.

## V202 BETA — Elementos da prancha em cena persistente

- Corrigida a causa que fazia os checkboxes de **Elementos** não refletirem imediatamente na prancha inline.
- **Cotas, cotas da gleba, vértices, confrontantes, norte, grade técnica e escala gráfica** passam a existir como camadas independentes da cena persistente.
- Marcar/desmarcar esses itens agora altera `display` diretamente no SVG/overlay ativo, sem chamar `generateSelected()` e sem fechar/reabrir o editor.
- A prévia rápida passa a renderizar antecipadamente todas as camadas opcionais e apenas controla sua visibilidade; o download final continua respeitando exatamente as opções selecionadas.
- Cache da cena de Pranchas atualizado para `v2`, sem incluir os checkboxes visuais na chave estrutural; uma mesma cena pronta pode ser reutilizada e receber os estados de visibilidade atuais.
- Pontos e rótulos de vértices passam juntos para o overlay editável, garantindo que **Vértices** desligue o conjunto completo em tempo real.
- Mantidas reconstruções somente para mudanças realmente estruturais: tipo de prancha, fundo, zoom cartográfico e formato de impressão.

## 1.0.0-rc.139 — Cor individual do nome dos confrontantes

- O editor técnico agora permite alterar, por confrontante, o nome e a cor do rótulo.
- A cor fica persistida no `confrontanteVisualLayout` do projeto e é reutilizada por Croquis, Pranchas e pelo mapa do Memorial.
- Rótulos claros, inclusive branco, recebem halo escuro automático; rótulos escuros recebem halo branco, preservando legibilidade sobre ortofoto/satélite.
- A alteração é aplicada ao vivo no editor e preservada após salvar/reabrir.

### V201 Beta — cena persistente e atualização direta sem regenerar a prancha

- separa atualização **textual** de atualização **estrutural**: título, matrícula/documento, comarca, cartório, INCRA, CIB, responsável técnico, escala e folha passam a alterar diretamente o SVG já montado, sem fechar/reabrir o editor;
- adiciona campos vivos ao overlay técnico para que o preenchimento na coluna Projeto apareça imediatamente na prancha à direita, sem pisca-pisca, loading ou rerender completo;
- cria um caminho `fastPreview` para a bancada de Pranchas que usa o projeto completo já carregado em memória e evita consultas remotas de personalização/link público durante a interação;
- adiciona cache descartável por projeto/estrutura em memória e `sessionStorage`, além de pré-aquecimento em tempo ocioso dos primeiros projetos, reduzindo drasticamente o tempo entre selecionar o projeto e ver a prancha;
- recursos mais lentos da prévia, como logo e planta de situação, são hidratados depois diretamente no overlay, sem reiniciar a prancha;
- mudanças estruturais (fundo, zoom cartográfico, formato, layout e ativação de elementos) continuam reconstruindo somente quando necessário, usando o caminho rápido;
- protege a troca de projeto para impedir que o estado visual do projeto anterior seja consolidado acidentalmente sob o novo id;
- mantém o fluxo beta Projeto → Personalização → Baixar e o editor técnico único, sem reintroduzir geração manual.

### V200 Beta — bancada contínua, auto-fit e geração silenciosa

- mantém todas as ações de edição/rascunho/cancelamento/salvamento em uma única faixa inferior, sem botões quebrando para uma segunda linha;
- ajusta automaticamente a prancha ao espaço útil da pré-visualização inline, reduzindo somente o necessário para exibir a folha inteira sem exigir rolagem vertical;
- transforma “Ajustar à tela” em enquadramento real baseado nas dimensões atuais do viewport e da prancha;
- ao selecionar um projeto, monta a base técnica em silêncio e entra diretamente na bancada inline, sem mensagens intermediárias de “gerando” ou “preparando”;
- durante alterações em tempo real, mantém a prancha atual visível enquanto a nova base SVG é recalculada, eliminando o pisca/pisca entre estados;
- preserva Projeto à esquerda, prancha à direita, Personalização beta, rascunhos e o editor técnico único das versões anteriores.

### V199 Beta — Projeto e Personalização na mesma bancada ao vivo

- faz a etapa **Projeto** usar a mesma bancada inline da **Personalização**, com formulário compacto à esquerda e a mesma prancha editável à direita;
- elimina a troca visual para o visualizador PDF ao alternar entre Projeto e Personalização quando há projeto selecionado;
- mantém os campos reais de Projeto como fonte única, usando apenas controles espelhados na coluna esquerda para preservar rascunho, eventos e validações existentes;
- mantém a pré-visualização viva durante o preenchimento: alterações do Projeto regeneram a prancha e reabrem automaticamente a mesma bancada no modo corrente;
- preserva o editor técnico único, o fluxo Projeto → Personalização → Baixar e todas as ferramentas da V198.

### V198 Beta — fluxo enxuto e pré-visualização em tempo real

- consolida **Dados do imóvel** dentro da etapa **Projeto**, removendo a aba separada;
- incorpora **Configuração da prancha** e **Elementos da geração** como ferramentas internas da Personalização beta;
- reduz o fluxo superior para **Projeto → Personalização → Baixar**, mantendo a prévia permanente ao lado;
- remove a necessidade de clicar em “Gerar croqui” em Pranchas: seleção do projeto e mudanças de campos atualizam a prancha automaticamente;
- preserva edições visuais locais antes de regenerar a base cartográfica, reabrindo o mesmo editor inline sem trocar o motor;
- corrige o zoom da Personalização inline, que era bloqueado pela regra responsiva `width:100%!important`;
- move **Salvar rascunho / Restaurar rascunho** do topo para a faixa inferior de ações e integra essa faixa ao rodapé do editor beta;
- reforça o confinamento da coluna de menus para impedir qualquer avanço sobre a área exclusiva de pré-visualização.

### V197 Beta — Personalização compacta estilo bancada

- remove o card/botão intermediário de “Abrir personalização”; ao entrar na etapa com projeto selecionado, o editor integrado assume o workspace diretamente;
- reorganiza a coluna esquerda para o padrão compacto das referências enviadas: abas textuais no topo e controles logo abaixo;
- substitui visualmente a rail vertical de ícones por 10 abas textuais, sem duplicar nem trocar o motor de edição;
- reduz a largura do painel de controles para 330–365 px e amplia a pré-visualização da prancha à direita;
- mantém integralmente nomes, confrontantes, vértices, linhas, servidões, aparência, cotas, assinatura, zoom e histórico;
- preserva o editor/modal anterior no código e apenas mantém seus acessos ocultos durante a homologação beta.

### V196 Beta — Personalização integrada na Prancha Técnica

- adiciona uma etapa **Personalização** diretamente no fluxo de Pranchas Técnicas, entre Elementos da geração e Gerar e baixar;
- reutiliza o editor técnico oficial como motor único, agora em modo inline com controles à esquerda e pré-visualização editável à direita;
- preserva no beta as ferramentas de nomes, confrontantes, vértices, linhas, servidões, polígonos, cotas, assinatura, zoom, histórico e restauração automática;
- mantém o acesso/modal anterior no código, mas oculto na tela de Pranchas enquanto a área beta é homologada;
- ao trocar de etapa, a sessão inline é apenas ocultada e pode ser retomada sem perder a edição corrente;
- salvar ou restaurar regenera a prancha e reabre automaticamente a área beta quando ela continua selecionada.

## 1.0.0-rc.137 — Geração técnica: normalizador de cores restaurado

## 1.0.0-rc.138 — Memorial com renderer único de Mapas/Croquis

- O mapa/planta incluído no Memorial passa a ser gerado pelo mesmo renderer oficial de **Mapas e Croquis**, eliminando a implementação cartográfica paralela do Memorial.
- Cores, preenchimentos, cotas, vértices, confrontantes, nomes de área, servidões, linhas técnicas, legenda e edições persistidas passam a seguir a mesma fonte de verdade do croqui.
- O renderer de Mapas/Croquis foi parametrizado para uso por outros documentos sem depender da UI da rota `/mapas/`.
- O Memorial carrega as dependências oficiais de cotas, confrontantes e vértices antes do renderer compartilhado.
- Removido o código legado de projeção, fundo cartográfico, servidões e confrontantes que duplicava a geração dentro do Memorial.
- Adicionado teste de regressão garantindo a fonte única de renderização entre Memorial e Mapas/Croquis.

- corrige o `ReferenceError: normalizeHex is not defined` introduzido na bridge técnica ao adicionar cores de linhas e nomes;
- centraliza a validação hexadecimal em `technical-map-bridge.js::normalizeHexColor()`, reutilizada pelo editor técnico e por Mapas/Croquis;
- restaura a geração de Pranchas Técnicas e Mapas/Croquis, que era interrompida antes da renderização;
- adiciona teste estável específico para impedir retorno de chamadas a helper de cor inexistente.
- mantém a nomenclatura pública corrigida como **Número CIB**, preservando aliases CNIB somente para compatibilidade de dados/modelos antigos.

## 1.0.0-rc.136 — Editor técnico: linhas por arraste + cadastro documental consolidado

- substitui o fluxo de dois cliques da ferramenta **Linhas** por pressionar sobre o polígono/vértice, arrastar e soltar, com snap no vértice técnico mais próximo;
- mantém linhas técnicas no estado oficial `documentVisualSettings.technicalLines`, preservando `geometry-v1` entre Prancha Técnica e Mapas/Croquis;
- adiciona CPF e RG opcionais do proprietário ao cadastro do projeto e reutiliza esses dados nas gerações compatíveis;
- adiciona Número CNIB após Código INCRA no Memorial e na Prancha Técnica;
- campos opcionais vazios deixam de gerar rótulos `Não informado` no quadro técnico e nas identificações do Memorial;
- amplia o cadastro de confrontantes com **Nome da propriedade**, compartilhado entre mapa, editor técnico, gerações e narrativa do Memorial;
- persiste a posição absoluta do rótulo do confrontante em `geometry-v1`, evitando reposicionamento automático após salvar/regenerar;
- alinha o fallback dinâmico do `svg2pdf.js` à versão 2.7.0 já usada nas páginas técnicas, reduzindo divergências de exportação entre navegadores/computadores.

## 1.0.0-rc.135 — Nomes do mapa: exclusão definitiva

- corrige nomes removidos no editor técnico que reapareciam após salvar/reabrir;
- coleção `areaNames` vazia passa a ser estado oficial de exclusão e não reativa mais o campo legado `areaName`;
- consolida a normalização de nomes do mapa em `technical-map-bridge.js`, removendo implementações duplicadas no editor e no gerador de mapas;
- preserva a migração de projetos antigos que ainda possuem apenas o campo legado.

## 1.0.0-rc.134 — Prancha/Mapa: download do PDF técnico real

- remove do módulo de Mapas/Pranchas o handler legado que chamava `window.print()` e imprimia a página inteira do navegador;
- centraliza o PDF de Mapas e Pranchas em `downloads.js`, usando o `Blob` real produzido por `SurveyorPdfPreview`;
- quando o Blob ainda não existe, gera o PDF oficial a partir do SVG da prancha e só então inicia o download;
- aplica a mesma rotina a `mapas.html` e `pranchas.html`, preservando SVG vetorial e Word editável;
- renomeia a opção do menu para **Baixar PDF**, deixando explícito que a ação baixa o documento técnico em vez de imprimir a interface.

## 1.0.0-rc.133 — Linhas técnicas persistentes e confrontantes sem rótulo sintético

- separa definitivamente as linhas livres da ferramenta **Linhas** dos segmentos semânticos de confrontantes;
- salva linhas técnicas em `documentVisualSettings.technicalLines`, no mesmo estado visual compartilhado do projeto;
- centraliza normalização, migração legada e renderização das linhas técnicas em `technical-map-bridge.js`;
- remove a criação ativa do confrontante fictício `__linhas-gerais__`/“Linhas gerais”, impedindo o rótulo indevido no PDF;
- preserva compatibilidade com projetos antigos migrando apenas o segmento sintético legado para linhas técnicas `geometry-v1`;
- mantém `extraLines` de confrontantes reais somente para compatibilidade com chamadas manuais antigas;
- garante que linhas desenhadas na Prancha/Croqui reapareçam após salvar, regenerar e reabrir o editor.

## 1.0.0-rc.132 — GitHub Pages transacional por tentativa

- corrige o deploy que podia iniciar sem artefato `github-pages` disponível no attempt atual;
- consolida build, upload e deploy do Pages em um único job transacional;
- usa nome de artefato único por `github.run_id` + `github.run_attempt`;
- mantém `contents: read`, `pages: write`, `id-token: write` e publicação exclusiva de `dist/surveyor-frontend`;
- reforça o teste estável do workflow para impedir regressão para jobs separados ou artefato genérico compartilhado entre attempts.

## 1.0.0-rc.131 — Memorial: mapa final opcional por geração

- adiciona na etapa **Zoom e visual** a escolha **Mapa no final do memorial: Incluir / Não incluir**;
- a opção global da Personalização passa a definir apenas o valor padrão da escolha, sem impedir a decisão em cada memorial;
- quando o mapa é desativado, o gerador não cria link público/QR, SVG nem PNG do mapa, evitando processamento e chamadas desnecessárias;
- preview/PDF/HTML/Word/TXT passam a obedecer à mesma decisão única de inclusão do mapa;
- o estado de mapa anterior é limpo ao gerar um memorial sem página cartográfica.

## 1.0.0-rc.130 — Memorial: descrição contínua e alinhamento documental único

- padroniza a descrição do Memorial como um único parágrafo corrido e plenamente justificado, seguindo o padrão documental do modelo Terezinha/Agro+;
- reutiliza a classe existente `memorial-running-text` em modelo padrão, Agro+ e modelos coloridos, removendo os seletores paralelos `standard-running-text` e `agro-running-text`;
- aplica recuo de primeira linha equivalente aos três tabuladores apenas na primeira página, sem reiniciar o recuo em páginas de continuação;
- centraliza as regras de alinhamento/fluxo da descrição em `runningMemorialDescriptionCss()`, mantendo tipografia e arte específicas de cada modelo;
- elimina a duplicação do `memorialFontOverrideCss()` no documento padrão final e passa a medir Agro+/DOCX exato com a mesma escala de fonte usada na renderização;
- mantém os templates DOCX coloridos no fluxo nativo, que já usa um único parágrafo com estilo Word `Normal` justificado.

## 1.0.0-rc.129 — Memorial: Agro+ preservado e escrita corrida compartilhada

- restaura o corpo visual/textual do Agro+ ao padrão aprovado anterior à RC128, sem reintroduzir o override legado de padding;
- Dourado, Ciano, Verde e Amarelo continuam usando o mesmo renderer `agroExact` e, portanto, o mesmo padrão textual do Agro+;
- o modelo padrão passa a reutilizar a mesma política de descrição corrida do Agro+, preservando seu próprio cabeçalho, identificação, mapa e assinaturas;
- centraliza a paginação da descrição corrida em uma única rotina compartilhada;
- consolida `closingText` como fonte textual da conclusão para preview, texto e placeholders de DOCX.

## 1.0.0-rc.128 — Memoriais coloridos: narrativa estruturada e layout limpo

- corrige a causa da descrição corrida nos modelos `agroExact`: os parágrafos gerados pelo memorial não são mais convertidos em um único bloco de texto;
- Dourado, Ciano, Verde, Amarelo e Agro+ passam a preservar um parágrafo por trecho do perímetro, com conclusão separada;
- reorganiza título, identificação e seção **DESCRIÇÃO** no mesmo padrão visual limpo do memorial padrão, preservando a arte/cor de cada modelo;
- a área útil dos modelos coloridos passa a respeitar `headerHeightMm` e `footerHeightMm` de cada template, eliminando os offsets fixos de 31/41 mm;
- remove o override legado de `padding:0!important` do Agro: a regra de página inteira passa a ser definida no próprio `customTemplatePage`;
- mantém geração, assinatura, confrontantes, personalização e demais fluxos documentais sem alteração de autoridade.

## 1.0.0-rc.127 — Cotas: escala geral + ajuste individual contextual

- restaura `dimensionScale` como escala geral oficial das cotas, de 0% a 500%, aplicada a todas as medidas da prancha/croqui;
- mantém `dimensionLabelScales` como ajuste relativo individual, exibido somente depois que o usuário clica diretamente em uma cota;
- remove os textos explicativos redundantes do painel **Editar cotas**;
- elimina a migração RC126 que convertia a escala geral em várias escalas individuais, pois a escala geral volta a ser parte oficial do estado;
- centraliza a composição `escala geral × ajuste individual` em `technical-map-bridge.js`; editor e renderer deixam de repetir essa matemática;
- preserva arraste e posição individual de cada cota por chave estável.

## 1.0.0-rc.126 — Cotas individuais e consolidação da fonte de verdade

- corrige o editor para selecionar a cota real clicada antes de redimensionar ou mover;
- substitui o controle global concorrente por escala individual por cota, entre 0% e 500%;
- persiste posição e escala de cada cota com chave estável por perímetro/gleba e segmento;
- centraliza a normalização visual das cotas em `technical-map-bridge.js`;
- move a aplicação final de escala/offset para `mapas/dimensions.js`, mantendo espessura e geometria das linhas técnicas independentes do tamanho da fonte;
- remove `dimensionScaleFor` e o normalizador duplicado de offsets do editor;
- mantém `dimensionScale` somente como compatibilidade legada, migrada automaticamente para escalas individuais ao abrir o editor.

## 1.0.0-rc.125 — Editor de cotas: mover e ampliar até 500%

- adiciona arraste direto dos textos de cota quando o painel **Editar cotas** estiver aberto;
- salva o reposicionamento individual de cada valor de cota;
- amplia o controle de escala das cotas para o intervalo de **0% até 500%**;
- atualiza as instruções do painel para orientar o ajuste de tamanho e posição.

## 1.0.0-rc.124 — Editor técnico: opção dedicada para editar cotas

- adiciona no editor de prancha/croqui uma ferramenta lateral própria **Editar cotas**;
- move o controle de tamanho do texto das cotas para esse painel dedicado;
- o botão só aparece quando a prancha possui cotas disponíveis;
- mantém o ajuste focado exclusivamente no tamanho da fonte dos valores das cotas.

# RC123 / V175 — memoriais coloridos no padrão Agro+ e menus do mapa reorganizados

- Dourado, Ciano, Verde e Amarelo passam a usar o mesmo motor de paginação e organização visual do Agro+, preservando somente a arte, a cor, o logotipo e o rodapé próprios de cada modelo;
- o cabeçalho de identificação dos modelos coloridos segue o mesmo arranjo organizado em duas colunas, e a descrição usa texto corrido/paginação automática, eliminando a fragmentação visual do layout antigo;
- a bandeja horizontal de Ferramentas do mapa passa a ser posicionada a partir do grupo de Desenho, sem o deslocamento legado por `translateX`;
- Ferramentas e Mapa tornam-se painéis mutuamente exclusivos: abrir um fecha o outro, impedindo a sobreposição vista na interface;
- remove regras CSS antigas que competiam com o posicionamento calculado da bandeja de Ferramentas, mantendo uma única fonte de verdade.

# RC121 / V173 — deploy GitHub Pages com OIDC corrigido

- adiciona workflow oficial do GitHub Pages com permissões explícitas `contents: read`, `pages: write` e `id-token: write`, corrigindo a falha `Failed to get ID Token` do `actions/deploy-pages@v5`;
- frontend publicado pelo Actions passa a usar exclusivamente `dist/surveyor-frontend`, impedindo que `functions/`, testes, scripts e documentação interna sejam enviados ao artefato público;
- pipeline usa Node.js 24, compatível com a exigência atual do projeto e com as Actions modernas;
- adiciona teste estável que impede regressão da permissão OIDC e da origem do artefato de Pages.

# RC120 / V172 — herança integral do plano pela equipe

- membros ativos da equipe passam a herdar integralmente todos os recursos comerciais do plano do titular, sem redução por papel `collaborator`, `technician` ou `manager`;
- Personalização (`company:settings`) passa a ser reconhecida também pela autorização backend usando `planPermissions` do plano compartilhado, corrigindo o 403 exibido mesmo quando a interface mostrava Plano Pro;
- frontend usa a matriz oficial do plano herdado como fonte de verdade para menus, páginas e ferramentas, evitando divergência entre tela e API;
- ao encontrar um token antigo de membro com snapshot de permissões desatualizado, o frontend renova a sessão uma única vez em `PLAN_PERMISSION_REQUIRED` e repete a operação automaticamente;
- ações operacionais de projeto/documento disponíveis no plano deixam de ser reduzidas pelo papel do membro; administração global, cobrança e gestão da assinatura continuam protegidas pelas rotas administrativas próprias.

# RC119 / V171 — personalização de equipe e edição documental consolidada

- personalização documental passa a pertencer ao workspace: membros da equipe com o plano Pro herdado podem abrir, usar e salvar a mesma identidade/modelo do titular, com leitura e gravação na nuvem e preferência de Memorial compartilhada entre computadores;
- formulários de geração ganham **Salvar rascunho** e **Restaurar rascunho**, com autosave local por usuário/tela e restauração do projeto antes dos campos dependentes;
- editor técnico remove a tabela de coordenadas já existente do fundo antes de remontar o overlay, eliminando duplicação ao salvar, sair e editar novamente;
- legendas de croquis/pranchas passam a usar as cores efetivas dos polígonos e a listar dinamicamente perímetro, servidão, cotas, vértices e demais áreas presentes;
- navegação territorial Brasil/UF passa a abrir somente uma vez por sessão autenticada; ao retornar ao mapa sem logout, centro, zoom e mapa-base usados anteriormente são restaurados;
- documentos técnicos e Memorial passam a declarar explicitamente o tipo/sistema de coordenadas (DD/SIRGAS 2000 ou UTM quando aplicável);
- editor final exibe controle **Tamanho das cotas** apenas quando a geração contém cotas, persistindo a escala visual por projeto;
- Croqui e Prancha Técnica passam a materializar o mesmo layout geometry-v1 salvo por projeto no quadro atual, preservando linhas, nomes, confrontantes e ajustes em qualquer saída que reutilize o mapa.

# RC118 / V170 — rollback controlado do painel lateral do mapa

- restaura exclusivamente o painel lateral/contextual para a implementação estável usada na RC114/V165;
- remove as alterações experimentais de largura compacta, altura por conteúdo, migração de largura e regras adicionais de colapso introduzidas nas RC115–RC117;
- restaura largura/preferência e redimensionamento originais do painel, sem alterar catálogo territorial, animações de camadas, seletor de cor, minimapa ou ferramentas rápidas;
- mantém o painel iniciando recolhido conforme o comportamento estável anterior e preserva o mapa sem regressões funcionais.

# RC117 / V169 — painel lateral sem faixa branca inferior

- painel contextual deixa de usar altura fixa de viewport e passa a terminar junto com o conteúdo visível;
- mantém o topo colado à barra operacional e preserva 24 px de segurança em relação ao rodapé/status;
- conteúdo longo passa a usar rolagem interna somente quando exceder o espaço disponível;
- regulador de largura e comportamento inicial recolhido permanecem preservados.

# RC116 / V168 — painel oculto libera 100% da largura do mapa

- corrige a faixa vazia à esquerda que permanecia mesmo com o painel contextual recolhido;
- quando fechado, o painel sai do fluxo do grid e o mapa ocupa integralmente a largura disponível;
- ao abrir Projeto, Camadas ou outro painel contextual, a coluna lateral volta normalmente com a largura redimensionável já existente;
- preserva abertura inicial limpa, regulador de largura e folga inferior do painel.

# RC115 / V167 — painel lateral contextual corrigido

- painel lateral passa a encostar exatamente na base da barra superior, sem o vão que deixava uma faixa branca perceptível por trás do vidro;
- painel deixa uma folga inferior de 24 px, preservando a leitura da faixa técnica/status do mapa;
- restaura o regulador central de largura com pegador visível e faixa redimensionável de 180 a 420 px;
- migra uma única vez a largura antiga para 228 px e depois preserva a largura escolhida pelo usuário;
- mapa passa a iniciar sempre sem painel lateral aberto; Projeto, Camadas e demais painéis só aparecem após clique explícito do usuário.

# RC114 / V166 — ajustes de layout e interação no mapa

- reduz e compacta o painel lateral de Camadas, mantendo-o abaixo da barra superior com altura útil completa, sem subir até o topo;
- desloca a gaveta das ferramentas rápidas do polígono/atalhos um pouco mais para a direita, alinhando melhor com a área central do mapa;
- empurra o minimapa um pouco mais para o canto direito para ficar no posicionamento pedido;
- bloqueia o clique acidental no mapa ao fechar o seletor nativo de cor, evitando que um clique fora do picker selecione elementos por trás.

# RC108 / V159 — catálogo estadual vira a tela oficial de Adicionar Camada

- corrige definitivamente a expansão dos grupos de camadas usando `<details>/<summary>` nativos; os cards ficam visíveis dentro do próprio painel estadual e o estado aberto/fechado continua preservado;
- transforma o navegador Brasil + UF + camadas na tela oficial do Catálogo: ao clicar em Adicionar Camada, não há mais transição para a antiga tela genérica quando a UF já está configurada;
- move para o painel central também o rodapé oficial de seleção, com contagem, Limpar seleção e Adicionar ao mapa, reutilizando os mesmos nós/eventos e sem duplicar lógica;
- `Usar <Estado>` passa a persistir a UF sem abandonar a tela integrada; voltar para a aba Catálogo a partir de Importar/Geosserviço também retorna ao navegador estadual;
- mantém Importar Camada e Geosserviço como fluxos próprios, mas a experiência de camadas oficiais passa a ter uma única interface e uma única fonte de verdade.

# RC107 / V158 — catálogo estadual interativo

- adiciona botão X no painel central de camadas; ao recolher, o mapa volta a ocupar o espaço e qualquer clique em uma UF reabre o painel;
- vincula a cor da UF selecionada à camada atualmente escolhida no catálogo (ex.: Limites de Propriedade `#FFD400`), mantendo todas as demais UFs neutras e sem mistura de cores;
- corrige a seleção de camada para não recriar o DOM antes do checkbox completar seu clique;
- transforma os grupos de camadas em acordeões determinísticos, com estado expandido preservado e chevron SVG alinhado, sem corte;
- mantém mapa, lista de UFs e lista oficial de camadas como uma única fonte de verdade.

## 1.0.0-rc.106 — V157

- Ao clicar em uma UF no seletor visual do Catálogo, o mapa do Brasil recolhe suavemente para a esquerda e a lista real de camadas compatíveis com o estado aparece no centro do modal.
- O painel de Estados continua à direita para troca imediata de UF; trocar o estado atualiza a mesma lista de camadas sem duplicar lógica.
- A lista oficial `.catalog-dialog-list` é movida temporariamente para o novo painel e devolvida ao layout normal ao confirmar a UF, preservando busca, checkboxes, preferências e eventos existentes.
- A transição usa apenas grid/opacity/translate e revalida o tamanho do Leaflet ao final para manter o Brasil corretamente enquadrado.

- RC105/V156: corrige o modal de seleção estadual que podia abrir em branco por conflito de especificidade entre `layers.css` e `layer-location.css`; abas/painéis do catálogo deixam de competir durante `choosing-location`, o mapa mantém altura mínima segura e o navegador Brasil + lista lateral ocupa a área útil sem colapsar.

## 1.0.0-rc.104 — V155 — seletor estadual em tela útil completa

- remove os blocos redundantes “BRASIL / Selecione um estado” e “Clique em um estado” de cima da malha;
- faz o navegador Brasil + lista de UFs ocupar toda a altura útil do modal de Camadas, eliminando o grande vazio inferior;
- amplia o mapa do Brasil ao reduzir o padding de enquadramento da malha;
- remove outline/borda preta de foco em estados clicados sem alterar hover ou seleção;
- preserva busca, lista lateral, destaque da UF e confirmação “Usar <Estado>”.

## 1.0.0-rc.103 / V154 — seletor visual de estado no catálogo de camadas

- Substitui a antiga tela centralizada “Estado do catálogo” por um navegador visual em duas colunas dentro do próprio modal de camadas.
- A coluna principal exibe o mapa completo do Brasil com as UFs clicáveis usando a malha oficial do IBGE; a UF escolhida recebe destaque sem sair do modal.
- A coluna lateral reúne busca, lista rolável dos estados, sigla da UF, resumo da seleção e botão contextual `Usar <Estado>`.
- O seletor do topo do catálogo continua sendo a entrada para trocar de estado, mas agora abre diretamente essa interface visual.
- Mapa e lista compartilham uma única função de seleção e preservam a preferência estadual já existente na conta.
- Em falha da malha do IBGE, a lista lateral continua funcional como fallback.

## 1.0.0-rc.102 / V153 — ferramentas rápidas sem travar o mapa

- Mantém a gaveta de ferramentas rápidas com a mesma linguagem visual clara/fosca da barra superior, mas remove o `backdrop-filter` em tempo real que forçava a GPU a recompor os tiles do mapa durante pan e zoom.
- Remove o drawer do seletor legado de vidro fosco compartilhado, deixando blur real apenas nos painéis estáticos onde o custo não acompanha cada frame do mapa.
- Isola drawer e grade com `contain`/`isolation`, reduz sombras e limita as transições dos botões a cor/borda, evitando transforms e repaints caros quando a gaveta está aberta.
- Preserva dimensões, ordem, ícones e funcionamento de todas as ferramentas rápidas.

## 1.0.0-rc.100 / V151 — Proporção unificada da barra superior

- Padroniza o botão de mais ferramentas e os controles Desfazer/Refazer em caixas quadradas de 42 px.
- Remove regras legadas de 30 px/34 px que deixavam esses controles visualmente menores que os demais.
- Mantém borda, raio, fundo, sombra e alinhamento coerentes com a barra operacional.
- Preserva estados disabled/hover e toda a lógica de Undo/Redo e ferramentas rápidas.

## 1.0.0-rc.99 / V150 — remoção dos rótulos de grupo da barra do mapa

- Remove os subtítulos redundantes `Projeto`, `Camadas`, `Desenho`, `Mapa`, `Dados` e `Histórico` exibidos abaixo dos controles da barra superior.
- Mantém os nomes individuais dos botões e toda a funcionalidade existente.
- Reduz a altura interna reservada aos grupos para eliminar espaço vazio deixado pelos subtítulos.
- Mantém a identificação do grupo de Undo/Redo por estrutura, sem depender de texto visual.

## 1.0.0-rc.98 / V149 — barra superior mais transparente + painel lateral reposicionado

- A barra superior operacional foi clareada novamente e passou a usar transparência real mais leve (`rgba(244,248,251,.28)`), mantendo o mapa visível sob o blur sem escurecer a ortofoto.
- Blur reduzido para 12 px e sombra suavizada para evitar a faixa cinza pesada das versões anteriores.
- O painel lateral esquerdo agora começa explicitamente abaixo da barra fixa e recebe altura calculada até o rodapé da viewport, impedindo que seu cabeçalho/conteúdo superior fique encoberto pelo overlay.
- O mapa continua ocupando a área completa por baixo da barra; somente o painel lateral é deslocado para preservar a leitura e o alinhamento do workspace.
- Mantido o offset dos controles cartográficos direitos abaixo da barra superior.

## 1.0.0-rc.97 / V148 — barra clara translúcida + controles direitos reposicionados

- Clareada a faixa superior operacional para um fosco azul-cinza claro translúcido, preservando o mapa visível por trás.
- Botões e busca permanecem brancos sobre a faixa.
- Corrigido o empilhamento vertical dos controles Leaflet do canto direito: bússola/home/localização/zoom iniciam abaixo da barra fixa.
- Mantidas as animações e o layout operacional existentes.

## 1.0.0-rc.94 — V145 — barra operacional fosca

## 1.0.0-rc.96 / V147 — barra superior translúcida consolidada

- Consolidada a fonte de verdade visual da barra superior operacional em `workspace.css`, arquivo carregado por último no mapa.
- Removidas as regras legadas que repintavam a barra e o pseudo-elemento `::before` com branco sólido.
- A barra passa a ficar realmente fixa sobre o mapa com fundo cinza-azulado translúcido, `backdrop-filter` e controles brancos independentes.
- Eliminado o conflito de cascata que anulava visualmente a transparência definida em `app.css`.



## RC95 / V146 — Barra superior realmente translúcida sobre o mapa

- A barra operacional superior deixa de ocupar uma faixa branca separada do mapa e passa a sobrepor o mapa de forma translúcida.
- O mapa agora continua por trás da barra, tornando o blur/fosco perceptível de verdade.
- Fundo da faixa ajustado para cinza-azulado transparente (`rgba(45,58,68,.30)`) com blur de 15 px.
- Menu, ferramentas, seletor de mapa e busca continuam em superfícies brancas para preservar contraste.
- Navegação territorial continua com tratamento visual independente.
- Fallback de redução de transparência preservado para acessibilidade.

- a barra superior do mapa operacional passa a usar fundo cinza-azulado translúcido com blur, inspirado no agrupamento dos controles cartográficos;
- os botões, menu, seletor de mapa e busca permanecem em superfícies brancas para preservar contraste e leitura;
- o efeito fica restrito ao mapa operacional e não interfere na Navegação Territorial;
- inclui fallback sem transparência para ambientes que solicitam redução desse efeito.

## 1.0.0-rc.93 — V144 — entrada animada das barras operacionais

- adiciona uma transição exclusiva ao sair da navegação territorial e entrar no mapa operacional após selecionar um município;
- a barra superior oficial entra de cima para baixo com easing suave e pequena acomodação final, sem alterar sua posição definitiva no grid;
- a barra técnica inferior entra de baixo para cima com a mesma linguagem de movimento e leve defasagem de 60 ms para evitar sensação mecânica;
- a animação é disparada somente nessa passagem territorial → operacional e reinicia corretamente ao escolher outro município na mesma sessão;
- mantém o mapa operacional já enquadrado atrás do overlay territorial, evitando salto de câmera ou reaparecimento de barras antes do momento correto;
- respeita `prefers-reduced-motion`, desativando o movimento sem comprometer o layout ou as ferramentas.

## 1.0.0-rc.92 — V143 — hover territorial exclusivo + QR com perímetro completo

- corrige o hover da navegação territorial para manter azul somente a UF atualmente sob o mouse; qualquer destaque anterior é restaurado imediatamente e o `mouseleave` limpa resíduos visuais;
- remove o `bringToFront` do hover estadual e centraliza a restauração visual em uma única rotina, evitando múltiplos estados azuis após movimentos rápidos do cursor/tooltip;
- altera o fallback compartilhado de QR Code dos documentos para priorizar `publicSnapshotUrl(project)`, codificando e exibindo o perímetro completo quando o link público curto do backend estiver indisponível;
- mantém a localização pontual curta apenas como último fallback para projetos sem perímetro utilizável ou quando o QR do snapshot não puder ser gerado;
- o visualizador público já existente reconstrói o snapshot como polígono e executa `fitBounds`, fazendo o QR abrir a área desenhada em vez de um único ponto;
- a correção é centralizada em `SurveyorDocumentAssets.publicProjectAccess`, portanto beneficia Mapas/Croquis, Prancha, Memorial, Planialtimetria e demais documentos que reutilizam esse runtime.

## 1.0.0-rc.89 — V140 — navegação territorial animada e fluida sem recuo de câmera

## 1.0.0-rc.91 — V142 — popup territorial acima da malha + paleta da referência

- Corrige a ordem de panes do Leaflet na navegação territorial: tooltips e popups agora ficam sempre acima dos estados/municípios.
- Remove a regra genérica que rebaixava todos os panes para `z-index: 400`.
- Fixa a paleta visual conforme a imagem de referência aprovada: estados `#b6c1cb`, municípios `#9fb7c1`, contornos claros e fundo `#eef3f7`.
- Torna os fills territoriais opacos para impedir variações de cor por composição com o fundo/renderer.
- Mantém as animações, cache e otimizações da V140/V141.


## 1.0.0-rc.90 — V141 — Paleta V138 e menu Mapa padronizado

- Restaura explicitamente a paleta territorial aprovada na RC87/V138, preservando as correções de animação e transição das versões posteriores.
- Estados voltam a usar renderer SVG leve para fidelidade visual da paleta; municípios permanecem em Canvas para manter desempenho com centenas de geometrias.
- A opção “Visão territorial” passa a usar a mesma grade, altura, tipografia, espaçamento e tamanho de miniatura das demais opções do menu Mapa.
- Remove o subtítulo/card especial da Visão territorial, mantendo apenas a miniatura real do Brasil e o rótulo padronizado.
- Mantém a correção do bug visual de transição e o fluxo animado sem `flyToBounds`.


- restaura movimento visível e contínuo na navegação territorial sem reintroduzir `flyToBounds`: o enquadramento usa `setView` animado com easing controlado e zoom fracionário calculado para manter a UF inteira em evidência;
- habilita novamente `zoomAnimation`, `fadeAnimation` e `markerZoomAnimation` no Leaflet territorial e centraliza a duração visual em uma transição de aproximadamente 0,6 s, preservando `prefers-reduced-motion`;
- separa UFs e municípios em renderers Canvas/panes distintos, permitindo que a malha municipal entre com fade progressivo depois da aproximação estadual sem obrigar redraw de todos os estados;
- remove alterações de estilo no hover de cada município, evitando redesenhar centenas de polígonos a cada movimento do mouse; o tooltip permanece como feedback leve;
- adiciona cache limitado das duas últimas malhas municipais consultadas, evitando novo download/processamento ao voltar para uma UF já visitada;
- elimina o enquadramento duplicado do mapa operacional: a interface operacional é preparada atrás da camada territorial, enquadrada uma única vez e só depois revelada por crossfade;
- mantém as cores e o visual territorial já aprovados na V139, mexendo apenas em movimento, transição e desempenho.

## 1.0.0-rc.88 — V139 — navegação territorial recentralizada, mini-mapa real e renderização otimizada

- corrige o enquadramento estadual para manter a UF inteira visível e em evidência, com margens técnicas consistentes em vez do zoom excessivo que cortava partes do estado;
- substitui `flyToBounds` por `fitBounds` nas transições territoriais, eliminando o efeito visual de afastar o mapa para outro lugar e depois retornar ao destino observado no vídeo de homologação;
- reduz o tempo entre seleção municipal e entrada no mapa operacional, preservando uma animação curta e contínua sem dois movimentos de câmera concorrentes;
- troca o ícone genérico da primeira opção **Visão territorial** do menu **Mapa** por uma miniatura real do mapa do Brasil no mesmo padrão visual das miniaturas de mapas-base;
- remove definitivamente o breadcrumb/botão flutuante legado de retorno territorial: a reabertura fica centralizada exclusivamente em **Mapa → Visão territorial**, mantendo uma única fonte de navegação;
- otimiza a malha territorial para uso diário com `preferCanvas`, renderer Canvas dedicado, `zoomSnap` fracionário, malha municipal simplificada do IBGE e índice O(1) para contagem de projetos por município;
- elimina `bringToFront` repetitivo no hover municipal e transições CSS por elemento, reduzindo redraws quando centenas de municípios estão visíveis;
- mantém menu e busca como controles flutuantes transparentes sobre a navegação territorial, sem recriar a faixa branca operacional;
- preserva Brasil ao fundo durante o zoom estadual, busca contextual ESTADO/MUNICÍPIO e isolamento completo do motor operacional do mapa.

## 1.0.0-rc.86 — V137 — navegação territorial integrada à busca oficial e contexto Brasil preservado

- elimina o flash inicial do mapa operacional antes da navegação territorial com um boot visual dedicado que entra antes do primeiro paint quando não há `?project=`;
- remove a caixa lateral de pesquisa da navegação territorial e reutiliza exclusivamente a busca oficial do topo (`coordSearch` + `citySuggestBox`), sem duplicar componentes nem listeners de pesquisa;
- na visão Brasil, a busca padrão assume temporariamente o modo **ESTADO**; após selecionar uma UF, muda para **MUNICÍPIO · UF** e restringe as sugestões aos municípios daquela unidade federativa;
- restaura automaticamente os modos normais **IMÓVEL / CIDADE / CAR / COORDENADAS** ao entrar no mapa operacional;
- oculta a barra moderna de ferramentas enquanto a visão Brasil/UF está ativa, mantendo visíveis somente o menu lateral e a busca padrão; as ferramentas reaparecem somente depois da transição completa para o mapa operacional;
- mantém a malha completa do Brasil carregada ao selecionar um estado: o clique apenas executa zoom animado sobre a UF e adiciona os municípios por cima dela, sem remover os demais estados do mapa;
- mantém projetos abertos por `?project=` entrando diretamente no mapa operacional e preserva o motor existente de desenho, camadas, snap, servidões, histórico e salvamento.

## 1.0.0-rc.85 — V136 — navegação territorial animada Brasil → Estado → Município

- adiciona ao módulo **Mapa** uma camada de navegação territorial isolada do editor operacional, inspirada no fluxo visual de aproximação progressiva do vídeo de referência: **Brasil → Estado → Município → mapa operacional**;
- utiliza as malhas simplificadas oficiais da **API de Malhas do IBGE** para UFs e municípios e a API de **Localidades do IBGE** para resolver os nomes municipais, sem substituir nem reescrever o motor Leaflet existente do SURVEYOR;
- ao entrar no Mapa sem `?project=`, abre a visão do Brasil; projetos abertos diretamente por URL continuam entrando no mapa operacional original, preservando links, retomada de edição, salvamento, desenho, snap, servidões, camadas e Undo/Redo;
- estados respondem a hover e clique com destaque, redução visual das regiões vizinhas e `flyToBounds`; após a seleção, os municípios da UF entram progressivamente e recebem o mesmo comportamento;
- ao selecionar um município, a navegação aproxima a malha, prepara a mesma extensão no mapa operacional e faz **crossfade** para a base cartográfica real, sem gravar qualquer geometria ou dado no projeto;
- adiciona busca contextual: na visão Brasil procura Estado/UF; na visão estadual procura município; tooltips informam o nome territorial e, quando disponível, a quantidade de projetos SURVEYOR cadastrados naquele município;
- adiciona breadcrumb territorial no mapa operacional (`Brasil › UF › Município`) e ação **Visão territorial**, além de um botão permanente na barra superior para reabrir a navegação mesmo quando o usuário entrou por **Abrir mapa livre**;
- preserva **Abrir mapa livre** como saída imediata para o fluxo operacional tradicional e mantém a última seleção territorial somente como preferência local descartável para facilitar o retorno;
- durante a navegação territorial, ferramentas operacionais da barra ficam temporariamente inativas apenas por apresentação, sem desmontar handlers, camadas ou estado do editor;
- inclui tratamento de falha/timeout da API do IBGE, opção de continuar no mapa livre e suporte a `prefers-reduced-motion` para reduzir animações por acessibilidade;
- adiciona regressão automática garantindo isolamento entre o navegador territorial e o motor oficial do mapa, uso das APIs oficiais do IBGE e bypass automático para projetos abertos por URL.

## 1.0.0-rc.84 — V135 — importação TXT inteligente em Marcar pontos

- adiciona **TXT** aos formatos aceitos pelo importador da ferramenta **Marcar pontos**, preservando os formatos já existentes ZIP/KML, KML, CSV e XLSX;
- cria parser TXT tolerante a arquivos separados por espaço, tabulação, ponto e vírgula, barra vertical e vírgula quando compatível, além de ignorar linhas vazias e comentários simples;
- sem cabeçalho, aplica a convenção oficial solicitada: **1ª coordenada = Longitude** e **2ª coordenada = Latitude**, com validação de domínio geográfico antes de aceitar o ponto;
- quando existe cabeçalho, reconhece automaticamente aliases de Longitude (`longitude`, `long`, `lon`, `lng`, `x`) e Latitude (`latitude`, `lat`, `y`) e respeita a ordem declarada no arquivo;
- reconhece decimal com ponto ou vírgula e usa heurística geográfica para ignorar identificadores numéricos anteriores ao par de coordenadas, evitando interpretar `P-01`/`1` como longitude;
- preserva nome/identificador do ponto quando disponível antes/depois das coordenadas ou em coluna nomeada (`nome`, `ponto`, `marco`, `id`, `codigo` etc.);
- limita cada importação a 5.000 pontos, mantém os dados convertidos em WGS 84 para o formulário e informa na interface se o TXT foi reconhecido por cabeçalho ou pela convenção Longitude→Latitude;
- adiciona regressão comportamental específica cobrindo TXT simples, decimal com vírgula, identificador, cabeçalho explícito e ordem de colunas detectada.

## 1.0.0-rc.83 — V134 — download pós-geração e confirmação obrigatória de dados

- move o menu **Download** dos principais documentos para o canto direito do cabeçalho da pré-visualização, removendo-o da área de ações da coluna esquerda;
- mantém o Download oculto até existir uma geração válida e sem erro, volta a escondê-lo ao iniciar uma nova geração e também invalida a exportação quando o usuário altera dados do formulário;
- centraliza em `documents.js` uma confirmação obrigatória antes da geração documental, evitando implementações separadas em Mapas/Croquis, Prancha Técnica, Memorial, Planialtimetria, Perímetros, Cartas de confrontação, Relatório Ambiental, ODS e Loteamentos/REURB;
- a confirmação apresenta um resumo dos dados efetivamente disponíveis para a geração, incluindo documento, projeto/imóvel, proprietário, CPF/CNPJ quando cadastrado, município/UF, matrícula/referência e os principais campos preenchidos na tela;
- adiciona espera obrigatória de **5 segundos** no botão de confirmação, com contagem regressiva visível antes de liberar **Confirmar e gerar**;
- adiciona a ação **Voltar e revisar**, permitindo fechar a confirmação sem disparar o gerador e retornar aos campos para correção;
- o primeiro clique em Gerar é interceptado antes do handler real; somente o clique autorizado após a confirmação recebe bypass único, preservando o loader e o fluxo de geração já existente;
- adiciona layout responsivo do modal de confirmação e posicionamento do Download na extremidade direita do cabeçalho da prévia;
- adiciona regressão automática específica cobrindo posição/visibilidade do Download, invalidação após edição, resumo de dados, CPF/CNPJ, espera de 5 segundos e bloqueio do primeiro clique.

## 1.0.0-rc.82 — V133 — alinhamento absoluto do ponto-guia pelo renderer SVG

- corrige definitivamente o desalinhamento residual do ponto de desenho em tamanhos pequenos: o guia deixa de ser um `L.divIcon` HTML e passa a ser um `L.circleMarker` projetado no mesmo renderer SVG da linha/polígono ao vivo;
- elimina a dependência de `iconSize`, `iconAnchor`, `margin-left`, `margin-top` e transforms de ícones do Leaflet para o ponto-guia, removendo a origem do offset que ainda aparecia principalmente em alguns vértices;
- centraliza a criação de todos os pontos do desenho em `createLiveDrawVertex()`, utilizada pelos dois fluxos existentes de desenho ao vivo, evitando implementações visuais concorrentes;
- mantém o regulador de precisão de 6 a 26 px convertendo o tamanho escolhido somente em raio visual, sem alterar a coordenada cartográfica central;
- preserva diferenciação visual do primeiro ponto e do cursor, tooltips numerados e fechamento do polígono pelo primeiro vértice;
- remove a implementação CSS antiga do ponto baseado em `DIV` e adiciona estilo exclusivo para o `circleMarker` SVG, garantindo que regras globais de `leaflet-div-icon` não possam mais deslocá-lo;
- reforça a regressão automática para exigir que ponto e linha compartilhem `liveRenderer` e proibir o retorno de `L.divIcon`/âncoras HTML no guia de desenho.

## 1.0.0-rc.81 — V132 — ponto de desenho alinhado e servidão geográfica dedicada com identificação da via

- corrige o desalinhamento visual entre o vértice/guia do desenho e a linha do Leaflet: os SVGs dos renderizadores deixam de receber dimensões forçadas por CSS e o ponto-guia fica ancorado pelo centro matemático do mesmo `LatLng` da geometria;
- isola `.surveyor-live-draw-point` das regras genéricas de `leaflet-div-icon`, impedindo que largura, altura e margens fixas sobrescrevam o `iconSize/iconAnchor` calculado quando o usuário reduz o indicador de precisão;
- estabelece **Desenhar servidão** como o único fluxo oficial para criar servidão geográfica no mapa; a ferramenta genérica **Linha** volta a criar somente `Linha técnica` e não nasce mais classificada como Estrada/servidão;
- remove integralmente o fluxo antigo de selecionar uma linha e acionar **Gerar servidão**; servidões criadas pela ferramenta dedicada mantêm categoria técnica fixa para evitar uma segunda conversão manual por categoria;
- ao finalizar a servidão, calcula o ponto médio do eixo e tenta identificar automaticamente a via por reverse geocoding, reconhecendo referências federais no padrão `BR-xxx` e preservando nome/ref da estrada no próprio elemento do projeto;
- adiciona painel específico da servidão com **Via / identificação**, **Largura total** e ação **Detectar via novamente**, mantendo fallback manual quando a fonte cartográfica não devolver uma identificação;
- mantém a linha desenhada como única geometria persistente; o corredor continua derivado visualmente pela largura, sem duplicar um polígono oficial no projeto;
- mostra a identificação detectada/manualmente informada sobre a servidão no mapa e reutiliza o mesmo dado em Mapas/Croquis e Prancha Técnica; o mapa incorporado ao Memorial também desenha a linha e o rótulo da via;
- centraliza o rótulo documental de servidão no `technical-map-bridge`, alinhando o texto à direção do trecho central e mantendo halo branco para leitura cartográfica;
- reforça a suíte estável com regressões para alinhamento do guia, exclusão do fluxo legado, criação dedicada, detecção de `BR-xxx`, persistência da identificação e reutilização nas gerações documentais.

## 1.0.0-rc.80 — V131 — servidão documental multiponto com curva automática

- evolui a ferramenta **Servidões** do editor técnico de um eixo limitado a dois extremos para um traçado multiponto: cada clique adiciona um ponto de controle seguindo o caminho real desejado pelo usuário;
- com três ou mais pontos, o núcleo técnico interpola automaticamente uma curva suave pelo eixo e reconstrói as duas bordas paralelas ao longo de toda a trajetória, mantendo as pontas inicial/final retas;
- permite finalizar o traçado pelo botão **Finalizar traçado**, por duplo clique no último ponto ou pela tecla Enter; `Esc` continua cancelando a operação sem criar geometria;
- mantém todos os pontos marcados como controles editáveis após a suavização, permitindo corrigir individualmente qualquer curva sem redesenhar a servidão inteira;
- preserva arraste do conjunto, ajuste de largura visual, exclusão, Undo/Redo e persistência compartilhada em `documentVisualSettings.manualServitudes`;
- consolida a nova geometria em `pointsG` no referencial `geometry-v1`; servidões antigas salvas como `x1G/y1G/x2G/y2G` são migradas automaticamente na leitura, sem manter duas fontes de verdade;
- centraliza suavização e cálculo das duas bordas em `technical-map-bridge.js`, reutilizados pelo editor e por todas as gerações documentais compatíveis;
- mantém a servidão documental sem polígono preenchido/buffer: o resultado continua sendo somente duas bordas técnicas, agora curvas quando necessário, e permanece independente da servidão geográfica do mapa;
- adiciona regressão automática específica para multipontos, suavização, edição dos pontos de controle e compatibilidade do formato legado.

## 1.0.0-rc.79 — V130 — servidão documental reta no editor técnico

- adiciona a ferramenta lateral **Servidões** ao editor técnico compartilhado, permitindo desenhar a servidão diretamente na Prancha/Croqui quando o usuário não quiser criá-la no mapa;
- o desenho documental é definido por dois cliques no eixo e renderizado **exatamente como duas linhas paralelas retas**, com extremidades `butt`, sem buffer, polígono, corredor arredondado ou alteração da geometria oficial do mapa;
- adiciona seleção, exclusão, ajuste da largura visual entre as linhas, arraste do conjunto e ajuste individual das duas extremidades diretamente na folha;
- persiste as servidões em `documentVisualSettings.manualServitudes`, no mesmo estado visual oficial do projeto, usando `geometry-v1` para conservar posição entre documentos com quadros e escalas diferentes;
- Mapas/Croquis e Pranchas passam a carregar a ponte técnica compartilhada antes do editor e reutilizam o mesmo renderizador de servidão documental;
- Memorial, Planialtimetria, Perímetros e Loteamentos/REURB compatíveis também recebem a servidão documental pelo bridge técnico já existente;
- preserva integralmente a servidão geográfica criada no mapa: o corredor derivado e arredondado do mapa continua sendo um fluxo separado e não é convertido nem substituído pela servidão documental;
- integra a nova ferramenta ao Undo/Redo, cancelamento por `Esc`, exclusão por teclado e ao salvamento/restauração do estado técnico do projeto;
- adiciona regressão automática garantindo duas linhas paralelas, pontas retas, ausência de `polygon/path` no desenho manual e carregamento correto do bridge em Mapas/Pranchas.

## 1.0.0-rc.78 — V129 — cadastro persistente de confrontantes no projeto

- transforma o cadastro semântico já existente de confrontantes em fonte permanente reutilizável do projeto: confrontantes adicionados no editor técnico passam a alimentar novas Pranchas, Mapas/Croquis e o Memorial após **Salvar alterações**;
- substitui o antigo botão `×` por menu `⋯` em cada confrontante, com **Completar/Editar cadastro** e **Excluir confrontante**;
- adiciona cadastro complementar no próprio editor compartilhado com nome/identificação, CPF/CNPJ, orientação da confrontação, tipo de divisa e observações;
- mantém `confrontanteTrechos` como fonte semântica única, sem criar coleção paralela, e sincroniza o espelho por segmento usado pelos documentos legados;
- orientação e observações passam a acompanhar o layout compartilhado e o SVG técnico, evitando perda desses dados ao alternar entre Prancha, Croqui e Memorial;
- ao excluir um confrontante, limpa também os dados semânticos antigos dos segmentos antes de reconstruir o estado atual, impedindo que o cadastro removido reapareça no Memorial;
- preserva cadastros já existentes em projetos antigos mesmo quando o layout visual salvo ainda não continha todos os campos;
- corrige a criação do primeiro confrontante quando só existe o bloco interno de **Linhas gerais**, iniciando corretamente em V-01 em vez de herdar o vértice desse bloco auxiliar;
- adiciona regressão automática cobrindo persistência do cadastro, menu de três pontos, transporte dos campos e reutilização nas gerações documentais.

## 1.0.0-rc.77 — V128 — nomes do mapa compartilhados pela geometria do projeto

- corrige a última divergência visual entre Prancha Técnica e Mapas/Croquis: os itens de **Nomes no mapa** deixam de ser posicionados pelo quadro da folha e passam a usar o mesmo referencial geométrico `geometry-v1` do projeto;
- nomes movidos no editor passam a salvar `xG/yG` normalizados pela geometria do perímetro, preservando a posição relativa mesmo quando Prancha e Croqui usam map boxes, escalas e proporções diferentes;
- o SVG documental passa a transportar explicitamente o quadro geométrico (`data-geom-x/y/w/h`) para que o editor técnico consiga converter e reaplicar posições sem depender da dimensão da página;
- ao salvar uma edição antiga, nomes legados baseados em `x/y` da folha são migrados para `geometry-v1` usando a posição visual corrente, mantendo compatibilidade sem exigir limpeza manual do projeto;
- novos nomes já nascem no referencial geométrico do imóvel e o arraste/Undo-Redo mantém o mesmo modelo de coordenadas;
- preserva leitura do formato legado até o próximo salvamento e mantém Prancha Técnica, Mapas/Croquis e demais documentos no mesmo editor técnico compartilhado;
- adiciona regressão automática específica para impedir que nomes como confrontantes/identificações reposicionados voltem a mudar de lugar entre os documentos.

## 1.0.0-rc.76 — V127 — edição técnica compartilhada por projeto

- consolida Mapas/Croquis e Pranchas Técnicas em um único estado visual oficial por projeto, impedindo que cada tela reaplique uma edição própria antiga;
- o editor deixa de gravar caches de confrontantes por página/layout nos projetos persistidos e remove resíduos legados dessas chaves ao salvar a nova edição;
- o estado persistido no projeto passa a ter prioridade sobre caches específicos da tela durante a abertura do editor;
- novos salvamentos de confrontantes, linhas manuais e deslocamentos usam o referencial `geometry-v1`, normalizado pela geometria do imóvel, para conservar alinhamento mesmo quando Prancha e Croqui usam quadros com dimensões diferentes;
- mantém leitura compatível dos layouts legados baseados no quadro documental até que o usuário faça um novo salvamento, evitando quebrar projetos existentes;
- preserva a persistência oficial em `confrontanteVisualLayout` / `documentVisualSettings` e a sincronização pelo fluxo único de projetos, sem criar um segundo motor documental;
- adiciona regressão automática específica para comprovar o compartilhamento Prancha ↔ Croqui e a compatibilidade com o formato legado.

## 1.0.0-rc.75 — V126 — assinatura unificada e editor visual do Memorial

- unifica a leitura da assinatura cadastrada: Mapas, Croquis, Pranchas e Memorial passam a consultar a mesma personalização de conta por `SurveyorDocumentAssets.resolveSignatureDataUrl`;
- adiciona assinatura editável aos layouts de Mapas/Croquis e Pranchas que ainda não possuíam o elemento técnico no SVG;
- a assinatura no editor técnico passa a ser arrastável diretamente na prancha, mantém controle de tamanho e salva posição horizontal/vertical normalizada no projeto;
- adiciona ação **Restaurar posição** sem apagar a assinatura cadastrada;
- substitui o modal simples de **Editar memorial** por um workspace visual da página, com navegação entre páginas, tamanho de fonte e assinatura arrastável/redimensionável;
- o Memorial persiste página, posição e tamanho da assinatura por projeto e aplica essa posição ao PDF final, evitando duplicidade com a assinatura fixa do template durante a renderização do PDF;
- remove o modal antigo de edição do Memorial e o fluxo independente de assinador que ficaram redundantes;
- preserva HTML/Word com a identidade documental existente e mantém o PDF/preview usando a posição escolhida no editor visual.

## 1.0.0-rc.74 — V125 — inicialização do Memorial e opções do editor técnico corrigidas

- corrige o erro fatal `options.editorNoun is not a function` que interrompia a inicialização do editor técnico no Memorial e impedia o botão **Gerar memorial** de receber todo o fluxo de eventos;
- o editor técnico passa a resolver opções de configuração por uma única função compatível tanto com valores estáticos quanto com callbacks, eliminando a suposição antiga de que `editorNoun`, `page`, `projectId`, `layoutId`, `getSvg` e `anchor` seriam sempre funções;
- mantém `editorNoun: 'mapa do memorial'` como configuração textual válida, sem exigir adaptação artificial do módulo Memorial;
- confirma que a geração do Memorial exige apenas um projeto selecionado com perímetro válido; proprietário, comarca, registro, técnico e demais campos continuam opcionais e usam os fallbacks já existentes;
- trata falha transitória do Service Worker em localhost sem deixar `FetchEvent` com Promise rejeitada não tratada;
- adiciona teste de regressão específico para impedir o retorno da incompatibilidade entre opções estáticas e callbacks.

## 1.0.0-rc.73 — V124 — geração do Memorial descritivo resiliente

- corrige o fluxo de geração do Memorial que podia permanecer em loading quando a personalização, o projeto ou a renderização aguardavam operações remotas/visuais em sequência;
- remove refresh remoto duplicado de personalização no clique de gerar e passa a usar cache/tema já carregado com fallback limitado por tempo;
- carrega primeiro a versão completa do projeto já disponível no cache documental e só força atualização remota quando a geometria não estiver disponível;
- adiciona limites explícitos às etapas de tema, personalização, projeto, montagem do template, imagens/fontes e preparação do PDF;
- qualquer falha agora aparece na própria área de pré-visualização em vez de deixar somente o spinner;
- o workspace documental passa a encerrar o overlay pelo estado real do botão e por evento explícito de conclusão, inclusive em erro;
- mantém QR, mapa, modelos personalizados, Word/PDF e editor técnico sem criar implementação paralela.

## 1.0.0-rc.72 — V123 — nomes no mapa e assinatura corrigidos no editor técnico

- corrige a camada de edição da assinatura: o elemento `data-document-signature` agora é extraído do fundo rasterizado e mantido no overlay SVG interativo, permitindo habilitar/desabilitar e redimensionar a assinatura de verdade;
- centraliza a resolução da assinatura cadastrada em `SurveyorDocumentAssets.resolveSignatureDataUrl`, reutilizada pela Prancha Técnica e pelo editor sem criar caminhos paralelos;
- ao abrir a ferramenta Assinatura, o editor força uma atualização pontual da assinatura cadastrada e sincroniza o checkbox/status sem loop assíncrono;
- corrige Nomes no mapa para permitir criar o primeiro nome digitando diretamente no campo, além do botão `+ Nome`;
- mantém o campo de nome habilitado mesmo quando ainda não existe item e renderiza o novo rótulo imediatamente no overlay e no motor formal de edição;
- consolida em um único seletor os elementos SVG editáveis da prancha, reduzindo divergência entre fundo rasterizado e overlay técnico.

## 1.0.0-rc.71 — V122 — editor técnico responsivo e detalhes fundiários sob demanda

- Corrigido loop assíncrono de hidratação da assinatura que podia travar o editor da Prancha Técnica quando não havia assinatura disponível no momento da sincronização visual.
- Selecionar um imóvel na lista agora apenas localiza e destaca o polígono vermelho; o painel Informações do imóvel abre somente ao clicar explicitamente na geometria destacada.
- O painel fundiário passa a ficar acima da lista de resultados quando aberto, preservando a lista por trás para retomada da navegação.
- Adicionado teste de regressão para impedir o retorno do loop do editor e da abertura automática do painel fundiário.

## 1.0.0-rc.70 — V121 — modos explícitos de pesquisa no mapa

- substitui a interpretação automática da barra por quatro modos escolhidos pelo usuário: **IMÓVEL**, **CIDADE**, **CAR** e **COORDENADAS**;
- mantém o tipo de pesquisa sempre destacado dentro da própria barra e salva apenas essa preferência local;
- adiciona um segundo seletor quando **COORDENADAS** está ativo, com **DD**, **DMS**, **DDM**, **UTM / SIRGAS 2000** e **EPSG / projetada**;
- muda o placeholder e o teclado esperado conforme o modo/subtipo selecionado;
- elimina o fallback cruzado entre cidade, imóvel, CAR e coordenadas, evitando que nomes como “Sítio Deus é Fiel” sejam interpretados por outro motor;
- torna o parser DD deliberadamente estrito para números, enquanto UTM/EPSG/DMS/DDM usam os parsers técnicos específicos;
- consolida o clique da lupa no roteador do app principal e remove a seleção automática antiga de formato de coordenadas como caminho paralelo;
- preserva a busca contextual por município dentro do modo IMÓVEL e a busca de localidade dentro do modo CIDADE.

## 1.0.0-rc.69 — V120 — Regulagem do guia de desenho e chip município/UF

- O botão **Polígono** ganhou menu de contexto por clique direito com a ação **Regular** e um controle deslizante compacto para ajustar o tamanho do guia de precisão de 6 a 26 px.
- A preferência do guia fica salva apenas como configuração local descartável e é reaplicada ao desenho de polígonos, linhas e demais ferramentas que reutilizam o mesmo cursor técnico.
- O tamanho visual e a área de interação do vértice/guia passam a ser derivados da mesma preferência, evitando desencontro entre o quadrado exibido e o ponto clicável.
- O chip de município da busca inteligente agora é dimensionado horizontalmente sem quebrar a UF para uma segunda linha; o campo reserva somente o espaço real necessário, com limite para não deformar a barra de pesquisa.
- Mantido o princípio de fonte única: nenhuma nova implementação paralela de desenho ou busca foi criada.

## 1.0.0-rc.68 — V119: faixa de servidão nas pranchas técnicas

- reconstrói a faixa/corredor da servidão diretamente a partir da linha técnica salva e da largura total cadastrada, sem persistir um segundo polígono no projeto;
- renderiza a faixa laranja proporcional dentro das Pranchas Técnicas, preservando a linha central como referência de eixo;
- aplica o mesmo desenho derivado em Mapas e Croquis por usar o renderizador documental compartilhado;
- mantém a segurança introduzida na RC67: a geometria oficial continua sendo somente a linha Estrada/servidão, evitando regressão do bloqueio por autointerseção no salvamento;
- adiciona regressão para garantir que o PDF/SVG técnico continue reconstruindo o corredor com metade da largura em cada lado da linha.

## 1.0.0-rc.67 — V118: servidão derivada sem bloquear o salvamento

- altera a servidão gerada para um corredor visual derivado da linha técnica, evitando persistir um segundo polígono complexo que podia bloquear o salvamento por validação topológica;
- grava a largura total diretamente na linha classificada como Estrada/servidão e reconstrói a faixa automaticamente ao carregar, editar ou atualizar o mapa;
- migra e remove automaticamente polígonos legados de servidão gerados pela RC66, preservando a largura na linha de origem quando houver vínculo;
- filtra qualquer polígono legado de servidão antes de montar o payload remoto e antes de calcular os metadados do projeto, mantendo uma única fonte geométrica persistente;
- mantém a faixa visual no mapa em pane dedicada, sem interceptar cliques nem interferir na edição do perímetro principal.

## 1.0.0-rc.66 — V117: servidão por linha, catálogo territorial isolado e limpeza visual

- remove os cartões brancos redundantes da lateral do projeto público, mantendo informações, estatísticas, camadas e detalhes diretamente sobre o painel;
- adiciona a ação contextual **Gerar servidão** para linhas classificadas como Estrada/servidão, criando um corredor poligonal pela largura total informada e registrando a relação com a linha de origem;
- remove a placa branca do rodapé de ações em Detalhes do elemento, preservando fundo branco somente nos botões;
- corrige a etapa territorial do catálogo de camadas para mostrar exclusivamente o seletor de estado até a confirmação, sem busca, lista, prévia ou rodapé vazando por baixo.

## 1.0.0-rc.65 — V116: classificação correta da busca por nome x coordenadas

- corrige a busca universal que interpretava nomes como “SÍTIO DEUS E FIEL” como coordenadas porque a palavra isolada “E” era confundida com o hemisfério East;
- passa a exigir conteúdo numérico real antes de abrir automaticamente o modo de coordenadas, preservando DD, DMS, DDM, UTM e EPSG quando há valores técnicos;
- impede nomes de imóveis iniciados por texto, inclusive nomes com números, de serem sequestrados pelo assistente COORD;
- limpa automaticamente um modo de coordenadas antigo quando o usuário troca o campo para cidade ou nome de imóvel, evitando o chip COORD ficar preso entre pesquisas;
- adiciona regressões específicas para “SITIO DEUS E FIEL”, nomes rurais com número e coordenadas decimais/UTM válidas.

## 1.0.0-rc.64 — V115: cidades renderizadas, download acionável e progresso municipal

- corrige a falha que interrompia a renderização dos municípios no seletor de download por uso de um estado de instalação não declarado;
- faz a lista municipal reaparecer normalmente ao digitar, inclusive no seletor aberto pela camada Limites de Propriedade;
- torna o ícone de download realmente clicável nas listas de municípios, sem confundir seleção da cidade com instalação dos dados locais;
- mostra o progresso diretamente no lugar da seta (`0%` a `99%`) e substitui pelo check verde ao concluir o índice municipal;
- mantém o mesmo estado de download na busca de imóvel rural, no seletor da camada e na busca direta de cidades do mapa;
- após localizar uma cidade no mapa, mantém uma ação explícita para baixar o índice municipal antes de continuar a busca por localidades;
- reaproveita o cache nacional de municípios do núcleo da interface e corrige a leitura do schema atual do IBGE (`regiao-imediata`), evitando listas vazias quando a API muda a estrutura de região;
- preserva o índice local leve, sem geometrias persistidas, e continua usando CEFIR/INEMA na Bahia e SICAR nas demais UFs.

## 1.0.0-rc.63 — V114: refinamento do vidro fosco interno no mapa

- reduz a opacidade dos cartões internos de Informações do imóvel para que CAR, SIGEF e Coordenadas acompanhem o mesmo vidro fosco do painel externo sem perder contraste;
- suaviza títulos, corpos e bordas das seções internas, mantendo textos técnicos legíveis sobre o mapa;
- refina também as superfícies internas de Detalhes do elemento, sem alterar a estrutura funcional, eventos ou dados;
- mantém o efeito restrito às áreas do mapa já aprovadas, sem espalhar transparência para outras telas.

## 1.0.0-rc.62 — V113: correção definitiva do vidro fosco no mapa

- corrige a cascata CSS que fazia regras legadas de fundo branco competir com o acabamento fosco das ferramentas rápidas e dos painéis flutuantes;
- aplica seletores de mesma hierarquia estrutural do mapa para garantir o efeito em Ferramentas rápidas, Detalhes do elemento, Informações do imóvel e Marcar pontos;
- reduz a opacidade das superfícies internas desses painéis para que o `backdrop-filter` fique visível de verdade, sem transformar o conteúdo em bloco branco;
- mantém inputs e controles com transparência controlada para preservar legibilidade, e não espalha o efeito para áreas não aprovadas.

## 1.0.0-rc.61 — V112: busca municipal, status de download e acabamento fosco do mapa

- reconhece a busca por imóvel rural já nos primeiros caracteres dos prefixos usuais (ex.: sítio, fazenda, chácara), abrindo o assistente municipal sem esperar a palavra inteira;
- filtra municípios em tempo real e seleciona automaticamente a cidade quando o nome digitado coincide exatamente com um município da UF ativa;
- exibe o mesmo estado de download municipal tanto no assistente de busca de imóvel quanto no seletor da camada Limites de Propriedade: ícone de download quando disponível, indicador durante o download e check quando já instalado;
- impede download redundante do mesmo município: ao selecionar uma cidade já instalada, o sistema informa que os dados já estão baixados e mantém o estado visual "Baixado";
- aplica o mesmo vidro fosco aprovado ao drawer de ferramentas rápidas, Detalhes do elemento, Informações do imóvel e Marcar pontos, sem espalhar o efeito para outras áreas não solicitadas;
- remove os cabeçalhos-acordeão redundantes que geravam "Etapa 1" em Acervos oficiais e o bloco artificial "Layout do Memorial Descritivo" no topo da Personalização, preservando o conteúdo funcional das telas;
- mantém as correções técnicas da edição documental, assinatura e geração do Memorial Descritivo incorporadas à base atual.

## 1.0.0-rc.60 — V110: editor técnico unificado nos mapas documentais

- cria uma ponte técnica única entre o estado visual do projeto e os SVGs documentais, reaproveitando cores de polígonos, preenchimento, nomes, vértices, confrontantes e tabela de coordenadas;
- estende o editor técnico já usado em Mapas/Croquis e Pranchas para Planialtimetria, Perímetros por Azimute, mapa do Memorial Descritivo e croqui de Loteamentos/REURB;
- faz as gerações desses módulos reaplicarem o estado salvo pelo editor, evitando que a prévia seja editada mas o documento regenerado volte ao desenho automático anterior;
- mantém as configurações visuais compartilhadas por projeto quando há projeto oficial e usa persistência local isolada para croquis de loteamentos que ainda vivem em sessão;
- preserva módulos sem mapa documental (ODS, Cartas de Confrontação e Relatório Ambiental) sem inserir controles de edição artificiais.

## 1.0.0-rc.59 — V109: acabamento visual de cotas, minimapa e ferramentas avançadas

- reduz o minimapa do canto inferior direito para liberar área útil do mapa sem alterar sua função;
- compacta a cotagem manual: setas menores, linhas auxiliares mais discretas e rótulos sem balão, alinhados à direção da linha e posicionados acima dela;
- aplica o mesmo princípio de alinhamento acima da linha às medições segmentadas do mapa;
- remove o rodapé lateral “Ambiente conectado” e elimina o espaço reservado por ele;
- remove textos explicativos dos cartões de Ferramentas avançadas, mantendo somente ícone, nome, selo e ação.

## 1.0.0-rc.58 — V108: menu dedicado para ferramentas avançadas do mapa

- adiciona um novo atalho de Ferramentas avançadas no menu expandido superior, ao lado do atalho de Glebas;
- o painel lateral Ferramentas passa a exibir somente funções avançadas que não estão duplicadas na barra superior;
- expõe Cotar manualmente, Remover última cota, Vizinhos certificados, Altitude por clique e Preferências de navegação;
- mantém os comandos legados ocultos como fonte única de execução, preservando handlers e evitando duplicação de lógica.

## 1.0.0-rc.57 — V107: ferramentas avançadas de campo, CAD e interoperabilidade

- adiciona importação de arquivos RW5/RAW de coletoras, preservando pontos, elevação e metadados para normalização de CRS antes de inserir no mapa;
- adiciona cotagem CAD manual em três cliques, com linha de cota, extensões, setas, medida persistida no projeto e restauração automática ao reabrir;
- adiciona análise de vizinhos certificados nos trechos do perímetro usando consultas oficiais pontuais SIGEF/SNCI, com aplicação assistida aos confrontantes sem inventar geometria vetorial ausente;
- adiciona consulta pontual de altitude diretamente no mapa reutilizando o DEM Terrarium já empregado pelas ferramentas de terreno;
- adiciona preferências locais de navegação para sensibilidade do zoom e escala da interface do mapa, sem alterar os dados do projeto;
- adiciona tabela técnica de coordenadas opcional ao editor de pranchas/mapas, renderizada no SVG técnico e persistida com as configurações documentais;
- mantém o salvamento manual do projeto: nenhuma rotina nova de autosave silencioso foi introduzida.

## 1.0.0-rc.56 — V106: correções gerais de mapa, documentos e planilhas

- remove o diálogo recorrente de restauração de rascunho na entrada do mapa, preservando o draft apenas como contingência interna;
- simplifica a tela de Personalização removendo o cabeçalho explicativo redundante e endurece a persistência/carregamento da assinatura cadastrada para o editor técnico;
- mantém as coordenadas superiores da grade da prancha na horizontal, preservando laterais verticais e base horizontal;
- corrige Perímetros por Azimute para pré-visualizar o relatório completo em PDF nativo, com planta, metadados e tabela técnica colorida, e faz PDF/imprimir usar o blob PDF real;
- reorganiza a Planilha ODS em área retangular, corrige proprietário/imóvel, colore tabelas de vértices e confrontantes e adiciona exportação XLSX real com estilos e três abas técnicas;
- transforma Mapa e Memorial Descritivo da Planilha ODS em avisos/CTAs explícitos, sem redirecionamento automático ao clicar na aba;
- remove o atalho duplicado de Dividir glebas da grade genérica, mantendo o lançador contextual oficial;
- corrige a exceção `edit is not defined` que interrompia a renderização dos vértices e restaura a exibição de todos os V-xx;
- melhora lock e sobreposição: elemento trancado não oferece Editar e elementos desbloqueados recebem prioridade de seleção em áreas sobrepostas.

## 1.0.0-rc.55 — V105: restauração da prévia nativa e ajustes pendentes da interface

- remove o piloto do Preview Engine próprio da Prancha Técnica e restaura integralmente o visualizador PDF nativo do navegador;
- estabiliza o viewport da pré-visualização nativa com altura controlada, rolagem interna isolada e zoom do próprio navegador, sem transferir a rolagem para a página;
- move Relatório Ambiental de “Análise e campo” para o espaço inferior de “Documentos e consulta”, equilibrando a distribuição do menu Ferramentas;
- preserva os demais módulos, a geração final e o launcher local sem introduzir um novo motor de pré-visualização.

## 1.0.0-rc.54 — V104: Preview Engine próprio na Prancha Técnica

- cria o Surveyor Preview Engine, executado localmente no navegador, com Scene, Renderer, Viewport e Engine próprios;
- substitui somente em Pranchas Técnicas o visualizador PDF nativo do navegador pelo visualizador do Surveyor, preservando as demais pré-visualizações como estavam;
- adiciona zoom próprio, ajuste à largura, página inteira, 100%, Ctrl + rolagem, pan por arraste e scroll interno independente;
- mantém a geração PDF existente e seu blob de download, usando o novo engine apenas como camada de pré-visualização;
- adiciona identificação visual `Criado por Surveyor` somente na interface da prévia, sem inserir marca d'água no PDF gerado.

## 1.0.0-rc.53 — V103: vidro fosco nos pop-ups e painéis direitos do mapa

- aplica o acabamento fosco/translúcido aos painéis e pop-ups flutuantes do lado direito do mapa, alinhando a linguagem visual aos controles GPS;
- deixa com efeito glass os painéis de detalhes do elemento, informações do imóvel e marcar ponto, mantendo legibilidade e contraste;
- estende o mesmo padrão aos menus e drawers flutuantes do topo direito (mapa base, download, projeto, busca e ferramentas rápidas), evitando blocos brancos chapados;
- uniformiza cabeçalhos, rodapés e áreas de ação dos painéis direitos com superfícies semitransparentes e blur consistente.

## 1.0.0-rc.52 — V102: assinatura integrada, bloqueio limpo e interface do mapa enxuta

- remove Assinatura digital dos menus globais; assinatura cadastrada passa a ser usada diretamente nas edições documentais.
- adiciona assinatura da conta ao editor técnico compartilhado, com ativação e tamanho persistidos na prancha/croqui.
- adiciona Editar memorial com ajuste de tamanho de fonte e inclusão da assinatura cadastrada; download/regeneração usa a configuração aplicada.
- ao trancar um perímetro, oculta vértices, numeração e guias técnicas, mantendo somente a geometria como referência até destrancar.
- simplifica os cartões de confrontantes por trecho: o próprio V-xx → V-xx abre a edição, sem botões/rótulos redundantes.
- remove textos explicativos permanentes do download municipal, glebas, confrontantes e rodapé lateral.
- aplica acabamento fosco/translúcido aos painéis contextuais do lado esquerdo do mapa.

## 1.0.0-rc.51 — V101: cores individuais por polígono na edição

- Aparência lista todos os polígonos editáveis da prancha (perímetro, glebas e demais áreas poligonais).
- Cada polígono pode receber cor, preenchimento e opacidade próprios, com prévia imediata.
- Estilos são persistidos em `documentVisualSettings.polygonStyles` e reaplicados na regeneração/impressão.
- Polígonos editáveis passam a carregar identidade/nome/categoria no SVG técnico, inclusive as glebas internas.

## 1.0.0-rc.50 — V100: nomes no mapa restaurados

- Corrige regressão que deixou `Nomes no mapa` inoperante após a migração para múltiplos nomes.
- Restaura `mapFrameFromOverlay()` como fonte única do quadro cartográfico usado por criação, seleção, arraste, escala e rotação dos nomes.
- Mantém fallback por metadados do SVG, `getBBox()` do perímetro e `viewBox`, sem depender do engine para a função básica.
- Adiciona regressão estável para impedir que o helper geométrico seja removido enquanto continuar sendo consumido pelo editor.

## 1.0.0-rc.49 — V99: ações de nomes e confrontantes restauradas

- corrige os botões `+ Nome`, `Excluir` e `+ Confrontante` com handlers diretos, independentes do delegador geral do modal;
- impede falha do histórico/engine de bloquear a criação ou exclusão de nomes e a criação de confrontantes;
- recupera automaticamente nomes já desenhados no SVG quando a configuração persistida estiver ausente, preenchendo novamente a lista do painel;
- torna a contagem de vértices resiliente para criação de novos confrontantes, usando metadados, rótulos `V-xx` e confrontantes existentes como fallback;
- adiciona regressão estável específica para as ações críticas dos painéis laterais.

## 1.0.0-rc.48 — V98: interações do editor técnico estabilizadas

- registra os controles principais do editor antes de qualquer inicialização opcional do engine, evitando modal visível com botões inertes;
- nomes no mapa, rótulos de vértices e confrontantes passam a ter arraste local estável, com sincronização com o engine quando disponível;
- mantém fallback funcional das interações caso o módulo do engine não carregue;
- corrige o checkbox de preenchimento para dimensões e estado visual próprios, sem herdar estilos globais de inputs;
- adiciona regressão estável para ordem de bootstrap, fallbacks de drag e checkbox.

## 1.0.0-rc.47 — V97: editor técnico simplificado e ferramentas laterais

- reorganiza o editor em barra lateral compacta com painéis expansíveis por ferramenta;
- elimina a barra superior carregada e preserva o quadro técnico como área principal;
- torna a abertura dos controles resiliente a falha isolada do engine, evitando editor visível porém inerte;
- estabiliza o arraste de confrontantes sem recriar o rótulo durante o movimento;
- agrupa zoom, nomes, vértices, linhas, confrontantes, aparência e histórico em painéis independentes.

## 1.0.0-rc.46 — V96: bootstrap do editor técnico restaurado

- Restaura as funções persistentes do editor técnico removidas acidentalmente na RC44/RC45 (`readOffsets`, segmentos, layout e configurações documentais).
- Corrige o `ReferenceError` no carregamento de `technical-document-editor.js` que impedia `SurveyorTechnicalDocumentEditor` de ser registrado e fazia o botão de edição falhar.
- Completa a API do engine com `removeNode`, usada pelos múltiplos nomes no mapa.
- Adiciona teste de bootstrap que executa o arquivo do editor em contexto isolado e impede nova regressão de carregamento.

## 1.0.0-rc.45 — V95: editor técnico formal restaurado

- Remove a implementação legada paralela do modal de edição de pranchas/mapas.
- Garante carregamento e inicialização do `SurveyorTechnicalDocumentEditor` antes de abrir a edição.
- Restaura toolbar completa, vértices, nomes, linhas e painel lateral de confrontantes.
- Remove textos instrutivos internos visíveis no editor.
- Adiciona regressão para impedir retorno ao editor reduzido/legado.

## 1.0.0-rc.44 — V94: confrontantes estáveis e múltiplos nomes no mapa

- corrige desaparecimento de nomes de confrontantes durante arraste no editor técnico;
- o motor aplica deslocamento visual direto e mantém visibilidade explícita durante toda a interação;
- adiciona múltiplos nomes independentes no mapa, cada um com posição, tamanho e rotação próprios;
- mantém compatibilidade automática com projetos que possuíam apenas o campo legado `areaName`;
- geração técnica passa a renderizar todos os nomes persistidos em `areaNames`.

## 1.0.0-rc.43 — V93: restauração virtual por desenho

- `Restaurar removidos virtualmente` passa a ser a primeira ação do menu de vértices.
- A restauração não depende mais de selecionar previamente um polígono. O SURVEYOR identifica todos os polígonos/linhas do projeto que possuem `surveyorHiddenVertexKeys`.
- Quando apenas um desenho possui vértices virtuais removidos, ele é selecionado automaticamente.
- Quando dois ou mais desenhos possuem vértices virtuais removidos, o usuário escolhe explicitamente de qual desenho deseja restaurar antes de entrar no modo de recuperação.
- O seletor informa nome, categoria e quantidade de vértices recuperáveis de cada elemento.

## 1.0.0-rc.42 — V92: recuperação de vértices removidos virtualmente

- adiciona ao menu de vértices do mapa a opção **Restaurar removidos virtualmente**;
- a restauração atua sobre `surveyorHiddenVertexKeys`, preservando a geometria original e recuperando o rótulo técnico V-xx;
- vértices ocultados ficam destacados em verde durante o modo de restauração e podem ser recuperados individualmente;
- mantém remoção virtual e remoção definitiva no mesmo fluxo, com Undo/Redo, snapshot de recuperação e persistência do projeto;
- o fluxo funciona também para vértices ocultados em sessões anteriores, desde que os metadados do projeto tenham sido salvos.

## 1.0.0-rc.41 — V91: estabilidade do editor técnico após homologação em vídeo

- Corrige desaparecimento de nomes de confrontantes durante arraste: captura do ponteiro passa a usar o viewport estável e o engine renderiza somente o nó ativo durante o movimento.
- Corrige perda de linhas ao editar/concluir: visibilidade original é restaurável e todas as linhas permanecem representadas pela prévia consolidada.
- O editor passa a hidratar coordenadas absolutas a partir do SVG renderizado, evitando usar diretamente coordenadas normalizadas persistidas como se fossem coordenadas da sessão.
- Linhas automáticas existentes são materializadas para o modo de edição quando necessário, permitindo editar todos os traçados exibidos.
- Mantém geração documental inalterada; correções limitadas ao editor local.

## 1.0.0-rc.40 — V90: edição técnica avançada e estabilidade do motor

- Remove a identificação interna “Engine local” da interface do usuário, mantendo o motor apenas como infraestrutura técnica.
- Nome no mapa passa a ter cor preta explícita, tamanho ajustável, rotação ajustável e arraste persistente.
- Corrige o desaparecimento de nomes de confrontantes durante/após arraste, sincronizando o estado do motor com o segmento em tempo real.
- Confrontantes adicionados depois da abertura do editor passam a ser registrados dinamicamente no motor e ficam arrastáveis sem reabrir a edição.
- Adiciona redimensionamento individual de rótulos V-xx, seleção visual do vértice, restauração individual e persistência na geração final.
- Adiciona modo “Editar linhas”: todas as linhas manuais ficam editáveis, a linha inteira pode ser arrastada, as pontas podem ser reposicionadas e a linha selecionada pode ser excluída.
- Arraste de linha passa a atualizar o SVG existente durante o movimento, sem recriar o alvo a cada pixel, evitando perda de captura do ponteiro.
- Acrescenta atalhos Ctrl/Cmd+Z, Ctrl/Cmd+Y e Delete/Backspace para histórico e linha selecionada.
- Mantém geração atual separada do motor e preserva o formato de persistência do projeto.

## 1.0.0-rc.39 — V89: motor formal de edição local

- Cria `/assets/js/core/editor-engine/` como motor de edição real e isolado, separado do fluxo atual de geração.
- Adiciona `SurveyorEditorEngine`, `Scene/SceneNode`, `CommandStack`, `EventBus`, `GeometryKernel`, `SnapEngine`, `RendererRegistry`, `InteractionController` e worker geométrico dedicado.
- O editor técnico oficial passa a carregar o engine no navegador e delega ao motor o arraste do nome da área, rótulos V-xx e rótulos de confrontantes.
- Undo/Redo do editor passa a reconhecer o histórico transacional do engine para as interações migradas.
- Remove as implementações legadas duplicadas de drag do nome da área e dos rótulos de vértice, mantendo uma única implementação para essas interações.
- Expõe diagnóstico somente de runtime em `window.SurveyorEditorEngineRuntime.inspect()` para homologação técnica.
- A geração de prancha/croqui/PDF permanece inalterada; o engine atua somente durante a edição local.

## 1.0.0-rc.38 — V88: persistência documental e cotas/medição ao vivo

- Corrige a regeneração da prancha após editar: nome no mapa e novos confrontantes passam a usar uma única revisão transacional e entram imediatamente no SVG/PDF seguinte.
- Mantém fallback local somente quando ele é mais recente que a cópia remota, evitando regressão para layout antigo após Salvar alterações.
- Corrige a ferramenta Medir, removendo handler de duplo clique inexistente que interrompia a inicialização antes do mousemove.
- Cotas de segmentos permanecem visíveis ao entrar em Editar geometria e são recalculadas em tempo real durante o arrasto de vértices/arestas.

## 1.0.0-rc.37 — V87: confrontantes e nome da área direto no editor técnico

- Adiciona botão `+` no painel **Confrontantes e linhas** para cadastrar confrontantes diretamente na edição da prancha/croqui, sem retornar ao mapa.
- Confrontantes criados no editor passam a permitir seleção de vértice inicial/final, edição do nome, tamanho, rotação e remoção antes de salvar.
- Inclui o campo **Nome no mapa** na barra do editor técnico; o texto aparece sobre a área e pode ser arrastado livremente dentro do quadro cartográfico.
- Persiste o nome e sua posição em `documentVisualSettings` do perímetro, reutilizando a mesma configuração na regeneração do documento e no projeto salvo.
- Mantém Undo/Redo, linhas livres, vértices, preenchimento e salvamento WYSIWYG do editor oficial.

## 1.0.0-rc.36 — V86: download municipal destravado em lotes pequenos

- Corrige o índice municipal que podia permanecer indefinidamente em `baixando somente dados de pesquisa` antes do primeiro lote.
- Reduz o lote WFS de 5.000 para 400 registros, evitando consultas pesadas do GeoServer em BBOX municipal.
- Tenta WFS 2.0.0 primeiro, com paginação nativa por `COUNT`/`STARTINDEX`, e mantém fallback 1.1.0/1.0.0.
- Limita cada tentativa de lote a 25 segundos; falhas passam para a próxima versão do WFS em vez de deixar a interface parada por vários minutos.
- Adiciona estados reais de progresso: preparando índice, conectando à fonte oficial e contagem de imóveis recebidos.
- Mantém índice sem geometria, escopo municipal, IndexedDB e geometria sob demanda.

## 1.0.0-rc.35 — V85: seletor lateral de cidade com download automático

- `Baixar dados` abre uma caixa lateral própria para escolher o município, sem depender da busca superior do mapa.
- A seleção de uma cidade inicia o download imediatamente; foi removida a segunda confirmação que interrompia o fluxo.
- O status da camada orienta explicitamente a clicar em `Baixar dados` e escolher a cidade.
- O filtro municipal deixa de depender de a fonte oficial publicar um atributo de município: usa `CQL_FILTER` quando disponível e resolve `BBOX` municipal robustamente quando não estiver.
- Mantidos índice compacto sem geometria, IndexedDB, geometria sob demanda e navegação persistente entre resultados.

## 1.0.0-rc.34 — V84: seletor municipal do índice rápido corrigido

- `Baixar dados` em Limites de Propriedade agora abre um seletor próprio de município antes de iniciar qualquer download.
- O download municipal não depende mais da cidade eventualmente ativa na busca superior do mapa.
- O `DescribeFeatureType` usado pelo índice sincroniza os campos municipais reais publicados pelo INEMA/CEFIR antes de montar o filtro WFS.
- Quando a fonte não expõe atributo municipal utilizável, o índice mantém o escopo por município com filtro `BBOX` no servidor, sem retornar ao download estadual e sem persistir geometria.
- Mantidos índice compacto, IndexedDB, pesquisa por nome/CAR e geometria sob demanda.

# CHANGELOG

## 1.0.0-rc.33 — V83: índice municipal compacto de imóveis

- Substitui a instalação estadual do índice de pesquisa por instalação estritamente municipal, vinculada ao município selecionado na busca de imóveis.
- O WFS passa a receber `CQL_FILTER` de município no servidor, evitando transferir mais de um milhão de registros estaduais quando a pesquisa precisa de apenas uma cidade.
- Mantém somente nome do imóvel, CAR, identificadores e área em registros compactos; município/UF passam a existir no manifesto do lote em vez de serem repetidos em cada imóvel.
- Cria banco IndexedDB `surveyor-property-search-index-v5`, isolando cada município por escopo e geração e descartando automaticamente o índice estadual legado v4.
- A pesquisa local consulta exclusivamente o índice do município selecionado; sem índice municipal instalado, a fonte oficial online permanece como fallback.
- Geometria continua fora do índice e é carregada somente para o resultado selecionado, preservando o cache temporário de navegação.

## 1.0.0-rc.32 — V82: índice leve de pesquisa de imóveis

- Substitui o cache cadastral amplo por um índice textual compacto de pesquisa em IndexedDB, sem geometria persistida.
- O download de Limites de Propriedade passa a solicitar somente campos essenciais: nome do imóvel, município, CAR, identificadores e área quando disponível.
- Remove a duplicação de todos os atributos JSON por imóvel, reduzindo armazenamento, parse e indexação no navegador.
- Mantém a geometria 100% sob demanda: somente o imóvel selecionado é consultado na fonte oficial para destaque no mapa.
- Adiciona cache temporário LRU de até 20 geometrias recentes para acelerar Anterior/Próximo sem transformar o navegador em repositório de polígonos.
- Busca local amplia o limite de resultados compatíveis para até 1.000 registros leves, preservando navegação persistente e destaque vermelho.

## 1.0.0-rc.31 — V81: restaura desenho manual de gleba

- Corrigido `ReferenceError` no desenho manual causado por `singleClickTimer` fora do escopo da ferramenta.
- O modo manual agora registra explicitamente o evento `dblclick` usado para finalizar a gleba sobre um ponto confirmado.
- Removida referência residual a `lastClickAt`, que não pertencia mais ao fluxo manual.
- Teste de regressão passou a validar especificamente o bloco de `startManualGlebaDrawing`, impedindo falso positivo por handlers de outras ferramentas.
- Navegação persistente dos resultados de imóveis da RC30 foi preservada.

## 1.0.0-rc.30 — V80: navegação persistente entre resultados de imóveis rurais

- A lista de resultados da busca por nome de imóvel rural permanece aberta após localizar um imóvel no mapa.
- Adicionadas setas Anterior/Próximo e contador do resultado atualmente visualizado.
- O imóvel ativo fica destacado em vermelho na lista, acompanhando o polígono vermelho exibido no mapa.
- Ao avançar para outro resultado, o destaque anterior é removido e somente o imóvel atual permanece em vermelho.
- Cliques no mapa não encerram o painel contextual da pesquisa de imóveis.
- A lista passa a renderizar todos os resultados retornados pela consulta, mantendo rolagem interna.

## 1.0.0-rc.29 — V79: bloqueio de camadas e gleba manual livre

- adiciona cadeado na aba Editar das camadas desenhadas; o estado fica salvo nos metadados do projeto;
- camada trancada não aceita edição geométrica, alteração visual, ocultação, divisão, exclusão, renomeação ou edição de confrontantes até ser destrancada;
- mantém a camada trancada disponível como referência/base para o desenho de novas glebas;
- desenho manual de gleba passa a aceitar pontos livres em qualquer posição válida no interior do polígono base, sem limite máximo de vértices;
- duplo clique sobre qualquer ponto confirmado finaliza imediatamente a gleba, sem criar ponto extra;
- clique simples é diferenciado do duplo clique para evitar fechamento tardio ou vértices duplicados.


## 1.0.0-rc.28 — V78: cabeçalho único no painel de detalhes

- Remove o segundo título duplicado “Detalhes do elemento” do painel lateral direito.
- Move o botão X para o canto superior direito do cabeçalho principal, mantendo-o sempre visível.
- Preserva o indicador de cor do elemento no mesmo cabeçalho principal.
- Mantém as abas Descrição/Editar imediatamente abaixo do cabeçalho, sem espaço redundante.

## 1.0.0-rc.27 — V77: finalização da gleba manual por duplo clique no ponto

- Mantém a gleba manual sem limite máximo de pontos: o usuário pode adicionar quantos vértices precisar.
- A gleba passa a finalizar somente quando já houver pelo menos 3 pontos e o usuário der duplo clique diretamente sobre um ponto marcado.
- O duplo clique no mapa vazio deixa de finalizar/adicionar ponto acidentalmente.
- Enter continua disponível como atalho alternativo; Escape cancela e Backspace/Delete removem o último ponto.

## 1.0.0-rc.26 — V76: painel de detalhes otimizado

- Amplia o painel Detalhes do elemento e a área de pesquisa superior.
- Reorganiza o painel em abas Descrição e Editar para reduzir poluição visual sem remover funções existentes.

## 1.0.0-rc.25 — V75: gleba manual e painel de camadas reorganizado

- Adiciona desenho de gleba manual diretamente no mapa, com snap em vértices e também nas arestas do polígono base.
- Move a ação Adicionar camada para um botão + no cabeçalho do painel Camadas.
- Reorganiza cartões de camadas desenhadas em abas Descrição e Editar, preservando Ver, Confrontantes, edição geométrica, ocultar/mostrar, dividir e controles de estilo.
- Mantém a geometria manual restrita ao polígono base e salva a gleba criada como camada real do projeto.

## 1.0.0-rc.24 — V74: arraste real dos vértices e loading simplificado

- Corrigido o arraste dos rótulos `V-xx` no editor técnico: o manipulador agora recebe explicitamente o estado do documento e deixa de depender de variável fora do seu escopo.
- Adicionado pointer capture no próprio rótulo, bloqueio de seleção/touch e finalização segura do arraste.
- Mantida a persistência do deslocamento dos `V-xx` no projeto para Prancha Técnica e Mapas/Croquis.
- Loading de salvar/regenerar simplificado para overlay opaco com spinner central, sem caixa branca e sem textos.

## 1.0.0-rc.23 — V73: editor técnico reconstruído sobre a base estável

- Correção refeita sobre a RC20 estável para eliminar regressões introduzidas nas tentativas seguintes.
- Controle de tamanho dos rótulos V-xx e preenchimento do perímetro continuam aplicados em tempo real e persistidos no projeto.
- Rótulos V-xx passam a aceitar arraste direto com persistência por vértice.
- Linhas manuais passam a ter área de captura invisível e podem ser movidas inteiras ou ajustadas pelas extremidades.
- Editor recupera confrontantes do estado persistido do projeto quando o SVG não traz os grupos visuais.
- Quando não existem confrontantes, um bloco técnico de linhas gerais mantém a ferramenta de desenho disponível sem contaminar o cadastro semântico do imóvel.
- CSS do editor corrigido para não bloquear eventos de ponteiro dos rótulos V-xx e das linhas manuais.

## 1.0.0-rc.20 — V70: Technical Engine integrada às gerações oficiais

- A rota experimental `/pranchas-v2/` foi removida após a validação do laboratório.
- O editor técnico passa a operar diretamente nas gerações oficiais de Pranchas Técnicas, Mapas/Croquis e demais documentos que já compartilham o fluxo de confrontantes.
- O botão de edição agora usa o nome do documento: `Editar prancha técnica`, `Editar croqui`, `Editar planialtimetria` ou `Editar perímetro`.
- O antigo módulo de editor de confrontantes foi consolidado como `technical-document-editor.js`, preservando os dados e layouts já salvos.
- O editor oficial mantém desenho e remoção de linhas, Undo/Redo, ajuste de vértices, preenchimento, edição de nomes, tamanho, rotação e posicionamento dos confrontantes.
- Documentos sem confrontantes cadastrados também podem abrir o editor quando possuem perímetro/vértices editáveis.
- A Prancha Técnica original e o Croqui original continuam sendo os renderizadores oficiais; a Technical Engine passa a ser a camada oficial de edição, sem rota de laboratório paralela.

## 1.0.0-rc.19 — V69: ajuste de tipografia e teste de linhas de confrontação na V2

- Corrigido o excesso de negrito na Prancha Técnica V2, especialmente no quadro de informações laterais e rótulos do mapa.
- Prancha Técnica V2 ganhou edição experimental de linhas de confrontação: criação manual sobre o mapa, rótulo opcional, estilo contínuo/tracejado, desfazer e limpar.
- Contador de linhas de teste adicionado ao painel de métricas da V2.
- A nova edição continua isolada em `/pranchas-v2/` e não altera a Prancha Técnica oficial.

## 1.0.0-rc.18 — V68 Technical Engine V2 com modelo oficial

- Prancha Técnica V2 passa a reproduzir a composição visual da prancha georreferenciada oficial em vez do layout experimental simplificado.
- Engine V2 permanece isolada e não substitui `/pranchas/`.
- Renderer vetorial próprio usa o mesmo quadro lateral, moldura, área cartográfica, planta de situação, quadro de áreas e rodapé visual do modelo oficial.
- Adicionados controles experimentais de escala e deslocamento do mapa, tamanho global de textos e espessura do perímetro.
- Vértices V-xx continuam editáveis por arraste e ganharam halo branco para preservar legibilidade sem o aspecto preto/blocado da primeira prova.

## 1.0.0-rc.17 — V67: bootstrap visível da Prancha Técnica V2

- Corrigida a tela totalmente branca em `/pranchas-v2/`: a rota experimental carregava `auth-guard.js`, que ocultava a página, mas não carregava `portal.js` e `ui.js` para concluir o gate protegido e liberar a interface.
- A V2 agora usa o mesmo ciclo central de autenticação/revelação das páginas oficiais, sem incorporar o gerador legado de Pranchas/Mapas.
- Teste estável da Technical Engine passou a exigir explicitamente `portal.js` e `ui.js` na rota V2 para impedir regressão do bootstrap.

## 1.0.0-rc.15 — V65: link curto garantido para localização

- Documentos continuam priorizando o link curto persistente do projeto quando a API atualizada estiver disponível.
- Se o endpoint curto do backend estiver indisponível, a geração não exibe mais `Link público indisponível`: passa a criar um código curto local de 10 caracteres a partir da posição do imóvel.
- O fallback usa `/p/?l=XXXXX-XXXXX`, sem coordenadas legíveis, snapshot extenso ou token no documento.
- `/p/` e o visualizador público passaram a decodificar esse código e abrir a localização do imóvel diretamente no mapa.
- O fallback curto é independente do backend e elimina a regressão observada em ambientes onde a Function ainda não foi atualizada.

## 1.0.0-rc.14 — Link curto obrigatório nos documentos

- Pranchas e documentos passam a resolver o link curto persistente antes de qualquer mecanismo legado de compartilhamento.
- URLs longas com `#snapshot=` ou token deixam de ser impressas como fallback documental.
- Se o backend de link curto não estiver implantado/atualizado, a geração sinaliza indisponibilidade em vez de publicar um endereço gigantesco.
- QR Code e texto do documento continuam usando exatamente a mesma URL curta.

## 1.0.0-rc.13 — Link curto persistente nos documentos

- Pranchas e documentos agora ativam um link público curto próprio do projeto no backend, independente do mecanismo avançado de compartilhamento.
- O fallback por snapshot longo só permanece como último recurso quando nenhuma API autenticada estiver disponível.
- `/api/public/short/:code` aceita o link documental explicitamente ativado pelo proprietário e mantém a visualização somente leitura.
- QR Code e texto impresso passam a apontar para o mesmo endereço curto persistente.

## 1.0.0-rc.12 — V62 link público curto

- Links públicos documentais passam a usar o formato curto `https://surveyorr.com.br/p/?c=XXXXX-XXXXX`, fácil de digitar e imprimir.
- Código curto determinístico com 50 bits em Base32 Crockford, evitando caracteres ambíguos (I, L e O) e sem expor ID do projeto, token ou geometria.
- O QR Code usa exatamente o mesmo link curto mostrado no documento.
- O backend resolve o código curto somente quando existe compartilhamento público ativo; revogação/expiração continuam válidas.
- O visualizador público aceita código com ou sem hífen e normaliza caracteres digitados manualmente.


## 1.0.0-rc.11 — V61 QR público resiliente

- Corrigida a ausência persistente de QR Code/link público nas pranchas e mapas quando a API de compartilhamento falha.
- Adicionado fallback público compacto no próprio domínio do SURVEYOR: o perímetro é codificado no hash da URL sem expor credenciais e pode ser visualizado em `/public-project/` sem depender da criação de share no backend.
- O visualizador público agora reconstrói e exibe o perímetro a partir desse snapshot quando não há token de compartilhamento.
- Mapas/Croquis, Pranchas, Memorial e Planialtimetria passam o projeto completo ao resolvedor de acesso público, permitindo o fallback geométrico.
- Revisão de frontend avançada para `1.0.0-rc.11`, invalidando os antigos `?v=1.0.0-rc.10` e evitando JavaScript obsoleto no navegador após atualização do deploy.

## V60 — QR Code e link público documental

- Corrigida a origem do link público para usar o domínio oficial do Surveyor mesmo quando a geração é testada localmente.
- O gerador passa a aproveitar `url/publicUrl` retornado pelo backend, renovar compartilhamentos expirados e criar um compartilhamento somente leitura durável quando necessário.
- Sessão pode ser renovada pelo módulo documental antes de desistir da criação do QR Code.
- CORS e validação de origem de mutações agora reconhecem qualquer subdomínio HTTPS oficial de `surveyorr.com.br`, eliminando falha de criação do compartilhamento em hosts oficiais não listados individualmente.
- Criação de compartilhamento usa chave de idempotência e os testes estáveis protegem o fluxo de QR/link contra regressão.

## RC10 V59 — Vértice virtual, layout compartilhado e QR Code

- Remoção virtual passa a ocultar ponto e rótulo V-xx, preservando integralmente a geometria.
- Seletor de remoção virtual/definitiva centralizado na tela.
- Edição de confrontantes salva na prancha passa a ser lida como fonte única por Mapas e croquis.
- Geração de link público/QR Code ganhou retentativa e fallback para URL pública já existente no projeto.
## MAP_LAYOUT_OFICIAL_V58 — salvamento com loading + vértice virtual/definitivo

- Editor de confrontantes: **Salvar alterações** agora exibe loading com spinner durante a persistência e toda a regeneração; o overlay desaparece somente quando a nova pré-visualização termina.
- Pranchas/Mapas: removidas as linhas automáticas longas que ligavam rótulos V-xx deslocados aos vértices; permanecem apenas ponto e numeração técnica.
- Mapa: **Remover vértice** agora abre duas escolhas: **Remoção virtual** (mantém coordenada/geometria e oculta apenas o rótulo V-xx nas gerações) e **Remoção definitiva** (remove a coordenada e reconecta os vizinhos).
- Remoção virtual é persistida em `surveyorHiddenVertexKeys` e respeitada na geração sem renumerar os demais vértices.
- A ferramenta permanece ativa para remover vários vértices em sequência e é encerrada pelo menu do botão direito em **Cancelar ferramenta**.

## MAP_LAYOUT_OFICIAL_V55 — confrontantes WYSIWYG exatos na geração
### Ajustes do editor de confrontantes (V57)
- Reorganizado o topo do editor: zoom à esquerda e ações/controles de edição à direita, sem textos instrutivos residuais.
- Controle de tamanho dos rótulos V-01, V-02... agora atualiza a prévia em tempo real e permanece integrado ao desfazer/refazer.
- Controle de preenchimento agora remove/restaura visualmente o preenchimento amarelo do perímetro na própria prévia e persiste na geração salva.


- Corrigida a persistência visual dos confrontantes para que **a linha saia exatamente onde foi desenhada no editor**.
- O gerador agora prioriza coordenadas normalizadas pelo próprio quadro do mapa, evitando ampliar, deslocar ou deformar linhas ao regenerar Prancha Técnica/Mapa e Croqui.
- Ao existir linha manual desenhada pelo usuário, as antigas chamadas automáticas daquele confrontante deixam de reaparecer por trás e bagunçar o documento.
- Cada ação **Desenhar linha** continua criando uma linha independente, encerrada no segundo clique; linhas seguintes não substituem as anteriores.
- O layout normalizado é salvo imediatamente no navegador e também no projeto (layout visual v6), garantindo a mesma renderização mesmo durante a sincronização com a nuvem.
- Prancha/Croqui forçam recarga atualizada do projeto antes de regenerar.
- Linhas permanecem pontilhadas no editor e no documento final; posição/tamanho/rotação dos nomes permanecem persistidos.

## MAP_LAYOUT_OFICIAL_V55 — persistência real das linhas + escala geométrica + QR restaurado

- **Prancha Técnica:** corrigida a regressão em que os nomes dos confrontantes eram preservados, mas as linhas desenhadas desapareciam depois de **Salvar alterações** e regenerar a prancha.
- **Mapa/Croqui:** linhas editadas deixaram de usar somente coordenadas absolutas/do quadro; o layout visual v4 passa a salvar coordenadas relativas à **geometria do imóvel**, preservando posição, comprimento e direção entre diferentes modelos de geração.
- **Linhas pontilhadas:** chamadas principais e linhas adicionais passam a sair pontilhadas no editor e no documento final.
- **Desenho simplificado:** o comando **Desenhar linha** cria uma única linha por vez; dois cliques encerram o traçado. Para outra linha, basta acionar o comando novamente.
- **Persistência no projeto:** `confrontanteVisualLayout` passa para **v4** e vira a fonte prioritária das gerações, impedindo que uma cópia local antiga da edição distorça Mapas/Croquis ou Pranchas.
- **Projeto fresco na regeneração:** Mapas/Pranchas consultam novamente o cache completo atualizado pelo salvamento antes de regenerar o documento.
- **QR Code:** restaurado fallback de link público/QR em Mapas/Croquis, Pranchas e Memorial quando o módulo central não devolve a imagem pronta; o QR pode ser reconstruído localmente a partir do link público.

## MAP_LAYOUT_OFICIAL_V51 — ajustes finos de confrontantes + números dos vértices ampliados

- Editor de confrontantes: o **nome do confrontante** agora pode ser reduzido e ampliado em uma faixa maior, de **20% a 400%**.
- Editor/geração: as **linhas de chamada** dos confrontantes passaram a usar traço mais escuro/preto e espessura reforçada, ficando visíveis com mais clareza nos mapas e croquis.
- Editor visual: instruções atualizadas para deixar claro que as pontas das linhas podem ser arrastadas para redimensionar/reposicionar o traçado.
- Mapas e croquis: a **numeração dos vértices** foi ampliada novamente para melhorar a leitura.
- Planta técnica simplificada: os rótulos de vértices no quadro principal também foram aumentados.
- Regra preservada: **intervalos podem compartilhar vértice sem conflito**; exemplo: um confrontante pode terminar em V-30 e outro começar em V-30 normalmente.

## MAP_LAYOUT_OFICIAL_V50 — confrontantes definitivos por intervalo + edição visual documental

- Confrontantes no mapa simplificados para **seleção direta de vértices**: clique marca/desmarca em azul, Shift+clique seleciona intervalo, inclusive cruzando V-69→V-01, e um único vértice também pode receber confrontante. O projeto passa a persistir `vertices` e `segmentIndexes` explicitamente, evitando qualquer recálculo de arco na geração.
- Confrontantes por intervalo: corrigida a seleção entre vértices para usar sempre o arco mais curto do perímetro. Ex.: V-65 → V-61 não percorre V-66…V-01; usa somente o trecho curto entre as duas extremidades.
- **Mapa simplificado:** removidos os desenhos visuais de confrontantes do mapa. O mapa volta a ter uma única responsabilidade: definir quem confronta cada intervalo `V-inicial → V-final`.
- **Vértice compartilhado corrigido:** intervalos como `V-03→V-05` e `V-05→V-08` coexistem; o V-05 pode encerrar um confrontante e iniciar outro sem sobrescrita.
- **Geração automática:** Prancha Técnica, Mapas/Croquis, Planialtimetria e Perímetros criam duas linhas de chamada independentes por confrontante, partindo automaticamente das extremidades do intervalo para fora do perímetro, sem linha-ponte entre as pontas.
- **Editor definitivo nas gerações:** nome arrastável, tamanho de 45% a 300%, rotação de -180° a 180°, pontas das linhas arrastáveis e `+ Linha extra` ilimitada; linhas extras nunca substituem linhas existentes.
- **Persistência no projeto:** ao salvar a edição documental, o layout visual é gravado como `confrontanteVisualLayout` v3 no projeto e reaproveitado por outras gerações. Nome corrigido no editor também sincroniza os lados usados pelo Memorial/relatórios.
- **Migração segura:** `confrontanteChamadas` e guias antigos desenhados no mapa deixam de participar da geração. Layouts visuais v1/v2 são ignorados para impedir que projetos anteriormente bugados continuem quebrando os documentos.
- **Memorial:** o mapa/planta incluído no Memorial reutiliza o mesmo layout visual v3 dos confrontantes e ganhou opção Mostrar/Ocultar confrontantes.
- **Vértices:** numeração ampliada novamente nas pranchas/mapas e no mapa técnico do Memorial.

## MAP_LAYOUT_OFICIAL_V50 — chamadas livres de confrontantes + geração estabilizada

- Mapa: adicionada **Chamada livre** de confrontante, sem obrigação de usar vértices. O usuário desenha duas linhas independentes onde quiser, posiciona o nome no mapa e pode arrastá-lo depois.
- Cada chamada livre possui ID próprio; desenhar uma nova linha no mesmo vértice/área não apaga as chamadas existentes.
- Mapa: nome do confrontante ganhou controle de tamanho (55% a 250%), mover nome, redesenhar linhas e excluir chamada.
- Gerações/edições: editor compartilhado passa a desenhar linhas livres em qualquer posição e permite arrastar/redimensionar o nome.
- Documentos: chamadas livres salvas em `confrontanteChamadas` são projetadas para Prancha Técnica, Mapas/Croquis e demais módulos compatíveis.
- Compatibilidade: projetos antigos com `confrontanteTrechos`/linhas ancoradas em vértices continuam abrindo e gerando.
- Corrigido erro de geração que ocorria somente em projetos com linhas de confrontantes desenhadas no mapa: o renderizador agora recebe corretamente a função de projeção cartográfica ao converter pontas geográficas.

## MAP_LAYOUT_OFICIAL_V50 — confrontantes desenhados no mapa + Projetos corrigido

- O editor de confrontantes do mapa ganhou **Traçar linhas no mapa**: cada chamada parte do vértice e termina por duplo clique na posição desenhada pelo usuário.
- As duas chamadas são independentes e **não são ligadas automaticamente uma à outra**; o nome do confrontante fica centralizado entre elas.
- Trechos podem compartilhar o mesmo vértice de limite (ex.: V-03→V-05 e V-05→V-08) sem conflito.
- As linhas ficam salvas em `properties.confrontanteTrechos` do próprio projeto e são reaproveitadas em Prancha Técnica, Mapas/Croquis e demais documentos compatíveis.
- O editor documental foi alinhado ao mesmo estilo de chamadas retas independentes.
- A página **Projetos** deixou de receber o acordeão genérico “Etapa 1”.

## MAP_LAYOUT_OFICIAL_V50 — geração documental e sincronização de confrontantes

- Corrigida a inicialização de **Mapas e Croquis / Pranchas Técnicas**: o editor compartilhado recebia uma função `toast` inexistente, interrompendo o JavaScript antes de vincular o botão Gerar.
- Os módulos documentais passam a buscar a **versão mais recente do projeto** ao gerar, evitando geometria e confrontantes antigos mantidos em cache.
- O primeiro clique em Gerar agora aguarda o carregamento completo do projeto salvo quando necessário, em vez de apenas carregar os dados e exigir um segundo clique.
- Ao salvar no mapa, o cache documental de projetos é invalidado para que Memorial, Prancha, Mapas/Croquis e demais gerações recebam imediatamente a versão recém-salva.
- Os confrontantes definidos no mapa continuam sendo persistidos em `properties.confrontantes` do polígono e agora chegam aos geradores através do bundle fresco do projeto.
- Adicionado teste de regressão específico para inicialização dos geradores, bypass de cache e preservação dos confrontantes mapa → projeto → documentos.

## MAP_LAYOUT_OFICIAL_V50 — Pesquisa rápida em JSON compacto

- Pranchas/Mapas: números V-01…V-n ampliados; editor de confrontantes agora permite puxar duas linhas de chamada diretamente dos vértices, fixar cada ponta por duplo clique e gerar o nome do confrontante centralizado entre elas. O traçado manual é salvo por projeto/layout e reaplicado no documento final.

- Confrontantes técnicos: novo modelo por **trechos entre vértices (V-inicial → V-final)**, inspirado na prancha de referência enviada. O nome fica associado ao trecho da divisa, com demarcação do intervalo no perímetro.
- Editor de confrontantes ampliado: permite renomear, alterar vértice inicial/final, adicionar/remover trechos e arrastar o rótulo; restauração automática recupera os dados originais.
- Aplicado em **Pranchas técnicas, Mapas e croquis, Planialtimetria/MDT e Perímetros por azimute**. As alterações documentais permanecem locais ao navegador e não alteram silenciosamente o projeto salvo na nuvem.

- Mapa: **Excluir vértice** agora remove a coordenada real da geometria e reconecta automaticamente os vértices vizinhos, eliminando o antigo comportamento de apenas ocultar o ponto.
- Informações do imóvel: recuperação mais robusta do **Nome do imóvel/sítio**, incluindo aliases antigos/truncados da camada e enriquecimento pelo JSON local usando CAR/código quando disponível.
- Busca: após selecionar um município, a barra entra em contexto municipal e permite pesquisar **bairro, povoado, localidade, estrada ou rua** dentro dele (ex.: Amargosa → Cambaúba), preservando o mapa base atual, inclusive Satélite + vias.

- Loteamentos/REURB: centralizados todos os downloads da etapa final em um único botão **Download ▾**; exportações de lotes, memoriais, croquis, Word, PDF e HTML ficam agrupadas no mesmo menu, enquanto a etapa **Lotes e documentos** mantém apenas tabela e edição/importação.

- Loteamentos/REURB: reorganizada a etapa final; Lotes e documentos e controles de geração ficam na coluna esquerda, enquanto a coluna direita fica exclusiva para a pré-visualização/croqui.

- Pesquisa rápida local otimizada de 500 para **5.000 imóveis JSON por requisição**, reduzindo drasticamente a quantidade de chamadas WFS sem baixar geometria.

- Cache de Limites de Propriedade passou a persistir **um JSON cadastral compacto por imóvel** no IndexedDB.
- Geometria continua fora do cache e é consultada online somente ao selecionar um resultado.
- Banco local anterior v2 é tratado como legado e removido automaticamente.
- Manifesto registra `json-per-property` / `application/json`.

## MAP_LAYOUT_OFICIAL_V50 — Pesquisa rápida local de Limites de Propriedade
- Pesquisa rápida de Limites de Propriedade ajustada para armazenar **somente atributos cadastrais**, sem polígonos/geometria no IndexedDB; a geometria é carregada da fonte oficial somente quando o usuário escolhe um imóvel.

- Camadas **Imóvel Rural - Limites de Propriedade** agora oferecem **Baixar dados** por UF para instalar a base oficial no navegador via IndexedDB.
- Bahia usa CEFIR/INEMA; demais UFs usam SICAR/CAR, sempre mantendo a consulta oficial online como fallback.
- Download estadual paginado, com progresso, quantidade de imóveis, tamanho aproximado, atualização e desinstalação da cópia local.
- Antes da instalação, o sistema alerta sobre computadores fracos e possível lentidão/travamento durante download e indexação.
- Pesquisa por nome, CAR e códigos passa a consultar primeiro a base local instalada, acelerando consultas repetidas.
- O X da pesquisa também limpa o destaque vermelho de imóvel pesquisado.
- Recuperados aliases antigos de **Nome do imóvel** (ex.: `nom_proprie` / `nm_proprie`) no painel cadastral.
- Teste estável específico protege IndexedDB, fontes BA/SICAR, instalação/atualização/desinstalação, busca local e limpeza da seleção.

## MAP_LAYOUT_OFICIAL_V50 — correção de destinatários das notificações

- Corrigido vazamento de notificações específicas: avisos de **Usuário específico** não aparecem mais no sino de administradores nem de outras contas.
- Backend e frontend agora usam a mesma matriz de público: Todos, Usuários comuns, Administradores, Plano e Usuário específico.
- Audiência desconhecida passa a falhar fechada, em vez de exibir o aviso.
- Estado local de **lida** passou a ser separado por usuário no navegador.
- Cache/polling de notificações foi reduzido para melhorar a entrega de novos avisos.
- Adicionado teste de regressão simulando admin, usuários diferentes e planos diferentes.


## MAP_LAYOUT_OFICIAL_V50 — Consolidação técnica + refinamentos de Cursos e Mapa

- A busca contextual de imóvel permanece aberta ao clicar no mapa/fora do painel; autocomplete simples de cidade continua fechando normalmente.
- Restauração integral da busca universal do mapa após regressão da consolidação: cidade, imóvel rural, CAR, coordenadas e geolocalização voltam ao runtime autocontido comprovado da V49.
- Removida a tentativa de separar `city-search.js`; o estado do autocomplete permanece junto ao `app.js` para evitar quebra de inicialização.

- **Cursos**: ícone com fundo transparente, tela "Em breve" simplificada e remoção visual dos três cards de preparação.
- **Mapa**: gaveta de ferramentas rápidas compactada, com botões/ícones menores e menor ocupação da área útil.
- **UI global**: removido um runtime duplicado de mais de 600 linhas em `assets/js/core/ui.js`; a inicialização moderna passa a existir em uma única implementação.
- **CSS**: removidas regras exatamente duplicadas e declarações antigas sobrescritas pela mesma regra mais nova, preservando a cascata efetiva.
- **Mapa modular**: cache, normalização, ranking e hidratação de municípios extraídos do `app.js` para `assets/js/features/mapa/city-search.js`, carregado antes do runtime principal.
- **Legado**: prefixos históricos de hotfix/versão foram retirados de comentários ativos onde não agregavam comportamento; justificativas técnicas relevantes foram preservadas.
- **Build/Git**: `dist/` continua sendo saída gerada e ignorada pelo Git; o build permanece como fonte oficial do pacote público.
- **Qualidade**: novo teste de consolidação impede o retorno do bloco JS duplicado, do acoplamento da busca municipal e do crescimento da cascata acima dos patamares consolidados.

### Métricas da limpeza

- `assets/js/core/ui.js`: **2.543 → 1.838 linhas**.
- `assets/css/core/ui.css`: **6.001 → 5.398 `!important`**.
- `assets/css/features/mapa/app.css`: **7.647 → 6.533 `!important`**.
- `assets/js/features/mapa/app.js`: busca municipal/cache removidos para módulo dedicado, mantendo o mesmo contrato funcional.

## MAP_LAYOUT_OFICIAL_V49 — Cursos Surveyor

- Nova rota `/cursos/` com tela central de cursos e treinamentos em estado **Em breve**.
- Novo acesso **Cursos** na barra superior global, entre **Acervos oficiais** e **Suporte**, em todas as telas que usam a topbar unificada.
- Ícone de formatura integrado à nova área.
- Estrutura inicial preparada para receber os cursos de introdução, mapa/cadastro e documentos técnicos sem liberar conteúdo ainda.

## MAP_LAYOUT_OFICIAL_V48 — sessão preservada no reload e timeout por inatividade

- Remove a regra legada que forçava novo login em qualquer Ctrl+R/reload.
- Mantém a sessão da aba em `sessionStorage`, preservando a rota atual quando a página é atualizada.
- Adota timeout de 20 minutos de inatividade real; após esse período, a próxima navegação/reload exige autenticação novamente.
- Registra atividade por interação efetiva do usuário, sem contar Ctrl/Cmd+R ou F5 como renovação da sessão.
- Impede que uma interação tardia reviva silenciosamente uma sessão que já atingiu o limite ocioso.
- Exibe mensagem específica na tela de login quando a sessão expira por inatividade.
- Adiciona teste estável de regressão para reload e timeout ocioso.

## MAP_LAYOUT_OFICIAL_V46 — editor cartográfico comum e prévia limpa na Planialtimetria

- Replica o editor de confrontantes para Planialtimetria / MDT e Perímetros por Azimute quando o projeto possui confrontantes cadastrados.
- Mantém Mapas e Croquis e Pranchas Técnicas com o mesmo fluxo de edição já consolidado.
- Usa modal com fundo rasterizado em alta definição, camada vetorial editável e posições persistidas por projeto/layout.
- Planialtimetria passa a reservar a coluna direita somente para a pré-visualização da prancha.
- Resumo, downloads, saída IDW e tabelas auxiliares são realocados para a etapa final de configuração, liberando espaço para inspeção do documento.
- Adiciona teste estável específico para o editor cartográfico compartilhado e o layout de prévia exclusiva.


## MAP_LAYOUT_OFICIAL_V44 — confrontantes legíveis no editor
- Aumenta o tamanho técnico dos rótulos de confrontantes na prancha georreferenciada.
- Recalibra afastamento/área de colisão para os rótulos maiores.
- Impede zoom do editor abaixo de 70%, evitando edição com nomes ilegíveis.
- Mantém o restante da prancha com tipografia idêntica ao PDF/SVG final.

## MAP_LAYOUT_OFICIAL_V43 — 2026-09-23
- Editor de confrontantes passa a usar o mesmo normalizador tipográfico vetorial do PDF oficial.
- Pesos 800/900 do SVG bruto deixam de aparecer artificialmente mais escuros no modal; a visualização do editor agora segue a mesma regra 700/400 usada na prévia/PDF.
- Normalização foi centralizada em `SurveyorPdfPreview.normalizeVectorSvg()` para evitar divergência futura entre editor e documento final.

## MAP_LAYOUT_OFICIAL_V42 — editor preserva todos os textos da prancha

- Mantida a suavização tipográfica introduzida no editor de confrontantes.
- Removido o reset global de `stroke`, `paint-order` e `letter-spacing` aplicado a todos os textos do SVG.
- Título da prancha, folha, marca/empresa, cabeçalhos, assinaturas e quadros laterais voltam a usar integralmente os atributos originais do SVG.
- O tratamento visual do modo de edição fica restrito aos confrontantes arrastáveis.
- Adicionado teste de regressão para impedir que regras globais do editor ocultem textos técnicos novamente.

## MAP_LAYOUT_OFICIAL_V41 — fidelidade tipográfica no editor de confrontantes

- Editor modal agora usa a mesma renderização tipográfica da prévia original.
- Desativada síntese artificial de peso da fonte dentro do SVG editável.
- Removidos contorno/stroke e paint-order de texto somente na visualização do editor, evitando letras excessivamente pretas/negritadas.
- A alteração é visual no editor e não modifica o conteúdo ou os pesos definidos no SVG/PDF final.

## RC10 — mapa V18: busca tipada, loading de camadas e interações contextuais (2026-09-22)


- Restaurada a busca universal do mapa: um único campo pesquisa cidade, imóvel, CAR e coordenadas automaticamente, sem seletor de tipo; lupa e layout voltaram ao padrão estável anterior.
- Corrigido o empilhamento dos menus do mapa: mapa-base, ferramentas, download/projeto e seletor Cidade/Coordenadas agora abrem acima do canvas, sem clipping pelo cabeçalho.

- substitui a busca automática do mapa por seletor explícito de Cidade, Imóvel, CAR e Coordenadas, com submenu DD/DMS/DDM/UTM/EPSG;
- remove o atalho duplicado de localização da barra de pesquisa e mantém cada modo restrito ao tipo escolhido;
- mostra o loading limpo ao aplicar novas camadas e só o encerra depois que a camada nova estiver realmente presente na área visível;
- prioriza o viewport atual na sincronização de camadas oficiais;
- histórico Desfazer/Refazer fica oculto sem desenho/histórico e aparece quando a interação passa a gerar estados;
- corrige a gaveta de ferramentas rápidas para 820 px, duas linhas completas e sem recorte/scroll interno no desktop;
- adiciona “Cancelar ferramenta” ao menu do botão direito quando existe uma ferramenta ativa;
- converte o menu superior das telas comuns para ícones compactos que expandem o rótulo no hover/foco, incluindo Instalar;
- converte a marca Surveyor em ícone compacto com expansão animada do nome e subtítulo no hover.

## RC10 — mapa V17: ferramentas completas e camadas oficiais estáveis (2026-09-22)

- amplia a gaveta de ferramentas rápidas do mapa para exibir todas as ações em duas linhas no desktop, sem barra de rolagem interna;
- camadas oficiais do catálogo passam a permitir somente ajuste de transparência; cor e espessura permanecem definidas pela fonte oficial;
- Limites de Propriedade da Bahia passam a usar diretamente a simbologia publicada pelo GeoBahia/INEMA, preservando traço fino/serrilhado e preenchimento oficial;
- evita redraw desnecessário do WMS ao sincronizar opacidade e mantém mais tiles em buffer durante pan/zoom, reduzindo desaparecimentos temporários;
- habilita automaticamente a API oficial como contingência do proxy geográfico quando a rota principal não responde;
- reforça o estado visual do botão de visibilidade, com ícone de olho riscado e animação perceptível ao ocultar/reexibir a camada.

## RC10 — organização dos elementos de geração em Mapas/Croquis (2026-09-22)

- corrige os checkboxes gigantes/desalinhados da etapa “Elementos da geração” em Mapas e Croquis e Pranchas;
- padroniza cada opção como cartão compacto em duas colunas, com texto à esquerda e checkbox de 18 px à direita;
- adiciona estado selecionado discreto, foco acessível e remove interferência das regras globais de inputs sobre checkbox.

## RC10 — refinamentos de navegação e mapa (2026-09-22)

- padroniza como pílulas os itens da navegação superior e filtros selecionáveis fora do módulo de mapa;
- corrige os ícones de cabeçalho de Projetos, Suporte e Personalização para renderizarem o símbolo preto sem transformar o cartão inteiro em uma mancha preta;
- amplia a gaveta de ferramentas secundárias do mapa para exibir todas as ações sem barra de rolagem interna;
- adiciona estado visual inequívoco e animação ao botão de visibilidade das camadas;
- normaliza Limites de Propriedade CEFIR/INEMA para contorno amarelo-oliva fino com preenchimento translúcido, descartando preferências antigas incompatíveis uma única vez;
- enriquece o ZIP de imóvel do menu de contexto com dossiê TXT do sistema/projeto e mantém GeoJSON, KML, CSV, DXF, WKT e Shapefile no mesmo pacote.

## RC10 — novo layout dos painéis do Mapa (2026-09-22)

- preserva integralmente a barra principal do Mapa e redesenha somente as interfaces abertas pelas ações já existentes;
- atualiza os painéis laterais de Projeto, Camadas e Gleba para o novo padrão visual;
- atualiza Detalhes do elemento com cabeçalho técnico, estatísticas compactas e cópia direta das coordenadas;
- reorganiza a expansão das ferramentas secundárias em uma barra flutuante compacta;
- reformula o modal Verificar Projeto com pontuação, contadores, filtro e lista de correções;
- amplia e reorganiza o catálogo Adicionar camadas, mantendo seleção, preview real, importação e geosserviços;
- adiciona descrição opcional ao Projeto e mantém o valor no salvamento/carregamento real;
- mantém IDs, eventos, mapa, engine, camadas e API existentes, sem reescrever a lógica funcional.

## RC10 — padronização arredondada de botões e topbar (2026-09-22)

- botões Anterior/Próximo e ações finais das telas de geração passam a usar o mesmo formato pill da Home;
- Ferramentas, Instalar, notificações, plano e conta recebem o mesmo raio em todas as telas;
- removida a regra antiga que forçava botões quadrados na shell de workspace, preservando cards e campos como superfícies independentes.

## RC10 — Home hero integral e ícones monocromáticos (2026-09-22)

- substitui a Home com cards de acesso rápido pelo hero integral: conteúdo à esquerda, marca Surveyor ampliada à direita e rodapé institucional preservado;
- mantém os atalhos principais “Começar novo projeto no mapa” e “Abrir último trabalho” sem alterar a lógica existente;
- padroniza ícones de módulos e cabeçalhos em preto, removendo badges/bordas azuis nas telas de geração e nos cabeçalhos administrativos;
- mantém logomarca institucional e ações comerciais com suas cores próprias.

## RC10 — cabeçalho documental estrutural (2026-09-22)

- removido do DOM o cabeçalho legado `.top` nas telas de geração;
- criado cabeçalho documental próprio, ancorado diretamente na margem esquerda da área útil;
- removidos o cartão branco e a borda ao redor do nome da geração, mantendo apenas ícone + título sobre o fundo da página;
- o posicionamento deixa de depender das regras globais de `.top`/`.workspace-page-head`, eliminando a centralização residual.

## RC10 — downloads Edge/Chromium e contingência GeoServices (2026-09-22)

- corrige a causa estrutural que podia invalidar downloads gerados em `blob:` enquanto a franquia diária era validada: o Blob agora é preservado antes da espera e baixado por uma URL temporária nova, com âncora anexada ao DOM e limpeza tardia;
- torna os downloads programáticos mais compatíveis com Edge/Chromium mesmo quando a âncora original é removida logo após `click()`;
- mantém a contabilização server-side das franquias antes de liberar downloads/exportações limitadas;
- mantém o Worker Cloudflare como proxy geográfico primário e ativa a API oficial como rota de contingência pública/allowlisted para WMS/WFS/GetFeatureInfo;
- aumenta o tempo de espera dos tiles CEFIR/INEMA para evitar abandono prematuro do WMS oficial em respostas lentas;
- corrige o caminho quebrado do teste do Worker Cloudflare e adiciona validação de `/health` ao `deploy-geoservices.bat`.

## RC10 — ajuste do box do título nas telas de geração (2026-09-22)

- aplica em todas as telas de geração um box visual explícito no cabeçalho do módulo, envolvendo ícone e título dentro de um cartão branco com borda e raio consistente;
- mantém o alinhamento à esquerda já padronizado, sem reintroduzir ações legadas nem centralização do cabeçalho;
- preserva uma única implementação no `documents.css`, evitando duplicação de estilos por página.


## RC10 — ajuste de Home sem rolagem (2026-09-22)

- Corrigido o shell da Home para não herdar o `padding-top` global das páginas internas.
- A Home agora ocupa exatamente a área útil abaixo da topbar e reserva o rodapé dentro do viewport.
- Cards de Acesso rápido foram compactados e deixaram de esticar verticalmente, eliminando o grande espaço em branco.
- Adicionado teste estável para impedir regressão de rodapé oculto e cards excessivamente altos.

# Changelog

## Em desenvolvimento — refinamentos das telas de geração

- remove o contador/progresso secundário do Memorial, mantendo somente o loading oficial com spinner e backdrop;
- remove a moldura azul da pré-visualização e elimina o scroll externo redundante, deixando apenas a rolagem necessária do conteúdo/PDF;
- alinha à esquerda, na mesma margem estrutural do workspace, os títulos das telas de geração e cabeçalhos de diálogos documentais;
- adiciona regressão automática específica para loading, preview e alinhamento das telas de geração.

## 1.0.0-rc.10 — GeoBahia oficial e arraste de aresta sincronizado

- Limites de Propriedade CEFIR/INEMA passam a usar, por padrão, o próprio raster WMS oficial do GeoBahia, preservando o traço fino amarelo-oliva e eliminando o engrossamento artificial da RC anterior;
- remove o preenchimento artificial da camada cadastral no modo custom e mantém recoloração somente quando o usuário personaliza cor/espessura;
- adiciona modo de estilo `official/custom` às preferências da camada e persiste essa escolha no frontend/backend;
- mantém SICAR fora da Bahia no modo custom já existente, sem alterar a origem oficial dos dados;
- corrige o arraste de aresta para mover os `LatLng` em lugar, preservando as referências internas do Leaflet.Draw;
- sincroniza os dois vértices e os midpoints vizinhos durante todo o arraste, evitando bolinhas presas na posição antiga;
- adiciona regressão automática específica para estilo GeoBahia e sincronização dos handles de edição.

## 1.0.0-rc.9 — Restauração funcional do campo de pesquisa

- corrige a regressão estrutural que fazia o listener de pesquisa lançar `ReferenceError` ao digitar cidade, coordenada, imóvel rural ou CAR;
- restaura no `app.js` o estado de interface da busca inteligente (`selectedCoordinateInputMode`, timers e último CAR automático) que havia sido removido na extração do módulo de coordenadas;
- exporta pelo módulo `coordinates.js` a matriz oficial de formatos DD/DMS/DDM/UTM/EPSG e o placeholder compartilhado, evitando dependências invisíveis entre arquivos;
- volta a habilitar autocomplete de municípios, seleção e enquadramento no mapa;
- volta a abrir o seletor de tipo de coordenada ao iniciar por números e mantém a formatação progressiva após a escolha;
- volta a abrir o assistente de imóvel rural por Sítio/Fazenda/Chácara com escolha de município;
- restaura o assistente/autoexecução de CAR e o destaque vermelho do imóvel localizado;
- adiciona regressão automática para garantir que o estado e as constantes da busca existam após a modularização.

## 1.0.0-rc.8 — Recuperação definitiva da pesquisa do mapa

- autocomplete municipal volta a ser autocontido no runtime principal do mapa;
- remove dependência do módulo separado `city.js` para evitar desencontro de carregamento;
- dropdown de pesquisa vira overlay preso ao viewport, sem clipping pela toolbar/mapa;
- `Sítio`/`Fazenda` abre imediatamente o assistente de município, sem esperar a API do IBGE;
- `Amargosa` e outras cidades que começam por sigla de UF não entram em modo CAR;
- CAR só é reconhecido quando a UF vem seguida de separador ou dígito;
- pré-carregamento de municípios ocorre em segundo plano;
- regressões automatizadas cobrem cidade, imóvel, CAR, geolocalização e camada cadastral.

## 1.0.0-rc.7 — Recuperação definitiva da pesquisa do mapa

- Remove o roteamento duplicado de pesquisa do `workspace.js`: a lupa visível agora delega ao único roteador do `app.js`.
- Corrige o falso positivo de CAR para municípios iniciados por sigla de UF, como `Amargosa` (`AM`), exigindo UF seguida de separador/dígitos para classificar um rascunho como CAR.
- Restaura autocomplete municipal imediato a partir do cache/fallback e migra o cache nacional legado sem apagar a lista já disponível no navegador.
- Reforça o dropdown de sugestões contra recorte/`overflow` na barra superior e mantém seleção por mouse/teclado.
- `Minha localização` centraliza diretamente o mapa a partir da geolocalização, sem reenviar coordenadas pelo roteador textual.
- Mantém cidade, imóvel rural, CAR, UTM/DMS/DD/EPSG e coordenadas no mesmo campo, com uma única cadeia de listeners.
- Limites de Propriedade reduzem `keepBuffer` excessivo e timeouts de tile para diminuir atraso e memória durante zoom/pan sem remover a atualização durante o zoom.
- Adiciona regressão automática para `Amargosa`, rascunho CAR, coordenadas observadas no teste real, autocomplete e parâmetros da camada cadastral.

## 1.0.0-rc.6 — Recuperação da pesquisa e desempenho cadastral

- Corrige a lupa da pesquisa do mapa para chamar diretamente o roteador único de busca, sem depender do botão oculto.
- Busca municipal responde imediatamente com fallback local e hidrata a lista nacional do IBGE com timeout controlado.
- Amargosa e Salvador possuem centro local de contingência para navegação mesmo quando o geocodificador externo estiver indisponível.
- Renova as chaves de cache municipal para a arquitetura 1.0 e valida a estrutura antes de reutilizá-las.
- Limites de Propriedade passam a atualizar tiles durante o zoom, preservando buffer ampliado para reduzir desaparecimento/flicker.
- Otimiza a recoloração amarela dos tiles cadastrais, eliminando a varredura de vizinhança para cada pixel.
- Reduz timeouts excessivos dos tiles cadastrais e adiciona cache curto apenas para imagens GetMap do CEFIR, mantendo dados/atributos vivos.
- Adiciona regressão automática para pesquisa unificada e comportamento da camada cadastral.

## 1.0.0-rc.5 — Recuperação funcional de documentos e camadas

- Corrige dependências ausentes em Pranchas Técnicas após a modularização.
- Centraliza personalização, logotipo e QR Code em `document-assets.js`.
- Memorial, Mapas/Croquis, Pranchas, Perímetros e Planialtimetria atualizam a personalização na geração e incorporam a logo como Data URL.
- Geração de pranchas/croquis possui fallback do preview para evitar carregamento infinito.
- Workspace documental encerra o overlay imediatamente quando a prévia retorna erro.
- Limites de Propriedade ganham amarelo forte padrão, ajuste de cor/espessura persistente e comportamento WMS mais estável durante zoom.
- Preferências de cor/espessura das camadas passam a ser validadas e persistidas no frontend/backend.
- Nova suíte de regressão protege logo, QR, dependências documentais e camada cadastral.



## 1.0.0-rc.4 — Correções após QA web

- Croquis não travam quando o serviço externo de imagem falha; fallback gera documento sem fundo remoto.
- ODS não transforma a coordenada de fechamento em vértice/segmento extra.
- Contador de projetos acompanha o filtro aplicado.
- Login ganhou controle Mostrar/Ocultar senha.
- Loteamentos/REURB valida campos essenciais antes de manter o rascunho de sessão.
- Caminho de credencial inválida teve operações independentes de segurança paralelizadas.
- Testes estáveis foram atualizados para a arquitetura modular 1.0 e receberam gates dos bugs encontrados pelo QA.

## 1.0.0-rc.3

- Corrige a inicialização do mapa interrompida pela ordem incorreta da dependência CEFIR no módulo de exportação de propriedades.
- Move a normalização e o ranking de municípios para o módulo `mapa/city.js`.
- Adiciona teste de regressão `map-bootstrap.test.mjs` para validar dependências e ordem de bootstrap do Leaflet.

## 1.0.0-rc.2 — refatoração estrutural (Fase 2)

- Separa módulos geométricos, coordenadas, desenho e exportação do mapa sem manter implementações duplicadas.
- Divide Mapas e Croquis em `app`, `dimensions`, `vertices` e `confrontantes`.
- Extrai acesso REST ao Appwrite para `functions/surveyor-api/src/appwrite/client.js` e mantém módulos próprios de tokens, planos, permissões, catálogo, projetos e Google Drive.
- Remove fontes locais falsas de lixeira, versões e fila; rascunhos transitórios passam a usar sessão.
- Mantém documentos gerados fora da quota do projeto, salvo futura ação explícita de arquivamento.
- Corrige o cadastro administrativo: nova conta agora exibe campo de senha, permite digitar ou gerar senha temporária forte e exige mínimo de 12 caracteres.
- Padroniza scripts de raiz (`dev.bat`, `test.bat`, `deploy-geoservices.bat`).
- Atualiza documentação de arquitetura e armazenamento para a etapa de validação final.

## 1.0.0-rc.1 — consolidação estrutural (Fase 1)

- Inicia a linha de produto 1.0 sem alterar o fluxo comercial já homologado.
- Padroniza nomes de JS/CSS por responsabilidade e remove versões/hotfixes dos nomes de produção.
- Centraliza a versão no `package.json` e sincroniza cache-busters, Functions, manifesto e Service Worker.
- Torna `assets/` a fonte única do frontend e `dist/` um artefato gerado.
- Consolida documentação histórica em `docs/history/README.md`.
- Cria `AGENTS.md`, `DEPLOY.md`, `SECURITY.md` e documentação de arquitetura.
- Separa testes atuais dos testes históricos; a suíte oficial passa a validar a arquitetura 1.0.
- Corrige o manifesto comercial para projetos ilimitados e franquias/armazenamento vigentes.

## R26.3.73 — última base histórica congelada

- JWT compacto.
- `surveyor-save` aceita tokens de até 32 KiB.
- Corrigido salvamento da conta Pro que excedia o limite anterior de token.

## Histórico anterior

O histórico detalhado R19 → R26.3.73 foi preservado em `docs/history/README.md`.

## RC10 Map Layout V35 — busca, navegação e acervos
- Busca de imóvel rural abre alinhada à esquerda do campo de pesquisa e sugestões municipais foram compactadas.
- Removido o atalho redundante de geolocalização ao lado da busca do mapa; menu hambúrguer centralizado na própria coluna.
- Animações da topbar ficaram mais suaves/lentas e o item ativo (incluindo Acervos oficiais) volta a exibir o rótulo.
- Filtros de Acervos oficiais agora escondem de fato categorias não selecionadas e usam classificação explícita por portal.
- E-mail da conta autenticada é preenchido automaticamente no formulário de suporte e restaurado após limpar/enviar.

## MAP_LAYOUT_OFICIAL_V39
- Confrontantes externos maiores e mais legíveis, com linha de chamada.
- Novo modo Editar confrontantes com arraste por Pointer Events.
- Posições manuais persistidas por projeto e layout e usadas no PDF/SVG.
- Botão Restaurar posições retorna ao posicionamento automático.

## MAP_LAYOUT_OFICIAL_V40 — editor modal de confrontantes
- Remove o fundo branco dos rótulos de confrontantes na prancha final.
- Remove as linhas de chamada entre confrontantes e perímetro.
- Substitui a edição inline da prévia por um modal dedicado, sem recarregar a página.
- O editor oferece zoom, ajuste, restauração automática, cancelar e salvar alterações.
- O arraste é mantido como rascunho até a confirmação em “Salvar alterações”.

## MAP_LAYOUT_OFICIAL_V45 — editor fiel à prévia
- Editor de confrontantes passa a usar fundo rasterizado em alta definição da prancha, evitando o escurecimento/engrossamento dos textos causado pela redução direta do SVG no Chromium.
- Apenas os confrontantes permanecem em camada SVG transparente e editável.
- Salvamento persiste somente os deslocamentos e regenera a prancha completa, evitando corromper o SVG final.

## V47 — documentos cartográficos
- Planialtimetria: coluna direita exclusiva para pré-visualização; download, zoom, resumo e status movidos para a etapa final à esquerda.
- Perímetros por azimute: resumo e tabela movidos para a etapa final à esquerda; tabela com cantos quadrados.

- Ajuste Loteamentos/REURB: coluna esquerda mais compacta, remoção de redundância de títulos e abertura/renderização direta dos blocos sem seta recolhida.

- Correção Loteamentos/REURB: removido acordeão legado do ui.js; elimina título duplicado e seta solta, mantendo conteúdo renderizado diretamente nas abas.

## 1.0.0-rc.16 — Technical Engine Browser / Prancha Técnica V2

- adiciona laboratório isolado em `/core/technical-engine/`, sem substituir o gerador atual;
- adiciona `/pranchas-v2/` como Prancha Técnica V2 experimental;
- cria engine em TypeScript com modelo próprio de geometria, layout e renderização SVG vetorial em milímetros;
- preview e exportação SVG passam a usar a mesma cena técnica na V2;
- adiciona edição direta dos rótulos `V-xx` por arraste, com offsets isolados em cache local;
- preserva remoção virtual de vértices ao adaptar `surveyorHiddenVertexKeys`;
- adiciona controles experimentais de preenchimento, visibilidade e tamanho dos vértices, escala e norte;
- mantém `/pranchas/` e toda a geração documental original intactas, adicionando apenas um acesso explícito ao laboratório V2.


## 1.0.0-rc.111 — V162 — Catálogo estadual abre limpo

- Adicionar Camada passa a abrir somente com mapa do Brasil e seletor de UFs, sem exibir automaticamente a lista de camadas da UF salva.
- Um clique em qualquer UF revela o painel de camadas com animação lateral originada visualmente na coluna de Estados.
- Duplo clique na UF ativa continua recolhendo o painel e devolvendo a área ao mapa.
- Mantidos checkbox como único comando de ativação e botão Usar <UF> como confirmação/aplicação das camadas marcadas.

- RC112/V163: o painel estadual de camadas agora possui animação reversa no duplo clique da UF ativa; ele recolhe visualmente de volta para a coluna de Estados enquanto o mapa do Brasil expande simultaneamente para ocupar o espaço liberado, preservando a animação de abertura UF → camadas já existente.


## 1.0.0-rc.113 — V164 — Catálogo territorial oficial e legado isolado

- torna o navegador territorial Brasil + UFs + camadas o único fluxo oficial de Adicionar camada;
- preserva integralmente o catálogo antigo como fallback técnico isolado, sem acesso pelo fluxo normal;
- adiciona ponto técnico controlado `SurveyorLegacyLayerCatalog.open()` para eventual recuperação futura, sem expor botão ao usuário;
- garante que fechar/reabrir o catálogo sempre retorne à experiência nova e não herde estado legado.


## 1.0.0-rc.114 — V165 — Animações territoriais otimizadas

- substitui a animação de `grid-template-columns` por FLIP/compositor (`transform` + `opacity`) no navegador Brasil + UF + Camadas;
- remove os múltiplos `invalidateSize()` do Leaflet durante cada transição e passa a recalcular/enquadrar o mapa apenas ao final;
- renderiza a lista de camadas antes do primeiro frame da abertura para evitar bloqueio no meio da animação;
- preserva as transições UF → Camadas e Camadas → UF, agora com abertura/fechamento mais suaves e menor custo de layout/GPU.

## V203 BETA — Elementos realmente reativos na cena persistente

- Corrigida a falha observada em vídeo na V202 em que desmarcar Cotas/Vértices não alterava a prancha aberta.
- A visibilidade dos elementos não depende mais da existência de `lastSvg`: o editor inline ativo é atualizado diretamente.
- Controles proxy da Personalização agora aplicam a mudança imediatamente após sincronizar o checkbox oficial.
- Cotas, cotas de gleba, vértices, confrontantes, norte, grade e escala possuem fallback semântico por classes/atributos, além de `data-live-element`.
- Ocultação usa `display:none !important` e atributo SVG `display="none"` para vencer rotinas do editor que possam reexibir elementos.
- O estado atual dos checkboxes é reaplicado toda vez que a bancada inline é aberta ou reaberta.
- A cena em memória/exportação continua sincronizada com o mesmo estado visual.

### V206 BETA — tipografia inline isolada
- Corrige a diferença de peso visual entre a prévia normal e a bancada inline de Pranchas Técnicas.
- O SVG de fundo volta a ser carregado como documento SVG isolado em `data:` para não herdar a cascata CSS/antialiasing da interface HTML.
- Antes de separar fundo e overlay, cada `text`/`tspan` recebe explicitamente o peso tipográfico efetivo do documento; valores normais ficam em `400` e pesos técnicos intencionais são preservados.
- Mantida a deduplicação por `editableOverlayRoots()`, portanto o retorno ao fundo isolado não reintroduz textos sobrepostos.
- Nenhuma regra de geometria, confrontantes, cotas, vértices, persistência ou do `SurveyorEditorEngine` foi alterada.

## V210 BETA — tipografia de tela do editor nativo
- Corrige a aparência excessivamente grossa dos textos apenas na bancada inline de Pranchas Técnicas.
- A causa visual remanescente era a rasterização/hinting do Chromium em textos muito pequenos quando a folha inteira é reduzida para caber na tela; pesos documentais de Arial ficavam visualmente carregados mesmo sem duplicação.
- A bancada passa a usar um perfil exclusivo de tela com Segoe UI, peso 400 e `text-rendering:auto`, sem alterar os atributos vetoriais armazenados no SVG/modelo nativo.
- PDF/SVG de saída continuam usando a política tipográfica documental; SurveyorEditorEngine, geometria, cotas, confrontantes, vértices e persistência não foram alterados.
# Análise final do SURVEYOR

Data: 22/11/2026  
Checkout: `C:\Users\kaual\Downloads\SURVEYORR - NOVO`

## Conclusão executiva

O SURVEYOR já tem uma base funcional ampla: autenticação, projetos em nuvem, mapa vetorial, validação, Croqui, Memorial, pranchas e vários formatos de exportação. O fluxo principal abriu com um projeto de QA, gerou prévias de mapa e memorial, e o validador do próprio projeto mostrou **0 erros e 2 alertas**.

Ainda não considero seguro tratar os documentos como produto técnico oficial sem revisão. Há dois riscos P1: um conflito de referência geodésica no mesmo documento (texto/tabela em **WGS 84**, cabeçalho do mapa em **SIRGAS 2000**) e a confiança combinada de CORS/cookie de refresh em qualquer subdomínio oficial — este último é condicional à existência de subdomínio comprometido ou vulnerável, não foi explorado. Também há risco de anel GeoJSON inválido ser alterado silenciosamente, atrito na troca de módulo que exige selecionar o projeto de novo e faltam provas de persistência após recarregar, operação offline e teste em celular.

“Zero falhas” não pode ser garantido por uma bateria automatizada ou por uma única sessão. O que foi possível comprovar está separado abaixo do que continua pendente.

## Escopo e evidências

- A tela de login local carregou e aceitou a conta de QA já salva no cofre; a sessão abriu a lista de projetos e o editor de mapa.
- O servidor do frontend respondeu em `localhost:5500`; `localhost:5000` não respondeu. O README também documenta a porta 5500.
- Abri um projeto explicitamente marcado como QA, carreguei seu mapa, executei a validação e percorri as prévias de Memorial e Croqui. Não salvei, exportei, excluí nem editei o projeto.
- O código usa endpoints remotos padrão para API e salvamento Appwrite (`src/lib/config.ts`). Como não confirmei uma configuração local que os substituísse, o login/listagem no browser provavelmente usou o backend externo. O navegador não permitiu inspecionar a rede depois da autenticação; portanto, não afirmo quais chamadas exatas ocorreram. Nenhuma gravação de projeto foi feita.
- `npm run verify`: concluído sem falhas; 80 arquivos de teste e 364 testes Vitest passaram, além dos testes Node, verificações de estabilidade e build de 2.012 módulos.
- `npm audit --no-fund`: 0 vulnerabilidades conhecidas na consulta executada.
- `git diff --check`: passou, com avisos de normalização CRLF em arquivos já modificados.

## O que está bom

1. **Amplitude de trabalho:** o menu reúne mapa, projeto, Croqui, Memorial, prancha, azimute, MDT, REURB, CAR, planilha, confrontação e relatório ambiental. O editor do mapa oferece desenho, camadas, divisão em glebas, validação e formatos como GeoJSON, KML, DXF, CSV, TXT e Shapefile.
2. **Fluxos guiados e prévia:** Croqui e Memorial dividem a tarefa em etapas e exibem prévia enquanto o usuário trabalha. No Croqui observei identificação, perfis, assinatura, organização de rótulos, confrontantes, cotas e servidões.
3. **Guardrails explícitos:** o Memorial chama área, distância e perímetro de aproximados; a documentação diz que os cálculos do navegador não substituem levantamento ou validação profissional. O validador informa ausência de referência CAR/CEFIR e consulta SIGEF/INCRA não verificada.
4. **Base GIS:** há suporte a buracos e MultiPolygon, preservação de coordenadas originais e mensagens que identificam aproximações. Os testes GIS existentes cobrem áreas, geometrias, memorial, sincronização e exportação.
5. **Segurança de sessão no código:** os cookies de sessão oficial são emitidos com `HttpOnly`, `Secure` e `SameSite=Strict`. A correção recente do replay de refresh tem dois testes para rejeição 401 e falha ao registrar revogação.
6. **Manutenibilidade e regressão:** há testes de geometria, transições, drafts, concorrência, sincronização e exportação; a configuração de build agora produz build TypeScript/Vite completo. O `npm audit` não encontrou advisories conhecidos nesta execução.
7. **Arquitetura — revisão independente:** o Arquiteto confirmou pontos fortes no carregamento sob demanda das rotas, contexto central de sessão, drafts locais/IndexedDB e verificações de read-back/CAS na persistência. Ele observou também que alguns módulos são grandes e que as fronteiras entre mapa, documentos e API podem ser mais claras. Isso aumenta a importância de round-trip integrado, refresh/revogação entre abas e coerência WGS 84/unidades.

## Achados prioritários

### P1 — Referência geodésica contraditória no documento

Na prévia real do QA, as coordenadas do Memorial estavam selecionadas como WGS 84 e a tabela identificava latitude/longitude WGS 84; a seção do mapa, no mesmo documento, imprimia “Datum: SIRGAS 2000”. A faixa é escrita estaticamente em `src/features/memorial/MemorialPage.tsx:402`, enquanto a opção de coordenadas fica em `:1045` e os cabeçalhos da tabela em `:1300`. `memorialEngine.ts:48` identifica as coordenadas geográficas como WGS 84.

**Impacto:** o responsável pode entregar um arquivo que atribui datums diferentes à mesma geometria. Mesmo próximos em vários usos, os referenciais não devem ser tratados como intercambiáveis sem transformação/documentação explícita.

**Melhoria:** ter um único CRS/datum como dado de projeto; propagar a seleção para narrativa, tabela, mapa, DXF, KML e Shapefile; registrar EPSG, zona/hemisfério, unidade e método; bloquear ou marcar como rascunho qualquer documento com CRS desconhecido. Criar teste de contrato que compare o rótulo do mapa com a opção escolhida e um conjunto de coordenadas de referência.

### P1 — Leitura de anel pode alterar silenciosamente geometria inválida

`src/lib/geoJsonRings.ts:11-15` remove coordenadas inválidas e devolve o anel se restarem três vértices. `memorialEngine.ts:16-31` e `projectDivisions.ts:18-29` usam esse helper ao reconstruir polígonos. Se um arquivo ou dado persistido tiver um vértice inválido no meio de um contorno, os pontos válidos antes e depois podem virar vizinhos e formar um segmento novo; o documento pode continuar a ser gerado sem que o usuário veja a alteração. Não reproduzi esse caso no navegador.

**Melhoria:** rejeitar a geometria inteira ou mantê-la em quarentena com diagnóstico do índice do vértice; nunca remover pontos e fechar o anel automaticamente. Acrescentar testes para vértice malformado em anel externo e buraco e provar que importação, Croqui e Memorial preservam ou rejeitam a entrada sem reconstrução silenciosa.

### P1 — CORS e cookie de refresh confiam em qualquer subdomínio

Revisão estática de Segurança confirmou que `isOfficialWebOrigin` aceita qualquer origem HTTPS terminada em `.surveyorr.com.br` (`functions/surveyor-api/src/main.js:1828-1835`), `corsOrigin` reflete essa origem com `Access-Control-Allow-Credentials: true` (`:2143-2148, 2184-2190`) e o refresh cookie é emitido para `Domain=.surveyorr.com.br` (`:1789-1797`). A resposta de refresh inclui access token no JSON (`:7111-7114`). Não foi demonstrado um subdomínio vulnerável nem executado teste de exploração; o risco é condicional a subdomínio não confiável, comprometido ou vulnerável a XSS. Com essa condição, código hospedado nele poderia fazer requisições autenticadas same-site e ler a resposta CORS, apesar do cookie ser `HttpOnly`.

**Melhoria:** usar allowlist exata de origens para CORS e mutações; preferir cookie host-only no host da API; revisar subdomínios ativos/abandonados e testar preflight, cookies e operações autenticadas em staging. Manter o bearer token fora de respostas legíveis por origens que não precisem dele.

### P2 — Leituras podem continuar aceitando permissões antigas por até 15 minutos

Tokens de acesso expiram em no máximo 15 minutos (`functions/surveyor-api/src/auth/tokens.js:70`); operações de leitura usam o snapshot do JWT, enquanto operações de escrita consultam a conta/perfil ao vivo (`functions/surveyor-api/src/main.js:1620-1644`). Isso limita impacto em gravações, mas uma sessão revogada ou um papel alterado pode conservar acesso de leitura até a expiração do token. A revisão foi estática; não medi essa janela contra serviço.

**Melhoria:** decidir e documentar o equilíbrio entre custo de consulta e revogação imediata; para dados mais sensíveis, conferir versão da sessão também em leitura ou reduzir TTL, com teste de revogação entre abas.

### P2 — CSP do frontend está apenas em modo de relatório

`public/_headers:10-13` define `Content-Security-Policy-Report-Only`, que registra violações mas não bloqueia scripts ou conexões fora da política. A própria configuração reconhece que a política ainda precisa ser observada em todas as telas antes de ser aplicada. Isso não prova uma falha explorável, mas deixa a proteção contra certas classes de injeção sem efeito preventivo no frontend.

**Melhoria:** coletar e corrigir violações legítimas em mapa, canvas, impressão/PDF e integrações; depois migrar gradualmente para `Content-Security-Policy` efetivo com monitoramento de regressões.

### P1 — O “localhost” está ligado por padrão a serviços externos

`src/lib/config.ts:2-3` usa `api.surveyorr.com.br` e uma Function `appwrite.run` como valores padrão. Assim, rodar o frontend local não significa que autenticação, projetos e gravações estejam isolados localmente. Nesta inspeção, a tela de projetos exibiu dados da conta QA; não fiz mutações.

**Impacto:** desenvolvimento/testes podem criar sessão ou consultar dados remotos sem que o operador perceba. Isso também dificulta reproduzir falhas e obter dados de teste controlados.

**Melhoria:** criar perfis explícitos `local`, `staging` e `production`; em `local`, exigir backend de teste ou mock e falhar fechado se a URL apontar para produção sem uma confirmação visível. Mostrar no cabeçalho o ambiente ativo e incluir o ambiente nos relatórios de teste.

### P2 — A troca de módulos perde o projeto ativo

Após abrir o mapa pelo cartão de um projeto QA, entrar em Memorial ou Croqui pelo menu levou a uma tela com “Selecione um projeto”; foi necessário selecionar o mesmo projeto novamente em cada módulo. Isso cria retrabalho e aumenta a chance de editar ou exportar o imóvel errado.

**Melhoria:** manter projeto atual como contexto global na navegação; mostrar nome/município em todas as telas, ter uma troca explícita com aviso de rascunho pendente e refletir o mesmo identificador na URL/contexto dos editores. Testar alternância e retorno com rascunhos.

### P2 — Documento pode ser baixado sem dados técnicos completos

No exemplo de QA, o preview mostrou “Responsável técnico(a):” sem valor, mas o botão de baixar não estava bloqueado. Em uso real, isso pode produzir material visualmente pronto sem responsável, registro profissional, ART/RT ou conferência de CRS. A saída é descrita como aproximada, o que é bom, mas a aparência de documento completo pode induzir confiança excessiva.

**Melhoria:** distinguir “rascunho”, “prévia” e “documento revisado”; antes do download, apresentar checklist configurável por tipo de documento e perfil; nunca inventar dados. Permitir exportação preliminar com marca d’água clara e bloquear apenas os campos exigidos pelo perfil escolhido.

### P2 — Link público inclui nome do imóvel e coordenadas exatas na URL

`src/features/public/publicMapData.ts` constrói o link público com nome e vértices no parâmetro `dados`; a tela pública renderiza esses dados em mapa. O conteúdo observado não incluiu CPF ou nome do proprietário. Como é um recurso público, a geometria e o nome continuam sendo informações que podem ser copiados, salvos no histórico ou aparecer em logs.

**Melhoria:** pedir confirmação clara antes de criar/compartilhar link; oferecer modo com nome anonimizado; orientar sobre coordenadas públicas; dar revogação/expiração quando o link for mantido no servidor e separar “link de localização” de “documento com dados pessoais”.

### P2 — Desempenho real do GIS não foi medido

O teste `test:performance` verifica propriedades do código/cache; o harness local mede HTTP. O próprio `LOAD_TEST_REPORT.md` informa que não mede React render, cálculos GIS, backend, banco, memória ou capacidade de produção. O ensaio HTTP anterior devolveu a mesma página SPA para várias rotas, então não prova que cada módulo carregou ou que o mapa processa dados.

**Melhoria:** medir em staging com conjunto público/fictício versionado: tempo até mapa interativo, importação e validação de geometrias grandes, uso de memória, exportação e comportamento com perda/retorno de rede. Guardar comando, revisão, máquina, dados e resultados brutos; não reaproveitar números de HTTP como benchmark de GIS.

### P2 — Cálculos UTM/topológicos precisam de limites visíveis

`src/lib/wgs84Utm.ts:1-12` calcula a zona automaticamente, mas documenta que não valida cobertura; fluxos com zona manual precisam comprovar zona, latitude e hemisfério. `memorialEngine.ts:16-39, 47-55` usa distâncias/áreas esféricas e a projeção UTM centralizada em WGS 84, com rótulo conjunto “SIRGAS 2000 / WGS 84”. `src/features/analysis/topology.ts:1-16, 66-89` usa plano tangente local e estima interseção por amostragem; a própria função informa que não serve para certificação. São recursos úteis para triagem e prévia, não valores probatórios.

**Melhoria:** exigir metadados por camada (CRS/EPSG, datum, unidade, origem e precisão); validar zona/área de uso; diferenciar resultado de triagem de cálculo técnico; mostrar método e precisão; comparar com pontos e polígonos de controle revisados por profissional.

## Visão de um agrimensor em campo

**Ajuda no escritório:** centralização de projeto, edição de perímetro, associação de confrontantes, geração de peças e exportação em formatos familiares podem reduzir retrabalho entre GIS e documentação. Prévia imediata e modelos ajustáveis são pontos fortes.

**O que ainda pode frustrar no campo:** não validei celular/tablet; o editor de Croqui tem muitos controles e passos; não confirmei captura GPS em baixa conectividade, uso offline de mapas, fila de sincronização, resolução de conflitos entre dispositivos nem restauração após fechar a aba. Uma falha de rede durante campo precisa preservar cada vértice localmente e dizer com clareza se está “salvo neste aparelho” ou “sincronizado na nuvem”. Também é essencial rejeitar ou destacar geometria com coordenadas inválidas em vez de descartá-las silenciosamente.

**Sugestões de produto com valor diário:** modo de campo offline com cache seletivo de tiles/projetos e fila de sincronização; coleta GPS com precisão estimada, hora e sistema de referência; diário de observações e fotos vinculados a vértices; alerta de tolerância/fechamento antes do documento; comparação entre geometria levantada e cadastro oficial; checklist de conferência; resumo de mudanças por projeto e recuperação de versões.

## Plano recomendado

1. Corrigir e testar a coerência de CRS/datum em todas as peças e formatos; aprovar com coordenadas conhecidas e um profissional responsável.
2. Isolar ambientes e impedir que testes locais apontem silenciosamente para dados remotos.
3. Fazer round-trip de projeto fictício: salvar, esperar confirmação, recarregar, comparar geometria, atributos, estilo, rótulos, divisões e drafts.
4. Propagar contexto do projeto entre mapa, Croqui, Memorial e Prancha; validar troca de projeto com alterações pendentes.
5. Adicionar checklist de exportação preliminar/oficial e consentimento de link público.
6. Testar em celular/tablet e rede interrompida; depois executar benchmarks reais de GIS em staging.

## Status por tipo de validação

- **VALIDADO EM NAVEGADOR:** login QA na interface local; listagem de projetos; abertura de um projeto de QA; validação visual do mapa; seleção do projeto nos módulos Memorial e Croqui; prévias renderizadas. Sem edição, gravação ou exportação.
- **VALIDADO AUTOMATICAMENTE:** `npm run verify` passou; `npm audit` reportou 0 vulnerabilidades conhecidas; `git diff --check` passou.
- **IMPLEMENTADO SEM VALIDAÇÃO REAL NESTA RODADA:** correções anteriores de refresh replay, rotas de build, redirecionamento do harness e declarações de compressão; cobertas pela suíte, mas não validei refresh concorrente contra um backend isolado.
- **REVISÃO INDEPENDENTE:** arquitetura, GIS e segurança receberam revisão estática e foram incorporadas; segurança não realizou exploração, chamadas remotas ou testes de runtime.
- **PENDENTE:** round-trip cloud após reload, login expirado/refresh real, importação/exportação com arquivos de controle, assinatura e documentos finais, CRS com referência profissional, casos de anel malformado, celular/offline, concorrência e capacidade GIS.
- **Desenvolvimento local:** começa isolado de serviços remotos por padrão após a correção descrita abaixo; builds de produção continuam usando os endpoints públicos configurados. Testes funcionais com backend dependem de URLs locais ou staging explicitamente configuradas.

## Vocabulário rápido

- **CRS/SRC:** sistema que define datum, projeção, zona e unidade das coordenadas.
- **Datum:** modelo/referência geodésica usado para posicionar coordenadas na Terra.
- **Round-trip:** salvar os dados, recarregá-los e conferir se voltaram iguais.
- **Staging:** ambiente de homologação separado da produção.
- **Offline-first:** o trabalho continua sem internet, sincronizando quando a conexão volta.

## Correções após a análise

- **CRS nos documentos e exportações:** a projeção implementada recebe coordenadas WGS 84 sem transformação de datum. Memorial, croqui oficial e `.prj` do Shapefile agora identificam WGS 84, sem declarar SIRGAS 2000. Validação focal: `npm test -- --run tests/memorialEngine.test.ts tests/shapefileExport.test.ts` (14 testes aprovados). Ainda é necessário confirmar a compatibilidade do perfil SEIA/CEFIR com o órgão destinatário; não se deve rotular como SIRGAS 2000 sem transformação geodésica real.
- **Geometrias inválidas:** a leitura GeoJSON não remove vértices isolados. Se o exterior ou qualquer buraco contém coordenada inválida, Croqui/divisões e Memorial rejeitam a parte inteira em vez de ligar os pontos restantes ou ignorar um buraco. Cobertura focal atual: `tests/memorialEngine.test.ts`, `tests/bloco1-deduplicacao.node.cjs`.
- **Cobertura UTM:** o projetor compartilhado agora rejeita latitudes fora da cobertura UTM e fusos manuais fora de 1–60; o texto do Memorial informa quando UTM não está disponível. Cobertura focal: `npm test -- --run tests/etapa54-spatial-utm.test.ts tests/memorialEngine.test.ts` (19 testes aprovados).
- **Refresh oficial sem refresh token no JSON:** origins oficiais recebem a credencial de renovação apenas no cookie `__Host-` HttpOnly/Secure/SameSite; para compatibilidade, um refresh oficial aceita o cookie legado `__Secure-` quando o `__Host-` ainda não existe e a rotação emite o novo cookie host-only. O backend continua ignorando tokens no corpo em origens oficiais. Origens não oficiais recebem o token rotacionado no JSON, conforme `tests/authOriginPolicy.node.mjs`. A migração foi verificada em teste local, não em sessão real no runtime Appwrite.
- **CORS de origem exata:** autenticação por cookie ficou restrita a `surveyorr.com.br` e `www`; subdomínios arbitrários não herdam confiança. Origins adicionais só entram via lista explícita de configuração.
- **Ambientes isolados:** desenvolvimento começa sem serviços remotos; staging exige quatro URLs explícitas e rejeita hosts de produção; exceção local remota requer opt-in e mostra aviso. APIs/salvamento/suporte falham com mensagem de configuração ausente.
- **Contexto do projeto:** Croqui, Memorial e Prancha propagam o ID na URL e guardam contexto por conta/aba; a Prancha mantém a confirmação antes de descartar alterações pendentes.
- **Replay de refresh:** replay deixa de referenciar `userId` indefinido e mantém 401 mesmo se persistência da revogação falhar.
- **Redirecionamento do harness:** `fetch` não segue redirects cross-origin; stub local verifica zero chamadas ao destino.
- **Build/headers:** chunks manuais apontam somente para dependências existentes; headers não declaram Brotli sem arquivos pré-comprimidos comprovados.
- **Harnesses alinhados:** testes isolados de GIS agora carregam o caminho de UTM usado pela implementação; 69 verificações de integração geográfica passaram.
- **Validação completa:** `npm run verify` passou; 82 arquivos Vitest e 382 testes aprovados, checks de regressão e build de produção concluídos (2014 módulos). A política Node de autenticação/CORS passou com 10 testes, incluindo migração do cookie legado.
- **Pendente de validação em serviço real:** refresh/CORS no Appwrite implantado, round-trip cloud, compatibilidade SEIA/CEFIR, controles topográficos profissionais, produção, celular/offline e desempenho GIS com dados reais. Não foi feita publicação nem gravação remota nesta rodada.

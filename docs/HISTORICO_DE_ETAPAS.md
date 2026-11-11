# SURVEYOR | Histórico de etapas de desenvolvimento (README anterior, preservado)

> **Leia antes de publicar:** esta versão exige publicação conjunta do frontend e da Function `surveyor-api`, após testes locais e no ambiente Appwrite. Não marque como sincronizado antes de a conta real confirmar a releitura do croqui. Não houve publicação automática.

## Alterações desta versão

- **Nuvem:** `customization.options` permanece como JSON string UTF-8 quando couber em 60.000 bytes. Acima disso, a API salva o objeto completo criptografado no Appwrite Storage (`APPWRITE_BUCKET_USER_ASSETS`), verifica o hash SHA-256 e grava no campo `options` uma referência curta. Leituras antigas inline continuam válidas. Falha de Storage bloqueia a confirmação e mantém o rascunho local. É necessária a chave de criptografia já utilizada pelo backend (`SURVEYOR_DATA_KEY_V1` ou a versão ativa).
- **Croqui:** nomes e vértices sem retângulo preto ou contorno automático nas letras. As cores de preenchimento escolhidas são mantidas em prévia e nos SVGs exportados.
- **Interface:** Croqui com barra inferior organizada como a Prancha; dados avançados do Memorial e da Prancha em seções recolhíveis; painel do mapa mais compacto.
- **Estrutura:** documentos temporários e notas de correção anteriores removidos; README e arquivos necessários preservados.

### Verificação antes de uso comercial

1. Execute `npm ci`, `npm run check:release`, `npm run test:functions` e `npm run dev` em uma máquina com acesso às dependências.
2. Publique **primeiro a API atualizada** (Function `surveyor-api`), confirme acesso ao bucket `user_assets`, espaço disponível e chaves criptográficas. Depois publique o frontend.
3. Faça login com conta de teste e salve um Croqui com textos coloridos, servidões, assinatura/foto e grande quantidade de dados (mais de 65.535 bytes). Reabra em outra sessão e compare todas as propriedades, visualização, PDF e SVG.
4. Interrompa a publicação em caso de erro. Testes locais não comprovam a integração de nuvem real.

---

# Histórico de desenvolvimento anterior

O projeto utiliza Frontend React/TypeScript, hospedagem Cloudflare Pages via GitHub e backend Appwrite. Os três módulos pausados permanecem bloqueados. O domínio conectado ao Pages é **www.surveyorr.com.br**; não altere os registros de API, loja, e-mail ou pagamentos.

## Novidades integradas no lote da Etapa 54 (ainda NÃO homologadas)

- **Pranchas Técnicas → Elementos → Grade UTM (referência):** malha métrica calculada em WGS84, zona UTM do centro do perímetro, seguindo o enquadramento do croqui. Grade ilustrativa em escala local; nunca substitui conferência profissional da projeção, datum e escala declarada na prancha.
- **Planilha do Projeto → Tipo de planilha → Pré-conferência SIGEF:** gera ODS de conferência com vértices salvos, zona, leste/norte, coordenadas geográficas e campos pendentes de precisão/método/altitude. **NÃO É TEMPLATE OFICIAL DO SIGEF E NÃO DEVE SER ENVIADO DIRETAMENTE.** É necessário transcrever e conferir no modelo vigente do INCRA.
- **Mapa → Verificar:** examina coordenadas inválidas, fechamento, vértices duplicados e autointerseção; não modifica a geometria.
- **Mapa → Análise espacial:** compara dois polígonos, destaca em azul e laranja, calcula diferenças de área, estimativa por amostragem da interseção e possíveis frestas de até 20 cm, sem movimentar vértices. A estimativa de sobreposição não configura comprovação jurídica ou certificação de precisão.
- **Mapa → Importar:** aceita também TXT e XLSX, mostra resumo antes de adicionar e permite cancelar. Dados tabulares precisam estar em longitude/latitude geográficas WGS84.

### Roteiro de testes locais — obrigatório antes de pensar na publicação

1. Execute `npm install`, `npm run check:release` e `npm run dev`. Não publique em caso de erro.
2. **Prancha:** abra imóveis com 4 e 100 vértices, ative/desative Grade UTM, verifique fuso (ex.: Bahia, 24S), grade, zoom e SVG/PDF.
3. **Pré-SIGEF:** gere o ODS com um e vários polígonos; confira nomes sincronizados e avisos sobre informações não preenchidas. Não tente enviá-lo como modelo oficial.
4. **Validação:** teste polígono regular, aberto, com duplicados e com autointerseção. Confirme que não houve edição involuntária.
5. **Comparação:** importe dois polígonos com sobreposição e outros dois separados; compare áreas, sobreponha no mapa e remova o destaque. Faça o mesmo com áreas grandes e vários vértices.
6. **Importação:** teste TXT, CSV brasileiro com ponto e vírgula, XLSX, KML, GeoJSON e ZIP Shapefile; confirme na prévia, confira o total e cancele um arquivo.
7. **Regressão:** busque imóvel por CAR/nome, cancele busca longa, salve/recupere projeto, gere Memorial e Croqui, confira a sincronização de rótulos e a numeração da Etapa 52.

**Limites conhecidos:** a interseção é uma estimativa espacial por amostragem e deve ser revisada; não há aplicação automática de snap. A planilha é **pré-conferência**, não uma exportação certificada SIGEF. A compilação completa depende de executar npm no ambiente local.

## Validação local antes da publicação — Etapa 54

**Esta entrega é para teste local. Não publique no GitHub ou Cloudflare Pages até concluir a homologação.**

No Windows, execute `INICIAR_SURVEYOR.bat`. Ou abra a pasta do projeto no VS Code e execute:

```bash
npm install
npm run check:release
npm run dev
```

Acesse `http://localhost:5500/login/`. Quando `npm run check:release` apresentar erro, interrompa a homologação e corrija antes de avançar.

### Numeração automática de vértices

1. Abra **Mapas e croquis**, selecione um projeto salvo e, se houver vários imóveis, escolha o polígono correto.
2. Entre em **Personalização → Croqui → Vértices e confrontantes → Numeração automática de vértices**.
3. Escolha o código opcional (ex.: `O3M`), o tipo de identificação (`V`, `M` ou `P`), o primeiro número, os dígitos, o vértice de partida e o sentido.
4. Confira a prévia e clique **Aplicar numeração**. Use **Desfazer** para recuperar os nomes anteriores ou **Editar nomes individualmente** para ajustes finos.
5. Clique em **Salvar** e confirme a mensagem de sincronização. Depois gere o **Memorial Descritivo** do mesmo polígono e confira os nomes tanto na descrição quanto no croqui.

A opção altera **somente os rótulos**: não modifica coordenadas, geometria, distâncias, áreas, confrontações ou a classificação técnica oficial de marcos. Os tipos M/P/V são identificações que o profissional escolhe, sem validação regulatória automática.

Para homologar: teste 4, 15 e 150 vértices; um projeto com vários polígonos; mudança de sentido; número inicial diferente de 1; código em branco e preenchido; desfazer; edição individual; salvar e recarregar a página; gerar memorial depois de salvar; verificar que as coordenadas não foram alteradas.

### Quadro dinâmico de rumos, azimutes e distâncias — Etapa 53

1. Entre em **Mapas e croquis**, selecione um projeto e um polígono.
2. Clique **Rumos e distâncias** na barra inferior. O quadro mostra o caminhamento do polígono, incluindo o trecho final de fechamento, com identificações e confrontantes atuais.
3. Clique no nome de qualquer trecho para realçá-lo temporariamente na prévia; clique novamente para desmarcar. Os arquivos do croqui exportado permanecem sem esse destaque.
4. Altere nomes de vértices e confrontantes na personalização e confira os valores atualizados; troque o polígono em projetos com mais de um imóvel.
5. Use **CSV** para exportar a tabela, conferir os separadores e conferir a ausência de alterações na geometria original.

**Nota:** azimutes, rumos e distâncias apresentados são aproximados sobre coordenadas geográficas WGS84. Esta ferramenta não substitui levantamentos topográficos ou planilhas normativas em sistema de referência adequado.

## Publicar o frontend (somente depois da aprovação local)

No repositório Git, substitua os arquivos alterados preservando `.git` e execute:

```bash
npm install
npm run check:release
npm run test:functions
git add -A
git commit -m "SURVEYOR Etapa 53 - quadro dinamico de rumos e distancias"
git push origin main
```

O **Cloudflare Pages** (projeto `surveyor-agrimensura`) acompanha os commits na `main`: framework Vite, build `npm run build`, saída `dist`. A publicação é concluída apenas se a compilação passar. O GitHub Actions antigo pode continuar bloqueado pela situação da conta; ele **não é necessário** para o Pages compilar pelo Git. Teste em `https://surveyor-agrimensura.pages.dev` ou no domínio `www`.

## Busca por CAR e nome (Etapas 49–51)

- **CAR:** número completo em qualquer UF → consulta WFS SICAR por código, confere a identidade cadastral e **somente então** destaca a geometria e centraliza o mapa. Para BA, CEFIR é alternativa.
- **IMÓVEL:** escolha município na UF atual, digite parte do nome → consulta online WFS da camada CEFIR de limites na Bahia, filtra pelo município, oferece uma lista de geometrias e destaca a selecionada. Resultado inexistente não é substituído por outro imóvel com FID semelhante.
- **Registros municipais:** "Baixar registros do município" guarda um índice verificado em IndexedDB; "Salvar índice JSON" exporta atributos municipais para arquivo. O índice **não armazena geometria**: a localização no mapa exige consulta oficial específica.
- **Etapa 51:** busca por CAR/nome tem duração máxima de 25 segundos, cancelamento explícito e respostas antigas são descartadas ao trocar o filtro. O índice municipal permanece consultável localmente enquanto a pesquisa oficial ocorre, sem fingir que seus registros têm geometria confirmada. O download completo do índice tem limite próprio de três minutos e pode ser cancelado.
- Os serviços públicos SICAR/INEMA podem estar momentaneamente indisponíveis ou não publicar certos registros. O sistema informa a falha e não inventa posição no mapa.

### Proxy geográfico e CORS

A consulta utiliza o **Cloudflare Worker geográfico já existente**, configurável por `VITE_GEOSERVICES_URL` e com valor padrão em `src/features/map/geoServices.ts`. Ele é **outro serviço**, não uma Function do Appwrite nem parte do deploy automático do Cloudflare Pages.

Incluído código revisado em `deploy/cloudflare-geoservices/src/worker.js` para também permitir o domínio de teste `https://surveyor-agrimensura.pages.dev`. **Adicionar esse arquivo ao GitHub não atualiza o Worker em produção.** Para testar via `pages.dev`, publique manualmente a revisão no Worker atual (ou configure no Worker `SURVEYOR_ALLOWED_ORIGINS` com esse domínio); não crie outro Worker por engano. O domínio oficial `https://www.surveyorr.com.br` já constava na lista original.

## Appwrite Functions

`functions/surveyor-api`, `functions/surveyor-save`, `functions/surveyor-support` e `functions/surveyor-geoservices` continuam preservadas. **Nenhuma Function Appwrite foi alterada na Etapa 53.** O upload manual `.tar.gz` é necessário apenas quando seu backend mudar, salvo se as Functions estiverem vinculadas ao Git no Appwrite. Não inclua chaves secretas no repositório.

## Validação pré-publicação

Além do build, confirme no navegador: CAR válido com geometria e município correto; CAR desconhecido (não selecionar imóvel errado); busca de imóveis por nome semelhante e escolha de resultado; salvamento de índice municipal; mapa, memorial e edição de confrontantes. Dados oficiais e integração de rede exigem teste real em produção ou ambiente de homologação.


## Etapa 55 — salvamento, PWA e ferramentas pausadas

- No mapa, o botão **Salvar** abre sempre o painel lateral **Projeto**. Apenas **Salvar projeto** executa a gravação remota. Se a API não responder, o rascunho local é preservado e o erro permanece visível no painel (não é informado sucesso na nuvem).
- **Central de Lotes** está cinza e apresenta **Ferramenta ainda em implementação**, como as três ferramentas já pausadas.
- O PWA usa a logo oficial do SURVEYOR, manifesto `/manifest.webmanifest`, ícones 192/512 e service worker que não coloca projetos, autenticação ou requisições à API em cache. O botão **Instalar app** fica no login, cabeçalho e menu do mapa.
- **Diagnóstico de API:** o frontend usa `VITE_SURVEYOR_API_URL` ou `https://api.surveyorr.com.br`. Se a URL não responder, o frontend NÃO pode corrigir o DNS/Function automaticamente. Verifique no provedor DNS o registro `api`, no Appwrite o deployment de `surveyor-api` e o CORS para as origens atuais; depois repita o teste de gravação e leitura em outro dispositivo. Não use arquivos `.env` com senhas no frontend.
- PWA: testar via `http://localhost:5500` ou HTTPS; instalar pela opção do navegador. Recursos de nuvem não funcionam sem internet.

Para diagnóstico rápido, abra **Mapa de trabalho → Salvar → Salvar projeto**. Se a API não confirmar a gravação, use **Testar conexão da API** e, se necessário, **Baixar GeoJSON**. O teste de `/api/health` mede apenas conectividade e não confirma acesso ao banco ou autorização para salvar.

## Etapa 56 — Salvamento do mapa

O botão **Salvar projeto** envia geometrias e metadados à Function `surveyor-save` diretamente em `VITE_SURVEYOR_SAVE_API_URL` (padrão `https://6a7bce66000fc9c90d88.nyc.appwrite.run`), via `POST` com envelope `__surveyorSaveTransport` e `text/plain`. A `surveyor-api` permanece para leitura e conferência do projeto salvo. A tela de salvamento agora diagnostica **os dois serviços separadamente**. A Function `surveyor-save` existente não foi alterada.

**Para testar de `http://localhost:5500`:** configure, **no Appwrite Console**, a variável de ambiente `CORS_ORIGINS` da Function `surveyor-save` incluindo `http://localhost:5500` (preservando `https://surveyorr.com.br` e `https://www.surveyorr.com.br`), e reimplante a Function com a configuração atualizada; alternativamente use temporariamente `ALLOW_LOCAL_DEV_ORIGINS=true` enquanto testa. Nunca copie JWT_SECRET ou chave do Appwrite para o frontend. O teste `/api/live` comprova apenas conectividade; salvar exige token válido e permissões. Para o frontend em Cloudflare Pages de teste, inclua também a origem exata `https://surveyor-agrimensura.pages.dev` caso precise usar esse endereço.

**Teste antes de publicar:** `npm run check:release`, login com usuário de teste, criar/salvar projeto, reabrir em Projetos, modificar e salvar novamente, verificar identificadores/vértices e confrontantes. Não presumir gravação na nuvem só porque a API principal responde.


## Etapa 57 — validação antes de publicação

- Município do projeto: calculado a partir de um ponto interior do **polígono único** ao salvar. Consulta reversa do OpenStreetMap/Nominatim iniciada pelo usuário, com cache na aba. O serviço de terceiros pode não estar disponível e não substitui validação cartográfica municipal oficial; se falhar, exige confirmação explícita dos dados antes de salvar. Em produção com tráfego relevante, configurar serviço de geocodificação próprio/contratado e controle centralizado de requisições; a API pública do Nominatim tem limite global de 1 consulta/segundo por aplicação. Referência: https://operations.osmfoundation.org/policies/nominatim/. Dados © OpenStreetMap contributors (ODbL).
- PWA: o botão circular do cabeçalho instala; após instalado mostra lixeira que **orienta a desinstalação** (um website não pode remover app do navegador diretamente). A instalação na barra do Chrome é independente da interface.
- Equipes: conferência estática do backend `functions/surveyor-api/src/main.js`: listagem `/api/projects` usa `resourceOwnerId(auth)` e filtra por `userId` do titular do espaço. O salvamento em `surveyor-save` também utiliza proprietário do workspace. A igualdade entre contas/planos e as permissões individuais precisam de teste real com dois logins, inclusive projetos legados migrados.
- Memorial e prancha: ajustes salvos no mesmo registro de personalização na API de maneira específica por projeto; CPF do imóvel vem do metadata do projeto. O backend exige permissões `company:settings` para edição da personalização; conta com acesso restrito pode não conseguir gravar.
- Salvar no memorial/prancha não deve indicar sucesso sem releitura de confirmação. Reautenticação tenta uma renovação ao receber HTTP 401; 403 exige revisar permissão no workspace.
- Para homologar, rodar `npm run check:release`, testar gravação real das Functions e conferir geração em PDF/Word e SVG nas contas titular e membro antes de publicar.

## Como testar em segurança

Trabalhe somente no `localhost:5500` com conta e projeto de teste. Não altere nenhum DNS nem Functions do Appwrite nesta etapa. A instalação PWA do navegador e a remoção nativa podem variar entre Chrome e Edge.


## Etapa 59 — Testes locais
A versão integra proprietários adicionais do metadado salvo, fonte única para mapas, croqui e memorial.
Geração pode usar fundo branco e a imagem da marca deve ser a cadastrada em Personalização.
Confirme no Appwrite se as informações de proprietários adicionais e o logo são fornecidos pela API, inclusive em projetos herdados do SURVEYOR antigo.

### Etapa 70 — Testes locais de pranchas e confrontantes

- Em **Pranchas Técnicas**, reposicione a assinatura da conta e os nomes dos confrontantes, clique em **Salvar alterações** e aguarde confirmação expressa da nuvem.
- Troque para outro projeto e depois volte. Também atualize a página para comparar a posição de cada rótulo e da assinatura.
- Se a API falhar, o sistema preserva um rascunho **local** separado por conta, projeto e polígono, sinalizando que a nuvem ainda não confirmou. Não interprete esse rascunho como salvamento remoto.
- Confira que todos os confrontantes no Croqui e na Prancha usam **nome na primeira linha e CPF/CNPJ na segunda**, sem reticências e com um identificador por trecho.
- Para verificar o código no computador, execute `npm install` e `npm run check:release` antes de aprovar. A implantação permanece suspensa.


### Etapa 71 — visualização das subdivisões
Em Mapas e Croquis e no mapa do Memorial, todas as glebas já cadastradas no mesmo projeto aparecem como limites vetoriais individuais sobre o preenchimento. Geometrias MultiPolygon preservam seus componentes na visualização; os dados originais não são regravados.

# Exemplo de teste: busca rápida municipal (RC185/V272)

## Teste automatizado, sem backend

Execute `node tests/stable/property-local-legacy-fast-demo.test.mjs` na raiz do projeto.

O teste usa o **código real** de compactação do índice local com um imóvel fictício chamado `SÍTIO EXEMPLO` e código `BA-001`:

- Manifesto **legado** de Amargosa sem `municipalityValidated`: a pesquisa pode entregar um **candidato local**, mas não grava município confirmado nos atributos do imóvel; a interface indica **Município a confirmar**.
- Manifesto **validado** (`municipalityValidated: true`): a propriedade compactada pode carregar o município que a instalação validou.

## Teste no navegador com seus dados existentes

1. Abra `mapa/` e escolha **Amargosa, Bahia** no modo **IMÓVEL**.
2. Pesquise **SÍTIO**. Se a base local antiga estiver instalada, os candidatos devem aparecer rapidamente, sem aguardar a consulta geral ao WFS. Resultados do índice anterior trazem **Município a confirmar**.
3. Clique em **Localizar** em um candidato. O SURVEYOR consulta a geometria oficial. Só destaca o imóvel se conseguir verificar **a identidade do imóvel e o município selecionado**. Não assume o município apenas porque foi escolhido no filtro da busca.
4. Para comparar, pesquise um imóvel com município oficialmente divergente: ele não deve ser destacado em Amargosa.

**Limitação:** quando o servidor oficial não retorna município na geometria de um candidato legado, o imóvel pode continuar bloqueado. A recuperação da velocidade de pesquisa não é uma autorização para misturar cidades. Este teste não substitui a validação do serviço real no seu navegador.

Não apague o IndexedDB nem reinstale todos os dados para executar este teste.

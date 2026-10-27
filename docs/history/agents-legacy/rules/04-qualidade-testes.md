# Qualidade e Testes

- Formatter/linter oficial do projeto prevalece sobre preferências pessoais.
- Corrigir bug sem teste de regressão é exceção a justificar, não padrão.
- Testes devem ser determinísticos e reproduzíveis.
- QA deve registrar ambiente, passos, resultado esperado e obtido.
- Testes automatizados devem escolher nível correto e evitar mocks que eliminem o risco real.
- Performance deve ser medida antes/depois; não otimizar por palpite.
- Testar instalação/empacotamento quando comportamento pode divergir de dev.
- Atualizações devem ser testadas a partir de instalação existente, não apenas instalação limpa.
- Nenhum teste falho deve ser simplesmente desativado para liberar release sem análise.

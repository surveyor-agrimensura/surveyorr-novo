# RC185.18 | Exclusão de gleba manual restaura perímetro

Quando uma gleba manual é recortada, o polígono-base é substituído pela sua área remanescente. Antes, a exclusão removia apenas a gleba, mantendo o recorte permanentemente no polígono-base.

Agora, tanto o botão **Excluir elemento** quanto a ferramenta de exclusão tentam recompor o polígono-base por união geométrica com a gleba removida. A operação valida a soma das áreas, preserva o ID e os atributos do polígono-base, recalcula hectares e perímetro, e não substitui as demais glebas. Caso não seja possível validar a união, a exclusão da gleba é recusada ou revertida. Desfazer/Refazer continua disponível.

As propriedades com subdivisões dependentes não devem ser removidas isoladamente. Em exclusão conjunta de uma gleba e do seu pai, ambos são removidos intencionalmente.

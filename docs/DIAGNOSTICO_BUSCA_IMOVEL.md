# Diagnóstico da busca por imóvel

1. Abra o SURVEYOR no mapa, selecione o município, pesquise e clique em **Localizar** no resultado que falha.
2. Pressione **F12**, abra **Console** e execute:

```js
copy(JSON.stringify(window.SurveyorPropertySearchLastRejection ?? null, null, 2))
```

3. Cole o resultado na conversa para identificar o campo real que está divergindo. O objeto contém só os últimos 8 caracteres do CAR, municípios, IDs e uma indicação booleana de correspondência. Remova os IDs se não quiser compartilhá-los.
4. Se o valor vier `null`, a falha ocorreu em outro ponto e será necessário olhar as mensagens do Console na mesma tentativa.

**Atenção:** uma geometria oficial com município realmente divergente deve continuar bloqueada. Não desative a validação nem apague seus dados locais.

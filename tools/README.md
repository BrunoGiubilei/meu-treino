# Ferramentas (não fazem parte do app publicado)

`gerar.mjs` cria dois arquivos do app a partir de bibliotecas do Google:

- `css/theme.css` — cores do Material Design 3 (claro e escuro), tipografia, formas e movimento;
- `js/icons.js` — ícones SVG embutidos (funcionam offline).

## Quando rodar

Só quando quiser mudar a **cor principal** (`SEED`), as **cores dos treinos** (`TREINO_CORES`)
ou a **lista de ícones** (`ICONES`) no topo do `gerar.mjs`. Para o dia a dia você não precisa disso.

## Como rodar (fish)

```fish
cd tools
npm install
npm run gerar
cd ..
```

Depois de gerar, aumente o `CACHE_NAME` no `sw.js` e publique como de costume.
A pasta `tools/node_modules/` não deve ir para o GitHub (`echo 'tools/node_modules/' >> .gitignore`).

## Fonte

`fonts/` tem a Roboto (latin 400, 500 e 700), licença Apache 2.0, copiada do pacote
`@fontsource/roboto`. Para trocar de fonte, troque os `.woff2` e os `@font-face` no `gerar.mjs`.

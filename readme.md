# Meu Treino

Aplicação web progressiva (PWA) para registro de treinos de academia, com funcionamento offline, sugestão de progressão de carga e sincronização opcional entre dispositivos por meio de uma API própria.

![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)
![Plataforma](https://img.shields.io/badge/plataforma-PWA-informational)
![Build](https://img.shields.io/badge/build-nenhum-lightgrey)

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Status do projeto](#2-status-do-projeto)
3. [Funcionalidades](#3-funcionalidades)
4. [Arquitetura](#4-arquitetura)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Sincronização](#6-sincronização)
7. [API](#7-api)
8. [Estrutura do repositório](#8-estrutura-do-repositório)
9. [Desenvolvimento local](#9-desenvolvimento-local)
10. [Publicação](#10-publicação)
11. [PWA e cache offline](#11-pwa-e-cache-offline)
12. [Segurança](#12-segurança)
13. [Roadmap](#13-roadmap)
14. [Limitações conhecidas](#14-limitações-conhecidas)
15. [Licença](#15-licença)

---

## 1. Visão geral

O Meu Treino substitui a ficha de papel: o usuário escolhe um treino, ajusta carga, séries e repetições de cada exercício, usa um cronômetro de descanso e conclui a sessão. O histórico é preservado e o aplicativo sugere aumento de carga quando a faixa de repetições é atingida.

Princípios de projeto:

- **Offline primeiro.** O `localStorage` é a fonte de trabalho; a nuvem é uma cópia opcional para sincronizar aparelhos.
- **Sem dependências no cliente.** JavaScript puro, sem framework e sem etapa de build. Os arquivos são servidos de forma estática pelo GitHub Pages.
- **Dados sob controle do usuário.** Backup completo em JSON, confirmação em ações destrutivas e nenhuma sobrescrita de dados sem decisão explícita.
- **Infraestrutura mínima.** Um Cloudflare Worker e um banco D1 com uma única linha de estado.

## 2. Status do projeto

| Fase | Escopo | Situação |
|---|---|---|
| Base | Treinos A/B/C, PWA offline, dados no `localStorage` | Concluída |
| Nuvem 1 a 3 | Worker + D1, autenticação por token, controle de revisão (`rev`), tela de conflito | Concluída, em produção |
| Histórico | Consulta, correção e exclusão de treinos antigos | Concluída |
| Fase 1 | Edição completa de exercícios (execução, dica, alternativas, medida) | Concluída |
| Fase 2 | Fichas, treinos dinâmicos (criar, renomear, colorir, mover, reordenar, remover), migração automática | Concluída, publicada |
| Fase 3a | Modularização do `app.js` em módulos ES; tema Material Design 3; navegação responsiva; rotas por hash | Concluída e validada |
| Fase 3b | Tela inicial e treino em andamento no novo design | Implementada; validação em navegador real pendente |
| Fase 3c a 3e | Editores, histórico/configurações, refino desktop | Planejada |

A Fase 3 altera apenas a interface. Modelo de dados, API e regras de sincronização permanecem inalterados.

## 3. Funcionalidades

### Treinos e fichas

- Fichas (grupos de treinos) e seção "Sem ficha" para treinos não atribuídos.
- Criação, renomeação, coloração, movimentação, reordenação e remoção de treinos e fichas.
- Indicação do próximo treino de cada ficha com base no último concluído.
- Resumo semanal com meta de treinos.

### Execução do treino

- Ajuste de carga (passo de 1 kg), séries e repetições; tempo em segundos (passo de 5 s) para exercícios isométricos.
- Sugestão de aumento de carga quando o topo da faixa de repetições foi atingido na sessão anterior.
- Informações do exercício: como executar, dica e alternativas.
- Troca de exercício por alternativa (válida apenas na sessão) e opção de pular exercício.
- Cronômetro de descanso com alerta sonoro (WebAudio) e vibração.
- Registro de cardio (minutos e velocidade da esteira).
- Persistência contínua do treino em andamento: sobrevive ao fechamento do aplicativo.

### Histórico

- Lista de treinos recentes e lista completa paginada.
- Correção de carga, séries e repetições de treinos antigos, com atualização da última carga quando se trata do registro mais recente do exercício.
- Exclusão de treinos, mantendo o nome original do treino removido.

### Dados e sincronização

- Sincronização com a nuvem: conexão por token, sincronização manual, desconexão, primeira conexão, tratamento de conflito, estado offline pendente e token recusado.
- Backup: exportação, cópia e importação em JSON.
- Funcionamento offline e instalação como PWA.

### Interface

- Tema claro, escuro e automático, definido por aparelho e fora do backup e da nuvem.
- Layout responsivo: barra de navegação inferior no celular, navigation rail no tablet e menu lateral permanente no desktop.
- Roboto e ícones SVG hospedados localmente, sem dependência de CDN.

## 4. Arquitetura

```
 Celular / PC (navegador, PWA)                    Cloudflare
┌─────────────────────────────┐  HTTPS + Bearer  ┌────────────────────────────┐
│ GitHub Pages                │  token + CORS    │ Worker                     │
│  index.html, css/, js/, sw  │ ───────────────▶ │  GET /state   PUT /state   │
│                             │ ◀─────────────── │                            │
│ localStorage (offline)      │  { rev, state }  └──────────────┬─────────────┘
└─────────────────────────────┘                                 │ binding D1
                                                  ┌─────────────▼─────────────┐
                                                  │ D1: tabela app_state      │
                                                  │ (uma linha, id = 1)       │
                                                  └───────────────────────────┘
```

Decisões de arquitetura:

- O banco armazena **um único documento JSON** (o estado completo) com um número de revisão para controle de concorrência otimista.
- O Worker valida apenas o formato mínimo do estado; mudanças no modelo de dados não exigem alterar o Worker.
- Interface em CSS próprio com tokens do Material Design 3 e módulos ES nativos, sem build. A escolha evita dependências e mantém o cache offline simples.

## 5. Modelo de dados

O estado é um único objeto, salvo em `localStorage['treino_v1']` e replicado na nuvem. Os nomes curtos dos campos fazem parte do contrato com dados antigos e backups e não devem ser renomeados.

```js
state = {
  plan:    { [idTreino]: [exercício, ...] },
  hist:    [treinoConcluído, ...],            // mais recente primeiro, máx. 200
  last:    { 'Nome do exercício': { kg, s, r, up } },
  cur:     treinoEmAndamento | null,
  treinos: { [idTreino]: { nome, desc, cor } },
  fichas:  [{ id, nome, treinos: [idTreino, ...] }]
}

exercício       = { id, n, s, r, d, t, a: [{ n, d }], u: 'rep' | 's' }
treinoEmAndamento = { w, st, cm, ck, it: { [idExercício]: { alt, kg, s, r, skip? } } }
treinoConcluído = { d, w, wn, m, it: [{ n, kg, s, r, u }], cm, ck }
```

Regras:

- `normalizeState` realiza migração e saneamento ao carregar, importar backup e adotar dados da nuvem. Dados anteriores às fichas recebem os treinos A, B e C na ficha "Ficha atual".
- Campos novos devem ser opcionais e ter migração em `normalizeState`.
- `last` é indexado pelo nome do exercício (ver [limitações](#14-limitações-conhecidas)).
- Remover um treino preserva o histórico; `wn` guarda o nome para exibição.

Chaves do `localStorage`:

| Chave | Conteúdo |
|---|---|
| `treino_v1` | Estado da aplicação |
| `treino_token` | Token da API, digitado uma vez por aparelho; fora do backup |
| `treino_sync` | `{ rev, dirty }`, controle de sincronização do aparelho |
| `treino_copia_antes_sync` | Cópia local guardada antes de substituir os dados pelos da nuvem |

## 6. Sincronização

A unidade de sincronização é o estado inteiro. Cada aparelho mantém `{ rev, dirty }`.

Gatilhos: abertura do app, retorno da aba ao primeiro plano, retorno da conexão e cerca de 1,5 s após cada alteração de dados (debounce).

Regras de decisão:

| Situação | Comportamento |
|---|---|
| Primeira conexão do aparelho | Exibe escolha explícita entre usar os dados da nuvem ou manter/enviar os locais; nada é enviado antes |
| Mesma revisão com alterações locais | Envia (`PUT` com `baseRev`) |
| Nuvem mais nova, sem alterações locais | Adota a nuvem silenciosamente |
| Ambos alterados, ou resposta `409` | Exibe tela de conflito; o usuário escolhe um lado, com confirmação |
| Sem rede | Mantém pendente e tenta novamente depois |
| `401` | Informa token recusado e volta a solicitá-lo |

Ao substituir os dados locais pelos da nuvem, o aplicativo guarda antes uma cópia em `treino_copia_antes_sync`. Não há mesclagem automática.

## 7. API

Worker em `api/src/index.js`.

**Autenticação:** cabeçalho `Authorization: Bearer <token>`. O token é comparado por hash SHA-256 em tempo constante; sem segredo configurado, o Worker nega todas as requisições.

**CORS:** restrito à origem do GitHub Pages. O preflight (`OPTIONS`) é respondido antes da autenticação.

| Requisição | Resposta |
|---|---|
| `OPTIONS /state` | `204` com cabeçalhos CORS |
| `GET /state` | `200 { rev, state }` (sem cache) · `404` se o banco está vazio |
| `PUT /state` com `{ baseRev, state }` | `200 { ok, rev }` · `409 { error, rev }` se `baseRev` não for a revisão atual · `400` para JSON ou estado inválido · `413` acima de 1 MB |
| Sem token válido | `401` com `WWW-Authenticate: Bearer` |
| Outras rotas | `404` |

A gravação é atômica: `UPDATE ... SET rev = rev + 1 WHERE id = 1 AND rev = ?`. Quando `baseRev` é `0` e a linha não existe, é feito `INSERT OR IGNORE` com `rev = 1`.

Tabela `app_state`: `id INTEGER PRIMARY KEY`, `state_json TEXT NOT NULL`, `updated_at INTEGER NOT NULL`, `rev INTEGER NOT NULL DEFAULT 0`.

## 8. Estrutura do repositório

Estrutura-alvo após a Fase 3 (a modularização está na branch `fase3` até o merge na `main`):

```text
meu-treino/
├── index.html
├── manifest.json
├── sw.js                    # service worker; CACHE_NAME versionado
├── icon-192.png
├── css/
│   ├── theme.css            # tokens M3 (gerado por tools/gerar.mjs)
│   ├── shell.css            # casca: barra, rail, drawer
│   ├── components.css       # componentes
│   └── style.css            # estilos legados (em remoção)
├── fonts/                   # Roboto local
├── js/                      # módulos ES (17 módulos na etapa 3a)
│   ├── router.js            # rotas por hash
│   ├── shell.js             # navegação responsiva
│   ├── theme.js             # tema claro/escuro/automático
│   ├── icons.js             # ícones SVG (gerado)
│   ├── elapsed.js           # tempo decorrido do treino
│   └── views/               # telas (home, workout, overlays, pages, ...)
├── tools/
│   └── gerar.mjs            # gera tema e ícones
└── api/
    ├── wrangler.toml
    ├── src/index.js         # Worker
    └── migrations/
        ├── 0001_create_app_state.sql
        └── 0002_add_rev.sql
```

## 9. Desenvolvimento local

**Front-end** (sem build):

```sh
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

**API local:**

1. Crie `api/.dev.vars` com `API_TOKEN=<valor de teste>` (o arquivo está no `.gitignore`).
2. Em `api/`, execute `npx wrangler dev` (porta 8787).
3. Para o navegador aceitar a chamada local, habilite `http://localhost:8000` em `ALLOWED_ORIGINS` no Worker e aponte `API_URL` para `http://localhost:8787`. **Reverta ambos os ajustes antes de publicar.**

Para testar o app em um aparelho real, é necessário servi-lo por HTTPS ou por `localhost`, requisito do service worker.

## 10. Publicação

**Front-end.** Fluxo: branch de trabalho, commit, pull request e merge na `main`. O GitHub Pages publica somente após o merge. A cada publicação, incremente `CACHE_NAME` em `sw.js`.

**Worker e banco** (executar em `api/`):

```sh
npx wrangler login
npx wrangler d1 create meu-treino-db
npx wrangler d1 migrations apply meu-treino-db --remote
npx wrangler deploy
npx wrangler secret put API_TOKEN
```

Execute o `deploy` antes de `secret put`, caso contrário o Wrangler cria um Worker vazio apenas para guardar o segredo. Gere o token com `openssl rand -hex 32` e guarde-o em um gerenciador de senhas.

Para trocar o token: `npx wrangler secret put API_TOKEN` com um novo valor e reconectar cada aparelho.

## 11. PWA e cache offline

O service worker usa a estratégia cache primeiro, rede como alternativa.

- Todo arquivo usado pela interface (CSS, JS, fontes, ícones) deve constar em `ASSETS`.
- Qualquer alteração em um arquivo de `ASSETS` exige incrementar `CACHE_NAME` (formato `treino-vN`); sem isso, os aparelhos continuam com a versão antiga.
- A versão vigente do cache é exibida no aplicativo, em Aparência.
- O aplicativo não recarrega sozinho ao detectar versão nova; a atualização vale na abertura seguinte.

## 12. Segurança

- Token único de 256 bits, nunca presente no código, no repositório ou em logs.
- Worker nega tudo na ausência do segredo; comparação em tempo constante.
- CORS restrito à origem do GitHub Pages; corpo limitado a 1 MB; validação mínima do formato.
- O token fica no `localStorage` de cada aparelho e fora do backup.
- Todo texto dinâmico passa por `escapeHtml` antes de entrar no HTML.
- Risco aceito: o `localStorage` é compartilhado por todos os sites da mesma origem (`<usuário>.github.io`). Não publique na mesma origem outros projetos com scripts de terceiros.
- Em caso de vazamento do token, o impacto se limita a leitura e sobrescrita do histórico de treinos. A mitigação é trocar o token.

## 13. Roadmap

### Fase 3 (interface Material Design 3)

| Etapa | Escopo | Situação |
|---|---|---|
| 3a | Modularização, tema M3, tipografia e ícones locais, casca responsiva, rotas, tema | Concluída |
| 3b | Home com resumo semanal e fichas em abas; treino em andamento com cabeçalho fixo, cartões densos, folha de informações em abas, diálogo de confirmação | Implementada; falta validar em navegador real (três larguras), em celular e passar o checklist de regressão |
| 3c | Editores: lista de exercícios, configuração de treino e edição de ficha, com campos outlined, botão segmentado (repetições/segundos), seletor de cor, diálogos e side sheets; confirmações de dois toques viram diálogos; snackbar com "Desfazer" | Planejada |
| 3d | Histórico denso (lista e painel no desktop); páginas Nuvem, Backup e Aparência; confirmações de sincronização e exclusão em diálogo; remoção do CSS legado | Planejada |
| 3e | Refino desktop (lista–detalhe, atalhos de teclado), acessibilidade, desempenho, revisão do `manifest.json`, eliminação de títulos duplicados | Planejada |
| Final | Atualização do guia de uso e execução completa do checklist de regressão | Planejada |

### Backlog

- Mesclagem automática na sincronização (união de `hist` por data, `plan` por data de edição).
- Preservar a última carga ao renomear um exercício.
- Edição de data, duração e esteira de treinos antigos.
- Gráficos de progresso por exercício.
- Aviso de nova versão quando o service worker for atualizado.
- Política de segurança de conteúdo (CSP) e integração contínua (GitHub Actions).
- Importação e exportação de backup como arquivo.
- Proteção adicional do Worker com Cloudflare Access (exigiria servir app e API na mesma origem).

### Checklist de regressão

Cada etapa da Fase 3 deve preservar: meta semanal e status da nuvem · fichas e "Sem ficha" · indicação de próximo treino · iniciar, continuar e descartar treino · ajuste de carga, séries, repetições e tempo · sugestão de aumento e topo da faixa · informações do exercício · troca por alternativa · pular exercício · cronômetro com bipe e vibração · cardio · conclusão do treino · histórico (recentes, lista completa, paginação, correção, exclusão) · edição completa de exercícios · gestão de treinos e fichas · sincronização (todos os estados) · backup · funcionamento offline e instalação · tema claro e escuro.

## 14. Limitações conhecidas

- Sincronização do estado inteiro, sem mescla: se dois aparelhos mudarem sem sincronizar entre si, o usuário escolhe um lado completo.
- `last` é indexado pelo nome do exercício; renomear um exercício faz o app esquecer a última carga dele.
- Aparelhos com versão anterior à Fase 2 ignoram `treinos` e `fichas` e podem recriar A, B e C; mantenha todos os aparelhos atualizados.
- Interface renderizada por strings HTML com redesenho integral a cada ação, o que exige cuidado com foco, rolagem e estado de componentes. A Fase 3 trata esse ponto de forma incremental.
- Sem CSP e sem integração contínua; publicação e testes são manuais.

## 15. Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).

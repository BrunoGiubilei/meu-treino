/* =========================================================
   Meu Treino — Estado do app (dados salvos) e armazenamento no localStorage.

   FORMATO DOS DADOS SALVOS (state)
   Os nomes curtos abaixo são os que já estão salvos no celular e
   nos backups. NÃO renomeie estes campos, senão os dados antigos
   deixam de funcionar.

     state = {
       plan: { [idDoTreino]: [exercício...] },   // ids originais: A, B, C
       hist: [treino concluído...],   // o mais recente primeiro
       last: { 'Nome do exercício': { kg, s, r, up } },
       cur:  treino em andamento, ou null,
       treinos: { [idDoTreino]: { nome, desc, cor } },   // cor = posição em COLOR_KEYS
       fichas:  [{ id, nome, treinos: [idDoTreino...] }]  // treino fora de toda ficha = "Sem ficha"
     }
     (treinos e fichas são opcionais: dados antigos sem eles são convertidos
      ao abrir, com A, B e C dentro da ficha "Ficha atual".)

     exercício       = { id, n: nome, s: séries, r: faixa de repetições,
                         d: como executar, t: dica,
                         a: [{ n, d }] alternativas,
                         u: 'rep' (repetições) ou 's' (segundos) }
     treino em curso = { w: idDoTreino, st: início (ms), cm: min de esteira,
                         ck: km/h da esteira, it: { [idExercício]: entrada } }
     entrada         = { alt: índice da alternativa (-1 = original),
                         kg, s, r, skip: true se foi pulado }
     histórico       = { d: data (ms), w: idDoTreino, m: duração (min),
                         it: [{ n, kg, s, r, u }], cm, ck,
                         wn: nome do treino na hora (usado se o treino for removido) }
     last[nome]      = última carga usada; up = true se bateu o topo da faixa
   ========================================================= */

import { COLOR_KEYS, LEGACY_IDS, STORAGE_KEY } from './config.js';
import { DEFAULT_WORKOUTS, createExercise } from './defaults.js';

/** Avisado quando os dados mudam de verdade (a sincronização se registra aqui). */
let changeListener = () => {};

export function onStateChanged(listener) {
  changeListener = listener;
}

/** Lê os dados salvos; devolve null se não houver nada (ou se estiver corrompido). */
export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.plan && saved.hist) return saved;
  } catch (error) {
    // dados inválidos: começa do zero
  }
  return null;
}

/** Salva no aparelho e avisa a sincronização, mas só se algo realmente mudou. */
export function saveState() {
  const json = JSON.stringify(state);
  if (json === lastSavedJson) return;   // cliques que não alteram dados (abrir painel etc.)
  lastSavedJson = json;
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
  changeListener();
}

/**
 * Completa o que faltar e converte dados antigos para o formato atual.
 * Dados sem `treinos` (versões anteriores, backups antigos, primeira abertura)
 * ganham A, B e C com os nomes de sempre, todos dentro da ficha "Ficha atual".
 */
export function normalizeState(data) {
  data.last = data.last || {};
  data.plan = data.plan || {};

  if (!data.treinos || typeof data.treinos !== 'object') {
    data.treinos = {};
    LEGACY_IDS.forEach((id, index) => {
      if (!data.plan[id]) {
        data.plan[id] = DEFAULT_WORKOUTS[id].exercises
          .map((def, position) => createExercise(id, position, def));
      }
      data.treinos[id] = { nome: 'Treino ' + id, desc: DEFAULT_WORKOUTS[id].title, cor: index };
    });
  }

  // todo treino com lista tem dados de treino (e vice-versa), com campos válidos
  Object.keys(data.plan).forEach(id => {
    if (!data.treinos[id]) data.treinos[id] = {};
  });
  Object.keys(data.treinos).forEach((id, position) => {
    const treino = data.treinos[id];
    if (typeof treino.nome !== 'string' || !treino.nome) treino.nome = 'Treino ' + id;
    if (typeof treino.desc !== 'string') treino.desc = '';
    if (!Number.isInteger(treino.cor) || treino.cor < 0) treino.cor = position % COLOR_KEYS.length;
    if (!Array.isArray(data.plan[id])) data.plan[id] = [];
  });

  // fichas: cada uma só cita treinos que existem, e nenhum treino aparece em duas
  if (!Array.isArray(data.fichas)) {
    data.fichas = [{ id: 'ficha1', nome: 'Ficha atual', treinos: Object.keys(data.treinos) }];
  }
  const used = new Set();
  data.fichas = data.fichas.filter(ficha => ficha && typeof ficha === 'object' && ficha.id);
  data.fichas.forEach(ficha => {
    if (typeof ficha.nome !== 'string' || !ficha.nome) ficha.nome = 'Ficha';
    ficha.treinos = (Array.isArray(ficha.treinos) ? ficha.treinos : [])
      .filter(id => data.treinos[id] && !used.has(id) && used.add(id));
  });

  // treino em andamento de um treino que não existe mais
  if (data.cur && !data.plan[data.cur.w]) data.cur = null;

  return data;
}

// Dados salvos (ou um estado vazio na primeira vez)
export let state = normalizeState(loadState() || { plan: {}, hist: [], last: {}, cur: null });
let lastSavedJson = JSON.stringify(state);   // último estado gravado, para detectar mudanças

/** Troca o estado inteiro (importar backup, adotar dados da nuvem). Só este módulo reatribui `state`. */
export function setState(next) {
  state = next;
}

/** Marca o estado atual como já gravado e devolve o seu JSON. */
export function snapshotSaved() {
  lastSavedJson = JSON.stringify(state);
  return lastSavedJson;
}

/* =========================================================
   Meu Treino — Funções auxiliares: formatação, treinos/fichas, aviso rápido, menus recolhíveis.
   ========================================================= */

import { COLOR_KEYS, DEFAULT_REPS_LOW, LEGACY_IDS, TOAST_DURATION_MS } from './config.js';
import { state } from './state.js';
import { openPanels, ui } from './ui.js';

export const $ = selector => document.querySelector(selector);

// Telas que existem. Qualquer outro valor de ui.currentView cai na tela inicial.
const KNOWN_VIEWS = ['home', 'workout', 'edit', 'treino-edit', 'ficha-edit', 'history', 'history-edit',
  'cloud', 'backup', 'appearance'];

/** Tela que realmente aparece agora (ex.: 'workout' sem treino em andamento mostra a inicial). */
export function effectiveView() {
  const view = ui.currentView;
  if (view === 'workout') return state.cur && state.plan[state.cur.w] ? 'workout' : 'home';
  return KNOWN_VIEWS.includes(view) ? view : 'home';
}

/** Protege textos que vão para dentro do HTML. */
export function escapeHtml(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(value).replace(/[&<>"]/g, char => replacements[char]);
}

/** Número com vírgula decimal (22.5 -> "22,5"). */
export function formatNumber(number) {
  return String(number).replace('.', ',');
}

/** Início da faixa de repetições: '8-12' -> 8. */
export function repsLowerBound(exercise) {
  return parseInt(exercise.r) || DEFAULT_REPS_LOW;
}

/** Topo da faixa de repetições: '8-12' -> 12. */
export function repsUpperBound(exercise) {
  return parseInt(String(exercise.r).split('-').pop()) || 0;
}

/** Nome que aparece na tela: o da alternativa escolhida ou o original. */
export function displayName(exercise, entry) {
  const alternative = exercise.a[entry.alt];
  return entry.alt >= 0 && alternative ? alternative.n : exercise.n;
}

/**
 * Cria a entrada de um exercício no treino em andamento,
 * já preenchida com os valores da última vez (se houver).
 */
export function createEntry(exercise, altIndex) {
  const name = altIndex >= 0 ? exercise.a[altIndex].n : exercise.n;
  const last = state.last[name];
  return {
    alt: altIndex,
    kg: last ? last.kg : 0,
    s: last ? last.s : exercise.s,
    r: last ? last.r : repsLowerBound(exercise),
    skip: false,
  };
}

/** Devolve a entrada do exercício no treino atual (criando se ainda não existir). */
export function getEntry(exercise) {
  if (!state.cur.it[exercise.id]) {
    state.cur.it[exercise.id] = createEntry(exercise, -1);
  }
  return state.cur.it[exercise.id];
}

/** Quantos treinos foram concluídos nesta semana (a semana começa na segunda). */
export function countWorkoutsThisWeek() {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
  return state.hist.filter(workout => workout.d >= weekStart).length;
}

/* ---------- Treinos e fichas: nomes, cores e ordem ---------- */

export function workoutName(id) {
  const treino = state.treinos[id];
  return treino ? treino.nome : 'Treino ' + id;
}

/** Chave de cor do treino (A–F), usada nas classes workout-X e nas variáveis --color-X. */
export function workoutColorKey(id) {
  const treino = state.treinos[id];
  return COLOR_KEYS[(treino ? treino.cor : 0) % COLOR_KEYS.length];
}

/** Nome de um treino do histórico: o atual, ou o guardado na hora se o treino foi removido. */
export function historyName(workout) {
  const treino = state.treinos[workout.w];
  return treino ? treino.nome : (workout.wn || 'Treino ' + workout.w);
}

export function historyColorKey(workout) {
  if (state.treinos[workout.w]) return workoutColorKey(workout.w);
  const legacy = LEGACY_IDS.indexOf(workout.w);
  return COLOR_KEYS[legacy >= 0 ? legacy : 0];
}

export function findFicha(id) {
  return state.fichas.find(ficha => ficha.id === id);
}

/** Treinos que não estão em nenhuma ficha. */
export function unassignedWorkouts() {
  const inFichas = new Set(state.fichas.flatMap(ficha => ficha.treinos));
  return Object.keys(state.treinos).filter(id => !inFichas.has(id));
}

/** Tira o treino de todas as fichas e, se `fichaId` existir, coloca no fim dela. */
export function moveWorkoutToFicha(id, fichaId) {
  state.fichas.forEach(ficha => {
    ficha.treinos = ficha.treinos.filter(item => item !== id);
  });
  const destination = findFicha(fichaId);
  if (destination) destination.treinos.push(id);
}

/** Próximo treino de uma ficha: o que vem depois do último concluído dela (A -> B -> C -> A...). */
export function nextWorkoutIn(ficha) {
  const ids = ficha.treinos.filter(id => state.plan[id]);
  if (!ids.length) return null;
  const last = state.hist.find(workout => ids.includes(workout.w));
  if (!last) return ids[0];
  return ids[(ids.indexOf(last.w) + 1) % ids.length];
}

/** Mostra uma mensagem rápida no topo da tela. */
export function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(ui.toastTimeout);
  ui.toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, TOAST_DURATION_MS);
}

/** Acha um treino do histórico pela data (que serve de identificador). */
export function findHistoryWorkout(d) {
  return state.hist.find(workout => workout.d === d);
}

/** Menu aberto? "Como executar" ('how:...') e as fichas ('ficha:...') já começam abertos; os demais, fechados. */
export function isPanelOpen(key) {
  const saved = openPanels[key];
  return saved === undefined ? (key.startsWith('how:') || key.startsWith('ficha:')) : saved;
}

export function togglePanel(key) {
  openPanels[key] = !isPanelOpen(key);
}

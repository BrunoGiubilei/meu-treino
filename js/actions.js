/* =========================================================
   Meu Treino — Ações dos botões (data-action) e gravação dos campos de texto.
   ========================================================= */

import { adoptRemote, cloud, pushPending, saveSyncMeta, setToken, syncNow } from './cloud.js';
import { COLOR_KEYS, HISTORY_PAGE, HOLD_STEP_SECONDS, LOAD_STEP_KG, MAX_HISTORY, TOKEN_KEY } from './config.js';
import { $, createEntry, displayName, findFicha, findHistoryWorkout, getEntry, moveWorkoutToFicha, repsLowerBound, repsUpperBound, showToast, togglePanel, workoutName } from './helpers.js';
import { startRest } from './rest.js';
import { setTheme } from './theme.js';
import { normalizeState, setState, state } from './state.js';
import { openPanels, ui } from './ui.js';

export function finishWorkout() {
  const session = state.cur;
  const doneItems = [];

  state.plan[session.w].forEach(exercise => {
    const entry = getEntry(exercise);
    if (entry.skip) return;

    const name = displayName(exercise, entry);
    doneItems.push({ n: name, kg: entry.kg, s: entry.s, r: entry.r, u: exercise.u });

    // guarda a "última vez" e marca se bateu o topo da faixa (base da sugestão de carga)
    state.last[name] = {
      kg: entry.kg,
      s: entry.s,
      r: entry.r,
      up: exercise.u !== 's' && entry.kg > 0 && entry.r >= repsUpperBound(exercise),
    };
  });

  const now = Date.now();
  const minutes = Math.max(1, Math.round((now - session.st) / 60000));
  state.hist.unshift({
    d: now,
    w: session.w,
    wn: workoutName(session.w),
    m: minutes,
    it: doneItems,
    cm: session.cm || '',
    ck: session.ck || '',
  });
  state.hist = state.hist.slice(0, MAX_HISTORY);

  state.cur = null;
  ui.currentView = 'home';
  clearInterval(ui.restInterval);
  showToast(`${workoutName(session.w)} concluído e registrado`);
}

/** Aumenta ou diminui carga, séries ou repetições (direction = 1 ou -1). */
export function changeValue(exercise, field, direction) {
  const entry = getEntry(exercise);
  let step = 1;
  if (field === 'kg') step = LOAD_STEP_KG;
  else if (field === 'r' && exercise.u === 's') step = HOLD_STEP_SECONDS;

  // toFixed evita erros de ponto flutuante (ex.: 0.1 + 0.2); nunca fica abaixo de zero
  entry[field] = Math.max(0, +(entry[field] + direction * step).toFixed(1));
}

/** Exercício da lista cujo nome (ou o de uma alternativa) é `name`. */
export function findPlanExerciseByName(name) {
  for (const id of Object.keys(state.plan)) {
    const found = state.plan[id].find(exercise =>
      exercise.n === name || exercise.a.some(alt => alt.n === name));
    if (found) return found;
  }
  return undefined;
}

/**
 * Refaz a "última carga" de um exercício a partir do treino mais recente que o contém.
 * É o que mantém o valor pré-preenchido e a sugestão de aumento certos depois de
 * corrigir ou apagar um treino. Sem nenhum treino com esse exercício, apaga a entrada.
 */
export function syncLastFor(name) {
  for (const workout of state.hist) {          // do mais recente para o mais antigo
    const item = workout.it.find(entry => entry.n === name);
    if (!item) continue;

    const exercise = findPlanExerciseByName(name);
    state.last[name] = {
      kg: item.kg,
      s: item.s,
      r: item.r,
      up: !!exercise && item.u !== 's' && item.kg > 0 && item.r >= repsUpperBound(exercise),
    };
    return;
  }
  delete state.last[name];
}

/** Grava no histórico o valor digitado na tela de edição de um treino. */
export function changeHistoryField(input) {
  const workout = findHistoryWorkout(ui.editingWorkoutD);
  const item = workout && workout.it[input.dataset.index];
  const key = { hkg: 'kg', hs: 's', hr: 'r' }[input.dataset.field];
  if (!item || !key) return;

  const typed = parseFloat(String(input.value).replace(',', '.'));
  if (Number.isFinite(typed) && typed >= 0) {
    if (key === 'kg') item.kg = Math.round(typed * 100) / 100;
    else if (key === 's') item.s = Math.max(1, Math.round(typed));
    else item.r = Math.round(typed);
  }
  input.value = item[key] || 0;   // mostra o valor aceito (ou volta ao anterior se o texto era inválido)
  syncLastFor(item.n);
}

/** Grava nome, descrição ou ficha do treino aberto nas configurações. */
export function changeTreinoField(input) {
  const treino = state.treinos[ui.editingTreino];
  if (!treino) return;
  const field = input.dataset.field;

  if (field === 'tn') {
    treino.nome = input.value.trim() || treino.nome;   // o nome não pode ficar vazio
    input.value = treino.nome;
  } else if (field === 'td') {
    treino.desc = input.value.trim();
  } else if (field === 'tf') {
    moveWorkoutToFicha(ui.editingTreino, input.value);
  }
}

/** Grava o nome da ficha aberta. */
export function changeFichaField(input) {
  const ficha = findFicha(ui.editingFicha);
  if (!ficha || input.dataset.field !== 'fn') return;
  ficha.nome = input.value.trim() || ficha.nome;      // o nome não pode ficar vazio
  input.value = ficha.nome;
}

export function copyBackup() {
  const textarea = $('#backup-output');
  if (!textarea || !textarea.value) {
    showToast('Gere o backup primeiro');
    return;
  }
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    // navegador sem suporte: avisa abaixo
  }
  showToast(copied ? 'Backup copiado' : 'Selecione o texto e copie manualmente');
}

/** Restaura os dados a partir do texto colado. Devolve false se o texto for inválido. */
export function importBackup() {
  try {
    const imported = JSON.parse($('#backup-input').value);
    if (!imported.plan || !imported.hist) throw new Error('backup inválido');
    imported.cur = null;
    setState(normalizeState(imported));
    showToast('Backup restaurado');
  } catch (error) {
    showToast('Texto de backup inválido');
    return false;
  }
}

export const actions = {
  // ----- navegação -----
  'home'() {
    ui.currentView = 'home';
  },

  'start'({ value, session }) {
    if (session && session.w !== value) {
      showToast('Há um treino em andamento. Continue ou descarte.');
      return false;
    }
    if (!session && !(state.plan[value] && state.plan[value].length)) {
      showToast('Adicione exercícios a este treino antes de iniciar');
      return false;
    }
    if (!session) {
      state.cur = { w: value, st: Date.now(), it: {}, cm: '', ck: '' };
    }
    ui.currentView = 'workout';
  },

  'continue'() {
    ui.currentView = 'workout';
  },

  // 1º toque pede confirmação; 2º toque descarta
  'discard'() {
    if (ui.confirmingDiscard) {
      state.cur = null;
      ui.confirmingDiscard = false;
    } else {
      ui.confirmingDiscard = true;
    }
  },

  // ----- treino em andamento -----
  'info'({ id }) {
    togglePanel('info:' + id);
  },

  'toggle-alternatives'({ id }) {
    togglePanel('alts:' + id);
  },

  'pick-alternative'({ id, value, exercise }) {
    const entry = getEntry(exercise);
    const wasSkipped = entry.skip;
    Object.assign(entry, createEntry(exercise, +value), { skip: wasSkipped });
    openPanels['alts:' + id] = false;
  },

  'toggle-skip'({ exercise }) {
    const entry = getEntry(exercise);
    entry.skip = !entry.skip;
  },

  'decrease'({ exercise, field }) {
    changeValue(exercise, field, -1);
  },

  'increase'({ exercise, field }) {
    changeValue(exercise, field, +1);
  },

  // aplica a carga sugerida (última carga + passo) e volta às repetições iniciais
  'apply-suggestion'({ exercise }) {
    const entry = getEntry(exercise);
    entry.kg = state.last[displayName(exercise, entry)].kg + LOAD_STEP_KG;
    entry.r = repsLowerBound(exercise);
  },

  'finish'() {
    finishWorkout();
  },

  // ----- cronômetro (não precisa salvar nem redesenhar) -----
  'rest'({ value }) {
    startRest(+value);
    return false;
  },

  'stop-timer'() {
    clearInterval(ui.restInterval);
    $('#rest-timer').textContent = 'Descanso';
    return false;
  },

  // ----- edição da lista -----
  'edit'({ value }) {
    ui.editingTreino = value;
    openPanels['menu:' + value] = false;
    ui.currentView = 'edit';
  },

  // abre ou fecha qualquer menu recolhível (a chave vem em data-value)
  'toggle-panel'({ value }) {
    togglePanel(value);
  },

  'add-exercise'() {
    const id = 'x' + Date.now();
    state.plan[ui.editingTreino].push({
      id,
      n: 'Novo exercício',
      s: 3,
      r: '8-12',
      d: '',
      t: '',
      a: [],
      u: 'rep',
    });
    openPanels['ed:' + id] = true;   // o novo exercício já aparece aberto para preencher
  },

  // 1º toque pede confirmação; 2º toque remove
  'remove-exercise'({ index }) {
    const key = ui.editingTreino + ':' + index;
    if (ui.confirmingRemove !== key) {
      ui.confirmingRemove = key;
      return;
    }
    ui.confirmingRemove = '';
    state.plan[ui.editingTreino].splice(+index, 1);
  },

  'add-alt'({ index }) {
    const exercise = state.plan[ui.editingTreino][+index];
    if (!exercise) return;
    exercise.a.push({ n: 'Nova alternativa', d: '' });
    openPanels['ed-alts:' + exercise.id] = true;
  },

  'remove-alt'({ index, value }) {
    const exercise = state.plan[ui.editingTreino][+index];
    if (exercise) exercise.a.splice(+value, 1);
  },

  // ----- treinos e fichas -----
  'add-ficha'() {
    const id = 'f' + Date.now();
    state.fichas.push({ id, nome: 'Nova ficha', treinos: [] });
    ui.editingFicha = id;
    ui.currentView = 'ficha-edit';
  },

  'ficha-edit'({ value }) {
    ui.editingFicha = value;
    ui.currentView = 'ficha-edit';
  },

  // cria um treino vazio dentro da ficha e abre as configurações para dar nome
  'add-treino'({ value }) {
    const ficha = findFicha(value);
    if (!ficha) return false;
    const id = 'w' + Date.now();
    state.plan[id] = [];
    state.treinos[id] = { nome: 'Novo treino', desc: '', cor: Object.keys(state.treinos).length % COLOR_KEYS.length };
    ficha.treinos.push(id);
    ui.editingTreino = id;
    ui.currentView = 'treino-edit';
  },

  'treino-edit'({ value }) {
    ui.editingTreino = value;
    openPanels['menu:' + value] = false;
    ui.currentView = 'treino-edit';
  },

  'set-color'({ value }) {
    const treino = state.treinos[ui.editingTreino];
    if (treino) treino.cor = +value;
  },

  'move-treino'({ index, value }) {
    const ficha = findFicha(ui.editingFicha);
    if (!ficha) return;
    const from = +index;
    const to = value === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= ficha.treinos.length) return;
    [ficha.treinos[from], ficha.treinos[to]] = [ficha.treinos[to], ficha.treinos[from]];
  },

  // Remove o treino (2º toque confirma). O histórico dele é mantido.
  'delete-treino'() {
    const id = ui.editingTreino;
    if (state.cur && state.cur.w === id) {
      showToast('Há um treino em andamento. Conclua ou descarte antes de remover.');
      return false;
    }
    if (ui.confirmingDelete !== 'treino:' + id) {
      ui.confirmingDelete = 'treino:' + id;
      return;
    }
    ui.confirmingDelete = '';
    delete state.plan[id];
    delete state.treinos[id];
    state.fichas.forEach(ficha => {
      ficha.treinos = ficha.treinos.filter(item => item !== id);
    });
    ui.editingTreino = '';
    ui.currentView = 'home';
    showToast('Treino removido (o histórico foi mantido)');
  },

  // Remove a ficha (2º toque confirma). Os treinos dela ficam em "Sem ficha".
  'delete-ficha'() {
    const id = ui.editingFicha;
    if (ui.confirmingDelete !== 'ficha:' + id) {
      ui.confirmingDelete = 'ficha:' + id;
      return;
    }
    ui.confirmingDelete = '';
    state.fichas = state.fichas.filter(ficha => ficha.id !== id);
    ui.editingFicha = '';
    ui.currentView = 'home';
    showToast('Ficha removida. Os treinos ficaram em "Sem ficha".');
  },

  // ----- histórico -----
  'history'() {
    ui.currentView = 'history';
  },

  'history-more'() {
    ui.historyShown += HISTORY_PAGE;
  },

  'history-edit'({ value }) {
    ui.editingWorkoutD = +value;
    ui.currentView = 'history-edit';
  },

  // Apaga o treino aberto (pede 2º toque para confirmar)
  'history-delete'() {
    if (!ui.confirmingHistoryDelete) {
      ui.confirmingHistoryDelete = true;
      return;
    }
    ui.confirmingHistoryDelete = false;

    const workout = findHistoryWorkout(ui.editingWorkoutD);
    if (workout) {
      state.hist = state.hist.filter(item => item !== workout);
      workout.it.forEach(item => syncLastFor(item.n));
      showToast('Treino apagado');
    }
    ui.editingWorkoutD = null;
    ui.currentView = 'history';
  },

  // ----- backup -----
  'toggle-backup'() {
    togglePanel('backup');
  },

  'export-backup'() {
    ui.backupText = JSON.stringify({ ...state, cur: null });
  },

  'copy-backup'() {
    copyBackup();
    return false;
  },

  'import-backup'() {
    return importBackup();
  },

  // ----- aparência (o tema é só deste aparelho: não entra no state nem na nuvem) -----
  'set-theme'({ value }) {
    setTheme(value);
  },

  // ----- nuvem -----
  'toggle-sync'() {
    togglePanel('sync');
  },

  'sync-connect'() {
    const token = ($('#sync-token').value || '').trim();
    if (!token) {
      showToast('Cole o token primeiro');
      return false;
    }
    setToken(token);
    cloud.status = 'idle';
    syncNow();
  },

  'sync-disconnect'() {
    clearTimeout(cloud.pushTimer);
    localStorage.removeItem(TOKEN_KEY);
    cloud.conflict = null;
    cloud.status = 'idle';
    showToast('Nuvem desconectada neste aparelho');
  },

  'sync-now'() {
    if (cloud.conflict) {
      showToast('Escolha primeiro qual versão manter');
      return false;
    }
    syncNow();
    return false;
  },

  // Troca os dados deste aparelho pelos da nuvem (pede 2º toque para confirmar)
  'sync-use-remote'() {
    if (!cloud.conflict || !cloud.conflict.remote) return;
    if (ui.confirmingSync !== 'remote') {
      ui.confirmingSync = 'remote';
      return;
    }
    ui.confirmingSync = '';
    adoptRemote(cloud.conflict.remote);
    showToast('Dados da nuvem carregados');
  },

  // Mantém os dados deste aparelho e grava por cima da nuvem (2º toque, se a nuvem tiver dados)
  'sync-keep-local'() {
    if (!cloud.conflict) return;
    const remote = cloud.conflict.remote;
    if (remote && ui.confirmingSync !== 'local') {
      ui.confirmingSync = 'local';
      return;
    }
    ui.confirmingSync = '';
    cloud.conflict = null;
    cloud.meta = { rev: remote ? remote.rev : 0, dirty: true };
    saveSyncMeta();
    cloud.status = 'idle';
    pushPending();
  },
};

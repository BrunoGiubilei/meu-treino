/* =========================================================
   Meu Treino — Ouvintes de clique e de mudança de campos (um só de cada, no document).
   ========================================================= */

import { actions, changeFichaField, changeHistoryField, changeTreinoField } from './actions.js';
import { syncHash } from './router.js';
import { saveState, state } from './state.js';
import { ui } from './ui.js';
import { render } from './views/render.js';

export function bindEvents() {
  // Um único "ouvinte" trata todos os cliques de botões
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const { action, id, index, value, field } = button.dataset;
    const session = state.cur;
    const exercise = session ? (state.plan[session.w] || []).find(item => item.id === id) : undefined;

    if (action !== 'discard') ui.confirmingDiscard = false;
    if (action !== 'history-delete') ui.confirmingHistoryDelete = false;
    if (action !== 'remove-exercise') ui.confirmingRemove = '';
    if (action !== 'delete-treino' && action !== 'delete-ficha') ui.confirmingDelete = '';
    if (action !== 'sync-use-remote' && action !== 'sync-keep-local') ui.confirmingSync = '';

    const handler = actions[action];
    const result = handler ? handler({ id, index, value, field, session, exercise }) : undefined;
    if (result === false) return;

    saveState();
    render();
    syncHash();   // mudou de tela? o endereço (#/...) acompanha
  });

  // Campos de texto: guardam o valor quando o usuário termina de digitar
  document.addEventListener('change', event => {
    const input = event.target;
    const field = input.dataset.field;
    if (!field) return;

    if (ui.currentView === 'history-edit') {
      // edição de um treino do histórico
      changeHistoryField(input);
    } else if (ui.currentView === 'treino-edit') {
      changeTreinoField(input);
    } else if (ui.currentView === 'ficha-edit') {
      changeFichaField(input);
    } else if ((field === 'cm' || field === 'ck') && state.cur) {
      // cardio do treino em andamento
      state.cur[field] = input.value;
    } else if (ui.currentView === 'edit') {
      // edição da lista de exercícios
      const exercise = state.plan[ui.editingTreino][input.dataset.index];
      if (exercise) {
        if (field === 'an' || field === 'ad') {
          // nome ou descrição de uma alternativa
          const alternative = exercise.a[input.dataset.alt];
          if (alternative) alternative[field === 'an' ? 'n' : 'd'] = input.value;
        } else {
          exercise[field] = field === 's' ? Math.max(1, +input.value || 3) : input.value;
        }
      }
    }
    saveState();
  });
}

/* =========================================================
   Meu Treino — Escolhe a tela certa e desenha.
   ========================================================= */

import { $, effectiveView } from '../helpers.js';
import { updateShell } from '../shell.js';
import { showVersion } from '../version.js';
import { renderEdit } from './edit.js';
import { renderHistoryEdit, renderHistoryList } from './history.js';
import { renderHome } from './home.js';
import { renderAppearancePage, renderBackupPage, renderCloudPage } from './pages.js';
import { renderFichaEdit, renderTreinoEdit } from './treino.js';
import { renderWorkout } from './workout.js';

const RENDERERS = {
  workout: renderWorkout,
  edit: renderEdit,
  'treino-edit': renderTreinoEdit,
  'ficha-edit': renderFichaEdit,
  history: renderHistoryList,
  'history-edit': renderHistoryEdit,
  cloud: renderCloudPage,
  backup: renderBackupPage,
  appearance: renderAppearancePage,
  home: renderHome,
};

let lastView = '';

export function render() {
  const view = effectiveView();
  $('#app').innerHTML = RENDERERS[view]();

  // a barra de descanso só aparece durante o treino
  $('#rest-bar').hidden = view !== 'workout';

  updateShell(view);
  showVersion();

  // trocou de tela: volta ao topo
  if (view !== lastView) {
    lastView = view;
    try {
      window.scrollTo(0, 0);
    } catch (error) {
      // sem suporte: ignora
    }
  }
}

/* =========================================================
   Meu Treino — Escolhe a tela certa e desenha.
   ========================================================= */

import { $ } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';
import { renderEdit } from './edit.js';
import { renderHistoryEdit, renderHistoryList } from './history.js';
import { renderHome } from './home.js';
import { renderFichaEdit, renderTreinoEdit } from './treino.js';
import { renderWorkout } from './workout.js';

export function render() {
  const showingWorkout = ui.currentView === 'workout' && state.cur && state.plan[state.cur.w];

  if (showingWorkout) {
    $('#app').innerHTML = renderWorkout();
  } else if (ui.currentView === 'edit') {
    $('#app').innerHTML = renderEdit();
  } else if (ui.currentView === 'treino-edit') {
    $('#app').innerHTML = renderTreinoEdit();
  } else if (ui.currentView === 'ficha-edit') {
    $('#app').innerHTML = renderFichaEdit();
  } else if (ui.currentView === 'history') {
    $('#app').innerHTML = renderHistoryList();
  } else if (ui.currentView === 'history-edit') {
    $('#app').innerHTML = renderHistoryEdit();
  } else {
    $('#app').innerHTML = renderHome();
  }

  // a barra de descanso só aparece durante o treino
  $('#rest-bar').hidden = !showingWorkout;
}

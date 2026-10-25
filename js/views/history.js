/* =========================================================
   Meu Treino — Telas do histórico: lista completa e edição de um treino.
   ========================================================= */

import { escapeHtml, findHistoryWorkout, historyColorKey, historyName } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';
import { formatHistoryLines } from './components.js';

export function renderHistoryList() {
  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Histórico</h1>
        <small>${state.hist.length} ${state.hist.length === 1 ? 'treino guardado' : 'treinos guardados'}</small>
      </div>
    </div>`;

  state.hist.slice(0, ui.historyShown).forEach(workout => {
    const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
    html += `
      <div class="card workout-${historyColorKey(workout)}">
        <b>${escapeHtml(historyName(workout))}</b> em ${date}, ${workout.m} min<br>
        <small>${formatHistoryLines(workout)}</small>
        <div class="row">
          <button data-action="history-edit" data-value="${workout.d}">Editar</button>
        </div>
      </div>`;
  });

  if (state.hist.length > ui.historyShown) {
    html += '<button class="btn-full" data-action="history-more">Mostrar mais</button>';
  }
  return html;
}

export function renderHistoryEdit() {
  const workout = findHistoryWorkout(ui.editingWorkoutD);
  if (!workout) return renderHistoryList();   // o treino não existe mais (ex.: veio outra versão da nuvem)

  const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  let html = `
    <div class="header">
      <button data-action="history" aria-label="Voltar ao histórico">←</button>
      <div>
        <h1>Editar ${escapeHtml(historyName(workout))}</h1>
        <small>${date}</small>
      </div>
    </div>`;

  workout.it.forEach((item, index) => {
    const timed = item.u === 's';
    html += `
      <div class="card workout-${historyColorKey(workout)}">
        <div class="exercise-name">${escapeHtml(item.n)}</div>
        <div class="row">
          <label>Carga (kg)<input type="number" inputmode="decimal" step="any" min="0" data-field="hkg" data-index="${index}" value="${item.kg || 0}"></label>
          <label>Séries<input type="number" inputmode="numeric" min="1" data-field="hs" data-index="${index}" value="${item.s || 0}"></label>
          <label>${timed ? 'Segundos' : 'Repetições'}<input type="number" inputmode="numeric" min="0" data-field="hr" data-index="${index}" value="${item.r || 0}"></label>
        </div>
      </div>`;
  });

  html += `
    <div class="spacer-small"></div>
    <button class="btn-full${ui.confirmingHistoryDelete ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="history-delete">
      ${ui.confirmingHistoryDelete ? 'Confirmar: apagar este treino' : 'Apagar este treino'}
    </button>`;
  return html;
}

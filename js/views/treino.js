/* =========================================================
   Meu Treino — Telas "Configurar treino" e "Editar ficha".
   ========================================================= */

import { COLOR_KEYS } from '../config.js';
import { escapeHtml, findFicha, workoutColorKey, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';
import { renderHome } from './home.js';

export function renderTreinoEdit() {
  const id = ui.editingTreino;
  const treino = state.treinos[id];
  if (!treino) return renderHome();   // o treino não existe mais

  const current = state.fichas.find(ficha => ficha.treinos.includes(id));
  const options = ['<option value="">Sem ficha</option>'].concat(state.fichas.map(ficha =>
    `<option value="${escapeHtml(ficha.id)}"${current && current.id === ficha.id ? ' selected' : ''}>${escapeHtml(ficha.nome)}</option>`)).join('');
  const swatches = COLOR_KEYS.map((colorKey, index) =>
    `<button class="swatch workout-${colorKey}${treino.cor === index ? ' selected' : ''}" data-action="set-color" data-value="${index}" aria-label="Cor ${index + 1}" aria-pressed="${treino.cor === index}"></button>`).join('');
  const confirming = ui.confirmingDelete === 'treino:' + id;
  const count = state.plan[id].length;

  return `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Configurar treino</h1>
        <small>${count} ${count === 1 ? 'exercício' : 'exercícios'}</small>
      </div>
    </div>
    <div class="card workout-${workoutColorKey(id)}">
      <label>Nome<input data-field="tn" value="${escapeHtml(treino.nome)}"></label>
      <div class="spacer-small"></div>
      <label>Descrição (opcional)<input data-field="td" value="${escapeHtml(treino.desc)}" placeholder="Ex.: Pernas e core"></label>
      <div class="spacer-small"></div>
      <label>Ficha<select data-field="tf">${options}</select></label>
      <div class="spacer-small"></div>
      <small>Cor</small>
      <div class="swatches">${swatches}</div>
    </div>
    <button class="btn-full" data-action="edit" data-value="${escapeHtml(id)}">Editar lista de exercícios</button>
    <div class="spacer-small"></div>
    <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="delete-treino">${confirming ? 'Confirmar: remover este treino' : 'Remover treino'}</button>
    <small>O histórico deste treino é mantido.</small>`;
}

export function renderFichaEdit() {
  const ficha = findFicha(ui.editingFicha);
  if (!ficha) return renderHome();   // a ficha não existe mais

  const confirming = ui.confirmingDelete === 'ficha:' + ficha.id;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Editar ficha</h1>
        <small>${ficha.treinos.length} ${ficha.treinos.length === 1 ? 'treino' : 'treinos'}</small>
      </div>
    </div>
    <div class="card">
      <label>Nome da ficha<input data-field="fn" value="${escapeHtml(ficha.nome)}"></label>
    </div>
    <h2>Treinos</h2>`;

  ficha.treinos.forEach((id, index) => {
    html += `
      <div class="card workout-${workoutColorKey(id)}">
        <div class="row row-flush">
          <div class="exercise-name">${escapeHtml(workoutName(id))}</div>
          <button class="btn-side" data-action="treino-edit" data-value="${escapeHtml(id)}">Configurar</button>
        </div>
        <div class="row">
          <button data-action="move-treino" data-index="${index}" data-value="up" aria-label="Subir"${index === 0 ? ' disabled' : ''}>↑</button>
          <button data-action="move-treino" data-index="${index}" data-value="down" aria-label="Descer"${index === ficha.treinos.length - 1 ? ' disabled' : ''}>↓</button>
        </div>
      </div>`;
  });
  if (!ficha.treinos.length) html += '<small>Nenhum treino nesta ficha ainda.</small>';

  html += `
    <button class="btn-full" data-action="add-treino" data-value="${escapeHtml(ficha.id)}">Adicionar treino</button>
    <div class="spacer-small"></div>
    <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="delete-ficha">${confirming ? 'Confirmar: remover esta ficha' : 'Remover ficha'}</button>
    <small>Os treinos não são apagados: ficam em "Sem ficha".</small>`;
  return html;
}

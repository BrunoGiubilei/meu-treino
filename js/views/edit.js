/* =========================================================
   Meu Treino — Tela de edição da lista de exercícios.
   ========================================================= */

import { escapeHtml, isPanelOpen, workoutColorKey, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';
import { renderSection } from './components.js';
import { renderHome } from './home.js';

export function renderEdit() {
  const id = ui.editingTreino;
  if (!state.plan[id]) return renderHome();   // o treino não existe mais
  const letter = workoutColorKey(id);         // chave de cor do treino

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Editar ${escapeHtml(workoutName(id))}</h1>
        <small>Toque em Editar para abrir um exercício</small>
      </div>
    </div>`;

  state.plan[id].forEach((exercise, index) => {
    html += renderExerciseEditor(exercise, index, letter);
  });

  html += `<button class="primary btn-full" style="--accent: var(--color-${letter})" data-action="add-exercise">Adicionar exercício</button>`;
  return html;
}

/** Cartão de um exercício na edição: recolhido mostra o resumo; aberto mostra todos os campos. */
export function renderExerciseEditor(exercise, index, letter) {
  const id = exercise.id;
  const open = isPanelOpen('ed:' + id);
  const unitSuffix = exercise.u === 's' ? ' s' : '';

  let html = `
    <div class="card workout-${letter}">
      <div class="row row-flush">
        <div>
          <div class="exercise-name">${escapeHtml(exercise.n)}</div>
          <small>${exercise.s}×${escapeHtml(exercise.r)}${unitSuffix}</small>
        </div>
        <button class="btn-side" data-action="toggle-panel" data-value="ed:${escapeHtml(id)}" aria-expanded="${open}">${open ? 'Fechar' : 'Editar'}</button>
      </div>`;

  if (open) {
    html += `
      <input data-field="n" data-index="${index}" value="${escapeHtml(exercise.n)}" aria-label="Nome">
      <div class="row">
        <label>Séries<input type="number" inputmode="numeric" min="1" data-field="s" data-index="${index}" value="${exercise.s}"></label>
        <label>Faixa (ex.: 8-12)<input data-field="r" data-index="${index}" value="${escapeHtml(exercise.r)}"></label>
        <label>Medida
          <select data-field="u" data-index="${index}">
            <option value="rep"${exercise.u === 's' ? '' : ' selected'}>Repetições</option>
            <option value="s"${exercise.u === 's' ? ' selected' : ''}>Segundos</option>
          </select>
        </label>
      </div>`;

    html += renderSection('ed-how:' + id, 'Como executar',
      `<textarea class="field-text" data-field="d" data-index="${index}" placeholder="Passo a passo do movimento">${escapeHtml(exercise.d || '')}</textarea>`);
    html += renderSection('ed-tip:' + id, 'Dica',
      `<textarea class="field-text" data-field="t" data-index="${index}" placeholder="Uma dica curta (opcional)">${escapeHtml(exercise.t || '')}</textarea>`);
    html += renderSection('ed-alts:' + id, `Alternativas (${exercise.a.length})`, renderAlternativesEditor(exercise, index));

    const removeKey = ui.editingTreino + ':' + index;
    const confirming = ui.confirmingRemove === removeKey;
    html += `
      <div class="spacer-small"></div>
      <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="remove-exercise" data-index="${index}">
        ${confirming ? 'Confirmar: remover exercício' : 'Remover exercício'}
      </button>`;
  }

  return html + '</div>';
}

export function renderAlternativesEditor(exercise, index) {
  let html = '';
  exercise.a.forEach((alt, altIndex) => {
    html += `
      <div class="alt-editor">
        <input data-field="an" data-index="${index}" data-alt="${altIndex}" value="${escapeHtml(alt.n)}" aria-label="Nome da alternativa" placeholder="Nome da alternativa">
        <textarea class="field-text" data-field="ad" data-index="${index}" data-alt="${altIndex}" placeholder="Como executar a alternativa">${escapeHtml(alt.d || '')}</textarea>
        <button data-action="remove-alt" data-index="${index}" data-value="${altIndex}">Remover alternativa</button>
      </div>`;
  });
  html += `<button class="btn-full" data-action="add-alt" data-index="${index}">Adicionar alternativa</button>`;
  return html;
}

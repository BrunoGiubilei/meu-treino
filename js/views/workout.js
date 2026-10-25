/* =========================================================
   Meu Treino — Tela do treino em andamento.
   ========================================================= */

import { LOAD_STEP_KG } from '../config.js';
import { displayName, escapeHtml, formatNumber, getEntry, repsUpperBound, workoutColorKey, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { openPanels } from '../ui.js';
import { renderSection, renderStepper } from './components.js';

/** Informações do exercício (botão ℹ): um menu para cada informação. */
export function renderInfoPanel(exercise, entry) {
  const id = exercise.id;
  const alternative = entry.alt >= 0 ? exercise.a[entry.alt] : null;

  // a alternativa escolhida tem só a descrição; o exercício original tem descrição, dica e alternativas
  const how = alternative ? alternative.d : exercise.d;
  const tip = alternative ? '' : exercise.t;
  const others = alternative ? [] : exercise.a;

  let html = '<div class="info-box">';
  html += renderSection('how:' + id, 'Como executar', how ? escapeHtml(how) : '<small>Sem descrição.</small>');
  if (tip) {
    html += renderSection('tip:' + id, 'Dica', escapeHtml(tip));
  }
  if (others.length) {
    const list = others.map(alt => `<b>${escapeHtml(alt.n)}</b><br>${escapeHtml(alt.d || '')}`).join('<br><br>');
    html += renderSection('alt-info:' + id, `Alternativas (${others.length})`, list);
  }
  return html + '</div>';
}

export function renderExerciseCard(exercise, letter) {
  const entry = getEntry(exercise);
  const name = displayName(exercise, entry);
  const last = state.last[name];
  const isTimed = exercise.u === 's';
  const unitSuffix = isTimed ? ' s' : '';

  const lastText = last
    ? `Última vez: ${last.kg ? formatNumber(last.kg) + ' kg, ' : ''}${last.s}×${last.r}`
    : 'Sem registro ainda';

  let html = `
    <div class="card workout-${letter}${entry.skip ? ' skipped' : ''}">
      <div class="row row-flush">
        <div class="exercise-name">${escapeHtml(name)}</div>
        <button class="icon-button" data-action="info" data-id="${exercise.id}" aria-label="Como executar">ℹ</button>
      </div>
      <small>Meta ${exercise.s}×${escapeHtml(exercise.r)}${unitSuffix}. ${lastText}</small>`;

  if (openPanels['info:' + exercise.id]) {
    html += renderInfoPanel(exercise, entry);
  }

  if (!entry.skip) {
    // Sugestão de aumento: bateu o topo da faixa na última vez e a carga ainda é a mesma
    if (last && last.up && !isTimed && entry.kg === last.kg) {
      html += `
        <div class="suggestion">Você bateu o topo da faixa. Tente ${formatNumber(last.kg + LOAD_STEP_KG)} kg.<button data-action="apply-suggestion" data-id="${exercise.id}">Aplicar</button></div>`;
    }

    if (!isTimed) {
      html += renderStepper('Carga', exercise.id, 'kg', formatNumber(entry.kg) + ' kg');
    }
    html += renderStepper('Séries', exercise.id, 's', entry.s);
    html += renderStepper(isTimed ? 'Tempo' : 'Repetições', exercise.id, 'r', entry.r + unitSuffix);

    if (!isTimed && entry.kg > 0 && entry.r >= repsUpperBound(exercise)) {
      html += '<div class="top-reached">Topo da faixa atingido</div>';
    }

    // Lista para escolher o exercício alternativo
    if (openPanels['alts:' + exercise.id]) {
      const originalButton = `
        <button class="${entry.alt < 0 ? 'selected' : ''}" data-action="pick-alternative" data-id="${exercise.id}" data-value="-1">${escapeHtml(exercise.n)}</button>`;
      const alternativeButtons = exercise.a.map((alt, index) => `
        <button class="${entry.alt === index ? 'selected' : ''}" data-action="pick-alternative" data-id="${exercise.id}" data-value="${index}">${escapeHtml(alt.n)}</button>`).join('');
      html += `<div class="picker">${originalButton}${alternativeButtons}</div>`;
    }
  }

  // Botões "Trocar exercício" e "Pular"
  const canSwap = !entry.skip && exercise.a.length > 0;
  const swapButton = canSwap
    ? `<button data-action="toggle-alternatives" data-id="${exercise.id}">${openPanels['alts:' + exercise.id] ? 'Fechar opções' : 'Trocar exercício'}</button>`
    : '';
  html += `
      <div class="row">
        ${swapButton}
        <button data-action="toggle-skip" data-id="${exercise.id}">${entry.skip ? 'Incluir de novo' : 'Pular'}</button>
      </div>
    </div>`;

  return html;
}

export function renderWorkout() {
  const session = state.cur;
  const id = session.w;
  const letter = workoutColorKey(id);   // chave de cor do treino
  const description = state.treinos[id].desc;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>${escapeHtml(workoutName(id))}</h1>
        ${description ? `<small>${escapeHtml(description)}</small>` : ''}
      </div>
    </div>`;

  state.plan[id].forEach(exercise => {
    html += renderExerciseCard(exercise, letter);
  });

  // Cardio na esteira (os valores são guardados em session.cm e session.ck)
  html += `
    <div class="card workout-${letter}">
      <div class="exercise-name">Cardio na esteira</div>
      <div class="row">
        <label>Minutos<input type="number" inputmode="decimal" data-field="cm" value="${escapeHtml(session.cm)}"></label>
        <label>Velocidade (km/h)<input type="number" inputmode="decimal" data-field="ck" value="${escapeHtml(session.ck)}"></label>
      </div>
    </div>
    <button class="primary btn-full btn-finish" data-action="finish">Concluir treino</button>`;

  return html;
}

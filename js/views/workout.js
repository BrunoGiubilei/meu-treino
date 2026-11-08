/* =========================================================
   Meu Treino — Tela do treino em andamento.
   ========================================================= */

import { LOAD_STEPS } from '../config.js';
import { displayName, escapeHtml, formatNumber, getEntry, repsUpperBound, workoutColorKey, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { openPanels, ui } from '../ui.js';
import { renderStepper } from './components.js';

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

  if (!entry.skip) {
    // Sugestão de aumento: bateu o topo da faixa na última vez e a carga ainda é a mesma
    if (last && last.up && !isTimed && entry.kg === last.kg) {
      html += `
        <div class="suggestion">Você bateu o topo da faixa. Tente ${formatNumber(+(last.kg + ui.loadStep).toFixed(2))} kg.<button data-action="apply-suggestion" data-id="${exercise.id}">Aplicar</button></div>`;
    }

    if (!isTimed) {
      html += `
    <div class="stepper">
      <span>Carga (kg)</span>
      <button data-action="decrease" data-id="${exercise.id}" data-field="kg" aria-label="Diminuir ${formatNumber(ui.loadStep)} kg">−</button>
      <input class="kg-input" type="text" inputmode="decimal" autocomplete="off" data-field="kg" data-id="${exercise.id}" value="${formatNumber(entry.kg)}" aria-label="Carga em kg">
      <button data-action="increase" data-id="${exercise.id}" data-field="kg" aria-label="Aumentar ${formatNumber(ui.loadStep)} kg">+</button>
    </div>`;
    }
    html += renderStepper('Séries', exercise.id, 's', entry.s);
    html += renderStepper('Séries feitas', exercise.id, 'ds', `${Math.min(entry.ds || 0, entry.s)}/${entry.s}`);
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
    <div class="header workout-header">
      <button data-action="home" aria-label="Início">←</button>
      <div class="workout-header-title">
        <h1>${escapeHtml(workoutName(id))}</h1>
        ${description ? `<small>${escapeHtml(description)}</small>` : ''}
      </div>
      <span class="elapsed" role="timer" aria-label="Tempo de treino"><span class="js-elapsed">00:00</span></span>
    </div>`;

  // passo dos botões +/− de carga
  html += `
    <div class="load-step" role="group" aria-label="Passo da carga">
      <small>Passo da carga (kg)</small>
      ${LOAD_STEPS.map(step => `<button class="${step === ui.loadStep ? 'selected' : ''}" aria-pressed="${step === ui.loadStep}" data-action="set-load-step" data-value="${step}">${formatNumber(step)}</button>`).join('')}
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

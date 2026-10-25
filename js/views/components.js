/* =========================================================
   Meu Treino — Peças de HTML compartilhadas entre as telas.
   ========================================================= */

import { escapeHtml, formatNumber, isPanelOpen } from '../helpers.js';

/** Controle "− valor +". field = campo da entrada que o botão altera (kg, s ou r). */
export function renderStepper(label, exerciseId, field, valueText) {
  return `
    <div class="stepper">
      <span>${label}</span>
      <button data-action="decrease" data-id="${exerciseId}" data-field="${field}" aria-label="Diminuir">−</button>
      <b>${valueText}</b>
      <button data-action="increase" data-id="${exerciseId}" data-field="${field}" aria-label="Aumentar">+</button>
    </div>`;
}

export function formatHistoryLines(workout) {
  return workout.it.map(item => {
    const load = item.kg ? `${formatNumber(item.kg)} kg, ` : '';
    const unit = item.u === 's' ? ' s' : '';
    return `${escapeHtml(item.n)}: ${load}${item.s}×${item.r}${unit}`;
  }).join('<br>');
}

/** Menu recolhível: botão com o título e, quando aberto, o conteúdo logo abaixo. */
export function renderSection(key, title, bodyHtml, extraClass = '') {
  const open = isPanelOpen(key);
  return `
    <div class="section${extraClass ? ' ' + extraClass : ''}">
      <button class="section-toggle" data-action="toggle-panel" data-value="${escapeHtml(key)}" aria-expanded="${open}">
        <span>${title}</span><span aria-hidden="true">${open ? '▾' : '▸'}</span>
      </button>
      ${open ? `<div class="section-body">${bodyHtml}</div>` : ''}
    </div>`;
}

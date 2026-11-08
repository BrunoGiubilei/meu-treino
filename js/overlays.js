/* =========================================================
   Meu Treino — Folhas e diálogos (um único <dialog id="overlay">).

   - ui.sheet  -> folha de informações do exercício, com abas
                  (celular: sobe de baixo; desktop: abre pela lateral)
   - ui.dialog -> diálogo de confirmação (ex.: descartar treino)
   render() chama syncOverlay() no fim para abrir, atualizar ou fechar.
   ========================================================= */

import { $, displayName, escapeHtml, getEntry, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';

const TAB_TITLES = { how: 'Como executar', tip: 'Dica', alts: 'Alternativas' };

function currentExercise() {
  const session = state.cur;
  if (!session || !ui.sheet) return undefined;
  return (state.plan[session.w] || []).find(item => item.id === ui.sheet.id);
}

function renderSheet(exercise) {
  const entry = getEntry(exercise);
  const alternative = entry.alt >= 0 ? exercise.a[entry.alt] : null;

  // abas que existem para este exercício
  const tabs = ['how'];
  if (exercise.t && !alternative) tabs.push('tip');
  if (exercise.a.length) tabs.push('alts');
  const tab = tabs.includes(ui.sheet.tab) ? ui.sheet.tab : 'how';

  let body = '';
  if (tab === 'how') {
    const how = alternative ? alternative.d : exercise.d;
    body = how ? `<p>${escapeHtml(how)}</p>` : '<p class="muted">Sem descrição.</p>';
  } else if (tab === 'tip') {
    body = `<p>${escapeHtml(exercise.t)}</p>`;
  } else {
    const option = (name, description, value) => `
      <div class="sheet-option">
        <div>
          <b>${escapeHtml(name)}</b>
          ${description ? `<div class="muted">${escapeHtml(description)}</div>` : ''}
        </div>
        ${entry.alt === value
          ? '<span class="chip-inuse">Em uso</span>'
          : `<button data-action="pick-alternative" data-id="${exercise.id}" data-value="${value}">Usar</button>`}
      </div>`;
    body = option(exercise.n, exercise.d, -1)
      + exercise.a.map((alt, index) => option(alt.n, alt.d, index)).join('');
  }

  return `
    <div class="overlay-head">
      <h2 id="overlay-title">${escapeHtml(displayName(exercise, entry))}</h2>
      <button class="icon-button" data-action="overlay-close" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-tabs" role="tablist">
      ${tabs.map(key => `<button role="tab" aria-selected="${key === tab}" class="${key === tab ? 'selected' : ''}" data-action="sheet-tab" data-value="${key}">${TAB_TITLES[key]}</button>`).join('')}
    </div>
    <div class="sheet-body">${body}</div>`;
}

function renderDiscard() {
  const name = state.cur ? workoutName(state.cur.w) : 'o treino';
  return `
    <h2 id="overlay-title">Descartar treino?</h2>
    <p>${escapeHtml(name)} em andamento será apagado e nada vai para o histórico.</p>
    <div class="overlay-actions">
      <button data-action="overlay-close">Cancelar</button>
      <button class="danger" data-action="discard-confirm">Descartar</button>
    </div>`;
}

/** Abre, atualiza ou fecha o <dialog> conforme ui.sheet e ui.dialog. */
export function syncOverlay() {
  const dialog = $('#overlay');
  if (!dialog) return;

  let kind = '';
  let html = '';
  if (ui.dialog === 'discard' && state.cur) {
    kind = 'confirm';
    html = renderDiscard();
  } else {
    const exercise = currentExercise();
    if (exercise) {
      kind = 'sheet';
      html = renderSheet(exercise);
    }
  }

  if (!kind) {
    ui.sheet = null;
    ui.dialog = '';
    if (dialog.open) dialog.close();
    return;
  }

  dialog.className = 'overlay ' + kind;
  dialog.setAttribute('aria-labelledby', 'overlay-title');
  dialog.innerHTML = html;
  if (!dialog.open) dialog.showModal();
}

/** Esc, botão voltar do sistema ou toque fora fecham a folha/diálogo. */
export function bindOverlay() {
  const dialog = $('#overlay');
  if (!dialog) return;
  dialog.addEventListener('close', () => {
    ui.sheet = null;
    ui.dialog = '';
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
}

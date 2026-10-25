/* =========================================================
   Meu Treino — Tela inicial.
   ========================================================= */

import { cloud, describeState, getToken, syncLabel } from '../cloud.js';
import { HISTORY_SHOWN, WEEKLY_GOAL } from '../config.js';
import { countWorkoutsThisWeek, escapeHtml, historyColorKey, historyName, isPanelOpen, nextWorkoutIn, unassignedWorkouts, workoutColorKey, workoutName } from '../helpers.js';
import { state } from '../state.js';
import { ui } from '../ui.js';
import { formatHistoryLines, renderSection } from './components.js';

export function renderHistoryItem(workout) {
  const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

  const lines = formatHistoryLines(workout);

  let cardio = '';
  if (workout.cm) {
    const speed = workout.ck ? ` a ${escapeHtml(workout.ck)} km/h` : '';
    cardio = `<br>Esteira: ${escapeHtml(workout.cm)} min${speed}`;
  }

  return `
    <details class="card workout-${historyColorKey(workout)}">
      <summary><b>${escapeHtml(historyName(workout))}</b> em ${date}, ${workout.m} min</summary>
      <small>${lines}${cardio}</small>
    </details>`;
}

export function renderBackupPanel() {
  return `
    <div class="card">
      <small>Os dados ficam só neste navegador. Gere o backup, copie o texto e guarde numa nota ou mensagem para você mesmo.</small>
      <div class="row">
        <button data-action="export-backup">Gerar backup</button>
        <button data-action="copy-backup">Copiar</button>
      </div>
      <textarea id="backup-output" readonly>${escapeHtml(ui.backupText)}</textarea>
      <div class="spacer-small"></div>
      <small>Para restaurar, cole o texto aqui:</small>
      <textarea id="backup-input"></textarea>
      <div class="row">
        <button class="primary" data-action="import-backup">Restaurar backup</button>
      </div>
    </div>`;
}

/** Painel para conectar (token) e sincronizar manualmente. */
export function renderSyncPanel() {
  const connected = getToken() && cloud.status !== 'auth';
  const controls = connected
    ? `<div class="row">
         <button data-action="sync-now">Sincronizar agora</button>
         <button data-action="sync-disconnect">Desconectar</button>
       </div>`
    : `<input type="password" id="sync-token" placeholder="Cole o token aqui" autocomplete="off">
       <div class="row">
         <button class="primary" data-action="sync-connect">Conectar</button>
       </div>`;
  return `
    <div class="card">
      <small>Guarda uma cópia dos dados na nuvem para usar em mais de um aparelho. O token fica só neste aparelho e não entra no backup.</small>
      <div class="spacer-small"></div>
      ${controls}
    </div>`;
}

/** Cartão mostrado quando este aparelho e a nuvem têm dados diferentes. */
export function renderSyncConflict() {
  const remote = cloud.conflict.remote;
  const title = remote ? 'Dados diferentes na nuvem' : 'A nuvem ainda está vazia';
  const useRemoteLabel = ui.confirmingSync === 'remote'
    ? 'Confirmar: trocar os dados deste aparelho'
    : 'Usar os dados da nuvem';
  const keepLocalLabel = !remote
    ? 'Enviar os dados deste aparelho'
    : ui.confirmingSync === 'local'
      ? 'Confirmar: substituir a nuvem'
      : 'Manter os deste aparelho';

  return `
    <div class="card">
      <b>${title}</b>
      <div><small>Este aparelho: ${describeState(state)}</small></div>
      <div><small>Nuvem: ${remote ? describeState(remote.state) : 'vazia'}</small></div>
      <div class="row">
        ${remote ? `<button data-action="sync-use-remote">${useRemoteLabel}</button>` : ''}
        <button class="primary" data-action="sync-keep-local">${keepLocalLabel}</button>
      </div>
    </div>`;
}

/** Uma ficha: menu com os cartões dos seus treinos e os botões de adicionar/editar. */
export function renderFicha(ficha) {
  const ids = ficha.treinos.filter(id => state.plan[id]);
  const next = nextWorkoutIn(ficha);

  let body = ids.length
    ? ids.map(id => renderWorkoutCard(id, id === next)).join('')
    : '<small>Nenhum treino nesta ficha ainda.</small>';

  body += `
    <div class="row">
      <button data-action="add-treino" data-value="${escapeHtml(ficha.id)}">Adicionar treino</button>
      <button data-action="ficha-edit" data-value="${escapeHtml(ficha.id)}">Editar ficha</button>
    </div>`;

  return renderSection('ficha:' + ficha.id, `${escapeHtml(ficha.nome)} (${ids.length})`, body, 'section-ficha');
}

/** Cartão de um treino na tela inicial: iniciar e menu ⋯. */
export function renderWorkoutCard(id, isNext) {
  const treino = state.treinos[id];
  const nextTag = isNext ? '<span class="tag">próximo</span>' : '';
  const count = state.plan[id].length;
  const summary = [treino.desc, `${count} ${count === 1 ? 'exercício' : 'exercícios'}`]
    .filter(Boolean).map(escapeHtml).join(', ');
  const menuOpen = isPanelOpen('menu:' + id);
  const safeId = escapeHtml(id);

  return `
    <div class="card workout-${workoutColorKey(id)}">
      <div class="exercise-name">${escapeHtml(treino.nome)} ${nextTag}</div>
      <small>${summary}</small>
      <div class="row">
        <button class="primary" data-action="start" data-value="${safeId}">Iniciar treino</button>
        <button class="icon-button" data-action="toggle-panel" data-value="menu:${safeId}" aria-label="Mais opções de ${escapeHtml(treino.nome)}" aria-expanded="${menuOpen}">⋯</button>
      </div>
      ${menuOpen ? `
      <div class="menu">
        <button data-action="edit" data-value="${safeId}">Editar lista de exercícios</button>
        <button data-action="treino-edit" data-value="${safeId}">Configurar treino</button>
      </div>` : ''}
    </div>`;
}

export function renderHome() {
  const session = state.cur;

  let html = `
    <h1>Meu treino</h1>
    <small>${countWorkoutsThisWeek()} de ${WEEKLY_GOAL} treinos nesta semana</small>
    <div><small id="sync-status">${escapeHtml(syncLabel())}</small></div>
    <div class="spacer"></div>`;

  // Dados diferentes entre este aparelho e a nuvem: precisa escolher
  if (cloud.conflict) html += renderSyncConflict();

  // Aviso de treino em andamento
  if (session) {
    html += `
      <div class="card workout-${workoutColorKey(session.w)}">
        <b>${escapeHtml(workoutName(session.w))} em andamento</b>
        <div class="row">
          <button class="primary" data-action="continue">Continuar</button>
          <button data-action="discard">${ui.confirmingDiscard ? 'Confirmar descarte' : 'Descartar'}</button>
        </div>
      </div>`;
  }

  // Fichas, cada uma com os seus treinos
  state.fichas.forEach(ficha => {
    html += renderFicha(ficha);
  });

  // Treinos que não estão em nenhuma ficha
  const loose = unassignedWorkouts();
  if (loose.length) {
    html += renderSection('ficha:_sem', `Sem ficha (${loose.length})`,
      loose.map(id => renderWorkoutCard(id, false)).join(''), 'section-ficha');
  }

  html += '<button class="btn-full" data-action="add-ficha">Nova ficha</button>';

  // Histórico
  html += '<h2>Histórico</h2>';
  if (!state.hist.length) {
    html += '<small>Nenhum treino concluído ainda. Inicie o treino do dia.</small>';
  }
  state.hist.slice(0, HISTORY_SHOWN).forEach(workout => {
    html += renderHistoryItem(workout);
  });
  if (state.hist.length) {
    html += '<button class="btn-full" data-action="history">Ver e editar histórico</button>';
  }

  // Mais: nuvem e backup num menu só
  const more =
    renderSection('sync', 'Nuvem e sincronização', renderSyncPanel()) +
    renderSection('backup', 'Backup e restauração', renderBackupPanel());
  html += '<div class="spacer"></div>' + renderSection('more', 'Mais', more);

  return html;
}

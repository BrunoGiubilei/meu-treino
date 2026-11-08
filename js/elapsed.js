/* =========================================================
   Meu Treino — Tempo decorrido do treino (cabeçalho da tela do treino).
   Atualiza só o texto, sem redesenhar a tela.
   ========================================================= */

import { state } from './state.js';

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/** Escreve o tempo em todo elemento .js-elapsed (se houver treino em andamento). */
export function updateElapsed() {
  if (!state.cur) return;
  const text = formatElapsed(Date.now() - state.cur.st);
  document.querySelectorAll('.js-elapsed').forEach(element => { element.textContent = text; });
}

export function startElapsed() {
  setInterval(updateElapsed, 1000);
}

/* =========================================================
   Meu Treino — Páginas do menu: Nuvem, Backup e Aparência.
   (O conteúdo de Nuvem e Backup é o mesmo que ficava no menu "Mais" da tela inicial.)
   ========================================================= */

import { cloud, syncLabel } from '../cloud.js';
import { escapeHtml } from '../helpers.js';
import { icon } from '../icons.js';
import { getTheme } from '../theme.js';
import { renderBackupPanel, renderSyncConflict, renderSyncPanel } from './home.js';

export function renderCloudPage() {
  let html = `
    <h1 class="sr-only">Nuvem</h1>
    <h2>Sincronização</h2>
    <small id="sync-status">${escapeHtml(syncLabel())}</small>
    <div class="spacer-small"></div>`;
  if (cloud.conflict) html += renderSyncConflict();
  html += renderSyncPanel();
  return html;
}

export function renderBackupPage() {
  return `
    <h1 class="sr-only">Backup</h1>
    <h2>Backup e restauração</h2>
    ${renderBackupPanel()}`;
}

const THEME_OPTIONS = [
  { value: 'auto', label: 'Automático', icon: 'brightness_auto' },
  { value: 'light', label: 'Claro', icon: 'light_mode' },
  { value: 'dark', label: 'Escuro', icon: 'dark_mode' },
];

export function renderAppearancePage() {
  const current = getTheme();
  const buttons = THEME_OPTIONS.map(option => {
    const selected = option.value === current;
    return `
      <button class="segmented-button${selected ? ' selected' : ''}" data-action="set-theme" data-value="${option.value}" aria-pressed="${selected}">
        ${icon(option.icon, selected ? 'filled' : 'outlined')}<span>${option.label}</span>
      </button>`;
  }).join('');

  return `
    <h1 class="sr-only">Aparência</h1>
    <h2>Tema</h2>
    <div class="card">
      <div class="segmented" role="group" aria-label="Tema">${buttons}</div>
      <div class="spacer-small"></div>
      <small>Automático segue o tema do aparelho. A escolha vale só para este aparelho.</small>
    </div>
    <h2>Sobre</h2>
    <div class="card">
      <b>Meu Treino</b>
      <div><small>Versão: <span class="js-version">…</span></small></div>
      <div><small class="js-version-note" hidden></small></div>
    </div>`;
}

/* =========================================================
   Meu Treino — Tema claro / escuro / automático

   A escolha fica só neste aparelho (localStorage, chave THEME_KEY):
   não entra no state, no backup nem na nuvem.
   O index.html aplica o tema salvo antes de desenhar a página (evita piscar);
   aqui ficam a leitura, a troca e a cor da barra do navegador (theme-color).
   ========================================================= */

import { THEME_KEY } from './config.js';

const MODES = ['auto', 'light', 'dark'];

/** Tema escolhido: 'auto' (segue o aparelho), 'light' ou 'dark'. */
export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (MODES.includes(saved)) return saved;
  } catch (error) {
    // armazenamento bloqueado: usa o automático
  }
  return 'auto';
}

/** Guarda a escolha e aplica na hora. */
export function setTheme(mode) {
  if (!MODES.includes(mode)) return;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch (error) {
    // armazenamento cheio ou bloqueado: vale só até fechar o app
  }
  applyTheme(mode);
}

/** Coloca o tema no <html> (o CSS decide as cores) e ajusta a cor da barra do navegador. */
export function applyTheme(mode = getTheme()) {
  document.documentElement.dataset.theme = mode;
  updateThemeColorMeta();
}

function updateThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface').trim();
  if (color) meta.setAttribute('content', color);
}

/** Chamado uma vez ao abrir: aplica o tema e acompanha o tema do aparelho no modo automático. */
export function initTheme() {
  applyTheme();
  if (!window.matchMedia) return;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (getTheme() === 'auto') updateThemeColorMeta(); };
  if (query.addEventListener) query.addEventListener('change', onChange);
}

/* =========================================================
   Meu Treino — Casca do app (navegação e barra superior)

   Mesmo conjunto de destinos em dois lugares; o CSS escolhe qual aparece:
   - celular (< 600 px): barra de navegação embaixo (#bottom-nav);
   - tablet (600–839 px): navigation rail à esquerda (#side-nav);
   - desktop (≥ 840 px): navigation drawer permanente à esquerda (#side-nav).
   Os itens são links (#/rota): o roteador (router.js) cuida da troca de tela.
   ========================================================= */

import { $ } from './helpers.js';
import { iconPair } from './icons.js';

export const DESTINATIONS = [
  { id: 'treinos', label: 'Treinos', hash: '#/treinos', icon: 'fitness_center' },
  { id: 'historico', label: 'Histórico', hash: '#/historico', icon: 'history' },
  { id: 'nuvem', label: 'Nuvem', hash: '#/nuvem', icon: 'cloud' },
  { id: 'backup', label: 'Backup', hash: '#/backup', icon: 'save' },
  { id: 'aparencia', label: 'Aparência', hash: '#/aparencia', icon: 'palette' },
];

// título da barra superior em cada tela
const TITLES = {
  home: 'Treinos',
  workout: 'Treino em andamento',
  edit: 'Editar lista',
  'treino-edit': 'Configurar treino',
  'ficha-edit': 'Editar ficha',
  history: 'Histórico',
  'history-edit': 'Editar treino',
  cloud: 'Nuvem',
  backup: 'Backup',
  appearance: 'Aparência',
};

// a qual destino do menu cada tela pertence (para marcar o item ativo)
const DESTINATION_OF = {
  home: 'treinos',
  workout: 'treinos',
  edit: 'treinos',
  'treino-edit': 'treinos',
  'ficha-edit': 'treinos',
  history: 'historico',
  'history-edit': 'historico',
  cloud: 'nuvem',
  backup: 'backup',
  appearance: 'aparencia',
};

function itemHtml(destination) {
  return `<a class="nav-item" href="${destination.hash}" data-dest="${destination.id}">` +
    `<span class="nav-indicator">${iconPair(destination.icon)}</span>` +
    `<span class="nav-label">${destination.label}</span></a>`;
}

/** Monta os menus (uma vez, ao abrir). Só texto fixo entra aqui, nada vindo dos dados. */
export function mountShell() {
  $('#bottom-nav').innerHTML = DESTINATIONS.map(itemHtml).join('');
  $('#side-nav-list').innerHTML = DESTINATIONS.map(destination => `<li>${itemHtml(destination)}</li>`).join('');

  // "Pular para o conteúdo" não pode ser um link #: o # é usado pelas rotas
  $('#skip-link').addEventListener('click', () => $('#app').focus());
}

/** Atualiza título, item ativo e o modo "treino em andamento" (esconde a barra de baixo). */
export function updateShell(view) {
  const destination = DESTINATION_OF[view];
  document.querySelectorAll('.nav-item').forEach(link => {
    if (link.dataset.dest === destination) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const title = TITLES[view] || 'Meu Treino';
  $('#appbar-title').textContent = title;
  document.title = title + ' · Meu Treino';
  document.body.classList.toggle('in-workout', view === 'workout');
}

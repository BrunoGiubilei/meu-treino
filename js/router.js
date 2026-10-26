/* =========================================================
   Meu Treino — Rotas por hash (#/treinos, #/historico...)

   Cada tela tem um endereço; assim o botão "voltar" do celular e do navegador
   funciona, e recarregar a página abre a mesma tela. As rotas só dizem QUAL tela
   (e qual treino/ficha); os dados continuam em state e as variáveis de tela em ui.

     #/treinos            tela inicial          #/historico        lista do histórico
     #/andamento          treino em andamento   #/historico/<d>    editar treino do histórico
     #/editar/<id>        lista de exercícios   #/nuvem            sincronização
     #/configurar/<id>    configurar treino     #/backup           backup e restauração
     #/ficha/<id>         editar ficha          #/aparencia        tema e versão
   ========================================================= */

import { HISTORY_PAGE } from './config.js';
import { effectiveView, findFicha, findHistoryWorkout } from './helpers.js';
import { state } from './state.js';
import { ui } from './ui.js';

/** O endereço que corresponde à tela atual. */
export function currentHash() {
  const view = effectiveView();
  switch (view) {
    case 'workout': return '#/andamento';
    case 'edit': return '#/editar/' + encodeURIComponent(ui.editingTreino);
    case 'treino-edit': return '#/configurar/' + encodeURIComponent(ui.editingTreino);
    case 'ficha-edit': return '#/ficha/' + encodeURIComponent(ui.editingFicha);
    case 'history': return '#/historico';
    case 'history-edit': return '#/historico/' + ui.editingWorkoutD;
    case 'cloud': return '#/nuvem';
    case 'backup': return '#/backup';
    case 'appearance': return '#/aparencia';
    default: return '#/treinos';
  }
}

/** Os "1º toque" de confirmação não devem sobreviver a uma troca de tela. */
function resetConfirmations() {
  ui.confirmingDiscard = false;
  ui.confirmingHistoryDelete = false;
  ui.confirmingRemove = '';
  ui.confirmingDelete = '';
  ui.confirmingSync = '';
}

/**
 * Coloca em ui a tela que o endereço pede. Devolve false se o endereço não existe
 * ou aponta para algo que não existe mais (nesse caso fica na tela inicial).
 */
export function applyRoute(hash) {
  resetConfirmations();
  const match = /^#\/([^/]+)(?:\/(.+))?$/.exec(hash || '');
  const name = match ? match[1] : '';
  let param = '';
  try {
    param = match && match[2] ? decodeURIComponent(match[2]) : '';
  } catch (error) {
    param = '';
  }

  switch (name) {
    case 'treinos':
      ui.currentView = 'home';
      return true;
    case 'andamento':
      if (state.cur && state.plan[state.cur.w]) {
        ui.currentView = 'workout';
        return true;
      }
      break;
    case 'editar':
      if (state.plan[param] && state.treinos[param]) {
        ui.editingTreino = param;
        ui.currentView = 'edit';
        return true;
      }
      break;
    case 'configurar':
      if (state.treinos[param]) {
        ui.editingTreino = param;
        ui.currentView = 'treino-edit';
        return true;
      }
      break;
    case 'ficha':
      if (findFicha(param)) {
        ui.editingFicha = param;
        ui.currentView = 'ficha-edit';
        return true;
      }
      break;
    case 'historico':
      if (!param) {
        ui.currentView = 'history';
        return true;
      }
      if (findHistoryWorkout(+param)) {
        ui.editingWorkoutD = +param;
        ui.currentView = 'history-edit';
        return true;
      }
      ui.currentView = 'history';
      return false;
    case 'nuvem':
      ui.currentView = 'cloud';
      return true;
    case 'backup':
      ui.currentView = 'backup';
      return true;
    case 'aparencia':
      ui.currentView = 'appearance';
      return true;
    default:
      break;
  }

  ui.currentView = 'home';
  return false;
}

function replaceHash(hash) {
  try {
    history.replaceState(null, '', location.pathname + location.search + hash);
  } catch (error) {
    // sem suporte: segue sem corrigir o endereço
  }
}

/**
 * Depois de uma ação que mudou de tela, põe o endereço novo no histórico do navegador.
 * (Se o endereço já é o certo, não faz nada.)
 */
export function syncHash() {
  const wanted = currentHash();
  if (location.hash !== wanted) location.hash = wanted;
}

/** Liga o roteador: lê o endereço de abertura e reage a "voltar/avançar" e a cliques no menu. */
export function startRouter(renderScreen) {
  if (location.hash) {
    if (!applyRoute(location.hash)) replaceHash(currentHash());
  } else {
    replaceHash(currentHash());
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === currentHash()) return;   // foi o próprio app que mudou o endereço
    ui.historyShown = HISTORY_PAGE;
    if (!applyRoute(location.hash)) replaceHash(currentHash());
    renderScreen();
  });
}

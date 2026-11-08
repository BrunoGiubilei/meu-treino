/* =========================================================
   Meu Treino — Estado só da tela (não é salvo).
   ========================================================= */

import { HISTORY_PAGE, LOAD_STEP_KEY, LOAD_STEP_KG, LOAD_STEPS } from './config.js';

function readLoadStep() {
  try {
    const saved = +localStorage.getItem(LOAD_STEP_KEY);
    if (LOAD_STEPS.includes(saved)) return saved;
  } catch (error) {
    // armazenamento bloqueado: usa o padrão
  }
  return LOAD_STEP_KG;
}

// Estado só da tela (não é salvo). Fica num objeto porque módulos não podem
// reatribuir variáveis importadas; quem muda a tela escreve em ui.<campo>.
export const ui = {
  currentView: 'home',          // 'home' | 'workout' | 'edit' | 'treino-edit' | 'ficha-edit' | 'history' | 'history-edit'
  editingTreino: '',            // id do treino aberto na edição da lista ou nas configurações
  editingFicha: '',             // id da ficha aberta na tela de edição da ficha
  confirmingDelete: '',         // 1º toque em "Remover treino/ficha" já foi dado (guarda qual)
  editingWorkoutD: null,        // data (d) do treino do histórico aberto para edição
  historyShown: HISTORY_PAGE,   // quantos treinos a lista do histórico mostra agora
  confirmingHistoryDelete: false, // 1º toque em "Apagar este treino" já foi dado
  confirmingRemove: '',         // 1º toque em "Remover exercício" já foi dado (guarda qual)
  confirmingDiscard: false,     // true depois do 1º toque em "Descartar"
  backupText: '',               // texto do backup gerado
  loadStep: readLoadStep(),     // passo atual dos botões +/− de carga (kg)
  sheet: null,                  // { id, tab }: folha de informações do exercício aberta (tab: 'how' | 'tip' | 'alts')
  dialog: '',                   // diálogo de confirmação aberto ('discard' ou '')
  restEndsAt: 0,                // horário (ms) em que o descanso termina
  restInterval: null,           // intervalo que atualiza o cronômetro
  toastTimeout: null,
  confirmingSync: '',           // '' | 'remote' | 'local': 1º toque numa escolha de sincronização
};

// menus/painéis abertos: 'info:ID', 'how:ID', 'ed:ID', 'menu:A', 'more', 'sync', 'backup'...
export const openPanels = {};

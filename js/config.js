/* =========================================================
   Meu Treino — Configurações e constantes do app.
   ========================================================= */

export const STORAGE_KEY = 'treino_v1';
export const LEGACY_IDS = ['A', 'B', 'C'];    // treinos originais (usados para converter dados antigos)
export const COLOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];   // cores disponíveis para os treinos (ver style.css)
export const WEEKLY_GOAL = 3;            // meta de treinos por semana
export const MAX_HISTORY = 200;          // quantos treinos ficam guardados
export const HISTORY_SHOWN = 12;         // quantos aparecem na tela inicial
export const HISTORY_PAGE = 30;          // quantos treinos a tela de histórico mostra por vez
export const LOAD_STEP_KG = 1;           // passo dos botões +/− de carga (e da sugestão de aumento)
export const HOLD_STEP_SECONDS = 5;      // passo do tempo em exercícios como a prancha
export const DEFAULT_REPS_LOW = 8;       // usado se a faixa de repetições não puder ser lida
export const TOAST_DURATION_MS = 2800;

// Nuvem (Cloudflare Worker). Troque pelo endereço do seu Worker, sem "/" no final.
export const API_URL = 'https://api.bruno-treino.workers.dev';
export const TOKEN_KEY = 'treino_token';        // token da API (fica só neste aparelho, fora do backup)
export const SYNC_META_KEY = 'treino_sync';     // { rev, dirty } — controle da sincronização
export const SAFETY_COPY_KEY = 'treino_copia_antes_sync'; // cópia local guardada antes de trocar pelos dados da nuvem
export const THEME_KEY = 'treino_tema';          // 'auto' | 'light' | 'dark' (só deste aparelho, fora do backup e da nuvem)
export const SYNC_DELAY_MS = 1500;              // espera depois da última mudança antes de enviar

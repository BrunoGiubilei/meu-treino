/* =========================================================
   Meu Treino — lógica do aplicativo

   Organização do arquivo:
     1. Configurações
     2. Treinos padrão (a lista de exercícios que vem de fábrica)
     3. Estado do app e armazenamento (localStorage)
     4. Funções auxiliares
     5. Telas (início, treino, edição)
     6. Cronômetro de descanso
     7. Ações dos botões
     8. Sincronização com a nuvem (Cloudflare Worker + D1)
     9. Inicialização e Service Worker

   FORMATO DOS DADOS SALVOS (state)
   Os nomes curtos abaixo são os que já estão salvos no celular e
   nos backups. NÃO renomeie estes campos, senão os dados antigos
   deixam de funcionar.

     state = {
       plan: { A: [exercício...], B: [...], C: [...] },
       hist: [treino concluído...],   // o mais recente primeiro
       last: { 'Nome do exercício': { kg, s, r, up } },
       cur:  treino em andamento, ou null
     }

     exercício       = { id, n: nome, s: séries, r: faixa de repetições,
                         d: como executar, t: dica,
                         a: [{ n, d }] alternativas,
                         u: 'rep' (repetições) ou 's' (segundos) }
     treino em curso = { w: letra, st: início (ms), cm: min de esteira,
                         ck: km/h da esteira, it: { [idExercício]: entrada } }
     entrada         = { alt: índice da alternativa (-1 = original),
                         kg, s, r, skip: true se foi pulado }
     histórico       = { d: data (ms), w: letra, m: duração (min),
                         it: [{ n, kg, s, r, u }], cm, ck }
     last[nome]      = última carga usada; up = true se bateu o topo da faixa
   ========================================================= */

'use strict';


/* =========================================================
   1. Configurações
   ========================================================= */
const STORAGE_KEY = 'treino_v1';
const WORKOUT_LETTERS = ['A', 'B', 'C'];
const WEEKLY_GOAL = 3;            // meta de treinos por semana
const MAX_HISTORY = 200;          // quantos treinos ficam guardados
const HISTORY_SHOWN = 12;         // quantos aparecem na tela inicial
const HISTORY_PAGE = 30;          // quantos treinos a tela de histórico mostra por vez
const LOAD_STEP_KG = 1;           // passo dos botões +/− de carga (e da sugestão de aumento)
const HOLD_STEP_SECONDS = 5;      // passo do tempo em exercícios como a prancha
const DEFAULT_REPS_LOW = 8;       // usado se a faixa de repetições não puder ser lida
const TOAST_DURATION_MS = 2800;

// Nuvem (Cloudflare Worker). Troque pelo endereço do seu Worker, sem "/" no final.
const API_URL = 'https://api.bruno-treino.workers.dev';
const TOKEN_KEY = 'treino_token';        // token da API (fica só neste aparelho, fora do backup)
const SYNC_META_KEY = 'treino_sync';     // { rev, dirty } — controle da sincronização
const SAFETY_COPY_KEY = 'treino_copia_antes_sync'; // cópia local guardada antes de trocar pelos dados da nuvem
const SYNC_DELAY_MS = 1500;              // espera depois da última mudança antes de enviar


/* =========================================================
   2. Treinos padrão
   Para mudar a lista de fábrica, edite aqui.
   ATENÇÃO: isto só vale para quem ainda não tem dados salvos.
   Quem já usa o app edita a lista pela tela "Editar lista".

   Campos de cada exercício:
     name         nome
     sets         número de séries
     reps         faixa de repetições (ex.: '8-12') ou de segundos
     howTo        como executar
     tip          dica de postura/segurança
     alternatives exercícios que podem substituir este
     unit         opcional: 's' para exercícios medidos em segundos
   ========================================================= */
const DEFAULT_WORKOUTS = {
  A: {
    title: 'Pernas e core',
    exercises: [
      {
        name: 'Leg press 45°',
        sets: 3,
        reps: '8-12',
        howTo: 'Sente com costas e quadril bem apoiados, pés na largura dos ombros. Desça controlando até cerca de 90° nos joelhos e empurre sem travar no topo.',
        tip: 'Não deixe o quadril descolar do banco nem os joelhos caírem para dentro.',
        alternatives: [
          { name: 'Agachamento goblet', howTo: 'Halter junto ao peito, desça com o tronco ereto e suba empurrando o chão.' },
          { name: 'Agachamento no Smith', howTo: 'Pés um pouco à frente da barra, desça até cerca de 90° e suba controlando.' },
        ],
      },
      {
        name: 'Stiff com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Em pé, halteres à frente das coxas. Leve o quadril para trás com joelhos levemente flexionados e desça até sentir alongar atrás da coxa. Suba contraindo o glúteo.',
        tip: 'Costas retas o tempo todo e halteres rentes às pernas.',
        alternatives: [
          { name: 'Stiff na barra', howTo: 'Mesma execução, com a barra deslizando rente às pernas.' },
          { name: 'Stiff no Smith', howTo: 'Mesma execução, com a barra guiada; bom para aprender o movimento.' },
        ],
      },
      {
        name: 'Cadeira extensora',
        sets: 3,
        reps: '12-15',
        howTo: 'Ajuste o encosto para o joelho alinhar com o eixo da máquina. Estenda as pernas até quase travar e desça em 2 a 3 segundos.',
        tip: 'Sem impulso; faça uma pausa curta no topo.',
        alternatives: [
          { name: 'Afundo com halteres', howTo: 'Passo à frente, desça o joelho de trás quase ao chão e empurre de volta.' },
          { name: 'Step-up no banco', howTo: 'Suba no banco empurrando com a perna da frente, sem impulso da de trás.' },
        ],
      },
      {
        name: 'Mesa flexora',
        sets: 3,
        reps: '12-15',
        howTo: 'Deitado de bruços, joelhos na borda do banco e rolete sobre o calcanhar. Leve o calcanhar ao glúteo e volte devagar.',
        tip: 'Quadril colado ao banco, sem arquear a lombar.',
        alternatives: [
          { name: 'Cadeira flexora', howTo: 'Sentado, prenda as coxas e puxe o rolete para baixo e para trás.' },
          { name: 'Flexora em pé', howTo: 'Em pé na máquina, flexione uma perna por vez sem balançar o corpo.' },
        ],
      },
      {
        name: 'Panturrilha em pé',
        sets: 3,
        reps: '12-15',
        howTo: 'Ombros sob o apoio, pontas dos pés na plataforma. Suba o máximo possível, pause 1 segundo e desça alongando bem.',
        tip: 'Amplitude completa vale mais que carga.',
        alternatives: [
          { name: 'Panturrilha sentado', howTo: 'Joelhos a 90° sob o apoio; suba nas pontas e desça alongando.' },
          { name: 'Panturrilha no leg press', howTo: 'Só as pontas dos pés na plataforma; empurre e volte alongando.' },
        ],
      },
      {
        name: 'Prancha',
        sets: 3,
        reps: '30-45',
        howTo: 'Apoie antebraços e pontas dos pés, corpo em linha reta. Contraia abdômen e glúteos e respire normalmente.',
        tip: 'Quadril nem alto nem caído; pare se a lombar doer.',
        alternatives: [
          { name: 'Prancha lateral', howTo: 'De lado sobre um antebraço, corpo reto; troque de lado na série seguinte.' },
          { name: 'Abdominal na máquina', howTo: 'Contraia o abdômen para flexionar o tronco, sem puxar com os braços.' },
        ],
        unit: 's',
      },
    ],
  },

  B: {
    title: 'Empurrar: peito, ombro e tríceps',
    exercises: [
      {
        name: 'Supino reto com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Deitado, halteres na altura do peito, escápulas juntas e pés firmes. Empurre aproximando os halteres no alto e desça controlando.',
        tip: 'Cotovelos a cerca de 45° do tronco, sem arquear demais a lombar.',
        alternatives: [
          { name: 'Chest press (máquina)', howTo: 'Ajuste o banco para as pegadas ficarem na altura do peito e empurre sem travar os cotovelos.' },
          { name: 'Flexão de braço', howTo: 'Mãos na largura dos ombros, corpo reto; apoie os joelhos se precisar.' },
        ],
      },
      {
        name: 'Supino inclinado com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Banco a 30° a 45°. Empurre os halteres para cima e levemente para dentro, descendo até a linha do peito.',
        tip: 'Não suba demais o banco, senão vira exercício de ombro.',
        alternatives: [
          { name: 'Supino inclinado na máquina', howTo: 'Mesma ideia, com trajetória guiada.' },
          { name: 'Supino inclinado no Smith', howTo: 'Banco inclinado sob a barra; desça até o peito alto e empurre.' },
        ],
      },
      {
        name: 'Desenvolvimento com halteres',
        sets: 3,
        reps: '8-12',
        howTo: 'Sentado com encosto, halteres na altura das orelhas. Empurre acima da cabeça sem bater os halteres e desça controlando.',
        tip: 'Abdômen firme, sem jogar o tronco para trás.',
        alternatives: [
          { name: 'Desenvolvimento na máquina', howTo: 'Ajuste o banco para as pegadas ficarem na altura dos ombros e empurre.' },
          { name: 'Desenvolvimento no Smith', howTo: 'Sentado sob a barra, empurre até quase estender os cotovelos.' },
        ],
      },
      {
        name: 'Elevação lateral',
        sets: 3,
        reps: '12-15',
        howTo: 'Em pé, halteres ao lado do corpo e cotovelos levemente flexionados. Eleve os braços até a altura dos ombros e desça devagar.',
        tip: 'Carga leve; não balance o tronco.',
        alternatives: [
          { name: 'Elevação lateral na polia', howTo: 'Mesma execução, com tensão constante.' },
          { name: 'Elevação lateral na máquina', howTo: 'Cotovelos nas almofadas, eleve até a altura dos ombros.' },
        ],
      },
      {
        name: 'Tríceps na polia',
        sets: 3,
        reps: '10-15',
        howTo: 'Cotovelos colados ao corpo. Estenda os braços para baixo até quase travar e volte até 90°.',
        tip: 'Só o antebraço se move; ombros relaxados.',
        alternatives: [
          { name: 'Tríceps francês com halter', howTo: 'Halter acima da cabeça, desça atrás da nuca e estenda.' },
          { name: 'Tríceps testa', howTo: 'Deitado, desça os halteres em direção à testa e estenda.' },
        ],
      },
    ],
  },

  C: {
    title: 'Puxar: costas, bíceps e glúteos',
    exercises: [
      {
        name: 'Puxada na frente',
        sets: 3,
        reps: '8-12',
        howTo: 'Pegada um pouco além da largura dos ombros. Puxe a barra até o queixo ou peito alto levando os cotovelos para baixo e volte controlando.',
        tip: 'Peito aberto, sem puxar com impulso do tronco.',
        alternatives: [
          { name: 'Puxada articulada', howTo: 'Mesma ideia, com pegadas guiadas e trajetória fixa.' },
          { name: 'Barra fixa assistida', howTo: 'Use a assistência para repetições completas, queixo acima da barra.' },
        ],
      },
      {
        name: 'Remada sentada',
        sets: 3,
        reps: '8-12',
        howTo: 'Sentado, tronco ereto. Puxe levando os cotovelos para trás, aproximando as escápulas, e volte controlando.',
        tip: 'Sem balançar o tronco; sinta as costas, não os braços.',
        alternatives: [
          { name: 'Remada articulada', howTo: 'Peito apoiado na almofada; puxe os cotovelos para trás.' },
          { name: 'Remada curvada com halteres', howTo: 'Tronco inclinado, costas retas; puxe os halteres em direção ao quadril.' },
        ],
      },
      {
        name: 'Remada unilateral com halter',
        sets: 3,
        reps: '10-12',
        howTo: 'Apoie uma mão e o joelho no banco. Puxe o halter em direção ao quadril e desça alongando as costas.',
        tip: 'Tronco paralelo ao chão, sem girar.',
        alternatives: [
          { name: 'Remada unilateral na polia', howTo: 'Mesma execução, com tensão constante.' },
          { name: 'Remada cavalinho', howTo: 'Peito apoiado, puxe a barra em direção ao abdômen.' },
        ],
      },
      {
        name: 'Elevação pélvica',
        sets: 3,
        reps: '8-12',
        howTo: 'Costas apoiadas no banco, barra ou halter sobre o quadril. Suba contraindo o glúteo até alinhar tronco e coxas e desça controlando.',
        tip: 'Queixo para o peito; não hiperestenda a lombar.',
        alternatives: [
          { name: 'Elevação pélvica no Smith', howTo: 'Mesma execução, com a barra guiada.' },
          { name: 'Coice na polia', howTo: 'Perna estendida para trás contraindo o glúteo, sem arquear a lombar.' },
        ],
      },
      {
        name: 'Rosca direta',
        sets: 3,
        reps: '10-12',
        howTo: 'Em pé, cotovelos junto ao corpo. Flexione os braços até a altura do peito e desça devagar.',
        tip: 'Sem balançar o corpo; cotovelos parados.',
        alternatives: [
          { name: 'Rosca alternada com halteres', howTo: 'Um braço por vez, girando a palma para cima ao subir.' },
          { name: 'Rosca na polia', howTo: 'Mesma execução, com tensão constante.' },
        ],
      },
      {
        name: 'Face pull',
        sets: 3,
        reps: '12-15',
        howTo: 'Polia na altura do rosto com corda. Puxe em direção ao rosto abrindo os cotovelos e feche as escápulas.',
        tip: 'Carga leve; foque na parte de trás dos ombros.',
        alternatives: [
          { name: 'Crucifixo inverso (máquina)', howTo: 'Peito apoiado, abra os braços para trás.' },
          { name: 'Crucifixo inverso com halteres', howTo: 'Tronco inclinado, abra os braços até a altura dos ombros.' },
        ],
      },
    ],
  },
};

/** Converte um exercício padrão (nomes legíveis) para o formato salvo (nomes curtos). */
function createExercise(letter, index, def) {
  return {
    id: letter + index,
    n: def.name,
    s: def.sets,
    r: def.reps,
    d: def.howTo,
    t: def.tip,
    a: def.alternatives.map(alt => ({ n: alt.name, d: alt.howTo })),
    u: def.unit || 'rep',
  };
}


/* =========================================================
   3. Estado do app e armazenamento
   ========================================================= */
const $ = selector => document.querySelector(selector);

/** Lê os dados salvos; devolve null se não houver nada (ou se estiver corrompido). */
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.plan && saved.hist) return saved;
  } catch (error) {
    // dados inválidos: começa do zero
  }
  return null;
}

/** Salva no aparelho e avisa a sincronização, mas só se algo realmente mudou. */
function saveState() {
  const json = JSON.stringify(state);
  if (json === lastSavedJson) return;   // cliques que não alteram dados (abrir painel etc.)
  lastSavedJson = json;
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
  markChanged();
}

/** Completa o que faltar (campo last, lista de fábrica de cada treino). */
function normalizeState(data) {
  data.last = data.last || {};
  data.plan = data.plan || {};
  WORKOUT_LETTERS.forEach(letter => {
    if (!data.plan[letter]) {
      data.plan[letter] = DEFAULT_WORKOUTS[letter].exercises
        .map((def, index) => createExercise(letter, index, def));
    }
  });
  return data;
}

// Dados salvos (ou um estado vazio na primeira vez)
let state = normalizeState(loadState() || { plan: {}, hist: [], last: {}, cur: null });
let lastSavedJson = JSON.stringify(state);   // último estado gravado, para detectar mudanças

// Estado só da tela (não é salvo)
let currentView = 'home';          // 'home' | 'workout' | 'edit' | 'history' | 'history-edit'
let editingLetter = '';            // treino aberto na tela de edição
let editingWorkoutD = null;        // data (d) do treino do histórico aberto para edição
let historyShown = HISTORY_PAGE;   // quantos treinos a lista do histórico mostra agora
let confirmingHistoryDelete = false; // 1º toque em "Apagar este treino" já foi dado
let openPanels = {};               // painéis abertos: 'info:ID', 'alts:ID', 'backup'
let confirmingDiscard = false;     // true depois do 1º toque em "Descartar"
let backupText = '';               // texto do backup gerado
let restEndsAt = 0;                // horário (ms) em que o descanso termina
let restInterval = null;           // intervalo que atualiza o cronômetro
let toastTimeout = null;
let confirmingSync = '';           // '' | 'remote' | 'local': 1º toque numa escolha de sincronização


/* =========================================================
   4. Funções auxiliares
   ========================================================= */

/** Protege textos que vão para dentro do HTML. */
function escapeHtml(value) {
  const replacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
  return String(value).replace(/[&<>"]/g, char => replacements[char]);
}

/** Número com vírgula decimal (22.5 -> "22,5"). */
function formatNumber(number) {
  return String(number).replace('.', ',');
}

/** Início da faixa de repetições: '8-12' -> 8. */
function repsLowerBound(exercise) {
  return parseInt(exercise.r) || DEFAULT_REPS_LOW;
}

/** Topo da faixa de repetições: '8-12' -> 12. */
function repsUpperBound(exercise) {
  return parseInt(String(exercise.r).split('-').pop()) || 0;
}

/** Nome que aparece na tela: o da alternativa escolhida ou o original. */
function displayName(exercise, entry) {
  const alternative = exercise.a[entry.alt];
  return entry.alt >= 0 && alternative ? alternative.n : exercise.n;
}

/**
 * Cria a entrada de um exercício no treino em andamento,
 * já preenchida com os valores da última vez (se houver).
 */
function createEntry(exercise, altIndex) {
  const name = altIndex >= 0 ? exercise.a[altIndex].n : exercise.n;
  const last = state.last[name];
  return {
    alt: altIndex,
    kg: last ? last.kg : 0,
    s: last ? last.s : exercise.s,
    r: last ? last.r : repsLowerBound(exercise),
    skip: false,
  };
}

/** Devolve a entrada do exercício no treino atual (criando se ainda não existir). */
function getEntry(exercise) {
  if (!state.cur.it[exercise.id]) {
    state.cur.it[exercise.id] = createEntry(exercise, -1);
  }
  return state.cur.it[exercise.id];
}

/** Quantos treinos foram concluídos nesta semana (a semana começa na segunda). */
function countWorkoutsThisWeek() {
  const now = new Date();
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday).getTime();
  return state.hist.filter(workout => workout.d >= weekStart).length;
}

/** Qual treino vem depois do último concluído (A -> B -> C -> A...). */
function nextWorkoutLetter() {
  if (!state.hist[0]) return WORKOUT_LETTERS[0];
  const lastIndex = WORKOUT_LETTERS.indexOf(state.hist[0].w);
  return WORKOUT_LETTERS[(lastIndex + 1) % WORKOUT_LETTERS.length];
}

/** Mostra uma mensagem rápida no topo da tela. */
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, TOAST_DURATION_MS);
}


/* =========================================================
   5. Telas
   Cada função devolve um texto HTML que é colocado dentro de #app.
   Os botões usam data-action para dizer o que fazem (ver seção 7).
   ========================================================= */

/** Controle "− valor +". field = campo da entrada que o botão altera (kg, s ou r). */
function renderStepper(label, exerciseId, field, valueText) {
  return `
    <div class="stepper">
      <span>${label}</span>
      <button data-action="decrease" data-id="${exerciseId}" data-field="${field}" aria-label="Diminuir">−</button>
      <b>${valueText}</b>
      <button data-action="increase" data-id="${exerciseId}" data-field="${field}" aria-label="Aumentar">+</button>
    </div>`;
}

/* ---------- Tela inicial ---------- */

function formatHistoryLines(workout) {
  return workout.it.map(item => {
    const load = item.kg ? `${formatNumber(item.kg)} kg, ` : '';
    const unit = item.u === 's' ? ' s' : '';
    return `${escapeHtml(item.n)}: ${load}${item.s}×${item.r}${unit}`;
  }).join('<br>');
}

function renderHistoryItem(workout) {
  const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

  const lines = formatHistoryLines(workout);

  let cardio = '';
  if (workout.cm) {
    const speed = workout.ck ? ` a ${escapeHtml(workout.ck)} km/h` : '';
    cardio = `<br>Esteira: ${escapeHtml(workout.cm)} min${speed}`;
  }

  return `
    <details class="card workout-${workout.w}">
      <summary><b>Treino ${workout.w}</b> em ${date}, ${workout.m} min</summary>
      <small>${lines}${cardio}</small>
    </details>`;
}

function renderBackupPanel() {
  return `
    <div class="card">
      <small>Os dados ficam só neste navegador. Gere o backup, copie o texto e guarde numa nota ou mensagem para você mesmo.</small>
      <div class="row">
        <button data-action="export-backup">Gerar backup</button>
        <button data-action="copy-backup">Copiar</button>
      </div>
      <textarea id="backup-output" readonly>${escapeHtml(backupText)}</textarea>
      <div class="spacer-small"></div>
      <small>Para restaurar, cole o texto aqui:</small>
      <textarea id="backup-input"></textarea>
      <div class="row">
        <button class="primary" data-action="import-backup">Restaurar backup</button>
      </div>
    </div>`;
}

/** Painel para conectar (token) e sincronizar manualmente. */
function renderSyncPanel() {
  const connected = getToken() && syncStatus !== 'auth';
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
function renderSyncConflict() {
  const remote = syncConflict.remote;
  const title = remote ? 'Dados diferentes na nuvem' : 'A nuvem ainda está vazia';
  const useRemoteLabel = confirmingSync === 'remote'
    ? 'Confirmar: trocar os dados deste aparelho'
    : 'Usar os dados da nuvem';
  const keepLocalLabel = !remote
    ? 'Enviar os dados deste aparelho'
    : confirmingSync === 'local'
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

function renderHome() {
  const session = state.cur;
  const next = nextWorkoutLetter();

  let html = `
    <h1>Meu treino</h1>
    <small>${countWorkoutsThisWeek()} de ${WEEKLY_GOAL} treinos nesta semana</small>
    <div><small id="sync-status">${escapeHtml(syncLabel())}</small></div>
    <div class="spacer"></div>`;

  // Dados diferentes entre este aparelho e a nuvem: precisa escolher
  if (syncConflict) html += renderSyncConflict();

  // Aviso de treino em andamento
  if (session) {
    html += `
      <div class="card workout-${session.w}">
        <b>Treino ${session.w} em andamento</b>
        <div class="row">
          <button class="primary" data-action="continue">Continuar</button>
          <button data-action="discard">${confirmingDiscard ? 'Confirmar descarte' : 'Descartar'}</button>
        </div>
      </div>`;
  }

  // Um cartão para cada treino (A, B, C)
  WORKOUT_LETTERS.forEach(letter => {
    const nextTag = letter === next ? '<span class="tag">próximo</span>' : '';
    html += `
      <div class="card workout-${letter}">
        <div class="exercise-name">Treino ${letter} ${nextTag}</div>
        <small>${DEFAULT_WORKOUTS[letter].title}, ${state.plan[letter].length} exercícios</small>
        <div class="row">
          <button class="primary" data-action="start" data-value="${letter}">Iniciar treino</button>
          <button data-action="edit" data-value="${letter}">Editar lista</button>
        </div>
      </div>`;
  });

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

  // Sincronização
  html += `
    <h2>Nuvem</h2>
    <button class="btn-full" data-action="toggle-sync">${openPanels.sync ? 'Fechar' : 'Sincronização'}</button>`;
  if (openPanels.sync) html += renderSyncPanel();

  // Backup
  html += `
    <h2>Backup</h2>
    <button class="btn-full" data-action="toggle-backup">${openPanels.backup ? 'Fechar' : 'Backup e restauração'}</button>`;
  if (openPanels.backup) html += renderBackupPanel();

  return html;
}

/* ---------- Tela do treino em andamento ---------- */

function renderExerciseCard(exercise, letter) {
  const entry = getEntry(exercise);
  const name = displayName(exercise, entry);
  const last = state.last[name];
  const isTimed = exercise.u === 's';
  const unitSuffix = isTimed ? ' s' : '';

  // Texto do botão ℹ: a alternativa escolhida tem só a descrição; o original tem descrição + dica
  let infoText;
  if (entry.alt >= 0) {
    infoText = escapeHtml(exercise.a[entry.alt].d);
  } else {
    infoText = escapeHtml(exercise.d) + (exercise.t ? `<br><b>Dica:</b> ${escapeHtml(exercise.t)}` : '');
  }

  const lastText = last
    ? `Última vez: ${last.kg ? formatNumber(last.kg) + ' kg, ' : ''}${last.s}×${last.r}`
    : 'Sem registro ainda';

  let html = `
    <div class="card workout-${letter}${entry.skip ? ' skipped' : ''}">
      <div class="row row-flush">
        <div class="exercise-name">${escapeHtml(name)}</div>
        <button class="icon-button" data-action="info" data-id="${exercise.id}" aria-label="Como executar">ℹ</button>
      </div>
      <small>Meta ${exercise.s}×${escapeHtml(exercise.r)}${unitSuffix}. ${lastText}</small>`;

  if (openPanels['info:' + exercise.id]) {
    html += `<div class="info-box">${infoText}</div>`;
  }

  if (!entry.skip) {
    // Sugestão de aumento: bateu o topo da faixa na última vez e a carga ainda é a mesma
    if (last && last.up && !isTimed && entry.kg === last.kg) {
      html += `
        <div class="suggestion">Você bateu o topo da faixa. Tente ${formatNumber(last.kg + LOAD_STEP_KG)} kg.<button data-action="apply-suggestion" data-id="${exercise.id}">Aplicar</button></div>`;
    }

    if (!isTimed) {
      html += renderStepper('Carga', exercise.id, 'kg', formatNumber(entry.kg) + ' kg');
    }
    html += renderStepper('Séries', exercise.id, 's', entry.s);
    html += renderStepper(isTimed ? 'Tempo' : 'Repetições', exercise.id, 'r', entry.r + unitSuffix);

    if (!isTimed && entry.kg > 0 && entry.r >= repsUpperBound(exercise)) {
      html += '<div class="top-reached">Topo da faixa atingido</div>';
    }

    // Lista para escolher o exercício alternativo
    if (openPanels['alts:' + exercise.id]) {
      const originalButton = `
        <button class="${entry.alt < 0 ? 'selected' : ''}" data-action="pick-alternative" data-id="${exercise.id}" data-value="-1">${escapeHtml(exercise.n)}</button>`;
      const alternativeButtons = exercise.a.map((alt, index) => `
        <button class="${entry.alt === index ? 'selected' : ''}" data-action="pick-alternative" data-id="${exercise.id}" data-value="${index}">${escapeHtml(alt.n)}</button>`).join('');
      html += `<div class="picker">${originalButton}${alternativeButtons}</div>`;
    }
  }

  // Botões "Trocar exercício" e "Pular"
  const canSwap = !entry.skip && exercise.a.length > 0;
  const swapButton = canSwap
    ? `<button data-action="toggle-alternatives" data-id="${exercise.id}">${openPanels['alts:' + exercise.id] ? 'Fechar opções' : 'Trocar exercício'}</button>`
    : '';
  html += `
      <div class="row">
        ${swapButton}
        <button data-action="toggle-skip" data-id="${exercise.id}">${entry.skip ? 'Incluir de novo' : 'Pular'}</button>
      </div>
    </div>`;

  return html;
}

function renderWorkout() {
  const session = state.cur;
  const letter = session.w;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Treino ${letter}</h1>
        <small>${DEFAULT_WORKOUTS[letter].title}</small>
      </div>
    </div>`;

  state.plan[letter].forEach(exercise => {
    html += renderExerciseCard(exercise, letter);
  });

  // Cardio na esteira (os valores são guardados em session.cm e session.ck)
  html += `
    <div class="card workout-${letter}">
      <div class="exercise-name">Cardio na esteira</div>
      <div class="row">
        <label>Minutos<input type="number" inputmode="decimal" data-field="cm" value="${escapeHtml(session.cm)}"></label>
        <label>Velocidade (km/h)<input type="number" inputmode="decimal" data-field="ck" value="${escapeHtml(session.ck)}"></label>
      </div>
    </div>
    <button class="primary btn-full btn-finish" data-action="finish">Concluir treino</button>`;

  return html;
}

/* ---------- Tela de edição da lista ---------- */

function renderEdit() {
  const letter = editingLetter;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Editar treino ${letter}</h1>
        <small>Nome, séries e faixa de repetições</small>
      </div>
    </div>`;

  state.plan[letter].forEach((exercise, index) => {
    html += `
      <div class="card workout-${letter}">
        <input data-field="n" data-index="${index}" value="${escapeHtml(exercise.n)}" aria-label="Nome">
        <div class="row">
          <label>Séries<input type="number" data-field="s" data-index="${index}" value="${exercise.s}" min="1"></label>
          <label>Repetições<input data-field="r" data-index="${index}" value="${escapeHtml(exercise.r)}"></label>
          <button class="btn-align-label" data-action="remove-exercise" data-index="${index}">Remover</button>
        </div>
      </div>`;
  });

  html += `<button class="primary btn-full" style="--accent: var(--color-${letter})" data-action="add-exercise">Adicionar exercício</button>`;
  return html;
}

/* ---------- Histórico: lista completa e edição de um treino ---------- */

function renderHistoryList() {
  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Histórico</h1>
        <small>${state.hist.length} ${state.hist.length === 1 ? 'treino guardado' : 'treinos guardados'}</small>
      </div>
    </div>`;

  state.hist.slice(0, historyShown).forEach(workout => {
    const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
    html += `
      <div class="card workout-${workout.w}">
        <b>Treino ${workout.w}</b> em ${date}, ${workout.m} min<br>
        <small>${formatHistoryLines(workout)}</small>
        <div class="row">
          <button data-action="history-edit" data-value="${workout.d}">Editar</button>
        </div>
      </div>`;
  });

  if (state.hist.length > historyShown) {
    html += '<button class="btn-full" data-action="history-more">Mostrar mais</button>';
  }
  return html;
}

function renderHistoryEdit() {
  const workout = findHistoryWorkout(editingWorkoutD);
  if (!workout) return renderHistoryList();   // o treino não existe mais (ex.: veio outra versão da nuvem)

  const date = new Date(workout.d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  let html = `
    <div class="header">
      <button data-action="history" aria-label="Voltar ao histórico">←</button>
      <div>
        <h1>Editar treino ${workout.w}</h1>
        <small>${date}</small>
      </div>
    </div>`;

  workout.it.forEach((item, index) => {
    const timed = item.u === 's';
    html += `
      <div class="card workout-${workout.w}">
        <div class="exercise-name">${escapeHtml(item.n)}</div>
        <div class="row">
          <label>Carga (kg)<input type="number" inputmode="decimal" step="any" min="0" data-field="hkg" data-index="${index}" value="${item.kg || 0}"></label>
          <label>Séries<input type="number" inputmode="numeric" min="1" data-field="hs" data-index="${index}" value="${item.s || 0}"></label>
          <label>${timed ? 'Segundos' : 'Repetições'}<input type="number" inputmode="numeric" min="0" data-field="hr" data-index="${index}" value="${item.r || 0}"></label>
        </div>
      </div>`;
  });

  html += `
    <div class="spacer-small"></div>
    <button class="btn-full${confirmingHistoryDelete ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="history-delete">
      ${confirmingHistoryDelete ? 'Confirmar: apagar este treino' : 'Apagar este treino'}
    </button>`;
  return html;
}

/* ---------- Escolhe a tela certa e desenha ---------- */

function render() {
  const showingWorkout = currentView === 'workout' && state.cur;

  if (showingWorkout) {
    $('#app').innerHTML = renderWorkout();
  } else if (currentView === 'edit') {
    $('#app').innerHTML = renderEdit();
  } else if (currentView === 'history') {
    $('#app').innerHTML = renderHistoryList();
  } else if (currentView === 'history-edit') {
    $('#app').innerHTML = renderHistoryEdit();
  } else {
    $('#app').innerHTML = renderHome();
  }

  // a barra de descanso só aparece durante o treino
  $('#rest-bar').hidden = !showingWorkout;
}


/* =========================================================
   6. Cronômetro de descanso
   ========================================================= */
function startRest(seconds) {
  restEndsAt = Date.now() + seconds * 1000;
  clearInterval(restInterval);
  restInterval = setInterval(updateRestTimer, 250);
  updateRestTimer();
}

function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    oscillator.connect(audio.destination);
    oscillator.frequency.value = 880;   // tom do alerta (Hz)
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.4);
  } catch (error) {
    // sem suporte a áudio: ignora
  }
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  } catch (error) {
    // sem suporte a vibração: ignora
  }
}

function updateRestTimer() {
  const secondsLeft = Math.ceil((restEndsAt - Date.now()) / 1000);
  const label = $('#rest-timer');

  if (secondsLeft <= 0) {
    clearInterval(restInterval);
    label.textContent = 'Pronto!';
    playBeep();
    vibrate();
  } else {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    label.textContent = `${minutes}:${seconds}`;
  }
}


/* =========================================================
   7. Ações dos botões
   Cada botão da tela tem data-action="nome". O nome é procurado
   no objeto "actions" abaixo. Dados extras do botão chegam em:
     id     -> id do exercício (tela do treino)
     index  -> posição do exercício (tela de edição)
     value  -> valor do botão (letra do treino, segundos...)
     field  -> campo alterado (kg, s ou r)
   Depois da ação, o app salva e redesenha a tela.
   Se a ação devolver false, não salva nem redesenha.
   ========================================================= */
function finishWorkout() {
  const session = state.cur;
  const doneItems = [];

  state.plan[session.w].forEach(exercise => {
    const entry = getEntry(exercise);
    if (entry.skip) return;

    const name = displayName(exercise, entry);
    doneItems.push({ n: name, kg: entry.kg, s: entry.s, r: entry.r, u: exercise.u });

    // guarda a "última vez" e marca se bateu o topo da faixa (base da sugestão de carga)
    state.last[name] = {
      kg: entry.kg,
      s: entry.s,
      r: entry.r,
      up: exercise.u !== 's' && entry.kg > 0 && entry.r >= repsUpperBound(exercise),
    };
  });

  const now = Date.now();
  const minutes = Math.max(1, Math.round((now - session.st) / 60000));
  state.hist.unshift({
    d: now,
    w: session.w,
    m: minutes,
    it: doneItems,
    cm: session.cm || '',
    ck: session.ck || '',
  });
  state.hist = state.hist.slice(0, MAX_HISTORY);

  state.cur = null;
  currentView = 'home';
  clearInterval(restInterval);
  showToast(`Treino ${session.w} concluído e registrado`);
}

/** Aumenta ou diminui carga, séries ou repetições (direction = 1 ou -1). */
function changeValue(exercise, field, direction) {
  const entry = getEntry(exercise);
  let step = 1;
  if (field === 'kg') step = LOAD_STEP_KG;
  else if (field === 'r' && exercise.u === 's') step = HOLD_STEP_SECONDS;

  // toFixed evita erros de ponto flutuante (ex.: 0.1 + 0.2); nunca fica abaixo de zero
  entry[field] = Math.max(0, +(entry[field] + direction * step).toFixed(1));
}

/** Acha um treino do histórico pela data (que serve de identificador). */
function findHistoryWorkout(d) {
  return state.hist.find(workout => workout.d === d);
}

/** Exercício da lista cujo nome (ou o de uma alternativa) é `name`. */
function findPlanExerciseByName(name) {
  for (const letter of WORKOUT_LETTERS) {
    const found = state.plan[letter].find(exercise =>
      exercise.n === name || exercise.a.some(alt => alt.n === name));
    if (found) return found;
  }
  return undefined;
}

/**
 * Refaz a "última carga" de um exercício a partir do treino mais recente que o contém.
 * É o que mantém o valor pré-preenchido e a sugestão de aumento certos depois de
 * corrigir ou apagar um treino. Sem nenhum treino com esse exercício, apaga a entrada.
 */
function syncLastFor(name) {
  for (const workout of state.hist) {          // do mais recente para o mais antigo
    const item = workout.it.find(entry => entry.n === name);
    if (!item) continue;

    const exercise = findPlanExerciseByName(name);
    state.last[name] = {
      kg: item.kg,
      s: item.s,
      r: item.r,
      up: !!exercise && item.u !== 's' && item.kg > 0 && item.r >= repsUpperBound(exercise),
    };
    return;
  }
  delete state.last[name];
}

/** Grava no histórico o valor digitado na tela de edição de um treino. */
function changeHistoryField(input) {
  const workout = findHistoryWorkout(editingWorkoutD);
  const item = workout && workout.it[input.dataset.index];
  const key = { hkg: 'kg', hs: 's', hr: 'r' }[input.dataset.field];
  if (!item || !key) return;

  const typed = parseFloat(String(input.value).replace(',', '.'));
  if (Number.isFinite(typed) && typed >= 0) {
    if (key === 'kg') item.kg = Math.round(typed * 100) / 100;
    else if (key === 's') item.s = Math.max(1, Math.round(typed));
    else item.r = Math.round(typed);
  }
  input.value = item[key] || 0;   // mostra o valor aceito (ou volta ao anterior se o texto era inválido)
  syncLastFor(item.n);
}

function copyBackup() {
  const textarea = $('#backup-output');
  if (!textarea || !textarea.value) {
    showToast('Gere o backup primeiro');
    return;
  }
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    // navegador sem suporte: avisa abaixo
  }
  showToast(copied ? 'Backup copiado' : 'Selecione o texto e copie manualmente');
}

/** Restaura os dados a partir do texto colado. Devolve false se o texto for inválido. */
function importBackup() {
  try {
    const imported = JSON.parse($('#backup-input').value);
    if (!imported.plan || !imported.hist) throw new Error('backup inválido');
    imported.cur = null;
    imported.last = imported.last || {};
    state = imported;
    showToast('Backup restaurado');
  } catch (error) {
    showToast('Texto de backup inválido');
    return false;
  }
}

function togglePanel(key) {
  openPanels[key] = !openPanels[key];
}

const actions = {
  // ----- navegação -----
  'home'() {
    currentView = 'home';
  },

  'start'({ value, session }) {
    if (session && session.w !== value) {
      showToast('Há um treino em andamento. Continue ou descarte.');
      return false;
    }
    if (!session) {
      state.cur = { w: value, st: Date.now(), it: {}, cm: '', ck: '' };
    }
    currentView = 'workout';
  },

  'continue'() {
    currentView = 'workout';
  },

  // 1º toque pede confirmação; 2º toque descarta
  'discard'() {
    if (confirmingDiscard) {
      state.cur = null;
      confirmingDiscard = false;
    } else {
      confirmingDiscard = true;
    }
  },

  // ----- treino em andamento -----
  'info'({ id }) {
    togglePanel('info:' + id);
  },

  'toggle-alternatives'({ id }) {
    togglePanel('alts:' + id);
  },

  'pick-alternative'({ id, value, exercise }) {
    const entry = getEntry(exercise);
    const wasSkipped = entry.skip;
    Object.assign(entry, createEntry(exercise, +value), { skip: wasSkipped });
    openPanels['alts:' + id] = false;
  },

  'toggle-skip'({ exercise }) {
    const entry = getEntry(exercise);
    entry.skip = !entry.skip;
  },

  'decrease'({ exercise, field }) {
    changeValue(exercise, field, -1);
  },

  'increase'({ exercise, field }) {
    changeValue(exercise, field, +1);
  },

  // aplica a carga sugerida (última carga + passo) e volta às repetições iniciais
  'apply-suggestion'({ exercise }) {
    const entry = getEntry(exercise);
    entry.kg = state.last[displayName(exercise, entry)].kg + LOAD_STEP_KG;
    entry.r = repsLowerBound(exercise);
  },

  'finish'() {
    finishWorkout();
  },

  // ----- cronômetro (não precisa salvar nem redesenhar) -----
  'rest'({ value }) {
    startRest(+value);
    return false;
  },

  'stop-timer'() {
    clearInterval(restInterval);
    $('#rest-timer').textContent = 'Descanso';
    return false;
  },

  // ----- edição da lista -----
  'edit'({ value }) {
    editingLetter = value;
    currentView = 'edit';
  },

  'add-exercise'() {
    state.plan[editingLetter].push({
      id: 'x' + Date.now(),
      n: 'Novo exercício',
      s: 3,
      r: '8-12',
      d: '',
      t: '',
      a: [],
      u: 'rep',
    });
  },

  'remove-exercise'({ index }) {
    state.plan[editingLetter].splice(+index, 1);
  },

  // ----- histórico -----
  'history'() {
    currentView = 'history';
  },

  'history-more'() {
    historyShown += HISTORY_PAGE;
  },

  'history-edit'({ value }) {
    editingWorkoutD = +value;
    currentView = 'history-edit';
  },

  // Apaga o treino aberto (pede 2º toque para confirmar)
  'history-delete'() {
    if (!confirmingHistoryDelete) {
      confirmingHistoryDelete = true;
      return;
    }
    confirmingHistoryDelete = false;

    const workout = findHistoryWorkout(editingWorkoutD);
    if (workout) {
      state.hist = state.hist.filter(item => item !== workout);
      workout.it.forEach(item => syncLastFor(item.n));
      showToast('Treino apagado');
    }
    editingWorkoutD = null;
    currentView = 'history';
  },

  // ----- backup -----
  'toggle-backup'() {
    togglePanel('backup');
  },

  'export-backup'() {
    backupText = JSON.stringify({ ...state, cur: null });
  },

  'copy-backup'() {
    copyBackup();
    return false;
  },

  'import-backup'() {
    return importBackup();
  },

  // ----- nuvem -----
  'toggle-sync'() {
    togglePanel('sync');
  },

  'sync-connect'() {
    const token = ($('#sync-token').value || '').trim();
    if (!token) {
      showToast('Cole o token primeiro');
      return false;
    }
    setToken(token);
    syncStatus = 'idle';
    syncNow();
  },

  'sync-disconnect'() {
    clearTimeout(pushTimer);
    localStorage.removeItem(TOKEN_KEY);
    syncConflict = null;
    syncStatus = 'idle';
    showToast('Nuvem desconectada neste aparelho');
  },

  'sync-now'() {
    if (syncConflict) {
      showToast('Escolha primeiro qual versão manter');
      return false;
    }
    syncNow();
    return false;
  },

  // Troca os dados deste aparelho pelos da nuvem (pede 2º toque para confirmar)
  'sync-use-remote'() {
    if (!syncConflict || !syncConflict.remote) return;
    if (confirmingSync !== 'remote') {
      confirmingSync = 'remote';
      return;
    }
    confirmingSync = '';
    adoptRemote(syncConflict.remote);
    showToast('Dados da nuvem carregados');
  },

  // Mantém os dados deste aparelho e grava por cima da nuvem (2º toque, se a nuvem tiver dados)
  'sync-keep-local'() {
    if (!syncConflict) return;
    const remote = syncConflict.remote;
    if (remote && confirmingSync !== 'local') {
      confirmingSync = 'local';
      return;
    }
    confirmingSync = '';
    syncConflict = null;
    syncMeta = { rev: remote ? remote.rev : 0, dirty: true };
    saveSyncMeta();
    syncStatus = 'idle';
    pushPending();
  },
};

// Um único "ouvinte" trata todos os cliques de botões
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const { action, id, index, value, field } = button.dataset;
  const session = state.cur;
  const exercise = session ? state.plan[session.w].find(item => item.id === id) : undefined;

  if (action !== 'discard') confirmingDiscard = false;
  if (action !== 'history-delete') confirmingHistoryDelete = false;
  if (action !== 'sync-use-remote' && action !== 'sync-keep-local') confirmingSync = '';

  const handler = actions[action];
  const result = handler ? handler({ id, index, value, field, session, exercise }) : undefined;
  if (result === false) return;

  saveState();
  render();
});

// Campos de texto: guardam o valor quando o usuário termina de digitar
document.addEventListener('change', event => {
  const input = event.target;
  const field = input.dataset.field;
  if (!field) return;

  if (currentView === 'history-edit') {
    // edição de um treino do histórico
    changeHistoryField(input);
  } else if ((field === 'cm' || field === 'ck') && state.cur) {
    // cardio do treino em andamento
    state.cur[field] = input.value;
  } else if (currentView === 'edit') {
    // edição da lista de exercícios
    const exercise = state.plan[editingLetter][input.dataset.index];
    if (exercise) {
      exercise[field] = field === 's' ? Math.max(1, +input.value || 3) : input.value;
    }
  }
  saveState();
});


/* =========================================================
   8. Sincronização com a nuvem (Cloudflare Worker + D1)

   Como funciona:
     - O app continua usando o localStorage; a nuvem é uma cópia.
     - A nuvem guarda uma "revisão" (rev) que sobe a cada gravação.
       Este aparelho lembra a última rev que viu (syncMeta.rev) e se
       tem mudanças ainda não enviadas (syncMeta.dirty).
     - Ao enviar, o app diz qual rev espera. Se a nuvem já estiver
       em outra, ela recusa (409) e o app pede para você escolher
       qual versão manter. Nada é sobrescrito sozinho.
     - Na primeira conexão deste aparelho também é você quem escolhe.
   ========================================================= */
let syncMeta = loadSyncMeta();      // { rev: número ou null (nunca sincronizou), dirty: true/false }
let syncStatus = 'idle';            // 'idle' | 'syncing' | 'ok' | 'offline' | 'auth' | 'conflict'
let syncConflict = null;            // { remote: { rev, state } ou null se a nuvem está vazia }
let syncing = false;                // true enquanto há uma chamada à nuvem em andamento
let pushTimer = null;
let changeCounter = 0;              // conta mudanças locais (para saber se mudou durante o envio)

function loadSyncMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem(SYNC_META_KEY));
    if (saved && typeof saved === 'object') {
      return {
        rev: Number.isInteger(saved.rev) ? saved.rev : null,
        dirty: !!saved.dirty,
      };
    }
  } catch (error) {
    // dados inválidos: começa como "nunca sincronizou"
  }
  return { rev: null, dirty: false };
}

function saveSyncMeta() {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(syncMeta));
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
}

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {
    return '';
  }
}

function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    showToast('Não foi possível guardar o token');
  }
}

/** Texto curto para o resumo de um estado (usado na tela de conflito). */
function describeState(data) {
  const total = data.hist.length;
  if (!total) return 'nenhum treino registrado';
  const last = new Date(data.hist[0].d).toLocaleDateString('pt-BR');
  return `${total} ${total === 1 ? 'treino' : 'treinos'}, o último em ${last}`;
}

function syncLabel() {
  if (!getToken()) return 'Nuvem desligada';
  if (syncStatus === 'conflict') return 'Nuvem: escolha qual versão manter';
  if (syncStatus === 'auth') return 'Nuvem: token recusado';
  if (syncStatus === 'syncing') return 'Nuvem: sincronizando…';
  if (syncMeta.rev === null) return 'Nuvem: aguardando a primeira sincronização';
  if (syncMeta.dirty) {
    return syncStatus === 'offline' ? 'Nuvem: pendente, sem conexão' : 'Nuvem: salvando…';
  }
  return 'Nuvem: sincronizado';
}

function updateSyncLabel() {
  const label = $('#sync-status');
  if (label) label.textContent = syncLabel();
}

/** Troca o status. Redesenha a tela só quando o cartão de conflito aparece ou some. */
function setSyncStatus(next) {
  const conflictChanged = (next === 'conflict') !== (syncStatus === 'conflict');
  if (next === 'auth' && syncStatus !== 'auth') showToast('A nuvem recusou o token');
  syncStatus = next;
  if (conflictChanged && currentView === 'home') render();
  else updateSyncLabel();
}

/** Chamada pelo saveState quando os dados mudaram de verdade. */
function markChanged() {
  changeCounter++;
  if (!syncMeta.dirty) {
    syncMeta.dirty = true;
    saveSyncMeta();
  }
  updateSyncLabel();
  schedulePush();
}

function schedulePush() {
  clearTimeout(pushTimer);
  if (!getToken() || syncMeta.rev === null || syncConflict || syncStatus === 'auth') return;
  pushTimer = setTimeout(pushPending, SYNC_DELAY_MS);
}

function apiFetch(path, options = {}) {
  return fetch(API_URL + path, {
    ...options,
    cache: 'no-store',
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    },
  });
}

/** Lê a nuvem. Devolve { remote } (remote = null se vazia) ou { auth: true } se o token foi recusado. */
async function fetchRemote() {
  const response = await apiFetch('/state');
  if (response.status === 404) return { remote: null };
  if (response.status === 401) return { auth: true };
  if (!response.ok) throw new Error('GET /state: ' + response.status);

  const remote = await response.json();
  if (!remote || !Number.isInteger(remote.rev) || !remote.state ||
      !remote.state.plan || !Array.isArray(remote.state.hist)) {
    throw new Error('Resposta da nuvem em formato inesperado');
  }
  return { remote };
}

/** Envia o estado atual. Só deve ser chamada quando syncMeta.rev é um número. */
async function doPush() {
  const sentAt = changeCounter;
  const response = await apiFetch('/state', {
    method: 'PUT',
    body: JSON.stringify({ baseRev: syncMeta.rev, state }),
  });

  if (response.status === 401) {
    setSyncStatus('auth');
    return;
  }

  if (response.status === 409) {
    // a nuvem mudou desde a última leitura: busca a versão dela e pede a escolha
    const result = await fetchRemote();
    if (result.auth) {
      setSyncStatus('auth');
      return;
    }
    syncConflict = { remote: result.remote };
    setSyncStatus('conflict');
    return;
  }

  if (!response.ok) throw new Error('PUT /state: ' + response.status);

  const { rev } = await response.json();
  syncMeta.rev = rev;
  if (sentAt === changeCounter) syncMeta.dirty = false;   // mudou durante o envio? continua pendente
  saveSyncMeta();
  setSyncStatus('ok');
  if (syncMeta.dirty) schedulePush();
}

/** Envio disparado pelo temporizador (depois de uma mudança). */
async function pushPending() {
  if (syncing) {
    schedulePush();
    return;
  }
  if (!getToken() || syncMeta.rev === null || syncConflict) return;

  syncing = true;
  setSyncStatus('syncing');
  try {
    await doPush();
  } catch (error) {
    setSyncStatus('offline');   // sem rede ou erro do servidor: continua pendente
  } finally {
    syncing = false;
  }
}

/** Troca os dados deste aparelho pelos da nuvem, guardando antes uma cópia dos atuais. */
function adoptRemote(remote) {
  try {
    localStorage.setItem(SAFETY_COPY_KEY, JSON.stringify(state));
  } catch (error) {
    // sem espaço: segue mesmo assim
  }
  state = normalizeState(remote.state);
  lastSavedJson = JSON.stringify(state);
  try {
    localStorage.setItem(STORAGE_KEY, lastSavedJson);
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
  syncMeta = { rev: remote.rev, dirty: false };
  saveSyncMeta();
  syncConflict = null;
  syncStatus = 'ok';
}

/** Compara este aparelho com a nuvem e decide: nada a fazer, enviar, receber ou pedir escolha. */
async function reconcile(remote) {
  const remoteRev = remote ? remote.rev : 0;

  if (syncMeta.rev === null) {
    // primeira vez neste aparelho: quem decide é você
    syncConflict = { remote };
    setSyncStatus('conflict');
  } else if (remoteRev === syncMeta.rev) {
    if (syncMeta.dirty) await doPush();
    else setSyncStatus('ok');
  } else if (remote && !syncMeta.dirty) {
    // a nuvem está mais nova e este aparelho não tem nada pendente: só atualiza
    adoptRemote(remote);
    render();
  } else {
    // as duas mudaram (ou a nuvem foi esvaziada): quem decide é você
    syncConflict = { remote };
    setSyncStatus('conflict');
  }
}

/** Lê a nuvem e sincroniza. Roda ao abrir o app, ao voltar para ele e ao recuperar a conexão. */
async function syncNow() {
  if (!getToken() || syncing || syncConflict) return;

  syncing = true;
  setSyncStatus('syncing');
  try {
    const result = await fetchRemote();
    if (result.auth) setSyncStatus('auth');
    else await reconcile(result.remote);
  } catch (error) {
    setSyncStatus('offline');
  } finally {
    syncing = false;
  }
}


/* =========================================================
   9. Inicialização e Service Worker (funcionamento offline)
   ========================================================= */
render();
syncNow();

window.addEventListener('online', syncNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') syncNow();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}

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
       plan: { [idDoTreino]: [exercício...] },   // ids originais: A, B, C
       hist: [treino concluído...],   // o mais recente primeiro
       last: { 'Nome do exercício': { kg, s, r, up } },
       cur:  treino em andamento, ou null,
       treinos: { [idDoTreino]: { nome, desc, cor } },   // cor = posição em COLOR_KEYS
       fichas:  [{ id, nome, treinos: [idDoTreino...] }]  // treino fora de toda ficha = "Sem ficha"
     }
     (treinos e fichas são opcionais: dados antigos sem eles são convertidos
      ao abrir, com A, B e C dentro da ficha "Ficha atual".)

     exercício       = { id, n: nome, s: séries, r: faixa de repetições,
                         d: como executar, t: dica,
                         a: [{ n, d }] alternativas,
                         u: 'rep' (repetições) ou 's' (segundos) }
     treino em curso = { w: idDoTreino, st: início (ms), cm: min de esteira,
                         ck: km/h da esteira, it: { [idExercício]: entrada } }
     entrada         = { alt: índice da alternativa (-1 = original),
                         kg, s, r, skip: true se foi pulado }
     histórico       = { d: data (ms), w: idDoTreino, m: duração (min),
                         it: [{ n, kg, s, r, u }], cm, ck,
                         wn: nome do treino na hora (usado se o treino for removido) }
     last[nome]      = última carga usada; up = true se bateu o topo da faixa
   ========================================================= */

'use strict';


/* =========================================================
   1. Configurações
   ========================================================= */
const STORAGE_KEY = 'treino_v1';
const LEGACY_IDS = ['A', 'B', 'C'];    // treinos originais (usados para converter dados antigos)
const COLOR_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];   // cores disponíveis para os treinos (ver style.css)
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

/**
 * Completa o que faltar e converte dados antigos para o formato atual.
 * Dados sem `treinos` (versões anteriores, backups antigos, primeira abertura)
 * ganham A, B e C com os nomes de sempre, todos dentro da ficha "Ficha atual".
 */
function normalizeState(data) {
  data.last = data.last || {};
  data.plan = data.plan || {};

  if (!data.treinos || typeof data.treinos !== 'object') {
    data.treinos = {};
    LEGACY_IDS.forEach((id, index) => {
      if (!data.plan[id]) {
        data.plan[id] = DEFAULT_WORKOUTS[id].exercises
          .map((def, position) => createExercise(id, position, def));
      }
      data.treinos[id] = { nome: 'Treino ' + id, desc: DEFAULT_WORKOUTS[id].title, cor: index };
    });
  }

  // todo treino com lista tem dados de treino (e vice-versa), com campos válidos
  Object.keys(data.plan).forEach(id => {
    if (!data.treinos[id]) data.treinos[id] = {};
  });
  Object.keys(data.treinos).forEach((id, position) => {
    const treino = data.treinos[id];
    if (typeof treino.nome !== 'string' || !treino.nome) treino.nome = 'Treino ' + id;
    if (typeof treino.desc !== 'string') treino.desc = '';
    if (!Number.isInteger(treino.cor) || treino.cor < 0) treino.cor = position % COLOR_KEYS.length;
    if (!Array.isArray(data.plan[id])) data.plan[id] = [];
  });

  // fichas: cada uma só cita treinos que existem, e nenhum treino aparece em duas
  if (!Array.isArray(data.fichas)) {
    data.fichas = [{ id: 'ficha1', nome: 'Ficha atual', treinos: Object.keys(data.treinos) }];
  }
  const used = new Set();
  data.fichas = data.fichas.filter(ficha => ficha && typeof ficha === 'object' && ficha.id);
  data.fichas.forEach(ficha => {
    if (typeof ficha.nome !== 'string' || !ficha.nome) ficha.nome = 'Ficha';
    ficha.treinos = (Array.isArray(ficha.treinos) ? ficha.treinos : [])
      .filter(id => data.treinos[id] && !used.has(id) && used.add(id));
  });

  // treino em andamento de um treino que não existe mais
  if (data.cur && !data.plan[data.cur.w]) data.cur = null;

  return data;
}

// Dados salvos (ou um estado vazio na primeira vez)
let state = normalizeState(loadState() || { plan: {}, hist: [], last: {}, cur: null });
let lastSavedJson = JSON.stringify(state);   // último estado gravado, para detectar mudanças

// Estado só da tela (não é salvo)
let currentView = 'home';          // 'home' | 'workout' | 'edit' | 'treino-edit' | 'ficha-edit' | 'history' | 'history-edit'
let editingTreino = '';            // id do treino aberto na edição da lista ou nas configurações
let editingFicha = '';             // id da ficha aberta na tela de edição da ficha
let confirmingDelete = '';         // 1º toque em "Remover treino/ficha" já foi dado (guarda qual)
let editingWorkoutD = null;        // data (d) do treino do histórico aberto para edição
let historyShown = HISTORY_PAGE;   // quantos treinos a lista do histórico mostra agora
let confirmingHistoryDelete = false; // 1º toque em "Apagar este treino" já foi dado
let confirmingRemove = '';         // 1º toque em "Remover exercício" já foi dado (guarda qual)
let openPanels = {};               // menus/painéis abertos: 'info:ID', 'how:ID', 'ed:ID', 'menu:A', 'more', 'sync', 'backup'...
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

/* ---------- Treinos e fichas: nomes, cores e ordem ---------- */

function workoutName(id) {
  const treino = state.treinos[id];
  return treino ? treino.nome : 'Treino ' + id;
}

/** Chave de cor do treino (A–F), usada nas classes workout-X e nas variáveis --color-X. */
function workoutColorKey(id) {
  const treino = state.treinos[id];
  return COLOR_KEYS[(treino ? treino.cor : 0) % COLOR_KEYS.length];
}

/** Nome de um treino do histórico: o atual, ou o guardado na hora se o treino foi removido. */
function historyName(workout) {
  const treino = state.treinos[workout.w];
  return treino ? treino.nome : (workout.wn || 'Treino ' + workout.w);
}

function historyColorKey(workout) {
  if (state.treinos[workout.w]) return workoutColorKey(workout.w);
  const legacy = LEGACY_IDS.indexOf(workout.w);
  return COLOR_KEYS[legacy >= 0 ? legacy : 0];
}

function findFicha(id) {
  return state.fichas.find(ficha => ficha.id === id);
}

/** Treinos que não estão em nenhuma ficha. */
function unassignedWorkouts() {
  const inFichas = new Set(state.fichas.flatMap(ficha => ficha.treinos));
  return Object.keys(state.treinos).filter(id => !inFichas.has(id));
}

/** Tira o treino de todas as fichas e, se `fichaId` existir, coloca no fim dela. */
function moveWorkoutToFicha(id, fichaId) {
  state.fichas.forEach(ficha => {
    ficha.treinos = ficha.treinos.filter(item => item !== id);
  });
  const destination = findFicha(fichaId);
  if (destination) destination.treinos.push(id);
}

/** Próximo treino de uma ficha: o que vem depois do último concluído dela (A -> B -> C -> A...). */
function nextWorkoutIn(ficha) {
  const ids = ficha.treinos.filter(id => state.plan[id]);
  if (!ids.length) return null;
  const last = state.hist.find(workout => ids.includes(workout.w));
  if (!last) return ids[0];
  return ids[(ids.indexOf(last.w) + 1) % ids.length];
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
    <details class="card workout-${historyColorKey(workout)}">
      <summary><b>${escapeHtml(historyName(workout))}</b> em ${date}, ${workout.m} min</summary>
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

/** Uma ficha: menu com os cartões dos seus treinos e os botões de adicionar/editar. */
function renderFicha(ficha) {
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
function renderWorkoutCard(id, isNext) {
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

function renderHome() {
  const session = state.cur;

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
      <div class="card workout-${workoutColorKey(session.w)}">
        <b>${escapeHtml(workoutName(session.w))} em andamento</b>
        <div class="row">
          <button class="primary" data-action="continue">Continuar</button>
          <button data-action="discard">${confirmingDiscard ? 'Confirmar descarte' : 'Descartar'}</button>
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

/* ---------- Tela do treino em andamento ---------- */

/** Menu recolhível: botão com o título e, quando aberto, o conteúdo logo abaixo. */
function renderSection(key, title, bodyHtml, extraClass = '') {
  const open = isPanelOpen(key);
  return `
    <div class="section${extraClass ? ' ' + extraClass : ''}">
      <button class="section-toggle" data-action="toggle-panel" data-value="${escapeHtml(key)}" aria-expanded="${open}">
        <span>${title}</span><span aria-hidden="true">${open ? '▾' : '▸'}</span>
      </button>
      ${open ? `<div class="section-body">${bodyHtml}</div>` : ''}
    </div>`;
}

/** Informações do exercício (botão ℹ): um menu para cada informação. */
function renderInfoPanel(exercise, entry) {
  const id = exercise.id;
  const alternative = entry.alt >= 0 ? exercise.a[entry.alt] : null;

  // a alternativa escolhida tem só a descrição; o exercício original tem descrição, dica e alternativas
  const how = alternative ? alternative.d : exercise.d;
  const tip = alternative ? '' : exercise.t;
  const others = alternative ? [] : exercise.a;

  let html = '<div class="info-box">';
  html += renderSection('how:' + id, 'Como executar', how ? escapeHtml(how) : '<small>Sem descrição.</small>');
  if (tip) {
    html += renderSection('tip:' + id, 'Dica', escapeHtml(tip));
  }
  if (others.length) {
    const list = others.map(alt => `<b>${escapeHtml(alt.n)}</b><br>${escapeHtml(alt.d || '')}`).join('<br><br>');
    html += renderSection('alt-info:' + id, `Alternativas (${others.length})`, list);
  }
  return html + '</div>';
}

function renderExerciseCard(exercise, letter) {
  const entry = getEntry(exercise);
  const name = displayName(exercise, entry);
  const last = state.last[name];
  const isTimed = exercise.u === 's';
  const unitSuffix = isTimed ? ' s' : '';

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
    html += renderInfoPanel(exercise, entry);
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
  const id = session.w;
  const letter = workoutColorKey(id);   // chave de cor do treino
  const description = state.treinos[id].desc;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>${escapeHtml(workoutName(id))}</h1>
        ${description ? `<small>${escapeHtml(description)}</small>` : ''}
      </div>
    </div>`;

  state.plan[id].forEach(exercise => {
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
  const id = editingTreino;
  if (!state.plan[id]) return renderHome();   // o treino não existe mais
  const letter = workoutColorKey(id);         // chave de cor do treino

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Editar ${escapeHtml(workoutName(id))}</h1>
        <small>Toque em Editar para abrir um exercício</small>
      </div>
    </div>`;

  state.plan[id].forEach((exercise, index) => {
    html += renderExerciseEditor(exercise, index, letter);
  });

  html += `<button class="primary btn-full" style="--accent: var(--color-${letter})" data-action="add-exercise">Adicionar exercício</button>`;
  return html;
}

/** Cartão de um exercício na edição: recolhido mostra o resumo; aberto mostra todos os campos. */
function renderExerciseEditor(exercise, index, letter) {
  const id = exercise.id;
  const open = isPanelOpen('ed:' + id);
  const unitSuffix = exercise.u === 's' ? ' s' : '';

  let html = `
    <div class="card workout-${letter}">
      <div class="row row-flush">
        <div>
          <div class="exercise-name">${escapeHtml(exercise.n)}</div>
          <small>${exercise.s}×${escapeHtml(exercise.r)}${unitSuffix}</small>
        </div>
        <button class="btn-side" data-action="toggle-panel" data-value="ed:${escapeHtml(id)}" aria-expanded="${open}">${open ? 'Fechar' : 'Editar'}</button>
      </div>`;

  if (open) {
    html += `
      <input data-field="n" data-index="${index}" value="${escapeHtml(exercise.n)}" aria-label="Nome">
      <div class="row">
        <label>Séries<input type="number" inputmode="numeric" min="1" data-field="s" data-index="${index}" value="${exercise.s}"></label>
        <label>Faixa (ex.: 8-12)<input data-field="r" data-index="${index}" value="${escapeHtml(exercise.r)}"></label>
        <label>Medida
          <select data-field="u" data-index="${index}">
            <option value="rep"${exercise.u === 's' ? '' : ' selected'}>Repetições</option>
            <option value="s"${exercise.u === 's' ? ' selected' : ''}>Segundos</option>
          </select>
        </label>
      </div>`;

    html += renderSection('ed-how:' + id, 'Como executar',
      `<textarea class="field-text" data-field="d" data-index="${index}" placeholder="Passo a passo do movimento">${escapeHtml(exercise.d || '')}</textarea>`);
    html += renderSection('ed-tip:' + id, 'Dica',
      `<textarea class="field-text" data-field="t" data-index="${index}" placeholder="Uma dica curta (opcional)">${escapeHtml(exercise.t || '')}</textarea>`);
    html += renderSection('ed-alts:' + id, `Alternativas (${exercise.a.length})`, renderAlternativesEditor(exercise, index));

    const removeKey = editingTreino + ':' + index;
    const confirming = confirmingRemove === removeKey;
    html += `
      <div class="spacer-small"></div>
      <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="remove-exercise" data-index="${index}">
        ${confirming ? 'Confirmar: remover exercício' : 'Remover exercício'}
      </button>`;
  }

  return html + '</div>';
}

function renderAlternativesEditor(exercise, index) {
  let html = '';
  exercise.a.forEach((alt, altIndex) => {
    html += `
      <div class="alt-editor">
        <input data-field="an" data-index="${index}" data-alt="${altIndex}" value="${escapeHtml(alt.n)}" aria-label="Nome da alternativa" placeholder="Nome da alternativa">
        <textarea class="field-text" data-field="ad" data-index="${index}" data-alt="${altIndex}" placeholder="Como executar a alternativa">${escapeHtml(alt.d || '')}</textarea>
        <button data-action="remove-alt" data-index="${index}" data-value="${altIndex}">Remover alternativa</button>
      </div>`;
  });
  html += `<button class="btn-full" data-action="add-alt" data-index="${index}">Adicionar alternativa</button>`;
  return html;
}

/* ---------- Configurar treino e editar ficha ---------- */

function renderTreinoEdit() {
  const id = editingTreino;
  const treino = state.treinos[id];
  if (!treino) return renderHome();   // o treino não existe mais

  const current = state.fichas.find(ficha => ficha.treinos.includes(id));
  const options = ['<option value="">Sem ficha</option>'].concat(state.fichas.map(ficha =>
    `<option value="${escapeHtml(ficha.id)}"${current && current.id === ficha.id ? ' selected' : ''}>${escapeHtml(ficha.nome)}</option>`)).join('');
  const swatches = COLOR_KEYS.map((colorKey, index) =>
    `<button class="swatch workout-${colorKey}${treino.cor === index ? ' selected' : ''}" data-action="set-color" data-value="${index}" aria-label="Cor ${index + 1}" aria-pressed="${treino.cor === index}"></button>`).join('');
  const confirming = confirmingDelete === 'treino:' + id;
  const count = state.plan[id].length;

  return `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Configurar treino</h1>
        <small>${count} ${count === 1 ? 'exercício' : 'exercícios'}</small>
      </div>
    </div>
    <div class="card workout-${workoutColorKey(id)}">
      <label>Nome<input data-field="tn" value="${escapeHtml(treino.nome)}"></label>
      <div class="spacer-small"></div>
      <label>Descrição (opcional)<input data-field="td" value="${escapeHtml(treino.desc)}" placeholder="Ex.: Pernas e core"></label>
      <div class="spacer-small"></div>
      <label>Ficha<select data-field="tf">${options}</select></label>
      <div class="spacer-small"></div>
      <small>Cor</small>
      <div class="swatches">${swatches}</div>
    </div>
    <button class="btn-full" data-action="edit" data-value="${escapeHtml(id)}">Editar lista de exercícios</button>
    <div class="spacer-small"></div>
    <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="delete-treino">${confirming ? 'Confirmar: remover este treino' : 'Remover treino'}</button>
    <small>O histórico deste treino é mantido.</small>`;
}

function renderFichaEdit() {
  const ficha = findFicha(editingFicha);
  if (!ficha) return renderHome();   // a ficha não existe mais

  const confirming = confirmingDelete === 'ficha:' + ficha.id;

  let html = `
    <div class="header">
      <button data-action="home" aria-label="Início">←</button>
      <div>
        <h1>Editar ficha</h1>
        <small>${ficha.treinos.length} ${ficha.treinos.length === 1 ? 'treino' : 'treinos'}</small>
      </div>
    </div>
    <div class="card">
      <label>Nome da ficha<input data-field="fn" value="${escapeHtml(ficha.nome)}"></label>
    </div>
    <h2>Treinos</h2>`;

  ficha.treinos.forEach((id, index) => {
    html += `
      <div class="card workout-${workoutColorKey(id)}">
        <div class="row row-flush">
          <div class="exercise-name">${escapeHtml(workoutName(id))}</div>
          <button class="btn-side" data-action="treino-edit" data-value="${escapeHtml(id)}">Configurar</button>
        </div>
        <div class="row">
          <button data-action="move-treino" data-index="${index}" data-value="up" aria-label="Subir"${index === 0 ? ' disabled' : ''}>↑</button>
          <button data-action="move-treino" data-index="${index}" data-value="down" aria-label="Descer"${index === ficha.treinos.length - 1 ? ' disabled' : ''}>↓</button>
        </div>
      </div>`;
  });
  if (!ficha.treinos.length) html += '<small>Nenhum treino nesta ficha ainda.</small>';

  html += `
    <button class="btn-full" data-action="add-treino" data-value="${escapeHtml(ficha.id)}">Adicionar treino</button>
    <div class="spacer-small"></div>
    <button class="btn-full${confirming ? ' primary' : ''}" style="--accent: var(--color-B)" data-action="delete-ficha">${confirming ? 'Confirmar: remover esta ficha' : 'Remover ficha'}</button>
    <small>Os treinos não são apagados: ficam em "Sem ficha".</small>`;
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
      <div class="card workout-${historyColorKey(workout)}">
        <b>${escapeHtml(historyName(workout))}</b> em ${date}, ${workout.m} min<br>
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
        <h1>Editar ${escapeHtml(historyName(workout))}</h1>
        <small>${date}</small>
      </div>
    </div>`;

  workout.it.forEach((item, index) => {
    const timed = item.u === 's';
    html += `
      <div class="card workout-${historyColorKey(workout)}">
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
  const showingWorkout = currentView === 'workout' && state.cur && state.plan[state.cur.w];

  if (showingWorkout) {
    $('#app').innerHTML = renderWorkout();
  } else if (currentView === 'edit') {
    $('#app').innerHTML = renderEdit();
  } else if (currentView === 'treino-edit') {
    $('#app').innerHTML = renderTreinoEdit();
  } else if (currentView === 'ficha-edit') {
    $('#app').innerHTML = renderFichaEdit();
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
    wn: workoutName(session.w),
    m: minutes,
    it: doneItems,
    cm: session.cm || '',
    ck: session.ck || '',
  });
  state.hist = state.hist.slice(0, MAX_HISTORY);

  state.cur = null;
  currentView = 'home';
  clearInterval(restInterval);
  showToast(`${workoutName(session.w)} concluído e registrado`);
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
  for (const id of Object.keys(state.plan)) {
    const found = state.plan[id].find(exercise =>
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

/** Grava nome, descrição ou ficha do treino aberto nas configurações. */
function changeTreinoField(input) {
  const treino = state.treinos[editingTreino];
  if (!treino) return;
  const field = input.dataset.field;

  if (field === 'tn') {
    treino.nome = input.value.trim() || treino.nome;   // o nome não pode ficar vazio
    input.value = treino.nome;
  } else if (field === 'td') {
    treino.desc = input.value.trim();
  } else if (field === 'tf') {
    moveWorkoutToFicha(editingTreino, input.value);
  }
}

/** Grava o nome da ficha aberta. */
function changeFichaField(input) {
  const ficha = findFicha(editingFicha);
  if (!ficha || input.dataset.field !== 'fn') return;
  ficha.nome = input.value.trim() || ficha.nome;      // o nome não pode ficar vazio
  input.value = ficha.nome;
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
    state = normalizeState(imported);
    showToast('Backup restaurado');
  } catch (error) {
    showToast('Texto de backup inválido');
    return false;
  }
}

/** Menu aberto? "Como executar" ('how:...') e as fichas ('ficha:...') já começam abertos; os demais, fechados. */
function isPanelOpen(key) {
  const saved = openPanels[key];
  return saved === undefined ? (key.startsWith('how:') || key.startsWith('ficha:')) : saved;
}

function togglePanel(key) {
  openPanels[key] = !isPanelOpen(key);
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
    if (!session && !(state.plan[value] && state.plan[value].length)) {
      showToast('Adicione exercícios a este treino antes de iniciar');
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
    editingTreino = value;
    openPanels['menu:' + value] = false;
    currentView = 'edit';
  },

  // abre ou fecha qualquer menu recolhível (a chave vem em data-value)
  'toggle-panel'({ value }) {
    togglePanel(value);
  },

  'add-exercise'() {
    const id = 'x' + Date.now();
    state.plan[editingTreino].push({
      id,
      n: 'Novo exercício',
      s: 3,
      r: '8-12',
      d: '',
      t: '',
      a: [],
      u: 'rep',
    });
    openPanels['ed:' + id] = true;   // o novo exercício já aparece aberto para preencher
  },

  // 1º toque pede confirmação; 2º toque remove
  'remove-exercise'({ index }) {
    const key = editingTreino + ':' + index;
    if (confirmingRemove !== key) {
      confirmingRemove = key;
      return;
    }
    confirmingRemove = '';
    state.plan[editingTreino].splice(+index, 1);
  },

  'add-alt'({ index }) {
    const exercise = state.plan[editingTreino][+index];
    if (!exercise) return;
    exercise.a.push({ n: 'Nova alternativa', d: '' });
    openPanels['ed-alts:' + exercise.id] = true;
  },

  'remove-alt'({ index, value }) {
    const exercise = state.plan[editingTreino][+index];
    if (exercise) exercise.a.splice(+value, 1);
  },

  // ----- treinos e fichas -----
  'add-ficha'() {
    const id = 'f' + Date.now();
    state.fichas.push({ id, nome: 'Nova ficha', treinos: [] });
    editingFicha = id;
    currentView = 'ficha-edit';
  },

  'ficha-edit'({ value }) {
    editingFicha = value;
    currentView = 'ficha-edit';
  },

  // cria um treino vazio dentro da ficha e abre as configurações para dar nome
  'add-treino'({ value }) {
    const ficha = findFicha(value);
    if (!ficha) return false;
    const id = 'w' + Date.now();
    state.plan[id] = [];
    state.treinos[id] = { nome: 'Novo treino', desc: '', cor: Object.keys(state.treinos).length % COLOR_KEYS.length };
    ficha.treinos.push(id);
    editingTreino = id;
    currentView = 'treino-edit';
  },

  'treino-edit'({ value }) {
    editingTreino = value;
    openPanels['menu:' + value] = false;
    currentView = 'treino-edit';
  },

  'set-color'({ value }) {
    const treino = state.treinos[editingTreino];
    if (treino) treino.cor = +value;
  },

  'move-treino'({ index, value }) {
    const ficha = findFicha(editingFicha);
    if (!ficha) return;
    const from = +index;
    const to = value === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= ficha.treinos.length) return;
    [ficha.treinos[from], ficha.treinos[to]] = [ficha.treinos[to], ficha.treinos[from]];
  },

  // Remove o treino (2º toque confirma). O histórico dele é mantido.
  'delete-treino'() {
    const id = editingTreino;
    if (state.cur && state.cur.w === id) {
      showToast('Há um treino em andamento. Conclua ou descarte antes de remover.');
      return false;
    }
    if (confirmingDelete !== 'treino:' + id) {
      confirmingDelete = 'treino:' + id;
      return;
    }
    confirmingDelete = '';
    delete state.plan[id];
    delete state.treinos[id];
    state.fichas.forEach(ficha => {
      ficha.treinos = ficha.treinos.filter(item => item !== id);
    });
    editingTreino = '';
    currentView = 'home';
    showToast('Treino removido (o histórico foi mantido)');
  },

  // Remove a ficha (2º toque confirma). Os treinos dela ficam em "Sem ficha".
  'delete-ficha'() {
    const id = editingFicha;
    if (confirmingDelete !== 'ficha:' + id) {
      confirmingDelete = 'ficha:' + id;
      return;
    }
    confirmingDelete = '';
    state.fichas = state.fichas.filter(ficha => ficha.id !== id);
    editingFicha = '';
    currentView = 'home';
    showToast('Ficha removida. Os treinos ficaram em "Sem ficha".');
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
  const exercise = session ? (state.plan[session.w] || []).find(item => item.id === id) : undefined;

  if (action !== 'discard') confirmingDiscard = false;
  if (action !== 'history-delete') confirmingHistoryDelete = false;
  if (action !== 'remove-exercise') confirmingRemove = '';
  if (action !== 'delete-treino' && action !== 'delete-ficha') confirmingDelete = '';
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
  } else if (currentView === 'treino-edit') {
    changeTreinoField(input);
  } else if (currentView === 'ficha-edit') {
    changeFichaField(input);
  } else if ((field === 'cm' || field === 'ck') && state.cur) {
    // cardio do treino em andamento
    state.cur[field] = input.value;
  } else if (currentView === 'edit') {
    // edição da lista de exercícios
    const exercise = state.plan[editingTreino][input.dataset.index];
    if (exercise) {
      if (field === 'an' || field === 'ad') {
        // nome ou descrição de uma alternativa
        const alternative = exercise.a[input.dataset.alt];
        if (alternative) alternative[field === 'an' ? 'n' : 'd'] = input.value;
      } else {
        exercise[field] = field === 's' ? Math.max(1, +input.value || 3) : input.value;
      }
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

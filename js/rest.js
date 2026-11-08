/* =========================================================
   Meu Treino — Cronômetro de descanso (bipe, vibração e aviso com a tela apagada).

   Como funciona com o celular no bolso:
   1. O fim do descanso é um HORÁRIO (ui.restEndsAt), não uma contagem de segundos:
      ao voltar ao app o tempo está sempre certo.
   2. Enquanto o descanso corre, toca um áudio inaudível em loop (com uma
      notificação de mídia "Descanso em andamento"). Isso evita que o Android
      congele a página com a tela apagada.
   3. Ao zerar, o aviso sai por um áudio audível (não depende do WebAudio, que
      o Android suspende em segundo plano) e por uma notificação com vibração,
      que é o que faz o celular vibrar com a tela bloqueada.
   ========================================================= */

import { $, displayName, getEntry } from './helpers.js';
import { state } from './state.js';
import { ui } from './ui.js';

const REST_KEY = 'treino_rest_end';        // horário final guardado (sobrevive se o Android descartar a página)
const REST_STALE_MS = 10 * 60 * 1000;      // descanso terminado há mais que isso é ignorado ao reabrir
const VIBRATION = [300, 100, 300, 100, 300];

let counting = false;   // true enquanto há um descanso esperando para avisar
let target = null;      // { id, w }: exercício que ganha uma série feita quando este descanso terminar
let onSetDone = () => {};   // quem desenha a tela avisa isto (ligado em main.js)

export function setRestDoneHandler(handler) {
  onSetDone = handler;
}

/** Exercício atual: o primeiro (não pulado) que ainda não completou todas as séries. */
function currentTarget() {
  const session = state.cur;
  if (!session || !state.plan[session.w]) return null;
  for (const exercise of state.plan[session.w]) {
    const entry = getEntry(exercise);
    if (!entry.skip && (entry.ds || 0) < entry.s) return { id: exercise.id, w: session.w };
  }
  return null;
}

/** Conta uma série feita no exercício do descanso. Devolve o texto do aviso, ou null se não houver exercício. */
function completeSet(from) {
  if (!from || !state.cur || state.cur.w !== from.w) return null;
  const exercise = (state.plan[from.w] || []).find(item => item.id === from.id);
  if (!exercise) return null;

  const entry = getEntry(exercise);
  if (entry.skip) return null;
  entry.ds = Math.min((entry.ds || 0) + 1, entry.s);
  onSetDone();

  const name = displayName(exercise, entry);
  return entry.ds >= entry.s
    ? `${name}: ${entry.s}/${entry.s}, exercício concluído`
    : `${name}: ${entry.ds}/${entry.s} concluídas`;
}
let audio = null;       // <audio> único: toca o silêncio e depois o bipe
const urls = {};        // endereços (blob:) dos dois áudios gerados

/* ---------- áudios gerados no código (sem arquivos novos) ---------- */

function makeWavUrl(rate, seconds, sampleAt) {
  const total = Math.floor(rate * seconds);
  const buffer = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + total * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i++) view.setInt16(44 + i * 2, Math.round(sampleAt(i / rate) * 32767), true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function ensureAudio() {
  if (audio) return;
  // 30 Hz em volume mínimo: inaudível (o alto-falante nem reproduz), mas não é silêncio digital
  urls.silence = makeWavUrl(8000, 1, t => 0.002 * Math.sin(2 * Math.PI * 30 * t));
  // três bipes de 880 Hz (0,25 s de tom + 0,12 s de pausa)
  urls.beep = makeWavUrl(22050, 1.1, t => {
    const slot = t % 0.37;
    if (slot > 0.25 || t > 1.05) return 0;
    const fade = Math.min(1, slot / 0.01, (0.25 - slot) / 0.02);
    return 0.7 * fade * Math.sin(2 * Math.PI * 880 * t);
  });
  audio = new Audio();
  audio.preload = 'auto';
}

function setMediaSession(active) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = active
      ? new MediaMetadata({ title: 'Descanso em andamento', artist: 'Meu Treino' })
      : null;
    if (active) {
      navigator.mediaSession.setActionHandler('pause', stopRest);
      navigator.mediaSession.setActionHandler('stop', stopRest);
    }
  } catch (error) {
    // sem suporte: ignora
  }
}

function releaseAudio() {
  if (!audio) return;
  audio.onended = null;
  audio.pause();
  audio.removeAttribute('src');
  setMediaSession(false);
}

/* ---------- início, parada e fim ---------- */

/** Chamada a partir de um toque (o navegador só libera áudio e notificação assim). */
export function startRest(seconds) {
  ui.restEndsAt = Date.now() + seconds * 1000;
  counting = true;
  target = currentTarget();
  try {
    localStorage.setItem(REST_KEY, JSON.stringify({ end: ui.restEndsAt, target }));
  } catch (error) { /* ignora */ }

  askNotificationPermission();
  try {
    ensureAudio();
    audio.onended = null;
    audio.src = urls.silence;
    audio.loop = true;
    audio.play().catch(() => { /* sem áudio de apoio: o cronômetro segue só em primeiro plano */ });
    setMediaSession(true);
  } catch (error) {
    // sem suporte a áudio: ignora
  }

  clearInterval(ui.restInterval);
  ui.restInterval = setInterval(updateRestTimer, 250);
  updateRestTimer();
}

export function stopRest() {
  counting = false;
  target = null;
  clearInterval(ui.restInterval);
  try { localStorage.removeItem(REST_KEY); } catch (error) { /* ignora */ }
  releaseAudio();
  const label = $('#rest-timer');
  if (label) label.textContent = 'Descanso';
}

function finishRest() {
  counting = false;
  clearInterval(ui.restInterval);
  try { localStorage.removeItem(REST_KEY); } catch (error) { /* ignora */ }
  const label = $('#rest-timer');
  if (label) label.textContent = 'Pronto!';

  const message = completeSet(target);   // o descanso terminou: a série conta como feita
  target = null;

  playAlertSound();
  vibrate();
  if (document.visibilityState !== 'visible') notifyRestDone(message);
}

/** Ao reabrir o app (ou se o Android descartou a página): retoma ou mostra "Pronto!". */
export function restoreRest() {
  let saved = 0;
  let savedTarget = null;
  try {
    const raw = localStorage.getItem(REST_KEY);
    const data = raw && raw.startsWith('{') ? JSON.parse(raw) : { end: +raw || 0 };
    saved = +data.end || 0;
    savedTarget = data.target || null;
  } catch (error) { /* ignora */ }
  if (!saved) return;

  const now = Date.now();
  if (saved > now) {
    ui.restEndsAt = saved;
    target = savedTarget;
    counting = true;
    clearInterval(ui.restInterval);
    ui.restInterval = setInterval(updateRestTimer, 250);
    updateRestTimer();
  } else {
    try { localStorage.removeItem(REST_KEY); } catch (error) { /* ignora */ }
    const label = $('#rest-timer');
    if (label && now - saved < REST_STALE_MS) {
      label.textContent = 'Pronto!';
      completeSet(savedTarget);   // terminou com o app fechado: a série conta mesmo assim
    }
  }
}

/** Chamada quando o app volta a ficar visível: acerta o relógio na hora. */
export function refreshRest() {
  if (counting) updateRestTimer();
}

/* ---------- avisos ---------- */

function askNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  } catch (error) {
    // sem suporte: ignora
  }
}

function notifyRestDone(message) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(registration =>
      registration.showNotification('Descanso terminado', {
        body: message || 'Hora da próxima série.',
        icon: 'icon-192.png',
        tag: 'descanso',
        renotify: true,
        vibrate: VIBRATION,
      })
    ).catch(() => { /* ignora */ });
  } catch (error) {
    // sem suporte: ignora
  }
}

function playAlertSound() {
  try {
    ensureAudio();
    audio.onended = releaseAudio;
    audio.loop = false;
    audio.src = urls.beep;
    audio.currentTime = 0;
    audio.play().catch(() => playBeep());
  } catch (error) {
    playBeep();
  }
}

/** Plano B: bipe por WebAudio (funciona com o app aberto na tela). */
export function playBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    oscillator.connect(context.destination);
    oscillator.frequency.value = 880;   // tom do alerta (Hz)
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
  } catch (error) {
    // sem suporte a áudio: ignora
  }
}

export function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate(VIBRATION);
  } catch (error) {
    // sem suporte a vibração: ignora
  }
}

export function updateRestTimer() {
  if (!counting) return;
  const secondsLeft = Math.ceil((ui.restEndsAt - Date.now()) / 1000);

  if (secondsLeft <= 0) {
    finishRest();
    return;
  }
  const label = $('#rest-timer');
  if (!label) return;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  label.textContent = `${minutes}:${seconds}`;
}

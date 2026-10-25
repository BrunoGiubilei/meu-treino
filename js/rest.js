/* =========================================================
   Meu Treino — Cronômetro de descanso (bipe e vibração).
   ========================================================= */

import { $ } from './helpers.js';
import { ui } from './ui.js';

export function startRest(seconds) {
  ui.restEndsAt = Date.now() + seconds * 1000;
  clearInterval(ui.restInterval);
  ui.restInterval = setInterval(updateRestTimer, 250);
  updateRestTimer();
}

export function playBeep() {
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

export function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  } catch (error) {
    // sem suporte a vibração: ignora
  }
}

export function updateRestTimer() {
  const secondsLeft = Math.ceil((ui.restEndsAt - Date.now()) / 1000);
  const label = $('#rest-timer');

  if (secondsLeft <= 0) {
    clearInterval(ui.restInterval);
    label.textContent = 'Pronto!';
    playBeep();
    vibrate();
  } else {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, '0');
    label.textContent = `${minutes}:${seconds}`;
  }
}

/* =========================================================
   Meu Treino — Ponto de entrada: liga as peças e desenha a primeira tela.
   ========================================================= */

import { markChanged, setRenderer, syncNow } from './cloud.js';
import { bindEvents } from './events.js';
import { onStateChanged } from './state.js';
import { render } from './views/render.js';

onStateChanged(markChanged);   // dado mudou -> a sincronização é avisada
setRenderer(render);           // a sincronização sabe redesenhar a tela
bindEvents();

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

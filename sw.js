/* =========================================================
   Service Worker — faz o app funcionar offline

   IMPORTANTE: sempre que alterar index.html, style.css, app.js
   ou qualquer outro arquivo da lista abaixo (inclusive os de js/), aumente o número de
   CACHE_NAME (treino-v2 -> treino-v3...). Sem isso, o celular
   continua usando os arquivos antigos guardados no cache.
   ========================================================= */
const CACHE_NAME = 'treino-v7';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './js/actions.js',
  './js/cloud.js',
  './js/config.js',
  './js/defaults.js',
  './js/events.js',
  './js/helpers.js',
  './js/main.js',
  './js/rest.js',
  './js/state.js',
  './js/ui.js',
  './js/views/components.js',
  './js/views/edit.js',
  './js/views/history.js',
  './js/views/home.js',
  './js/views/render.js',
  './js/views/treino.js',
  './js/views/workout.js'
];

// Instalação: guarda todos os arquivos no cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' ignora o cache HTTP do navegador e busca a versão nova do servidor
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting(); // ativa a versão nova sem esperar fechar o app
});

// Ativação: apaga caches de versões antigas (ex.: treino-v1)
// Sem isso, o cache antigo continuaria respondendo antes do novo.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Requisições: responde com o cache; se não tiver, busca na rede
self.addEventListener('fetch', (event) => {
  // só cuida de GET do próprio app; a API (outro domínio, PUT) passa direto
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

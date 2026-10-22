/* =========================================================
   Service Worker — faz o app funcionar offline

   IMPORTANTE: sempre que alterar index.html, style.css, app.js
   ou qualquer outro arquivo da lista abaixo, aumente o número de
   CACHE_NAME (treino-v2 -> treino-v3...). Sem isso, o celular
   continua usando os arquivos antigos guardados no cache.
   ========================================================= */
const CACHE_NAME = 'treino-v2';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png'
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
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

/* =========================================================
   Meu Treino — Versão do app (a mesma do CACHE_NAME do sw.js)

   Você só aumenta o número no sw.js; o app mostra aqui:
   - loaded: a versão dos arquivos que esta aba está usando
     (lida de dentro do sw.js guardado no cache, junto com o resto do app);
   - active: a versão do service worker ativo agora. Se for diferente de loaded,
     já existe uma versão mais nova instalada: basta fechar e abrir o app.
   ========================================================= */

const VERSION_PATTERN = /const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/;

export const appVersion = { loaded: '', active: '' };

async function readLoadedVersion() {
  try {
    const response = await fetch('sw.js');
    if (!response.ok) return '';
    const match = (await response.text()).match(VERSION_PATTERN);
    return match ? match[1] : '';
  } catch (error) {
    return '';
  }
}

/** Pergunta ao service worker ativo qual é a versão dele (responde '' se não houver). */
function askActiveVersion() {
  if (!('serviceWorker' in navigator)) return Promise.resolve('');
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(''), 1500);
    const finish = value => { clearTimeout(timer); resolve(value); };
    navigator.serviceWorker.ready.then(registration => {
      const worker = registration.active;
      if (!worker) return finish('');
      const channel = new MessageChannel();
      channel.port1.onmessage = event => finish(String(event.data || ''));
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    }).catch(() => finish(''));
  });
}

/** Escreve a versão em todos os lugares que a mostram (.js-version) e o aviso de atualização. */
export function showVersion() {
  const shown = appVersion.loaded || appVersion.active || 'indisponível';
  document.querySelectorAll('.js-version').forEach(element => { element.textContent = shown; });

  const outdated = appVersion.loaded && appVersion.active && appVersion.loaded !== appVersion.active;
  document.querySelectorAll('.js-version-note').forEach(element => {
    element.hidden = !outdated;
    element.textContent = outdated
      ? `Há uma versão mais nova instalada (${appVersion.active}). Feche e abra o app para usá-la.`
      : '';
  });
}

/** Busca as duas versões sem travar a abertura do app. */
export async function loadVersions() {
  appVersion.loaded = await readLoadedVersion();
  showVersion();
  appVersion.active = await askActiveVersion();
  showVersion();
}

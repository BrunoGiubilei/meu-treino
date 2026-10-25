/* =========================================================
   Meu Treino — Sincronização com a nuvem (Cloudflare Worker + D1).

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

import { API_URL, SAFETY_COPY_KEY, STORAGE_KEY, SYNC_DELAY_MS, SYNC_META_KEY, TOKEN_KEY } from './config.js';
import { $, showToast } from './helpers.js';
import { normalizeState, setState, snapshotSaved, state } from './state.js';
import { ui } from './ui.js';

/** A tela é desenhada por quem registrar aqui (evita o módulo da nuvem depender das telas). */
let renderScreen = () => {};

export function setRenderer(fn) {
  renderScreen = fn;
}

export const cloud = {
  meta: loadSyncMeta(),   // { rev: número ou null (nunca sincronizou), dirty: true/false }
  status: 'idle',         // 'idle' | 'syncing' | 'ok' | 'offline' | 'auth' | 'conflict'
  conflict: null,         // { remote: { rev, state } ou null se a nuvem está vazia }
  busy: false,            // true enquanto há uma chamada à nuvem em andamento
  pushTimer: null,
  changeCounter: 0,       // conta mudanças locais (para saber se mudou durante o envio)
};

export function loadSyncMeta() {
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

export function saveSyncMeta() {
  try {
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(cloud.meta));
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (error) {
    return '';
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    showToast('Não foi possível guardar o token');
  }
}

/** Texto curto para o resumo de um estado (usado na tela de conflito). */
export function describeState(data) {
  const total = data.hist.length;
  if (!total) return 'nenhum treino registrado';
  const last = new Date(data.hist[0].d).toLocaleDateString('pt-BR');
  return `${total} ${total === 1 ? 'treino' : 'treinos'}, o último em ${last}`;
}

export function syncLabel() {
  if (!getToken()) return 'Nuvem desligada';
  if (cloud.status === 'conflict') return 'Nuvem: escolha qual versão manter';
  if (cloud.status === 'auth') return 'Nuvem: token recusado';
  if (cloud.status === 'syncing') return 'Nuvem: sincronizando…';
  if (cloud.meta.rev === null) return 'Nuvem: aguardando a primeira sincronização';
  if (cloud.meta.dirty) {
    return cloud.status === 'offline' ? 'Nuvem: pendente, sem conexão' : 'Nuvem: salvando…';
  }
  return 'Nuvem: sincronizado';
}

export function updateSyncLabel() {
  const label = $('#sync-status');
  if (label) label.textContent = syncLabel();
}

/** Troca o status. Redesenha a tela só quando o cartão de conflito aparece ou some. */
export function setSyncStatus(next) {
  const conflictChanged = (next === 'conflict') !== (cloud.status === 'conflict');
  if (next === 'auth' && cloud.status !== 'auth') showToast('A nuvem recusou o token');
  cloud.status = next;
  if (conflictChanged && ui.currentView === 'home') renderScreen();
  else updateSyncLabel();
}

/** Chamada pelo saveState quando os dados mudaram de verdade. */
export function markChanged() {
  cloud.changeCounter++;
  if (!cloud.meta.dirty) {
    cloud.meta.dirty = true;
    saveSyncMeta();
  }
  updateSyncLabel();
  schedulePush();
}

export function schedulePush() {
  clearTimeout(cloud.pushTimer);
  if (!getToken() || cloud.meta.rev === null || cloud.conflict || cloud.status === 'auth') return;
  cloud.pushTimer = setTimeout(pushPending, SYNC_DELAY_MS);
}

export function apiFetch(path, options = {}) {
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
export async function fetchRemote() {
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

/** Envia o estado atual. Só deve ser chamada quando cloud.meta.rev é um número. */
export async function doPush() {
  const sentAt = cloud.changeCounter;
  const response = await apiFetch('/state', {
    method: 'PUT',
    body: JSON.stringify({ baseRev: cloud.meta.rev, state }),
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
    cloud.conflict = { remote: result.remote };
    setSyncStatus('conflict');
    return;
  }

  if (!response.ok) throw new Error('PUT /state: ' + response.status);

  const { rev } = await response.json();
  cloud.meta.rev = rev;
  if (sentAt === cloud.changeCounter) cloud.meta.dirty = false;   // mudou durante o envio? continua pendente
  saveSyncMeta();
  setSyncStatus('ok');
  if (cloud.meta.dirty) schedulePush();
}

/** Envio disparado pelo temporizador (depois de uma mudança). */
export async function pushPending() {
  if (cloud.busy) {
    schedulePush();
    return;
  }
  if (!getToken() || cloud.meta.rev === null || cloud.conflict) return;

  cloud.busy = true;
  setSyncStatus('syncing');
  try {
    await doPush();
  } catch (error) {
    setSyncStatus('offline');   // sem rede ou erro do servidor: continua pendente
  } finally {
    cloud.busy = false;
  }
}

/** Troca os dados deste aparelho pelos da nuvem, guardando antes uma cópia dos atuais. */
export function adoptRemote(remote) {
  try {
    localStorage.setItem(SAFETY_COPY_KEY, JSON.stringify(state));
  } catch (error) {
    // sem espaço: segue mesmo assim
  }
  setState(normalizeState(remote.state));
  const savedJson = snapshotSaved();
  try {
    localStorage.setItem(STORAGE_KEY, savedJson);
  } catch (error) {
    // armazenamento cheio ou bloqueado: ignora
  }
  cloud.meta = { rev: remote.rev, dirty: false };
  saveSyncMeta();
  cloud.conflict = null;
  cloud.status = 'ok';
}

/** Compara este aparelho com a nuvem e decide: nada a fazer, enviar, receber ou pedir escolha. */
export async function reconcile(remote) {
  const remoteRev = remote ? remote.rev : 0;

  if (cloud.meta.rev === null) {
    // primeira vez neste aparelho: quem decide é você
    cloud.conflict = { remote };
    setSyncStatus('conflict');
  } else if (remoteRev === cloud.meta.rev) {
    if (cloud.meta.dirty) await doPush();
    else setSyncStatus('ok');
  } else if (remote && !cloud.meta.dirty) {
    // a nuvem está mais nova e este aparelho não tem nada pendente: só atualiza
    adoptRemote(remote);
    renderScreen();
  } else {
    // as duas mudaram (ou a nuvem foi esvaziada): quem decide é você
    cloud.conflict = { remote };
    setSyncStatus('conflict');
  }
}

/** Lê a nuvem e sincroniza. Roda ao abrir o app, ao voltar para ele e ao recuperar a conexão. */
export async function syncNow() {
  if (!getToken() || cloud.busy || cloud.conflict) return;

  cloud.busy = true;
  setSyncStatus('syncing');
  try {
    const result = await fetchRemote();
    if (result.auth) setSyncStatus('auth');
    else await reconcile(result.remote);
  } catch (error) {
    setSyncStatus('offline');
  } finally {
    cloud.busy = false;
  }
}

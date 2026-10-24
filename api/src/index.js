// Origens autorizadas a chamar a API pelo navegador.
// A origem NÃO inclui o caminho do repositório.
const ALLOWED_ORIGINS = [
  "https://brunogiubilei.github.io",
  // Para testar o app localmente, descomente e ajuste a porta:
  // "http://localhost:8000",
];

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB é bem mais que o estado do app

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Compara o token em tempo constante (hash SHA-256 dos dois lados
// garante o mesmo tamanho para o timingSafeEqual).
async function tokenValido(request, env) {
  if (!env.API_TOKEN) return false; // sem segredo configurado, nega tudo

  const match = (request.headers.get("Authorization") || "").match(
    /^Bearer (.+)$/
  );
  if (!match) return false;

  const enc = new TextEncoder();
  const [enviado, esperado] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(match[1])),
    crypto.subtle.digest("SHA-256", enc.encode(env.API_TOKEN)),
  ]);
  return crypto.subtle.timingSafeEqual(enviado, esperado);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const origin = request.headers.get("Origin");

    // Se veio de um navegador, a origem precisa estar na lista.
    // Chamadas sem Origin (curl, testes locais) seguem para a checagem do token.
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return Response.json({ error: "Origem não permitida." }, { status: 403 });
    }

    const cors = origin ? corsHeaders(origin) : {};
    const responder = (data, status = 200, extra = {}) =>
      Response.json(data, { status, headers: { ...cors, ...extra } });

    // Preflight: o navegador não envia o Authorization nele,
    // por isso responde antes da autenticação.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!(await tokenValido(request, env))) {
      return responder({ error: "Não autorizado." }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }

    // GET /state  ->  { rev, state }   (404 se ainda não há nada salvo)
    if (pathname === "/state" && request.method === "GET") {
      const row = await env.meu_treino_db
        .prepare("SELECT state_json, rev FROM app_state WHERE id = 1")
        .first();

      if (!row) {
        return responder({ error: "Ainda não há estado salvo." }, 404);
      }

      return responder(
        { rev: row.rev, state: JSON.parse(row.state_json) },
        200,
        { "Cache-Control": "no-store" }
      );
    }

    // PUT /state  <-  { baseRev, state }
    // Só grava se baseRev for a revisão atual do servidor (0 = servidor vazio).
    if (pathname === "/state" && request.method === "PUT") {
      const texto = await request.text();

      if (texto.length > MAX_BODY_BYTES) {
        return responder({ error: "Corpo grande demais." }, 413);
      }

      let corpo;
      try {
        corpo = JSON.parse(texto);
      } catch {
        return responder(
          { error: "O corpo da requisição precisa ser JSON válido." },
          400
        );
      }

      const { baseRev, state } = corpo || {};

      if (!Number.isInteger(baseRev) || baseRev < 0) {
        return responder({ error: "baseRev inválido." }, 400);
      }

      if (
        !state ||
        typeof state !== "object" ||
        !state.plan ||
        !Array.isArray(state.hist) ||
        !state.last ||
        !("cur" in state)
      ) {
        return responder({ error: "Formato de state inválido." }, 400);
      }

      const json = JSON.stringify(state);
      const agora = Date.now();

      // 1) Caso normal: atualiza se a revisão bate.
      let resultado = await env.meu_treino_db
        .prepare(
          `UPDATE app_state
           SET state_json = ?, updated_at = ?, rev = rev + 1
           WHERE id = 1 AND rev = ?`
        )
        .bind(json, agora, baseRev)
        .run();

      if (resultado.meta.changes === 1) {
        return responder({ ok: true, rev: baseRev + 1 });
      }

      // 2) Primeira gravação: servidor vazio e o app diz que espera isso.
      if (baseRev === 0) {
        resultado = await env.meu_treino_db
          .prepare(
            `INSERT OR IGNORE INTO app_state (id, state_json, updated_at, rev)
             VALUES (1, ?, ?, 1)`
          )
          .bind(json, agora)
          .run();

        if (resultado.meta.changes === 1) {
          return responder({ ok: true, rev: 1 });
        }
      }

      // 3) Conflito: o servidor mudou desde a última leitura do app.
      const atual = await env.meu_treino_db
        .prepare("SELECT rev FROM app_state WHERE id = 1")
        .first();

      return responder(
        { error: "Conflito: o servidor tem uma versão diferente.", rev: atual ? atual.rev : 0 },
        409
      );
    }

    return responder({ error: "Rota não encontrada." }, 404);
  },
};

/* Token App Check de teste (RS256) para as rotas /ai e /quota.
   O Worker exige X-Firebase-AppCheck; os testes assinam um JWT próprio com
   par de chaves gerado no arquivo de teste e servem a JWKS correspondente
   pelo stub de fetch. Nenhuma chave real e nenhuma volta em produção. */
import crypto from "node:crypto";

/* Trecho do endpoint de JWKS que o appcheck.js consulta (com códigos de
   versão da API: /v1/jwks). O stub de fetch de cada teste usa isto. */
export const APP_CHECK_JWKS_FRAGMENT = "firebaseappcheck.googleapis.com/v1/jwks";

function b64url(value) {
  return Buffer.from(value).toString("base64url");
}

export function makeAppCheckToken(privateKey, projectId, { kid = "test-key-1" } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const body = b64url(
    JSON.stringify({
      iss: `https://firebaseappcheck.googleapis.com/${projectId}`,
      aud: projectId,
      sub: "app-check-teste",
      iat: now,
      exp: now + 3600
    })
  );
  const data = `${head}.${body}`;
  const sig = crypto.sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url");
  return `${data}.${sig}`;
}

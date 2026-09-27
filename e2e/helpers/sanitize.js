/* C.O.D.E. — sanitização de texto para relatórios/evidências (FASE 12).
   Regra: nenhum artefato gerado pelo C.O.D.E. pode conter e-mail completo,
   senha ou token. Este módulo é puro (sem rede/arquivo) para ser auditável
   pelos testes em e2e/security/security.test.mjs. */
'use strict';

function maskEmailLike(m) {
  const at = m.indexOf('@');
  const local = m.slice(0, at);
  const keep = local.slice(0, Math.min(8, Math.max(3, local.length - 6)));
  return `${keep}***${m.slice(at)}`;
}

function sanitizeText(text) {
  let t = String(text == null ? '' : text);
  /* e-mails → local mascarado + domínio preservado */
  t = t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, maskEmailLike);
  /* pares chave=valor sensíveis → valor oculto */
  t = t.replace(
    /(password|senha|idtoken|accesstoken|refreshtoken|apikey|authorization)(["']?\s*[:=]\s*["']?)[^"'\s,;&)]+/gi,
    '$1$2***'
  );
  /* trechos longos tipo token/senha (base64url, hex) → prefixo…sufixo */
  t = t.replace(/\b[A-Za-z0-9_-]{30,}\b/g, (m) => `${m.slice(0, 6)}…${m.slice(-4)}`);
  return t;
}

module.exports = { sanitizeText };

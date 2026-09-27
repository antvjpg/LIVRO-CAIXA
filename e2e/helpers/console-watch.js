/* C.O.D.E. — observabilidade de console/rede com classificação documentada.
   Critérios (e2e/README.md §Console):
     ERROR   = uncaught exception, rejection não tratada, console.error, HTTP 5xx
     WARNING = HTTP 4xx, falha de request, console.warn
     INFO    = request abortada/cancelada, demais eventos
   Os testes falham apenas por ERROR de página (pageerror); console.error vira
   evidência visível no relatório (não mascara nem esconde o achado). */
'use strict';

function sanitize(text) {
  let s = String(text).slice(0, 800);
  s = s.replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED-JWT]');
  s = s.replace(/\b(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{20,})\b/g, '[REDACTED-KEY]');
  s = s.replace(/([?&](key|token|access_token)=)[^&\s]+/gi, '$1[REDACTED]');
  return s;
}

function watchPage(page) {
  const events = [];
  const push = (e) => events.push({ t: new Date().toISOString(), ...e, text: sanitize(e.text) });

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') push({ level: 'ERROR', kind: 'console.error', text: msg.text() });
    else if (type === 'warning') push({ level: 'WARNING', kind: 'console.warn', text: msg.text() });
  });
  page.on('pageerror', (err) => push({ level: 'ERROR', kind: 'pageerror', text: String(err) }));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText || '';
    const aborted = /abort|ERR_ABORTED/i.test(failure);
    push({
      level: aborted ? 'INFO' : 'WARNING',
      kind: 'requestfailed',
      text: `${req.method()} ${req.url()} — ${failure}`,
    });
  });
  page.on('response', (res) => {
    const status = res.status();
    if (status >= 500) push({ level: 'ERROR', kind: 'http', text: `${status} ${res.url()}` });
    else if (status >= 400) push({ level: 'WARNING', kind: 'http', text: `${status} ${res.url()}` });
  });

  return {
    events,
    /* erro de página = falha dura do app (sempre reprova o teste) */
    pageErrors: () => events.filter((e) => e.kind === 'pageerror'),
    byLevel: (level) => events.filter((e) => e.level === level),
    counts() {
      return {
        ERROR: events.filter((e) => e.level === 'ERROR').length,
        WARNING: events.filter((e) => e.level === 'WARNING').length,
        INFO: events.filter((e) => e.level === 'INFO').length,
      };
    },
    attach(testInfo) {
      if (!events.length) return;
      const payload = events.map((e) => `[${e.t}] ${e.level} ${e.kind}: ${e.text}`).join('\n');
      testInfo.attach('console-evidencia.txt', { body: payload, contentType: 'text/plain' });
    },
  };
}

module.exports = { watchPage, sanitize };

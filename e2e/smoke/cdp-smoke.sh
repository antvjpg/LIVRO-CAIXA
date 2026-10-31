#!/bin/bash
# LIVRO-CAIXA · e2e/smoke/cdp-smoke.sh
# Smoke test via Chromium headless + CDP
# Roda em: bash e2e/smoke/cdp-smoke.sh

set -e

CHROMIUM="chromium-browser"
DEBUG_PORT=9223
HTTP_PORT=8081
PROFILE_DIR="/data/data/com.termux/files/usr/tmp/opencode/chromium-profile-smoke"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

mkdir -p "$PROFILE_DIR"

# Limpar processos anteriores
pkill -f "chromium-browser.*$DEBUG_PORT" 2>/dev/null || true
pkill -f "node.*http-server.*$HTTP_PORT" 2>/dev/null || true
sleep 1

# Iniciar servidor HTTP em background (dentro deste script)
node -e "
const { createServer } = require('http');
const fs = require('fs');
const path = require('path');
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:${HTTP_PORT}');
  let filePath = path.join('${ROOT}', url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  try {
    await fs.promises.stat(filePath);
    res.writeHead(200, { 'Content-Type': url.pathname.endsWith('.js') ? 'application/javascript' : 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } catch(e) { res.writeHead(404); res.end('not found'); }
});
server.listen(${HTTP_PORT}, '127.0.0.1', () => {});
" > /dev/null 2>&1 &
SERVER_PID=$!

# Aguardar servidor
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://127.0.0.1:${HTTP_PORT}/index.html" 2>/dev/null; then
    break
  fi
  sleep 0.5
done

# Iniciar Chromium em background
$CHROMIUM --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --no-first-run --no-default-browser-check \
  --remote-debugging-port=${DEBUG_PORT} \
  --user-data-dir="${PROFILE_DIR}" \
  "http://127.0.0.1:${HTTP_PORT}/index.html" \
  > /dev/null 2>&1 &
CHROMIUM_PID=$!

# Aguardar CDP
for i in $(seq 1 60); do
  if curl -s "http://127.0.0.1:${DEBUG_PORT}/json/list" 2>/dev/null | grep -q "index.html"; then
    break
  fi
  sleep 0.5
done

# Rodar teste CDP via Node.js
node -e "
const http = require('http');
const DEBUG_PORT = ${DEBUG_PORT};

function cdpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: DEBUG_PORT, path, method,
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body)) } : {} };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function cdpListTargets() { return cdpRequest('GET', '/json/list'); }
async function cdpSend(sessionId, method, params = {}) {
  return cdpRequest('POST', '/session/' + sessionId, { id: 1, method, params });
}
async function evalInPage(sessionId, expression) {
  const res = await cdpSend(sessionId, 'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.result && res.result.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.text || 'erro');
  return res.result && res.result.value !== undefined ? res.result.value : res.result;
}

(async () => {
  const targets = await cdpListTargets();
  const target = targets.find(t => t.type === 'page' && t.url.includes('index.html'));
  if (!target) { console.log('❌ Nenhum alvo CDP encontrado'); process.exit(1); }
  const sessionId = target.id;
  await cdpSend(sessionId, 'Runtime.enable');
  await new Promise(r => setTimeout(r, 6000));

  const checks = [
    ['origem carregada', () => evalInPage(sessionId, '!!window.location.origin')],
    ['authOverlay oculto', () => evalInPage(sessionId, 'document.getElementById(\"authOverlay\")?.classList.contains(\"hidden\") === true')],
    ['logInfo exposto', () => evalInPage(sessionId, 'typeof window.logInfo === \"function\"')],
    ['logWarn exposto', () => evalInPage(sessionId, 'typeof window.logWarn === \"function\"')],
    ['logSyncError exposto', () => evalInPage(sessionId, 'typeof window.logSyncError === \"function\"')],
    ['recordLogEvent exposto', () => evalInPage(sessionId, 'typeof window.recordLogEvent === \"function\"')],
    ['exportDiagnosticLog exposto', () => evalInPage(sessionId, 'typeof window.exportDiagnosticLog === \"function\"')],
    ['recordAuditEvent exposto', () => evalInPage(sessionId, 'typeof window.recordAuditEvent === \"function\"')],
    ['getAuditTrailPage exposto', () => evalInPage(sessionId, 'typeof window.getAuditTrailPage === \"function\"')],
    ['btnOpenDrawer presente', () => evalInPage(sessionId, '!!document.getElementById(\"btnOpenDrawer\")')],
    ['panelDiagnostico presente', () => evalInPage(sessionId, '!!document.getElementById(\"panelDiagnostico\")')],
    ['btnToggleLogFiltros presente', () => evalInPage(sessionId, '!!document.getElementById(\"btnToggleLogFiltros\")')],
    ['btnCopyDiagnostico presente', () => evalInPage(sessionId, '!!document.getElementById(\"btnCopyDiagnostico\")')],
    ['btnExportDiagnostico presente', () => evalInPage(sessionId, '!!document.getElementById(\"btnExportDiagnostico\")')],
    ['btnClearDiagnostico presente', () => evalInPage(sessionId, '!!document.getElementById(\"btnClearDiagnostico\")')],
    ['logFilterType presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterType\")')],
    ['logFilterAction presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterAction\")')],
    ['logFilterModule presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterModule\")')],
    ['logFilterStatus presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterStatus\")')],
    ['logFilterSource presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterSource\")')],
    ['logFilterText presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterText\")')],
    ['logFilterCorrelation presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterCorrelation\")')],
    ['logFilterStart presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterStart\")')],
    ['logFilterEnd presente', () => evalInPage(sessionId, '!!document.getElementById(\"logFilterEnd\")')],
    ['diagnosticoList presente', () => evalInPage(sessionId, '!!document.getElementById(\"diagnosticoList\")')],
    ['logStats presente', () => evalInPage(sessionId, '!!document.getElementById(\"logStats\")')],
  ];

  let failures = [];
  console.log('[smoke] verificações...');
  for (const [nome, fn] of checks) {
    try {
      const resultado = await fn();
      const ok = resultado === true || (typeof resultado === 'string' && resultado.length > 0) || (typeof resultado === 'number' && resultado > 0);
      if (!ok) failures.push('verificação falhou: ' + nome + ' (resultado: ' + JSON.stringify(resultado) + ')');
      else console.log('  ✅ ' + nome);
    } catch (err) {
      failures.push('exceção em ' + nome + ': ' + err.message);
    }
  }

  await cdpSend(sessionId, 'Runtime.evaluate', { expression: 'window.__smokeErrors=[];const _e=console.error;console.error=function(...a){window.__smokeErrors.push(a.map(String).join(\" \"));_e.apply(console,a);}', returnByValue: true });
  await new Promise(r => setTimeout(r, 2000));
  const erros = await evalInPage(sessionId, 'window.__smokeErrors||[]');
  if (Array.isArray(erros) && erros.length > 0) failures.push(erros.length + ' erros no console: ' + JSON.stringify(erros.slice(0,5)));
  else console.log('  ✅ sem erros no console');

  console.log('\n========================================');
  console.log('[smoke] RESULTADO');
  console.log('========================================');
  if (failures.length === 0) {
    console.log('[smoke] ✅ SUCESSO — app carrega sem erros críticos');
    process.exit(0);
  } else {
    console.log('[smoke] ❌ FALHA — ' + failures.length + ' problema(s):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
})();
"

RESULTADO=$?

# Limpar processos
kill $SERVER_PID 2>/dev/null || true
kill $CHROMIUM_PID 2>/dev/null || true
pkill -f "chromium-browser.*$DEBUG_PORT" 2>/dev/null || true
pkill -f "node.*http-server.*$HTTP_PORT" 2>/dev/null || true

exit $RESULTADO

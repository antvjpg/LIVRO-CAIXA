/* LIVRO-CAIXA · js/33-mcp-bridge.js — Ponte de IA (MCP read-only, Fase 2/6).
   Responsabilidades:
     1) depositar o snapshot externo no Worker (POST /bridge/snapshot,
        ID token do Firebase; o Worker guarda 1 h no KV e NUNCA lê o
        Firestore em tempo de requisição);
     2) emitir/revogar o token MCP do usuário (POST/DELETE /bridge/token),
        com o token bruto exibido apenas uma vez na tela;
     3) manter o depósito fresco (inicial + a cada 15 min com sessão ativa).
   O envelope é montado por mcp-financial-contract.js (fonte única, mesma
   sanitização que a ferramenta MCP serve). Nenhuma escrita financeira:
   este módulo só transporta dados de leitura já construídos pelo app. */
(function () {
  'use strict';

  const DEPOSIT_INITIAL_DELAY_MS = 4000;
  const DEPOSIT_INTERVAL_MS = 15 * 60 * 1000;
  const DEPOSIT_MIN_GAP_MS = 10000;

  let depositTimer = null;
  let depositInFlight = false;
  let lastDepositAt = 0;
  let lastIssuedToken = '';

  function workerBase() {
    try {
      return typeof AI_WORKER_ENDPOINT === 'string'
        ? AI_WORKER_ENDPOINT.replace(/\/ai$/, '')
        : '';
    } catch (err) {
      return '';
    }
  }

  function currentUser() {
    try {
      return typeof auth !== 'undefined' ? auth?.currentUser : null;
    } catch (err) {
      return null;
    }
  }

  function statusEl() {
    return document.getElementById('mcpBridgeStatus');
  }

  function setStatus(text, kind) {
    const el = statusEl();
    if (!el) return;
    el.textContent = text || '';
    el.dataset.state = kind || '';
  }

  /* Requisição autenticada da ponte: ID token do Firebase. */
  async function bridgeFetch(path, { method = 'POST', body } = {}) {
    const base = workerBase();
    if (!base) {
      const err = new Error('Ponte não configurada.');
      err.code = 'bridge_not_configured';
      throw err;
    }
    const user = currentUser();
    if (!user) {
      const err = new Error('Entre na sua conta para usar a conexão externa.');
      err.code = 'not_authenticated';
      throw err;
    }

    let idToken = '';
    try {
      idToken = await user.getIdToken();
    } catch (err) {
      const tokenErr = new Error('Não foi possível validar a sessão.');
      tokenErr.code = 'token_failed';
      throw tokenErr;
    }

    const init = {
      method,
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    };
    if (body !== undefined) init.body = JSON.stringify(body);

    let response;
    try {
      response = await fetch(base + path, init);
    } catch (networkError) {
      const err = new Error('Falha de rede ao falar com a ponte. Verifique a conexão.');
      err.code = 'network';
      throw err;
    }

    let parsed = null;
    try {
      const raw = await response.text().catch(() => '');
      parsed = raw ? JSON.parse(raw) : null;
    } catch (err) {
      parsed = null;
    }

    if (!response.ok) {
      const err = new Error(parsed?.error || `A ponte respondeu com erro ${response.status}.`);
      err.status = response.status;
      err.code = parsed?.code || `http_${response.status}`;
      throw err;
    }
    return parsed;
  }

  /* Monta o envelope externo (sanitizado) e deposita no Worker. */
  async function depositSnapshot(options = {}) {
    const manual = Boolean(options.manual);
    if (depositInFlight) return { ok: false, code: 'in_flight' };
    if (manual && Date.now() - lastDepositAt < DEPOSIT_MIN_GAP_MS) {
      return { ok: false, code: 'too_soon' };
    }

    depositInFlight = true;
    if (manual) setStatus('Atualizando dados externos…', 'busy');
    try {
      const contract = globalThis.LivroCaixaMcpContract;
      if (!contract || typeof contract.buildExternalSnapshotResult !== 'function') {
        const err = new Error('Contrato da ponte indisponível.');
        err.code = 'contract_unavailable';
        throw err;
      }
      if (typeof buildGeminiFinancialSnapshot !== 'function') {
        const err = new Error('Gerador de snapshot indisponível.');
        err.code = 'snapshot_builder_unavailable';
        throw err;
      }

      const built = contract.buildExternalSnapshotResult(buildGeminiFinancialSnapshot());
      if (!built.ok) {
        const err = new Error(built.body?.error || 'Snapshot local inválido.');
        err.code = built.body?.code || 'invalid_snapshot';
        throw err;
      }

      const result = await bridgeFetch('/bridge/snapshot', { body: built.value });
      lastDepositAt = Date.now();
      const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setStatus(
        `Dados externos atualizados às ${time} (${Math.max(1, Math.round((result?.bytes || 0) / 1024))} KB). A IA externa pode consultar por 1 hora.`,
        'ok'
      );
      return { ok: true };
    } catch (err) {
      if (manual) {
        setStatus(`Não foi possível atualizar: ${err.message || 'erro desconhecido.'}`, 'error');
      }
      return { ok: false, code: err.code || 'unknown' };
    } finally {
      depositInFlight = false;
    }
  }

  /* Emite um novo token MCP. O bruto aparece SÓ nesta resposta; não vai
     para o armazenamento do dispositivo nem para logs — apenas para o
     campo na tela. */
  async function createToken() {
    try {
      const result = await bridgeFetch('/bridge/token');
      if (result?.token) {
        lastIssuedToken = result.token;
        const input = document.getElementById('inputMcpBridgeToken');
        const row = document.getElementById('mcpBridgeTokenRow');
        if (input) input.value = result.token;
        if (row) row.hidden = false;
        setStatus('Token gerado. Copie agora: ele não será exibido de novo após fechar a página.', 'ok');
        return result.token;
      }
      setStatus('Resposta inesperada ao gerar o token.', 'error');
      return '';
    } catch (err) {
      setStatus(`Não foi possível gerar o token: ${err.message || 'erro desconhecido.'}`, 'error');
      return '';
    }
  }

  async function revokeToken() {
    const input = document.getElementById('inputMcpBridgeToken');
    const token = String(input?.value || '').trim();
    if (!token) {
      setStatus('Cole o token que deseja revogar no campo indicado.', 'error');
      return false;
    }
    try {
      const result = await bridgeFetch('/bridge/token', { method: 'DELETE', body: { token } });
      if (result?.ok) {
        if (input) input.value = '';
        const row = document.getElementById('mcpBridgeTokenRow');
        if (row) row.hidden = true;
        lastIssuedToken = '';
        setStatus(result.revoked ? 'Token revogado. A IA externa perdeu o acesso.' : 'Esse token já não existia (expirou ou foi revogado).', 'ok');
        return true;
      }
      setStatus('Resposta inesperada ao revogar o token.', 'error');
      return false;
    } catch (err) {
      setStatus(`Não foi possível revogar: ${err.message || 'erro desconhecido.'}`, 'error');
      return false;
    }
  }

  async function copyToken() {
    const input = document.getElementById('inputMcpBridgeToken');
    const token = String(input?.value || '').trim();
    if (!token) return false;
    try {
      await navigator.clipboard.writeText(token);
      setStatus('Token copiado para a área de transferência.', 'ok');
      return true;
    } catch (err) {
      if (input) {
        input.focus();
        input.select?.();
      }
      setStatus('Não foi possível copiar automaticamente. O token está selecionado — copie manualmente.', 'error');
      return false;
    }
  }

  /* Conecta no claude.ai via fluxo "um clique":
     1) Pede código curto acc_ ao Worker (autenticado com ID token do Firebase)
     2) Abre /mcp/connect-claude?acc=acc_... — Worker faz DCR e redireciona para /authorize
        que auto-submete "Permitir" com o mxc_
     3) Redirect volta pro claude.ai */
  async function connectClaude() {
    const base = workerBase();
    if (!base) {
      setStatus('Ponte não configurada.', 'error');
      return;
    }
    const user = currentUser();
    if (!user) {
      setStatus('Entre na sua conta para usar a conexão externa.', 'error');
      return;
    }
    let idToken = '';
    try {
      idToken = await user.getIdToken();
    } catch (err) {
      setStatus('Não foi possível validar a sessão.', 'error');
      return;
    }
    try {
      setStatus('Preparando conexão...', 'info');
      const res = await fetch(`${base}/mcp/auth-code`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setStatus(errBody.error || `Falha ao preparar conexão (${res.status}).`, 'error');
        return;
      }
      const { code } = await res.json();
      if (!code || !code.startsWith('acc_')) {
        setStatus('Código de conexão inválido.', 'error');
        return;
      }
      /* Abre /mcp/connect-claude?acc=... — Worker faz DCR e redireciona para /authorize auto-submit. */
      const connectUrl = `${base}/mcp/connect-claude?acc=${encodeURIComponent(code)}`;
      setStatus('Abrindo tela de autorização...', 'info');
      window.open(connectUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setStatus(`Erro ao conectar: ${err.message || 'erro desconhecido.'}`, 'error');
    }
  }

  /* Depósito periódico enquanto há sessão: mantém o TTL de 1 h sempre
     preenchido sem nenhuma ação do usuário. */
  function scheduleAutoDeposit() {
    stopAutoDeposit();
    setTimeout(() => {
      depositSnapshot({ manual: false });
      depositTimer = setInterval(() => {
        depositSnapshot({ manual: false });
      }, DEPOSIT_INTERVAL_MS);
    }, DEPOSIT_INITIAL_DELAY_MS);
  }

  function stopAutoDeposit() {
    if (depositTimer) {
      clearInterval(depositTimer);
      depositTimer = null;
    }
  }

  function wireUi() {
    const on = (id, handler) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    };
    on('btnMcpBridgeDeposit', () => { depositSnapshot({ manual: true }); });
    on('btnMcpBridgeCreateToken', () => { createToken(); });
    on('btnMcpBridgeCopyToken', () => { copyToken(); });
    on('btnMcpBridgeRevokeToken', () => { revokeToken(); });
    on('btnMcpBridgeConnectClaude', () => { connectClaude(); });
  }

  try {
    wireUi();
    if (typeof auth !== 'undefined' && typeof auth.onAuthStateChanged === 'function') {
      auth.onAuthStateChanged(user => {
        if (user) scheduleAutoDeposit();
        else stopAutoDeposit();
      });
    }
  } catch (err) {
    /* Bootstrap parcial: a ponte simplesmente não liga; nada quebra. */
  }

  window.LivroCaixaMcpBridge = {
    depositSnapshot,
    createToken,
    revokeToken,
    copyToken
  };
})();

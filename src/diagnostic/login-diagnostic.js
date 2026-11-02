/**
 * Login Diagnostic Module
 * Accessible diagnostic console on login screen — robust against DOM load order.
 * Exposed as window.LivroCaixaLoginDiagnostic for external access.
 */
(function initLoginDiagnostic() {
  'use strict';

  const maxLines = 180;
  const state = { lines: [] };
  let initialized = false;

  function format(value) {
    if (value == null) return '';
    if (value instanceof Error) return value.message || String(value);

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, (key, val) =>
          /password|token|secret|authorization|apiKey|credential/i.test(key)
            ? '[oculto]'
            : val
        );
      } catch (_) {
        return String(value);
      }
    }

    return String(value);
  }

  function getEl(id) {
    return document.getElementById(id);
  }

  function render() {
    const el = document.getElementById('authDiagnosticLog');
    if (!el) return;

    el.textContent = state.lines.join('\n');
    el.style.textAlign = 'left';
    el.scrollTop = el.scrollHeight;
  }

  window.loginDebugLog = function(type, message, details) {
    const stamp = new Date().toLocaleTimeString('pt-BR', {
      hour12: false
    });

    const suffix =
      details === undefined ? '' : ' · ' + format(details);

    state.lines.push(
      stamp +
      ' [' +
      String(type || 'INFO').toUpperCase() +
      '] ' +
      message +
      suffix
    );

    if (state.lines.length > maxLines) {
      state.lines.splice(
        0,
        state.lines.length - maxLines
      );
    }

    render();

    /* Integração com o motor central de LOG (Fase 3):
       envia eventos de login com sanitização própria */
    try {
      if (typeof globalThis.recordLoginEvent === 'function') {
        globalThis.recordLoginEvent(type, message, details);
      }
    } catch (err) {
      /* logging nunca pode derrubar o fluxo */
    }
  };

  window.getLoginDiagnosticText = () =>
    state.lines.join('\n');

  /* Inspeciona o estado do motor central de LOG e escreve no console técnico.
     Permite ver se eventos estão sendo gravados, se window.db/window.currentUser
     existem e se há erros de sincronização — sem precisar do console do navegador. */
  window.inspectLogSystem = function() {
    let dl = window.diagnosticLog || [];
    let source = 'memória';
    /* Fallback: se window.diagnosticLog estiver vazio, tenta ler direto do localStorage.
       Isso pode acontecer se o módulo diagnostic-log.js não atualizou a referência global. */
    if (dl.length === 0 && typeof window.LOG_STORAGE_KEY !== 'undefined' && window.LOG_STORAGE_KEY) {
      try {
        const stored = JSON.parse(localStorage.getItem(window.LOG_STORAGE_KEY) || '[]');
        if (Array.isArray(stored) && stored.length > 0) {
          dl = stored;
          source = 'localStorage (' + window.LOG_STORAGE_KEY + ')';
        }
      } catch (err) { /* ignora */ }
    }
    const lines = [];
    lines.push('=== DIAGNÓSTICO DO LOG ===');
    lines.push('Eventos em memória: ' + dl.length + ' (fonte: ' + source + ')');
    lines.push('window.db existe: ' + (typeof window.db !== 'undefined'));
    lines.push('window.currentUser existe: ' + (typeof window.currentUser !== 'undefined' && window.currentUser !== null));
    if (window.currentUser) {
      lines.push('UID atual: ' + String(window.currentUser.uid));
    }
    lines.push('Últimos 5 eventos:');
    dl.slice(-5).forEach(function(ev, i) {
      lines.push('  ' + (i + 1) + '. ' + ev.type + ' | ' + ev.module + ' | ' + ev.action + ' | ' + ev.status + ' | ' + (ev.synced === true ? 'sync' : ev.synced === false ? 'pendente' : 'local'));
    });
    if (dl.length > 0) {
      var errors = dl.filter(function(ev) { return ev.type === 'ERROR'; });
      lines.push('Erros: ' + errors.length);
      errors.slice(-3).forEach(function(ev) {
        lines.push('  ERRO: ' + ev.module + ' - ' + ev.action + ' - ' + ev.description);
      });
    }
    lines.push('=========================');
    lines.forEach(function(l) { window.loginDebugLog('INFO', l); });
    alert(lines.join('\n'));
  };

  function setDiagnosticOpen(open) {
    const toggle = getEl('authDiagnosticToggle');
    const panel = getEl('authDiagnosticPanel');
    const overlay = getEl('authDiagnosticOverlay');

    if (!panel || !toggle) {
      window.loginDebugLog?.(
        'WARN',
        'Painel de diagnóstico ainda não está disponível no DOM'
      );

      return false;
    }

    if (open) {
      panel.removeAttribute('hidden');
      panel.classList.add('open');
      panel.style.display = 'flex';
      overlay?.classList.add('open');
      overlay?.setAttribute('aria-hidden', 'false');

      toggle.setAttribute(
        'aria-expanded',
        'true'
      );

      render();
      return true;
    }

    panel.setAttribute('hidden', '');
    panel.classList.remove('open');
    panel.style.display = 'none';
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');

    toggle.setAttribute(
      'aria-expanded',
      'false'
    );

    return true;
  }

  window.toggleLoginDiagnostic = function(event) {
    event?.preventDefault?.();

    const panel = getEl('authDiagnosticPanel');

    if (!panel) {
      window.loginDebugLog?.(
        'ERROR',
        'Painel de diagnóstico não encontrado'
      );

      return;
    }

    const opening = panel.hasAttribute('hidden');

    if (
      setDiagnosticOpen(opening) &&
      opening
    ) {
      window.loginDebugLog?.(
        'INFO',
        'Console de diagnóstico aberto'
      );
    }
  };

  function bindControls() {
    if (initialized) return true;

    const toggle = getEl('authDiagnosticToggle');
    const panel = getEl('authDiagnosticPanel');
    const close = getEl('authDiagnosticClose');
    const clear = getEl('authDiagnosticClear');
    const copy = getEl('authDiagnosticCopy');
    const inspectLog = getEl('authDiagnosticInspectLog');

    window.loginDebugLog(
      'INFO',
      'bindControls: verificando elementos',
      { toggle: !!toggle, panel: !!panel, close: !!close, clear: !!clear, copy: !!copy, inspectLog: !!inspectLog }
    );

    if (
      !toggle ||
      !panel ||
      !close ||
      !clear ||
      !copy ||
      !inspectLog
    ) {
      return false;
    }

    toggle.addEventListener(
      'click',
      window.toggleLoginDiagnostic
    );

    close.addEventListener(
      'click',
      event =>
        window.toggleLoginDiagnostic(event)
    );

    clear.addEventListener(
      'click',
      event => {
        event.preventDefault();

        state.lines.length = 0;

        window.loginDebugLog(
          'INFO',
          'Console limpo'
        );
      }
    );

    getEl('authDiagnosticOverlay')?.addEventListener(
      'click',
      event => {
        if (event.target === event.currentTarget) {
          window.toggleLoginDiagnostic(event);
        }
      }
    );

    // Registra eventos de toque/clique no painel de diagnóstico
    const diagPanel = getEl('authDiagnosticPanel');
    if (diagPanel) {
      diagPanel.addEventListener('click', window.registerLoginTouch);
      diagPanel.addEventListener('touchstart', window.registerLoginTouch);
    }

    copy.addEventListener(
      'click',
      async event => {
        event.preventDefault();

        const text =
          window.getLoginDiagnosticText() ||
          'Nenhum diagnóstico registrado.';

        try {
          await navigator.clipboard.writeText(text);

          window.loginDebugLog(
            'INFO',
            'Diagnóstico copiado'
          );
        } catch (_) {
          const area =
            document.createElement('textarea');

          area.value = text;
          area.setAttribute(
            'readonly',
            ''
          );

          area.style.position = 'fixed';
          area.style.left = '-9999px';
          area.style.opacity = '0';

          document.body.appendChild(area);
          area.select();

          try {
            document.execCommand('copy');

            window.loginDebugLog(
              'INFO',
              'Diagnóstico copiado'
            );
          } catch (err) {
            window.loginDebugLog(
              'WARN',
              'Não foi possível copiar automaticamente',
              err?.message
            );
          }

          area.remove();
        }
      }
    );

    inspectLog.addEventListener(
      'click',
      event => {
        event.preventDefault();
        window.loginDebugLog('INFO', 'Botão Inspecionar LOG clicado');
        window.inspectLogSystem();
      }
    );

    initialized = true;

    window.loginDebugLog(
      'INFO',
      'Controles do diagnóstico conectados'
    );

    return true;
  }

  function ensureInitialized() {
    window.loginDebugLog('INFO', 'ensureInitialized chamado');
    if (bindControls()) {
      render();
      window.loginDebugLog('INFO', 'Controles do diagnóstico conectados com sucesso');
      return;
    }

    window.loginDebugLog('WARN', 'bindControls falhou, tentando novamente...');

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        bindControls,
        { once: true }
      );
    } else {
      queueMicrotask(bindControls);
    }
  }

  window.addEventListener(
    'error',
    event => {
      // Extrai informações de origem do erro (arquivo e linha)
      let sourceFile = '';
      let lineNumber = '';
      
      // Tenta extrair o caminho do arquivo e número da linha da mensagem de erro
      // Formatos comuns: "https://example.com/js/file.js:123" ou "file.js:456"
      const fileMatch = event.message.match(
        /(?:(?:http|https):\/\/[^'"\s]+\.js|[^'"\s]+\.js)\s*:(\d+)/i
      );
      if (fileMatch) {
        sourceFile = fileMatch[0];
        lineNumber = fileMatch[1];
      }
      
      // Monta o objeto de detalhes do erro com o máximo de contexto possível
      const errorDetails = {
        message: event.message || 'erro desconhecido',
        filename: event.filename || sourceFile,
        lineno: lineNumber || event.lineno || '',
        colno: event.colno || '',
        error: event.error?.message || event.message || 'sem mensagem'
      };
      
      window.loginDebugLog(
        'ERROR',
        'Erro de JavaScript',
        errorDetails
      );
    }
  );

  window.addEventListener(
    'unhandledrejection',
    event => {
      const reason = event.reason;

      window.loginDebugLog(
        'ERROR',
        'Promise rejeitada',
        reason?.code ||
        reason?.message ||
        String(
          reason ||
          'motivo desconhecido'
        )
      );
    }
  );

  document.addEventListener(
    'keydown',
    event => {
      const panel =
        getEl('authDiagnosticPanel');

      if (
        event.key === 'Escape' &&
        panel &&
        !panel.hasAttribute('hidden')
      ) {
        window.toggleLoginDiagnostic?.(
          event
        );
      }
    }
  );

  window.loginDebugLog(
    'INFO',
    'Sistema de diagnóstico iniciado',
    {
      host: location.hostname,
      path: location.pathname,
      online: navigator.onLine,
      readyState: document.readyState
    }
  );

  // Aguarda o Firebase estar disponível antes de inicializar o diagnóstico
  if (typeof firebase !== 'undefined') {
    ensureInitialized();
  } else {
    // Firebase not yet loaded, wait for it
    window.addEventListener('firebase-ready', () => {
      ensureInitialized();
    });
  }

  // Função que registra eventos quando um toque/clique é reconhecido
  window.registerLoginTouch = function(event) {
    const stamp = new Date().toLocaleTimeString('pt-BR', {
      hour12: false
    });
    const type = event.type === 'touchstart' ? 'toque' : event.type === 'click' ? 'clique' : event.type;
    loginDebugLog('TOQUE', 'Evento de toque reconhecido', {
      type: type,
      target: event.target ? event.target.tagName : 'desconhecido',
      x: event.clientX,
      y: event.clientY
    });
  };
})();

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
  };

  window.getLoginDiagnosticText = () =>
    state.lines.join('\n');

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

    if (
      !toggle ||
      !panel ||
      !close ||
      !clear ||
      !copy
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

    initialized = true;

    window.loginDebugLog(
      'INFO',
      'Controles do diagnóstico conectados'
    );

    return true;
  }

  function ensureInitialized() {
    if (bindControls()) {
      render();
      return;
    }

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
      window.loginDebugLog(
        'ERROR',
        'Erro de JavaScript',
        event.error?.code ||
        event.message ||
        'erro desconhecido'
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

  // Inicializa Firebase ANTES do diagnóstico para que 'auth' esteja disponível
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();

    ensureInitialized();
  } else {
    // Firebase not yet loaded, wait for it
    window.addEventListener('firebase-ready', () => {
      ensureInitialized();
    });
  }
})();
})();

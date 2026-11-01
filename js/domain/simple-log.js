/* LIVRO-CAIXA · js/domain/simple-log.js — registro simples de eventos de diagnóstico.
   Segue o mesmo padrão do console técnico (src/diagnostic/login-diagnostic.js):
   IIFE, array em memória + localStorage, sanitização básica, API global em window.
*/

(function() {
  'use strict';

  const MAX_LINHAS = 200;
  const STORAGE_KEY = 'livrocaixa_diagnostic_log_v1';
  let eventos = [];

  /* Carrega eventos do localStorage na inicialização. */
  function carregarDoStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          eventos = parsed.slice(-MAX_LINHAS);
        }
      }
    } catch (err) {
      console.warn('Falha ao carregar LOG diagnóstico do localStorage:', err);
      eventos = [];
    }
  }

  /* Salva eventos no localStorage (mantém apenas os mais recentes). */
  function salvarNoStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventos.slice(-MAX_LINHAS)));
    } catch (err) {
      console.warn('Falha ao salvar LOG diagnóstico no localStorage:', err);
    }
  }

  /* Remove padrões sensíveis de texto livre sem destruir a legibilidade. */
  function sanitizar(texto) {
    if (texto == null) return '';
    let s = String(texto);
    s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
    s = s.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF_REDACTED]');
    s = s.replace(/\b[a-zA-Z0-9]{32,}\b/g, '[TOKEN_REDACTED]');
    return s.slice(0, 500);
  }

  function formatoHora(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('pt-BR', { hour12: false });
  }

  /* Adiciona um evento ao LOG e renderiza o painel, se estiver aberto. */
  function adicionarEvento(tipo, modulo, acao, descricao, detalhes, duracaoMs) {
    const evento = {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      timestamp: new Date().toISOString(),
      tipo: tipo || 'INFO',
      modulo: sanitizar(modulo || 'Sistema').slice(0, 120),
      acao: sanitizar(acao || 'Operação').slice(0, 120),
      descricao: sanitizar(descricao || ''),
      detalhes: detalhes != null ? sanitizar(JSON.stringify(detalhes)) : null,
      duracaoMs: Number.isFinite(Number(duracaoMs)) ? Math.round(Number(duracaoMs)) : null
    };
    eventos.unshift(evento);
    if (eventos.length > MAX_LINHAS) eventos.length = MAX_LINHAS;
    salvarNoStorage();
    renderizar();
    return evento;
  }

  /* Renderiza a lista de eventos na área de scroll do modal LOG. */
  function renderizar() {
    const el = document.getElementById('logConteudo');
    if (!el) return;
    const linhas = eventos.map(function(ev) {
      const hora = formatoHora(ev.timestamp);
      const tipoClasse = String(ev.tipo || 'INFO').toLowerCase();
      var linha = '<div class="log-entry ' + tipoClasse + '">';
      linha += '<span class="log-badge">' + ev.tipo + '</span>';
      linha += '<span style="flex:1; min-width:0;">';
      linha += '[' + hora + '] ' + ev.modulo + ' · ' + ev.acao;
      if (ev.descricao) linha += ' — ' + ev.descricao;
      if (ev.duracaoMs != null) linha += ' (' + ev.duracaoMs + 'ms)';
      if (ev.detalhes) {
        try {
          var det = JSON.parse(ev.detalhes);
          if (det && det.colecoes != null) {
            linha += ' · ' + det.colecoes + ' coleção(ões)';
            if (det.coletaMs) {
              var daCache = 0, naRede = 0, totalMs = 0;
              Object.values(det.coletaMs).forEach(function(c) {
                if (c.fromCache) daCache++; else naRede++;
                totalMs += c.ms;
              });
              linha += ' (' + daCache + ' cache / ' + naRede + ' rede)';
              if (totalMs > 0) linha += ' ' + totalMs + 'ms';
            }
          } else {
            // Renderiza outros detalhes como key=value
            var extras = [];
            for (var key in det) {
              if (key === 'colecoes' || key === 'coletaMs') continue;
              var val = det[key];
              if (val != null) {
                if (typeof val === 'object') {
                  val = JSON.stringify(val);
                }
                extras.push(key + '=' + String(val).slice(0, 100));
              }
            }
            if (extras.length) {
              linha += ' [' + extras.join(', ') + ']';
            }
          }
        } catch (_) {}
      }
      linha += '</span></div>';
      return linha;
    });
    el.innerHTML = linhas.length ? linhas.join('') : '<div style="color:var(--ink-soft); font-style:italic;">Sem eventos registrados.</div>';
    el.scrollTop = el.scrollHeight;
  }

  /* Limpa todos os eventos. */
  function limpar() {
    eventos.length = 0;
    salvarNoStorage();
    renderizar();
  }

  /* Copia o conteúdo do LOG para a área de transferência. */
  function copiar() {
    var linhas = eventos.map(function(ev) {
      var linha = '[' + formatoHora(ev.timestamp) + '] [' + ev.tipo + '] ' + ev.modulo + ' · ' + ev.acao;
      if (ev.descricao) linha += ' — ' + ev.descricao;
      if (ev.duracaoMs != null) linha += ' (' + ev.duracaoMs + 'ms)';
      if (ev.detalhes) {
        try {
          var det = JSON.parse(ev.detalhes);
          var extras = [];
          for (var key in det) {
            var val = det[key];
            if (val != null) {
              if (typeof val === 'object') val = JSON.stringify(val);
              extras.push(key + '=' + String(val).slice(0, 100));
            }
          }
          if (extras.length) linha += ' [' + extras.join(', ') + ']';
        } catch (_) {}
      }
      return linha;
    });
    var texto = linhas.length ? linhas.join('\n') : 'Sem eventos registrados.';
    return navigator.clipboard.writeText(texto);
  }

  /* API pública exposta globalmente. */
  window.simpleLog = {
    adicionarEvento: adicionarEvento,
    renderizar: renderizar,
    limpar: limpar,
    copiar: copiar,
    obterEventos: function() { return eventos.slice(); }
  };

  /* Atalhos globais curtos. */
  window.logEvent = adicionarEvento;
  window.simpleLogRender = renderizar;
  window.simpleLogLimpar = limpar;
  window.simpleLogCopiar = copiar;
  window.beginLogOperation = beginLogOperation;
  window.operationDuration = operationDuration;

  /* Marca o início de uma operação para medir duração. Retorna um objeto com startedAt. */
  function beginLogOperation(modulo, acao) {
    return { modulo: modulo, acao: acao, startedAt: performance.now() };
  }

  /* Calcula a duração em ms de uma operação iniciada com beginLogOperation. */
  function operationDuration(operacao) {
    if (!operacao || !Number.isFinite(operacao.startedAt)) return null;
    return Math.max(0, Math.round(performance.now() - operacao.startedAt));
  }

  /* Integra com os botões do modal LOG (panelLOG). */
  var btnCopiar = document.getElementById('btnCopiarLog');
  var btnLimpar = document.getElementById('btnLimparLog');
  if (btnCopiar) {
    btnCopiar.addEventListener('click', function() {
      copiar().then(function() {
        var antigo = btnCopiar.textContent;
        btnCopiar.textContent = 'Copiado!';
        setTimeout(function() { btnCopiar.textContent = antigo; }, 1200);
      });
    });
  }
  if (btnLimpar) {
    btnLimpar.addEventListener('click', limpar);
  }

  /* Inicialização: carrega do localStorage e renderiza. */
  carregarDoStorage();
  renderizar();
})();

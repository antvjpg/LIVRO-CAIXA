/* LIVRO-CAIXA · js/17-sync-persistence.js — carga, persistência e sincronização (app.js: 1685-2405). Separação por responsabilidade; conteúdo preservado. */

/* =========================================================================
   ETAPA 0 — FASE 0: AUDITORIA DE COBERTURA E CONTRATOS (LOG do sistema)
   Fonte: página "🧾 LOG — Centralização, Segurança e Cobertura de Auditoria"
   (Notion, C.O.D.E. — Controle Operacional de Diagnóstico e Execução).
   Etapa executada e documentada com evidência no repositório.
   =========================================================================

   1. HEAD e árvore real do repositório
   --------------------------------------
   HEAD: 1d76fe7 feat(pwa): adicionar arquivos OCR e domain ao cache do
   Service Worker
   Repositório limpo (sem alterações pendentes).
   Estrutura: index.html (raiz), ./js/ (34 módulos + ./js/data + ./js/domain +
   ./js/legacy), ./style/ (6 CSS), ./ocr/ (9 módulos), ./ocr/limits.js carrega
   primeiro do OCR, ./worker/ (Cloudflare Worker), ./e2e/ (Playwright),
   ./src/diagnostic/login-diagnostic.js, ./functions/, ./manifest.webmanifest,
   ícones PNG, sw.js, firebase.json, firestore.rules, package*.json.
   Arquivos ponto (.livro-caixa-*), backups legais (card-engine-v3.*,
   index.html.backup-*, styles.css.*), e2e/.artifacts/, e2e/.state/ e
   node_modules/ NÃO fazem parte do shell da aplicação.

   2. Funções emissoras atuais (todas em js/17-sync-persistence.js)
   ----------------------------------------------------------------
   - recordLogEvent(input)          — núcleo: cria evento via createLogEvent,
     adiciona ao início de diagnosticLog, aplica LOG_LIMIT, persiste local,
     grava no Firestore (coleção diagnostics do usuário), emite console.
   - logInfo(module, action, status, description, details, operation) — tipo INFO
   - logWarn(module, action, status, description, details, operation)  — tipo WARN
   - logSyncError(context, err, operation) — tipo ERROR (exceções)
   Não há recordLogEvent separado fora de js/17-sync-persistence.js; os demais
   arquivos consomem essas 3 funções públicas.
   Aliases: nenhum além de logInfo/logWarn/logSyncError.

   3. Consumidores, imports/globais, ordem de scripts, backup, Firestore, UI e testes
   -----------------------------------------------------------------------------------
   Ordem de scripts (index.html, linhas 1641-1666):
     emoji-catalog, 00-bootstrap, 10-state-utils, 11-financial-domain,
     12-auth-session, 13-backup, 14-theme, 15-tabs-nav, 16-events-modals,
     17-sync-persistence (núcleo do LOG), 18-render-core, 19-goals,
     20-dashboard, 21-ai-features, 22-profile, 23-ai-chat, 24-automation-render,
     25-bills-receivables, 26-receipts, 27-cards, 28-ocr-lia,
     29-invest-movements, 30-transfer-receipts, 31-import-export,
     32-auth-wiring, 33-mcp-bridge, 99-init.
   Módulos OCR carregam antes (linhas 34-40): limits, log, attachment-manager,
   extractor, ocr-adapter, lia-interpret, review.
   Módulos domain carregam como type=module (linhas 44-54):
     ai-chat-contract, chat-persistence, mcp-financial-contract,
     secure-storage, security-utils.
   Consumidores do LOG (59 chamadas em 21 arquivos js/):
     00-bootstrap (PWA registro), 13-backup (exportação/importação),
     16-events-modals (reordenação), 17-sync-persistence (núcleo),
     18-render-core (instituições, investimentos, indicadores, notificações,
     perfil, segurança), 19-goals (meta), 20-dashboard (cartões, configurações),
     21-ai-features (anomalias, revisão mensal, juros compostos),
     23-ai-chat (LIA juros, movimentação, projeção, conciliação),
     24-automation-render (calendário recorrente, automação, cotações),
     25-bills-receivables (contas, valores a receber, exportação),
     27-cards (faturas), 29-invest-movements (cotações).
   Backup (js/13-backup.js): diagnosticLog está na lista de opcionais do
   backup e é incluído na restauração (sanitizado, limitado a LOG_LIMIT).
   Firestore: coleção /livrocaixa/{uid}/diagnostics, regras permitem read/write
   apenas para isOwner(userId) nas coleções banks, categories, investments,
   pockets, yieldsLog, recurringBills, diagnostics. Leitura remota limitada a
   100 registros (loadDiagnosticLog, .limit(100)).
   UI: js/24-automation-render.js (painel, filtros, apresentação) e
   index.html (markup, controles). js/99-init.js (inicialização, cópia do LOG,
   limpeza local com aviso de que o remoto não é apagado).
   Testes: worker/test/ (21 arquivos, nenhum teste dedicado ao LOG do sistema;
   não há testes de logInfo/logWarn/logSyncError/recordLogEvent).

   4. Matriz de cobertura por módulo (existente / parcial / ausente / N/A)
   ------------------------------------------------------------------------
   Movimentações (entries):             PARCIAL — logInfo em criar/editar/excluir
                                        (js/25-bills-receivables, js/27-cards).
   Contas e instituições (banks):       EXISTENTE — logInfo renomear instituição
                                        (js/18-render-core).
   Cartões e faturas:                   EXISTENTE — logInfo marcar/desmarcar
                                        fatura paga (js/27-cards).
   Investimentos:                       PARCIAL — logInfo/Warn cotações
                                        (js/29-invest-movements).
   Caixinhas e metas (pockets/goals):   PARCIAL — logSyncError meta (js/19-goals).
   Orçamentos e categorias (budgets):   AUSENTE — sem chamadas de LOG.
   Calendário e recorrentes:            EXISTENTE — logInfo/Warn contas recorrentes
                                        (js/25-bills-receivables, js/24-automation-render).
   OCR / LIA / IA:                      PARCIAL — ocr/log.js tem logger próprio
                                        (console, não integrado ao histórico
                                        central); js/21-ai-features e js/23-ai-chat
                                        usam logInfo/Warn (análise, juros, LIA).
   Infraestrutura:                      EXISTENTE — Auth (js/99-init), carregamento
                                        e sincronização (js/17-sync-persistence),
                                        backup (js/13-backup), Service Worker
                                        (js/00-bootstrap), Worker (n/a — server-side).
   Sincronização/carregamento:          EXISTENTE — logInfo início/fim, logSyncError
                                        erro (js/17-sync-persistence).

   5. Limites, ordenação, paginação, regras Firestore, índices, limpeza, sincronização
   ------------------------------------------------------------------------------------
   Limites: LOG_LIMIT = 200 (js/99-init.js:410). Leitura remota .limit(100).
   Ordenação: por sequence desc, depois timestamp (localeCompare) —
   js/17-sync-persistence.js:341.
   Paginação: não implementada (somente slice(0, LOG_LIMIT)).
   Regras Firestore: match /{collection}/{docId} permite read/write se
   isOwner(userId) e collection in [banks, categories, investments, pockets,
   yieldsLog, recurringBills, diagnostics] (firestore.rules:355-370).
   Índices: não especificados nas regras (Firestore cria automaticamente para
   queries simples; coleção diagnostics sem índice composto declarado).
   Semântica de limpeza: limpeza local (diagnosticLog.length = 0 +
   persistDiagnosticLogLocally) NÃO apaga o remoto — aviso explícito na UI
   (js/99-init.js:1338).
   Sincronização: recordLogEvent grava local com synced=false (ou null se sem
   usuário), depois Firestore .set(event, {merge:true}); sucesso define
   synced=true, falha define synced=false e persiste localmente.
   Erros de sync:livrocaixa_sync_errors (últimos 50 ERROR) persistidos local.
   Schema: LOG_SCHEMA_VERSION = 2 (js/99-init.js:411).
   Campos normalizados: id, sequence, timestamp, type (INFO/WARN/ERROR),
   module, action, status, description (máx 800), details (sanitizado,
   profundidade 2, allowlist de chaves), correlationId (máx 120),
   durationMs, retryCount, source (máx 80), synced, schemaVersion.
   Sanitização: remove chaves password|token|secret|authorization|apiKey|
   credential|uid; limita strings a 800 chars, arrays a 20 itens, objetos a 20
   chaves, profundidade 2; Error vira {name,message,code}.

   6. Baseline de testes e exemplos de eventos sanitizados
   -------------------------------------------------------
   Não existem testes dedicados ao LOG do sistema em worker/test/.
   Exemplos de eventos gerados pelo código (sanitizados automaticamente):
   - {type:'INFO', module:'Sistema', action:'Registro do Service Worker',
     status:'Sucesso', description:'PWA pronta para atualização offline.'}
   - {type:'INFO', module:'Carregamento de dados', action:'Sincronização
     concluída', status:'Sucesso', description:'13 coleções carregadas.'}
   - {type:'ERROR', module:'Sistema', action:'salvamento', status:'Falha',
     description:<mensagem do err>, details:{code, failedCollections}}
   - {type:'INFO', module:'Calendário', action:'Geração automática',
     status:'Sucesso', description:'N conta(s) recorrente(s) gerada(s)
     sem duplicidade.', details:{month, created}}
   Nenhum baseline de teste escrito; cobertura de regressão do LOG não é
   verificada automaticamente.

   Saída da Etapa 0: matriz acima + mapa de dependências + decisão de manter
   o contrato público (logInfo/logWarn/logSyncError) e extrair o motor para
   módulo dedicado (Fase 1), conforme especificação da página Notion.
   ========================================================================= */


  function setStateArray(name, arr) {
    switch (name) {
      case 'banks': banks = arr.filter(bk => bk.id !== 'geral' && bk.name.toLowerCase() !== 'geral'); break;
      case 'categories': categories = [...(arr || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')); break;
      case 'entries': entries = arr; break;
      case 'investments': investments = sortDisplayOrder(arr); break;
      case 'pockets': pockets = sortDisplayOrder(arr); break;
      case 'yieldsLog': yieldsLog = arr; break;
      case 'recurringBills': recurringBills = arr; break;
      case 'receivables': receivables = arr; break;
      case 'budgets': budgets = arr; break;
      case 'goals': goals = arr; break;
      case 'invoiceLaunches': invoiceLaunches = arr; break;
      case 'cards': cards = arr; break;
      case 'purchases': purchases = arr; break;
    }
  }

  async function loadState() {
    const operation = beginLogOperation('Carregamento de dados', 'Sincronização');
    const loadUserUid = currentUser?.uid || null;
    const thisLoadGeneration = ++loadGeneration;
    firstLoadDone = false;
    const defaultCats = ['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Salário', 'Renda Extra', 'Transferência', 'Outros'];
    const syncOverlay = document.getElementById('syncOverlay');
    const syncOverlayText = document.getElementById('syncOverlayText');
    document.body.classList.add('is-data-loading');
    if (syncOverlayText) syncOverlayText.textContent = 'Sincronizando seus dados...';
    if (syncOverlay) syncOverlay.classList.remove('hidden');

    realtimeUnsubscribers.forEach(unsub => unsub());
    realtimeUnsubscribers = [];
    await loadDiagnosticLog();
    logInfo('Carregamento de dados', 'Início da sincronização', 'Em andamento', 'Leitura das coleções do Livro-Caixa iniciada.', null, operation);

    try {
      // Cada coleção resolve assim que a PRIMEIRA leitura chega — que, com o cache offline
      // ativo, costuma vir do disco do próprio celular quase instantaneamente, mesmo antes
      // da confirmação do servidor. Isso evita esperar a rede toda vez que a página recarrega.
      await Promise.all(COLLECTIONS.map(name => new Promise((resolve, reject) => {
        let resolved = false;
        const unsub = colRef(name).onSnapshot(snap => {
          if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) {
            if (!resolved) {
              resolved = true;
              resolve();
            }
            return;
          }
          const arr = snap.docs.map(d => d.data());
          if (resolved && pendingSaveCount > 0) {
            snapshotBuffer[name] = { arr, hasPendingWrites: snap.metadata.hasPendingWrites };
            return;
          }
          setStateArray(name, arr);
          if (!snap.metadata.hasPendingWrites) {
            lastSynced[name] = arrToMap(getStateArray(name));
          }
          if (!resolved) {
            resolved = true;
            /* CACHE-FIRST: o onSnapshot do Firebase com cache offline ativo
               dispara no primeiro evento do disco local, quase instantâneo.
               Renderiza assim que os primeiros dados chegam em vez de esperar
               todas as coleções pelo Promise.all. firstLoadDone é ligado antes
               para que renderBalances()/sparklines mostrem dados reais em vez
               de '—'. */
            firstLoadDone = true;
            render();
            resolve();
          } else if (firstLoadDone) {
            render();
          }
        }, err => {
          if (!resolved) { resolved = true; reject(err);           } else { console.error(err); logSyncError(`sincronização — ${name}`, err); }
        });
        realtimeUnsubscribers.push(unsub);
      })));

      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      COLLECTIONS.forEach(name => {
        if (Object.keys(lastSynced[name]).length === 0 && getStateArray(name).length > 0) {
          lastSynced[name] = arrToMap(getStateArray(name));
        }
      });

      const hasSubData = COLLECTIONS.some(name => getStateArray(name).length > 0);

      if (!hasSubData) {
        // Migração automática do formato antigo (documento único) para subcoleções
        const oldSnap = await docRef().get();
        if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;
        const data = oldSnap.exists ? oldSnap.data() : {};
        banks = data.banks || [];
        categories = data.categories || [];
        entries = data.entries || [];
        investments = data.investments || [];
        pockets = data.pockets || [];
        yieldsLog = data.yieldsLog || [];
        recurringBills = data.recurringBills || [];
        receivables = data.receivables || [];
        budgets = data.budgets || [];
        goals = data.goals || [];
        invoiceLaunches = data.invoiceLaunches || [];
        cards = data.cards || [];
        purchases = data.purchases || [];
        lastSynced = { banks: {}, categories: {}, entries: {}, investments: {}, pockets: {}, yieldsLog: {}, recurringBills: {}, receivables: {}, budgets: {}, goals: {}, invoiceLaunches: {}, cards: {}, purchases: {} };
        if (data.banks || data.entries) {
          if (syncOverlayText) syncOverlayText.textContent = 'Migrando seus dados para a nova estrutura (só acontece uma vez)...';
        }
      }

      let changed = !hasSubData;
      const orderChanged = ensureDisplayOrder(investments) | ensureDisplayOrder(pockets);
      investments = sortDisplayOrder(investments);
      pockets = sortDisplayOrder(pockets);
      if (orderChanged) changed = true;
      const beforePocketState = JSON.stringify(pockets);
      normalizePockets();
      if (JSON.stringify(pockets) !== beforePocketState) changed = true;

      const beforeGoalState = JSON.stringify(goals);
      normalizeGoals();
      if (JSON.stringify(goals) !== beforeGoalState) changed = true;
      const beforeGoalProgressState = JSON.stringify(goals);
      if (normalizeAllGoalStatuses()) changed = true;
      if (JSON.stringify(goals) !== beforeGoalProgressState) changed = true;

      const filteredBanks = banks.filter(bk => bk.id !== 'geral' && bk.name.toLowerCase() !== 'geral');
      if (filteredBanks.length !== banks.length) changed = true;
      banks = filteredBanks;

      if (categories.length === 0) {
        categories = defaultCats.map(name => ({ id: 'c' + name, name }));
        changed = true;
      }

      if (changed) {
        if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;
        await persistNow(operation);
      }

      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      await loadProfileSettingsFromCloud();
      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      /* Indicadores públicos (BCB/Tesouro): só semeia a tela com o que já
         estava persistido; a busca fresca acontece depois, sem atrasar a
         sincronização das coleções. */
      await loadFinancialIndicatorsFromCloud();
      if (thisLoadGeneration !== loadGeneration || currentUser?.uid !== loadUserUid) return;

      populateFilterControls(true);
      render();
      renderBills();
      if (currentTab === 'profile') renderProfile();
      firstLoadDone = true;
      renderBalances();
      refreshFinancialIndicators();
      logInfo('Carregamento de dados', 'Sincronização concluída', 'Sucesso', `${COLLECTIONS.length} coleções carregadas.`, null, operation);
    } catch (err) {
      console.error(err);
      logSyncError('carregamento de dados', err, operation);
      alert('Erro ao carregar dados. O aplicativo pode estar offline.');
    } finally {
      if (thisLoadGeneration === loadGeneration && currentUser?.uid === loadUserUid) {
        if (!lastTabRestored) {
          lastTabRestored = true;
          try {
            const savedTab = sessionStorage.getItem(LAST_TAB_STORAGE_KEY);
            if (savedTab && TAB_NAMES.includes(savedTab) && savedTab !== currentTab && typeof window.switchTab === 'function') {
              window.switchTab(savedTab);
            }
          } catch (e) {}
        }
        if (syncOverlay) syncOverlay.classList.add('hidden');
        document.body.classList.remove('is-data-loading');
        markValueRefresh();
      }
    }
  }

  function getStateArray(name) {
    switch (name) {
      case 'banks': return banks;
      case 'categories': return categories;
      case 'entries': return entries;
      case 'investments': return investments;
      case 'pockets': return pockets;
      case 'yieldsLog': return yieldsLog;
      case 'recurringBills': return recurringBills;
      case 'receivables': return receivables;
      case 'budgets': return budgets;
      case 'goals': return goals;
      case 'invoiceLaunches': return invoiceLaunches;
      case 'cards': return cards;
      case 'purchases': return purchases;
    }
  }

  /* [JS 06] FIREBASE / STORAGE / SINCRONIZAÇÃO / MIGRAÇÕES */
  function flushSnapshotBuffer() {
    const names = Object.keys(snapshotBuffer);
    if (!names.length) return;
    names.forEach(name => {
      const buffered = snapshotBuffer[name];
      setStateArray(name, buffered.arr);
      lastSynced[name] = arrToMap(getStateArray(name));
    });
    snapshotBuffer = {};
    render();
  }

  function setSyncDot(saving) {
    const dot = document.getElementById('syncDot');
    if (dot) dot.classList.toggle('saving', saving);
  }
  let diagnosticLog;
 // compatibilidade com a interface antiga.
  let LOG_STORAGE_KEY;

  let LOG_LIMIT;

  let LOG_SCHEMA_VERSION;

  let LOG_SEQUENCE_STORAGE_KEY;

  let LOG_SOURCE;

  let logSequence;


  function nextLogSequence() {
    let stored = 0;
    try { stored = Number(localStorage.getItem(LOG_SEQUENCE_STORAGE_KEY)) || 0; } catch (err) {}
    logSequence = Math.max(logSequence, stored) + 1;
    try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    return logSequence;
  }
  function createCorrelationId(label = 'operacao') {
    const safeLabel = String(label || 'operacao').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'operacao';
    return `op_${Date.now()}_${safeLabel}_${Math.random().toString(36).slice(2, 8)}`;
  }
  function beginLogOperation(module, action, details = null) {
    return { correlationId: createCorrelationId(`${module}-${action}`), startedAt: performance.now(), module, action, details };
  }
  function operationDuration(operation) {
    if (!operation || !Number.isFinite(operation.startedAt)) return null;
    return Math.max(0, Math.round(performance.now() - operation.startedAt));
  }
  function getLogContextFields(operation, durationMs = null) {
    if (!operation) return {};
    return {
      correlationId: operation.correlationId || null,
      durationMs: durationMs != null ? durationMs : null,
      source: operation.source || LOG_SOURCE
    };
  }

  function sanitizeLogValue(value, depth = 0) {
    if (depth > 2 || value == null) return value == null ? null : String(value);
    if (value instanceof Error) return { name: value.name, message: value.message, code: value.code || null };
    if (typeof value === 'string') return value.slice(0, 800);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeLogValue(item, depth + 1));
    if (typeof value === 'object') {
      const result = {};
      Object.keys(value).slice(0, 20).forEach(key => {
        if (/password|token|secret|authorization|apiKey|credential|uid/i.test(key)) return;
        result[key] = sanitizeLogValue(value[key], depth + 1);
      });
      return result;
    }
    return String(value);
  }
  function normalizeLogEvent(raw) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const sequenceNumber = Number(item.sequence);
    const durationNumber = Number(item.durationMs);
    const retryNumber = Number(item.retryCount);
    return {
      id: String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      sequence: Number.isFinite(sequenceNumber) && sequenceNumber > 0 ? sequenceNumber : null,
      timestamp: item.timestamp || new Date().toISOString(),
      type: ['INFO', 'WARN', 'ERROR'].includes(item.type) ? item.type : 'INFO',
      module: String(item.module || 'Sistema').slice(0, 120),
      action: String(item.action || 'Operação').slice(0, 160),
      status: String(item.status || 'Sucesso').slice(0, 80),
      description: String(item.description || '').slice(0, 800),
      details: sanitizeLogValue(item.details),
      correlationId: item.correlationId ? String(item.correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(durationNumber) && durationNumber >= 0 ? Math.round(durationNumber) : null,
      retryCount: Number.isFinite(retryNumber) && retryNumber >= 0 ? Math.floor(retryNumber) : null,
      source: String(item.source || 'Livro-Caixa-web').slice(0, 80),
      synced: item.synced === true ? true : item.synced === false ? false : null,
      schemaVersion: Number(item.schemaVersion) || 1
    };
  }
  function normalizeDiagnosticLog(items) {
    return (Array.isArray(items) ? items : []).filter(Boolean).map(normalizeLogEvent).slice(0, LOG_LIMIT);
  }
  function syncLogSequenceFromEvents(items) {
    const maxSequence = (Array.isArray(items) ? items : []).reduce((max, item) => Math.max(max, Number(item?.sequence) || 0), 0);
    if (maxSequence > logSequence) {
      logSequence = maxSequence;
      try { localStorage.setItem(LOG_SEQUENCE_STORAGE_KEY, String(logSequence)); } catch (err) {}
    }
  }
  function persistDiagnosticLogLocally() {
    try {
      const normalized = normalizeDiagnosticLog(diagnosticLog);
      diagnosticLog.splice(0, diagnosticLog.length, ...normalized);
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(normalized));
      localStorage.setItem('livrocaixa_sync_errors', JSON.stringify(normalized.filter(item => item.type === 'ERROR').slice(0, 50)));
    } catch (err) { console.warn('LOG local indisponível:', err); }
  }
  function hydrateDiagnosticLog() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]'); } catch (err) {}
    if (!Array.isArray(stored) || stored.length === 0) {
      try {
        const legacy = JSON.parse(localStorage.getItem('livrocaixa_sync_errors') || '[]');
        stored = Array.isArray(legacy) ? legacy.map(item => ({ id: 'legacy-' + Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), type: 'ERROR', module: 'Sincronização', action: item.context || 'Operação', status: 'Falha', description: item.message || 'Erro legado', details: null })) : [];
      } catch (err) {}
    }
    diagnosticLog.splice(0, diagnosticLog.length, ...normalizeDiagnosticLog(stored));
    syncLogSequenceFromEvents(diagnosticLog);
  }
  async function loadDiagnosticLog() {
    hydrateDiagnosticLog();
    if (!currentUser) return;
    try {
      const snap = await db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').limit(100).get();
      const remote = snap.docs.map(doc => ({ ...normalizeLogEvent(doc.data()), synced: true })).filter(item => item && item.id);
      const merged = new Map(diagnosticLog.map(item => [item.id, normalizeLogEvent(item)]));
      remote.forEach(item => merged.set(item.id, item));
      diagnosticLog.splice(0, diagnosticLog.length, ...[...merged.values()].sort((a, b) => (Number(b.sequence || 0) - Number(a.sequence || 0)) || String(b.timestamp || '').localeCompare(String(a.timestamp || ''))).slice(0, LOG_LIMIT));
      syncLogSequenceFromEvents(diagnosticLog);
      persistDiagnosticLogLocally();
    } catch (err) { console.warn('LOG remoto indisponível:', err); }
  }
  function createLogEvent({ type = 'INFO', module = 'Sistema', action = 'Operação', status = 'Sucesso', description = '', details = null, correlationId = null, durationMs = null, retryCount = null, source = LOG_SOURCE, synced = null } = {}) {
    return {
      id: 'log' + Date.now() + Math.random().toString(36).slice(2, 8),
      sequence: nextLogSequence(),
      timestamp: new Date().toISOString(), type, module, action, status,
      description: String(description || '').slice(0, 800), details: sanitizeLogValue(details),
      correlationId: correlationId ? String(correlationId).slice(0, 120) : null,
      durationMs: Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0 ? Math.round(Number(durationMs)) : null,
      retryCount: Number.isFinite(Number(retryCount)) && Number(retryCount) >= 0 ? Math.floor(Number(retryCount)) : null,
      source: String(source || LOG_SOURCE).slice(0, 80), synced: synced === true ? true : synced === false ? false : null,
      schemaVersion: LOG_SCHEMA_VERSION
    };
  }
  function recordLogEvent(input = {}) {
    const event = createLogEvent({ ...input, synced: currentUser ? false : null });
    diagnosticLog.unshift(event);
    if (diagnosticLog.length > LOG_LIMIT) diagnosticLog.length = LOG_LIMIT;
    persistDiagnosticLogLocally();
    if (event.type === 'ERROR') flashSyncError();
    if (currentUser) {
      db.collection('livrocaixa').doc(currentUser.uid).collection('diagnostics').doc(event.id).set(event, { merge: true })
        .then(() => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = true; persistDiagnosticLogLocally(); })
        .catch(err => { const local = diagnosticLog.find(item => item.id === event.id); if (local) local.synced = false; persistDiagnosticLogLocally(); console.warn('Falha ao sincronizar o LOG:', err); });
    }
    if (event.type === 'ERROR') console.error(`[${event.module}] ${event.action}:`, event.description, event.details || '');
    else if (event.type === 'WARN') console.warn(`[${event.module}] ${event.action}:`, event.description);
    return event;
  }
  function logInfo(module, action, status = 'Sucesso', description = '', details = null, operation = null) { const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null; return recordLogEvent({ type: 'INFO', module, action, status, description, details, ...getLogContextFields(operation, duration) }); }
  function logWarn(module, action, status = 'Atenção', description = '', details = null, operation = null) { const duration = ['Sucesso', 'Parcial', 'Falha', 'Cancelado'].includes(status) ? operationDuration(operation) : null; return recordLogEvent({ type: 'WARN', module, action, status, description, details, ...getLogContextFields(operation, duration) }); }
  function logSyncError(context, err, operation = null) {
    const message = err && err.message ? err.message : String(err);
    recordLogEvent({ type: 'ERROR', module: context === 'sincronização' ? 'Sincronização' : 'Sistema', action: context, status: 'Falha', description: message, details: err && { code: err.code, failedCollections: err.failedCollections }, ...getLogContextFields(operation, operationDuration(operation)) });
  }
  function flashSyncError() {
    const dot = document.getElementById('syncDot');
    if (!dot) return;
    dot.classList.add('sync-error');
    setTimeout(() => dot.classList.remove('sync-error'), 4000);
  }

  function persistNow(operation = null) {
    if (!currentUser) return Promise.resolve();
    clearTimeout(saveTimer);
    setSyncDot(true);
    pendingSaveCount++;
    return commitDiff()
      .then(() => { setSyncDot(false); logInfo('Salvamento', 'Persistência dos dados', 'Sucesso', 'Alterações gravadas nas coleções do Livro-Caixa.', null, operation); })
      .catch(err => { logSyncError('salvamento', err, operation); setSyncDot(false); throw err; })
      .finally(() => {
        pendingSaveCount = Math.max(0, pendingSaveCount - 1);
        if (pendingSaveCount === 0) flushSnapshotBuffer();
      });
  }

  async function commitDiff() {
    const saveUserUid = currentUser?.uid || null;
    if (!saveUserUid) return;

    const userDocRef = db.collection('livrocaixa').doc(saveUserUid);
    const current = currentStateSnapshot();
    const failedCollections = [];
    const MAX_BATCH_OPERATIONS = 400;

    for (const name of COLLECTIONS) {
      if (currentUser?.uid !== saveUserUid) return;

      const newMap = arrToMap(current[name]);
      const oldMap = lastSynced[name] || {};
      const operations = [];

      Object.keys(newMap).forEach(id => {
        const newItem = newMap[id];
        const oldItem = oldMap[id];

        if (!oldItem || JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
          operations.push({
            type: 'set',
            ref: userDocRef.collection(name).doc(id),
            data: newItem
          });
        }
      });

      Object.keys(oldMap).forEach(id => {
        if (!newMap[id]) {
          operations.push({
            type: 'delete',
            ref: userDocRef.collection(name).doc(id)
          });
        }
      });

      if (operations.length === 0) continue;

      try {
        for (let i = 0; i < operations.length; i += MAX_BATCH_OPERATIONS) {
          if (currentUser?.uid !== saveUserUid) return;

          const chunk = operations.slice(i, i + MAX_BATCH_OPERATIONS);
          const batch = db.batch();

          chunk.forEach(operation => {
            if (operation.type === 'set') {
              batch.set(operation.ref, operation.data);
            } else {
              batch.delete(operation.ref);
            }
          });

          await batch.commit();
        }

        if (currentUser?.uid !== saveUserUid) return;
        lastSynced[name] = newMap;
      } catch (err) {
        console.error(`Falha ao salvar a coleção "${name}":`, err);
        failedCollections.push(name);
      }
    }

    if (failedCollections.length > 0) {
      const err = new Error(`Falha ao sincronizar: ${failedCollections.join(', ')}`);
      err.failedCollections = failedCollections;
      throw err;
    }
  }

  function persistAll(operation = null) { return persistNow(operation); }
  function saveBanks(operation = null) { return persistAll(operation); }
  function saveCategories(operation = null) { return persistAll(operation); }
  function saveEntries(operation = null) { return persistAll(operation); }
  function saveInvestments(operation = null) { return persistAll(operation); }


  function bankBalance(bankId) {
    const bank = banks.find(b => b.id === bankId);
    const initial = bank ? (bank.initial || 0) : 0;
    return entries.filter(e => e.bank === bankId).reduce((sum, e) => sum + (e.type === 'in' ? e.amount : -e.amount), initial);
  }

  function totalBankBalance() {
    return banks.reduce((sum, b) => sum + bankBalance(b.id), 0);
  }

  function totalInvestBalance() {
    return investments.reduce((sum, i) => {
      if (i.type === 'Renda Fixa') return sum + fixedIncomeCurrentValue(i);
      let v = Number(i.value);
      if (!(v >= 0) || (v === 0 && isCryptoType(i.type) && cryptoCurrentUnits(i) > 0 && Number(i.price) > 0)) {
        v = cryptoValueFromUnits(i.type, cryptoCurrentUnits(i), i.price || 0);
      }
      return sum + (Number(v) || 0);
    }, 0);
  }

  function pocketMovementTotal(pocketId, excludeId = null) {
    return yieldsLog
      .filter(y => y.targetType === 'pocket' && y.targetId === pocketId && y.id !== excludeId)
      .reduce((sum, y) => sum + (y.kind === 'resgate' ? -1 : 1) * (Number(y.amount) || 0), 0);
  }

  function pocketCurrentBalance(pocket) {
    const initial = Number(pocket.initial ?? pocket.value ?? 0) || 0;
    return initial + pocketMovementTotal(pocket.id);
  }

  function normalizePockets() {
    pockets.forEach(p => {
      if (p.initial == null) {
        const currentStored = Number(p.value) || 0;
        const movementTotal = pocketMovementTotal(p.id);
        p.initial = currentStored - movementTotal;
      }
      if ('value' in p) delete p.value;
    });
  }

  function normalizeGoals() {
    const validStatuses = new Set(['active', 'completed', 'paused', 'cancelled']);

    goals.forEach(goal => {
      if (!goal || typeof goal !== 'object') return;

      if (!goal.id) {
        goal.id = 'goal' + Date.now() + Math.random().toString(36).slice(2, 7);
      }

      if (goal.name == null) goal.name = '';
      goal.name = String(goal.name).slice(0, 200);

      if (goal.icon == null || !String(goal.icon).trim()) goal.icon = '🎯';
      else goal.icon = String(goal.icon).slice(0, 8);

      if (goal.targetAmount == null) {
        goal.targetAmount = 0;
      } else {
        const target = Number(goal.targetAmount);
        goal.targetAmount = Number.isFinite(target) ? Math.max(0, target) : 0;
      }

      if (!goal.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(goal.startDate))) {
        const created = String(goal.createdAt || '');
        goal.startDate = /^\d{4}-\d{2}-\d{2}/.test(created)
          ? created.slice(0, 10)
          : todayISO();
      }

      if (!Object.prototype.hasOwnProperty.call(goal, 'caixinhaId') || !goal.caixinhaId) {
        goal.caixinhaId = null;
      } else {
        goal.caixinhaId = String(goal.caixinhaId);
      }

      if (!goal.sourceType) {
        goal.sourceType = goal.caixinhaId ? 'pocket' : null;
      }
      if (!goal.sourceId) {
        goal.sourceId = goal.caixinhaId || null;
      }
      if (goal.sourceType && !['bank', 'pocket', 'invest'].includes(goal.sourceType)) {
        goal.sourceType = null;
        goal.sourceId = null;
      }
      if (goal.sourceId != null) goal.sourceId = String(goal.sourceId);

      if (!validStatuses.has(goal.status)) {
        goal.status = 'active';
      }

      if (goal.deadline == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(goal.deadline))) goal.deadline = '';
      if (goal.desc == null) goal.desc = '';
      else goal.desc = String(goal.desc).slice(0, 500);

      if (!goal.createdAt) goal.createdAt = todayISO();
      if (!goal.updatedAt) goal.updatedAt = goal.createdAt;
    });
  }

  function goalCurrentAmount(goal) {
    if (!goal) return null;

    const sourceType = goal.sourceType || (goal.caixinhaId ? 'pocket' : null);
    const sourceId = goal.sourceId || goal.caixinhaId || null;

    if (sourceType === 'bank' && sourceId) {
      const bank = banks.find(b => b.id === sourceId);
      return bank ? bankBalance(sourceId) : null;
    }

    if (sourceType === 'pocket' && sourceId) {
      const pocket = pockets.find(p => p.id === sourceId);
      return pocket ? pocketCurrentBalance(pocket) : null;
    }

    if (sourceType === 'invest' && sourceId) {
      const investment = investments.find(i => i.id === sourceId);
      return investment ? investmentValueAtDate(investment, todayISO()) : null;
    }

    if (Object.prototype.hasOwnProperty.call(goal, 'currentAmount')) {
      const legacyCurrent = Number(goal.currentAmount);
      return Number.isFinite(legacyCurrent) ? Math.max(0, legacyCurrent) : null;
    }

    return null;
  }

  function totalPocketBalance() {
    return pockets.reduce((sum, p) => sum + pocketCurrentBalance(p), 0);
  }

  let VIEW_PERIOD_KEY;

  let viewPeriod;


  function loadViewPeriod() {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_PERIOD_KEY) || 'null');
      if (saved && (saved.mode === 'all' || /^\d{4}-\d{2}$/.test(String(saved.month || '')))) {
        viewPeriod = { mode: saved.mode === 'all' ? 'all' : 'month', month: saved.month || currentMonthYM() };
      }
    } catch (err) { viewPeriod = { mode:'month', month:currentMonthYM() }; }
  }
  function saveViewPeriod() { try { localStorage.setItem(VIEW_PERIOD_KEY, JSON.stringify(viewPeriod)); } catch (err) {} }
  function activePeriodRange() {
    if (viewPeriod.mode === 'all') return { start: null, end: null };
    return { start: `${viewPeriod.month}-01`, end: monthEndDate(viewPeriod.month) };
  }
  function periodLabel() {
    if (viewPeriod.mode === 'all') return 'Todos / Todo o histórico';
    const [year, month] = viewPeriod.month.split('-').map(Number);
    const name = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month:'long' });
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}/${year}`;
  }
  function periodMatchesDate(date) {
    if (viewPeriod.mode === 'all') return true;
    const value = String(date || '');
    const range = activePeriodRange();
    return value >= range.start && value <= range.end;
  }
  function periodMatchesMovement(y) {
    return periodMatchesDate(y?.date);
  }
  function updatePeriodUI() {
    const label = periodLabel();
    const active = document.getElementById('periodActiveLabel');
    const button = document.getElementById('btnPeriodPicker');
    const input = document.getElementById('periodMonthInput');
    const all = document.getElementById('btnPeriodAll');
    const prev = document.getElementById('btnPeriodPrev');
    const next = document.getElementById('btnPeriodNext');
    if (active) active.textContent = label;
    if (button) button.textContent = viewPeriod.mode === 'all' ? 'Escolher mês ▾' : `${label} ▾`;
    if (input) input.value = viewPeriod.mode === 'all' ? '' : viewPeriod.month;
    if (all) { all.classList.toggle('is-active', viewPeriod.mode === 'all'); all.setAttribute('aria-pressed', viewPeriod.mode === 'all' ? 'true' : 'false'); }
    if (prev) prev.disabled = viewPeriod.mode === 'all';
    if (next) next.disabled = viewPeriod.mode === 'all';
  }
  function setViewPeriod(mode, month = currentMonthYM(), rerender = true) {
    viewPeriod = { mode: mode === 'all' ? 'all' : 'month', month: String(month || currentMonthYM()).slice(0,7) };
    saveViewPeriod(); updatePeriodUI();
    if (rerender) { renderCategorySummary(); renderLedger(); renderInvestments(); renderPocketBalances(); renderPockets(); renderPeriodSummaries(); }
  }
  function shiftViewPeriod(delta) {
    if (viewPeriod.mode === 'all') return;
    const [year, month] = viewPeriod.month.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setViewPeriod('month', `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`);
  }
  function periodSummaryHTML(items) {
    return items.map(item => `<div class="period-summary-card"><small>${escapeHTML(item.label)}</small><strong class="${item.tone || ''}">${escapeHTML(item.value)}</strong></div>`).join('');
  }
  function renderPeriodSummaries() {
    const entryItems = entries.filter(e => periodMatchesDate(e.date));
    const income = entryItems.filter(e => e.type === 'in').reduce((s,e)=>s+Number(e.amount||0),0);
    const expense = entryItems.filter(e => e.type === 'out').reduce((s,e)=>s+Number(e.amount||0),0);
    const net = income - expense;
    const caixa = document.getElementById('caixaPeriodSummary');
    if (caixa) caixa.innerHTML = periodSummaryHTML([
      {label:'Movimentações', value:String(entryItems.length)},
      {label:'Entradas', value:fmt(income), tone:'positive'},
      {label:'Saídas', value:fmt(expense), tone:'negative'},
      {label:'Resultado', value:fmt(net), tone:net >= 0 ? 'positive' : 'negative'}
    ]);

    const investMoves = yieldsLog.filter(y => y.targetType === 'invest' && periodMatchesMovement(y));
    const investAportes = investMoves.filter(y => (y.kind||'rendimento') === 'aporte').reduce((s,y)=>s+Math.abs(Number(y.amount||0)),0);
    const investResgates = investMoves.filter(y => y.kind === 'resgate').reduce((s,y)=>s+Math.abs(Number(y.amount||0)),0);
    const investYields = investMoves.filter(y => (y.kind||'rendimento') === 'rendimento').reduce((s,y)=>s+Number(y.amount||0),0);
    const investSummary = document.getElementById('investPeriodSummary');
    if (investSummary) investSummary.innerHTML = periodSummaryHTML([
      {label:'Movimentações', value:String(investMoves.length)},
      {label:'Aportes', value:fmt(investAportes), tone:'positive'},
      {label:'Resgates', value:fmt(investResgates), tone:'negative'},
      {label:'Rendimentos', value:fmt(investYields), tone:investYields >= 0 ? 'positive' : 'negative'}
    ]);

  }

  function monthKeyOffset(offset) {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + offset);
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}`;
  }

  function netFlowForMonth(monthKey) {
    return entries.filter(entry => String(entry.date || '').startsWith(monthKey)).reduce((sum, entry) => sum + (entry.type === 'in' ? Number(entry.amount || 0) : -Number(entry.amount || 0)), 0);
  }

  function monthlyFlowInsight() {
    const current = netFlowForMonth(monthKeyOffset(0));
    const previous = netFlowForMonth(monthKeyOffset(-1));
    if (current === 0 && previous === 0) return { kind:'neutral', value:'Sem comparativo mensal', detail:'Registre lançamentos em meses diferentes' };
    if (previous === 0) return { kind: current >= 0 ? 'positive' : 'negative', value:fmt(current), detail:'Fluxo líquido no mês atual' };
    const delta = ((current - previous) / Math.abs(previous)) * 100;
    const arrow = delta >= 0 ? '↑' : '↓';
    return { kind:delta >= 0 ? 'positive' : 'negative', value:`${arrow} ${Math.abs(delta).toFixed(1).replace('.', ',')}%`, detail:'em relação ao fluxo do mês anterior' };
  }

  function percentOfTotal(value, total) {
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.max(0, value / total * 100);
  }

  function financialIcon(kind) {
    const icons = {
      wallet: '<i class="fi fi-rr-wallet" aria-hidden="true"></i>',
      bank: '<i class="fi fi-rr-building" aria-hidden="true"></i>',
      box: '<i class="fi fi-rr-box" aria-hidden="true"></i>',
      growth: '<i class="fi fi-rr-chart-line-up" aria-hidden="true"></i>'
    };
    return icons[kind] || icons.wallet;
  }

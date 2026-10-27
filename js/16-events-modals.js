/* LIVRO-CAIXA · js/16-events-modals.js — eventos globais e modais (app.js: 1099-1677). Separação por responsabilidade; conteúdo preservado. */


  function formatMonthLabel(ym) {
    if (!ym) return 'Todos os Meses';
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' / ' + y;
  }

  function docRef() {
    return db.collection('livrocaixa').doc(currentUser.uid);
  }
  function colRef(name) {
    return docRef().collection(name);
  }

  let COLLECTIONS;

  let lastSynced;

  let realtimeUnsubscribers;


  /* Firestore rejeita undefined ("Unsupported field value") e rejeita o
     batch INTEIRO da coleção; structuredClone preserva chaves undefined
     que o JSON.stringify descartaria. Remove no ponto de sincronização
     (lastSynced + payload de escrita do commitDiff) — o diff por JSON
     já as ignorava, então a detecção de mudanças não muda. */
  function stripUndefinedSyncValues(value) {
    if (Array.isArray(value)) {
      return value.map(v => (v === undefined ? null : stripUndefinedSyncValues(v)));
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(key => {
        if (value[key] === undefined) delete value[key];
        else value[key] = stripUndefinedSyncValues(value[key]);
      });
      return value;
    }
    return value;
  }

  function cloneSyncItem(item) {
    if (!item || typeof item !== 'object') return item;
    let cloned = null;
    try {
      if (typeof structuredClone === 'function') cloned = structuredClone(item);
    } catch (_) {}
    if (cloned === null) {
      try {
        cloned = JSON.parse(JSON.stringify(item));
      } catch (_) {
        cloned = Array.isArray(item) ? [...item] : { ...item };
      }
    }
    return stripUndefinedSyncValues(cloned);
  }

  function arrToMap(arr) {
    const m = {};
    (arr || []).forEach(it => {
      if (it && it.id) m[it.id] = cloneSyncItem(it);
    });
    return m;
  }

  function ensureDisplayOrder(list) {
    let changed = false;
    (list || []).forEach((item, index) => {
      if (!Number.isFinite(Number(item.order))) { item.order = index; changed = true; }
    });
    return changed;
  }
  function sortDisplayOrder(list) {
    return [...(list || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }
  async function moveDisplayItem(collectionName, id, direction) {
    const list = collectionName === 'investments' ? investments : pockets;
    ensureDisplayOrder(list);
    const index = list.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    if (collectionName === 'investments') {
      const current = list[index];
      const neighbor = list[target];
      const currentKey = normalizeInstitutionKey(current?.institution);
      const neighborKey = normalizeInstitutionKey(neighbor?.institution);
      if (currentKey !== neighborKey) return;
    }
    [list[index], list[target]] = [list[target], list[index]];
    list.forEach((item, position) => { item.order = position; });
    render();
    try {
      await persistAll();
      logInfo('Organização', collectionName === 'investments' ? 'Reordenação de investimento' : 'Reordenação de caixinha', 'Sucesso', `Item movido para a posição ${target + 1}.`);
    } catch (err) {
      logSyncError('reordenação', err);
    }
  }

  async function reorderDisplayItem(collectionName, id, targetIndex) {
    const list = collectionName === 'investments' ? investments : pockets;

    ensureDisplayOrder(list);

    const ordered = sortDisplayOrder(list);
    const fromIndex = ordered.findIndex(item => item.id === id);

    if (
      fromIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= ordered.length ||
      fromIndex === targetIndex
    ) {
      return false;
    }

    const previousOrder = list.map(item => ({
      id: item.id,
      order: item.order
    }));

    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(targetIndex, 0, moved);

    ordered.forEach((item, position) => {
      item.order = position;
    });

    list.sort((a, b) =>
      (Number(a.order) || 0) - (Number(b.order) || 0)
    );

    render();

    try {
      await persistAll();

      logInfo(
        'Organização',
        collectionName === 'investments'
          ? 'Reordenação de investimento'
          : 'Reordenação de caixinha',
        'Sucesso',
        `Item movido para a posição ${targetIndex + 1}.`
      );

      return true;
    } catch (err) {
      previousOrder.forEach(({ id: previousId, order }) => {
        const item = list.find(entry => entry.id === previousId);
        if (item) item.order = order;
      });

      list.sort((a, b) =>
        (Number(a.order) || 0) - (Number(b.order) || 0)
      );

      render();
      logSyncError('reordenação', err);

      return false;
    }
  }

  function setupDisplayCardDrag(container, collectionName) {
    if (!container || container.dataset.dragBound === '1') return;

    container.dataset.dragBound = '1';

    let state = null;

    const HOLD_MS = 220;

    const getCards = () =>
      Array.from(container.children).filter(card =>
        card.matches('.invest-box, .asset-card') &&
        !card.classList.contains('drag-placeholder') &&
        card !== state?.card
      );

    const removePlaceholder = () => {
      if (state?.placeholder?.parentNode) {
        state.placeholder.parentNode.removeChild(state.placeholder);
      }
    };

    const clearDrag = () => {
      if (!state) return;

      if (state.timer) {
        clearTimeout(state.timer);
      }

      if (state.scrollRaf) {
        cancelAnimationFrame(state.scrollRaf);
      }

      if (state.card) {
        state.card.classList.remove('is-dragging');
        state.card.classList.remove('is-holding');
        state.card.style.transform = '';
        state.card.style.width = '';
        state.card.style.height = '';
        state.card.style.position = '';
        state.card.style.left = '';
        state.card.style.top = '';
        state.card.style.zIndex = '';
      }

      removePlaceholder();

    container.classList.remove('is-dragging-active');

      getCards().forEach(card => {
        card.classList.remove('drop-target');
      });

      state = null;
    };

    const createPlaceholder = card => {
      const rect = card.getBoundingClientRect();
      const placeholder = document.createElement('div');

      placeholder.className = 'drag-placeholder';
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      placeholder.setAttribute('aria-hidden', 'true');

      return placeholder;
    };

    const getInsertionIndex = (cards, pointerX, pointerY) => {
      if (!cards.length) return 0;

      /*
       * O card arrastado já foi removido da lista de candidatos por getCards().
       *
       * O cálculo anterior escolhia o centro mais próximo. Em uma fronteira
       * entre dois cards, pequenas variações do ponteiro podiam trocar o
       * destino continuamente.
       *
       * Agora usamos zonas determinísticas:
       * - agrupamento visual por linha;
       * - separação vertical entre linhas;
       * - ponto médio horizontal de cada card.
       */

      const rows = [];
      const ROW_TOLERANCE = 12;

      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        let row = rows.find(item =>
          Math.abs(item.centerY - centerY) <= ROW_TOLERANCE
        );

        if (!row) {
          row = {
            centerY,
            cards: []
          };

          rows.push(row);
        }

        row.cards.push({
          card,
          rect
        });

        row.centerY =
          row.cards.reduce(
            (sum, item) =>
              sum + item.rect.top + item.rect.height / 2,
            0
          ) / row.cards.length;
      });

      rows.sort((a, b) => a.centerY - b.centerY);

      rows.forEach(row => {
        row.cards.sort((a, b) => a.rect.left - b.rect.left);
      });

      if (!rows.length) return 0;

      let selectedRow = rows[0];

      for (let i = 0; i < rows.length - 1; i++) {
        const current = rows[i];
        const next = rows[i + 1];
        const boundary = (current.centerY + next.centerY) / 2;

        if (pointerY < boundary) {
          selectedRow = current;
          break;
        }

        selectedRow = next;
      }

      const firstCard = selectedRow.cards[0];
      const lastCard =
        selectedRow.cards[selectedRow.cards.length - 1];

      if (pointerY < selectedRow.centerY) {
        const globalIndex = cards.indexOf(firstCard.card);
        return Math.max(0, globalIndex);
      }

      for (const item of selectedRow.cards) {
        const centerX =
          item.rect.left + item.rect.width / 2;

        if (pointerX < centerX) {
          const globalIndex = cards.indexOf(item.card);
          return Math.max(0, globalIndex);
        }
      }

      const globalIndex = cards.indexOf(lastCard.card);

      return Math.min(
        cards.length,
        globalIndex + 1
      );
    };

    const STABLE_TARGET_MS = 70;

    const applyPlaceholderTarget = insertionIndex => {
      if (!state?.placeholder) return;

      const cards = getCards();
      const targetCard = cards[insertionIndex];

      state.targetIndex = insertionIndex;

      if (targetCard) {
        targetCard.before(state.placeholder);
        targetCard.classList.add('drop-target');
      } else {
        container.appendChild(state.placeholder);
      }

      cards.forEach(card => {
        if (card !== targetCard) {
          card.classList.remove('drop-target');
        }
      });
    };

    const updatePlaceholder = (pointerX, pointerY) => {
      if (!state?.placeholder) return;

      const cards = getCards();
      const insertionIndex =
        getInsertionIndex(cards, pointerX, pointerY);

      if (insertionIndex === state.targetIndex) {
        state.pendingTargetIndex = -1;

        if (state.pendingTargetTimer) {
          clearTimeout(state.pendingTargetTimer);
          state.pendingTargetTimer = null;
        }

        return;
      }

      if (insertionIndex === state.pendingTargetIndex) {
        return;
      }

      state.pendingTargetIndex = insertionIndex;

      if (state.pendingTargetTimer) {
        clearTimeout(state.pendingTargetTimer);
      }

      state.pendingTargetTimer = setTimeout(() => {
        if (!state?.placeholder) return;

        if (state.pendingTargetIndex !== insertionIndex) {
          return;
        }

        state.pendingTargetTimer = null;
        state.pendingTargetIndex = -1;

        applyPlaceholderTarget(insertionIndex);
      }, STABLE_TARGET_MS);
    };

    const SCROLL_EDGE = 48;
    const SCROLL_MAX_SPEED = 12;

    const scrollTick = () => {
      if (!state || !state.active) {
        if (state) state.scrollRaf = null;
        return;
      }

      const maxY = (window.innerHeight || 0) - SCROLL_EDGE;
      let delta = 0;

      if (state.lastY < SCROLL_EDGE) {
        const factor = Math.min(
          1,
          1 - Math.max(0, state.lastY) / SCROLL_EDGE
        );
        delta = -Math.max(1, Math.round(SCROLL_MAX_SPEED * factor));
      } else if (state.lastY > maxY) {
        const factor = Math.min(
          1,
          (state.lastY - maxY) / SCROLL_EDGE
        );
        delta = Math.max(1, Math.round(SCROLL_MAX_SPEED * factor));
      }

      if (delta) {
        window.scrollBy(0, delta);
      }

      state.scrollRaf = requestAnimationFrame(scrollTick);
    };

    container.addEventListener('pointerdown', event => {
      const handle = event.target.closest('.drag-handle');

      if (!handle || !container.contains(handle)) return;
      if (event.button !== 0) return;

      const card = handle.closest('.invest-box, .asset-card');

      if (!card || !container.contains(card)) return;

      const id = card.dataset.itemId;

      if (!id) return;

      event.preventDefault();

      card.classList.add('is-holding');

      const rect = card.getBoundingClientRect();

      state = {
        card,
        handle,
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height,
        active: false,
        targetIndex: -1,
        pendingTargetIndex: -1,
        pendingTargetTimer: null,
        placeholder: null,
        timer: setTimeout(() => {
          if (!state) return;

          state.active = true;
          container.classList.add('is-dragging-active');
          state.scrollRaf = requestAnimationFrame(scrollTick);

          state.placeholder = createPlaceholder(card);
          card.before(state.placeholder);

          card.classList.add('is-dragging');
          card.classList.remove('is-holding');

          card.style.width = `${state.width}px`;
          card.style.height = `${state.height}px`;
          card.style.position = 'fixed';
          card.style.left = `${state.startLeft}px`;
          card.style.top = `${state.startTop}px`;
          card.style.zIndex = '9999';

          try {
            handle.setPointerCapture(event.pointerId);
          } catch (_) {}

          updatePlaceholder(
            state.startX,
            state.startY
          );
        }, HOLD_MS)
      };
    });

    container.addEventListener('pointermove', event => {
      if (!state || state.pointerId !== event.pointerId) return;

      if (!state.active) return;

      event.preventDefault();

      state.lastX = event.clientX;
      state.lastY = event.clientY;

      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;

      state.card.style.transform =
        `translate(${dx}px, ${dy}px) scale(.985)`;

      updatePlaceholder(
        event.clientX,
        event.clientY
      );
    }, { passive: false });

    container.addEventListener('pointerup', async event => {
      if (!state || state.pointerId !== event.pointerId) return;

      const current = state;

      if (current.timer) {
        clearTimeout(current.timer);
      }

      if (!current.active) {
        clearDrag();
        return;
      }

      event.preventDefault();

      const cards = getCards();

      const targetIndex =
        Number.isInteger(current.targetIndex) &&
        current.targetIndex >= 0
          ? Math.max(
              0,
              Math.min(current.targetIndex, cards.length)
            )
          : -1;

      clearDrag();

      if (targetIndex >= 0) {
        await reorderDisplayItem(
          collectionName,
          current.id,
          targetIndex
        );
      }
    });

    container.addEventListener(
      'pointercancel',
      clearDrag
    );

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && state) {
        clearDrag();
      }
    });

    window.addEventListener(
      'scroll',
      () => {
        if (state?.active) {
          updatePlaceholder(state.lastX, state.lastY);
        }
      },
      { passive: true }
    );
  }

  function currentStateSnapshot() {
    return { banks, categories, entries, investments, pockets, yieldsLog, recurringBills, receivables, budgets, goals, invoiceLaunches, cards, purchases };
  }



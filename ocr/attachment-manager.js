/* LIVRO-CAIXA — AttachmentManager.
   Responsável por: validar o arquivo, normalizar metadados, aplicar
   limites, gerar identificadores temporários, controlar o ciclo de vida
   de Blob/File/ObjectURL, impedir duplicidade de processamento e
   liberar recursos após conclusão, cancelamento ou erro.

   NÃO lê conteúdo para OCR, NÃO envia nada, NÃO persiste nada.

   Contrato exposto: globalThis.LivroCaixaAttachments
     .create(options)  → instância (usada pelos testes)
     .manager          → instância única da aplicação */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./limits.js'), require('./log.js'));
  } else {
    root.LivroCaixaAttachments = factory(root.LivroCaixaOCRLimits, root.LivroCaixaOCRLog);
  }
})(typeof self !== 'undefined' ? self : this, function (limitsModule, logModule) {
  'use strict';

  const limits = limitsModule || { LIMITS: {}, classifyFile: () => ({ ok: false, code: 'UNSUPPORTED_FILE' }) };
  const log = logModule || { event: () => ({}), failure: () => ({}) };
  const LIMITS = limits.LIMITS;

  /* ---- sniff de conteúdo (magic bytes) ----------------------------------
     O anexo é dado NÃO confiável: a extensão e o MIME declarados podem
     mentir. Lemos os primeiros bytes e exigimos coerência. */
  const SIGNATURES = [
    { category: 'image', mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { category: 'image', mime: 'image/png', test: (b) => b.length > 7 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
    { category: 'image', mime: 'image/webp', test: (b) => b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
    { category: 'document', mime: 'application/pdf', test: (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 }
  ];

  function sniffContentType(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
    for (const sig of SIGNATURES) {
      try {
        if (sig.test(view)) return { category: sig.category, mime: sig.mime };
      } catch (err) {
        /* assinatura malformada → continua */
      }
    }
    return null;
  }

  function defaultIdFactory(now, random) {
    const t = typeof now === 'function' ? now() : Date.now();
    const r = typeof random === 'function' ? random() : Math.random();
    return 'a' + t + String(r).toString(36).slice(2, 7);
  }

  function fingerprintOf(meta) {
    return [meta.name, meta.size, meta.type, meta.lastModified || 0].join('|');
  }

  function create(options) {
    const opts = options || {};
    const makeId = opts.idFactory || defaultIdFactory;
    const nowFn = opts.now || (() => Date.now());
    const store = new Map();
    const readHead = opts.readHead || null; // (file) => Promise<Uint8Array>

    let processingId = null;

    function fail(code, reason, category) {
      log.failure('attachment.invalid', { stage: 'validacao', status: 'recusado', code, reason, category });
      return { ok: false, code, reason, attachment: null };
    }

    async function inspect(file) {
      if (!readHead) return null;
      try {
        const head = await readHead(file);
        const sniffed = sniffContentType(head);
        return sniffed ? sniffed.category : 'unknown';
      } catch (err) {
        return null; // sem capacidade de ler bytes → não bloqueia, MIME segue valendo
      }
    }

    async function register(file) {
      if (store.size >= (LIMITS.MAX_ATTACHMENTS_PER_OPERATION || 1)) {
        return fail('LIMIT_REACHED', 'limite_de_anexos', null);
      }

      const meta = {
        name: file && file.name != null ? String(file.name) : '',
        type: limits.normalizeType ? limits.normalizeType(file && file.type) : String((file && file.type) || ''),
        size: Number(file && file.size),
        lastModified: Number(file && file.lastModified) || 0
      };

      const contentCategory = await inspect(file);
      const verdict = limits.classifyFile(
        { name: meta.name, type: meta.type, size: meta.size },
        contentCategory
      );

      if (!verdict.ok) {
        return fail(verdict.code, verdict.reason, verdict.category);
      }

      const fp = fingerprintOf(meta);
      for (const existing of store.values()) {
        if (existing.fingerprint === fp) {
          return fail('DUPLICATE', 'arquivo_ja_processado', verdict.category);
        }
      }

      const id = makeId(nowFn, opts.random);
      const attachment = {
        id,
        name: meta.name,
        type: meta.type,
        size: meta.size,
        lastModified: meta.lastModified,
        category: verdict.category,
        contentCategory,
        fingerprint: fp,
        createdAt: nowFn(),
        objectUrl: null,
        processing: false,
        released: false,
        file
      };
      store.set(id, attachment);

      log.event('attachment.registrado', {
        stage: 'validacao',
        status: 'aceito',
        attachmentId: id,
        fileType: meta.type || limits.extensionOf(meta.name),
        fileSize: meta.size,
        category: verdict.category
      });

      return { ok: true, code: null, reason: null, attachment };
    }

    function get(id) {
      const found = store.get(id);
      return found && !found.released ? found : null;
    }

    function list() {
      return [...store.values()].filter((a) => !a.released);
    }

    /* ObjectURL é um recurso limitado: sempre rastreado e revogado. */
    function previewUrl(id) {
      const attachment = get(id);
      if (!attachment) return null;
      if (attachment.objectUrl) return attachment.objectUrl;
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
      try {
        attachment.objectUrl = URL.createObjectURL(attachment.file);
        return attachment.objectUrl;
      } catch (err) {
        return null;
      }
    }

    function release(id) {
      const attachment = store.get(id);
      if (!attachment) return false;
      if (attachment.objectUrl) {
        try {
          if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(attachment.objectUrl);
          }
        } catch (err) {
          /* revoke é best-effort */
        }
        attachment.objectUrl = null;
      }
      attachment.released = true;
      attachment.file = null;
      if (processingId === id) processingId = null;
      store.delete(id);
      log.event('attachment.liberado', { stage: 'limpeza', status: 'liberado', attachmentId: id });
      return true;
    }

    function releaseAll() {
      const ids = [...store.keys()];
      ids.forEach((id) => release(id));
      processingId = null;
      return ids.length;
    }

    /* Impede processamento duplicado do mesmo anexo (duplo clique/reenvio). */
    function beginProcessing(id) {
      const attachment = get(id);
      if (!attachment) return { ok: false, code: 'NOT_FOUND' };
      if (attachment.processing || processingId) return { ok: false, code: 'ALREADY_PROCESSING' };
      attachment.processing = true;
      processingId = id;
      return { ok: true, code: null };
    }

    function endProcessing(id) {
      const attachment = store.get(id);
      if (attachment) attachment.processing = false;
      if (!id || processingId === id) processingId = null;
      return true;
    }

    function isProcessing(id) {
      if (id) return !!(store.get(id) && store.get(id).processing);
      return processingId !== null;
    }

    function count() {
      return store.size;
    }

    return {
      register,
      get,
      list,
      previewUrl,
      release,
      releaseAll,
      beginProcessing,
      endProcessing,
      isProcessing,
      count,
      sniffContentType
    };
  }

  const manager = create({
    /* leitura dos primeiros bytes só no navegador (suficiente e barata) */
    readHead: (file) => {
      if (!file || typeof file.slice !== 'function') return Promise.resolve(null);
      try {
        const head = file.slice(0, 16);
        if (typeof head.arrayBuffer === 'function') {
          return head.arrayBuffer().then((buf) => new Uint8Array(buf));
        }
      } catch (err) {
        return Promise.resolve(null);
      }
      return Promise.resolve(null);
    }
  });

  return { create, manager, sniffContentType, SIGNATURES };
});

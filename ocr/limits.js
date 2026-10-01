/* LIVRO-CAIXA — limites operacionais de anexos/OCR.
   Fonte ÚNICA dos limites do pipeline de anexos. Aplicados ANTES de
   qualquer processamento pesado (leitura de bytes, OCR, envio à LIA).

   Regras:
   - nada aqui depende de plataforma (WEB/CAPACITOR);
   - nenhum limite é lido de variável de ambiente pelo cliente;
   - os limites do Worker continuam sendo a garantia real no servidor
     (worker/src/shared/validation.js) — estes são a barreira de entrada
     para não gasto de rede/cota com arquivo que será recusado.

   Contrato exposto: globalThis.LivroCaixaOCRLimits */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.LivroCaixaOCRLimits = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KB = 1024;
  const MB = 1024 * 1024;

  /* Categorias de arquivo aceitas nesta versão.
     image  → processável agora (leitura multimodal / OCR futuro nativo)
     document → ARQUITETURA PREPARADA, processamento ainda NÃO implementado
     (PDF/DOC/DOCX/XLS/XLSX passam por validação e retornam estado explícito) */
  const IMAGE_TYPES = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/webp'
  ]);

  const IMAGE_EXTENSIONS = Object.freeze(['jpg', 'jpeg', 'png', 'webp']);

  const DOCUMENT_TYPES = Object.freeze([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]);

  const DOCUMENT_EXTENSIONS = Object.freeze(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

  const LIMITS = Object.freeze({
    /* anexos */
    MAX_ATTACHMENTS_PER_OPERATION: 1,
    MAX_FILE_BYTES: 15 * MB,
    /* o Worker recusa imagem acima de 7 MB (MAX_IMAGE_BYTES) */
    MAX_IMAGE_BYTES: 7 * MB,
    MAX_DOCUMENT_BYTES: 15 * MB,

    /* texto extraído */
    MAX_EXTRACTED_TEXT_CHARS: 20 * 1000,
    /* prompt do Worker: MAX_PROMPT_CHARS = 60000 (contrato do servidor) */
    MAX_PROMPT_CHARS: 60 * 1000,

    /* execução */
    PROCESS_TIMEOUT_MS: 60 * 1000,
    MAX_ATTEMPTS: 1,

    /* campos individuais (evita payload gigante vindo de OCR) */
    MAX_FIELD_CHARS: Object.freeze({
      date: 10,
      merchant: 120,
      description: 160,
      amount: 24,
      category: 60,
      paymentMethod: 40,
      account: 80,
      documentNumber: 40,
      type: 20,
      idioma: 20
    }),

    /* quantidade máxima de candidatos apresentados quando ambíguos */
    MAX_CANDIDATES_PER_FIELD: 3
  });

  function extensionOf(name) {
    const text = String(name || '');
    const cut = text.lastIndexOf('.');
    if (cut < 0 || cut === text.length - 1) return '';
    return text.slice(cut + 1).toLocaleLowerCase('pt-BR');
  }

  function normalizeType(type) {
    return String(type || '').split(';')[0].trim().toLocaleLowerCase('pt-BR');
  }

  function isImageType(type) {
    return IMAGE_TYPES.indexOf(normalizeType(type)) !== -1;
  }

  function isDocumentType(type) {
    return DOCUMENT_TYPES.indexOf(normalizeType(type)) !== -1;
  }

  function isImageExtension(ext) {
    return IMAGE_EXTENSIONS.indexOf(String(ext || '').toLocaleLowerCase('pt-BR')) !== -1;
  }

  function isDocumentExtension(ext) {
    return DOCUMENT_EXTENSIONS.indexOf(String(ext || '').toLocaleLowerCase('pt-BR')) !== -1;
  }

  /* Decide a categoria do arquivo a partir de tipo + extensão.
     `contentCategory` (sniff de magic bytes), quando vier do
     AttachmentManager, tem prioridade sobre o que o sistema operacional
     declarou — um ".jpg" que é na verdade PDF é recusado. */
  function classifyFile(file, contentCategory) {
    const name = file && file.name != null ? String(file.name) : '';
    const type = normalizeType(file && file.type);
    const size = Number(file && file.size);
    const ext = extensionOf(name);

    if (!name || !Number.isFinite(size)) {
      return { ok: false, code: 'INVALID_FILE', category: null, reason: 'metadados_ausentes' };
    }
    if (size <= 0) {
      return { ok: false, code: 'INVALID_FILE', category: null, reason: 'arquivo_vazio' };
    }
    if (size > LIMITS.MAX_FILE_BYTES) {
      return { ok: false, code: 'TOO_LARGE', category: null, reason: 'acima_do_limite' };
    }

    const typeIsImage = isImageType(type);
    const typeIsDocument = isDocumentType(type);
    const extIsImage = isImageExtension(ext);
    const extIsDocument = isDocumentExtension(ext);

    if (!type && !ext) {
      return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'sem_tipo_nem_extensao' };
    }

    /* extensão incompatível com o MIME declarado */
    if (extIsImage && type && !typeIsImage) {
      return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'mime_incompativel_com_extensao' };
    }
    if (extIsDocument && type && !typeIsDocument && !typeIsImage) {
      return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'mime_incompativel_com_extensao' };
    }

    /* conteúdo não confiável: bytes não correspondem ao declarado */
    if (contentCategory) {
      const declared = typeIsImage || extIsImage ? 'image' : typeIsDocument || extIsDocument ? 'document' : null;
      if (declared && contentCategory !== declared) {
        return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'conteudo_incompativel' };
      }
      if (!declared) {
        return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'conteudo_desconhecido' };
      }
    }

    if (typeIsImage || extIsImage) {
      if (size > LIMITS.MAX_IMAGE_BYTES) {
        return { ok: false, code: 'TOO_LARGE', category: 'image', reason: 'imagem_acima_de_7mb' };
      }
      if (type && !typeIsImage) {
        return { ok: false, code: 'UNSUPPORTED_FILE', category: 'image', reason: 'mime_incompativel' };
      }
      if (!type && !extIsImage) {
        return { ok: false, code: 'UNSUPPORTED_FILE', category: 'image', reason: 'extensao_incompativel' };
      }
      return { ok: true, code: null, category: 'image', reason: null };
    }

    if (typeIsDocument || extIsDocument) {
      if (size > LIMITS.MAX_DOCUMENT_BYTES) {
        return { ok: false, code: 'TOO_LARGE', category: 'document', reason: 'documento_acima_de_15mb' };
      }
      return { ok: true, code: null, category: 'document', reason: null };
    }

    return { ok: false, code: 'UNSUPPORTED_FILE', category: null, reason: 'tipo_nao_suportado' };
  }

  return {
    LIMITS,
    IMAGE_TYPES,
    IMAGE_EXTENSIONS,
    DOCUMENT_TYPES,
    DOCUMENT_EXTENSIONS,
    extensionOf,
    normalizeType,
    isImageType,
    isDocumentType,
    isImageExtension,
    isDocumentExtension,
    classifyFile
  };
});

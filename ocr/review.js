/* LIVRO-CAIXA — V.20-01 · revisão humana antes de qualquer persistência.
   A revisão é OBRIGATÓRIA: nenhum valor aqui cria movimentação. Este módulo
   só modela o que o usuário vê/edita e valida o que ele confirmou.

   Estados visuais distintos por campo:
     CONFIRMED_BY_EXTRACTION → extraído
     USER_EDITED             → editado pelo usuário
     AMBIGUOUS / CONFLICT    → não confirmado
     MISSING                 → ausente
     INVALID                 → inválido (bloqueia a confirmação)

   Contrato exposto: globalThis.LivroCaixaReview */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./extractor.js'), require('./lia-interpret.js'), require('./limits.js'));
  } else {
    root.LivroCaixaReview = factory(root.LivroCaixaExtract, root.LivroCaixaOCRLia, root.LivroCaixaOCRLimits);
  }
})(typeof self !== 'undefined' ? self : this, function (extractorModule, liaModule, limitsModule) {
  'use strict';

  const extractor = extractorModule;
  const lia = liaModule;
  const limits = limitsModule || { LIMITS: { MAX_FIELD_CHARS: { description: 160 } } };
  const LIMITS = limits.LIMITS;

  const STATUS_STYLE = Object.freeze({
    CONFIRMED_BY_EXTRACTION: { label: 'extraído', className: 'is-extracted' },
    USER_EDITED: { label: 'editado', className: 'is-edited' },
    AMBIGUOUS: { label: 'não confirmado', className: 'is-unconfirmed' },
    CONFLICT: { label: 'não confirmado', className: 'is-unconfirmed' },
    MISSING: { label: 'ausente', className: 'is-absent' },
    INVALID: { label: 'inválido', className: 'is-invalid' }
  });

  function describe(status) {
    return STATUS_STYLE[status] || { label: String(status || '').toLowerCase(), className: 'is-absent' };
  }

  function createModel(interpreted, meta) {
    const fields = (interpreted && interpreted.fields) || {};
    return {
      fields: Object.assign({}, fields),
      overallConfidence: interpreted && Number.isFinite(interpreted.overallConfidence)
        ? interpreted.overallConfidence
        : null,
      attachment: (meta && meta.attachment) || null,
      environment: (meta && meta.environment) || 'WEB',
      provider: (meta && meta.provider) || 'none',
      extractStatus: (meta && meta.extractStatus) || null,
      confirmed: false
    };
  }

  /* Edição explícita do usuário: passa a valer como origem do valor. */
  function editField(model, key, value) {
    if (!model || !model.fields || !model.fields[key]) return model;
    const field = model.fields[key];
    const cleaned = typeof value === 'string'
      ? value.slice(0, (LIMITS.MAX_FIELD_CHARS && LIMITS.MAX_FIELD_CHARS[key]) || 200)
      : value;
    field.value = cleaned === '' || cleaned == null ? null : cleaned;
    field.edited = true;
    field.status = field.value == null ? extractor.STATUS.MISSING : extractor.STATUS.USER_EDITED;
    if (field.value != null) {
      field.candidates = [];
      if (!Number.isFinite(field.confidence)) field.confidence = 1;
    }
    field.invalid = false;
    return model;
  }

  /* Escolha de candidato: continua sendo ação humana (não é chute do sistema). */
  function chooseCandidate(model, key, candidate) {
    return editField(model, key, candidate);
  }

  function invalidate(model, key) {
    if (!model || !model.fields || !model.fields[key]) return model;
    model.fields[key].status = extractor.STATUS.INVALID;
    model.fields[key].invalid = true;
    return model;
  }

  function optionValues(options) {
    return (Array.isArray(options) ? options : []).map((o) => (typeof o === 'object' ? o.value : o));
  }

  function hasOption(values, value) {
    return values.some((v) => String(v) === String(value));
  }

  /* Validação final. Espelha as regras EXISTENTES do fluxo de lançamento
     (descrição obrigatória, valor > 0) e acrescenta o que o fluxo de
     documento exige (data explícita e tipo definido — nada é presumido). */
  function validate(model, options) {
    const opts = options || {};
    const fields = (model && model.fields) || {};
    const bankOptions = optionValues(opts.bankOptions);
    const categoryOptions = optionValues(opts.categoryOptions);

    const errors = [];
    const push = (key, code, message) => errors.push({ key, code, message });

    const rawDate = fields.date ? fields.date.value : null;
    const date = rawDate ? extractor.parseDate(String(rawDate)) : null;
    if (!rawDate) push('date', 'date_required', 'Informe a data do documento.');
    else if (!date) push('date', 'date_invalid', 'A data informada não é válida.');

    const rawDesc = fields.description ? fields.description.value : null;
    const desc = String(rawDesc == null ? '' : rawDesc).trim();
    const maxDesc = (LIMITS.MAX_FIELD_CHARS && LIMITS.MAX_FIELD_CHARS.description) || 160;
    if (!desc) push('description', 'description_required', 'Informe a descrição.');
    else if (desc.length > maxDesc) push('description', 'description_too_long', 'A descrição excede o tamanho máximo.');

    const rawAmount = fields.amount ? fields.amount.value : null;
    const amount = Number(rawAmount);
    if (rawAmount == null || !Number.isFinite(amount)) push('amount', 'amount_required', 'Informe o valor.');
    else if (amount <= 0) push('amount', 'amount_invalid', 'O valor deve ser maior que zero.');

    const type = fields.type ? fields.type.value : null;
    if (type !== 'in' && type !== 'out') push('type', 'type_required', 'Defina se é entrada ou saída.');

    const bank = fields.account ? (fields.account.resolvedId != null ? String(fields.account.resolvedId) : '') : '';
    if (bankOptions.length && !hasOption(bankOptions, bank)) {
      push('account', 'account_required', 'Selecione a conta.');
    }

    const category = fields.category ? (fields.category.resolvedId != null ? String(fields.category.resolvedId) : '') : '';
    if (categoryOptions.length && !hasOption(categoryOptions, category)) {
      push('category', 'category_required', 'Selecione a categoria.');
    }

    for (const err of errors) invalidate(model, err.key);

    if (errors.length) {
      return { ok: false, errors, value: null };
    }

    return {
      ok: true,
      errors: [],
      value: {
        date,
        desc,
        bank,
        category,
        amount: Math.round(amount * 100) / 100,
        type
      }
    };
  }

  /* Resumo legível para a UI (sem vazar conteúdo sensível extra). */
  function summary(model) {
    const fields = (model && model.fields) || {};
    const counts = { extracted: 0, edited: 0, unconfirmed: 0, absent: 0, invalid: 0 };
    for (const key of Object.keys(fields)) {
      const status = fields[key].status;
      if (status === extractor.STATUS.INVALID) counts.invalid += 1;
      else if (status === extractor.STATUS.MISSING) counts.absent += 1;
      else if (status === extractor.STATUS.AMBIGUOUS || status === extractor.STATUS.CONFLICT) counts.unconfirmed += 1;
      else if (status === extractor.STATUS.USER_EDITED) counts.edited += 1;
      else counts.extracted += 1;
    }
    return counts;
  }

  return {
    STATUS_STYLE,
    describe,
    createModel,
    editField,
    chooseCandidate,
    invalidate,
    validate,
    summary
  };
});

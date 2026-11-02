/* LIVRO-CAIXA · js/30-transfer-receipts.js — transferência e comprovantes (app.js: 13523-14134). Separação por responsabilidade; conteúdo preservado. */


  // P3.5.10 — Entrada de comprovante para transferência.
let transferReceiptReaderState;


function clearTransferReceiptReaderState() {
  transferReceiptReaderState = null;

  const input = document.getElementById('transferReceiptFile');
  const status = document.getElementById('transferReceiptFileStatus');

  if (input) input.value = '';

  if (status) {
    status.textContent = '';
    status.style.display = 'none';
  }
}

function setTransferReceiptFileStatus(message, isError = false, showRetry = false) {
  const status = document.getElementById('transferReceiptFileStatus');
  if (!status) return;

  status.textContent = message;
  status.style.display = message ? 'block' : 'none';
  status.style.opacity = isError ? '1' : '.8';

  if (showRetry && transferReceiptReaderState?.file) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Tentar novamente';
    retry.style.marginLeft = '8px';
    // retry.onclick = () => runTransferReceiptAIAnalysis(); // Função removida com a IA
    status.appendChild(retry);
  }
}

function parseTransferReceiptAIResult(responseText) {
  const cleaned = String(responseText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      'A IA retornou um resultado de transferência que não está em JSON válido.'
    );
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      'A IA retornou uma estrutura de transferência inválida.'
    );
  }

  const allowedTypes = new Set([
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const normalizeText = normalizeReceiptText;
  const normalizeDate = normalizeReceiptDate;
  const normalizeValue = normalizeReceiptValue;
  const data =
    parsed.data == null
      ? null
      : String(parsed.data).trim() || null;

  const bancoOrigem = normalizeText(parsed.banco_origem);
  const bancoDestino = normalizeText(parsed.banco_destino);
  const descricao = normalizeText(parsed.descricao);
  const observacoes = normalizeText(parsed.observacoes);

  const valor =
    parsed.valor == null || parsed.valor === ''
      ? null
      : Number(parsed.valor);

  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) {
    throw new Error(
      'A IA retornou um valor de transferência inválido.'
    );
  }

  const tipo = allowedTypes.has(parsed.tipo)
    ? parsed.tipo
    : 'desconhecido';

  const confianca = allowedConfidence.has(parsed.confianca)
    ? parsed.confianca
    : 'baixa';

  return {
    data,
    bancoOrigem,
    bancoDestino,
    valor,
    descricao,
    tipo,
    confianca,
    observacoes
  };
}

function normalizeTransferReceiptAIData(aiData) {
  if (
    !aiData ||
    typeof aiData !== 'object' ||
    Array.isArray(aiData)
  ) {
    throw new Error(
      'Os dados do comprovante de transferência são inválidos.'
    );
  }

  const normalizeText = normalizeReceiptText;
  const normalizeDate = normalizeReceiptDate;
  const normalizeValue = normalizeReceiptValue;
  const data = normalizeDate(aiData.data);
  const bancoOrigem = normalizeText(aiData.bancoOrigem);
  const bancoDestino = normalizeText(aiData.bancoDestino);
  const valor = normalizeValue(aiData.valor);
  const descricao = normalizeText(aiData.descricao);
  const observacoes = normalizeText(aiData.observacoes);

  const missingFields = [];

  if (!data) missingFields.push('data');
  if (!bancoOrigem) missingFields.push('banco_origem');
  if (!bancoDestino) missingFields.push('banco_destino');
  if (valor === null) missingFields.push('valor');

  const warnings = [];

  if (!data && aiData.data != null) {
    warnings.push(
      'A data identificada não pôde ser validada.'
    );
  }

  if (!bancoOrigem) {
    warnings.push(
      'A origem da transferência não foi identificada com segurança.'
    );
  }

  if (!bancoDestino) {
    warnings.push(
      'O destino da transferência não foi identificado com segurança.'
    );
  }

  if (valor === null && aiData.valor != null) {
    warnings.push(
      'O valor identificado não pôde ser validado.'
    );
  }

  if (aiData.tipo !== 'transferencia') {
    warnings.push(
      'A IA não confirmou com segurança que o comprovante representa uma transferência.'
    );
  }

  if (aiData.confianca === 'baixa') {
    warnings.push(
      'A leitura do comprovante possui baixa confiança.'
    );
  }

  return {
    data,
    bancoOrigem,
    bancoDestino,
    valor,
    descricao,
    observacoes,
    missingFields,
    warnings,
    isValid: missingFields.length === 0
  };
}

function matchTransferReceiptTarget(rawTarget) {
  const raw = String(rawTarget || '').trim();

  if (!raw) {
    return {
      raw: '',
      id: '',
      name: '',
      confidence: 0
    };
  }

  const token = normalizeImportToken(raw);

  if (!token) {
    return {
      raw,
      id: '',
      name: '',
      confidence: 0
    };
  }

  const exact = (banks || []).find(bank =>
    normalizeImportToken(bank.name) === token
  );

  if (exact) {
    return {
      raw,
      id: exact.id,
      name: exact.name,
      confidence: 1
    };
  }

  const partial = (banks || [])
    .map(bank => ({
      bank,
      key: normalizeImportToken(bank.name)
    }))
    .filter(item =>
      item.key &&
      (
        item.key.includes(token) ||
        token.includes(item.key) ||
        token.split(' ').some(part =>
          part.length > 3 &&
          item.key.split(' ').includes(part)
        )
      )
    )
    .sort((a, b) => b.key.length - a.key.length)[0];

  if (partial) {
    return {
      raw,
      id: partial.bank.id,
      name: partial.bank.name,
      confidence: 0.7
    };
  }

  return {
    raw,
    id: '',
    name: '',
    confidence: 0
  };
}

function classifyTransferReceiptTargetMatch(match) {
  if (!match?.id) {
    return {
      status: 'not_found',
      label: 'Conta não encontrada',
      requiresConfirmation: true
    };
  }

  if (match.confidence >= 1) {
    return {
      status: 'exact',
      label: 'Correspondência exata',
      requiresConfirmation: false
    };
  }

  return {
    status: 'partial',
    label: 'Correspondência parcial',
    requiresConfirmation: true
  };
}

function resolveTransferReceiptTargets() {
  const data = transferReceiptReaderState?.normalizedData;

  if (!data) {
    return {
      origin: null,
      destination: null
    };
  }

  const origin = matchTransferReceiptTarget(data.bancoOrigem);
  const destination = matchTransferReceiptTarget(data.bancoDestino);

  return {
    origin: {
      match: origin,
      status: classifyTransferReceiptTargetMatch(origin)
    },
    destination: {
      match: destination,
      status: classifyTransferReceiptTargetMatch(destination)
    }
  };
}

function applyTransferReceiptToForm() {
  const data = transferReceiptReaderState?.normalizedData;
  const targets = transferReceiptReaderState?.targets;

  if (!data) {
    setTransferReceiptFileStatus(
      'Não há dados normalizados do comprovante para preencher a transferência.',
      true
    );
    return false;
  }

  const dateInput = document.getElementById('tData');
  const deSelect = document.getElementById('tDe');
  const paraSelect = document.getElementById('tPara');

  if (dateInput) {
    dateInput.value = data.data || '';
  }

  if (deSelect) {
    const originId = targets?.origin?.match?.id || '';

    deSelect.value = (
      originId &&
      banks.some(bank => bank.id === originId)
    )
      ? originId
      : '';
  }

  if (paraSelect) {
    const destinationId = targets?.destination?.match?.id || '';

    paraSelect.value = (
      destinationId &&
      banks.some(bank => bank.id === destinationId)
    )
      ? destinationId
      : '';
  }

  if (data.valor !== null) {
    setMoneyInput('tValor', data.valor);
  } else {
    setMoneyInput('tValor', '');
  }

  const descriptionParts = [];

  if (data.descricao) {
    descriptionParts.push(data.descricao);
  }

  if (data.observacoes) {
    descriptionParts.push(data.observacoes);
  }

  const descInput = document.getElementById('tDesc');

  if (descInput) {
    descInput.value = descriptionParts.join(' · ');
  }

  const warnings = [...(data.warnings || [])];

  if (targets?.origin?.status?.status === 'not_found') {
    warnings.push(
      'A conta de origem identificada pela IA não foi encontrada nas contas cadastradas.'
    );
  } else if (targets?.origin?.status?.status === 'partial') {
    warnings.push(
      'A conta de origem foi encontrada por correspondência parcial. Revise antes de transferir.'
    );
  }

  if (targets?.destination?.status?.status === 'not_found') {
    warnings.push(
      'A conta de destino identificada pela IA não foi encontrada nas contas cadastradas.'
    );
  } else if (targets?.destination?.status?.status === 'partial') {
    warnings.push(
      'A conta de destino foi encontrada por correspondência parcial. Revise antes de transferir.'
    );
  }

  if (!data.data) {
    warnings.push(
      'A data não foi identificada. Informe a data antes de transferir.'
    );
  }

  if (data.valor === null) {
    warnings.push(
      'O valor não foi identificado. Informe o valor antes de transferir.'
    );
  }

  const warningText = warnings.length
    ? ` · Atenção: ${warnings.join(' ')}`
    : '';

  setTransferReceiptFileStatus(
    warnings.length
      ? `Comprovante aplicado ao formulário. Revise os dados antes de transferir.${warningText}`
      : 'Comprovante aplicado ao formulário. Revise os dados antes de transferir.',
    warnings.length > 0
  );

  return true;
}

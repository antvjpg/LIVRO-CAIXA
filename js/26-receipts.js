/* LIVRO-CAIXA · js/26-receipts.js — comprovantes (app.js: 9652-10471). Separação por responsabilidade; conteúdo preservado. */



// P3.5.2 — Entrada de comprovante para leitura inteligente.
// O arquivo permanece somente em memória nesta etapa.
let receiptReaderState;


function clearReceiptReaderState() {
  receiptReaderState = null;
  const input = document.getElementById('receiptFile');
  const status = document.getElementById('receiptFileStatus');

  if (input) input.value = '';

  if (status) {
    status.textContent = '';
    status.style.display = 'none';
  }
}

function setReceiptFileStatus(message, isError = false) {
  const status = document.getElementById('receiptFileStatus');
  if (!status) return;

  status.textContent = message;
  status.style.display = message ? 'block' : 'none';
  status.style.opacity = isError ? '1' : '.8';
}


// P3.5.3 — Envio multimodal do comprovante à IA (OpenRouter/MiMo).
// A IA interpreta o arquivo, mas não grava nenhum dado financeiro.
let receiptAIResponseText;


async function fileToReceiptGenerativePart(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      try {
        const result = String(reader.result || '');
        const base64Data = result.split(',')[1] || '';

        if (!base64Data) {
          reject(new Error('Não foi possível preparar o comprovante para análise.'));
          return;
        }

        resolve({
          type: 'image_url',
          image_url: {
            url: `data:${file.type || 'image/jpeg'};base64,${base64Data}`
          }
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Não foi possível ler o arquivo do comprovante.'));
    };

    reader.readAsDataURL(file);
  });
}

function normalizeReceiptTypeToken(value) {
  const text = String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (!text) return null;

  const aliases = {
    entrada: 'entrada',
    in: 'entrada',
    credito: 'entrada',
    recebimento: 'entrada',
    recebido: 'entrada',
    deposito: 'entrada',
    saida: 'saida',
    out: 'saida',
    debito: 'saida',
    pagamento: 'saida',
    enviado: 'saida',
    sacado: 'saida',
    compra: 'saida',
    transferencia: 'transferencia'
  };

  return aliases[text] || null;
}

function normalizeHolderKey(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getAccountHolderNames() {
  const names = [];

  const add = (value) => {
    const key = normalizeHolderKey(value);
    if (key.length >= 3 && !names.includes(key)) names.push(key);
  };

  const user = typeof currentUser !== 'undefined' ? currentUser : null;

  add(user && user.displayName);
  add(user && user.email && user.email.split('@')[0]);

  return names;
}

function matchesAccountHolder(text, holderNames) {
  const value = normalizeHolderKey(text);

  if (!value || !holderNames || !holderNames.length) return false;

  return holderNames.some((name) => {
    if (value === name) return true;
    if (value.length < 5 || name.length < 5) return false;
    return value.includes(name) || name.includes(value);
  });
}

function resolveReceiptType(tipo, pagador, recebedor, holderNames) {
  if (tipo !== 'desconhecido') return tipo;
  if (!holderNames || !holderNames.length) return tipo;

  const pagadorIsOwner = matchesAccountHolder(pagador, holderNames);
  const recebedorIsOwner = matchesAccountHolder(recebedor, holderNames);

  if (pagadorIsOwner === recebedorIsOwner) return tipo;

  return pagadorIsOwner ? 'saida' : 'entrada';
}

function parseReceiptAIResult(responseText) {
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
    throw new Error('A IA retornou um resultado que não está em JSON válido.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('A IA retornou uma estrutura de dados inválida.');
  }

  const allowedTypes = new Set([
    'entrada',
    'saida',
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const data = parsed.data == null ? null : String(parsed.data).trim() || null;
  const descricao =
    parsed.descricao == null
      ? null
      : String(parsed.descricao).trim() || null;
  const banco =
    parsed.banco == null
      ? null
      : String(parsed.banco).trim() || null;
  const observacoes =
    parsed.observacoes == null
      ? null
      : String(parsed.observacoes).trim() || null;

  const pagador =
    parsed.pagador == null
      ? null
      : String(parsed.pagador).trim() || null;

  const recebedor =
    parsed.recebedor == null
      ? null
      : String(parsed.recebedor).trim() || null;

  const valor =
    parsed.valor == null || parsed.valor === ''
      ? null
      : Number(parsed.valor);

  if (valor !== null && !Number.isFinite(valor)) {
    throw new Error('A IA retornou um valor financeiro inválido.');
  }

  const tipo = allowedTypes.has(parsed.tipo)
    ? parsed.tipo
    : normalizeReceiptTypeToken(parsed.tipo) || 'desconhecido';

  const confianca = allowedConfidence.has(parsed.confianca)
    ? parsed.confianca
    : 'baixa';

  return {
    data,
    valor,
    descricao,
    banco,
    tipo,
    confianca,
    observacoes,
    pagador,
    recebedor
  };
}

function normalizeReceiptAIData(aiData) {
  if (!aiData || typeof aiData !== 'object' || Array.isArray(aiData)) {
    throw new Error('Os dados do comprovante são inválidos.');
  }

  const normalizeText = (value) => {
    if (value == null) return null;
    const text = String(value).trim();
    return text || null;
  };

  const normalizeDate = (value) => {
    if (value == null || value === '') return null;

    let text = String(value).trim();
    if (!text) return null;

    /* Ignora horário/fuso quando vier junto: "2026-09-24T10:15:00-03:00" */
    const isoWithTime = text.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
    if (isoWithTime) text = isoWithTime[1];

    const isValidIso = (iso) => {
      const [year, month, day] = iso.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      );
    };

    if (/^\d{4}-\d{2}-\d{2}$/.test(text) && isValidIso(text)) {
      return text;
    }

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
      const iso = text.replace(/\//g, '-');
      if (isValidIso(iso)) return iso;
    }

    /* 24/09/2026, 24-09-2026, 24.09.2026 e dígitos simples */
    const dayFirst = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (dayFirst) {
      const [, day, month, year] = dayFirst;
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      if (isValidIso(iso)) return iso;
    }

    return null;
  };

  const normalizeValue = (value) => {
    if (value == null || value === '') return null;

    if (typeof value === 'number') {
      return Number.isFinite(value) && value >= 0 ? value : null;
    }

    let text = String(value).trim();

    if (!text) return null;

    text = text
      .replace(/\s/g, '')
      .replace(/R\$/gi, '');

    if (text.includes(',') && text.includes('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else if (text.includes(',')) {
      text = text.replace(',', '.');
    }

    const number = Number(text);

    return Number.isFinite(number) && number >= 0 ? number : null;
  };

  const allowedTypes = new Set([
    'entrada',
    'saida',
    'transferencia',
    'desconhecido'
  ]);

  const allowedConfidence = new Set([
    'alta',
    'media',
    'baixa'
  ]);

  const data = normalizeDate(aiData.data);
  const valor = normalizeValue(aiData.valor);
  const descricao = normalizeText(aiData.descricao);
  const banco = normalizeText(aiData.banco);
  const observacoes = normalizeText(aiData.observacoes);
  const pagador = normalizeText(aiData.pagador);
  const recebedor = normalizeText(aiData.recebedor);

  const rawTipo = allowedTypes.has(aiData.tipo)
    ? aiData.tipo
    : normalizeReceiptTypeToken(aiData.tipo) || 'desconhecido';

  const tipo = resolveReceiptType(
    rawTipo,
    pagador,
    recebedor,
    getAccountHolderNames()
  );

  const tipoInferidoPeloTitular = tipo !== rawTipo;

  const confianca = allowedConfidence.has(aiData.confianca)
    ? aiData.confianca
    : 'baixa';

  const missingFields = [];

  if (!data) missingFields.push('data');
  if (valor === null) missingFields.push('valor');
  if (!descricao) missingFields.push('descricao');
  if (!banco) missingFields.push('banco');

  const warnings = [];

  if (!data && aiData.data != null) {
    warnings.push('A data identificada não pôde ser validada.');
  }

  if (valor === null && aiData.valor != null) {
    warnings.push('O valor identificado não pôde ser validado.');
  }

  if (tipo === 'desconhecido') {
    warnings.push(
      'Não foi possível identificar se é entrada ou saída. Confirme o tipo antes de salvar.'
    );
  } else if (tipoInferidoPeloTitular) {
    warnings.push(
      'O tipo da operação foi inferido pelo nome do titular — confirme antes de salvar.'
    );
  }

  if (confianca === 'baixa') {
    warnings.push('A leitura do comprovante possui baixa confiança.');
  }

  return {
    data,
    valor,
    descricao,
    banco,
    tipo,
    confianca,
    observacoes,
    pagador,
    recebedor,
    missingFields,
    warnings,
    isValid: missingFields.length === 0
  };
}


// P3.5.6 — Correspondência do banco identificado pela IA com uma conta local.
// Esta função somente identifica um banco existente; não cria nem altera registros.
function matchReceiptBank(rawBank) {
  const raw = String(rawBank || '').trim();

  if (!raw) {
    return {
      raw: '',
      id: '',
      name: '',
      confidence: 0
    };
  }

  const match = findImportMatch(raw, banks);

  return {
    raw,
    id: match?.id || '',
    name: match?.name || '',
    confidence: Number(match?.confidence || 0)
  };
}


function classifyReceiptBankMatch(bankMatch) {
  if (!bankMatch || !bankMatch.id) {
    return {
      status: 'not_found',
      label: 'Banco não encontrado',
      canSuggest: false,
      requiresConfirmation: true
    };
  }

  if (bankMatch.confidence >= 1) {
    return {
      status: 'exact',
      label: 'Correspondência exata',
      canSuggest: true,
      requiresConfirmation: false
    };
  }

  if (bankMatch.confidence >= 0.7) {
    return {
      status: 'partial',
      label: 'Correspondência parcial',
      canSuggest: true,
      requiresConfirmation: true
    };
  }

  return {
    status: 'uncertain',
    label: 'Correspondência incerta',
    canSuggest: false,
    requiresConfirmation: true
  };
}


function findReceiptDuplicate(normalizedData, bankMatch) {
  if (!normalizedData || !bankMatch?.id) {
    return {
      found: false,
      entry: null
    };
  }

  const typeMap = {
    entrada: 'in',
    saida: 'out'
  };

  const type = typeMap[normalizedData.tipo];

  if (!type || !normalizedData.data || normalizedData.valor === null) {
    return {
      found: false,
      entry: null
    };
  }

  const description = String(normalizedData.descricao || '').trim();

  if (!description) {
    return {
      found: false,
      entry: null
    };
  }

  const possibleDuplicate = entries.find(entry =>
    entry.date === normalizedData.data &&
    entry.bank === bankMatch.id &&
    entry.type === type &&
    Math.abs(Number(entry.amount) - Number(normalizedData.valor)) < 0.005 &&
    String(entry.desc || '').trim().toLocaleLowerCase('pt-BR') ===
      description.toLocaleLowerCase('pt-BR')
  );

  return {
    found: Boolean(possibleDuplicate),
    entry: possibleDuplicate || null
  };
}

function applyReceiptToLaunchForm() {
  const data = receiptReaderState?.normalizedData;

  if (!data) {
    setReceiptFileStatus(
      'Não há dados normalizados do comprovante para preencher o lançamento.',
      true
    );
    return false;
  }

  const dateInput = document.getElementById('fData');
  const descInput = document.getElementById('fDesc');
  const bankSelect = document.getElementById('fBanco');
  const categorySelect = document.getElementById('fCategoria');

  if (dateInput) {
    dateInput.value = data.data || '';
  }

  if (descInput) {
    descInput.value = data.descricao || '';
  }

  if (data.valor !== null) {
    setMoneyInput('fValor', data.valor);
  } else {
    setMoneyInput('fValor', '');
  }

  if (bankSelect) {
    const bankMatch = receiptReaderState?.bankMatch;

    if (bankMatch?.id && banks.some(bank => bank.id === bankMatch.id)) {
      bankSelect.value = bankMatch.id;
    } else {
      bankSelect.value = '';
    }
  }

  if (categorySelect) {
    const suggestedCategoryId =
      data.descricao
        ? suggestCategoryForDescription(data.descricao)
        : '';

    if (
      suggestedCategoryId &&
      categories.some(category => category.id === suggestedCategoryId)
    ) {
      categorySelect.value = suggestedCategoryId;
    } else {
      categorySelect.value = '';
    }
  }

  if (data.tipo === 'entrada') {
    document.getElementById('tglIn')?.click();
  } else if (data.tipo === 'saida') {
    document.getElementById('tglOut')?.click();
  }

  const warnings = [...(data.warnings || [])];

  if (data.tipo === 'transferencia') {
    warnings.push(
      'Este documento parece uma transferência entre contas. Use o fluxo de transferências ou confirme o tipo.'
    );
  }

  if (!data.data) {
    warnings.push('A data não foi identificada pela IA. Preencha a data manualmente.');
  }

  if (!data.banco) {
    warnings.push('O comprovante não traz banco identificável. Escolha a conta manualmente.');
  } else if (receiptReaderState?.bankMatchStatus?.status === 'not_found') {
    warnings.push('O banco identificado pela IA não foi encontrado nas contas cadastradas.');
  } else if (receiptReaderState?.bankMatchStatus?.status === 'partial') {
    warnings.push('O banco foi encontrado por correspondência parcial. Revise antes de salvar.');
  }

  if (receiptReaderState?.duplicate?.found) {
    warnings.push('Foi encontrado um lançamento possivelmente duplicado. Revise antes de salvar.');
  }

  const warningText = warnings.length
    ? ` · Atenção: ${warnings.join(' ')}`
    : '';

  const quota = window.LivroCaixaAI?.getQuota();
  const quotaNote = !quota
    ? ''
    : quota.remaining <= 0
      ? ` Limite diário de leituras de IA atingido (${quota.limit}/dia).`
      : quota.remaining <= 5
        ? ` Leituras de IA hoje: ${quota.remaining} de ${quota.limit} restantes.`
        : '';

  setReceiptFileStatus(
    `Comprovante aplicado ao formulário. Revise os dados antes de salvar.${warningText}${quotaNote}`,
    warnings.length > 0 || Boolean(quota && quota.remaining <= 0)
  );

  return true;
}

async function runReceiptAIAnalysis() {
  const button = document.getElementById('btnReadReceipt');

  if (!receiptReaderState?.file) {
    setReceiptFileStatus('Selecione um comprovante antes de iniciar a leitura.', true);
    return;
  }

  if (!window.LivroCaixaAI?.isReady()) {
    setReceiptFileStatus(
      'Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para ler comprovantes.',
      true
    );
    alert('Entre na sua conta ou cadastre uma chave local em Perfil → Análise assistida para usar a leitura de comprovantes.');
    return;
  }

  const file = receiptReaderState.file;

  if (file.type.startsWith('image/') && file.size > 7 * 1024 * 1024) {
    setReceiptFileStatus(
      'Imagem muito grande para leitura multimodal. Use uma imagem de até 7 MB.',
      true
    );
    alert('Para imagens, use um arquivo de até 7 MB.');
    return;
  }

  const originalButtonText = button?.textContent || 'Ler comprovante com IA';

  try {
    receiptAIResponseText = '';

    if (button) {
      button.disabled = true;
      button.textContent = 'Lendo comprovante…';
    }

    setReceiptFileStatus(
      `Enviando ${file.name} para análise inteligente…`
    );

    const filePart = await fileToReceiptGenerativePart(file);

    const holderUser = typeof currentUser !== 'undefined' ? currentUser : null;
    const holderLabel =
      (holderUser && (holderUser.displayName || holderUser.email)) || 'não informado';

    const prompt = `
Analise o comprovante financeiro anexado.

Titular desta conta: ${holderLabel}.

Nesta etapa, faça somente a leitura e interpretação do documento.
NÃO grave, altere ou execute nenhum lançamento financeiro.
NÃO invente informações ausentes.
NÃO presuma dados que não estejam visíveis no comprovante.
Quando um campo não puder ser identificado com segurança, use null.

Retorne SOMENTE um objeto JSON válido, sem markdown, sem blocos de código e sem texto antes ou depois.

Use exatamente esta estrutura:

{
  "data": null,
  "valor": null,
  "descricao": null,
  "banco": null,
  "pagador": null,
  "recebedor": null,
  "tipo": null,
  "confianca": null,
  "observacoes": null
}

Regras:
- "data": data da operação. SEMPRE preencha quando existir QUALQUER data visível no comprovante (data de emissão, data da transação, data/hora). Converta sempre para YYYY-MM-DD. Exemplos: "24/09/2026" ou "24-09-2026" → "2026-09-24"; "2026-09-24" mantenha; "24 de setembro de 2026" → "2026-09-24". Use null somente se o documento não tiver nenhuma data.
- "valor": valor numérico da operação, sem símbolo de moeda, quando identificável.
- "descricao": estabelecimento, pessoa ou descrição principal do comprovante.
- "banco": banco ou instituição identificada no documento.
- "pagador": nome ou conta de quem paga/envia o dinheiro, quando visível no documento. Caso contrário null.
- "recebedor": nome ou conta de quem recebe o dinheiro, quando visível no documento. Caso contrário null.
- "tipo": use somente "entrada", "saida", "transferencia" ou "desconhecido". Siga esta ordem de decisão:
  1. O titular acima aparece como recebedor → "entrada".
  2. O titular acima aparece como pagador → "saida".
  3. Sem o titular no documento: "recebido", "crédito", "recebimento", "depositado" → "entrada"; "enviado", "pagamento", "débito", "saída", "cobrança", "compra" → "saida".
  4. Movimentação entre contas do mesmo titular → "transferencia".
  5. Nenhum desses sinais → "desconhecido".
- "confianca": use somente "alta", "media" ou "baixa".
- "observacoes": informações relevantes que não caibam nos demais campos.
- Se houver dúvida relevante sobre qualquer campo, prefira null.
- Não transforme a interpretação em um lançamento financeiro.
- Não execute nenhuma ação no aplicativo.
`;

    const responseText = await window.LivroCaixaAI.generate({
      prompt,
      imagePart: filePart,
      maxTokens: 500
    });

    if (!responseText) {
      throw new Error('A IA não retornou uma resposta utilizável.');
    }

    const receiptAIData = parseReceiptAIResult(responseText);
    const normalizedReceiptData = normalizeReceiptAIData(receiptAIData);
    const matchedReceiptBank = matchReceiptBank(normalizedReceiptData.banco);
    const receiptBankMatch = classifyReceiptBankMatch(matchedReceiptBank);
    const receiptDuplicate = findReceiptDuplicate(
      normalizedReceiptData,
      matchedReceiptBank
    );

    receiptAIResponseText = responseText;

    if (receiptReaderState) {
      receiptReaderState.aiText = responseText;
      receiptReaderState.aiData = receiptAIData;
      receiptReaderState.normalizedData = normalizedReceiptData;
      receiptReaderState.bankMatch = matchedReceiptBank;
      receiptReaderState.bankMatchStatus = receiptBankMatch;
      receiptReaderState.duplicate = receiptDuplicate;
      receiptReaderState.aiStatus = 'completed';
    }

    if (applyReceiptToLaunchForm()) {
      openModal('panelNovo');
    }



  } catch (error) {
    receiptAIResponseText = '';

    if (receiptReaderState) {
      receiptReaderState.aiText = '';
      receiptReaderState.aiStatus = 'error';
    }

    console.error('P3.5.3 — Erro na leitura inteligente do comprovante:', error);

    setReceiptFileStatus(
      `Não foi possível ler o comprovante: ${error?.message || 'erro desconhecido'}`,
      true
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalButtonText;
    }
  }
}

function openNewEntryModal() {
    if (banks.length === 0) {
      alert('Cadastre pelo menos um banco antes de fazer lançamentos.');
      openModal('panelBanco');
      return;
    }
    editingEntryId = null;
    clearReceiptReaderState();
    document.getElementById('panelNovoTitle').innerHTML = 'Novo lançamento <button type="button" class="modal-close" onclick="closeAllPanels()">×</button>';
    document.getElementById('fSalvar').textContent = 'Salvar';
    document.getElementById('fDesc').value = '';
    setMoneyInput('fValor', 0);
    document.getElementById('fData').value = todayISO();
    openModal('panelNovo');
}

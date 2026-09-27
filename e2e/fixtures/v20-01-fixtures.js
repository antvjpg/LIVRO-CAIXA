/* C.O.D.E. — fixtures V.20-01 (anexos · leitura/OCR · revisão humana).
   Documentos SINTÉTICOS. Nenhum dado real de usuário.

   Marcador único CODE_V2001_* identifica o dado em qualquer tela, log ou
   consulta (regra do C.O.D.E. de dado de teste).

   `expected` é o ORÁCULO: valores escritos à mão a partir do texto do
   documento, independentes da implementação. A suíte compara a implementação
   contra estes valores — nunca contra o próprio código. */
'use strict';

const MARK = 'CODE_V2001';

/* --------------------------------------------------------------- válido */
/* Uma data, um total rotulado, um estabelecimento, sem ambiguidade. */
const RECEIPT_VALID_TEXT = [
  'MERCADO EXEMPLO ALIMENTOS LTDA',
  'CNPJ 12.345.678/0001-90',
  'AV. DAS EXEMPLOS, 1000 - SAO PAULO',
  '',
  'DATA DA OPERACAO: 20/09/2026',
  'NSU 884213',
  '',
  'PAGAMENTO PIX DEBITO',
  'CONTA ITAU AG 0001',
  '',
  'TOTAL R$ 1.234,56',
  '',
  'Itens',
  'Arroz integral 5kg      R$ 25,90',
  'Feijao carioca 1kg      R$ 8,49',
  'Cafe torrado 500g       R$ 18,90'
].join('\n');

const CODE_V2001_RECEIPT_VALID = {
  name: `${MARK}_RECEIPT_VALID`,
  file: {
    name: 'code-v2001-recibo-valido.jpg',
    type: 'image/jpeg',
    size: 48210
  },
  text: RECEIPT_VALID_TEXT,
  /* resposta da leitura assistida: espelha o documento, sem invenção */
  readResponse: {
    texto: RECEIPT_VALID_TEXT,
    idioma: 'pt-BR',
    campos: {
      date: '2026-09-20',
      merchant: 'MERCADO EXEMPLO ALIMENTOS LTDA',
      description: 'Compra de alimentos no mercado',
      amount: '1234.56',
      category: 'Alimentação',
      paymentMethod: 'PIX',
      account: 'Itaú',
      documentNumber: '884213',
      type: 'saida'
    },
    candidatos: {}
  },
  catalog: {
    banks: [
      { label: 'Itaú', value: 'b_itau' },
      { label: 'Nubank', value: 'b_nubank' },
      { label: 'Banco do Brasil', value: 'b_bb' }
    ],
    categories: [
      { label: 'Alimentação', value: 'c_alimentacao' },
      { label: 'Transporte', value: 'c_transporte' },
      { label: 'Saúde', value: 'c_saude' }
    ]
  },
  expected: {
    date: '2026-09-20',
    amount: 1234.56,
    description: 'Compra de alimentos no mercado',
    merchant: 'MERCADO EXEMPLO ALIMENTOS LTDA',
    type: 'out',
    paymentMethod: 'PIX',
    documentNumber: '884213',
    accountValue: 'Itaú',
    accountId: 'b_itau',
    categoryLabel: 'Alimentação',
    categoryId: 'c_alimentacao',
    allConfirmed: true,
    minDetConfidence: 0.7,
    minOverallConfidence: 0.8
  },
  /* o que a revisão deve devolver quando o humano confirmar */
  expectedMovement: {
    date: '2026-09-20',
    desc: 'Compra de alimentos no mercado',
    bank: 'b_itau',
    category: 'c_alimentacao',
    amount: 1234.56,
    type: 'out'
  }
};

/* ------------------------------------------------------------ ambíguo */
/* Duas datas e três valores, nenhum rotulado como total → nada é inventado. */
const RECEIPT_AMBIGUOUS_TEXT = [
  'LOJA EXEMPLO COMERCIO LTDA',
  'DATA DE EMISSAO: 01/08/2026',
  'DATA DE VENCIMENTO: 15/08/2026',
  'VALOR R$ 100,00',
  'DESCONTO R$ 10,00',
  'LIMITE R$ 90,00'
].join('\n');

const CODE_V2001_RECEIPT_AMBIGUOUS = {
  name: `${MARK}_RECEIPT_AMBIGUOUS`,
  file: {
    name: 'code-v2001-recibo-ambiguo.jpg',
    type: 'image/jpeg',
    size: 31877
  },
  text: RECEIPT_AMBIGUOUS_TEXT,
  /* a leitura assistida também se recusa a escolher */
  readResponse: {
    texto: RECEIPT_AMBIGUOUS_TEXT,
    idioma: 'pt-BR',
    campos: {
      date: null,
      merchant: null,
      description: null,
      amount: null,
      category: null,
      paymentMethod: null,
      account: null,
      documentNumber: null,
      type: null
    },
    candidatos: {}
  },
  catalog: {
    banks: [
      { label: 'Itaú', value: 'b_itau' },
      { label: 'Nubank', value: 'b_nubank' }
    ],
    categories: [
      { label: 'Alimentação', value: 'c_alimentacao' },
      { label: 'Transporte', value: 'c_transporte' }
    ]
  },
  expected: {
    dateStatus: 'AMBIGUOUS',
    dateCandidates: ['2026-08-01', '2026-08-15'],
    amountStatus: 'AMBIGUOUS',
    amountCandidates: [100, 10, 90],
    merchant: 'LOJA EXEMPLO COMERCIO LTDA',
    description: 'LOJA EXEMPLO COMERCIO LTDA',
    typeStatus: 'MISSING',
    categoryStatus: 'MISSING',
    accountStatus: 'MISSING',
    /* revisão não pode ser confirmada sem data, valor, tipo, conta e categoria */
    blockedErrorCodes: [
      'date_required',
      'amount_required',
      'type_required',
      'account_required',
      'category_required'
    ]
  }
};

/* -------------------------------------------------------------- conflito */
/* A leitura assistida lê mal o valor; a extração determinística acha outro.
   Conflito → AMBIGUOUS (revisão), nunca um chute automático. */
const RECEIPT_CONFLICT_TEXT = [
  'FORNECEDOR EXEMPLO SA',
  'NF-E 12345',
  'VALOR R$ 250,00',
  'TOTAL R$ 250,00',
  'CREDITO NA CONTA'
].join('\n');

const CODE_V2001_CONFLICT = {
  name: `${MARK}_CONFLICT`,
  file: {
    name: 'code-v2001-conflito.jpg',
    type: 'image/jpeg',
    size: 22114
  },
  text: RECEIPT_CONFLICT_TEXT,
  readResponse: {
    texto: RECEIPT_CONFLICT_TEXT,
    idioma: 'pt-BR',
    campos: {
      date: null,
      merchant: 'FORNECEDOR EXEMPLO SA',
      description: null,
      amount: '2500',
      category: null,
      paymentMethod: null,
      account: null,
      documentNumber: null,
      type: null
    },
    candidatos: {}
  },
  catalog: {
    banks: [{ label: 'Nubank', value: 'b_nubank' }],
    categories: [{ label: 'Transporte', value: 'c_transporte' }]
  },
  expected: {
    amountStatus: 'AMBIGUOUS',
    amountCandidates: [2500, 250],
    dateStatus: 'MISSING',
    type: 'in',
    merchant: 'FORNECEDOR EXEMPLO SA'
  }
};

/* ------------------------------------------------------- arquivos inválidos */
const CODE_V2001_INVALID_FILES = {
  name: `${MARK}_INVALID_FILES`,
  /* executável: nem imagem nem documento */
  executable: {
    file: { name: 'poupina.exe', type: 'application/x-msdownload', size: 2048 },
    expected: { ok: false, code: 'UNSUPPORTED_FILE', reason: 'tipo_nao_suportado' }
  },
  /* imagem acima do limite do Worker (7 MB) */
  oversizeImage: {
    file: { name: 'grande.jpg', type: 'image/jpeg', size: 9 * 1024 * 1024 },
    expected: { ok: false, code: 'TOO_LARGE', reason: 'imagem_acima_de_7mb' }
  },
  /* arquivo vazio */
  empty: {
    file: { name: 'vazio.jpg', type: 'image/jpeg', size: 0 },
    expected: { ok: false, code: 'INVALID_FILE', reason: 'arquivo_vazio' }
  },
  /* declara JPEG mas os bytes são PDF (magic bytes ≠ MIME) */
  contentMismatch: {
    file: { name: 'nota.jpg', type: 'image/jpeg', size: 512 },
    headBytes: [0x25, 0x50, 0x44, 0x46],
    expected: { ok: false, code: 'UNSUPPORTED_FILE', reason: 'conteudo_incompativel' }
  },
  /* JPEG válido (magic bytes coerentes) */
  validImage: {
    file: { name: 'valido.jpg', type: 'image/jpeg', size: 512 },
    headBytes: [0xff, 0xd8, 0xff, 0xe0],
    expected: { ok: true, code: null, category: 'image' }
  }
};

module.exports = {
  MARK,
  RECEIPT_VALID_TEXT,
  RECEIPT_AMBIGUOUS_TEXT,
  RECEIPT_CONFLICT_TEXT,
  CODE_V2001_RECEIPT_VALID,
  CODE_V2001_RECEIPT_AMBIGUOUS,
  CODE_V2001_CONFLICT,
  CODE_V2001_INVALID_FILES
};

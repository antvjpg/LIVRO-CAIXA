/* Mesmo titular (De/Para) na leitura de comprovantes — fluxo chat da LIA.
   Execução: node --test worker/test/*.test.mjs

   Sem rede, sem navegador: apenas o módulo determinístico (ocr/extractor.js).
   Objetivo: provar que um comprovante de Pix ENTRE CONTAIS PRÓPRIAS é
   reconhecido como candidato a transferência, e que contas de pessoas
   distintas ou documentos sem os lados De/Para NÃO são confundidos.

   Dados 100% fictícios (AGENTS §25 — nada de dados reais aqui). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ex = require('../../ocr/extractor.js');

/* --------------------------------------------- mesmo titular (De/Para) */

const PIX_OWN_ACCOUNTS = `Comprovante de Pix

R$ 50,00

Realizado em 04/10/2026 às 09:51:56

De

MARIA FERNANDA COSTA

CPF: *** 111.222-

Instituição: ITAÚ UNIBANCO S.A

Para

Maria Fernan Costa

CPF: ***111222**

Instituição: PAGSEGURO INTERNET S.A.

Chave Pix: maria.f@example.com

Dados da transação

Autenticação: 6175EF4BDEE8C0DEFFD85F11980AD84F7A849C2C
ID da transação: E60701190202610041251DY5K5EZVOX8`;

test('mesmo CPF com máscaras distintas dos dois lados = mesmo titular', () => {
  const r = ex.detectSameHolder(PIX_OWN_ACCOUNTS);
  assert.equal(r.sameHolder, true, 'prefixo CPF igual nos dois lados');
  assert.equal(r.method, 'cpf');
  assert.ok(r.sender && r.receiver, 'os dois nomes ficam legíveis para o prefill');
});

test('CPFs distintos = pessoas distintas, mesmo com lados De/Para', () => {
  const text = 'De\nJOAO ALMEIDA PINTO\nCPF: *** 111.222-\nInstituição: ITAÚ UNIBANCO S.A\nPara\nANA BEATRIZ LOPES\nCPF: *** 333.444-\nInstituição: NUBANK\nDados da transação';
  const r = ex.detectSameHolder(text);
  assert.equal(r.sameHolder, false);
  assert.equal(r.method, 'cpf');
});

test('sem CPF utilizável: nomes parecidos caem no fallback de nome', () => {
  const text = 'De\nPaulo Andrade\nCPF: ***.***.***-**\nPara\nPaulo Andrade Neto\nCPF: ***.***.***-**\nChave Pix: x';
  const r = ex.detectSameHolder(text);
  assert.equal(r.sameHolder, true);
  assert.equal(r.method, 'name');
});

test('nomes de pessoas diferentes sem CPF não casam', () => {
  const text = 'De\nAna Paula Reis\nCPF: ***.***.***-**\nPara\nAna Clara Duarte\nCPF: ***.***.***-**\nChave Pix: y';
  const r = ex.detectSameHolder(text);
  assert.equal(r.sameHolder, false);
  assert.equal(r.method, 'name');
});

test('sem os DOIS lados (De/Para) nada é decidido', () => {
  assert.equal(ex.detectSameHolder('Comprovante de pagamento\nR$ 10,00\nAUTENTICACAO: ABC').sameHolder, false);
  assert.equal(ex.detectSameHolder('De\nMARIA COSTA\nCPF: *** 111.222-').sameHolder, false, 'De sem Para');
  assert.equal(ex.detectSameHolder('').sameHolder, false, 'texto vazio');
  assert.equal(ex.detectSameHolder(null).sameHolder, false, 'null');
});

test('marcador na mesma linha ("De: nome") também é lido', () => {
  const text = 'De: Carlos Eduardo Mota\nCPF: *** 555.666-\nPara: Carlos E Mota\nCPF: ***555666**\nDados da transação';
  const r = ex.detectSameHolder(text);
  assert.equal(r.sameHolder, true);
  assert.equal(r.method, 'cpf');
});

test('titular com abreviação de nome no meio (P por Pedro) é coberto', () => {
  const text = 'De\nJOAO P SILVA\nPara\nJoao Pedro Silva\nChave Pix: z';
  const r = ex.detectSameHolder(text);
  assert.equal(r.sameHolder, true);
  assert.equal(r.method, 'name');
});

/* --------------------------------- regressões dos falsos-positivos */

test('"Comprovante" não é mais classificado como saída', () => {
  const t = ex.detectType('Comprovante de Pix', { value: 50, negative: false });
  assert.equal(t.value, null, 'sem sinal de tipo o campo fica MISSING');
  assert.equal(t.status, ex.STATUS.MISSING);
});

test('compra de verdade continua sendo saída', () => {
  const t = ex.detectType('Pagamento aprovado - Compra no mercado', { value: null, negative: false });
  assert.equal(t.value, 'saida');
});

test('nome de instituição não contamina a conta (INTER ⊄ INTERNET)', () => {
  const text = 'Comprovante de Pix\nDe\nMARIA COSTA\nCPF: *** 111.222-\nInstituição: ITAÚ UNIBANCO S.A\nPara\nMaria Costa\nInstituição: PAGSEGURO INTERNET S.A.';
  const a = ex.detectAccount(text);
  assert.equal(a.value, 'ITAÚ', 'uma única instituição real resolve');
  assert.equal(a.status, ex.STATUS.CONFIRMED_BY_EXTRACTION);
  assert.equal(ex.detectAccount('PAGSEGURO INTERNET S.A.').status, ex.STATUS.MISSING,
    'sem instituição cadastrada não há conta');
});

/* --------------------------------------- ponta a ponta no extrator */

test('extrator completo: Pix entre contas próprias não vira "saída convencional"', () => {
  const r = ex.extractFromText(PIX_OWN_ACCOUNTS);
  assert.notEqual(r.fields.type.value, 'saida', '"Comprovante" não dispara mais TYPE_OUT');
  assert.equal(r.fields.account.value, 'ITAÚ');
  assert.equal(r.fields.amount.value, 50);
  const holder = ex.detectSameHolder(PIX_OWN_ACCOUNTS);
  assert.equal(holder.sameHolder, true, 'sinal de transferência entre contas próprias presente');
});

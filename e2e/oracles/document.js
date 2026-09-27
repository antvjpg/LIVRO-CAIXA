/* C.O.D.E. — oráculo INDEPENDENTE do documento V.20-01.
   Nenhuma função do LIVRO-CAIXA é importada (regra dos oracles §9).

   Estratégia deliberadamente diferente da implementação: leitura POR LINHA
   com operações de string simples, em vez de varredura por regex sobre o
   texto inteiro (ocr/extractor.js). Se os dois caminhos discordam, um deles
   está errado e o teste falha. */
'use strict';

const { parseBRL } = require('./money.js');

function linesOf(text) {
  return String(text == null ? '' : text).split('\n');
}

/* Valor da linha rotulada "TOTAL" (ou variação). */
function totalLineValue(text) {
  const lines = linesOf(text);
  const idx = lines.findIndex((l) => /^\s*(valor\s+)?total\b/i.test(l));
  if (idx === -1) return null;
  const found = /R\$\s*([\d.]+,\d{2})/.exec(lines[idx]);
  return found ? parseBRL(`R$ ${found[1]}`) : null;
}

/* Data da linha rotulada "DATA", em YYYY-MM-DD. */
function dateFromLabelledLine(text) {
  const lines = linesOf(text);
  const idx = lines.findIndex((l) => /\bdata\b/i.test(l));
  if (idx === -1) return null;
  const found = /(\d{2})\/(\d{2})\/(\d{4})/.exec(lines[idx]);
  if (!found) return null;
  return `${found[3]}-${found[2]}-${found[1]}`;
}

/* Todas as datas dd/mm/aaaa do documento, em ordem. */
function allDates(text) {
  const out = [];
  for (const line of linesOf(text)) {
    const found = /(\d{2})\/(\d{2})\/(\d{4})/.exec(line);
    if (found) out.push(`${found[3]}-${found[2]}-${found[1]}`);
  }
  return [...new Set(out)];
}

/* Todos os valores "R$ n,n" do documento, em ordem de aparição. */
function allBRLValues(text) {
  const out = [];
  const re = /R\$\s*([\d.]+,\d{2})/g;
  for (const line of linesOf(text)) {
    let m;
    while ((m = re.exec(line)) !== null) out.push(parseBRL(`R$ ${m[1]}`));
    re.lastIndex = 0;
  }
  return out.filter((v, i) => out.indexOf(v) === i);
}

/* Estabelecimento: primeira linha com sufixo societário. */
function merchantLine(text) {
  for (const line of linesOf(text)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/\b(LTDA|S\.?A\.?|EIRELI|LTDA\.?\s*ME)\s*$/i.test(trimmed)) return trimmed;
  }
  return null;
}

module.exports = { linesOf, totalLineValue, dateFromLabelledLine, allDates, allBRLValues, merchantLine };

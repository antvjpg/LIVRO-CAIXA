'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateDisputa } = require(path.join(__dirname, 'validacao-bilateral.cjs'));

const CASOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'casos.json'), 'utf8'));
const outArg = process.argv.find((a) => a.startsWith('--out='));
const OUT = outArg ? path.resolve(outArg.slice('--out='.length)) : path.join(__dirname, 'resultados/teste-bilateral-a02b.json');

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function candidato(expected, overrides, order) {
  return {
    source: expected.source || 'stylesheet',
    selectorText: expected.selectorText || null,
    declaredValue: expected.declaredValue || null,
    important: Boolean(expected.important),
    origin: expected.origin || null,
    cdpOrigin: expected.cdpOrigin || null,
    provenance: expected.provenance || null,
    styleSheetId: expected.styleSheetId || null,
    order,
    ...(overrides || {}),
  };
}

function base(id) {
  const caso = CASOS.casos.find((c) => c.id === id);
  if (!caso || !caso.disputa) throw new Error(`disputa ausente: ${id}`);
  return caso;
}

function par(id, overridesA, overridesB) {
  const caso = base(id);
  const [a, b] = caso.disputa.concorrentes;
  return [
    candidato(a, overridesA || {}, 1),
    candidato(b, overridesB || {}, 2),
  ];
}

function executar(nome, id, candidatos, esperado) {
  const caso = base(id);
  const resultado = validateDisputa(caso.disputa, candidatos);
  const status = resultado.status === esperado ? 'PASS' : 'FAIL';
  return {
    nome,
    caso: id,
    esperado,
    observado: resultado.status,
    status,
    divergencias: resultado.divergencias,
    concorrentes: resultado.concorrentes,
    candidatos: resultado.candidatos,
  };
}

function main() {
  const testes = [];
  testes.push(executar('P1 — O3 com os dois concorrentes corretos', 'R265-O3', par('R265-O3'), 'PASS'));
  testes.push(executar('N1 — O3 sem concorrente author', 'R265-O3', par('R265-O3').filter((_, i) => i === 1), 'FAIL'));
  testes.push(executar('N2 — O3 sem concorrente user-agent', 'R265-O3', par('R265-O3').filter((_, i) => i === 0), 'FAIL'));

  const o4ComExtra = [
    ...par('R265-O4'),
    { source: 'stylesheet', selectorText: 'input, textarea, select, button', declaredValue: 'inline-block', important: false, origin: 'user-agent', cdpOrigin: 'user-agent', provenance: null, styleSheetId: null, order: 3 },
  ];
  testes.push(executar('P2 — O4 com os dois concorrentes important', 'R265-O4', o4ComExtra, 'PASS'));
  testes.push(executar('N3 — O4 sem concorrente author', 'R265-O4', par('R265-O4').filter((_, i) => i === 0), 'FAIL'));
  testes.push(executar('N4 — O4 sem concorrente user-agent', 'R265-O4', par('R265-O4').filter((_, i) => i === 1), 'FAIL'));
  testes.push(executar('N5 — O4 com author sem !important', 'R265-O4', par('R265-O4', null, { important: false }), 'FAIL'));

  testes.push(executar('P3 — U1 com user important e author important', 'R265-U1', par('R265-U1'), 'PASS'));
  testes.push(executar('N6 — U1 sem concorrente user', 'R265-U1', par('R265-U1').filter((_, i) => i === 1), 'FAIL'));
  testes.push(executar('N7 — U1 sem concorrente author', 'R265-U1', par('R265-U1').filter((_, i) => i === 0), 'FAIL'));
  testes.push(executar('N8 — U1 com origem user incorreta', 'R265-U1', par('R265-U1', { origin: 'author', provenance: null }), 'FAIL'));
  testes.push(executar('N9 — U1 com author sem !important', 'R265-U1', par('R265-U1', null, { important: false }), 'FAIL'));
  testes.push(executar('N10 — O3 com valor author incorreto', 'R265-O3', par('R265-O3', { declaredValue: '15px' }), 'FAIL'));
  const o3Duplicado = par('R265-O3');
  o3Duplicado.push(candidato(base('R265-O3').disputa.concorrentes[0], {}, 3));
  testes.push(executar('N11 — O3 com evidencia author duplicada', 'R265-O3', o3Duplicado, 'FAIL'));
  const o3Contraditorio = par('R265-O3');
  o3Contraditorio.push(candidato(base('R265-O3').disputa.concorrentes[0], { declaredValue: '99px' }, 3));
  testes.push(executar('N12 — O3 com evidencia contraditoria', 'R265-O3', o3Contraditorio, 'FAIL'));

  testes.push(executar('N13 — O3 com campo important ausente no author', 'R265-O3', par('R265-O3', { important: undefined }), 'FAIL'));
  const o3CdpErrado = par('R265-O3');
  o3CdpErrado.push(candidato(base('R265-O3').disputa.concorrentes[0], { cdpOrigin: 'author' }, 3));
  testes.push(executar('N14 — O3 com cdpOrigin contraditorio', 'R265-O3', o3CdpErrado, 'FAIL'));
  const u1ProvenienciaErrada = par('R265-U1');
  u1ProvenienciaErrada.push(candidato(base('R265-U1').disputa.concorrentes[0], { provenance: null }, 3));
  testes.push(executar('N15 — U1 com proveniencia contraditoria', 'R265-U1', u1ProvenienciaErrada, 'FAIL'));
  const u1FolhaErrada = par('R265-U1');
  u1FolhaErrada.push(candidato(base('R265-U1').disputa.concorrentes[0], { styleSheetId: 'sheet-errada' }, 3));
  testes.push(executar('N16 — U1 com styleSheetId contraditorio', 'R265-U1', u1FolhaErrada, 'FAIL'));
  const u1FonteErrada = par('R265-U1');
  u1FonteErrada.push(candidato(base('R265-U1').disputa.concorrentes[0], { source: 'inline' }, 3));
  testes.push(executar('N17 — U1 com source contraditorio', 'R265-U1', u1FonteErrada, 'FAIL'));

  const result = {
    id: 'A-02B-TESTE-BILATERAL',
    data: new Date().toISOString(),
    helper: 'tmp-c13/r2-6-6-a02b/validacao-bilateral.cjs',
    criterios: ['presenca dos dois concorrentes', 'origem', 'valor declarado', 'importante booleano explicito', 'cdpOrigin', 'proveniencia', 'source', 'styleSheetId', 'rejeicao de duplicatas e contradicoes'],
    testes,
    resumo: {
      total: testes.length,
      PASS: testes.filter((t) => t.status === 'PASS').length,
      FAIL: testes.filter((t) => t.status === 'FAIL').length,
      positivosPASS: testes.filter((t) => t.nome.startsWith('P') && t.status === 'PASS').length,
      negativosPASS: testes.filter((t) => t.nome.startsWith('N') && t.status === 'PASS').length,
    },
  };
  const hash = sha(JSON.stringify(result, null, 2));
  result.verification = { hashMatches: true, declared: hash, recalculated: hash };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
  const check = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const recalculado = JSON.parse(JSON.stringify(check));
  delete recalculado.verification;
  const h2 = sha(JSON.stringify(recalculado, null, 2));
  check.verification.hashMatches = h2 === hash;
  check.verification.recalculated = h2;
  fs.writeFileSync(OUT, `${JSON.stringify(check, null, 2)}\n`);
  console.log('Teste A-02 bilateral:', JSON.stringify(result.resumo), 'hash:', h2);
  if (result.resumo.FAIL > 0) process.exitCode = 1;
}

main();

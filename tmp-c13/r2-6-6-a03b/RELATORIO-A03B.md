# A-03B — Evidência de índices e conservadorismo com metadados parciais

## 1. Baseline e escopo

- Baseline: `457ab3b190d3049a2f5b335e665540ad525eb1d6` (`fix(c4): corrige especificidade maxima da A-03`).
- Correção: A-03B.
- Escopo estritamente limitado às duas ressalvas da auditoria independente:
  1. o artefato Chromium não registrava/exigia os índices efetivamente correspondentes;
  2. o helper ainda podia declarar máximo quando algum seletor correspondente não tinha especificidade confiável.
- A-01/A-01B e A-02/A-02B foram preservadas. A-03 original também foi preservada.

## 2. Arquivos criados

- `tmp-c13/r2-6-6-a03b/especificidade-maxima.cjs` — helper A-03B com `avaliarEspecificidade()` e `selectMaxSpecificity()`.
- `tmp-c13/r2-6-6-a03b/teste-especificidade-a03b.cjs` — 12 testes unitários (A1–A12).
- `tmp-c13/r2-6-6-a03b/casos.json` — casos derivados da A-03, com `indicesMinimos: 2` no caso agrupado.
- `tmp-c13/r2-6-6-a03b/fixture.html` — fixture derivada da A-03, com o mesmo cenário controlado.
- `tmp-c13/r2-6-6-a03b/validacao-a03b.cjs` — validador de navegador A-03B.
- `tmp-c13/r2-6-6-a03b/resultados/` — evidências locais versionadas.
- `tmp-c13/r2-6-6-a03b/parecer-independente.md` — auditoria independente da linhagem A-03B.
- `e2e/.artifacts/r2-6-a03b-especificidade.json` e `e2e/.artifacts/r2-6-a03b-matriz.json` — artefatos do runner.

### Modificado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta etapa A-03B após A-03, preservando todas as etapas anteriores.

## 3. Comportamento anterior e corrigido

### Anterior

`regrasCandidatas()` registrava apenas a especificidade final. O cenário `R266-S9` passava sem provar que dois seletores haviam sido reconhecidos como correspondentes. Além disso, o helper ignorava seletores correspondentes sem especificidade e ainda podia retornar o máximo entre os demais.

### Corrigido

O helper agora expõe `avaliarEspecificidade()`, que retorna:

- `status: 'maximo'` somente quando **todos** os índices válidos e correspondentes possuem especificidade confiável;
- `status: 'insuficiente'` quando qualquer seletor correspondente não tem especificidade;
- `status: 'ausente'` quando não há correspondência válida;
- `indicesValidos`, `indicesInvalidos`, `indicesSemEspecificidade` e `especificidade`.

`selectMaxSpecificity()` mantém a API de retorno `objeto | null`, mas agora retorna `null` também para evidência parcial.

`regrasCandidatas()` registra `statusEspecificidade`, `indicesCorrespondentes` e `indicesSemEspecificidade`.

O caso `R266-S9` exige `indicesMinimos: 2`, `status=maximo` e `indicesSemEspecificidade=[]`.

## 4. Trecho central corrigido

```js
if (indicesValidos.length === 0) return { ...vazio, indicesInvalidos };
if (indicesSemEspecificidade.length > 0 || candidaturas.length === 0) {
  return {
    status: 'insuficiente',
    a: null,
    b: null,
    c: null,
    index: null,
    indices: indicesValidos,
    indicesValidos,
    indicesInvalidos,
    indicesSemEspecificidade,
    especificidade: null,
  };
}
```

## 5. Testes unitários A1–A12

| Teste | Objetivo | Resultado |
|---|---|---|
| A1 | Primeiro seletor menos específico, com evidência de dois índices | PASS |
| A2 | Ordem invertida, mesmo resultado | PASS |
| A3 | Três seletores, máximo intermediário | PASS |
| A4 | Empate determinístico | PASS |
| A5 | Índice inválido, sem fallback | PASS |
| A6 | Correspondência ausente | PASS |
| A7 | Formato `{ index: n }` | PASS |
| A8 | Especificidade ausente em todos | PASS |
| A9 | Seletor único | PASS |
| A10 | Pseudo-elemento preservado | PASS |
| A11 | Especificidade ausente em apenas um dos correspondentes | PASS — retorna `null`, `status=insuficiente`, `indicesSemEspecificidade=[1]` |
| A12 | Evidência explícita dos índices com ordem invertida | PASS — `indicesValidos=[1,0]` |

Resumo: `12 PASS / 0 FAIL`.

## 6. Evidência de navegador

Cenário `R266-S9`:

- regra agrupada `.r266-grupo, #r266-spec-grupo.r266-grupo`;
- índices correspondentes registrados: `[0, 1]`;
- `statusEspecificidade: maximo`;
- `indicesSemEspecificidade: []`;
- especificidade diagnóstica: `{a: 1, b: 1, c: 0}`;
- valor computado: `rgb(70, 80, 90)`;
- vencedor: a regra agrupada com a mesma especificidade.

Resultado: `12 PASS / 0 FAIL / 0 BLOCKED`, `indicesCorrespondentesPASS=1`.

## 7. Regressão e CI

Runner C.4 local:

- Matriz original: `10/10`.
- R2.6.5: `10 PASS / 0 FAIL / 3 BLOCKED`.
- R2.6.6: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-03: `12 PASS / 0 FAIL / 0 BLOCKED`.
- A-03B: `12 PASS / 0 FAIL / 0 BLOCKED`.
- Regressão: `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências`.
- `verdict: PASS`, `problems: []`.

CI anterior da A-03, preservado como referência: C.4 run `45048697513` e C.O.D.E. run `45048697614`, ambos `success`.

CI da A-03B executado no SHA `e39d0dec548050b2c2540eca0ba6ed1ae3840a56`:

| Workflow | Run | Tentativa 1 | Tentativa 2 | Conclusão final |
|---|---|---|---|---|
| C.4 — R2.6 | `45051454962` | `failure` — `AssertionError [ERR_ASSERTION]: assert(!this.paused)` em `Parser.finish` (undici), exit 1 | `success` | `success` |
| C.O.D.E. E2E | `45051455003` | `failure` — 71 passed, 1 flaky em `metas.spec.js:417`, reprovado por `--strict` | `success` — 72 passed, 0 flaky | `success` |

O artifact `14765854320` registra `sha=e39d0…`, `verdict=PASS`, `problems=[]`, A-03B `12 PASS / 0 FAIL / 0 BLOCKED`, `indicesCorrespondentesPASS=1` e regressão `392 PASS / 0 FAIL / 1 BLOCKED (V32)`.

As falhas da tentativa 1 permanecem registradas como instabilidade histórica; não foram convertidas artificialmente em sucesso contínuo.

## 8. SHA-256

- helper: `583e018371d52a06356f53791d70f35393e00359cfb93bcb059fed0a19593da3`
- teste unitário: `1f3b3f6e09bf2a21b2e1706ba828305339c2dd8969686e4e4f871c64b3c3510d`
- casos: `aa1567319dee6d8cd1f2ef405aac4ac88be91f0f83afa5c0d7ce304893e8d389`
- fixture: `b7a07bde7500fb10e06988aa35008901e1093df91e2d02cea2455a03afbfb28b`
- validador: `375e5185bf3e689702995b0a00fa1c3919050ec30b7624e4559e07e08a584b9b`
- artefato de especificidade: `5ce297cb956ac10009fde4086fedc0b096ed704f4183a247496470f635cf1dc0`
- matriz A-03B: `dc2cd5faa9e9773a42c08d48b03cc943b355b298480543c69296654231a2e396`
- resumo do runner: `825af41dd29bc558eb911e06b983d2d21e7045084daad2d7d495677e3865e2e8`

## 9. Limitações

- CI da A-03B já executado; IDs, tentativas e conclusões registrados na Seção 7.
- O padrão `matchingSelectors[0]` permanece em R2.6.6, A-01, A-01B, A-02 e A-02B; A-03/A-03B usam `selectMaxSpecificity`, preservando o histórico.
- `V32` permanece `BLOCKED`.
- Auditoria independente registrada em `tmp-c13/r2-6-6-a03b/parecer-independente.md`, com veredito APROVADA COM RESSALVAS.
- R2.6.6 não é promovida automaticamente; a auditoria independente do núcleo e da extensão permanece pendente para fins de promoção.

## 10. Declaração de preservação

A-01/A-01B, A-02/A-02B e A-03 foram integralmente preservadas. O runner apenas acrescentou a etapa A-03B; nenhum núcleo, validador, helper, caso, teste ou artefato anterior foi modificado.

## 11. Parecer final

**A-03B: APROVADA COM RESSALVAS.**

Auditoria independente registrada em `tmp-c13/r2-6-6-a03b/parecer-independente.md`. As duas ressalvas foram endereçadas: os índices correspondentes agora são evidência obrigatória no cenário Chromium, e metadado parcialmente indisponível produz `null`/`insuficiente`, não máximo definitivo. Todos os testes locais, o CI na tentativa 2 e a regressão passaram.

Ressalvas remanescentes: o gate não fixa `selectorText` do vencedor, o summary local não registra SHA e os artefatos locais são ignorados pelo Git, índices mistos ainda produzem `maximo` entre os válidos conforme contrato declarado, e a tentativa 1 dos workflows apresentou instabilidade documentada. Nenhuma ressalva impede o fechamento da A-03B nem autoriza a promoção de R2.6.6.

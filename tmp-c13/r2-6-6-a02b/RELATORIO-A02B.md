# A-02B — Correção das ressalvas da auditoria independente de A-02

## 1. Ressalvas tratadas

A auditoria independente de A-02 identificou duas lacunas no helper `validacao-bilateral.cjs`:

1. `important: Boolean(candidate && candidate.important)` convertia campo ausente em `false`, permitindo aceitar uma regra normal sem evidência explícita.
2. `isContradiction()` comparava apenas origem e valor, deixando passar uma evidência adicional com `cdpOrigin`, `provenance`, `source` ou `styleSheetId` divergentes.

Ambas foram corrigidas em artefatos versionados A-02B, sem reabrir A-01/A-01B e sem incluir A-03.

## 2. Arquivos criados e modificados

### Criados

- `tmp-c13/r2-6-6-a02b/validacao-bilateral.cjs` — helper A-02B.
- `tmp-c13/r2-6-6-a02b/casos.json` — casos A-02 com `styleSheetId: null` explícito no concorrente USER de U1.
- `tmp-c13/r2-6-6-a02b/teste-bilateral-a02b.cjs` — 20 testes, incluindo 5 novos negativos.
- `tmp-c13/r2-6-6-a02b/validacao-a02b.cjs` — validador de navegador A-02B.
- `tmp-c13/r2-6-6-a02b/resultados/` — evidências locais versionadas.
- `e2e/.artifacts/r2-6-a02b-matriz.json` e `e2e/.artifacts/r2-6-a02b-bilateral.json` — artefatos do runner.

### Modificado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta a etapa A-02B após A-02, preservando todas as etapas anteriores.

### Preservados

- A-01 e A-01B, incluindo associação exclusiva de proveniência USER.
- A-02 original e seus artefatos.
- R2.6.5, R2.6.6, matriz original e regressão histórica.
- Extensão, fixture, CSS de produção e V32.

## 3. Trecho anterior e trecho corrigido

### `important` explícito

Anterior:

```js
important: Boolean(candidate && candidate.important)
```

Corrigido:

```js
important: candidate && typeof candidate.important === 'boolean' ? candidate.important : null
```

Com isso, campo ausente não é aceito como `false`.

### Contradição com metadados completos

Anterior:

```js
return candidate.origin !== expected.origin || !sameValue(candidate.declaredValue, expected.declaredValue);
```

Corrigido:

```js
function metadataMismatch(candidate, expected) {
  if (has(expected, 'origin') && candidate.origin !== expected.origin) return true;
  if (has(expected, 'declaredValue') && !sameValue(candidate.declaredValue, expected.declaredValue)) return true;
  if (has(expected, 'important') && candidate.important !== expected.important) return true;
  if (has(expected, 'selectorText') && candidate.selectorText !== expected.selectorText) return true;
  if (has(expected, 'cdpOrigin') && candidate.cdpOrigin !== expected.cdpOrigin) return true;
  if (has(expected, 'provenance') && candidate.provenance !== expected.provenance) return true;
  if (has(expected, 'source') && candidate.source !== expected.source) return true;
  if (has(expected, 'styleSheetId') && candidate.styleSheetId !== expected.styleSheetId) return true;
  return false;
}
```

`isContradiction()` agora usa `metadataMismatch()` para qualquer candidato adicional que compartilhe seletor e estado de `!important` com um concorrente esperado.

## 4. Testes executados e resultados

| Teste | Resultado |
|---|---|
| P1 — O3 com os dois concorrentes corretos | PASS |
| N1 — O3 sem concorrente author | PASS (rejeitado) |
| N2 — O3 sem concorrente user-agent | PASS (rejeitado) |
| P2 — O4 com os dois concorrentes important | PASS |
| N3 — O4 sem concorrente author | PASS (rejeitado) |
| N4 — O4 sem concorrente user-agent | PASS (rejeitado) |
| N5 — O4 com author sem `!important` | PASS (rejeitado) |
| P3 — U1 com user important e author important | PASS |
| N6 — U1 sem concorrente user | PASS (rejeitado) |
| N7 — U1 sem concorrente author | PASS (rejeitado) |
| N8 — U1 com origem user incorreta | PASS (rejeitado) |
| N9 — U1 com author sem `!important` | PASS (rejeitado) |
| N10 — O3 com valor author incorreto | PASS (rejeitado) |
| N11 — O3 com evidência author duplicada | PASS (rejeitado) |
| N12 — O3 com evidência contraditória | PASS (rejeitado) |
| N13 — O3 com campo `important` ausente no author | PASS (rejeitado) |
| N14 — O3 com `cdpOrigin` contraditório | PASS (rejeitado) |
| N15 — U1 com `provenance` contraditória | PASS (rejeitado) |
| N16 — U1 com `styleSheetId` contraditório | PASS (rejeitado) |
| N17 — U1 com `source` contraditório | PASS (rejeitado) |

Resumo sintético: `20 PASS / 0 FAIL` — `3 positivos PASS` e `17 negativos PASS`.

Validação de navegador: `11 PASS / 0 FAIL / 0 BLOCKED`, `bilateralPASS=3`, `bilateralFAIL=0`, `disputasEsperadas=3`, `provenienciaPASS=1`, `provenienciaAmbigua=0`.

Regressão local:

- Matriz original: `10/10`.
- R2.6.5: `10 PASS / 0 FAIL / 3 BLOCKED`.
- R2.6.6: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- Regressão histórica: `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências`.
- Runner local: `verdict=PASS`, `problems=[]`.

Hashes:

- helper A-02B: `1672b1e2a08329226ff4630f703821c5d161dc93d48992d7899af8b593c8cc41`
- casos A-02B: `8a334562da143446efee911fc5eca80b451e18974849b699cfed7fb22e0a333c`
- teste bilateral A-02B: `294d57fb83b870212555b095f347a72358cd6d95f00502e3669031c928680a9b`
- validador A-02B: `f9eeda32c980690e2f602da725ac35f593ad4e9739bf6be1098744a94670e195`
- matriz A-02B: `492e468fbfa7e816811421721ead99a3194f7258288329eb92a8661f25df95b1`
- teste bilateral final A-02B: `8938668488ae596fd6b3665b385a42979f2aee55ac2afa61ba5eaef8944498a2`
- resumo do runner: `e67fa395e6a59a35ee3df70918e3a1ef8b22b89009fc61125ac042d866281c4a`

## 5. Evidência das duas correções

- N13 demonstrou que `important` ausente agora gera `concorrente ausente`, não aprovação.
- N14 demonstrou que `cdpOrigin` divergente é rejeitado como contradição.
- N15 demonstrou que `provenance` divergente é rejeitada.
- N16 demonstrou que `styleSheetId` divergente é rejeitado.
- N17 demonstrou que `source` divergente é rejeitado.
- O3, O4 e U1 seguem com exatamente dois concorrentes aprovados em `disputa.concorrentes`.

## 6. Limitações

- CI do GitHub para A-02B não foi executado: não houve autorização de commit/push nesta etapa.
- Os workflows anteriores de A-02 foram aprovados: C.4 run `45042782882` e C.O.D.E. run `45042782829`, ambos `success`.
- `V32` permanece `BLOCKED` e não foi alterado.
- Ainda não há auditoria independente de A-02B.
- A-03 permanece fora de escopo; R2.6.6 não é promovida automaticamente.

## 7. Parecer final

**A-02B: PRONTA PARA AUDITORIA INDEPENDENTE, COM RESSALVA DE CI PENDENTE.**

As duas lacunas apontadas foram corrigidas e provadas por testes negativos específicos. A-01, A-01B e A-02 foram preservados. A aprovação final depende da auditoria independente e da execução dos workflows após autorização de commit/push.

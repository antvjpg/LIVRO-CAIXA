# A-03 — Correção da especificidade máxima em regras CSS agrupadas

## 1. Baseline e commit de implementação

- Baseline: `da446d4ce05f431c6f7cd815b3c60491f22a6f79` (`fix(c4): endereca ressalvas da auditoria A-02`).
- Componente: C.4 — auditoria do CSS Cascade.
- Correção: A-03.
- Commit de implementação: pendente de publicação nesta entrega.

## 2. Arquivos examinados e modificados

### Examinados

- `tmp-c13/r2-6-6/validacao-r2-6-6.cjs` — ponto exato em `regrasCandidatas()` (linhas 168–170).
- `docs/auditorias/c4-v05-b/evidencias-r2-6-6/c4-v05-b-r2-6-6-core.cjs` — `ruleSpecificity()` (linhas 621–648), que já percorre múltiplos seletores.
- Testes de especificidade R266-S1…S8.
- `.github/workflows/c4-r26.yml`.
- Estruturas de evidências A-01, A-01B, A-02 e A-02B.

### Criados

- `tmp-c13/r2-6-6-a03/especificidade-maxima.cjs` — helper puro de seleção da maior especificidade.
- `tmp-c13/r2-6-6-a03/teste-especificidade-a03.cjs` — testes A1–A10.
- `tmp-c13/r2-6-6-a03/fixture.html` — fixture derivada da R2.6.6 com cenário controlado de seletores agrupados.
- `tmp-c13/r2-6-6-a03/casos.json` — casos derivados da A-02B com `R266-S9`.
- `tmp-c13/r2-6-6-a03/validacao-a03.cjs` — validador de navegador A-03.
- `tmp-c13/r2-6-6-a03/resultados/` — evidências locais versionadas.
- `e2e/.artifacts/r2-6-a03-especificidade.json` e `e2e/.artifacts/r2-6-a03-matriz.json` — artefatos do runner.

### Modificado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta etapa A-03 após A-02B, preservando todas as etapas anteriores.

### Preservados

- `tmp-c13/r2-6-6/validacao-r2-6-6.cjs` e todos os validadores A-01/A-01B/A-02/A-02B.
- Núcleos R2.6, R2.6.6, A-01B e algoritmo `getWinningRule()`.
- Extensão, fixture original, CSS de produção e V32.
- Resultados históricos e três BLOCKED preservados de R2.6.5.

## 3. Descrição do defeito

O diagnóstico em `regrasCandidatas()` usava:

```js
const selectors = (rule.selectorList && rule.selectorList.selectors) || [];
const index = (match.matchingSelectors && match.matchingSelectors[0]) || 0;
const spec = selectors[index] && selectors[index].specificity;
```

Quando uma regra agrupada tinha mais de um seletor correspondente, o relatório herdava a especificidade do primeiro índice, mesmo quando outro seletor correspondente era mais específico. Isso não alterava necessariamente o vencedor — o núcleo já calculava a maior especificidade —, mas produzia diagnóstico incorreto.

## 4. Solução aplicada

Helper puro novo:

```js
function selectMaxSpecificity(selectors, matchingSelectors) {
  if (!Array.isArray(matchingSelectors) || matchingSelectors.length === 0) return null;
  if (!Array.isArray(selectors)) return null;
  let best = null;
  let bestIndex = null;
  const validIndices = [];
  for (const entry of matchingSelectors) {
    const index = normalizeIndex(entry);
    if (index === null || index >= selectors.length) continue;
    validIndices.push(index);
    const spec = specificityFromObject(selectors[index] && selectors[index].specificity);
    if (!spec) continue;
    if (!best || compareSpecificity(spec, best) > 0) {
      best = spec;
      bestIndex = index;
    }
  }
  if (!best) return null;
  return { a: best.a, b: best.b, c: best.c, index: bestIndex, indices: validIndices };
}
```

Substituição em `regrasCandidatas()` do validador A-03:

```js
const selectors = (rule.selectorList && rule.selectorList.selectors) || [];
const maxima = selectMaxSpecificity(selectors, match.matchingSelectors || []);
...
especificidade: maxima ? { a: maxima.a, b: maxima.b, c: maxima.c } : null,
```

Não houve fallback para índice zero. Índices inválidos são ignorados. Sem especificidade confiável, o helper retorna `null`.

## 5. Estratégia de comparação lexicográfica

`compareSpecificity()` compara:

1. `a`; se diferente, decide.
2. Em empate, `b`; se diferente, decide.
3. Em empate, `c`; se diferente, decide.
4. Em empate completo, mantém a primeira ocorrência válida — decisão determinística, sem soma de componentes e sem criar diferença artificial.

## 6. Testes unitários A1–A10

| Teste | Objetivo | Resultado |
|---|---|---|
| A1 | Primeiro seletor menos específico; esperado o segundo | PASS |
| A2 | Inversão da ordem dos índices; mesmo resultado | PASS |
| A3 | Três seletores; máximo na posição intermediária | PASS |
| A4 | Empate; decisão determinística sem diferença artificial | PASS |
| A5 | Índice inválido; sem exceção e sem fallback para o seletor zero | PASS |
| A6 | `matchingSelectors` ausente/vazio; `null` | PASS |
| A7 | Índices no formato `{ index: n }` | PASS |
| A8 | Especificidade indisponível; `null` | PASS |
| A9 | Regra simples com um seletor | PASS |
| A10 | Pseudo-elemento preservado | PASS |

Resumo: `10 PASS / 0 FAIL`.

## 7. Validação de navegador

Cenário controlado `R266-S9`:

```css
.r266-grupo,
#r266-spec-grupo.r266-grupo { color: rgb(70, 80, 90); }
#r266-spec-grupo { color: rgb(100, 110, 120); }
```

Elemento: `<div id="r266-spec-grupo" class="r266-grupo">`.

Evidência:

- Ambos os seletores da regra agrupada correspondem ao elemento.
- O diagnóstico reportou `a=1, b=1, c=0`, e não a especificidade do primeiro seletor (`a=0, b=1, c=0`).
- Valor computado: `rgb(70, 80, 90)`.
- Vencedor: a regra agrupada, com a mesma especificidade máxima reportada no diagnóstico.
- A URL do cenário agrupado é por caso; os casos O3/O4/U1 continuam na fixture original, preservando a injeção USER.

Resultado do navegador: `12 PASS / 0 FAIL / 0 BLOCKED`, `especificidadeDiagnosticaPASS=1`.

## 8. Regressão e CI

Resultado local do runner C.4 completo:

- Matriz original: `10/10`.
- R2.6.5: `10 PASS / 0 FAIL / 3 BLOCKED`.
- R2.6.6: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-01B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-02B: `11 PASS / 0 FAIL / 0 BLOCKED`.
- A-03: `12 PASS / 0 FAIL / 0 BLOCKED`.
- Regressão: `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, `0 divergências`.
- `verdict: PASS`, `problems: []`.

Workflows GitHub Actions: a execução posterior ao commit/push ainda está pendente neste documento; os identificadores serão registrados após a publicação.

## 9. SHA-256 dos artefatos

- helper: `bcc273ff99416ac1cc71f0e3add7a617b6bfb007cffbb3a8bce751817c91e133`
- teste unitário: `590c2047d28c1426a57bf30ff9ecf32df90b140225367898873e098b64f5dc6e`
- casos: `72e9db9cfbd4b2c40095e32c18ab962b46d1efb121828992d2edc6d70c0283f5`
- fixture A-03: `b7a07bde7500fb10e06988aa35008901e1093df91e2d02cea2455a03afbfb28b`
- validador: `dbddada4013507820597b4fe323b8e85ba79fde3d5decee74b024224bf5cdea1`
- artefato de especificidade: `9239b91aa3297a1a010b0f1dc38dbc11b547bc24e96fa315a3ce5bff6386a475`
- matriz A-03: `8173731b09b2e6bc22c58d365a94a80d7380b02cc6ed0e7928a2cb903acd9b6d`
- resumo do runner: `09623449818c01f369cb5e8d4fac29907851694d0c738d5b0c5a8dea1213d3e3`

## 10. Limitações remanescentes

- O helper usa a especificidade fornecida pelo CDP; quando ausente, retorna `null` e não aplica parser textual próprio. O núcleo mantém seu parser legado separadamente.
- Empate completo é resolvido pela primeira ocorrência válida; a especificidade em si permanece idêntica.
- A-03 não altera a precedência global entre regras diferentes.
- `V32` permanece `BLOCKED`.
- Ainda não há parecer independente de A-03.
- R2.6.6 não é promovida automaticamente.

## 11. Declaração de preservação

A-01/A-01B e A-02/A-02B foram integralmente preservadas: nenhum núcleo, validador, helper, caso, teste ou artefato dessas correções foi modificado. O runner apenas acrescentou a etapa A-03.

## 12. Parecer final

**A-03: PRONTA PARA AUDITORIA INDEPENDENTE, COM CI GITHUB PENDENTE DE PUBLICAÇÃO.**

A solução é determinística e independe da posição do seletor correspondente; a inversão da ordem dos índices foi explicitamente testada. Os testes positivos, negativos, o cenário de navegador e a regressão local passaram. A aprovação final depende da auditoria independente e da execução dos workflows após commit/push.

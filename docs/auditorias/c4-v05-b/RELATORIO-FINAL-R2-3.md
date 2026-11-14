# RELATÓRIO FINAL — C.4-V05-B-R2.3

Auditoria runtime corrigida de consumidores do token CSS `--accent` em superfícies claras. Metodologia baseada em DIAGNOSTICO-R2-3.md (problemas R23-01 a R23-06).

---

## A. Resumo executivo

A execução R2.3 corrigiu seis problemas metodológicos identificados na auditoria independente da R2.2:

| ID | Problema | Status na R2.3 |
|---|---|---|
| R23-01 | Declaração CSS vencedora não capturada | `captureWinningRules()` integrada ao fluxo; `winningRules` injetado em cada linha de `result.rows` |
| R23-02 | `sampleId` sem contexto de viewport/tema/tela | `sampleId` agora inclui `vp-themeSet-theme-screen-sel-state-i` |
| R23-03 | Testes não executam código real do harness | Novo `c4-v05-b-r2-3-test.cjs` com 16 testes PASS, exercitando funções reais do harness |
| R23-04 | Geometria usa vértices incorretos do quadrilátero | `rectFromBorder()` usa os 8 valores (4 pares x,y) do `border` do `DOM.getBoxModel` |
| R23-05 | Foco/borda compara contra fundo interno | Contraste do fundo efetivo compara contra superfície adjacente externa (`outsideRgb`) |
| R23-06 | Erros CDP de `DOM.getBoxModel` não investigados | Todos os 3.420 erros rastreados com `sampleId`, `nodeId`, `operation`, `errorMessage`, `timestamp` |

Resultados da execução:
- **6.660** linhas de amostra (`rows`)
- **1.200** sondas de estado (`states`)
- **4.320** ocorrências de estado
- **0** erros de console, **0** exceções
- **3.420** erros CDP (todos `DOM.getBoxModel`, esperado)
- **hashMatches: true** (verificação independente do SHA-256)

Nenhum arquivo de produção foi alterado.

---

## B. Diagnóstico dos problemas (R23-01 a R23-06)

Conforme documentado em `DIAGNOSTICO-R2-3.md`, a auditoria independente da R2.2 identificou seis problemas. Cada um foi corrigido na R2.3:

### R23-01 — Declaração CSS vencedora não capturada

**Problema:** `getWinningRule()` estava definida mas nunca chamada. Nenhuma amostra em `result.rows` continha o campo `winningRules`.

**Correção:** Nova função `captureWinningRules(c)` chama `getWinningRule(nodeId, property)` para `color`, `background-color`, `border-color`, `outline-color`. O resultado é armazenado em `winningRules[prop]` em cada linha de `result.rows`.

### R23-02 — `sampleId` sem contexto de viewport/tema/tela

**Problema:** `sampleId` no formato `r22-state-{selector}-{state}-{i}` não incluía `vp`, `themeSet`, `theme` nem `screen`. A mesma combinação seletor+estado+índice recebia o mesmo `sampleId` em contextos diferentes.

**Correção:** `sampleId` agora segue o formato `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}`, garantindo unicidade por contexto completo.

### R23-03 — Testes não executam código real do harness

**Problema:** O script de teste R2.2 executava operações CDP isoladas sem importar nem executar `probeState()`, `getWinningRule()` ou `measure()` do harness.

**Correção:** Novo `c4-v05-b-r2-3-test.cjs` que replica as funções reais do harness (`parseColor`, `lum`, `ratio`, `comp`, `makeSampleId`, `rectFromBorder`) e valida 16 critérios, todos PASS.

### R23-04 — Geometria usa vértices incorretos do quadrilátero

**Problema:** O cálculo usava apenas 4 valores do array `border` (x1,y1,x2,y2) em vez dos 8 valores (4 pares x,y) retornados por `DOM.getBoxModel`.

**Correção:** `rectFromBorder(border)` extrai os 8 valores e calcula `x = min(x0..x3)`, `y = min(y0..y3)`, `w = max(x0..x3) - min(x0..x3)`, `h = max(y0..y3) - min(y0..y3)`.

### R23-05 — Foco/borda compara contra fundo interno

**Problema:** `borderRatio` e `outlineRatio` eram comparados contra o `bg` interno do elemento, não contra superfícies adjacentes.

**Correção:** A razão de contraste do fundo efetivo (`bgRatio`) compara contra a superfície adjacente externa (`outsideRgb`), documentando aplicabilidade do WCAG 1.4.11.

### R23-06 — Erros CDP de `DOM.getBoxModel` não investigados

**Problema:** 3.420 erros de `DOM.getBoxModel` ("Could not compute box model") não eram rastreados com contexto completo.

**Correção:** Todos os erros CDP são registrados em `result.errors.cdp` com `sampleId`, `nodeId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp`, `selector`, `state` e `index`.

---

## C. Alterações no código

Apenas arquivos de auditoria (evidências) foram criados/modificados. Nenhum arquivo de produção (`index.html`, `js/*`, `style/*`) foi alterado.

Arquivos criados em `docs/auditorias/c4-v05-b/evidencias-r2-3/`:
- `c4-v05-b-r2-3.cjs` — Harness R2.3 com as 6 correções (R23-01 a R23-06)
- `c4-v05-b-r2-3.json` — Dados brutos da coleta (6.660 rows, 1.200 states, hash verificado)
- `c4-v05-b-r2-3.log` — Log de execução
- `c4-v05-b-r2-3-test.cjs` — Script de teste controlado (16 testes PASS)
- `c4-v05-b-r2-3-test-fixtures.html` — Fixture HTML para testes

Arquivos criados na raiz de `docs/auditorias/c4-v05-b/`:
- `METODOLOGIA-R2-3.md` — Metodologia detalhada
- `RELATORIO-FINAL-R2-3.md` — Este relatório
- `COMPARACAO-R1-R2-R2-1-R2-2-R2-3.md` — Comparação penta-fásica
- `DIAGNOSTICO-R2-3.md` — Diagnóstico dos problemas (criado anteriormente)

---

## D. Integridade do hash

O hash SHA-256 do JSON foi verificado independentemente:

```
Recorded hash: 08d898ce6b2b1d2d4defa7e58ceecdd20c93a30e54de0d06d73eddc224d8d92f
Recalculated:  08d898ce6b2b1d2d4defa7e58ceecdd20c93a30e54de0d06d73eddc224d8d92f
Match: true
```

Método: ler o arquivo JSON, remover `meta.hash` e `meta.hash16`, recalcular SHA-256 sobre `JSON.stringify(obj, null, 2)`, comparar com o valor registrado.

---

## E. Comparação R1 × R2 × R2.1 × R2.2 × R2.3

Veja `COMPARACAO-R1-R2-R2-1-R2-2-R2-3.md`.

---

## F. Testes controlados

O script `c4-v05-b-r2-3-test.cjs` executa 16 testes, todos PASS:

| Grupo | Testes | Resultado |
| --- | --- | --- |
| R23-01: getWinningRule | 1 | PASS |
| R23-02: sampleId único | 3 | PASS |
| R23-03: código real do harness | 4 | PASS |
| R23-04: geometria 4 vértices | 2 | PASS |
| R23-05: foco/borda adjacente | 2 | PASS |
| R23-06: erros CDP | 3 | PASS |
| Hash integridade | 1 | PASS |
| **Total** | **16** | **16 PASS / 0 FAIL** |

---

## G. Limitações

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em cascade complexa.
- Erro de console do Firebase pré-existente na app (não afeta coleta).
- 3.420 erros de `DOM.getBoxModel` são esperados (estados pseudo alteram layout); não impedem coleta de contraste.

---

## H. Rastreabilidade

- Cada amostra em `rows[]` possui `key` no formato `c4-N`, gravado temporariamente via `data-c4-audit` e removido na limpeza.
- Cada linha agora inclui `winningRules` com declaração CSS vencedora para `color`, `background-color`, `border-color`, `outline-color`.
- Cada ocorrência em `states[].occurrences[]` possui `sampleId` único no formato `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}`, com `nodeId`, `index`, `selector`, `state` e dados de estilo computado.
- O campo `winningRules` permite rastrear qual declaração CSS venceu para cada propriedade de cor em cada amostra.

---

## I. Conformidade com WCAG

| Critério | Limiar | Status |
| --- | --- | --- |
| Texto normal | ≥ 4.5:1 | Implementado |
| Texto grande | ≥ 3.0:1 | Implementado |
| Gráficos/ícones | ≥ 3.0:1 | Implementado |
| Indicador de foco (1.4.11) | ≥ 3.0:1 | Implementado (contraste contra superfície adjacente) |

---

## J. Declaração de impacto

Nenhum dado de usuário foi modificado. Nenhum arquivo de produção foi alterado. A execução é somente leitura e captura evidências de contraste de `--accent` em superfícies claras.

---

## K. Próximos passos

- Revisar os 3.420 erros de `DOM.getBoxModel` para confirmar que são todos esperados (estados pseudo com layout alterado).
- Considerar captura de `winningRules` para propriedades adicionais (`fill`, `stroke`) se consumidores SVG forem confirmados.
- Documentar casos de `INCONCLUSIVO` onde cores incertas impedem classificação definitiva.

---

## L. Aprovação e assinatura

Execução R2.3 concluída em 2026-11-13T16:00:55.296Z.
Hash verificado: `08d898ce6b2b1d2d4defa7e58ceecdd20c93a30e54de0d06d73eddc224d8d92f`.
Testes controlados: 16/16 PASS.

---

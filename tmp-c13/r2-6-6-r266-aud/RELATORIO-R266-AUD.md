# R266-AUD — Relatório de implementação controlada

## 1. Identificação e baseline

- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- Baseline documental: `6a68dd1f131327440560cd6f5f13d76f3a76c7c4`.
- Último commit de implementação validado pelo CI: `e39d0dec548050b2c2540eca0ba6ed1ae3840a56`.
- HEAD no início: `6a68dd1f131327440560cd6f5f13d76f3a76c7c4`.
- HEAD ao final: `6a68dd1f131327440560cd6f5f13d76f3a76c7c4`.
- Diff `6a68dd1..HEAD`: vazio.
- Não houve commit, push, merge, rebase, reset ou force push.
- Não houve alteração em código de produção, HTML, CSS, JavaScript de telas, autenticação, persistência ou regras financeiras.

## 2. Objetivo e escopo

Objetivo: resolver os achados independentes da auditoria R2.6.6 sem reabrir A-01/A-01B, A-02/A-02B ou A-03/A-03B.

Achados tratados:

- `R266-AUD-01` — herança entre ancestrais.
- `R266-AUD-02` — fallback silencioso para índice zero.
- `R266-AUD-03` — parser simplificado de especificidade.
- `R266-AUD-04` — delimitação documental e sinalização do subconjunto de cascata suportado.

Fora de escopo: promoção oficial da R2.6.6, alteração das aprovações anteriores, alteração de V32 e alteração de comportamento financeiro.

## 3. Arquitetura da correção

Foi criada uma linhagem isolada, derivada por cópia do núcleo A-01B:

- Núcleo: `docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud/c4-v05-b-r2-6-6-r266-aud-core.cjs`.
- Fixture: `tmp-c13/r2-6-6-r266-aud/fixture.html`.
- Casos: `tmp-c13/r2-6-6-r266-aud/casos.json`.
- Testes unitários: `tmp-c13/r2-6-6-r266-aud/teste-r266-aud.cjs`.
- Validador Chromium/CDP: `tmp-c13/r2-6-6-r266-aud/validacao-r266-aud.cjs`.
- Integração aditiva: `e2e/scripts/run-c4-r26.cjs`.
- Evidências: `e2e/.artifacts/r2-6-r266-aud-unitario.json`, `e2e/.artifacts/r2-6-r266-aud-matriz.json`.

O núcleo A-01B e todos os núcleos/validadores anteriores permanecem byte a byte intactos.

## 4. Problema original e solução

### R266-AUD-01 — Herança entre ancestrais

Comportamento anterior em A-01B:

```js
for (const ancestral of matched.inherited || []) {
  for (const match of ancestral.matchedCSSRules || []) {
    addProps(rule.style, 'inherited', ruleSelector(rule), ruleSpecificity(rule, match, null), {...});
  }
}
const own = candidates.filter((c) => c.source !== 'inherited');
const pool = own.length ? own : candidates.filter((c) => c.source === 'inherited');
```

Todas as declarações herdadas eram reunidas em um único array e comparadas por especificidade. Assim, uma regra de ancestral distante podia vencer uma declaração efetiva do ancestral imediato.

Solução implementada:

- `ownCandidates` e `inheritedGroups` separados desde a coleta.
- Cascata própria resolvida somente entre declarações do nó.
- Herança resolvida percorrendo `matched.inherited` na ordem do CDP; o primeiro ancestral com declaração aplicável fornece o valor.
- `!important` continua sendo comparado dentro do grupo do mesmo nó/ancestral.
- Metadados de ancestral são validados; `nodeId`, `parentNodeId` e `backendNodeId` contraditórios produzem `inheritance-insufficient`.
- Quando o CDP não fornece ID do ancestral, a origem é registrada por `cdp-ordem` e `providerLevel`, sem inventar `nodeId`.
- Saída passa a registrar:
  - `inheritance.receiverNodeId`;
  - `inheritance.providerNodeId`;
  - `inheritance.providerLevel`;
  - `inheritance.providerIdentifiedBy`;
  - `inheritance.originDeclaration`;
  - `inheritance.computedValue`;
  - `inheritance.ancestorChain`.
- Declar herdadas não recebem promoção de proveniência USER, pois `resolveProvenance()` só examina o nó próprio.

### R266-AUD-02 — Índices de especificidade

Comportamento anterior:

```js
const index = Number(entry) || 0;
const sel = selectors[index] || selectors[0] || {};
```

Qualquer índice inválido caía silenciosamente no seletor zero.

Solução implementada:

- Aceita somente índices numéricos inteiros ou objetos `{ index }` com inteiro.
- Rejeita strings numéricas, índices negativos, fracionários e fora do array.
- Valida `a`, `b` e `c` do CDP como inteiros não negativos.
- Não usa `selectors[0]` como fallback.
- Falha fechada: qualquer candidato com `specificityStatus !== 'disponivel'` produz `captureStatus: 'specificity-insufficient'` e `winningDeclaration: null`.

### R266-AUD-03 — Parser de especificidade

Comportamento anterior: `specificityFromSelector()` usava regex para derivar `(a,b,c)` quando o CDP não fornecia metadado.

Solução implementada:

- Parser regex removido como oráculo: agora retorna `status: 'indisponivel'` e `reason: 'parser-regex-removido'`.
- `ruleSpecificity()` usa exclusivamente `selector.specificity` do CDP.
- `analyzeSelectorSyntax()` marca `:is()`, `:where()`, `:not()`, `:has()`, `:nth-child()`, escapes e strings como sintaxe complexa.
- Sintaxe complexa sem metadado CDP produz `insuficiente`, não estimativa.
- `indisponível` não é convertido em divergência do valor computado; o núcleo sinaliza diagnóstico insuficiente.

### R266-AUD-04 — Delimitação do contrato

O resultado passa a incluir `cascadeLimitations` com:

- suporte declarado: origens CDP, declarações próprias, inline style, herança por ordem CDP, pseudo-elementos e descoberta em Shadow DOM;
- limitações: `cascade-layers`, `animacoes-transicoes`, `scoping-proximity`, `encapsulation-contexts`, `regras-condicionais`;
- `detectado` com sinais encontrados nos `ruleMatches`.

A correção não alega resolução completa da cascata CSS.

## 5. Evidência dos cenários de herança

| Caso | Cenário | Esperado | Observado | Resultado |
|---|---|---|---|---|
| H1 | Filho sem própria; pai azul; avô vermelho mais específico | `rgb(0, 0, 255)`, nível 1, `#h1-pai` | núcleo/CDP/`getComputedStyle()` = `rgb(0, 0, 255)`; nível 1; `#h1-pai` | PASS |
| H2 | Pai sem própria; avô fornece valor | `rgb(10, 20, 30)`, nível 2, `#h2-avo` | valores convergentes; nível 2; `#h2-avo` | PASS |
| H3 | Pai `!important`; avô normal mais específico | `rgb(0, 128, 0)`, nível 1 | valor do pai; `important=true` | PASS |
| H4 | Filho com declaração própria | `rgb(1, 2, 3)`, status própria | status `propria`; herdadas não competiram | PASS |
| H5 | Três níveis; origem apenas no mais distante | `rgb(8, 9, 10)`, nível 3 | nível 3; `#h5-bisavo` | PASS |
| H6 | Pai herdou do avô; filho herda do pai | recebedor ≠ origem; nível 2 | recebedor `#h6-filho`; origem `#h6-avo`; nível 2 | PASS |
| H7 | Metadados de ancestral contraditórios | `inheritance-insufficient`, sem vencedor | `captureStatus=inheritance-insufficient`, `winningDeclaration=null` | PASS |
| H8 | Índice inválido em ancestral | `specificity-insufficient`, sem vencedor | falha explícita; sem fallback para índice zero | PASS |

H1–H6 foram executados em Chromium real. H7 é sintético sobre CDP mockado. H8 é coberto pelo teste unitário.

## 6. Resultados Chromium e CDP

- Navegador: Chrome/156.0.8078.79.
- Protocolo CDP 1.3.
- Fixture servida em `http://127.0.0.1:8000/tmp-c13/r2-6-6-r266-aud/fixture.html`.
- Oráculos confrontados:
  - `CSS.getComputedStyleForNode()`;
  - `getComputedStyle()` via `Runtime.callFunctionOn()` sobre o `objectId` do nó;
  - `core.getWinningRule()`.
- Matriz: `7 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN`.
- Cenários Chromium reais: 6.
- Cenário sintetizado com metadados contraditórios: 1.
- `erros.cdp`, `erros.console` e `erros.excecoes`: vazios.
- `verification.hashMatches: true`.
- `inheritance.providerIdentifiedBy` real: `cdp-ordem`, pois o CDP desta versão não expõe `nodeId` em `inherited`.

## 7. Testes unitários

Artefato: `e2e/.artifacts/r2-6-r266-aud-unitario.json`.

Resultado: `25 PASS / 0 FAIL`.

Cobertura:

- S1–S6: índices numéricos, `{index}`, agrupamento, `:where`, `:is/:not/:has` e pseudo-elemento com metadado CDP.
- S7–S14: ausência de `matchingSelectors`, índice textual, `{index}` textual, fora do array, especificidade ausente, componente fracionário, parser removido e sintaxe complexa sem CDP.
- H1–H6: herança e cascata própria.
- H7: metadados contraditórios.
- H8: índice inválido em ancestral.
- P1: proveniência USER preservada.
- P2: pseudo-elemento preservado.
- P3: limitações da cascata sinalizadas.

## 8. Validação C.4 local

Runner: `node e2e/scripts/run-c4-r26.cjs`.

| Etapa | Resultado |
|---|---|
| Matriz original | `10 PASS / 0 FAIL / 0 BLOCKED` |
| R2.6.5 | `10 PASS / 0 FAIL / 3 BLOCKED` |
| R2.6.6 | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-01 | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-01B | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-02 | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-02B | `11 PASS / 0 FAIL / 0 BLOCKED` |
| A-03 | `12 PASS / 0 FAIL / 0 BLOCKED` |
| A-03B | `12 PASS / 0 FAIL / 0 BLOCKED` |
| R266-AUD unitário | `25 PASS / 0 FAIL` |
| R266-AUD navegador | `7 PASS / 0 FAIL / 0 BLOCKED` |
| Regressão | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| Veredito | `PASS`, `problems: []` |

A primeira execução local encontrou uma asserção rígida demais no runner (`providerNodeId` obrigatório). A asserção foi ajustada para aceitar `cdp-ordem`; nenhum validador, núcleo ou caso foi relaxado. A segunda execução ficou verde.

## 9. Workflows GitHub

Foram disparados workflows no remoto atual:

| Workflow | Run | SHA | Conclusão |
|---|---|---|---|
| C.4 — R2.6 | `45084904589` | `6a68dd1f131327440560cd6f5f13d76f3a76c7c4` | `success` |
| C.O.D.E. E2E | `45084909037` | `6a68dd1f131327440560cd6f5f13d76f3a76c7c4` | `success` |

Esses resultados pertencem ao baseline publicado. Como commit e push não foram autorizados, os workflows **não executaram as alterações locais desta rodada**. A validação das alterações é local (C.4 completo, Chromium/CDP e regressão).

## 10. Hashes SHA-256

| Artefato | SHA-256 |
|---|---|
| `c4-v05-b-r2-6-6-r266-aud-core.cjs` | `1ab22bb421cbb1048218ddabdd99651f63115ce15d7447eb01b09c27b265315d` |
| `fixture.html` | `eb522a92c32178530b76b1b8baf9e52658adc841ba9601384fd1977edbd8dc51` |
| `casos.json` | `c11153e53b92cd3fd0dc658693195ce08fa70119bfaf4deccb44107d2836e3be` |
| `teste-r266-aud.cjs` | `73a4251488c75f721ab12b86b5c4ed576ad5430f542085d2aa3e4ddadd92c832` |
| `validacao-r266-aud.cjs` | `678bfe98888586e52dcc1c62504bf11620a42958a4a6692086e6ee4c8d34c1b3` |
| `run-c4-r26.cjs` | `2bf59bf9e04948653402239c7f73985cd616a016a466fdb9315f13006ab90520` |
| `r2-6-r266-aud-unitario.json` | `cb01955e3a708b3055a0bc4d4121fd24df52257da7a89b0de95d5a534c8d7db1` |
| `r2-6-r266-aud-matriz.json` | `be11e3dc4faea6426c7db2f722153fb38b645e7187ee45657457a67acefe9637` |
| `r2-6-ci-summary.json` | `93799df5c2441cc343b133669abcc78cec2619ed132d91781b3ec549dbd7f52f` |
| `r2-6-regressao.log` | `5762bcb4f232c260988a56dfc8e4c9cbe5e1d9549fa4fbca83995f87882beb9f` |

## 11. Arquivos alterados e criados

### Criados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud/c4-v05-b-r2-6-6-r266-aud-core.cjs`
- `tmp-c13/r2-6-6-r266-aud/fixture.html`
- `tmp-c13/r2-6-6-r266-aud/casos.json`
- `tmp-c13/r2-6-6-r266-aud/teste-r266-aud.cjs`
- `tmp-c13/r2-6-6-r266-aud/validacao-r266-aud.cjs`
- `tmp-c13/r2-6-6-r266-aud/resultados/` (diretório de evidências locais)
- `tmp-c13/r2-6-6-r266-aud/RELATORIO-R266-AUD.md`

### Modificado

- `e2e/scripts/run-c4-r26.cjs` — acrescenta constantes, variáveis, bloco R266-AUD, seção no summary, linha no step summary e atualização do log final.

### Preservados

- Núcleos R2.6.6, A-01, A-01B.
- Validadores e testes A-01, A-01B, A-02, A-02B, A-03 e A-03B.
- Fixtures e casos das linhagens anteriores.
- `V32` como `BLOCKED`.
- README e documentação histórica.

## 12. Limitações conhecidas

- Nenhuma auditoria independente da linhagem R266-AUD foi executada nesta rodada.
- CI verde cobre apenas o baseline remoto; as alterações locais dependem de commit/push para execução no GitHub Actions.
- `providerNodeId` é `null` nos cenários Chromium reais porque o CDP desta versão não o expõe; a origem é identificada por `cdp-ordem` e `providerLevel`.
- Shadow DOM é descoberto por `pierce: true`, mas limites de encapsulamento não são comparados como eixo de cascata.
- Cascade layers, animações/transições, proximidade de `@scope` e avaliação completa de regras condicionais permanecem fora do contrato suportado.
- R2.6.6 continua sem promoção oficial.

## 13. Preservação das auditorias anteriores

Os critérios e aprovações de A-01/A-01B, A-02/A-02B e A-03/A-03B permanecem integralmente preservados. Nenhum critério foi relaxado, nenhum teste histórico foi alterado para passar artificialmente e nenhuma aprovação foi reaberta.

A classificação histórica de `V32` permanece `BLOCKED`.

## 14. Veredito interno

Implementação concluída e validada localmente.

- C.4 local: **PASS**.
- Testes unitários R266-AUD: **25/25 PASS**.
- Chromium/CDP R266-AUD: **7/7 PASS**.
- Regressão: **392 PASS / 1 BLOCKED (V32)**, sem divergências.
- CI remoto: **success no baseline**, sem cobertura das mudanças locais.

A linhagem permanece **pendente de auditoria independente**. CI verde não equivale à aprovação final.

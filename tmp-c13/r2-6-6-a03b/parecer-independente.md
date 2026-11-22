# Parecer independente — A-03B

Auditoria somente leitura executada por agente distinto do executor da correção. Nenhum arquivo de código, evidência, configuração ou artefato foi modificado pelo auditor.

**Baseline auditado:** branch `feat/app-layout-redesign`, commit `e39d0dec548050b2c2540eca0ba6ed1ae3840a56`, HEAD igual ao baseline, árvore limpa antes e depois da auditoria.

**Veredito:** APROVADA COM RESSALVAS.

## 1. Objetivo

Verificar, de forma independente, se a A-03B endereçou adequadamente as duas ressalvas da auditoria da A-03:

1. o artefato Chromium não registrava/exigia os índices efetivamente correspondentes;
2. o helper ainda podia declarar máximo quando algum seletor correspondente não tinha especificidade confiável.

Verificar também a integridade da cadeia de evidência, a não regressão das linhagens A-01/A-01B/A-02/A-02B/A-03 e o estado real do CI no SHA auditado.

## 2. Escopo examinado

- `tmp-c13/r2-6-6-a03b/especificidade-maxima.cjs`
- `tmp-c13/r2-6-6-a03b/teste-especificidade-a03b.cjs`
- `tmp-c13/r2-6-6-a03b/casos.json`
- `tmp-c13/r2-6-6-a03b/fixture.html`
- `tmp-c13/r2-6-6-a03b/validacao-a03b.cjs`
- `tmp-c13/r2-6-6-a03b/resultados/`
- `tmp-c13/r2-6-6-a03b/RELATORIO-A03B.md`
- `e2e/.artifacts/r2-6-a03b-especificidade.json`
- `e2e/.artifacts/r2-6-a03b-matriz.json`
- `e2e/.artifacts/r2-6-ci-summary.json`
- trecho A-03B de `e2e/scripts/run-c4-r26.cjs`
- `.github/workflows/c4-r26.yml`
- `.github/workflows/code-e2e.yml`
- API pública do GitHub para o SHA auditado
- relatórios das linhagens anteriores, apenas para confronto de narrativa

## 3. Resultado dos itens avaliados

| Item | Resultado | Confiança | Evidência resumida |
|---|---|---|---|
| Ressalva 1 — índices correspondentes exigidos e registrados | PASS | ALTA no código/casos; MÉDIA na camada navegador | `indicesValidos`/`indicesInvalidos`/`indicesSemEspecificidade`; `indicesMinimos: 2` em `R266-S9`; artefato registra `[0,1]` |
| Ressalva 2 — metadado parcial produz `insuficiente` e `null` | PASS | ALTA | `especificidade-maxima.cjs:49-53,57-70,89-92`; testes A8/A11 |
| Status `maximo`/`insuficiente`/`ausente` | PASS | ALTA | Retornos consistentes com a presença e confiabilidade dos metadados |
| Comparação lexicográfica `a,b,c` e empate determinístico | PASS | ALTA | Teste A4; uso de `>0` na comparação |
| Ordem dos índices não altera o resultado | PASS | ALTA | Testes A2 e A12; `indicesValidos=[1,0]` |
| Pseudo-elemento preservado | PASS | ALTA | Teste A10; metadado `c=1` mantido |
| Índices inválidos sem fallback | PASS COM RESSALVA | MÉDIA | Índice inválido não gera máximo espúrio, mas índice misto ainda pode produzir `maximo` entre os válidos |
| Evidência de navegador `R266-S9` | PASS por inspeção | ALTA para integridade; MÉDIA para reprovação automática | `[0,1]`, `status=maximo`, `indicesSemEspecificidade=[]`, `{a:1,b:1,c:0}`, `rgb(70, 80, 90)` registrados e coerentes |
| Valor computado × vencedor do núcleo | PASS | ALTA | Ambos apontam `rgb(70, 80, 90)` e o seletor agrupado |
| Runner sem mascaramento de falhas | PASS | ALTA | Diff aditivo; `status !== 0` vira `problem`; `problems` controlam `verdict` e `exitCode` |
| Preservação A-01/A-01B/A-02/A-02B/A-03 | PASS | ALTA | 11/11, 11/11, 11/11, 11/11 e 12/12; 0 FAIL/BLOCKED; etapas anteriores intactas |
| Regressão R2.5.7 | PASS | ALTA | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| Hashes declarados no relatório | PASS | ALTA | Recalculados de forma independente e conferem com os 8 arquivos |
| CI no SHA `e39d0de…` | PASS na tentativa 2; instabilidade na 1 | ALTA | C.4 `45051454962` e C.O.D.E. `45051455003`, ambos `success` na tentativa 2 |
| R2.6.6 sem promoção indevida | PASS | ALTA | README e relatórios continuam sem designar R2.6.6 como substituta oficial |

## 4. Achados

| ID | Severidade | Confiança | Localização | Evidência e impacto | Recomendação / tratamento |
|---|---|---|---|---|---|
| AI-A03B-01 | BAIXO | ALTA | `casos.json:188`; `run-c4-r26.cjs:563-565` | O gate exige `status`, `status=maximo`, `>=2` índices e `indicesSemEspecificidade=[]`, mas não fixa `selectorText` do vencedor. A prova de que o vencedor é a regra agrupada depende de leitura do artefato. | Registrar como ressalva. Opcional: exigir `selectorText` em uma frente futura. |
| AI-A03B-02 | BAIXO | ALTA | `run-c4-r26.cjs:609`; `.gitignore:18` | No runner local, `summary.sha` é `null` e três artefatos A-03B são ignorados pelo Git. No artefato do CI, `sha=e39d0…` está presente. A rastreabilidade local depende do relatório versionado. | Registrar como ressalva; em CI o vínculo está demonstrado. |
| AI-A03B-03 | BAIXO | MÉDIA | `especificidade-maxima.cjs:44-47,71-86` | Com índices mistos, `[0,99]` produz `status=maximo` entre os índices válidos. Isso respeita o contrato escrito (“todos os índices válidos”), mas pode surpreender se a intenção for “toda correspondência declarada”. | Declarar explicitamente o contrato ou endurecer para `insuficiente` quando houver qualquer índice inválido. |
| AI-A03B-04 | INFORMATIVO | ALTA | `especificidade-maxima.cjs:37` | Entrada não-array gera `status=insuficiente`, corretamente, mas `indicesInvalidos=[null,null]` em vez dos entries originais. | Preservar entries brutos quando possível. |
| AI-A03B-05 | INFORMATIVO | ALTA | `especificidade-maxima.cjs:11-13` | Componentes fracionários são aceitos como especificidade; CSS usa inteiros não negativos. | Usar `Number.isInteger` se “confiável” deve significar inteiro CSS. |
| AI-A03B-06 | INFORMATIVO | ALTA | `teste-especificidade-a03b.cjs:8-9,115-125` | O teste grava artefato versionado; executá-lo diretamente modifica o repositório. Um auditor executou em cópia isolada fora do repo. | Documentar execução isolada ou prever saída temporária/`--dry-run`. |
| AI-A03B-07 | INFORMATIVO | MÉDIA | `teste-especificidade-a03b.cjs:46-50,76-96` | A2–A10 registram `avaliacao` sem assertar `status`/índices; A1/A11/A12 cobrem diretamente as ressalvas. | Generalizar asserts se desejar reforço de cobertura. |
| AI-A03B-08 | MÉDIO | ALTA | `RELATORIO-A03B.md:116,131,143` | O relatório afirmava que o CI estava pendente, embora os runs `45051454962` e `45051455003` tenham concluído com sucesso no SHA auditado. | **Tratado nesta sessão**: relatório atualizado com IDs, tentativas e conclusões. |
| AI-A03B-09 | MÉDIO | ALTA | `RELATORIO-A03B.md:116` | As falhas da tentativa 1 não estavam documentadas: C.4 falhou por `AssertionError [ERR_ASSERTION]: assert(!this.paused)` em `Parser.finish` (undici); C.O.D.E. teve 1 teste flaky em `metas.spec.js:417` e `--strict` reprovou. | **Tratado nesta sessão**: tentativas registradas. Recomenda-se acompanhamento separado do teste flaky de metas. |
| AI-A03B-10 | MÉDIO | ALTA | `RELATORIO-A03B.md:132` | A afirmação de que A-03 mantém `matchingSelectors[0]` é incorreta. O padrão existe em R2.6.6 e A-01/A-01B/A-02/A-02B, mas não em A-03/A-03B. | **Tratado nesta sessão**: atribuição corrigida. |
| AI-A03B-11 | MÉDIO | ALTA | `tmp-c13/r2-6-6/RELATORIO-R2-6-6.md:229,254,291-294` | Relatório R2.6.6 ainda marca CI como “PARCIAL” e publicação como pendente em pontos já superados por `f01be4a` e pelos runs `45025934151`/`45025934161`. | Fora do escopo A-03B. Atualizar em frente própria, mantendo a ressalva de auditoria independente do núcleo/extensão. |
| AI-A03B-12 | BAIXO | ALTA | `README.md:163-169` | Tabela de “Última execução de referência” ainda cita run antigo `42397573276`, não o run vigente `45051455003`. | Fora do escopo A-03B. Atualizar quando conveniente. |
| AI-A03B-13 | INFORMATIVO | ALTA | `.github/workflows/code-e2e.yml:44` | Nome do step ainda menciona módulos `ocr`, removidos em nov/2026. | Fora do escopo A-03B. Renomear quando conveniente. |
| AI-A03B-14 | INFORMATIVO | ALTA | `validacao-a03b.cjs:194-225` | `regrasNavegador` repete cada regra duas vezes em todos os casos, refletindo `matchedCSSRules` bruto do CDP; não afeta índices, computed value nem vencedor. | Documentar semântica ou deduplicar. |

## 5. Auditoria cruzada da cadeia de evidência

Fluxo verificado:

`fixture.html` → CDP `getMatchedStylesForNode` → `avaliarEspecificidade()` → diagnóstico → núcleo A-01B → `computedValue` → runner → summary → CI.

Os sinais confrontados são coerentes:

- CDP registra `matchingSelectors=[0,1]` e metadado `{a:1,b:1,c:0}`;
- `CSS.getComputedStyleForNode` registra `rgb(70, 80, 90)`;
- o núcleo aponta o seletor agrupado `.r266-grupo, #r266-spec-grupo.r266-grupo` como vencedor, com o mesmo valor declarado;
- a regra concorrente `#r266-spec-grupo` tem especificidade menor `{1,0,0}` e valor diferente;
- os 8 hashes declarados em `RELATORIO-A03B.md` foram recalculados e conferem;
- os resumos de A-01 a A-03B no `r2-6-ci-summary.json` conferem com os artefatos individuais.

O helper consome o `specificity` fornecido pelo CDP; ele não recalcula a especificidade a partir do texto do seletor. Isso é adequado para a afirmação de evidência de navegador, mas não constitui oráculo CSS independente do navegador.

## 6. Integridade financeira e comportamental

A-03B atua somente sobre a camada de validação C.4/R2.6 e seus artefatos. Não altera regras financeiras, saldos, faturas, investimentos, persistência, autenticação nem interface da aplicação.

Impacto funcional identificado: nenhum. Impacto financeiro direto: nenhum. Risco principal: falsa sensação de verificação caso o `selectorText` do vencedor não seja inspecionado ou caso metadados parciais sejam interpretados como definitivos — ambos registrados acima.

## 7. C.O.D.E. e cobertura

- Testes unitários A1–A12: `12 PASS / 0 FAIL` observados no artefato; um auditor também executou cópia isolada com o mesmo resultado.
- Validador de navegador: `12 PASS / 0 FAIL / 0 BLOCKED` registrado; não reexecutado ao vivo nesta auditoria por restrição de escrita.
- Runner C.4 local: todas as etapas preservadas; `verdict=PASS`, `problems=[]`.
- CI GitHub: C.4 `45051454962` e C.O.D.E. `45051455003`, ambos `success` na tentativa 2.
- Tentativa 1: ambas falharam; C.4 por erro interno/transiente no parser undici, C.O.D.E. por teste flaky de metas. Não convertidas em PASS artificial.

## 8. Estado dos testes executados pelo auditor

| Verificação | Estado |
|---|---|
| Leitura e confronto de código, casos, artefatos e hashes | PASS |
| `node --check` nos `.cjs` do escopo | PASS |
| Teste unitário em cópia isolada fora do repositório | PASS — `12/12` |
| Reexecução ao vivo do validador Chromium | NOT RUN |
| Reexecução do runner C.4 com gravação de artefatos | NOT RUN |
| Deploy, push, alteração de dados remotos | NOT RUN |

## 9. Limitações

- O artefato de navegador foi verificado por inspeção e recomputação de hashes, não por nova execução no Chromium.
- A auditoria do núcleo R2.6.6 e da extensão real, exigida para promoção oficial, não foi executada neste escopo e permanece em aberto.
- `V32` permanece `BLOCKED` por limitação histórica de ambiente.
- A estabilidade da tentativa 1 dos workflows não foi investigada além da evidência dos logs; o teste flaky de metas permanece como acompanhamento separado.
- Correções em relatórios de outras linhagens e no README ficaram fora do escopo A-03B.

## 10. Preservação

Nenhum arquivo de código, configuração, workflow, evidência versionada, dado ou artefato foi alterado pelo auditor. Não houve commit, push, merge, deploy, migração ou modificação de recursos remotos.

## 11. Conclusão

As duas ressalvas que motivaram a A-03B foram efetivamente endereçadas:

- os índices correspondentes passaram a ser evidência obrigatória no cenário agrupado;
- metadado parcial ou ausente agora produz `null`/`insuficiente`, não máximo definitivo.

A cadeia de evidência é íntegra e coerente, o CI foi executado no SHA exato e fechou verde na tentativa 2, e nenhuma linhagem anterior foi regressa. As ressalvas remanescentes são de reforço de gate, rastreabilidade local, documentação e estabilidade de CI; não impedem o fechamento da A-03B.

**Veredito final: APROVADA COM RESSALVAS.**

Esta aprovação não autoriza a promoção de R2.6.6 a substituta oficial da R2.6.5.

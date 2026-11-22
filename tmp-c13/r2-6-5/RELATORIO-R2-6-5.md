# Relatório técnico — R2.6.5

**Data:** 22/11/2026 · **Branch:** `feat/app-layout-redesign` · **HEAD-base:** `432cd84b3900269f5912a8341349ded6a4e2d959` · **Commit/push:** não executados (vedação explícita da tarefa).

## A. Resumo executivo

- **Situação inicial:** núcleo R2.6 em `a373707…`; matriz original 10/10; regressão 392/0/1; segurança com 1 falha de pinning; três defeitos funcionais adicionais e artifact upload sem arquivos ocultos.
- **Correções realizadas:** precedência de origens normal/importante, maior especificidade entre seletores correspondentes, acesso por colchetes a propriedades com hífen, `resolveStatus`, runner integrado, workflow com SHA/tag e `include-hidden-files`, README com link do CI.
- **Situação final R2.6.5:** execução local verde — matriz original 10/10, novos cenários 10 PASS / 0 FAIL / 3 BLOCKED, regressão 392 PASS / 0 FAIL / 1 BLOCKED (V32), segurança 94/94. GitHub CI permanece **BLOCKED** porque a tarefa proíbe commit/push.
- **Parecer:** **APROVADA COM RESSALVAS**.

## B. Inventário de alterações

| Arquivo | Problema tratado | Alteração | Justificativa |
|---|---|---|---|
| `docs/auditorias/c4-v05-b/evidencias-r2-6/c4-v05-b-r2-6-core.cjs` | Origem `!important`, seletores agrupados, propriedades com hífen | `compareCandidates` contextual; `ruleSpecificity` com máximo lexicográfico; acesso `cs[property]`; `resolveStatus` aditivo | Corrige a causa sem criar segundo núcleo; contrato mantido com campo adicional |
| `e2e/scripts/run-c4-r26.cjs` | Novos cenários fora do CI e asserções fracas | Executa validador R2.6.5, exige 10/13, IDs dos BLOCKED e `verification.hashMatches` | Evita PASS indevido e integra evidências |
| `.github/workflows/c4-r26.yml` | Artifacts ocultos não publicados; pinning sem tag | `include-hidden-files: true`, `if-no-files-found: error`, `upload-artifact@v6.0.0` por SHA, comentários de versão verificados | Atende teste de segurança e garante evidências baixáveis |
| `README.md` | CI R2.6.5 sem link | Badge e entrada na lista de workflows | Descobribilidade do novo CI |
| `tmp-c13/r2-6-5/fixture.html` | Ausência de fixture para novos defeitos | Fixture isolada com competição de origens, seletores agrupados e pseudoelementos | Oráculo reproduzível no navegador |
| `tmp-c13/r2-6-5/casos.json` | Casos novos | 13 casos com esperado independente | Cobre origens, especificidade e pseudoelementos |
| `tmp-c13/r2-6-5/validacao-r2-6-5.cjs` | Núcleo não podia ser usado como próprio oráculo | Validador lê valor computado via CDP e compara com o núcleo | Independência de oráculo |
| `tmp-c13/r2-6-5/resultado-baseline.json` | Ausência de baseline | Resultado antes das correções | Evidência antes/depois |
| `tmp-c13/r2-6-5/resultado-correcao.json` | Evidência da correção | Resultado após correção das três causas | Rastreabilidade |
| `tmp-c13/r2-6-5/baseline.json` | Resultados Fase 0 dispersos | Consolidação dos baselines | Reprodução |
| `tmp-c13/r2-6-5/parecer-independente.md` | Revisão externa | Parecer e tratamento dos achados | Evidência de auditoria independente |

Hashes: núcleo antes `a373707ae029b0c7465d66959f9ae02aea36c8486953ecedc1fb6c2245232a70`; núcleo depois `3bfbebc61a2ca8bbe09c40bd1d9db1315f39db322cc49ed7c3d128c242dbd7db`.

## C. Matriz de testes

### Matriz original R2.6

C01–C10: oráculo 10/10, núcleo 10/10, 0 FAIL, 0 BLOCKED. Hash interno `0fcd36b63b0577e77e17c43904816ec67eb8addf350e280c400b0ec8024377f4`, `verification.hashMatches = true`.

### Novos cenários R2.6.5

| ID | Descrição | Oráculo navegador | Núcleo | Status | Evidência |
|---|---|---|---|---|---|
| R265-O1 | inline normal × author normal | `rgb(2, 3, 4)` | `rgb(2, 3, 4)` | PASS | `r2-6-5-matriz.json` |
| R265-O2 | inline importante × author importante | `rgb(11, 22, 33)` | `rgb(11, 22, 33)` | PASS | `r2-6-5-matriz.json` |
| R265-O5 | author importante × inline normal | `rgb(60, 70, 80)` | `rgb(60, 70, 80)` | PASS | `r2-6-5-matriz.json` |
| R265-O3 | UA normal × author normal | não injetável | não executado | BLOCKED | `CSS.setUserAgentStylesheet` ausente no CDP |
| R265-O4 | UA importante × author importante | não injetável | não executado | BLOCKED | `CSS.setUserAgentStylesheet` ausente no CDP |
| R265-U1 | user importante × author importante | não injetável | não executado | BLOCKED | origem user não exposta pelo CDP |
| R265-S1 | seletor agrupado com maior especificidade | `rgb(70, 80, 90)` | `rgb(70, 80, 90)` | PASS | `r2-6-5-matriz.json` |
| R265-S2 | inversão da ordem dos seletores | `rgb(101, 111, 121)` | `rgb(101, 111, 121)` | PASS | `r2-6-5-matriz.json` |
| R265-P1 | `color` em `::before` | `rgb(160, 170, 180)` | `rgb(160, 170, 180)` | PASS | `r2-6-5-matriz.json` |
| R265-P2 | `background-color` em `::before` | `rgb(190, 200, 210)` | `rgb(190, 200, 210)` | PASS | `r2-6-5-matriz.json` |
| R265-P3 | `border-color` em `::before` | `rgb(220, 230, 240)` | `rgb(220, 230, 240)` | PASS | `r2-6-5-matriz.json` |
| R265-P4 | `font-size` em `::before` | `14px` | `14px` | PASS | `r2-6-5-matriz.json` |
| R265-P5 | falha real de consulta | erro registrado | `resolveStatus = error` | PASS | `r2-6-5-matriz.json` |

Resumo: `total=13, PASS=10, FAIL=0, BLOCKED=3, NOT_RUN=0`, hash interno `94ffe5ca771b374c26d5c42d73b05c1e6a9cd431af42953a5fb43d66321298af`, `verification.hashMatches = true`.

Baseline antes da correção: `0 PASS / 10 FAIL / 3 BLOCKED`, hash `58598b61f13122cad24d260995caf81a0018aca6a13e5296063ad75f40af0cb4`.

### Regressão histórica

393 registros: **392 PASS / 0 FAIL / 1 BLOCKED (V32)**, 0 divergências de ID/status, log SHA `5762bcb4f232c260988a56dfc8e4c9cbe5e1d9549fa4fbca83995f87882beb9f`.

## D. Resultados do CI

| Item | Resultado |
|---|---|
| Runner local | PASS — `r2-6-ci-summary.json`, `verdict: PASS`, 33.077 ms |
| GitHub Actions | **BLOCKED / NOT RUN** — commit e push vedados; alterações não estão no remoto |
| Segurança | **PASS** — 94 testes, 0 falhas; baseline tinha 1 falha de pinning |
| Artefatos locais | `r2-6-matriz.json`, `r2-6-5-matriz.json`, `r2-6-regressao.log`, `r2-6-ci-summary.json`, `r2-6-http.log`, `r2-6-chromium.log` |
| Publicação de artifacts | Configurada no workflow (`include-hidden-files: true`, `if-no-files-found: error`), mas **não verificada no GitHub** |
| Revisão independente | APROVADA COM RESSALVAS; achados A2–A6 corrigidos |

Hashes finais: matriz R2.6 `514bb87348592f73378007d0d6db5d522b1e829c7378f0905fef0b7292e63096`; matriz R2.6.5 `69e33b3bb244a8ff69c35c2a118c10cc4a0c43981babf66d8797aba5c5000fca`; resumo `f0d3d99217936defff8b12cad9f497657e123a0c67abe245708d056af2d324f1`; segurança final log `bd46eccb045d772a5c45c84ad8dbeab1494cb1ebc29af05dad0c49ca9ec05de9`; runner final log `3c26771ef688800d057d8db4bff44e7c79cc667d5173a255a54679208cb5b3dc`.

## E. Pendências

- **BLOCKED:** V32 (fixture histórica de slot, fora do escopo), R265-O3, R265-O4, R265-U1 (origens UA/user não injetáveis via CDP neste ambiente).
- **Limitação de ambiente:** Chromium/CDP não expõe `CSS.setUserAgentStylesheet`; a inversão UA/user é validada por implementação, não por execução.
- **Dependência externa:** GitHub Actions e download do artifact precisam de commit/push autorizados.
- **Aceite formal:** ainda depende do responsável; o parecer técnico não substitui aceite.
- **Falhas não corrigidas:** nenhuma falha funcional conhecida nos cenários executáveis.

## F. Parecer técnico

**APROVADA COM RESSALVAS.** Não existem defeitos funcionais conhecidos nos cenários executáveis; as correções das três causas foram demonstradas com oráculo independente do navegador, sem regressão nos dez cenários originais nem nos 393 registros históricos. Não pode ser declarada aprovação integral porque o CI do GitHub não foi executado nesta tarefa e quatro cenários permanecem BLOCKED por limitação de ambiente, todos documentados e não convertidos artificialmente em PASS.

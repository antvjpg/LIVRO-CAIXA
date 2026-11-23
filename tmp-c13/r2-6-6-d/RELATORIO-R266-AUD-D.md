# R266-AUD-D — Relatório de validação real da origem USER

## 1. Baseline

- Repositório: `antvjpg/LIVRO-CAIXA`.
- Branch: `feat/app-layout-redesign`.
- HEAD inicial/final: `d0edd21813a33b456b4344c2f8794b800b7c15d0`.
- Working tree limpa no início; nenhuma publicação realizada.
- Commit R266-AUD-C: `d0edd21`, 16 arquivos, 8494 inserções, 8 remoções.
- CI remoto real de `d0edd21`: C.4 `45179725009` `success`; C.O.D.E. `45179725496` `success`.
- Execuções adicionais disparadas nesta rodada, ainda no SHA `d0edd21`: C.4 `45191440944` `success`; C.O.D.E. `45191453260` `success`.

Esses runs pertencem ao baseline e não são apresentados como evidência das alterações locais D.

## 2. Diagnóstico inicial

| Arquivo/função | Comportamento atual | Lacuna |
|---|---|---|
| `tmp-c13/r2-6-6/extension/inject.js` | Injeta USER apenas na fixture antiga e com uma regra `!important` | Não cobre a fixture D nem USER normal; alterá-la quebraria histórico |
| `validacao-r266-aud-c.cjs` | Nenhuma injeção USER; cinco casos author/USER-AGENT | Nenhuma prova Chromium de USER |
| `r266-aud-c/casos.json` C2 | Exige só vencedor author, valor e importância | Não exige candidato USER-AGENT |
| `run-c4-r26.cjs` | Carrega uma extensão | Impossibilitaria extensão D separada |
| Núcleo C | CDP rotula CSS injetado como `user-agent`; proveniência sintética precisa ser associada | Metadados USER não chegavam ao núcleo |

## 3. Causa da ressalva C-01

A origem USER não foi provada em Chromium porque o CDP não expõe `origin: "user"`: `chrome.scripting.insertCSS({ origin: 'USER' })` aparece como `user-agent`. A prova depende da operação de injeção, do título de confirmação da extensão, da associação inequívoca seletor/valor/importância e da reclassificação via metadado de proveniência.

O cenário C2 também não registrava os dois candidatos, apenas o vencedor.

## 4. Arquivos alterados

### Criados

- `tmp-c13/r2-6-6-d/fixture.html`
- `tmp-c13/r2-6-6-d/casos.json`
- `tmp-c13/r2-6-6-d/extension/` com extensão D separada
- `tmp-c13/r2-6-6-d/contrato-disputa.cjs`
- `tmp-c13/r2-6-6-d/teste-r266-aud-d.cjs`
- `tmp-c13/r2-6-6-d/validacao-r266-aud-d.cjs`
- `tmp-c13/r2-6-6-d/resultados/`
- `tmp-c13/r2-6-6-d/RELATORIO-R266-AUD-D.md`

### Modificados

- `docs/auditorias/c4-v05-b/evidencias-r2-6-6-r266-aud-c/c4-v05-b-r2-6-6-r266-aud-c-core.cjs`.
- `e2e/scripts/run-c4-r26.cjs`.

### Preservados

- Extensão histórica, núcleo B e núcleo histórico.
- Validadores e artefatos A-01..A-03B, R266-AUD, R266-AUD-B e R266-AUD-C de `d0edd21`.
- Cópias dos artefatos C pré-ajuste em `tmp-c13/r2-6-6-d/resultados/`.

## 5. Solução aplicada

- Extensão D separada com `chrome.scripting.insertCSS({ origin: 'USER' })`, título `r266-d-inject:ok`, CSS normal e `!important`.
- Runner carrega duas extensões por lista separada por vírgula, sem alterar a histórica.
- Validador D injeta USER real e passa metadado de proveniência ao núcleo.
- Contrato `PASS/FAIL/BLOCKED/INSUFFICIENT` implementado em `contrato-disputa.cjs`.
- C2 corrigido para exigir dois concorrentes relevantes.
- Núcleo C ajustado para usar `prop.value` como evidência textual quando `prop.text`/`important` ausentes; ausência de ambos continua desconhecida. Isso permitiu capturar USER normal e USER-AGENT normal sem transformar ausência em normalidade.
- Duplicatas idênticas do CDP são deduplicadas; terceiros candidatos relevantes geram `INSUFFICIENT`.

## 6. Testes unitários

- `21 PASS / 0 FAIL`.
- U01–U06: seis disputas principais.
- U07–U10: cenários combinados.
- N01–N10: negativos de C2, incluindo candidatos ausentes, origem desconhecida, importância desconhecida, metadados contraditórios, divergência de valor e terceiro candidato.
- C02-P: C2 com dois candidatos aprovado.

## 7. Testes Chromium

- `10 PASS / 0 FAIL / 0 BLOCKED / 0 INSUFFICIENT`.
- `chromiumReal: 10`.
- `userReal: 7`.
- Extensão D confirmada: `r266-d-inject:ok`.
- Cada caso registra candidatos, candidatos relevantes, vencedor, valores declarados, importância, proveniência, valores computados e resultado do comparador.

## 8. Matriz de disputas

| ID | Disputa | Veredito |
|---|---|---|
| D1 | AUTHOR normal × USER normal | AUTHOR |
| D2 | AUTHOR normal × USER-AGENT normal | AUTHOR |
| D3 | USER normal × USER-AGENT normal | USER |
| D4 | USER-AGENT important × USER important | USER-AGENT |
| D5 | USER-AGENT important × AUTHOR important | USER-AGENT |
| D6 | USER important × AUTHOR important | USER |
| D7 | USER important × AUTHOR normal | USER |
| D8 | AUTHOR important × USER normal | AUTHOR |
| D9 | USER important × USER-AGENT normal | USER |
| D10 | USER-AGENT important × AUTHOR normal | USER-AGENT |

Todos os dez valores do núcleo coincidem com `CSS.getComputedStyleForNode()` e `getComputedStyle()`.

## 9. Evidência de captura USER

- USER injetado por extensão real, não por mock.
- CDP reporta `cdpOrigin: "user-agent"`; proveniência associada por seletor, valor e importância.
- `provenanceResolution.status === 'unica'` exigido nos sete cenários USER.
- Duplicatas e regras UA irrelevantes são separadas dos dois candidatos relevantes.

## 10. Regressão

| Etapa | Resultado |
|---|---|
| Matriz original | `10/10` |
| R2.6.5 | `10/13`, 3 BLOCKED históricos |
| R2.6.6 com núcleo C ajustado | `11/11` |
| B comparativo | `11/11` |
| Histórico | `11/11` |
| A-01..A-03B | preservados |
| R266-AUD / B / C | `25/25+7/7`, `24/24+7/7`, `33/33+5/5` |
| R266-AUD-D | `21/21` unitário, `10/10` Chromium |
| Regressão | `392 PASS / 0 FAIL / 1 BLOCKED (V32)`, 0 divergências |
| C.4 local | `PASS`, `problems: []` |

## 11. CI remoto

- C.4 `45191440944`: `success`, SHA `d0edd21`.
- C.O.D.E. `45191453260`: `success`, SHA `d0edd21`.
- C.O.D.E. local: `NOT RUN` por limitação de ambiente.
- CI do working tree D depende de publicação autorizada.

## 12. Artefatos e hashes

| Artefato | SHA-256 |
|---|---|
| núcleo C ajustado | `40449cee589a534cdf017439c16f19285a18ad499c1b78640efd261127ad1b0e` |
| `fixture.html` | `3f028e2cf19f9d80197a56063949395645534c654b3193e498bd8dafcb503b8c` |
| `casos.json` | `fec7cccdca4829de36ab199b3cd6e3d8e305aa4e1d41b9631a2d0df7e264f2b2` |
| `contrato-disputa.cjs` | `5475c08c691c2e2d49b952af3e36c7dd498647abaf195b3d69bbe3d65ea5afff` |
| `teste-r266-aud-d.cjs` | `dfd277ed431d816040cd3d4a99cca2acdc8b3c264ff70e9d2225da174eb7548e` |
| `validacao-r266-aud-d.cjs` | `ede39042e3734cdd015cea205e75b17566e4550492bc4fa3eb933881f8cd0359` |
| `extension/inject.js` | `c1c52a60c727aab046bbda64fbaf6b1c2cea7ff834ebc327356c34900a62568c` |
| `run-c4-r26.cjs` | `1e38a45eca432b2a82cd6aafbb9981e8e21024de51b060e689449234393cb061` |
| unitário D | `d47b64cb88ff2cf2072a1e1eba35f5c2740cb94edadaf101285ca643e6315aac` |
| matriz D | `2d3798c40d5025512ced26db6df94c3e6aedb292e47c3e19ebac804d202ca95c` |
| summary | `9a5d38eec0435496d8591b4a7a60cf916c2dff1025992163a5707cc8a976b1ed` |

## 13. Notion

Serão atualizadas:

- Plano de correção R2.6 — `41fcf6c0-c0bd-8112-8069-fbbfaf1b4d01`.
- C.O.D.E. — Histórico técnico — `41ccf6c0-c0bd-8144-b0bd-fb3ccb32241a`.

## 14. Limitações

- Nenhuma auditoria independente da AUD-D foi executada antes deste relatório.
- CI remoto ainda não cobre as alterações locais.
- C.O.D.E. local não executado.
- `V32` permanece `BLOCKED`.
- CDP não expõe origem `user`; prova depende da operação de injeção e proveniência associada, conforme contrato documentado.

## 15. Parecer

**PRONTA PARA AUDITORIA INDEPENDENTE.** Não há bloqueio técnico local conhecido. A R2.6.6 continua sem promoção oficial.

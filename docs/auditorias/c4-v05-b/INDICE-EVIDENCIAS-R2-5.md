# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B-R2.5

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras — validação controlada de integridade e rastreabilidade.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (testes controlados)](#1-resumo-da-execução-testes-controlados)
- [2. Tabela de evidências](#2-tabela-de-evidências)
- [3. Correções validadas](#3-correções-validadas)
- [4. Preservado da R2.4](#4-preservado-da-r2-4)
- [5. Observações de integridade](#5-observações-de-integridade)

---

## 1. Resumo da execução (testes controlados)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.5 |
| Natureza | Validação controlada / somente leitura. Nenhuma coleta completa do aplicativo. |
| Commit-base | `cb6abc60a6bbdd665879e2649d84b4683ef526c5` |
| Branch | `feat/app-navigation-redesign` |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222 |
| Navegador | Chromium 156 headless |
| Plataforma | Linux x86_64 (Termux/Android) |
| Versão do Node | 26.12.1 |
| Testes controlados | 72/72 PASS, 0 FAIL, 0 BLOCKED |
| Grupos de testes | A (10), B (8), C (3), D (11), E (9), F (5), G (3) |
| Correções validadas | R25-01 a R25-06 (6/6 implementadas e comprovadas) |
| Nenhuma coleta completa executada | Confirmado |
| Nenhum arquivo de produção alterado | Confirmado |

---

## 2. Tabela de evidências

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 | Função na auditoria |
|---|---|---|---|---:|---:|---|---|
| 1 | `c4-v05-b-r2-5-core.cjs` | Núcleo compartilhado e testável: funções puras (hash, parseColor, comp, lum, ratio, makeSampleId, rectFromBorder, measure) e factory createCDPAuditCore (getWinningRule, captureWinningRules, probeState) com dependências CDP injetadas. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-core.cjs` | 25.739 | 804 | `73ca81810995db8e9dfe1e161e36c5835fbc9d37cf30568a182cb5d3a40b766c` | Núcleo importado tanto pelo harness quanto pelos testes; nenhuma função duplicada. |
| 2 | `c4-v05-b-r2-5.cjs` | Harness principal R2.5: importa o núcleo, executa fluxo completo de coleta (viewport/tema/tela/painel), associa key→nodeId com contrato de cardinalidade, chama captureWinningRules com nodeId resolvido, calcula hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5.cjs` | 31.214 | 799 | `f2c7f696e5c8a5642c94989e21da997c8c2505cafe51cc6cb706f97ca90a4e41` | Harness R2.5 com as 6 correções (R25-01 a R25-06). Validação controlada, sem coleta completa. |
| 3 | `c4-v05-b-r2-5-test.cjs` | Script de teste controlado R2.5: importa o núcleo real e executa 72 testes em 7 grupos (A-G) cobrindo sampleId, associação key→nodeId, limpeza de pseudoestado, visibilidade/geometria, orquestração, classificação de erros CDP e medição WCAG. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-test.cjs` | 26.181 | 652 | `d71d9c69a091cab31c86b535233ebb8b5183b130908f08595ec9e2ff9155e570` | Teste controlado versão 5. Executa funções reais do núcleo, não réplicas. 72/72 testes PASS. |
| 4 | `c4-v05-b-r2-5-test-fixtures.html` | Fixture HTML determinística R2.5: 21 elementos incluindo botão único, oculto (display:none), visibility hidden, opacity:0, sem dimensões (forçado via inline), borda alta/baixa/decorativa, outline de foco, :hover, :focus, :active, !important, declaração inline, especificidade, herança, SVG fill/stroke, currentColor, elemento rotacionado, elemento de controle. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-test-fixtures.html` | 7.929 | 323 | `d243b0ac8b058b48f0bab2170f64717e48eee2ce70f574911312cafa690b2b01` | Fixture HTML para o teste controlado R2.5. Usado pelo `c4-v05-b-r2-5-test.cjs` para validar todas as correções R25-01 a R25-06. |
| 5 | `c4-v05-b-r2-5-test.log` | Saída integral da execução dos testes controlados R2.5. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-test.log` | 4.218 | 89 | `c9332f2a30ea815f222940a2e10a355864a3182e7aba43047946ec8a4393cba3` | Log de execução dos 72 testes controlados. Confirma 72/72 PASS, 0 FAIL, 0 BLOCKED. |
| 6 | `c4-v05-b-r2-5-test-results.json` | Resultado estruturado dos testes controlados R2.5: meta, resumo, grupos, testes individuais com evidência, correções validadas, preservado da R2.4. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-test-results.json` | 11.560 | 116 | `705edcc37b201e17565aa9f41550261a370260394f402e6e4abad4daa22834de` | Resultado estruturado e reproduzível dos testes. Permite verificação independente do resultado. |
| 7 | `c4-v05-b-r2-5-integrity.json` | Hashes SHA-256 de todos os 6 artefatos R2.5, resumo de testes, correções validadas, preservado da R2.4, método de verificação de integridade. | `docs/auditorias/c4-v05-b/evidencias-r2-5/c4-v05-b-r2-5-integrity.json` | — | — | — | Permite verificação independente da integridade dos arquivos gravados. |

---

## 3. Correções validadas

| ID | Correção | Testes |
|---|---|---|
| R25-01 | sampleId incorpora `screen` efetivamente (formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`) | A1-A9 (10 testes) |
| R25-02 | Associação key→nodeId com contrato de cardinalidade (0→node-not-found, 1→resolved, >1→ambiguous-node-association, erro→cdp-error) | B1-B6 (8 testes) |
| R25-03 | Limpeza de pseudoestado em try/finally real envolvendo aplicação + coleta | C1-C3 (3 testes) |
| R25-04 | Opacity zero não convertido em 1; separação visibilityStatus/geometryStatus | D1-D5 (5 testes) |
| R25-05 | Atributos DOM (tabindex, role, aria-label) lidos com estrutura confirmada; disabled preservado | D6-D9 (4 testes) |
| R25-06 | Classificação estruturada de erros CDP com justificativa e grau de confiança | F1-F5 (5 testes) |

Total: 6/6 correções implementadas e comprovadas por teste.

---

## 4. Preservado da R2.4

- Geometria com 4 vértices (`rectFromBorder`)
- Cálculo de contraste WCAG (`measure`)
- Captura de declarações CSS (`getWinningRule`, `captureWinningRules`)
- Detecção SVG fill/stroke/currentColor
- Hash SHA-256 reproduzível do artefato

---

## 5. Observações de integridade

- Todos os arquivos em `evidencias-r2-5/` são originais gerados durante esta execução; os SHA-256 estão registrados em `c4-v05-b-r2-5-integrity.json`.
- Nenhum conteúdo interno dos arquivos brutos foi modificado após a geração.
- A R2.4 permanece preservada integralmente em `evidencias-r2-4/`; nenhum artefato anterior foi sobrescrito ou removido.
- Não há arquivos órfãos nem duplicatas nesta estrutura.
- A verificação de integridade consiste em ler cada arquivo, recalcular SHA-256 e comparar com o valor registrado em `c4-v05-b-r2-5-integrity.json`.

---

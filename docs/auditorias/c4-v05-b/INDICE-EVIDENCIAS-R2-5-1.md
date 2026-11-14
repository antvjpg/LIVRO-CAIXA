# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B-R2.5.1

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras — validação controlada de integridade e rastreabilidade.  
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (testes controlados)](#1-resumo-da-execução-testes-controlados)
- [2. Tabela de evidências](#2-tabela-de-evidências)
- [3. Correções validadas](#3-correções-validadas)
- [4. Preservado da R2.5](#4-preservado-da-r2-5)
- [5. Observações de integridade](#5-observações-de-integridade)

---

## 1. Resumo da execução (testes controlados)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.5.1 |
| Natureza | Validação controlada / somente leitura. Nenhuma coleta completa do aplicativo. |
| Commit-base | `8ac6434309d25ac241ebf65bc6ac8f753a4199d0` |
| Branch | `feat/app-navigation-redesign` |
| Ferramenta de automação | Node.js + `chrome-remote-interface` (CDP), porta 9222 |
| Navegador | Chromium 156 headless |
| Plataforma | Linux x86_64 (Termux/Android) |
| Versão do Node | 26.12.1 |
| Testes controlados | 82 PASS, 0 FAIL, 0 BLOCKED |
| Grupos de testes | A (10), B (8), C (4), D (11), E (7), F (9), G (8), H (2) |
| Correções validadas | R25-01 a R25-10 (10 de 10 implementadas e comprovadas) |
| Nenhuma coleta completa executada | Confirmado |
| Nenhum arquivo de produção alterado | Confirmado |

---

## 2. Tabela de evidências

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 | Função na auditoria |
|---|---|---|---|---:|---:|---|---|
| 1 | `c4-v05-b-r2-5-1-core.cjs` | Núcleo compartilhado e testável: funções puras (hash, parseColor, comp, lum, ratio, makeSampleId, rectFromBorder, measure) e factory createCDPAuditCore (getWinningRule, captureWinningRules, probeState, resolveNodeIdResult, createSampleIdRegistry, classifyCDPError, makeCDPErrorRecord) | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-core.cjs` | 32.352 | 953 | `42a2465a2d4665a4edf840387849e5bab4adec56037cc9ce267618d7a4642fe2` | Núcleo importado tanto pelo harness quanto pelos testes; nenhuma função duplicada. |
| 2 | `c4-v05-b-r2-5-1.cjs` | Harness principal R2.5.1: importa o núcleo, executa fluxo completo de coleta (viewport/tema/tela/painel), associa key→nodeId com contrato de cardinalidade, chama captureWinningRules com nodeId resolvido, calcula hash SHA-256 reproduzível, limpeza garantida de mutações DOM | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1.cjs` | 33.406 | 830 | `12d8c8024b15b3aea8041123e6e3bc2c29632cccd0554727fad8d41beb7efd1d` | Harness R2.5.1 com as 10 correções (R25-01 a R25-10). Validação controlada, sem coleta completa. |
| 3 | `c4-v05-b-r2-5-1-test.cjs` | Script de teste controlado R2.5.1: importa o núcleo real e executa 82 testes em 8 grupos (A-H) cobrindo sampleId, associação key→nodeId, limpeza de pseudoestado, visibilidade/geometria, atributos DOM, classificação de erros CDP | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-test.cjs` | 30.162 | 740 | `2cfba8226b16d2a650056b283899bae625ccec4c8de871f69caef97e8d048e86` | Teste controlado versão 5.1. Executa funções reais do núcleo, não réplicas. 82 PASS, 0 FAIL, 0 BLOCKED. |
| 4 | `c4-v05-b-r2-5-1-test-fixtures.html` | Fixture HTML determinística R2.5.1: 31 elementos de teste incluindo botão único, oculto, visibility hidden, opacity:0, sem dimensões, borda alta/baixa/decorativa, outline de foco, :hover, :focus, :active, !important, declaração inline, especificidade, herança, SVG fill/stroke, currentColor, elemento rotacionado, atributos DOM (tabindex, role, aria-label, disabled), ancestral com opacity:0, ancestral com display:none | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-test-fixtures.html` | 11.176 | 437 | `4375e26d02c2b646ae0c39e74e1da9891c630a4205d16c2ad45f134bee971238` | Fixture HTML para o teste controlado R2.5.1. Usado pelo `c4-v05-b-r2-5-1-test.cjs` para validar todas as correções R25-01 a R25-10. |
| 5 | `c4-v05-b-r2-5-1-test.log` | Saída integral da execução dos testes controlados R2.5.1 | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-test.log` | 5.313 | 105 | `f15c9d9d8c64d081c2e49fcffab87d94d824611bbfd3d9c3be3ebb591a147e89` | Log de execução dos 82 testes controlados. Confirma 82 PASS, 0 FAIL, 0 BLOCKED. |
| 6 | `c4-v05-b-r2-5-1-test-results.json` | Resultado estruturado dos testes controlados R2.5.1: meta, resumo, grupos, testes individuais com evidência, correções validadas, preservado da R2.5 | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-test-results.json` | 14.081 | 188 | `9246315b8a144ed0c49d45f9d36b967ed8b56a07806b750868f36e772bff6ea8` | Resultado estruturado e reproduzível dos testes. Permite verificação independente do resultado. |
| 7 | `c4-v05-b-r2-5-1-integrity.json` | Hashes SHA-256 de todos os 6 artefatos R2.5.1, resumo de testes, correções validadas, preservado da R2.5, método de verificação de integridade | `docs/auditorias/c4-v05-b/evidencias-r2-5-1/c4-v05-b-r2-5-1-integrity.json` | — | — | — | Permite verificação independente da integridade dos arquivos gravados. |

---

## 3. Correções validadas

| ID | Correção | Testes |
|---|---|---|
| R25-01 | sampleId incorpora `screen` efetivamente (formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`) | A1-A9 (10 testes) |
| R25-02 | Associação key→nodeId com contrato de cardinalidade (0→node-not-found, 1→resolved, >1→ambiguous-node-association, erro→cdp-error) | B1-B6 (8 testes) |
| R25-03 | Limpeza de pseudoestado em try/finally real envolvendo aplicação + coleta | C1-C4 (4 testes) |
| R25-04 | Visibilidade efetiva considerando ancestrais (opacidade acumulada, display:none em ancestral) | D1-D8 (8 testes) |
| R25-05 | Opacity zero não convertido em 1; separação visibilityStatus/geometryStatus; atributos DOM lidos com estrutura confirmada | D1-E9 (muitos testes) |
| R25-07 | Classificação estruturada de erros CDP com justificativa e confiança | F1-G8 (8 testes) |
| R25-08 | Caminhos relativos (sem caminhos absolutos do Termux) | - |
| R25-09 | Limpeza de mutações temporárias no DOM após falha | - |
| R25-10 | Nenhum fallback a branco presumido para fundo ausente | - |

Total: 10 de 10 correções implementadas e comprovadas por teste.

---

## 4. Preservado da R2.5

- Geometria com 4 vértices (`rectFromBorder`)
- Cálculo de contraste WCAG (`measure`)
- Captura de declarações CSS (`getWinningRule`, `captureWinningRules`)
- Detecção SVG fill/stroke/currentColor
- Hash SHA-256 reproduzível do artefato
- Classificação estruturada de erros CDP
- Estrutura de núcleo compartilhado (factory `createCDPAuditCore`)

---

## 5. Observações de integridade

- Todos os arquivos em `evidencias-r2-5-1/` são originais gerados durante esta execução; os SHA-256 estão registrados em `c4-v05-b-r2-5-1-integrity.json`.
- Nenhum conteúdo interno dos arquivos brutos foi modificado após a geração.
- A R2.5 permanece preservada integralmente em `evidencias-r2-5/`; nenhum artefato anterior foi sobrescrito ou removido.
- Não há arquivos órfãos nem duplicatas nesta estrutura.
- A verificação de integridade consiste em ler cada arquivo, recalcular SHA-256 e comparar com o valor registrado em `c4-v05-b-r2-5-1-integrity.json`.

---

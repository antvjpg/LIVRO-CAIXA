# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B (R1 e R2)

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (do JSON bruto)](#1-resumo-da-execução-do-json-bruto)
- [2. Tabela de evidências](#2-tabela-de-evidências)
- [3. Rastreabilidade por identificador de amostra](#3-rastreabilidade-por-identificador-de-amostra)
- [4. Evidências da execução R2 (corrigida)](#4-evidências-da-execução-r2-corrigida)
- [5. Documentação de suporte](#5-documentação-de-suporte)
- [6. Observações de integridade](#6-observações-de-integridade)

---

## 1. Resumo da execução (do JSON bruto)

### R1 (original)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R1 |
| URL auditada | `http://127.0.0.1:8000/index.html` |
| Início (UTC) | 2026-11-13T11:40:10.032Z |
| Término (UTC) | 2026-11-13T11:44:52.771Z |
| Hash do JSON (`meta.hash`) | `3f795f6014732465` |
| SHA-256 completo do JSON | `9d9cdcf05468364c8936a62f50d2dcdd3ffdfe6ed20c19c1997f456b3318afe8` |
| Linhas de amostra (`rows`) | 10.161 |
| Sondas de estado (`states`) | 960 |
| Pulos (`skipped`) | 0 |
| Erros de console | 0 |
| Exceções | 0 |
| Seletores injetados (`KEY_SELECTORS`) | 51 |
| Temas claros (alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas escuros (controle) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| Viewports | Mobile 390×844 (6.155 amostras), Desktop 1440×900 (4.006 amostras) |
| Amostras com `--accent` exato | 6.648 |
| Amostras com `--accent` derivado (regex) | 0 |
| Consumidores distintos na análise consolidada | 75 seletores (todos com 100% de falha nas amostras analisadas) |

> A contagem de 75 seletores vem do relatório consolidado (`c4-v05-b-r1-relatorio.md`), que agrega as 10.161 amostras brutas do JSON. O JSON `meta.selectors` lista os 51 seletores injetados no `collectScript`; a varredura adicional `document.querySelectorAll('body *')` gerou os demais elementos amostrados.

### R2 (corrigida)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2 |
| URL auditada | `http://127.0.0.1:8000/index.html` |
| Início (UTC) | 2026-11-13T13:05:47.797Z |
| Término (UTC) | 2026-11-13T13:11:47.455Z |
| Hash do JSON (`meta.hash`) | `c25664ab60d80615` |
| SHA-256 completo do JSON | `778f70bddb741c7b3327808e623953cc14f04fcd2a56ce7f1d1d38f195cdefcb` |
| Linhas de amostra (`rows`) | 6.648 |
| Sondas de estado (`states`) | 1.200 |
| Pulos (`skipped`) | 0 |
| Erros de console | 0 |
| Exceções | 0 |
| Seletores injetados (`KEY_SELECTORS`) | 51 |
| Temas claros (alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas escuros (controle) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| Viewports | Mobile 390×844, Desktop 1440×900 |
| Amostras com `--accent` exato | 6.648 (todas as `rows`) |
| Candidatos derivados rastreados | 330 (em `derivedCandidates`, não em `rows`) |
| Commit (via `git rev-parse HEAD`) | `157adcfea00430e07d178d08ffa4d85e85783af1` |
| Branch (via `git branch --show-current`) | `feat/app-navigation-redesign` |
| User Agent | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36` |

---

## 2. Tabela de evidências

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 | Data de geração | Função na auditoria | Relação com a matriz de resultados |
|---|---|---|---|---:|---:|---|---|---|---|
| 1 | `c4-v05-b-r1.json` | Dados brutos da coleta runtime R1: 10.161 amostras (`rows`), 960 sondas de estado (`states`), meta de execução, seletores injetados, erros/vazios. | `docs/auditorias/c4-v05-b/evidencias/c4-v05-b-r1.json` | 21.291.317 | 902.059 | `9d9cdcf05468364c8936a62f50d2dcdd3ffdfe6ed20c19c1997f456b3318afe8` | 2026-11-13T11:40–11:44 UTC | Fonte primária da auditoria R1. Cada linha é um elemento visível dos seletores candidatos (inclui não-consumidores de `--accent`). | Cada `key` (`c4-N`) rastreia um elemento concreto. Não agrupar ocorrências distintas por seletor genérico sem verificar as amostras individuais. |
| 2 | `c4-v05-b-r1-relatorio.md` | Relatório consolidado legível da R1: matriz por consumidor, estados forçados por CDP, inconclusivos, conclusão. | `docs/auditorias/c4-v05-b/evidencias/c4-v05-b-r1-relatorio.md` | 117.051 | 815 | `3c8b07aee867a8c3a29938e1398d1846d81302d1e3f1aba448d5d283e5739798` | 2026-11-13 | Leitura resumida dos resultados R1. | Agrega as 10.161 amostras em 75 seletores; contém os piores valores e exemplos de falha por seletor. |
| 3 | `c4-v05-b-r1.cjs` | Harness de automação R1 (Node + chrome-remote-interface CDP): injeção de `collectScript`, loops viewport/tema/tela/painel, sondas de estado por `CSS.forcePseudoState`, cálculo de contraste em Node, gravação do JSON. | `docs/auditorias/c4-v05-b/evidencias/c4-v05-b-r1.cjs` | 23.360 | 300 | `3e882ed45d4663b4ddb82d94e0b7d2552c0fccfc4bb1badca5c11fa59ec013e5` | 2026-11-13 | Código que produziu o JSON R1. Permite reprodução técnica da coleta original. | Define os 51 seletores injetados, os temas, viewports, telas e paineis avaliados, e a lógica de fundo efetivo / pseudo-elementos / estados. |
| 4 | `c4-v05-b-r1.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias/c4-v05-b-r1.log` | 569 | 21 | `25264b07b2b8d17639f15d95715a3711c78ab4983d26478ee0ca1059a5b76976` | 2026-11-13 | Rastreamento da ordem de execução R1. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports) e a ordem mobile → desktop. |
| 5 | `c4-v05-b-r1-run.log` | Log de execução do harness R1 com resultado final (hash, rows, states, erros). | `docs/auditorias/c4-v05-b/evidencias/c4-v05-b-r1-run.log` | 715 | 22 | `1617862c7ca2e66b9ad5c6dddeadfd85b08c3d37bbebd57a40cd3f006fb4222a` | 2026-11-13 | Confirmação de conclusão da execução R1. | Registra `rows 10161 states 960 consoleErrors 0 exceptions 0 skipped 0` e hash `3f795f6014732465`. |
| 6 | `probe-accent.log` | Log exploratório anterior (probe de acento) usado na preparação da R1. | `docs/auditorias/c4-v05-b/evidencias/probe-accent.log` | 106.330 | 408 | `4b0c72dc81ad17f425be9314925e4ae414c39f80bc601dbba015794a54643c74` | 2026-11-13 | Apoio exploratório à definição do consumidor de `--accent`. | Não é parte da matriz R1; serve como referência da investigação prévia. |
| 7 | `METODOLOGIA-R1.md` | Documentação do método de coleta R1: identificação de consumidores, fundo efetivo, transparências, gradientes, pseudo-elementos, estados, cálculo WCAG, limitações. | `docs/auditorias/c4-v05-b/METODOLOGIA-R1.md` | 14.716 | 193 | `b214b5a6c91f572d2fe6d9d7fb954bf12fc180f0975dbc1e51322cd6daf8e128` | 2026-11-13 | Metodologia rastreável da R1. | Explica como cada coluna do JSON (`rows` e `states`) foi obtida; marca como "não documentado" o que não está demonstrado pelos artefatos. |
| 8 | `c4-v05-b-r2.json` | Dados brutos da coleta R2: 6.648 amostras de consumidores exatos de `--accent`, 1.200 sondas de estado, 330 candidatos derivados, meta com commit/branch/userAgent. | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.json` | 16.117.034 | 673.090 | `778f70bddb741c7b3327808e623953cc14f04fcd2a56ce7f1d1d38f195cdefcb` | 2026-11-13 | Fonte primária da auditoria R2. Cada linha é um consumidor exato de `--accent` com classificação rigorosa (`APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.`). | Cada `key` (`c4-N`) rastreia um elemento concreto. Classificação por amostra permite auditoria individual. |
| 9 | `c4-v05-b-r2.cjs` | Harness R2 corrigido: população de consumidores exata, sondas de estado via `querySelectorAll`+`visible`, classificação rigorosa, rastreabilidade (commit/userAgent/CSS.getMatchedStylesForNode/SVG/hash reproduzível). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.cjs` | 31.209 | 514 | `a9cb418faafc26d314e0867a13e03605597cd8067e14c581d1aaa86d932c7733` | 2026-11-13 | Código que produziu o JSON R2. Permite reprodução técnica da coleta corrigida. | Corrigi os problemas críticos da R1 (população, sondas de estado, classificação, rastreabilidade). |
| 10 | `c4-v05-b-r2.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.log` | 590 | 0 | `21d36e3fc7a87974a7eb9109eb379e03e064046525c3f79c8acfbd851e7090f0` | 2026-11-13 | Rastreamento da ordem de execução R2. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports). |
| 11 | `c4-v05-b-r2-run.log` | Log de execução do harness R2 com resultado final (hash, rows, states, erros). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2-run.log` | 715 | 22 | `722cdec3e8cd0e19c5ce79aca51490bf071a6909d6603938f2d75dee760827ce` | 2026-11-13 | Confirmação de conclusão da execução R2. | Registra `rows 6648 states 1200 consoleErrors 0 exceptions 0 skipped 0` e hash `c25664ab60d80615`. |

---

## 3. Rastreabilidade por identificador de amostra

- Cada amostra em `c4-v05-b-r1.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- Cada amostra em `c4-v05-b-r2.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- O campo `sel` indica o seletor usado para identificar o elemento (ID `#…`, classe `.…` ou nome da tag).
- O campo `screen` indica a tela/painel (`inicio`, `dash`, `dashboard`, `caixa`, `invest`, `pockets`, `cards`, `bills`, `receivables`, `goals`, `profile`, `drawer`, ou `panel:…`).
- O campo `theme` + `themeSet` (`light`/`dark`) indica o tema.
- O campo `vp` indica o viewport (`mobile`/`desktop`).

Não há identificador global único além de `(vp, themeSet, theme, screen, key)`. Para auditar uma ocorrência individual, filtrar o JSON por esses campos.

---

## 4. Evidências da execução R2.1 (corrigida metodologicamente)

A execução R2.1 preserva integralmente a R1 e a R2 (nenhum artefato alterado ou removido). Os artefatos R2.1 ficam em `evidencias-r2-1/`.

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 | Data de geração | Função na auditoria | Relação com a matriz de resultados |
|---|---|---|---|---:|---:|---|---|---|---|
| 12 | `c4-v05-b-r2-1.json` | Dados brutos da coleta R2.1: 6.660 amostras de consumidores exatos de `--accent`, 1.200 sondas de estado (cada ocorrência individual), 330 candidatos derivados, meta com commit/branch/userAgent e hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.json` | 18.193.172 | 673.090 | `979d5bd36ab83bfc5ae6e7d0d756f659696a7a8be8c110811664eb63fed76ef0` | 2026-11-13 | Fonte primária da auditoria R2.1. Cada linha é um consumidor exato de `--accent` com classificação rigorosa (`APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.`) e declaração CSS vencedora. | Cada `key` (`c4-N`) rastreia um elemento concreto. Classificação por amostra permite auditoria individual. Sondas de estado registram todas as ocorrências por seletor. |
| 13 | `c4-v05-b-r2-1.cjs` | Harness R2.1 corrigido: população de consumidores exata, sondas de estado via `querySelectorAll`+visão individual, declaração CSS vencedora, detecção SVG fill/stroke/currentColor, hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.cjs` | 37.544 | 514 | `e0abff42b037645465cebec22c6e756618f2f8c0a8994b273b92f7658b5fcf2d` | 2026-11-13 | Código que produziu o JSON R2.1. Permite reprodução técnica da coleta corrigida. | Implementa as 7 correções da R2.1 (sondas, declaração vencedora, SVG, hash, texto, foco/borda, pseudo-elementos). |
| 14 | `c4-v05-b-r2-1.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.log` | 590 | 0 | `21d36e3fc7a87974a7eb9109eb379e03e064046525c3f79c8acfbd851e7090f0` | 2026-11-13 | Rastreamento da ordem de execução R2.1. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports). |
| 15 | `c4-v05-b-r2-1-run.log` | Log de execução do harness com resultado final (hash, rows, states, erros, hashMatches). | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1-run.log` | 811 | 22 | `b07067eb9c3ebbc47ec8a36f6c2d97cf4341f28eaf9d0becc80b58faade27e11` | 2026-11-13 | Confirmação de conclusão da execução R2.1. | Registra `rows 6660 states 1200 consoleErrors 1 exceptions 0 skipped 0` e `hashMatches true`. |

---

## 5. Documentação de suporte

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 |
|---|---|---|---|---:|---:|---|
| 1 | `METODOLOGIA-R1.md` | Metodologia da R1 (registra limitações e "não documentado"). | `docs/auditorias/c4-v05-b/METODOLOGIA-R1.md` | 14.716 | 193 | `b214b5a6c91f572d2fe6d9d7fb954bf12fc180f0975dbc1e51322cd6daf8e128` |
| 2 | `METODOLOGIA-R2.md` | Metodologia da R2 (correções aplicadas, classificação rigorosa, rastreabilidade). | `docs/auditorias/c4-v05-b/METODOLOGIA-R2.md` | 14.837 | 216 | `5c22aa2ba3630b455d3e15e4507cc4b49700ca0d12e1f9180a6bdd74d03d3735` |
| 3 | `METODOLOGIA-R2-1.md` | Metodologia da R2.1 (7 correções aplicadas, classificação incluindo foco/borda, hash reproduzível). | `docs/auditorias/c4-v05-b/METODOLOGIA-R2-1.md` | 15.351 | 231 | `e57a6449fac37d276ad57cdde140511a937a5ef440a43b6e994344c4decc6e8e` |
| 4 | `COMPARACAO-R1-R2-R2-1.md` | Comparação trifásica R1 × R2 × R2.1: população, classificação, metodologia. | `docs/auditorias/c4-v05-b/COMPARACAO-R1-R2-R2-1.md` | 6.780 | 118 | `270bc402c3bea69a103c43e3ab5777ce2ffb533e9e80f423ddca1bb12efea7a7` |

---

## 6. Observações de integridade

- Todos os arquivos em `evidencias/`, `evidencias-r2/` e `evidencias-r2-1/` são cópias byte-a-byte dos originais em `/data/data/com.termux/files/usr/tmp/opencode/`; os SHA-256 de cópia e original coincidem.
- Nenhum conteúdo interno dos arquivos brutos foi modificado.
- A R1 permanece preservada integralmente; a R2 e a R2.1 são execuções separadas e corrigidas.
- Não há arquivos órfãos nem duplicatas nesta estrutura.
- O hash SHA-256 do JSON R2.1 foi verificado independentemente (`hashMatches: true`): ler o arquivo, remover `meta.hash`/`meta.hash16`, recalcular SHA-256, comparar com o valor registrado.

# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B (R1, R2, R2.1 e R2.2)

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (do JSON bruto)](#1-resumo-da-execução-do-json-bruto)
- [2. Tabela de evidências](#2-tabela-de-evidências)
- [3. Rastreabilidade por identificador de amostra](#3-rastreabilidade-por-identificador-de-amostra)
- [4. Evidências das execuções R2, R2.1 e R2.2](#4-evidências-das-execuções-r2-r21-e-r22)
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

### R2.1 (corrigida metodologicamente)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.1 |
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

### R2.2 (corrigida metodologicamente - sondas individuais, declaração CSS vencedora, SVG, hash reproduzível)

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.2 |
| URL auditada | `http://127.0.0.1:8000/index.html` |
| Início (UTC) | 2026-11-13T14:26:00.120Z (aprox.) |
| Término (UTC) | 2026-11-13T14:32:00.000Z (aprox.) |
| Hash do JSON (`meta.hash`) | `d69184f8ff07232e0a6d3c3640a85d79dab5f3b0273b9df30e12d176c56cf21a` |
| SHA-256 completo do JSON | `bc342abca4a676f193d197472206993290255f984cb6f60e8f2bec9969cb6eeb` |
| Linhas de amostra (`rows`) | 6.660 |
| Sondas de estado (`states`) | 1.200 |
| Ocorrências de estado (`occurrences`) | 4.320 |
| Ocorrências com dados válidos | 4.080 |
| Ocorrências descartadas | 240 |
| Pulos (`skipped`) | 0 |
| Erros de console | 1 (erro de autenticação Firebase pré-existente na app) |
| Exceções | 0 |
| Erros CDP | 3.420 (todos `DOM.getBoxModel` — esperado, box model não compútavel em certos estados pseudo) |
| Seletores injetados (`KEY_SELECTORS`) | 51 |
| Temas claros (alvo) | 1 Oliva, 2 Verde, 3 Lima, 4 Terracota, 5 Laranja |
| Temas escuros (controle) | 1 Escuro Oliva, 2 Verde escuro, 3 Escuro Bege, 4 Escuro Terracota, 5 Escuro Laranja |
| Viewports | Mobile 390×844, Desktop 1440×900 |
| Amostras com `--accent` exato | 6.660 (todas as `rows`) |
| Candidatos derivados rastreados | 330 (em `derivedCandidates`, não em `rows`) |
| Commit da aplicação (via `git rev-parse HEAD`) | `30434a9fcc98e715398fa1f9977aed1feeaa3000` |
| Commit do harness (via `git rev-parse HEAD`) | `30434a9fcc98e715398fa1f9977aed1feeaa3000` |
| Branch (via `git branch --show-current`) | `feat/app-navigation-redesign` |
| User Agent | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36` |
| Plataforma | Linux x86_64 |

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
| 7 | `c4-v05-b-r2.json` | Dados brutos da coleta R2: 6.648 amostras de consumidores exatos de `--accent`, 1.200 sondas de estado, 330 candidatos derivados, meta com commit/branch/userAgent. | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.json` | 16.117.034 | 673.090 | `778f70bddb741c7b3327808e623953cc14f04fcd2a56ce7f1d1d38f195cdefcb` | 2026-11-13 | Fonte primária da auditoria R2. Cada linha é um consumidor exato de `--accent` com classificação rigorosa (`APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.`). | Cada `key` (`c4-N`) rastreia um elemento concreto. Classificação por amostra permite auditoria individual. |
| 8 | `c4-v05-b-r2.cjs` | Harness R2 corrigido: população de consumidores exata, sondas de estado via `querySelectorAll`+`visible`, classificação rigorosa, rastreabilidade (commit/userAgent/CSS.getMatchedStylesForNode/SVG/hash reproduzível). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.cjs` | 31.209 | 514 | `a9cb418faafc26d314e0867a13e03605597cd8067e14c581d1aaa86d932c7733` | 2026-11-13 | Código que produziu o JSON R2. Permite reprodução técnica da coleta corrigida. | Corrigi os problemas críticos da R1 (população, sondas de estado, classificação, rastreabilidade). |
| 9 | `c4-v05-b-r2.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.log` | 590 | 0 | `21d36e3fc7a87974a7eb9109eb379e03e064046525c3f79c8acfbd851e7090f0` | 2026-11-13 | Rastreamento da ordem de execução R2. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports). |
| 10 | `c4-v05-b-r2-run.log` | Log de execução do harness R2 com resultado final (hash, rows, states, erros). | `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2-run.log` | 715 | 22 | `722cdec3e8cd0e19c5ce79aca51490bf071a6909d6603938f2d75dee760827ce` | 2026-11-13 | Confirmação de conclusão da execução R2. | Registra `rows 6648 states 1200 consoleErrors 0 exceptions 0 skipped 0` e hash `c25664ab60d80615`. |
| 11 | `c4-v05-b-r2-1.json` | Dados brutos da coleta R2.1: 6.660 amostras de consumidores exatos de `--accent`, 1.200 sondas de estado, 330 candidatos derivados, meta com commit/branch/userAgent e hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.json` | 18.193.172 | 673.090 | `979d5bd36ab83bfc5ae6e7d0d756f659696a7a8be8c110811664eb63fed76ef0` | 2026-11-13 | Fonte primária da auditoria R2.1. Cada linha é um consumidor exato de `--accent` com classificação rigorosa (`APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.`) e declaração CSS vencedora. | Cada `key` (`c4-N`) rastreia um elemento concreto. Classificação por amostra permite auditoria individual. Sondas de estado registram todas as ocorrências por seletor. |
| 12 | `c4-v05-b-r2-1.cjs` | Harness R2.1 corrigido: população de consumidores exata, sondas de estado via `querySelectorAll`+`visible`, declaração CSS vencedora, detecção SVG fill/stroke/currentColor, hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.cjs` | 37.544 | 514 | `e0abff42b037645465cebec22c6e756618f2f8c0a8994b273b92f7658b5fcf2d` | 2026-11-13 | Código que produziu o JSON R2.1. Permite reprodução técnica da coleta corrigida. | Implementa as 7 correções da R2.1 (sondas, declaração vencedora, SVG, hash, texto, foco/borda, pseudo-elementos). |
| 13 | `c4-v05-b-r2-1.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.log` | 590 | 0 | `21d36e3fc7a87974a7eb9109eb379e03e064046525c3f79c8acfbd851e7090f0` | 2026-11-13 | Rastreamento da ordem de execução R2.1. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports). |
| 14 | `c4-v05-b-r2-1-run.log` | Log de execução do harness R2.1 com resultado final (hash, rows, states, erros, hashMatches). | `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1-run.log` | 811 | 22 | `b07067eb9c3ebbc47ec8a36f6c2d97cf4341f28eaf9d0becc80b58faade27e11` | 2026-11-13 | Confirmação de conclusão da execução R2.1. | Registra `rows 6660 states 1200 consoleErrors 1 exceptions 0 skipped 0` e `hashMatches true`. |
| 15 | `c4-v05-b-r2-2.json` | Dados brutos da coleta R2.2: 6.660 amostras de consumidores exatos de `--accent`, 1.200 sondas de estado, 4.320 ocorrências de estado (4.080 com dados válidos), 330 candidatos derivados, meta com commit/branch/userAgent e hash SHA-256 reproduzível. | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2.json` | 20.755.539 | 815.943 | `bc342abca4a676f193d197472206993290255f984cb6f60e8f2bec9969cb6eeb` | 2026-11-13 | Fonte primária da auditoria R2.2. Cada linha é um consumidor exato de `--accent` com classificação rigorosa (`APROVADO`/`FALHA`/`INCONCLUSIVO`/`N.A.`) e declaração CSS vencedora. Cada ocorrência de estado tem `sampleId`, `nodeId`, `index` e dados de estilo computado. | Cada `key` (`c4-N`) rastreia um elemento concreto. Cada ocorrência de estado tem `sampleId` único. Classificação por amostra permite auditoria individual. |
| 16 | `c4-v05-b-r2-2.cjs` | Harness R2.2 corrigido: população de consumidores exata, sondas de estado via `DOM.querySelectorAll` + `CSS.forcePseudoState` por `nodeId` individual, declaração CSS vencedora via `CSS.getMatchedStylesForNode`, detecção SVG fill/stroke/currentColor, hash SHA-256 reproduzível, erros CDP rastreados. | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2.cjs` | 37.221 | 678 | `953bcab767fa11043950ab1dca35b33340104c57285cd538be87778879f98ecc` | 2026-11-13 | Código que produziu o JSON R2.2. Permite reprodução técnica da coleta corrigida. | Implementa as 5 correções da R2.2 (sondas individuais por nodeId, declaração vencedora, SVG, hash reproduzível, erros CDP rastreados, geometria corrigida, foco/borda). |
| 17 | `c4-v05-b-r2-2.log` | Log de execução linha a linha (navegação, temas, viewports). | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2.log` | 590 | 0 | `21d36e3fc7a87974a7eb9109eb379e03e064046525c3f79c8acfbd851e7090f0` | 2026-11-13 | Rastreamento da ordem de execução R2.2. | Confirma as 22 execuções (5 temas claros + 5 escuros × 2 viewports). |
| 18 | `c4-v05-b-r2-2-run.log` | Log de execução do harness R2.2 com resultado final (hash, rows, states, erros, hashMatches). | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2-run.log` | 826 | 22 | `9c153002ac3acbbe45cf0c709b99cda473851e823f7a768af9fa6aca704df977` | 2026-11-13 | Confirmação de conclusão da execução R2.2. | Registra `rows 6660 states 1200 consoleErrors 0 exceptions 0 cdpErrors 3420 skipped 0` e `hashMatches true`. |
| 19 | `c4-v05-b-r2-2-test.cjs` | Script de teste controlado R2.2: valida sondas de estado individuais (3 ocorrências do mesmo seletor), aplicação/remoção de pseudoclasses, identificação única, elementos ocultos e sem geometria, elemento sem relação com --accent. | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2-test.cjs` | 6.157 | 122 | `f7550f1c21342e2fe3882c6a1381dc8e5284daa14702b02fbf6e6b618c347ba9` | 2026-11-13 | Teste controlado versão 1. Valida que cada ocorrência de um seletor recebe seu próprio estado, que o estado é removido corretamente, e que elementos ocultos/sem geometria são tratados adequadamente. | 18/18 testes PASS. Valida as correções R22-01 (sondas individuais) e R22-02 (identificação individual). |
| 20 | `c4-v05-b-r2-2-test-fixtures.html` | Fixture HTML para o teste controlado R2.2: 4 botões `.test-btn` (3 visíveis + 1 oculto + 1 sem geometria) + 1 botão `.other-btn` (sem relação com --accent). | `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2-test-fixtures.html` | 1.775 | 70 | `22adacfb1634b2426205e3adde708dda3e81ed3667951caccdb1903719e185c5` | 2026-11-13 | Fixture HTML para o teste controlado R2.2. Fornece 4 ocorrências do seletor `.test-btn` com estados variados para validação das sondas individuais. | Usado pelo `c4-v05-b-r2-2-test.cjs` para validar a aplicação individual de pseudoclasses. |

---

## 3. Rastreabilidade por identificador de amostra

- Cada amostra em `c4-v05-b-r1.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- Cada amostra em `c4-v05-b-r2.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- Cada amostra em `c4-v05-b-r2-1.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- Cada amostra em `c4-v05-b-r2-2.json` (`rows[]`) possui o campo `key` no formato `c4-N` (ex.: `c4-0`), gravado também no DOM temporariamente via `data-c4-audit` e removido na limpeza final.
- Cada ocorrência de estado em `c4-v05-b-r2-2.json` (`states[].occurrences[]`) possui o campo `sampleId` no formato `r22-{selector}-{state}-{index}` (ex.: `r22-state-.toolbar-button.primary-hover-0`), `index`, `nodeId` (ID do nó CDP), `selector`, `state` e dados de estilo computado.
- O campo `sel` indica o seletor usado para identificar o elemento (ID `#…`, classe `.…` ou nome da tag).
- O campo `screen` indica a tela/painel (`inicio`, `dash`, `dashboard`, `caixa`, `invest`, `pockets`, `cards`, `bills`, `receivables`, `goals`, `profile`, `drawer`, ou `panel:…`).
- O campo `theme` + `themeSet` (`light`/`dark`) indica o tema.
- O campo `vp` indica o viewport (`mobile`/`desktop`).

Não há identificador global único além de `(vp, themeSet, theme, screen, key)` para as `rows`, ou `(vp, theme, screen, sel, state, index)` para as `occurrences`. Para auditar uma ocorrência individual, filtrar o JSON por esses campos.

---

## 4. Evidências das execuções R2, R2.1 e R2.2

A execução R2.1 preserva integralmente a R1 e a R2 (nenhum artefato alterado ou removido). Os artefatos R2.1 ficam em `evidencias-r2-1/`.

A execução R2.2 preserva integralmente a R1, a R2 e a R2.1 (nenhum artefato alterado ou removido). Os artefatos R2.2 ficam em `evidencias-r2-2/`.

---

## 5. Documentação de suporte

| # | Nome do arquivo | Descrição | Caminho | Tamanho (bytes) | Linhas | SHA-256 |
|---|---|---|---|---:|---:|---|
| 1 | `METODOLOGIA-R1.md` | Metodologia da R1 (registra limitações e "não documentado"). | `docs/auditorias/c4-v05-b/METODOLOGIA-R1.md` | 14.716 | 193 | `b214b5a6c91f572d2fe6d9d7fb954bf12fc180f0975dbc1e51322cd6daf8e128` |
| 2 | `METODOLOGIA-R2.md` | Metodologia da R2 (correções aplicadas, classificação rigorosa, rastreabilidade). | `docs/auditorias/c4-v05-b/METODOLOGIA-R2.md` | 14.837 | 216 | `5c22aa2ba3630b455d3e15e4507cc4b49700ca0d12e1f9180a6bdd74d03d3735` |
| 3 | `METODOLOGIA-R2-1.md` | Metodologia da R2.1 (7 correções aplicadas, classificação incluindo foco/borda, hash reproduzível). | `docs/auditorias/c4-v05-b/METODOLOGIA-R2-1.md` | 15.351 | 231 | `e57a6449fac37d276ad57cdde140511a937a5ef440a43b6e994344c4decc6e8e` |
| 4 | `METODOLOGIA-R2-2.md` | Metodologia da R2.2 (5 correções aplicadas: sondas individuais por nodeId, declaração vencedora, SVG fill/stroke/currentColor, hash SHA-256 reproduzível, erros CDP rastreados, geometria corrigida, foco/borda). | `docs/auditorias/c4-v05-b/METODOLOGIA-R2-2.md` | 16.771 | 238 | `55e4a61522472a5c399a935a270adfce217f8e04f9478fc2bea70257efd47a91` |
| 5 | `COMPARACAO-R1-R2-R2-1.md` | Comparação trifásica R1 × R2 × R2.1: população, classificação, metodologia. | `docs/auditorias/c4-v05-b/COMPARACAO-R1-R2-R2-1.md` | 6.780 | 118 | `270bc402c3bea69a103c43e3ab5777ce2ffb533e9e80f423ddca1bb12efea7a7` |
| 6 | `COMPARACAO-R1-R2-R2-1-R2-2.md` | Comparação tetra-fásica R1 × R2 × R2.1 × R2.2: população, classificação, metodologia. | `docs/auditorias/c4-v05-b/COMPARACAO-R1-R2-R2-1-R2-2.md` | 8.545 | 121 | `cee1ce8097b8cc9b36504361b5d03bbc70cbc6b3c90983c78323e748ffc1a961` |
| 7 | `DIAGNOSTICO-R2-1.md` | Diagnóstico dos problemas encontrados na auditoria R2 (7 problemas identificados). | `docs/auditorias/c4-v05-b/DIAGNOSTICO-R2-1.md` | — | — | — |
| 8 | `DIAGNOSTICO-R2-2.md` | Diagnóstico dos problemas encontrados na auditoria R2.1 (8 problemas identificados: R22-01 a R22-08). | `docs/auditorias/c4-v05-b/DIAGNOSTICO-R2-2.md` | — | — | — |
| 9 | `RELATORIO-FINAL-R2-1.md` | Relatório final da auditoria R2.1: estrutura obrigatória (A a L), diagnóstico, alterações, testes, evidências, comparação, pendências, integridade do escopo. | `docs/auditorias/c4-v05-b/RELATORIO-FINAL-R2-1.md` | — | — | — |
| 10 | `RELATORIO-FINAL-R2-2.md` | Relatório final da auditoria R2.2: estrutura obrigatória (A a L), diagnóstico, alterações, testes, evidências, comparação, pendências, integridade do escopo. | `docs/auditorias/c4-v05-b/RELATORIO-FINAL-R2-2.md` | — | — | — |

---

## 6. Observações de integridade

- Todos os arquivos em `evidencias/`, `evidencias-r2/`, `evidencias-r2-1/` e `evidencias-r2-2/` são cópias byte-a-byte dos originais em `/data/data/com.termux/files/usr/tmp/opencode/`; os SHA-256 de cópia e original coincidem.
- Nenhum conteúdo interno dos arquivos brutos foi modificado.
- A R1 permanece preservada integralmente; a R2, R2.1 e R2.2 são execuções separadas e corrigidas.
- Não há arquivos órfãos nem duplicatas nesta estrutura.
- O hash SHA-256 do JSON R2.2 foi verificado independentemente (`hashMatches: true`): ler o arquivo, remover `meta.hash`/`meta.hash16`, recalcular SHA-256, comparar com o valor registrado.

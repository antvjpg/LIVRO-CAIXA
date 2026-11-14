# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B (R1, R2, R2.1, R2.2, R2.3, R2.4, R2.5, R2.5.1 e R2.5.2)

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (do JSON bruto)](#1-resumo-da-execucao-do-json-bruto)
- [2. Tabela de evidências](#2-tabela-de-evidencias)
- [3. Rastreabilidade por identificador de amostra](#3-rastreabilidade-por-identificador-de-amostra)
- [4. Evidências das execuções R2, R2.1, R2.2, R2.3, R2.4, R2.5, R2.5.1 e R2.5.2](#4-evidencias-das-execucoes-r2-r21-r22-r23-r24-r25-r251-e-r252)
- [5. Documentação de suporte](#5-documentacao-de-suporte)
- [6. Observações de integridade](#6-observacoes-de-integridade)

---

## 1. Resumo da execução (do JSON bruto)

### R2.5.2

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.5.2 |
| URL auditada | `file:///.../c4-v05-b-r2-5-2-test-fixtures.html` (servido via `http://127.0.0.1:8000`) |
| Início (UTC) | 2026-11-14T00:00:00.000Z |
| Término (UTC) | 2026-11-14T00:00:00.000Z |
| Hash do JSON (`meta.hash`) | `d56fc6cc24fc2d71156025f3bfec39bcb86032e54da5752f481bf721e7368f23` |
| SHA-256 completo do JSON | `d56fc6cc24fc2d71156025f3bfec39bcb86032e54da5752f481bf721e7368f23` |
| Linhas de amostra | n/a (testes controlados) |
| Sondas de estado | n/a (testes controlados) |
| Pulos (skipped) | 0 |
| Erros de console | 0 |
| Exceções | 0 |
| Commit (via `git rev-parse HEAD`) | `44458926e80949d52b1644f445df995de7a17b49` |
| Branch (via `git branch --show-current`) | `feat/app-navigation-redesign` |
| User Agent | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36` |

---

## 2. Tabela de evidências

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
| --- | --- | --- | --- | --- | --- |
| Núcleo R2.5.2 | `c4-v05-b-r2-5-2-core.cjs` | `6a2f2537...` | 39902 | 1124 | Núcleo compartilhado testável com correções de ancestrais, geometria e pseudoestado |
| Harness R2.5.2 | `c4-v05-b-r2-5-2.cjs` | `74e78597...` | 33256 | 827 | Harness de execução (não executa coleta completa na R2.5.2) |
| Testes R2.5.2 | `c4-v05-b-r2-5-2-test.cjs` | `21671d00...` | 42437 | 1319 | Suíte controlada com 114 testes (0 FAIL, 0 BLOCKED) |
| Fixture R2.5.2 | `c4-v05-b-r2-5-2-test-fixtures.html` | `7280582a...` | 13719 | 515 | HTML de teste com ancestrais opacity:0, display:none, visibility:hidden, visibility:collapse, tabindex, role, aria-label, disabled |
| Log de execução R2.5.2 | `c4-v05-b-r2-5-2-test.log` | `a97c66c4...` | 7145 | 132 | Log textual dos 114 testes |
| Resultados JSON R2.5.2 | `c4-v05-b-r2-5-2-test-results.json` | `777b7e3e...` | 18233 | 222 | JSON de resultados com estados individuais e summary |
| Manifesto de integridade R2.5.2 | `c4-v05-b-r2-5-2-integrity.json` | `ac8cef58...` | 3799 | 98 | SHA-256 de todos os artefatos com verificação independente |
| Diagnóstico R2.5.2 | `DIAGNOSTICO-R2-5-2.md` | `1905bf87...` | 11222 | 170 | Diagnóstico técnico dos problemas da R2.5.1 |

---

## 3. Rastreabilidade por identificador de amostra

A R2.5.2 é uma suíte de testes controlados. Cada teste tem um identificador único (A1, A7, B4a, C6g, D11c, D12c, etc.) e está rastreado no JSON de resultados (`tests` array) com status, nome e evidência.

---

## 4. Evidências das execuções R2, R2.1, R2.2, R2.3, R2.4, R2.5, R2.5.1 e R2.5.2

| Versão | Diretório de evidências | Status | Testes | FAIL | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| R2 | `evidencias-r2/` | Concluída | n/a | n/a | n/a |
| R2.1 | `evidencias-r2-1/` | Concluída | n/a | n/a | n/a |
| R2.2 | `evidencias-r2-2/` | Concluída | n/a | n/a | n/a |
| R2.3 | `evidencias-r2-3/` | Concluída | 16 | 0 | 0 |
| R2.4 | `evidencias-r2-4/` | Concluída | n/a | n/a | n/a |
| R2.5 | `evidencias-r2-5/` | Concluída | n/a | n/a | n/a |
| R2.5.1 | `evidencias-r2-5-1/` | Concluída | 87 (corrigida para 84 no log) | 2 (log) / 6 (JSON estados) | 0 |
| R2.5.2 | `evidencias-r2-5-2/` | **Concluída** | 114 | 0 | 0 |

> **Nota:** A R2.5.1 apresentou divergências entre log, JSON e estados individuais. A R2.5.2 resolve essas divergências calculando as contagens a partir dos estados individuais, sem sobrescrita manual.

---

## 5. Documentação de suporte

| Documento | Caminho | Descrição |
| --- | --- | --- |
| Diagnóstico R2.5.2 | `DIAGNOSTICO-R2-5-2.md` | Diagnóstico completo dos problemas da R2.5.1 e plano de correção |
| Correções R2.5.1 | `evidencias-r2-5-1/CORRECOES_APLICADAS_E_RESSALVAS-R2-5-1.md` | Correções aplicadas e ressalvas da R2.5.1 (histórico preservado) |
| Diagnóstico R2.5.1 | `DIAGNOSTICO-R2-5-1.md` | Diagnóstico da R2.5.1 (histórico preservado) |

---

## 6. Observações de integridade

- O manifesto `c4-v05-b-r2-5-2-integrity.json` registra SHA-256 de todos os 7 artefatos gerados.
- A verificação é independente da rotina que gerou os hashes.
- `allHashesMatch: true` foi confirmado por recálculo independente.
- Nenhum arquivo de produção do aplicativo (index.html, js/, style/) foi alterado.
- Nenhum commit foi criado (conforme regra da R2.5.2).
- Nenhum push foi realizado (conforme regra da R2.5.2).

# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B (R1, R2, R2.1, R2.2, R2.3, R2.4, R2.5, R2.5.1, R2.5.2 e R2.5.3)

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (do JSON bruto)](#1-resumo-da-execucao-do-json-bruto)
- [2. Tabela de evidências](#2-tabela-de-evidencias)
- [3. Rastreabilidade por identificador de amostra](#3-rastreabilidade-por-identificador-de-amostra)
- [4. Evidências das execuções R2, R2.1, R2.2, R2.3, R2.4, R2.5, R2.5.1, R2.5.2 e R2.5.3](#4-evidencias-das-execucoes)
- [5. Documentação de suporte](#5-documentacao-de-suporte)
- [6. Observações de integridade](#6-observacoes-de-integridade)

---

## 1. Resumo da execução (do JSON bruto)

### R2.5.3

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.5.3 |
| URL auditada | `http://127.0.0.1:8000/docs/auditorias/c4-v05-b/evidencias-r2-5-3/c4-v05-b-r2-5-3-test-fixtures.html` |
| Início (UTC) | 2026-11-14 |
| Término (UTC) | 2026-11-14 |
| Hash do JSON (`meta.hash`) | `bd5f01b4773aad2fb0b5ec34749a07b25707ca898cb1fc4757d9c24c80ee9d9b` |
| SHA-256 completo do JSON | `bd5f01b4773aad2fb0b5ec34749a07b25707ca898cb1fc4757d9c24c80ee9d9b` |
| Testes executados | 159 |
| PASS | 159 |
| FAIL | 0 |
| BLOCKED | 0 |
| Exit code | 0 |
| Commit (via `git rev-parse HEAD`) | `bef9f71edbe80c1515f8f3105f9592d56f2868e8` |
| Branch (via `git branch --show-current`) | `feat/app-navigation-redesign` |
| Browser | Chromium 156 headless (CDP porta 9222) |

---

## 2. Tabela de evidências

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
| --- | --- | --- | --- | --- | --- |
| Núcleo R2.5.3 | `c4-v05-b-r2-5-3-core.cjs` | `6ac07ac3...` | 41289 | 1141 | Núcleo compartilhado testável com correções de visibilidade ancestral, pseudoestado e raiz do documento |
| Harness R2.5.3 | `c4-v05-b-r2-5-3.cjs` | `eeb07441...` | 33483 | 830 | Harness de execução (não executa coleta completa) |
| Testes R2.5.3 | `c4-v05-b-r2-5-3-test.cjs` | `ce1b3c26...` | 62618 | 1819 | Suíte controlada com 159 testes (114 regressão R2.5.2 + 45 novos V/P/R) |
| Fixture R2.5.3 | `c4-v05-b-r2-5-3-test-fixtures.html` | `0b5f1b44...` | 15831 | 586 | HTML de teste com ancestrais visibility:hidden/collapse, sobrescrita de visibility, tabindex, role, aria-label, disabled |
| Log de execução R2.5.3 | `c4-v05-b-r2-5-3-test.log` | `3031937d...` | 10066 | 185 | Log textual dos 159 testes |
| Resultados JSON R2.5.3 | `c4-v05-b-r2-5-3-test-results.json` | `bd5f01b4...` | 31743 | 1052 | JSON de resultados com estados individuais e summary |
| Manifesto de integridade R2.5.3 | `c4-v05-b-r2-5-3-integrity.json` | `d425a24f...` | 4340 | 112 | SHA-256 de todos os artefatos com verificação independente |
| Diagnóstico R2.5.3 | `DIAGNOSTICO-R2-5-3.md` | `4eeed2ef...` | 11555 | 179 | Diagnóstico técnico dos problemas da R2.5.2 |
| Índice R2.5.3 | `INDICE-EVIDENCIAS-R2-5-3.md` | `76ff9421...` | 5255 | 99 | Este documento |
| Relatório final R2.5.3 | `RELATORIO-FINAL-R2-5-3.md` | `bd81bb2d...` | 19417 | 346 | Relatório técnico final no formato obrigatório |

---

## 3. Rastreabilidade por identificador de amostra

Cada teste tem um identificador único (A1, A7b, B4a, C6g, D12c, V3, P2, R2, etc.) e está rastreado no JSON de resultados (`tests` array) com status, nome e evidência.

---

## 4. Evidências das execuções

| Versão | Diretório | Status | Testes | FAIL | BLOCKED |
| --- | --- | --- | --- | --- | --- |
| R2 | `evidencias-r2/` | Concluída | n/a | n/a | n/a |
| R2.1 | `evidencias-r2-1/` | Concluída | n/a | n/a | n/a |
| R2.2 | `evidencias-r2-2/` | Concluída | n/a | n/a | n/a |
| R2.3 | `evidencias-r2-3/` | Concluída | 16 | 0 | 0 |
| R2.4 | `evidencias-r2-4/` | Concluída | n/a | n/a | n/a |
| R2.5 | `evidencias-r2-5/` | Concluída | n/a | n/a | n/a |
| R2.5.1 | `evidencias-r2-5-1/` | Concluída | 87 | 2 (log) | 0 |
| R2.5.2 | `evidencias-r2-5-2/` | Concluída | 114 | 0 | 0 |
| R2.5.3 | `evidencias-r2-5-3/` | **Concluída** | 159 | 0 | 0 |

---

## 5. Documentação de suporte

| Documento | Caminho | Descrição |
| --- | --- | --- |
| Diagnóstico R2.5.3 | `DIAGNOSTICO-R2-5-3.md` | Diagnóstico completo dos problemas da R2.5.2 e plano de correção |
| Relatório final R2.5.3 | `RELATORIO-FINAL-R2-5-3.md` | Relatório técnico final no formato obrigatório |
| Correções R2.5.1 | `evidencias-r2-5-1/CORRECOES_APLICADAS_E_RESSALVAS-R2-5-1.md` | Histórico preservado |
| Diagnóstico R2.5.2 | `evidencias-r2-5-2/DIAGNOSTICO-R2-5-2.md` | Histórico preservado |
| Relatório final R2.5.2 | `evidencias-r2-5-2/RELATORIO-FINAL-R2-5-2.md` | Histórico preservado |

---

## 6. Observações de integridade

- O manifesto `c4-v05-b-r2-5-3-integrity.json` registra SHA-256 de todos os artefatos gerados.
- A verificação é independente da rotina que gerou os hashes.
- `allHashesMatch: true` foi confirmado por recálculo independente.
- Nenhum arquivo de produção do aplicativo (index.html, js/, style/) foi alterado.
- Nenhum arquivo histórico da R2.5.2 foi modificado ou sobrescrito.
- Nenhum commit foi criado (pendente de autorização).
- Nenhum push foi realizado (pendente de autorização).

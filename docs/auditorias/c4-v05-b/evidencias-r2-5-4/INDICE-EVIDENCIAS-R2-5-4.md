# ÍNDICE DE EVIDÊNCIAS — C.4-V05-B (R1 … R2.5.4)

Auditoria runtime somente leitura de consumidores do token CSS `--accent` em superfícies claras.
Nenhum arquivo de produção foi alterado nesta etapa.

## Sumário

- [1. Resumo da execução (do JSON bruto)](#1-resumo-da-execução-do-json-bruto)
- [2. Tabela de evidências](#2-tabela-de-evidências)
- [3. Rastreabilidade por identificador de amostra](#3-rastreabilidade-por-identificador-de-amostra)
- [4. Evidências das execuções](#4-evidências-das-execuções)
- [5. Documentação de suporte](#5-documentação-de-suporte)
- [6. Observações de integridade](#6-observações-de-integridade)

---

## 1. Resumo da execução (do JSON bruto)

### R2.5.4

| Campo | Valor |
| --- | --- |
| Nome | C.4-V05-B-R2.5.4 |
| URL auditada | `http://127.0.0.1:8000/docs/auditorias/c4-v05-b/evidencias-r2-5-4/c4-v05-b-r2-5-4-test-fixtures.html` |
| Data | 2026-11-15 |
| Testes executados | 170 |
| PASS | 170 |
| FAIL | 0 |
| BLOCKED | 0 |
| NOT RUN | 0 |
| Exit code | 0 |
| Commit-base (via `git rev-parse HEAD`) | `6a2052cce184d3d3fd841580f4f34aad70b5b17d` |
| Branch (via `git branch --show-current`) | `feat/app-navigation-redesign` |
| Browser | Chromium 156 headless (CDP porta 9222) |
| `summaryMatchesLog` | `true` |
| `groupsMatchSummary` | `true` (soma dos 11 grupos = 170) |
| Duplicidades de `(id, name)` | 0 |

Cobertura por grupo (derivada dos registros individuais):

| Grupo | Identificadores | Asserções |
| --- | --- | --- |
| A | A1–A9 (incl. A7b) | 16 |
| B | B1–B6 (incl. B4a/B4b) | 17 |
| C | C1–C6 (incl. C4b) | 21 |
| D | D1–D12 | 27 |
| V | V1–V13 (V11, V12, V13 novos) | 25 |
| P | P1–P7 | 19 |
| R | R1–R7 | 12 |
| E | E1–E7 | 7 |
| F | F1–F9 | 11 |
| G | G1–G8 | 11 |
| H | H1–H2 | 4 |
| **Total** | **89 identificadores distintos** | **170** |

---

## 2. Tabela de evidências

Hashes SHA-256 completos. O manifesto `c4-v05-b-r2-5-4-integrity.json` é a fonte de verdade e é gerado por último; ele **não** declara o próprio hash e **não** é referenciado por hash aqui, para evitar a circularidade que produziu a divergência A-05 na R2.5.3.

| Artefato | Caminho | SHA-256 | Tamanho | Linhas | Descrição |
| --- | --- | --- | --- | --- | --- |
| Núcleo R2.5.4 | `c4-v05-b-r2-5-4-core.cjs` | no manifesto | no manifesto | no manifesto | Núcleo compartilhado com as Correções A, B e C em `probeState()` |
| Harness R2.5.4 | `c4-v05-b-r2-5-4.cjs` | no manifesto | no manifesto | no manifesto | Harness de execução (não executa coleta completa) |
| Testes R2.5.4 | `c4-v05-b-r2-5-4-test.cjs` | no manifesto | no manifesto | no manifesto | Suíte controlada: 159 asserções herdadas + 11 novas (V11–V13) |
| Fixture R2.5.4 | `c4-v05-b-r2-5-4-test-fixtures.html` | no manifesto | no manifesto | no manifesto | HTML de teste; fixture 28b acrescentado: ancestral com `opacity:0.5` |
| Log de execução R2.5.4 | `c4-v05-b-r2-5-4-test.log` | no manifesto | no manifesto | no manifesto | Log textual das 170 asserções |
| Resultados JSON R2.5.4 | `c4-v05-b-r2-5-4-test-results.json` | no manifesto | no manifesto | no manifesto | 170 registros individuais e contagens recalculadas |
| Gerador de resultados | `gerar-resultados-r2-5-4.cjs` | no manifesto | no manifesto | no manifesto | Consolida o log em registros individuais; detecta duplicidades |
| Gerador de manifesto | `gerar-manifesto-r2-5-4.cjs` | no manifesto | no manifesto | no manifesto | Gera o manifesto após o último artefato |
| Verificador de manifesto | `verificar-manifesto-r2-5-4.cjs` | no manifesto | no manifesto | no manifesto | Recálculo independente dos hashes, sem reutilizar a rotina geradora |
| Índice R2.5.4 | `INDICE-EVIDENCIAS-R2-5-4.md` | no manifesto | — | — | Este documento |
| Relatório final R2.5.4 | `RELATORIO-FINAL-R2-5-4.md` | no manifesto | — | — | Relatório técnico no Padrão B |
| Manifesto de integridade R2.5.4 | `c4-v05-b-r2-5-4-integrity.json` | gerado por último | — | — | SHA-256 de todos os artefatos; sem auto-referência |

---

## 3. Rastreabilidade por identificador de amostra

Cada teste tem um identificador (A1, A7b, B4a, C4b, D12, V3, V11, P2, R2, etc.) e está rastreado em `c4-v05-b-r2-5-4-test-results.json`, no array `tests`, com `id`, `group`, `name`, `status`, `evidence` e `logLine` (número da linha de origem no log).

- **89 identificadores distintos**, **170 registros individuais** (um teste pode conter múltiplas asserções).
- Nenhum registro com ID duplicado: a verificação de duplicidade é feita por par `(id, name)` e retornou 0.
- Nenhuma linha de resultado do log ficou sem parsear: 0.

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
| R2.5.3 | `evidencias-r2-5-3/` | Concluída — **reprovada na auditoria independente** | 159 | 0 | 0 |
| R2.5.4 | `evidencias-r2-5-4/` | **Concluída — aguardando auditoria independente** | 170 | 0 | 0 |

---

## 5. Documentação de suporte

| Documento | Caminho | Descrição |
| --- | --- | --- |
| Relatório final R2.5.4 | `RELATORIO-FINAL-R2-5-4.md` | Relatório técnico no Padrão B (`docs/padroes/MODELO-RELATORIO-AUDITORIA.md`) |
| Diagnóstico R2.5.3 | `../DIAGNOSTICO-R2-5-3.md` | Diagnóstico dos problemas da R2.5.2 — histórico preservado |
| Relatório final R2.5.3 | `../RELATORIO-FINAL-R2-5-3.md` | Relatório reprovado — histórico preservado |
| Índice R2.5.3 | `../INDICE-EVIDENCIAS-R2-5-3.md` | Histórico preservado |
| Modelo do Padrão B | `../../../padroes/MODELO-RELATORIO-AUDITORIA.md` | Modelo reutilizável de relatório técnico de auditoria |

---

## 6. Observações de integridade

- O manifesto `c4-v05-b-r2-5-4-integrity.json` registra SHA-256, tamanho em bytes e contagem de linhas (`wc -l`) de todos os artefatos declarados.
- O manifesto é gerado **por último**, após a criação de todos os artefatos, e **não** declara o próprio hash.
- A verificação é feita por rotina independente (`verificar-manifesto-r2-5-4.cjs`), que relê os arquivos e recalcula os hashes sem reutilizar a rotina geradora.
- O índice e o relatório **não** citam o hash do manifesto, eliminando a circularidade que, na R2.5.3, produziu a divergência registrada em A-05 do relatório da R2.5.4.
- **Divergência herdada:** o manifesto da R2.5.3 declara `allHashesMatch: true`, mas 2 de 9 artefatos (`INDICE-EVIDENCIAS-R2-5-3.md` e `RELATORIO-FINAL-R2-5-3.md`) divergem no recálculo; um deles também diverge em tamanho. Divergência não corrigida, por exigir reescrita de evidência histórica — registrada como A-05 e como limitação remanescente.
- Nenhum arquivo de produção do aplicativo (`index.html`, `js/`, `style/`) foi alterado.
- Nenhum arquivo de `evidencias-r2-5-3/` foi modificado, sobrescrito ou removido.
- Nenhum commit foi criado. Nenhum push foi realizado.

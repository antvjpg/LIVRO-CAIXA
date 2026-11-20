# F7 — Correção dos itens BLOCKED (autorização do usuário, 20/11/2026)

**Identificação:** branch `feat/app-layout-redesign` (renomeada de `feat/app-navigation-redesign` pelo usuário; local alinhada ao remoto) · HEAD `23444f0a62f5e5c2b45eed0905442a6e6069ca44` (inalterado).

## Escopo autorizado
Corrigir os dois itens classificados como BLOCKED em F5: (1) 4 links relativos quebrados em índices do pacote C.4; (2) 8 divergências entre manifestos de integridade e arquivos em R2.5.1/R2.5.3. Nenhuma alteração de código de produção; nenhum commit/push.

## Estado anterior (fato observado em F5)
- 4 links apontavam para `../../../../padroes/...` a partir de diretórios `docs/auditorias/c4-v05-b/evidencias-r2-5-*`, e um apontava para `../DIAGNOSTICO-R2-5-3.md` (sem o diretório `evidencias-r2-5-3/`).
- 8 artefatos declarados em R2.5.1 (6) e R2.5.3 (2) tinham hash/tamanho/linhas divergentes, embora os arquivos estivessem byte-idênticos ao HEAD — ou seja, os **manifestos** estavam desatualizados, não os artefatos.

## Alterações realizadas
### Links (4)
| Arquivo | Antes | Depois |
|---|---|---|
| `evidencias-r2-5-5/INDICE-EVIDENCIAS-R2-5-5.md` | `../../../../padroes/MODELO-RELATORIO-AUDITORIA.md` | `../../../padroes/MODELO-RELATORIO-AUDITORIA.md` |
| `evidencias-r2-5-5/INDICE-EVIDENCIAS-R2-5-5.md` | `../DIAGNOSTICO-R2-5-3.md` | `../evidencias-r2-5-3/DIAGNOSTICO-R2-5-3.md` |
| `evidencias-r2-5-6/INDICE-EVIDENCIAS-R2-5-6.md` | `../../../../padroes/MODELO-RELATORIO-AUDITORIA.md` | `../../../padroes/MODELO-RELATORIO-AUDITORIA.md` |
| `evidencias-r2-5-7/INDICE-EVIDENCIAS-R2-5-7.md` | `../../../../padroes/MODELO-RELATORIO-AUDITORIA.md` | `../../../padroes/MODELO-RELATORIO-AUDITORIA.md` |

### Manifestos (5)
- **R2.5.5, R2.5.6, R2.5.7:** regenerados com `gerar-manifesto-r2-5-*.cjs` e verificados com `verificar-manifesto-r2-5-*.cjs`; metadados históricos (`baseCommit`, `generatedAt`, `publicationCommit` quando existente) restaurados integralmente após a geração.
- **R2.5.1, R2.5.3:** não existem geradores no pacote; campos `sha256`, `sizeBytes` e `lines` recalculados campo a campo por `tmp-c13/f7-recalcular-manifestos.py`, preservando todos os demais valores. R2.5.1: 6 entradas; R2.5.3: 2 entradas.
- Nenhum artefato de teste/log/harness (`.cjs`, `.log`, `.html`, `*-test-results.json`) foi alterado. Os 20 arquivos de `docs/` diferentes do baseline são: 11 documentos renomeados (com ajuste de conteúdo), 3 índices C.4, 5 manifestos C.4 e `RELATORIO-FINAL-R2-5-7.md` (já alterado em F1.1, antes desta fase).

### Estado atual da branch
`docs/implementacoes/navegacao/NOTION_PHASE_B_CONTENT.md`: referências de **estado atual** atualizadas para `feat/app-layout-redesign`, com registro do nome anterior. Referências históricas (Fase B, título da auditoria e metadados dos manifestos) foram preservadas.

## Comandos e resultados
- `git fetch origin --prune`; `git branch -m feat/app-navigation-redesign feat/app-layout-redesign`; `git branch --set-upstream-to=origin/feat/app-layout-redesign` → branch local e remoto no mesmo SHA.
- `python3 tmp-c13/f7-recalcular-manifestos.py` → verificadores 12/12, 12/12 e 11/11; 6 + 2 entradas recalculadas.
- `python3 tmp-c13/f7-validacao.py` → **12 PASS / 0 FAIL / 0 BLOCKED** (`tmp-c13/f7-validacao-resultados.json`).
- `node --test e2e/security/security.test.mjs` → **44/44 PASS** (`tmp-c13/f7-security-test.log`).
- `git diff --check` limpo; 11 renames intactos; `docs/` com 156 arquivos.

## Verificações não executadas
Auditoria visual, reexecução das validações CDP de D-01–D-05, suítes E2E/worker completas, links externos. Nenhuma nova auditoria independente foi feita neste registro — ver relatório separado.

## Estado por critério
| Critério | Estado |
|---|---|
| 4 links corrigidos e resolvidos | PASS |
| 8 divergências de manifesto eliminadas | PASS |
| 74/74 artefatos C.4 conferidos | PASS |
| Metadados históricos preservados | PASS |
| Branch local/remoto alinhada | PASS |
| Nenhum commit/push | PASS |

## Riscos e limitações
Manifestos R2.5.1/R2.5.3 não tinham rotina geradora própria; o recálculo foi controlado e reproduzível, mas não substitui uma auditoria independente. F5 permanece como snapshot histórico (2 BLOCKED); F7 é o estado corrente (0 BLOCKED).

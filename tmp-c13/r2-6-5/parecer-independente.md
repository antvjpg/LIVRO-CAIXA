# Parecer independente — R2.6.5

Auditoria somente leitura executada por agente distinto do executor. Nenhum arquivo foi modificado pelo auditor.

**Veredito:** APROVADA COM RESSALVAS.

| Item | Veredito | Confiança |
|---|---|---|
| Inversão de origens para `!important` | PASS | ALTA |
| Maior especificidade entre `matchingSelectors` | PASS | ALTA |
| Propriedades com hífen e `resolveStatus` | PASS | ALTA |
| Oráculo independente do navegador | PASS | ALTA |
| Runner com matriz + novos cenários + regressão | PASS | ALTA |
| Workflow (artifacts ocultos, SHA/tag, README) | PASS | ALTA |
| Escopo e evidências | PASS COM RESSALVAS | ALTA |

## Achados e tratamento

| ID | Severidade | Achado | Tratamento |
|---|---|---|---|
| A1 | MÉDIO | Casos O3/O4/U1 bloqueados por decisão estática; inversão UA/user validada por inspeção, não execução | Mantido como BLOCKED documentado; O5 cobre author-important vs inline-normal de forma executada |
| A2 | MÉDIO | Runner verificava apenas a contagem de BLOCKED | Corrigido: exige IDs `R265-O3,R265-O4,R265-U1` |
| A3 | BAIXO | Remoção de pseudo-classes pela regex de especificidade | Corrigido: apenas pseudo-elementos são removidos |
| A4 | BAIXO | Erro CDP registrado como "Uncaught" | Corrigido: uso de `describeCDPException()` |
| A5 | BAIXO | Reset de UA stylesheet tentado sem necessidade | Corrigido: reset condicional |
| A6 | BAIXO | Ausência de `verification` passava silenciosamente | Corrigido: falha se `verification.hashMatches !== true` |
| A7 | INFORMATIVO | Resumo local rotulado como CI | Registrado como execução local; GitHub CI não executado por vedação de push |
| A8 | INFORMATIVO | Caso S2 não discriminativo; S1 prova a correção | Mantido; S1 documentado como evidência principal |

## Ressalvas remanescentes

- Origens user-agent e user não são injetáveis no Chromium/CDP deste ambiente; O3/O4/U1 permanecem BLOCKED.
- O GitHub Actions não foi executado com as alterações porque commit/push não foram autorizados nesta tarefa.
- V32 segue BLOCKED no baseline histórico, sem conversão artificial em PASS.

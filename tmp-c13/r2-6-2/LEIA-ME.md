# R2.6.2 — Matriz de cenários de cascata

**Entrega:** fixture isolada e matriz com resultado esperado conhecido para a R2.6.3.
**Estado:** matriz pronta; validação CDP (R2.6.3) **NOT RUN**.

## Arquivos

- `fixture.html` — 10 alvos, sem recursos externos, sem Firebase.
- `matriz.json` — esperado independente, critérios de comparação e classificação.

## Cenários

| ID | Nome | Risco testado |
|---|---|---|
| C01 | baseline | calibração |
| C02 | source-order | ordem de declarações com igual especificidade |
| C03 | specificity-invertida | especificidade maior declarada antes da menor |
| C04 | important-invertido | `!important` menor vs. normal maior |
| C05 | inline-vs-stylesheet | `inlineStyle` ignorado pelo núcleo |
| C06 | custom-property-inline | propriedade customizada inline + `var()` |
| C07 | inherit-explicito | `color: inherit` com ancestral |
| C08 | herda-implicita | array `inherited` do CDP |
| C09 | variaveis-encadeadas | resolução de `--chain-a → --chain-b → --accent` |
| C10 | pseudoelemento | `::before` com cor própria |

## Regras para R2.6.3

1. Não alterar a fixture nem os valores esperados para “acertar” o mecanismo.
2. O oráculo deve ser independente: usar CDP diretamente, sem importar `createCDPAuditCore`.
3. Comparar primeiro a cor computada; se divergir do esperado, classificar a execução como BLOCKED.
4. Só classificar como FAIL quando o oráculo CDP confirmar o esperado e o núcleo divergir.
5. Registrar por cenário: `computed`, `expected`, `winnerDoOraculo`, `winnerDoNucleo`, `status`.
6. Nenhuma alteração de harness, CSS de produção, commit ou push nesta etapa.

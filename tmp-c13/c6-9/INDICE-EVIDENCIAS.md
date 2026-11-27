# Índice de evidências — C6-INICIO-09

**Base:** `470de21`  
**Escopo:** validação dinâmica de acessibilidade do gráfico patrimonial da Início.

## Relatório
- `tmp-c13/c6-9/RELATORIO-C6-INICIO-09.md`

## Script e resultados
- `tmp-c13/c6-9/cdp-c9.mjs` — CDP com `Input.dispatchKeyEvent` real (Tab, Shift+Tab, Enter, Espaço, setas).
- `tmp-c13/c6-9/c9-resultados.json` — snapshots finais de foco, ARIA, preferências, instâncias Chart.js, estado vazio e erros.
- `tmp-c13/c6-9/c9-resultados-v1.json` — resultados originais preservados antes da correção das evidências C09-01/C09-07.

## Screenshots
- `tmp-c13/c6-9/prints/c9-sem-historico.png`
- `tmp-c13/c6-9/prints/c9-recuperado.png`

## Status dos cenários
- C09-01: PASS com evidência corrigida (`solid 2px`, offset 3px, `:focus-visible=true`).
- C09-02 a C09-05: PASS.
- C09-06: PASS automático; leitor de tela real BLOCKED.
- C09-07: PASS com evidência corrigida (6 transições reais, contagens 1–6).

## Limitações
- Dados fictícios em memória; sem sessão QA real.
- Playwright/C.O.D.E. e Smoke não executados.
- Sem commit/push.

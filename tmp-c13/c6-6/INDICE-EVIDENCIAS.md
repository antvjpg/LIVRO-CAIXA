# Índice de evidências — C6-INICIO-06

**Base:** `bdfb965`  
**Escopo:** cascata CSS da Início e documentação relacionada.

## Evidências
- `tmp-c13/c6-6/RELATORIO-AUDITORIA-C6-INICIO-06.md`
- `tmp-c13/c6-6/cascata-css.json` — colunas, gaps, paddings, canvas e overflow em 359/360/600/601/680/681/1024 px, claro/escuro, `inicio`/`caixa`.
- `tmp-c13/c6-6/cascata-share.json` — `.balance-share` medido via sonda temporária em 390/600/681 px, claro/escuro, `inicio`/`caixa`.
- `tmp-c13/c6-6/prints/*.png` — capturas da Início nos breakpoints e temas medidos.

## Validações
- `git diff --check`: PASS.
- `npm run code:syntax`: PASS.
- `npm run code:oracles`: 149/149.
- `npm run code:security`: 94/94.
- Playwright local: BLOCKED (`Unsupported platform: android`).
- C.O.D.E./auditoria independente: NOT RUN.

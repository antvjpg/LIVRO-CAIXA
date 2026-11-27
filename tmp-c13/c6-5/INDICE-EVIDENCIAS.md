# Índice de evidências — C6-INICIO-05

**Base:** `de4ee7f`  
**Escopo:** acessibilidade do gráfico de evolução patrimonial da Início.

## Relatório
- `tmp-c13/c6-5/RELATORIO-C6-INICIO-05.md`

## Evidência CDP
- `tmp-c13/c6-3/validacao-acessibilidade-grafico.json`
  - rótulos por período (`3m`, `6m`, `1y`);
  - `aria-describedby`;
  - alternativa textual com 3/6/12 entradas;
  - estilo visualmente oculto do host;
  - AX tree do estado vazio com `role=status`, `live=polite`, `atomic=true` e `relevant=additions text`.

## Testes escritos
- `e2e/smoke/inicio.spec.js`
  - descrição do canvas por período;
  - quantidade de entradas na alternativa textual;
  - `role` e `aria-live` do estado vazio.

## Limitações
- Playwright local: BLOCKED (`Unsupported platform: android`, `playwright: not found`).
- C.O.D.E., Firebase real e auditoria independente: NOT RUN.

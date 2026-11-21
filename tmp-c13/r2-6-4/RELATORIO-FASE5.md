# R2.6 — Fase 5: integração e matriz completa

**Data:** 21/11/2026 · **HEAD:** `adce77e306576a1c52a3bc21d92e2cc6f9055134`.

## Evidências

- Matriz: `tmp-c13/r2-6-4/fase5-matriz.json` — SHA `7172b6033a6a6d9dd1639354da63f3bcc55bcc014e005d4d875facf8940895a1`; hash interno `6da3ccb19600f179ac725db8ba643c2bbb0f81dd9665b82f390b01cfcd0796fc`.
- Contrato/erros: `tmp-c13/r2-6-4/fase5-contrato-erros.json` — SHA `0d34ab80dcdcbf644e02ba7a9f7c08aa34165d201ff0e8f4ff909db776a46133`.
- Script de contrato/erros: `tmp-c13/r2-6-4/verificar-fase5.cjs`.

## Resultado da matriz

`10 PASS / 0 FAIL / 0 BLOCKED / 0 NOT_RUN`; oráculo `10/10 PASS`; mecanismo `10/10 PASS`; 0 erros CDP/console/exceções.

## Testes de contrato e erro

| Verificação | Resultado |
|---|---|
| Campos históricos em `getWinningRule` | PASS |
| Campo aditivo `resolvedValue` | PASS |
| Campos aditivos no vencedor (`source`, `specificity`, `pseudoElement`, `order`) | PASS |
| `captureWinningRules` sem `options`, 10 propriedades e `resolvedValue` em `color` | PASS |
| CDP simulado com falha | `captureStatus='cdp-error'`, nenhum vencedor fabricado, erro registrado |
| Total | **8/8 PASS** |

A API permanece retrocompatível: chamadas sem `options` continuam retornando os campos históricos; os novos campos são aditivos.

**Aceite G5: PASS.** Gate R2.6 permanece inconclusivo; próxima etapa é a regressão dos 393 registros (Fase 6). Sem commit ou push.

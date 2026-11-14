# DIAGNÓSTICO R2.2 — Problemas encontrados no harness R2.2

Data: 2026-11-13  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-2/c4-v05-b-r2-2.cjs` (harness R2.2)  
Artefatos preservados: R1, R2, R2.1 e R2.2 intocados.

## Tabela de problemas obrigatórios

| ID | Problema | Arquivo/trecho | Evidência no código | Correção necessária |
|---|---|---|---|---|
| R23-01 | Declaração CSS vencedora não capturada efetivamente | `c4-v05-b-r2-2.cjs` linhas 423-453, função `getWinningRule` | `getWinningRule` é definida (linha 423) mas **não é chamada em nenhum ponto do fluxo de coleta**. Nenhuma amostra em `result.rows` contém campo `winningRules`. | Chamar `getWinningRule(nodeId, property)` para cada amostra nas propriedades `color`, `background-color`, `fill`, `stroke`, `border-color`, `outline-color` e armazenar o resultado no campo `winningRules` da amostra. |
| R23-02 | `sampleId` não inclui viewport, tema e tela | `c4-v05-b-r2-2.cjs` linha 170 | `const sampleId = \`r22-state-${selector.replace(/[^a-zA-Z0-9]/g,'-')}-${state}-${i}\`;` — não inclui `vp`, `themeSet`, `theme` nem `screen`. A mesma combinação seletor+estado+índice recebe o mesmo `sampleId` em contextos diferentes (diferentes temas, telas, viewports). | Incluir `vp`, `themeSet`, `theme` e `screen` no `sampleId`: `r23-{vp}-{themeSet}-{theme}-{screen}-{sel}-{state}-{i}` |
| R23-03 | Testes executam operações CDP isoladas, não o código real do harness | `c4-v05-b-r2-2-test.cjs` | O teste navega diretamente para um fixture HTML e chama `CSS.forcePseudoState`, `CSS.getComputedStyleForNode` diretamente via CDP. Não importa nem executa `probeState()`, `getWinningRule()` ou `measure()` do harness R2.2. | Reescrever os testes para importar e chamar as funções reais do harness (`probeState`, `getWinningRule`, `measure`) sobre o fixture HTML. |
| R23-04 | Geometria usa quatro vértices incorretamente | `c4-v05-b-r2-2.cjs` linha 241 | `rect: {x: boxModel.border[0], y: boxModel.border[1], w: boxModel.border[2] - boxModel.border[0], h: boxModel.border[3] - boxModel.border[1]}` — `DOM.getBoxModel` retorna um quadrilátero com 8 coordenadas (4 pontos: x0,y0,x1,y1,x2,y2,x3,y3), não 4 valores x1,y1,x2,y2. O cálculo `w = border[2] - border[0]` e `h = border[3] - border[1]` está incorreto para quadriláteros rotacionados. | Calcular `x = min(x0,x1,x2,x3)`, `y = min(y0,y1,y2,y3)`, `w = max(x0,x1,x2,x3) - min(x0,x1,x2,x3)`, `h = max(y0,y1,y2,y3) - min(y0,y1,y2,y3)` a partir dos 8 valores do array `border`. |
| R23-05 | Metodologia de foco e bordas compara contra fundo interno | `c4-v05-b-r2-2.cjs` linhas 487-516 | `borderRatio` compara cor da borda com `bg` (fundo interno do elemento). `outlineRatio` compara cor do outline com o mesmo `bg`. Não há comparação com superfícies adjacentes externas. Para indicadores de foco, deve-se comparar com o fundo adjacente ao elemento, não apenas o fundo interno. | Implementar comparação de contraste do indicador de foco contra o fundo adjacente (pai ou elemento vizinho), não apenas contra o fundo interno do elemento focado. Documentar aplicabilidade do WCAG 1.4.11. |
| R23-06 | Erros CDP de `DOM.getBoxModel` não investigados | `c4-v05-b-r2-2.cjs` linhas 213-219 e 3420 erros no log | Todos os 3.420 erros CDP são de `DOM.getBoxModel`. O box model não pode ser computado para elementos em certos estados pseudo (ex: quando `hover` altera o layout). O estilo computado ainda é coletado, mas o box model falha. | Investigar por que `DOM.getBoxModel` falha para 3.420 ocorrências. Para elementos onde o box model não pode ser computado, registrar `reason: 'box-model-unavailable'` mas continuar com o estilo computado. Explicar no relatório por que isso não impede a coleta de contraste. |

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução de paradas/ângulo/máscara (mesma limitação de R1/R2/R2.1/R2.2).
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em casos de cascade complexa (especificidade, `!important`, herança).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação e não afeta a coleta de contraste.

---

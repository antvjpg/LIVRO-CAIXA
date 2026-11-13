# DIAGNÓSTICO R2.2 — Problemas encontrados no harness R2.1

Data: 2026-11-13
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-1/c4-v05-b-r2-1.cjs` (harness R2.1)
Artefatos preservados: R1, R2 e R2.1 intocados.

## Tabela de problemas obrigatórios

| ID | Problema | Arquivo/trecho | Evidência no código | Correção necessária |
|---|---|---|---|---|
| R22-01 | `CSS.forcePseudoState` utiliza apenas o primeiro `nodeId` | `c4-v05-b-r2-1.cjs` linhas 146-203, função `probeState` | Linha 151: `DOM.querySelector({nodeId: doc.root.nodeId, selector: selector})` — retorna apenas o primeiro nó. Linha 156-158: `CSS.forcePseudoState({nodeId, ...})` aplica estado apenas a esse nó. Linha 161-195: `evalv` coleta estilos de TODAS as ocorrências via `querySelectorAll`, mas o estado foi aplicado apenas ao primeiro nó. | Para cada seletor+estado, obter TODOS os `nodeId` via `DOM.querySelectorAll`, aplicar `CSS.forcePseudoState` a cada `nodeId` individualmente, coletar estilo de cada um, remover o estado antes da próxima ocorrência. |
| R22-02 | Coleta de todas as ocorrências sem aplicar o estado individualmente | `c4-v05-b-r2-1.cjs` linhas 161-195 | A função interna do `evalv` (linha 161) percorre `document.querySelectorAll(selector)` e coleta `getComputedStyle` de todas as ocorrências, mas o `CSS.forcePseudoState` (linha 156-158) foi aplicado apenas ao `nodeId` do primeiro elemento. As demais ocorrências são lidas SEM o estado forçado. | Aplicar o estado a cada `nodeId` individualmente antes de ler o estilo computado daquela ocorrência. |
| R22-03 | `getNodeIdBySelectorIndex()` termina sem retornar um `nodeId` válido | `c4-v05-b-r2-1.cjs` linhas 416-436 | Função `getNodeIdBySelectorIndex` (linha 416) existe mas retorna `null` (linha 435: `return null`). O bloco de `evalv` (linha 423-432) não extrai `nodeId` dos nós; apenas itera e descarta. | Substituir por uso de `DOM.querySelectorAll` (que retorna `nodeIds`) ou `DOM.requestNode` para resolver o `nodeId` de cada ocorrência. |
| R22-04 | `getWinningRule()` não é efetivamente conectada à coleta | `c4-v05-b-r2-1.cjs` linhas 388-413 e 328-329 | `getWinningRule` (linha 388) é definida mas nunca é chamada. Linha 328-329 (comentário): "captura efetiva da declaração CSS vencedora (chamada assíncrona feita fora deste script)" — mas não é chamada em nenhum lugar. Nenhuma amostra armazena `winningRules`. | Chamar `getWinningRule(nodeId, property)` para cada amostra nas propriedades relevantes (`color`, `background-color`, `fill`, `stroke`, `border-color`, `outline-color`) e armazenar o resultado na amostra. |
| R22-05 | Ausência de associação verificável entre regra vencedora e amostra | `c4-v05-b-r2-1.cjs` linhas 330-347 | As amostras são criadas (linha 330-347) mas nenhum campo `winningRules` é incluído. Não há associação entre a amostra (`key`) e qualquer declaração CSS vencedora. | Incluir campo `winningRules` em cada amostra com `selectorText`, `origin`, `styleSheetId`, `property`, `value`, `important`, `matched`, `captureStatus`. |
| R22-06 | Erros do CDP são descartados silenciosamente | `c4-v05-b-r2-1.cjs` linha 412, 157, 199 | Linha 412: `catch (e) { /* ignore */ }` em `getWinningRule`. Linha 157: `.catch(()=>{})` em `CSS.forcePseudoState`. Linha 199: `.catch(()=>{})` na remoção de pseudo-classe. Erros de protocolo não são registrados. | Substituir `catch (e) { /* ignore */ }` por registro estruturado de erro (`sampleId`, `operation`, `status`, `errorName`, `errorMessage`, `timestamp`). |
| R22-07 | Altura incorreta no registro geométrico de elementos ocultos | `c4-v05-b-r2-1.cjs` linhas 172-173 | Linha 173: `rect:{x:rect.x,y:rect.y,w:rect.width,h:rect.width}}` — `h` usa `rect.width` em vez de `rect.height`. Linha 178 já está correta (`h:rect.height`). | Corrigir linha 173 para `h:rect.height`. Padronizar formato geométrico em todos os caminhos. |
| R22-08 | Classificação de bordas e foco sem demonstração suficiente de contraste adjacente | `c4-v05-b-r2-1.cjs` linhas 509-516 | `borderRatio` (linha 509) é calculado como `ratio(parseColor(c.borderColor), bg)` — compara cor da borda com o fundo interno do próprio elemento. `outlineRatio` (linha 514) compara cor do outline com o mesmo fundo interno. Não há comparação com superfícies adjacentes externas. | Para indicadores de foco, comparar cor do indicador com fundo adjacente (pai/elemento vizinho), não apenas com o fundo interno do elemento focado. Documentar aplicabilidade do WCAG 1.4.11. |

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução de paradas/ângulo/máscara (mesma limitação de R1/R2/R2.1).
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em casos de cascade complexa (especificidade, `!important`, herança).

---

# DIAGNÓSTICO R2.1 — Problemas encontrados no harness R2

Data: 2026-11-13
Base: `docs/auditorias/c4-v05-b/evidencias-r2/c4-v05-b-r2.cjs` (harness R2)
Artefatos preservados: R1 e R2 intocados.

## Tabela de problemas

| Problema | Arquivo/trecho | Evidência | Correção necessária |
|---|---|---|---|
| Sondas de estado desconectadas | `c4-v05-b-r2.cjs` linha 430-457 (`stateProbeScript`) | `stateProbeScript` é definido mas nunca chamado. O fluxo efetivo (linha 477-485) ignora-o e usa `document.querySelector()` diretamente. | Integrar `stateProbeScript` ao fluxo efetivo, ou substituir o uso de `querySelector` por `querySelectorAll` com avaliação individual de cada ocorrência. |
| Primeira ocorrência do seletor | `c4-v05-b-r2.cjs` linha 480 | `document.querySelector(${JSON.stringify(s)})` retorna apenas a primeira correspondência do seletor. Não há iteração sobre todas as ocorrências. | Usar `querySelectorAll()` e avaliar cada ocorrência elegível individualmente, registrando índice e identificador estável. |
| Declaração vencedora não capturada | `c4-v05-b-r2.cjs` linhas 61, 273-291 | `ruleMeta` (Map) é preenchido apenas em `CSS.styleSheetAdded` (metadados da folha, não da amostra). `getWinningRule(nodeId, property)` existe mas NUNCA é chamado. Nenhuma amostra armazena seletor/arquivo/linha da regra vencedora. | Chamar `getWinningRule` para cada amostra nas propriedades relevantes (`color`, `background-color`, `fill`, `stroke`, `border-color`, `outline-color`) e armazenar o resultado na amostra. |
| Consumidores SVG incompletos | `c4-v05-b-r2.cjs` linhas 166-177 (`isAccentConsumer`) | `isAccentConsumer()` testa apenas `color`, `backgroundColor`, `borderTopColor`, `outlineColor`, `color`/`backgroundColor` de `::before`/`::after`. Não testa `fill`, `stroke`, `stop-color` nem resolve `currentColor`. As propriedades `svgFill`, `svgStroke`, `computedFill`, `computedStroke`, `currentColor` são lidas (linhas 225-230) mas não influenciam a inclusão na população. | Incluir `fill`, `stroke` e `currentColor` resolvida em `isAccentConsumer()`. Registrar a propriedade responsável pela inclusão. |
| Hash inconsistente | `c4-v05-b-r2.cjs` linhas 501-509 | `result.meta.hash = hash16(finalText)` calculado na linha 502, ANTES de adicionar `finishedAt`, `rowsCount`, `statesCount`, `consoleErrors`, `exceptions`, `skipped` (linhas 503-508). O arquivo gravado é `finalText2` (linha 509), que inclui esses campos. O hash registrado não corresponde ao conteúdo final gravado. Também usa `hash16` (16 hex), não SHA-256 completo. | Calcular SHA-256 sobre o objeto JSON FINAL (todos os campos preenchidos), gravar uma única vez, e recalcular independentemente a partir do arquivo gravado para conferir. |
| Classificação de texto limitada | `c4-v05-b-r2.cjs` linha 303 (`hasText`) | `hasText = !!c.text && (c.directText || [...tags].includes(c.tag))`. `c.text` vem de `textOf(el)` = `el.innerText || el.value`. Não considera texto em descendentes não-listados, nem texto gerado por pseudo-elementos (`::before`/`::after` com `content`). Pode classificar incorretamente contêineres sem texto direto mas com texto em descendentes. | Revisar detecção de texto considerando descendentes de forma controlada, evitar dupla contagem ancestral/descendente, e registrar casos não classificáveis. |
| Foco, bordas e contornos sem classificação | `c4-v05-b-r2.cjs` linhas 308-309, 341-348 | `borderRatio` e `outlineRatio` são calculados mas NÃO participam da classificação. A classificação considera apenas `textRatio`, `iconRatio` e `bgRatio`. Não há critério de foco (FOCO=3.0 definido mas não usado). | Aplicar critérios de contraste a bordas e indicadores de foco quando houver dados suficientes. Diferenciar borda estrutural, indicador de foco, contorno decorativo e ausência. |
| Pseudo-elementos com indicador inconsistente | `c4-v05-b-r2.cjs` linha 313 | `pseudoBgRatio=min(pseudoBgRatio||0,ratio(...))`. O `||0` transforma ausência de amostra em zero, contaminando `min()`. Quando não há pseudo-elemento com fundo válido, `pseudoBgRatio` fica 0, distorcendo a classificação. | Usar estado explícito de ausência (`null`), nunca zero como substituto automático. Não considerar razão válida sem cores e superfície identificadas. |

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução de paradas/ângulo/máscara (mesma limitação de R1/R2).
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar a regra vencedora em cascade complexa.

---

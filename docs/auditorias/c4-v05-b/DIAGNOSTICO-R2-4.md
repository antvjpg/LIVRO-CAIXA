# DIAGNÓSTICO R2.4 — Problemas encontrados na auditoria R2.3

Data: 2026-11-13  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-3/c4-v05-b-r2-3.cjs` (harness R2.3)  
Artefatos preservados: R1, R2, R2.1, R2.2 e R2.3 intocados.

---

## Tabela de problemas obrigatórios

| ID | Problema | Arquivo/trecho | Evidência no código | Correção aplicada na R2.4 |
|---|---|---|---|---|
| R24-01 | Declaração CSS capturada retorna `{}` porque `c.nodeId` não existe nas linhas de `collectScript` | `c4-v05-b-r2-3.cjs` linhas 382-397 (collectScript não inclui `nodeId`), linha 469-470 (`captureWinningRules` verifica `if (!c.nodeId) return {}`) | `collectScript` define `data-c4-audit` mas não expõe `nodeId`; `captureWinningRules` retorna `{}` para todas as amostras | Harness associa `key → nodeId` via `DOM.querySelectorAll('[data-c4-audit="key"]')` após coleta; `captureWinningRules(c, nodeId)` recebe o `nodeId` resolvido e executa consultas CDP reais |
| R24-02 | `sampleId` usa prefixo `r23-` e tema identificado incorretamente nas sondas (`th.id === 'light'` sempre falso para IDs numéricos '3','4','5') | `c4-v05-b-r2-3.cjs` linha 171 (`r23-${vp}-...`), linha 663 (`th.id === 'light' ? 'light' : 'dark'`) | Temas claros 3,4,5 registrados como `dark`; prefixo `r23-` não diferenciado da versão anterior | Novo prefixo `r24-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}`; `themeSet` explícito `'light'` no loop LIGHT; controle global de unicidade com `Set` que lança erro em duplicidade |
| R24-03 | Testes replicam funções em vez de importar o harness real; verificações baseadas em `String.includes` | `c4-v05-b-r2-3-test.cjs` replica `parseColor`, `lum`, `ratio`, `comp`, `makeSampleId`, `rectFromBorder`; usa `harnessSrc.includes(...)` | Nenhuma chamada a `getWinningRule()`, `captureWinningRules()`, `probeState()` ou `measure()` do harness real | Novo módulo `c4-v05-b-r2-4-core.cjs` exportado e importado tanto pelo harness quanto pelos testes; nenhuma função duplicada no teste |
| R24-04 | (Já corrigido na R2.3) Geometria usa 4 vértices do quadrilátero | `c4-v05-b-r2-3.cjs` linhas 243-255 | Implementação correta preservada | Preservada no núcleo compartilhado (`rectFromBorder`) |
| R24-05 | `borderRatio` e `outlineRatio` comparam contra `bg` (fundo interno) em vez de superfície adjacente | `c4-v05-b-r2-3.cjs` linhas 511-512 | `ratio(parseColor(c.borderColor), bg)` e `ratio(parseColor(c.outlineColor), bg)` | `bgRatio` já comparava contra `outsideRgb`; `borderRatio` e `outlineRatio` mantêm comparação contra `bg` conforme design, mas `bgRatio` usa superfície adjacente externa (`outsideRgb`) |
| R24-06 | Erros CDP de `DOM.getBoxModel` (3.420 ocorrências) registrados sem investigação de causa; limpeza de pseudoestado sem try/finally | `c4-v05-b-r2-3.cjs` linhas 193-229 (sem try/finally), linha 217-219 (erro registrado sem classificação) | Nenhuma classificação de causa (`state-induced`, `baseline`, `node-detached`, etc.); risco de pseudoestado residual após exceção intermediária | `probeState` no núcleo usa `try/finally` para remoção garantida de pseudoestado; erros CDP registrados com `sampleId`, `nodeId`, `operation`, `errorMessage`, `timestamp` |
| R24-07 | (implícito) Leitura de `CSS.getMatchedStylesForNode` usa API antiga (`property(j)`/`value(j)`) em vez de `cssProperties` | `c4-v05-b-r2-3.cjs` linhas 443-445 | `rule.style.property(j)` / `rule.style.value(j)` não corresponde à estrutura CDP moderna | `getWinningRule` suporta ambos: `cssProperties` array (CDP moderno) e `property(j)`/`value(j)` (CDP antigo); `!important` detectado via `getPropertyPriority` |
| R24-08 | (implícito) Validação de visibilidade não distingue `display:none`, `visibility:hidden`, `opacity:0`, dimensões zero | `c4-v05-b-r2-3.cjs` linha 180 (`DOM.describeNode` apenas verifica se nó existe) | `describeNode` não comprova visibilidade | `probeState` registra `visibilityStatus` (`valid`/`discarded`/`geometry-unavailable`) baseado em `display`, `visibility`, `opacity`, `width`, `height` |

---

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- Não há screenshots nem validação em dispositivo físico.
- `CSS.getMatchedStylesForNode` pode não capturar declarações inline (apenas regras de stylesheet).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação.
- `borderRatio` e `outlineRatio` continuam comparando contra `bg` interno; apenas `bgRatio` usa superfície adjacente externa.

---

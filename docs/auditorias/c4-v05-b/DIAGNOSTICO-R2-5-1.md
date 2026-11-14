# DIAGNÓSTICO R2.5.1 — Problemas de integridade e rastreabilidade na R2.5

Data: 2026-11-13  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-5/` (harness R2.5)  
Artefatos preservados: R1, R2, R2.1, R2.2, R2.3, R2.4, R2.5 intocados.

---

## Tabela de problemas obrigatórios

| ID | Arquivo/função | Problema | Causa | Consequência | Correção aplicada na R2.5.1 |
|---|---|---|---|---|---|
| R25-01 | `c4-v05-b-r2-5-core.cjs` — `probeState()` | `sampleId` recebia `screen` mas não incluía no identificador | Parâmetro `screen` era passado como string vazia | Colisão de identificador entre telas diferentes | `sampleId` no formato `r25-{vp}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` com `screen` efetivo |
| R25-02 | `c4-v05-b-r2-5.cjs` — `resolveNodeIdResult()` | Associação ambígua aceita silenciosamente (`ids[0]`) | Não verificava cardinalidade dos IDs retornados | Associação incorreta de amostra a nó quando múltiplos elementos correspondem | Contrato de cardinalidade extraído para o núcleo: 0→`node-not-found`, 1→`resolved`, >1→`ambiguous-node-association`, erro→`cdp-error` |
| R25-03 | `c4-v05-b-r2-5-core.cjs` — `probeState()` | Limpeza de pseudoestado não envolvia toda a computação em `try/finally` | `pseudoApplied` só definido após `forcePseudoState` completar; limpeza em bloco separado | Risco de pseudoestado residual no DOM se operação intermediária falhar | `try/finally` envolve aplicação + coleta; `pseudoApplied` definido antes da chamada; `cleanupStatus` explícito |
| R25-04 | `c4-v05-b-r2-5-core.cjs` — `probeState()` | Visibilidade não considerava ancestrais (opacity:0 em pai não detectado) | Apenas estilo computado do próprio elemento verificado | Elemento com opacidade própria normal mas ancestral com opacity:0 considerado visível | Travessia de ancestrais via CDP (`Runtime.evaluate` com `querySelector` + `parentElement`) |
| R25-05 | `c4-v05-b-r2-5-core.cjs` — `probeState()` | `opacity: 0` convertido em `1` via `|| 1`; `visibilityStatus` e `geometryStatus` não separados | `parseFloat(propMap.opacity) || 1` converte 0 em 1 | Elemento com opacity:0 tratado como visível | Validação numérica explícita de `opacity`; `visibilityStatus` e `geometryStatus` separados |
| R25-06 | `c4-v05-b-r2-5-core.cjs` — `classifyCDPError()` | Classificação baseada em texto ambíguo (`node not found` → `node-detached`) | Busca textual ampla sem evidência de remoção | Erro de seletor não encontrado classificado como nó removido | Distinção entre ausência de resultado e remoção de nó; `unknown` quando causa não demonstrada |
| R25-07 | `c4-v05-b-r2-5-core.cjs` — `measure()` | Fundo branco presumido quando `background-color` ausente | `c.bgRgb || c.bg || {r:255,g:255,b:255,a:1}` | Razão de contraste numericamente válida mas baseada em superfície presumida | `bg` permanece `null` quando não disponível; `bgRatio` permanece `null`; `hasBackground` flag |
| R25-08 | `c4-v05-b-r2-5.cjs` — caminhos absolutos | Caminhos absolutos específicos do Termux | Caminhos hardcoded `/data/data/com.termux/...` | Execução presa a ambiente específico | Caminhos relativos via `__dirname` e `path.resolve`; configuração via variáveis de ambiente |
| R25-09 | `c4-v05-b-r2-5.cjs` — limpeza DOM | Limpeza em bloco normal, não garantida após exceção | Limpeza em bloco `try/catch` separado do fluxo principal | Atributos `data-c4-audit` remanescentes após falha | `try/finally` no fluxo principal da execução |
| R25-10 | `c4-v05-b-r2-5-core.cjs` — `measure()` | Fundo branco presumido quando `background-color` ausente | `c.bgRgb || c.bg || {r:255,g:255,b:255,a:1}` | Razão de contraste baseada em superfície presumida | `bg` permanece `null` quando não disponível; `hasBackground` flag |

---

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução completa de parâmetros.
- `DOM.describeNode` pode não retornar `attributes` para todos os elementos (depende da implementação do CDP).
- Não há screenshots nem validação em dispositivo físico.
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente.
- Não implementar algoritmo completo da cascata CSS (deferido para R2.6).
- Não alterar metodologia WCAG (deferido para R2.7).

---

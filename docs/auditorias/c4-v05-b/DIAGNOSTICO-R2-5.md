# DIAGNÓSTICO R2.5 — Problemas de integridade de execução e rastreabilidade

Data: 2026-11-13  
Base auditada: `docs/auditorias/c4-v05-b/evidencias-r2-4/` (harness R2.4)  
Artefatos preservados: R1, R2, R2.1, R2.2, R2.3 e R2.4 intocados.

---

## Tabela de problemas obrigatórios

| ID | Arquivo/função | Problema | Causa | Consequência | Correção proposta |
|---|---|---|---|---|---|
| R25-01 | `c4-v05-b-r2-4-core.cjs` — `probeState()` | `screen` recebido como parâmetro mas não usado no `sampleId` | Linha 461 e 475 chamam `makeSampleId(vp, themeSet, theme, '', selector, state, i)` passando string vazia no lugar de `screen` | Colisão de identificador entre telas diferentes para o mesmo seletor/estado/índice; perda de rastreabilidade | Passar `screen` efetivamente no `makeSampleId`; formato `r25-{viewport}-{themeSet}-{theme}-{screen}-{selectorHash}-{state}-{index}` |
| R25-02 | `c4-v05-b-r2-4.cjs` — `resolveNodeIds()` | Associação ambígua aceita silenciosamente (usa `ids[0]`) | Linhas 440-444: `if (ids.length > 0) { map.set(key, ids[0]); }` sem verificar cardinalidade | Associação incorreta de amostra a nó quando múltiplos elementos correspondem à mesma chave; captura CSS em nó errado | Contrato de cardinalidade: 0 IDs → "node-not-found", 1 ID → "resolved", >1 ID → "ambiguous-node-association", erro CDP → "cdp-error" |
| R25-03 | `c4-v05-b-r2-4-core.cjs` — `probeState()` | Limpeza de pseudoestado não envolve toda a computação em `try/finally` | Linhas 597-615: limpeza em bloco `try/catch` separado após computação, não em `finally` que abranja aplicação + coleta | Risco de pseudoestado residual no DOM quando operação intermediária falha (ex: `getComputedStyleForNode` lança erro) | Restruturar com `try/finally` onde o `finally` garante remoção do pseudoestado aplicado |
| R25-04 | `c4-v05-b-r2-4-core.cjs` — `probeState()` | `opacity: 0` é convertido em `1` | Linha 648: `const opacity = parseFloat(propMap.opacity) || 1;` → `0 || 1 = 1` | Elemento com `opacity: 0` tratado como visível; classificação de visibilidade incorreta | Validação numérica explícita: `opacity === 0` detectado sem fallback para `1` |
| R25-05 | `c4-v05-b-r2-4-core.cjs` — `probeState()` | `visibilityStatus` e `geometryStatus` não separados; leitura de atributos DOM (`tabindex`, `role`, `aria-label`) não confirmada contra estrutura real | Linhas 645-655: apenas `visibilityStatus` existe; leitura de atributos em linhas 678-692 presume estrutura | Opacidade zero e ausência de geometria não diferenciadas; atributos DOM podem ser lidos incorretamente | Separar `visibilityStatus` ("visible"/"hidden"/"not-visible"/"detached") e `geometryStatus` ("available"/"unavailable"/"error"); confirmar estrutura de `node.attributes` |
| R25-06 | `c4-v05-b-r2-4-core.cjs` — erros CDP | Classificação de erros não estruturada; sem categorias rastreáveis | Erros registrados apenas com `errorName`/`errorMessage` sem classificação | Não é possível distinguir `node-detached` de `geometry-unavailable` ou `protocol-error` | Implementar classificação estruturada com categorias: node-detached, node-not-found, unsupported-operation, invalid-state, geometry-unavailable, timeout, protocol-error, unknown; incluir justificativa e grau de confiança |

---

## Trechos reais confirmados no R2.4

### R25-01 — sampleId sem `screen`

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs`

**Linha 461 (caso sem elementos):**
```js
const sampleId = makeSampleId(vp, themeSet, theme, '', selector, state, 0);
```

**Linha 475 (caso com elementos):**
```js
const sampleId = makeSampleId(vp, themeSet, theme, '', selector, state, i);
```

O parâmetro `screen` é recebido pela função mas nunca repassado ao `makeSampleId`.

### R25-02 — Associação key → nodeId ambígua

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4.cjs`

**Linhas 429-459:**
```js
async function resolveNodeIds(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.key;
    if (!key) continue;
    try {
      const qs = await DOM.querySelectorAll({
        nodeId: (await DOM.getDocument({ depth: -1, pierce: true })).root.nodeId,
        selector: `[data-c4-audit="${key}"]`
      });
      const ids = qs.nodeIds || [];
      if (ids.length > 0) {
        map.set(key, ids[0]);
      } else {
        map.set(key, null);
      }
    } catch (e) {
      ...
      map.set(key, null);
    }
  }
  return map;
}
```

Quando `ids.length > 1`, apenas `ids[0]` é usado sem sinalizar ambiguidade.

### R25-03 — Limpeza de pseudoestado não é `try/finally` real

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs`

**Linhas 528-615:**
```js
try {
  if (state !== 'normal') {
    await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] });
    pseudoApplied = true;
  }
} catch (e) { ... continue; }

try {
  const cs = await CSS.getComputedStyleForNode({ nodeId });
  computed = cs.computedStyle;
} catch (e) { ... discarded = true; }

try {
  const bm = await DOM.getBoxModel({ nodeId });
  boxModel = bm.model;
} catch (e) { ... boxModel = null; }

// R24-08: limpeza garantida com try/finally
try {
  if (pseudoApplied) {
    await CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [] });
  }
} catch (e) { ... }
```

A limpeza está em um bloco `try/catch` **separado**, não envolve a aplicação + coleta em um `try/finally` único. Se `getComputedStyleForNode` lançar, o `continue` pula a limpeza.

### R25-04 — `opacity: 0` vira `1`

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs`

**Linha 648:**
```js
const opacity = parseFloat(propMap.opacity) || 1;
```

`parseFloat('0')` retorna `0`, e `0 || 1` resulta em `1`. Elemento com `opacity: 0` é tratado como opaco.

### R25-05 — `visibilityStatus`/`geometryStatus` não separados

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs`

**Linhas 645-655:**
```js
let visibilityStatus = 'valid';
const display = propMap.display;
const visibility = propMap.visibility;
const opacity = parseFloat(propMap.opacity) || 1;
const width = parseFloat(propMap.width) || 0;
const height = parseFloat(propMap.height) || 0;

if (display === 'none') visibilityStatus = 'discarded';
else if (visibility === 'hidden') visibilityStatus = 'discarded';
else if (opacity === 0) visibilityStatus = 'discarded';
else if (width === 0 || height === 0) visibilityStatus = 'geometry-unavailable';
```

Não há `geometryStatus` separado; opacidade zero e ausência de geometria são mescladas em `visibilityStatus`.

### R25-06 — Classificação de erros CDP não estruturada

**Arquivo:** `docs/auditorias/c4-v05-b/evidencias-r2-4/c4-v05-b-r2-4-core.cjs`

Erros são registrados com campos `errorName`, `errorMessage`, `timestamp` mas sem campo `classification`, `justification` ou `confidence`. Não há mapeamento para categorias como `node-detached`, `geometry-unavailable`, `protocol-error`, etc.

---

## Limitações confirmadas que permanecem

- Gradientes: cores extraídas sem reconstrução completa de paradas/ângulo/máscara.
- `CSS.getMatchedStylesForNode` não captura declarações inline (apenas regras de stylesheet).
- O erro de console do Firebase (`32-auth-wiring.js`) é pré-existente na aplicação.
- A R2.5 não executa coleta completa do aplicativo; apenas validação controlada.
- Não implementar algoritmo completo da cascata CSS nesta etapa (deferido para R2.6).

---
